"""Turn a raw `claude -p --output-format stream-json` recording into the page's trace JSON.

Usage: python scripts/build-trace.py <raw.jsonl> data/<name>.json <recording-dir> (--prompt TEXT | --prompt-file F)
           [--alias ~/cart] [--times <raw>.times.json] [--run K --runs N]
           [--fixture fixtures/<name> --files-out <dir>]
           [--then <raw-compact.jsonl> [--then-times <raw-compact>.times.json]] [--session <session>.jsonl]
           [--after <raw-after.jsonl> [--after-times <raw-after>.times.json]]  (--after needs --session)
(also writes site/data/<name>.js)

Redacts the recording folder (it becomes --alias) and the local user name. Everything else is kept
as recorded. Token counts come from the API usage on each model call: the context a call reads is
input + cache_read + cache_creation; the growth between two calls is what the previous step added
(the model's request plus the tool results). A call's output_tokens needs --session (see final_usage).

A tool step whose id is in the result event's permission_denials list gets result.denied = true.

--then adds a manual /compact recorded on the same session (claude -p "/compact" --resume <id>) as
trace.compaction, with any model calls of that segment in trace.compaction.calls. --session reads
Claude Code's own session file: it gives each call's final output_tokens and, after the compaction
boundary, the files Claude Code attached again (trace.compaction.reattached). Only those fields are
copied from it; the session file holds much more (prompt snapshots, request blobs, account ids).

--after adds a later prompt on the same session, recorded after the compaction (claude -p "<prompt>"
--resume <id>), as trace.after_compaction: {prompt, calls, totals, final_answer}. Its calls have the
same fields as trace.calls, with output_tokens from the session file and t_ms on the run's clock.
Its totals are that run's own (the result's usage and model_usage_since_last_result), not the
cumulative total_cost_usd. The stream doesn't hold the prompt, so it is read from the session file:
the user record the run's first model call follows from.

Timing: t_ms is ms since the start of the session. With --times (written by scripts/record.py) it is
the moment each line arrived; without it, it comes from the events' own timestamps, and the start is
the first model event minus the recorded time to first token (ttft_ms).

--fixture copies the fixture to <files-out>/before/, replays the recorded Edit and Write calls onto
<files-out>/after/, and fails unless after/ matches the recording folder byte for byte (so a file
changed some other way, e.g. by Bash, is caught). node_modules, __pycache__ and dotfiles are ignored.

Before writing, a leak check fails the build if any string in the trace still holds the recording
folder (also as ~/.claude/projects names it, D--x-y), the local user name, a home folder (":\\Users",
"/Users/") or a drive path ("D:\\", "C:/").
A home folder already redacted to "you" (C:\\Users\\you\\...) is allowed.
"""
import argparse
import datetime
import getpass
import json
import os
import pathlib
import re
import shutil
import sys

IGNORED_DIRS = {"node_modules", "__pycache__"}


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Raw stream-json recording -> redacted trace (.json + .js).")
    p.add_argument("raw")
    p.add_argument("out")
    p.add_argument("rec_dir", help="the folder the session was recorded in")
    prompt = p.add_mutually_exclusive_group(required=True)
    prompt.add_argument("--prompt", help="the prompt given to claude -p (the recording doesn't hold it)")
    prompt.add_argument("--prompt-file", help="a UTF-8 file holding the exact prompt (read as is)")
    p.add_argument("--alias", default="~/cart", help="what the recording folder becomes (default ~/cart)")
    p.add_argument("--times", help="arrival times sidecar written by scripts/record.py")
    p.add_argument("--run", type=int, help="which run this is (1-based), with --runs")
    p.add_argument("--runs", type=int, help="how many runs were recorded, with --run")
    p.add_argument("--fixture", help="the fixture folder the session started from, with --files-out")
    p.add_argument("--files-out", help="where to write before/ and after/, with --fixture")
    p.add_argument("--then", help="a later recording on the same session holding a manual /compact")
    p.add_argument("--then-times", help="arrival times sidecar for --then")
    p.add_argument("--session", help="Claude Code's session file (.jsonl) for this session")
    p.add_argument("--after", help="a later recording on the same session: one prompt after the compaction")
    p.add_argument("--after-times", help="arrival times sidecar for --after")
    a = p.parse_args(argv)
    if (a.run is None) != (a.runs is None):
        p.error("--run and --runs go together")
    if (a.fixture is None) != (a.files_out is None):
        p.error("--fixture and --files-out go together")
    if a.then_times and not a.then:
        p.error("--then-times needs --then")
    if a.after_times and not a.after:
        p.error("--after-times needs --after")
    if a.after and not a.session:
        p.error("--after needs --session (its prompt and output tokens come from the session file)")
    return a


