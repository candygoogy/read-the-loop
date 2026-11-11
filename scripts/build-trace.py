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
trace.permission_mode is the mode the run started in, from the init event's permissionMode (null if the
recording has none). The allowlist (--allowedTools) isn't in the stream or the session file, so a page has to
say where it comes from.

--then adds a manual /compact recorded on the same session (claude -p "/compact" --resume <id>) as
trace.compaction, with any model calls of that segment in trace.compaction.calls. --session reads
Claude Code's own session file: it gives each call's final output_tokens (the run's and the
compaction segment's) and, after the compaction boundary, the files Claude Code attached again
(trace.compaction.reattached). Only those fields are copied from it; the session file holds much more (prompt snapshots, request blobs, account ids).

--after adds a later prompt on the same session, recorded after the compaction (claude -p "<prompt>"
--resume <id>), as trace.after_compaction: {prompt, calls, totals, final_answer}. Its calls have the
same fields as trace.calls, with output_tokens from the session file and t_ms on the run's clock.
Its totals are that run's own (the result's usage and model_usage_since_last_result), not the
cumulative total_cost_usd. The stream doesn't hold the prompt, so it is read from the session file:
the user record the run's first model call follows from.

Subagents (the Agent tool; system/init.tools calls it Task, so trace.tool_aliases = {"Task": "Agent"}).
Every stream event of a subagent carries parent_tool_use_id = the id of the Agent call that started
it. trace.calls holds the main thread only; each subagent gets an entry in trace.subagents, in the
order they started, so a page can draw the two threads side by side:
  {tool_use_id   the Agent step in the thread that started it (its result.text is the hand-back the
                 main model saw: tools line, frame and the report indented),
   agent_id, subagent_type, description, prompt (as written by the main model), model, spawn_depth,
   status, t_ms (task_started), end_t_ms (the hand-back's arrival),
   calls         same fields as trace.calls; context_tokens and added_since_previous are its own,
   report        the subagent's last call's text, as it wrote it (not indented),
   totals        {model_calls, output_tokens, cache_read_tokens, cache_write_tokens: sums of its calls;
                  total_tokens, tool_uses, duration_s: Claude Code's own figures from the hand-back}}
trace.totals is then the whole run (model_calls, output_tokens and cache figures from modelUsage,
cost_usd, duration_s, ttft_ms) plus totals.main (from result.usage, which is the main thread's alone)
and totals.subagents (modelUsage minus that). The record has no per-thread cost, so there is none
here. trace.subagent_stats keeps spawned, completed, failed, max_depth and by_type. With --session,
each subagent's output_tokens come from <session>/subagents/agent-<agent_id>.jsonl, next to the
session file. The build stops if a subagent's last call is missing from the stream (recorded without
--forward-subagent-text), if the subagents' per-call input, cache and (with --session) output tokens
don't add up to modelUsage minus result.usage, or for a background subagent (not supported yet).
The task_* events' output_file (a temp path with the session id) is never copied.

Timing: t_ms is ms since the start of the session. With --times (written by scripts/record.py) it is
the moment each line arrived; without it, it comes from the events' own timestamps, and the start is
the first model event minus the recorded time to first token (ttft_ms).

--fixture copies the fixture to <files-out>/before/, replays the recorded Edit and Write calls (of the
run's threads and the --then and --after segments, in the order their results arrived) onto <files-out>/after/, and fails unless after/ matches the recording folder byte for byte (so a file
changed some other way, e.g. by Bash, is caught). node_modules, __pycache__ and dotfiles are ignored.

Before writing, a leak check fails the build if any string in the trace still holds the recording
folder (also as ~/.claude/projects names it, D--x-y), the local user name, a home folder (":\\Users",
"/Users/"), a drive path ("D:\\", "C:/"), a session id or an email address (rules in leakcheck.py).
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

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import leakcheck  # noqa: E402  (scripts/leakcheck.py, shared with extract-tools.py)

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

    def t(i, e):
        # System events (task_started) have no timestamp; use the next event that has one.
        stamped = e if "timestamp" in e else next(x for j, x in events if j >= i and "timestamp" in x)
        return round((parse_ts(stamped["timestamp"]) - start).total_seconds() * 1000)
    return start, "event_timestamps", t


# --- building ----------------------------------------------------------------------------------

def collect_calls(events, t, result):
    """{message id: call}, one per model call, in order. Keeps the event order (a tool result can
    arrive before the next tool_use of the same model call). Marks the denied tool steps.
    For one thread only: a stream with subagent events goes through collect_threads."""
    if any(e.get("parent_tool_use_id") for _, e in events):
        sys.exit("This recording segment has subagent events; only the run itself (not --then/--after) "
                 "can hold subagents so far.")
    denied = {d["tool_use_id"] for d in result.get("permission_denials") or []}
    by_id, pending = thread_calls(events, t, denied)
    check_denials(denied, pending)
    set_deltas(by_id)
    return by_id


def collect_threads(events, t, result):
    """(main {message id: call}, {Agent tool_use id: {message id: call}}). Every assistant and user event
    of a subagent carries parent_tool_use_id = the id of the Agent tool_use that started it; the main
    thread's have none. Grouped by that id, not by position, so parallel subagents don't mix."""
    denied = {d["tool_use_id"] for d in result.get("permission_denials") or []}
    main, subs = [], {}
    for i, e in events:
        ptu = e.get("parent_tool_use_id") if e.get("type") in ("assistant", "user") else None
        (subs.setdefault(ptu, []) if ptu else main).append((i, e))
    by_id, pending = thread_calls(main, t, denied)
    set_deltas(by_id)
    sub_calls = {}
    for ptu, evs in subs.items():
        sub_calls[ptu], p = thread_calls(evs, t, denied)
        set_deltas(sub_calls[ptu])
        pending |= p
    check_denials(denied, pending)
    return by_id, sub_calls


def check_denials(denied, pending):
    # The denial is read from the result's list, never guessed from the error text.
    unmatched = [d for d in denied if d not in pending or pending[d]["result"] is None]
    if unmatched:
        sys.exit(f"permission_denials names tool calls with no tool result in the stream: {unmatched}")


def set_deltas(by_id):
    calls = list(by_id.values())
    for i, call in enumerate(calls):
        call["added_since_previous"] = None if i == 0 else call["context_tokens"] - calls[i - 1]["context_tokens"]


def thread_calls(events, t, denied):
    """({message id: call}, {tool_use_id: step}) for the events of one thread."""
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
    return by_id, pending


def final_usage(by_id, session, result, whole=True):
    """Set each call's output_tokens from the session file.

    The stream can't give it: every assistant event of one call carries the same usage, taken when the
    message started (output_tokens is a few tokens, stop_reason is null). In recording 03 those add up to
    1,291 against result.usage.output_tokens 24,637; recordings 01 and 02 are short in the same way. The
    session file's assistant records carry the final usage, and those add up to the result exactly, which
    is checked here (whole=True). Their input and cache fields must match the stream's.

whole=False is for the compaction segment: its summarising call shows no assistant event in the
stream, so the calls that do can only add up to at most the result's output_tokens."""
    set_output_tokens(by_id, session)
    total = sum(c["output_tokens"] for c in by_id.values())
    if total > result["usage"]["output_tokens"] or (whole and total != result["usage"]["output_tokens"]):
        sys.exit(f"Per-call output tokens add up to {total}, but the result says {result['usage']['output_tokens']}.")


def set_output_tokens(by_id, session):
    """Copy each call's final output_tokens from the session file's records (see final_usage)."""
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
    calls = collect_calls(events, t, result)

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
        "calls": list(calls.values()),
    }
    if session is not None:
        final_usage(calls, session, result, whole=False)
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


AGENT_TOOLS = ("Agent", "Task")  # the tool is Agent in the steps, but system/init.tools lists it as Task
TOKEN_KEYS = ("inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens")
NO_FORWARD = " Record with --forward-subagent-text: without it the stream has no event for that call."


def build_subagents(events, t, result, main_by_id, sub_by_id, sub_session=None):
    """(trace.subagents in the order they started, {"main": totals, "subagents": totals}, whole-run sums).

    Each subagent's calls must end with the call whose usage the Agent result reports as the subagent's
    last (tool_use_result.usage); without --forward-subagent-text that call is missing and the build stops.
    sub_session(agent_id) gives the records of that subagent's session file, for the final output tokens.
    The subagents' per-call input and cache figures must add up to the run's modelUsage minus
    result.usage (which is the main thread's alone); their output tokens too, with the session files."""
    steps = {s["id"]: s for c in list(main_by_id.values()) + [c for b in sub_by_id.values() for c in b.values()]
             for s in c["output"] if s["kind"] == "tool"}
    started = {e["tool_use_id"]: (i, e) for i, e in events
               if e.get("subtype") == "task_started" and e.get("task_type") == "local_agent"}
    handback = {}  # Agent tool_use id -> the Agent result's tool_use_result (metadata, not what the model saw)
    for _, e in events:
        if e.get("type") == "user" and isinstance(e["message"]["content"], list):
            for c in e["message"]["content"]:
                if c.get("type") == "tool_result" and c["tool_use_id"] in sub_by_id:
                    handback[c["tool_use_id"]] = e.get("tool_use_result")

    out = []
    for ptu in sorted(sub_by_id, key=lambda p: started[p][0] if p in started else -1):
        step = steps.get(ptu)
        if step is None or step["tool"] not in AGENT_TOOLS:
            sys.exit(f"Subagent events name {ptu}, which is no {'/'.join(AGENT_TOOLS)} tool call in the stream.")
        if ptu not in started:
            sys.exit(f"No system/task_started event for the subagent of {ptu}.")
        i_st, st = started[ptu]
        if st.get("is_backgrounded"):
            sys.exit(f"The subagent of {ptu} ran in the background; that isn't supported yet.")
        hb = handback.get(ptu)
        if not isinstance(hb, dict) or "usage" not in hb or step["result"] is None:
            sys.exit(f"The Agent call {ptu} has no hand-back with the subagent's usage (failed or killed?).")
        if hb.get("agentId", st["task_id"]) != st["task_id"]:
            sys.exit(f"task_started and the hand-back of {ptu} name different agents.")
        if st["prompt"] != step["input"].get("prompt"):
            sys.exit(f"The subagent of {ptu} was started with a prompt other than the one in the Agent call.")
        by_id = sub_by_id[ptu]
        calls = list(by_id.values())
        hu, last = hb["usage"], calls[-1] if calls else None
        if last is None or (hu["input_tokens"], hu["cache_read_input_tokens"], hu["cache_creation_input_tokens"]) != (
                last["input_tokens"], last["cached_tokens"], last["new_tokens"] - last["input_tokens"]):
            sys.exit(f"The last model call of subagent {st['task_id']} isn't in the stream." + NO_FORWARD)
        report = "\n".join(o["text"] for o in last["output"] if o["kind"] == "text")
        if not report:
            sys.exit(f"The last model call of subagent {st['task_id']} holds no text." + NO_FORWARD)
        if sub_session is not None:
            records = sub_session(st["task_id"])
            extra = {r["message"]["id"] for r in records if r.get("type") == "assistant"} - set(by_id)
            if extra:
                sys.exit(f"Subagent {st['task_id']}'s session file has model calls the stream lacks: {sorted(extra)}."
                         + NO_FORWARD)
            set_output_tokens(by_id, records)
        out.append({
            "tool_use_id": ptu,
            "agent_id": st["task_id"],
            "subagent_type": st["subagent_type"],
            "description": st["description"],
            "prompt": st["prompt"],
            "model": hb.get("resolvedModel"),
            "spawn_depth": st.get("spawn_depth"),
            "status": hb.get("status"),
            "t_ms": t(i_st, st),
            "end_t_ms": step["result"]["t_ms"],
            "calls": calls,
            "report": report,
            "totals": {
                "model_calls": len(calls),
                "output_tokens": sum(c["output_tokens"] for c in calls) if sub_session is not None else None,
                "cache_read_tokens": sum(c["cached_tokens"] for c in calls),
                "cache_write_tokens": sum(c["new_tokens"] - c["input_tokens"] for c in calls),
                "total_tokens": hb.get("totalTokens"),
                "tool_uses": hb.get("totalToolUseCount"),
                "duration_s": round(hb["totalDurationMs"] / 1000, 1) if "totalDurationMs" in hb else None,
            },
        })

    mu = result.get("model_usage_since_last_result") or result.get("modelUsage")
    if not mu:
        sys.exit("The result has no modelUsage, so the subagents' share can't be checked.")
    whole = {k: sum(m[k] for m in mu.values()) for k in TOKEN_KEYS}
    ru = result["usage"]
    sub_calls = [c for s in out for c in s["calls"]]
    want = (whole["inputTokens"] - ru["input_tokens"], whole["cacheReadInputTokens"] - ru["cache_read_input_tokens"],
            whole["cacheCreationInputTokens"] - ru["cache_creation_input_tokens"])
    got = (sum(c["input_tokens"] for c in sub_calls), sum(c["cached_tokens"] for c in sub_calls),
           sum(c["new_tokens"] - c["input_tokens"] for c in sub_calls))
    if got != want:
        sys.exit(f"The subagents' calls read {got} (input, cache read, cache write), but modelUsage minus the "
                 f"main thread's usage is {want}. A call is missing, or something else ran.")
    sub_out = whole["outputTokens"] - ru["output_tokens"]
    if sub_session is not None and sum(c["output_tokens"] for c in sub_calls) != sub_out:
        sys.exit(f"The subagents' output tokens add up to {sum(c['output_tokens'] for c in sub_calls)}, "
                 f"but modelUsage minus the main thread's is {sub_out}.")
    threads = {
        "main": {"model_calls": len(main_by_id), "output_tokens": ru["output_tokens"],
                 "cache_read_tokens": ru["cache_read_input_tokens"],
                 "cache_write_tokens": ru["cache_creation_input_tokens"]},
        "subagents": {"model_calls": len(sub_calls), "output_tokens": sub_out,
                      "cache_read_tokens": want[1], "cache_write_tokens": want[2]},
    }
    stats = result.get("subagent_stats")
    if stats and stats.get("spawned") != len(out):
        sys.exit(f"subagent_stats says {stats.get('spawned')} subagents were spawned; the stream holds {len(out)}.")
    return out, threads, whole


def build(events, prompt, times=None, run=None, session=None, then=None, after=None, sub_session=None):
    """The trace before redaction. session: the session file's records. then: (events, times) of a
    manual /compact recorded on the same session. after: (events, times) of a prompt resumed after it.
    sub_session(agent_id): the records of a subagent's session file (with session)."""
    init = next(e for _, e in events if e.get("type") == "system" and e.get("subtype") == "init")
    result = next(e for _, e in events if e.get("type") == "result")
    started_at, time_source, t = make_clock(events, result, times)

    by_id, sub_by_id = collect_threads(events, t, result)
    if session is not None:
        final_usage(by_id, session, result)
    calls = list(by_id.values())
    subagents = None
    if sub_by_id:
        subagents, threads, whole = build_subagents(events, t, result, by_id, sub_by_id,
                                                    sub_session if session is not None else None)

    trace = {
        "source": "Real Claude Code session, recorded with claude -p --output-format stream-json. "
                  "Paths and the local user name are redacted; nothing else is edited.",
        "recorded": iso(started_at)[:10],
        "started_at": iso(started_at),
        "time_source": time_source,
        "model": init["model"],
        "claude_code_version": init["claude_code_version"],
        # The permission mode the run started in (--permission-mode). The stream doesn't show the allowlist
        # (--allowedTools), so it isn't here.
        "permission_mode": init.get("permissionMode"),
        "prompt": prompt,
    }
    if run:
        trace["run"] = {"index": run[0], "of": run[1]}
    trace["tools_available"] = init["tools"]
    used = {st["tool"] for c in calls + [c for sa in subagents or [] for c in sa["calls"]]
            for st in c["output"] if st["kind"] == "tool"}
    if "Agent" in used and "Task" in init["tools"] and "Agent" not in init["tools"]:
        trace["tool_aliases"] = {"Task": "Agent"}  # init.tools names the Agent tool Task
    trace["calls"] = calls
    if subagents:
        trace["subagents"] = subagents
    # On a resumed session total_cost_usd adds up the whole conversation; this run's own cost is in
    # model_usage_since_last_result. For a fresh run the two are the same.
    totals = run_totals(calls, result,
                        sum(m["costUSD"] for m in result["model_usage_since_last_result"].values())
                        if result.get("model_usage_since_last_result") else result["total_cost_usd"])
    if subagents:
        # result.usage is the main thread's alone; modelUsage (and the cost) covers every thread.
        totals |= {"model_calls": threads["main"]["model_calls"] + threads["subagents"]["model_calls"],
                   "output_tokens": whole["outputTokens"], "cache_read_tokens": whole["cacheReadInputTokens"],
                   "cache_write_tokens": whole["cacheCreationInputTokens"]} | threads
    trace["totals"] = totals
    trace["final_answer"] = result["result"]
    if subagents and result.get("subagent_stats"):
        trace["subagent_stats"] = {k: result["subagent_stats"].get(k)
                                   for k in ("spawned", "completed", "failed", "max_depth", "by_type")}
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
    # Escaped form, as Node prints paths inside error objects: D:\\x\\y.
    v |= {x.replace("\\", "\\\\") for x in list(v) if "\\" in x and "\\\\" not in x}
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
        # Case-insensitive, like the leak check: tools often print d:\... or a lower-cased folder.
        for v in sorted(variants, key=len, reverse=True):
            s = re.sub(re.escape(v), lambda _m: alias, s, flags=re.I)
        for v in projects:
            s = re.sub(re.escape(v), project_folder(alias), s, flags=re.I)
        s = s.replace(alias + "\\\\", alias + "/").replace(alias + "\\", alias + "/")
        s = re.sub(rf"\b{re.escape(user)}\b", "you", s, flags=re.I)
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


def find_leaks(trace, variants, user):
    """Return a short excerpt around each leak (the rules are in leakcheck.py). variants: the recording
    folder's spellings and the session ids; the folder as ~/.claude/projects names it is added here."""
    return leakcheck.find_leaks(trace, variants | {project_folder(v) for v in variants}, user)


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


def segment_calls(trace):
    """Every model call: the run's main thread and its subagents, the compaction segment, the prompt
    after it. replay puts their edits in the order they happened."""
    return (trace["calls"] + [c for s in trace.get("subagents", []) for c in s["calls"]]
            + trace.get("compaction", {}).get("calls", []) + trace.get("after_compaction", {}).get("calls", []))


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
    # In the order they were applied: an edit's result arrives once it is done. That keeps the true order
    # across threads (a subagent edits while the main thread waits on its Agent call) and segments.
    steps.sort(key=lambda s: (s["result"] or {}).get("t_ms", s.get("t_ms", 0)))
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

    def sub_session(agent_id):
        # Claude Code keeps each subagent's own records next to the session file: <id>/subagents/agent-<agent id>.jsonl
        path = pathlib.Path(a.session).with_suffix("") / "subagents" / f"agent-{agent_id}.jsonl"
        if not path.exists():
            sys.exit(f"No session file for subagent {agent_id}: {path}")
        return [e for _, e in read_events(path)[0]]
    trace = build(events, prompt, times, (a.run, a.runs) if a.run is not None else None, session, then, after,
                  sub_session)

    if a.fixture:
        problems = replay(segment_calls(trace), a.fixture, a.files_out, a.rec_dir, variants)
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
    for sa in trace.get("subagents", []):
        print("subagent", sa["subagent_type"], len(sa["calls"]), [c["context_tokens"] for c in sa["calls"]],
              "output", [c["output_tokens"] for c in sa["calls"]], "report", len(sa["report"]), "chars")
    if "subagents" in trace:
        tt = trace["totals"]
        print("totals: main", tt["main"], "subagents", tt["subagents"], "all calls", tt["model_calls"],
              "output", tt["output_tokens"], "cost", tt["cost_usd"])
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
