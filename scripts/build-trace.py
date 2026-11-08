"""Turn a raw `claude -p --output-format stream-json` recording into the page's trace JSON.

Usage: python scripts/build-trace.py <raw.jsonl> data/<name>.json <recording-dir> --prompt TEXT
           [--alias ~/cart] [--times <raw>.times.json] [--run K --runs N]
           [--fixture fixtures/<name> --files-out <dir>]
(also writes site/data/<name>.js)

Redacts the recording folder (it becomes --alias) and the local user name. Everything else is kept
as recorded. Token counts come from the API usage on each model call: the context a call reads is
input + cache_read + cache_creation; the growth between two calls is what the previous step added
(the model's request plus the tool results).

Timing: t_ms is ms since the start of the session. With --times (written by scripts/record.py) it is
the moment each line arrived; without it, it comes from the events' own timestamps, and the start is
the first model event minus the recorded time to first token (ttft_ms).

--fixture copies the fixture to <files-out>/before/, replays the recorded Edit and Write calls onto
<files-out>/after/, and fails unless after/ matches the recording folder byte for byte (so a file
changed some other way, e.g. by Bash, is caught). node_modules, __pycache__ and dotfiles are ignored.

Before writing, a leak check fails the build if any string in the trace still holds the recording
folder, the local user name, a home folder (":\\Users", "/Users/") or a drive path ("D:\\", "C:/").
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
    p.add_argument("--prompt", required=True, help="the prompt given to claude -p (the recording doesn't hold it)")
    p.add_argument("--alias", default="~/cart", help="what the recording folder becomes (default ~/cart)")
    p.add_argument("--times", help="arrival times sidecar written by scripts/record.py")
    p.add_argument("--run", type=int, help="which run this is (1-based), with --runs")
    p.add_argument("--runs", type=int, help="how many runs were recorded, with --run")
    p.add_argument("--fixture", help="the fixture folder the session started from, with --files-out")
    p.add_argument("--files-out", help="where to write before/ and after/, with --fixture")
    a = p.parse_args(argv)
    if (a.run is None) != (a.runs is None):
        p.error("--run and --runs go together")
    if (a.fixture is None) != (a.files_out is None):
        p.error("--fixture and --files-out go together")
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

def build(events, prompt, times=None, run=None):
    """The trace before redaction. Keeps the event order (a tool result can arrive before the next
    tool_use of the same model call)."""
    init = next(e for _, e in events if e.get("type") == "system" and e.get("subtype") == "init")
    result = next(e for _, e in events if e.get("type") == "result")
    started_at, time_source, t = make_clock(events, result, times)

    calls = []  # one per model call (assistant message id)
    by_id = {}
    pending = {}  # tool_use_id -> step
    for i, e in events:
        if e.get("type") == "assistant":
            m = e["message"]
            if m["id"] not in by_id:
                u = m["usage"]
                call = {
                    "t_ms": t(i, e),
                    "context_tokens": u["input_tokens"] + u["cache_read_input_tokens"] + u["cache_creation_input_tokens"],
                    "cached_tokens": u["cache_read_input_tokens"],
                    "new_tokens": u["input_tokens"] + u["cache_creation_input_tokens"],
                    "output": [],
                }
                by_id[m["id"]] = call
                calls.append(call)
            call = by_id[m["id"]]
            for c in m["content"]:
                if c["type"] == "text":
                    call["output"].append({"kind": "text", "text": c["text"], "t_ms": t(i, e)})
                elif c["type"] == "tool_use":
                    step = {"kind": "tool", "id": c["id"], "tool": c["name"], "input": c["input"],
                            "t_ms": t(i, e), "result": None}
                    call["output"].append(step)
                    pending[c["id"]] = step
        elif e.get("type") == "user":
            for c in e["message"]["content"]:
                if c.get("type") == "tool_result":
                    cc = c["content"]
                    text = cc if isinstance(cc, str) else "\n".join(x.get("text", "") for x in cc)
                    pending[c["tool_use_id"]]["result"] = {"text": text.replace("\r\n", "\n"),
                                                           "is_error": bool(c.get("is_error")),
                                                           "t_ms": t(i, e)}

    for i, call in enumerate(calls):
        call["added_since_previous"] = None if i == 0 else call["context_tokens"] - calls[i - 1]["context_tokens"]

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
        "totals": {
            "model_calls": len(calls),
            "output_tokens": result["usage"]["output_tokens"],
            "cache_read_tokens": result["usage"]["cache_read_input_tokens"],
            "cache_write_tokens": result["usage"]["cache_creation_input_tokens"],
            "cost_usd": round(result["total_cost_usd"], 4),
            "duration_s": round(result["duration_ms"] / 1000, 1),
            "ttft_ms": result.get("ttft_ms"),
        },
        "final_answer": result["result"],
    }
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


def make_redact(variants, alias, user):
    def redact(s):
        for v in sorted(variants, key=len, reverse=True):
            s = s.replace(v, alias)
        s = s.replace(alias + "\\", alias + "/")
        s = re.sub(rf"\b{re.escape(user)}\b", "you", s)
        # Windows also writes home folders in 8.3 short form (C:\Users\JOHNDO~1); that's the user name too.
        s = SHORT_HOME.sub(r"\1you", s)
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


REDACTED_HOME = re.compile(r"(?:[A-Za-z]:)?[\\/]Users[\\/]you(?=[\\/]|$)", re.I)


def find_leaks(trace, variants, user):
    """Return a short excerpt around each leak. Checks the strings themselves, not their JSON escapes."""
    patterns = [(re.escape(v), re.I) for v in variants] + [
        (rf"\b{re.escape(user)}\b", re.I),
        (r":\\Users", re.I),
        (r"/Users/", 0),
        (r"(?<![A-Za-z])[A-Za-z]:[\\/]", 0),  # a drive path such as D:\ or C:/
    ]
    hits = []
    for s in strings(trace):
        # A home folder already redacted to "you" (e.g. Python's own path in an error) is fine.
        s = REDACTED_HOME.sub("~", s)
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

def main(argv=None):
    a = parse_args(argv)
    user = getpass.getuser()
    variants = dir_variants(a.rec_dir)
    events, n_lines = read_events(a.raw)
    times = None
    if a.times:
        times = json.loads(pathlib.Path(a.times).read_text(encoding="utf-8"))
        if len(times["arrivals_ms"]) != n_lines:
            sys.exit(f"{a.times} has {len(times['arrivals_ms'])} arrival times but {a.raw} has {n_lines} lines.")
    trace = build(events, a.prompt, times, (a.run, a.runs) if a.run is not None else None)

    if a.fixture:
        problems = replay(trace["calls"], a.fixture, a.files_out, a.rec_dir, variants)
        if problems:
            sys.exit("Replaying the recorded edits doesn't reproduce the recording folder:\n  " + "\n  ".join(problems))
        print("replay ok: after/ matches", a.rec_dir)

    trace = clean(trace, make_redact(variants, a.alias, user))
    leaks = find_leaks(trace, variants, user)
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


if __name__ == "__main__":
    main()