# --- reading -----------------------------------------------------------------------------------

def read_events(raw_path):
    """Return ([(line number, event)], line count). Line numbers match the arrivals in a .times.json."""
    lines = pathlib.Path(raw_path).read_bytes().split(b"\n")
    if lines and lines[-1] == b"":
        lines.pop()
    return [(i, json.loads(l)) for i, l in enumerate(lines) if l.strip()], len(lines)


def parse_ts(s):
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))


def iso(t):
    return t.astimezone(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def make_clock(events, result, times):
    """Return (started_at, time_source, t) where t(line, event) is ms since the start."""
    if times:
        arrivals = times["arrivals_ms"]
        return parse_ts(times["started_at"]), "arrival", lambda i, e: arrivals[i]
    if "ttft_ms" not in result:
        sys.exit("The result event has no ttft_ms, so the start time can't be worked out. Record with --times.")
    first = next(e for _, e in events if e.get("type") == "assistant")
    start = parse_ts(first["timestamp"]) - datetime.timedelta(milliseconds=result["ttft_ms"])
    return start, "event_timestamps", lambda i, e: round((parse_ts(e["timestamp"]) - start).total_seconds() * 1000)


# --- building ----------------------------------------------------------------------------------

def collect_calls(events, t, result):
    """{message id: call}, one per model call, in order. Keeps the event order (a tool result can
    arrive before the next tool_use of the same model call). Marks the denied tool steps."""
    denied = {d["tool_use_id"] for d in result.get("permission_denials") or []}
    by_id = {}
    pending = {}  # tool_use_id -> step
    for i, e in events:
        if e.get("type") == "assistant":
            m = e["message"]
            if m["id"] not in by_id:
                u = m["usage"]
                cw = u.get("cache_creation") or {}
                by_id[m["id"]] = {
                    "t_ms": t(i, e),
                    "context_tokens": u["input_tokens"] + u["cache_read_input_tokens"] + u["cache_creation_input_tokens"],
                    "cached_tokens": u["cache_read_input_tokens"],
                    "new_tokens": u["input_tokens"] + u["cache_creation_input_tokens"],
                    "input_tokens": u["input_tokens"],  # not cached
                    "cache_write_5m": cw.get("ephemeral_5m_input_tokens"),
                    "cache_write_1h": cw.get("ephemeral_1h_input_tokens"),
                    "output_tokens": None,  # filled in from the session file, see final_usage
                    "output": [],
                }
            call = by_id[m["id"]]
            for c in m["content"]:
                if c["type"] == "text":
                    call["output"].append({"kind": "text", "text": c["text"], "t_ms": t(i, e)})
                elif c["type"] == "tool_use":
                    step = {"kind": "tool", "id": c["id"], "tool": c["name"], "input": c["input"],
                            "t_ms": t(i, e), "result": None}
                    call["output"].append(step)
                    pending[c["id"]] = step
        elif e.get("type") == "user" and isinstance(e["message"]["content"], list):  # str: summary, command output
            for c in e["message"]["content"]:
                if c.get("type") == "tool_result":
                    cc = c["content"]
                    text = cc if isinstance(cc, str) else "\n".join(x.get("text", "") for x in cc)
                    pending[c["tool_use_id"]]["result"] = {"text": text.replace("\r\n", "\n"),
                                                           "is_error": bool(c.get("is_error")),
                                                           "denied": c["tool_use_id"] in denied,
                                                           "t_ms": t(i, e)}
    # The denial is read from the result's list, never guessed from the error text.
    unmatched = [d for d in denied if d not in pending or pending[d]["result"] is None]
    if unmatched:
        sys.exit(f"permission_denials names tool calls with no tool result in the stream: {unmatched}")

    calls = list(by_id.values())
    for i, call in enumerate(calls):
        call["added_since_previous"] = None if i == 0 else call["context_tokens"] - calls[i - 1]["context_tokens"]
    return by_id


def final_usage(by_id, session, result):
    """Set each call's output_tokens from the session file.

    The stream can't give it: every assistant event of one call carries the same usage, taken when the
    message started (output_tokens is a few tokens, stop_reason is null). In recording 03 those add up to
    1,291 against result.usage.output_tokens 24,637; recordings 01 and 02 are short in the same way. The
    session file's assistant records carry the final usage, and those add up to the result exactly, which
    is checked here. Their input and cache fields must match the stream's."""
    final = {r["message"]["id"]: r["message"]["usage"] for r in session if r.get("type") == "assistant"}
    for mid, call in by_id.items():
        u = final.get(mid)
        if u is None:
            sys.exit(f"The session file has no assistant record for model call {mid}.")
        cw = u.get("cache_creation") or {}
        if (u["input_tokens"], u["cache_read_input_tokens"], u["cache_creation_input_tokens"],
                cw.get("ephemeral_5m_input_tokens"), cw.get("ephemeral_1h_input_tokens")) != (
                call["input_tokens"], call["cached_tokens"], call["new_tokens"] - call["input_tokens"],
                call["cache_write_5m"], call["cache_write_1h"]):
            sys.exit(f"The session file's usage for {mid} doesn't match the stream's.")
        call["output_tokens"] = u["output_tokens"]
    total = sum(c["output_tokens"] for c in by_id.values())
    if total != result["usage"]["output_tokens"]:
        sys.exit(f"Per-call output tokens add up to {total}, but the result says {result['usage']['output_tokens']}.")


def segment_clock(events, times, start):
    """t(line, event) in ms since the run's start, for a later recording on the same session."""
    if times:
        offset = round((parse_ts(times["started_at"]) - start).total_seconds() * 1000)
        return lambda i, e: offset + times["arrivals_ms"][i]

    def t(i, e):
        # Some events (compact_boundary, status) have no timestamp; use the next event that has one.
        stamped = next(x for j, x in events if j >= i and "timestamp" in x)
        return round((parse_ts(stamped["timestamp"]) - start).total_seconds() * 1000)
    return t


def build_compaction(events, t, run_result, session=None):
    """trace.compaction from the recording of a manual /compact on the same session."""
    i_b, boundary = next(((i, e) for i, e in events if e.get("subtype") == "compact_boundary"), (None, None))
    if boundary is None:
        sys.exit("The --then recording has no compact_boundary event.")
    meta = boundary["compact_metadata"]
    summary = next(e for i, e in events if i > i_b and e.get("type") == "user" and e.get("isSynthetic"))
    content = summary["message"]["content"]
    result = next(e for _, e in events if e.get("type") == "result")

    # total_cost_usd and modelUsage are cumulative on a resumed session: here they include the whole run.
    # The segment's own cost is model_usage_since_last_result (used when present); without it, the
    # per-model costUSD minus the run's.
    since = result.get("model_usage_since_last_result")
    if since:
        cost = sum(m["costUSD"] for m in since.values())
    else:
        before = run_result.get("modelUsage") or {}
        cost = sum(m["costUSD"] - before.get(k, {}).get("costUSD", 0) for k, m in result["modelUsage"].items())

    comp = {
        "trigger": meta["trigger"],
        "pre_tokens": meta["pre_tokens"],
        "post_tokens": meta["post_tokens"],
        "summary_text": content if isinstance(content, str) else "\n".join(x.get("text", "") for x in content),
        "t_ms": t(i_b, boundary),
        "cost_usd": round(cost, 4),
        # Model calls that show up as assistant events. The summarising call itself has none; its cost
        # is in cost_usd.
        "calls": list(collect_calls(events, t, result).values()),
    }
    if session is not None:
        comp["reattached"] = reattached(session, boundary["uuid"])
    return comp


def reattached(session, boundary_uuid):
    """What Claude Code put back after the boundary: [{path, kind, chars}]. "full" is a file attachment
    holding the whole file (chars = its length as recorded); "stub" is a compact_file_reference, which
    names the file but holds no text, so chars is None. The session file has no token counts for these."""
    at = next((i for i, r in enumerate(session)
               if r.get("subtype") == "compact_boundary" and r.get("uuid") == boundary_uuid), None)
    if at is None:
        sys.exit(f"The session file has no compact_boundary {boundary_uuid}.")
    out = []
    for r in session[at + 1:]:
        if r.get("type") == "assistant":
            break  # the next model call: everything attached for it came before
        a = r.get("attachment") if r.get("type") == "attachment" else None
        if not a:
            continue
        if a["type"] == "file":
            f = a["content"]["file"]
            if f.get("startLine", 1) != 1 or f.get("numLines") != f.get("totalLines"):
                sys.exit(f"Re-attached file {a['filename']} is only part of the file; 'full' wouldn't be true.")
            out.append({"path": a["filename"], "kind": "full", "chars": len(f["content"])})
        elif a["type"] == "compact_file_reference":
            out.append({"path": a["filename"], "kind": "stub", "chars": None})
    return out


def run_totals(calls, result, cost):
    return {
        "model_calls": len(calls),
        "output_tokens": result["usage"]["output_tokens"],
        "cache_read_tokens": result["usage"]["cache_read_input_tokens"],
        "cache_write_tokens": result["usage"]["cache_creation_input_tokens"],
        "cost_usd": round(cost, 4),
        "duration_s": round(result["duration_ms"] / 1000, 1),
        "ttft_ms": result.get("ttft_ms"),
    }


def prompt_from_session(session, first_call_id):
    """The prompt a resumed run was given: the user record that the run's first model call follows
    from (walking parentUuid back past attachments and other records)."""
    by_uuid = {r["uuid"]: r for r in session if r.get("uuid")}
    r = next((r for r in session if r.get("type") == "assistant" and r["message"]["id"] == first_call_id), None)
    if r is None:
        sys.exit(f"The session file has no assistant record for model call {first_call_id}.")
    while True:
        r = by_uuid.get(r.get("parentUuid"))
        if r is None:
            sys.exit(f"Can't find the prompt of model call {first_call_id} in the session file.")
        if r.get("type") == "user" and not (r.get("isMeta") or r.get("isCompactSummary")):
            c = r["message"]["content"]
            if isinstance(c, str):
                return c
            if not any(x.get("type") == "tool_result" for x in c):
                return "\n".join(x.get("text", "") for x in c if x.get("type") == "text")


def build_after(events, t, session, previous_result):
    """trace.after_compaction from the recording of a prompt resumed after the compaction."""
    result = next(e for _, e in events if e.get("type") == "result")
    by_id = collect_calls(events, t, result)
    if not by_id:
        sys.exit("The --after recording has no model calls.")
    final_usage(by_id, session, result)
    calls = list(by_id.values())
    # As for the compaction: total_cost_usd is cumulative on a resumed session.
    since = result.get("model_usage_since_last_result")
    if since:
        cost = sum(m["costUSD"] for m in since.values())
    else:
        before = previous_result.get("modelUsage") or {}
        cost = sum(m["costUSD"] - before.get(k, {}).get("costUSD", 0) for k, m in result["modelUsage"].items())
    return {
        "prompt": prompt_from_session(session, next(iter(by_id))),
        "calls": calls,
        "totals": run_totals(calls, result, cost),
        "final_answer": result["result"],
    }


def build(events, prompt, times=None, run=None, session=None, then=None, after=None):
    """The trace before redaction. session: the session file's records. then: (events, times) of a
    manual /compact recorded on the same session. after: (events, times) of a prompt resumed after it."""
    init = next(e for _, e in events if e.get("type") == "system" and e.get("subtype") == "init")
    result = next(e for _, e in events if e.get("type") == "result")
    started_at, time_source, t = make_clock(events, result, times)

    by_id = collect_calls(events, t, result)
    if session is not None:
        final_usage(by_id, session, result)
    calls = list(by_id.values())

    trace = {
        "source": "Real Claude Code session, recorded with claude -p --output-format stream-json. "
                  "Paths and the local user name are redacted; nothing else is edited.",
        "recorded": iso(started_at)[:10],
        "started_at": iso(started_at),
        "time_source": time_source,
        "model": init["model"],
        "claude_code_version": init["claude_code_version"],
        "prompt": prompt,
    }
    if run:
        trace["run"] = {"index": run[0], "of": run[1]}
    trace |= {
        "tools_available": init["tools"],
        "calls": calls,
        # On a resumed session total_cost_usd adds up the whole conversation; this run's own cost is in
        # model_usage_since_last_result. For a fresh run the two are the same.
        "totals": run_totals(calls, result,
                             sum(m["costUSD"] for m in result["model_usage_since_last_result"].values())
                             if result.get("model_usage_since_last_result") else result["total_cost_usd"]),
        "final_answer": result["result"],
    }
    previous = result
    if then:
        then_events, then_times = then
        trace["compaction"] = build_compaction(then_events, segment_clock(then_events, then_times, started_at),
                                               result, session)
        previous = next(e for _, e in then_events if e.get("type") == "result")
    if after:
        if session is None:
            sys.exit("--after needs --session.")
        after_events, after_times = after
        trace["after_compaction"] = build_after(after_events, segment_clock(after_events, after_times, started_at),
                                                session, previous)
    return trace


# --- redaction and the leak check --------------------------------------------------------------

def dir_variants(rec_dir):
    """Every way the recording folder may be written: D:\\x, D:/x, D:\\\\x and Git Bash's /d/x."""
    rec_dir = rec_dir.rstrip("/\\")
    v = {rec_dir, rec_dir.replace("\\", "/"), rec_dir.replace("/", "\\")}
    v |= {x.replace("\\\\", "\\") for x in list(v)}
    m = re.match(r"([A-Za-z]):[\\/]+(.*)", rec_dir)
    if m:
        v.add("/" + m[1].lower() + "/" + m[2].replace("\\", "/"))
    return v


def project_folder(path):
    """Claude Code's name for a project's folder under ~/.claude/projects (D:\\x\\y -> D--x-y). The
    compaction summary names the session file there, so this form of the recording folder must go too."""
    return re.sub(r"[^A-Za-z0-9]", "-", path)


def make_redact(variants, alias, user, session_ids=()):
    projects = {project_folder(v) for v in variants}

    def redact(s):
        for v in sorted(variants, key=len, reverse=True):
            s = s.replace(v, alias)
        for v in projects:
            s = re.sub(re.escape(v), project_folder(alias), s, flags=re.I)
        s = s.replace(alias + "\\", alias + "/")
        s = re.sub(rf"\b{re.escape(user)}\b", "you", s)
        # Windows also writes home folders in 8.3 short form (C:\Users\JOHNDO~1); that's the user name too.
        s = SHORT_HOME.sub(r"\1you", s)
        # Session ids are local details (README); one can turn up inside a compaction summary.
        for sid in session_ids:
            s = s.replace(sid, "<session>")
        return s
    return redact


SHORT_HOME = re.compile(r"((?:[A-Za-z]:)?[\\/]+Users[\\/]+)[^\\/\s~]{1,6}~\d+", re.I)


def clean(obj, redact):
    if isinstance(obj, str):
        return redact(obj)
    if isinstance(obj, list):
        return [clean(x, redact) for x in obj]
    if isinstance(obj, dict):
        return {k: clean(v, redact) for k, v in obj.items()}
    return obj


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, list):
        for x in obj:
            yield from strings(x)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from strings(v)


PUBLIC_EMAILS = ("noreply@anthropic.com",)
REDACTED_HOME = re.compile(r"(?:[A-Za-z]:)?[\\/]Users[\\/]you(?=[\\/]|$)", re.I)


def find_leaks(trace, variants, user):
    """Return a short excerpt around each leak. Checks the strings themselves, not their JSON escapes."""
    patterns = [(re.escape(v), re.I) for v in variants | {project_folder(v) for v in variants}] + [
        (rf"\b{re.escape(user)}\b", re.I),
        (r":\\Users", re.I),
        (r"/Users/", 0),
        (r"(?<![A-Za-z])[A-Za-z]:[\\/]", 0),  # a drive path such as D:\ or C:/
        # An email address. Claude Code sends the account's email to the model (RECORDING-05); it must never
        # reach a trace, even though the stream recordings so far don't contain it.
        (r"[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b", 0),
    ]
    hits = []
    for s in strings(trace):
        # A home folder already redacted to "you" (e.g. Python's own path in an error) is fine.
        s = REDACTED_HOME.sub("~", s)
        # Public, non-personal addresses that Claude Code itself writes (e.g. in a commit trailer it suggests).
        for public in PUBLIC_EMAILS:
            s = s.replace(public, "")
        for pat, flags in patterns:
            for m in re.finditer(pat, s, flags):
                hits.append(s[max(0, m.start() - 30):m.end() + 30].replace("\n", " "))
    return hits


# --- replaying file edits ----------------------------------------------------------------------

def tree(root):
    """{relative posix path: Path} for the files under root, skipping node_modules, __pycache__, dotfiles."""
    root = pathlib.Path(root)
    files = {}
    for d, dirs, names in os.walk(root):
        dirs[:] = [x for x in dirs if x not in IGNORED_DIRS and not x.startswith(".")]
        for n in names:
            if not n.startswith("."):
                p = pathlib.Path(d) / n
                files[p.relative_to(root).as_posix()] = p
    return files


def rel_path(file_path, variants):
    p = file_path.replace("\\", "/")
    for v in sorted({x.replace("\\", "/") for x in variants}, key=len, reverse=True):
        if p.lower().startswith(v.lower() + "/"):
            return p[len(v) + 1:]
    if re.match(r"[A-Za-z]:/|/", p):
        sys.exit(f"A recorded edit writes outside the recording folder: {file_path}")
    return p


def replay(calls, fixture, files_out, rec_dir, variants):
    """Rebuild the end state from the fixture and the recorded edits. Return a list of problems."""
    out = pathlib.Path(files_out)
    before, after = out / "before", out / "after"
    for d in (before, after):
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
        for rel, src in tree(fixture).items():
            (d / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, d / rel)

    steps = [s for c in calls for s in c["output"] if s["kind"] == "tool" and s["tool"] in ("Edit", "Write")]
    for s in steps:
        if s["result"] and s["result"]["is_error"]:
            continue
        inp = s["input"]
        path = after / rel_path(inp["file_path"], variants)
        if s["tool"] == "Write":
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(inp["content"].encode("utf-8"))
            continue
        old, new = inp["old_string"], inp["new_string"]
        if old == "" and not path.exists():  # an Edit with an empty old_string creates the file
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(new.encode("utf-8"))
            continue
        text = path.read_bytes().decode("utf-8") if path.exists() else None
        if text is None or old not in text:
            sys.exit(f"Can't replay Edit {s['id']}: old_string not found in {inp['file_path']}")
        text = text.replace(old, new) if inp.get("replace_all") else text.replace(old, new, 1)
        path.write_bytes(text.encode("utf-8"))

    want, got = tree(rec_dir), tree(after)
    problems = [f"{r}: in the recording folder but not made by Edit/Write" for r in sorted(want.keys() - got.keys())]
    problems += [f"{r}: made by the replay but missing from the recording folder" for r in sorted(got.keys() - want.keys())]
    problems += [f"{r}: differs from the recording folder (changed another way, e.g. by Bash?)"
                 for r in sorted(want.keys() & got.keys()) if want[r].read_bytes() != got[r].read_bytes()]
    return problems


# --- main --------------------------------------------------------------------------------------

def read_times(path, raw, n_lines):
    if not path:
        return None
    times = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    if len(times["arrivals_ms"]) != n_lines:
        sys.exit(f"{path} has {len(times['arrivals_ms'])} arrival times but {raw} has {n_lines} lines.")
    return times


def main(argv=None):
    a = parse_args(argv)
    user = getpass.getuser()
    variants = dir_variants(a.rec_dir)
    events, n_lines = read_events(a.raw)
    times = read_times(a.times, a.raw, n_lines)
    prompt = a.prompt if a.prompt is not None else pathlib.Path(a.prompt_file).read_bytes().decode("utf-8")
    then = None
    if a.then:
        then_events, then_lines = read_events(a.then)
        then = (then_events, read_times(a.then_times, a.then, then_lines))
    after = None
    if a.after:
        after_events, after_lines = read_events(a.after)
        after = (after_events, read_times(a.after_times, a.after, after_lines))
    session = [e for _, e in read_events(a.session)[0]] if a.session else None
    trace = build(events, prompt, times, (a.run, a.runs) if a.run is not None else None, session, then, after)

    if a.fixture:
        problems = replay(trace["calls"], a.fixture, a.files_out, a.rec_dir, variants)
        if problems:
            sys.exit("Replaying the recorded edits doesn't reproduce the recording folder:\n  " + "\n  ".join(problems))
        print("replay ok: after/ matches", a.rec_dir)

    session_ids = {e["session_id"] for _, e in events + (then[0] if then else []) + (after[0] if after else [])
                   if e.get("session_id")}
    trace = clean(trace, make_redact(variants, a.alias, user, session_ids))
    leaks = find_leaks(trace, variants | session_ids, user)
    if leaks:
        sys.exit("Leak check failed, nothing written. Still in the trace:\n  " + "\n  ".join(leaks))

    json.dump(trace, open(a.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    # The page loads the trace as a script so it also works when opened straight from disk.
    out = pathlib.Path(a.out)
    js_path = out.parent.parent / "site" / "data" / (out.stem + ".js")
    js_path.parent.mkdir(parents=True, exist_ok=True)
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("// Generated by scripts/build-trace.py. Do not edit.\n")
        f.write("window.TRACE = " + json.dumps(trace, ensure_ascii=False) + ";\n")
    print("calls", len(trace["calls"]), [c["context_tokens"] for c in trace["calls"]])
    print("denied", sum(1 for c in trace["calls"] for s in c["output"] if s["kind"] == "tool" and (s["result"] or {}).get("denied")))
    if "compaction" in trace:
        comp = trace["compaction"]
        print("compaction", comp["pre_tokens"], "->", comp["post_tokens"], "cost", comp["cost_usd"],
              "calls", len(comp["calls"]), "reattached", len(comp.get("reattached", [])))
    if "after_compaction" in trace:
        aft = trace["after_compaction"]
        print("after compaction: calls", [(c["context_tokens"], c["cached_tokens"]) for c in aft["calls"]],
              "cost", aft["totals"]["cost_usd"])
    print(js_path, js_path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
