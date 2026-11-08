"""Captured request bodies -> the tool manual's shape and sizes (.json + .js), with no private text.

Usage: python scripts/extract-tools.py <bodies-dir> <raw.jsonl> <rec_dir> <out.json> [--recording NN]

<bodies-dir> holds the /v1/messages request bodies saved by scripts/capture-proxy.py (001.json, ...),
<raw.jsonl> the same session's stream-json recording (for the token counts), <rec_dir> the folder
the session ran in. Writes <out.json> and site/data/<out stem>.js (window.TOOLS). The output's
"source" names the recording: NN from --recording, or else from the stream's file name (raw-NN.jsonl).

What it publishes: per tool, its name, sizes, input property names, which are required, and the
description's first sentence (at most 200 characters). For the rest of the request only sizes,
counts, roles and block types: never the system prompt's text, the messages' text or the metadata.
Sizes are characters of the JSON exactly as sent (the script checks that re-serialising each body
gives back its bytes). Before writing, a leak check (scripts/leakcheck.py, shared with build-trace.py)
fails if the output holds the local user name, a drive path or home folder, an email address, the
recording folder, the word "scratch", or any value from the requests' metadata.
"""
import argparse
import getpass
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import leakcheck  # noqa: E402

EXCERPT_MAX = 200


def compact(obj):
    """The JSON text as Claude Code sent it: compact separators, non-ASCII as is (checked in load())."""
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def load(bodies_dir):
    bodies = []
    for f in sorted(pathlib.Path(bodies_dir).glob("*.json")):
        raw = f.read_bytes()
        body = json.loads(raw)
        if compact(body).encode("utf-8") != raw:
            sys.exit(f"{f.name}: re-serialising doesn't reproduce the bytes, so sizes would be off.")
        bodies.append(body)
    if not bodies:
        sys.exit(f"No request bodies in {bodies_dir}")
    return bodies


def first_sentence(text):
    m = re.search(r"(?<!\be\.g)(?<!\bi\.e)\.(?=\s|$)", text)
    s = (text[:m.end()] if m else text).strip()
    if len(s) <= EXCERPT_MAX:
        return s, False
    return s[:EXCERPT_MAX].rsplit(" ", 1)[0], True


def tool_entry(t):
    schema = t.get("input_schema", {})
    excerpt, cut = first_sentence(t.get("description", ""))
    return {
        "name": t["name"],
        "description_chars": len(t.get("description", "")),
        "schema_chars": len(compact(schema)),
        "tool_json_chars": len(compact(t)),
        "properties": list(schema.get("properties", {})),
        "required": schema.get("required", []),
        "other_keys": {k: v for k, v in t.items() if k not in ("name", "description", "input_schema")},
        "excerpt": excerpt,
        "excerpt_truncated": cut,
    }


def block_shape(block):
    """Type and size of one content block, never its text."""
    if isinstance(block, str):
        return {"type": "string", "chars": len(block)}
    return {"type": block.get("type"), "chars": len(compact(block)),
            "cache_control": block.get("cache_control") is not None}


def message_shape(m):
    c = m["content"]
    blocks = [block_shape(c)] if isinstance(c, str) else [block_shape(b) for b in c]
    return {"role": m["role"], "chars": len(compact(m)), "blocks": blocks,
            "other_keys": sorted(k for k in m if k not in ("role", "content"))}


def without_markers(m):
    """A message without its cache_control markers, and a lone text block written as a plain string."""
    def strip(o):
        if isinstance(o, dict):
            return {k: strip(v) for k, v in o.items() if k != "cache_control"}
        return [strip(x) for x in o] if isinstance(o, list) else o
    m = strip(m)
    c = m["content"]
    if isinstance(c, list) and len(c) == 1 and c[0].keys() == {"type", "text"} and c[0]["type"] == "text":
        m = dict(m, content=c[0]["text"])
    return m


def leading_identical(a, b, key=lambda m: m):
    n = 0
    for x, y in zip(a, b):
        if compact(key(x)) != compact(key(y)):
            break
        n += 1
    return n


def call_usage(raw_path):
    """Usage of each model call in the stream, in order (one per assistant message id)."""
    calls, seen = [], set()
    for line in open(raw_path, encoding="utf-8"):
        e = json.loads(line)
        if e.get("type") == "assistant" and e["message"]["id"] not in seen:
            seen.add(e["message"]["id"])
            u = e["message"]["usage"]
            calls.append({"context_tokens": u["input_tokens"] + u["cache_read_input_tokens"]
                          + u["cache_creation_input_tokens"]})
        if e.get("type") == "system" and e.get("subtype") == "init":
            init_tools = e.get("tools", [])
            version = e.get("claude_code_version")
    return calls, init_tools, version


def build(bodies, raw_path, recording):
    first = bodies[0]
    calls, init_tools, version = call_usage(raw_path)
    if len(calls) != len(bodies):
        sys.exit(f"{len(bodies)} request bodies but {len(calls)} model calls in the stream.")

    system, tools, messages = first["system"], first["tools"], first["messages"]
    parts = {"system": len(compact(system)), "tools": len(compact(tools)), "messages": len(compact(messages))}
    parts_total = sum(parts.values())
    ctx1 = calls[0]["context_tokens"]
    system_text = system if isinstance(system, str) else "".join(b.get("text", "") for b in system)
    names = [t["name"] for t in tools]

    same = lambda key: all(compact(b.get(key)) == compact(first.get(key)) for b in bodies)
    return {
        "source": f"Request bodies of recording {recording}, captured by scripts/capture-proxy.py; "
                  f"tokens from raw-{recording}'s stream.",
        "claude_code_version": version,
        "model": first["model"],
        "requests": len(bodies),
        "request_keys": sorted(first),
        "settings": {k: first.get(k) for k in ("max_tokens", "stream", "thinking", "output_config",
                                               "context_management") if k in first},
        "tools": [tool_entry(t) for t in tools],
        "tools_json_chars": parts["tools"],
        "tools_description_chars": sum(len(t.get("description", "")) for t in tools),
        "tools_not_in_init": [n for n in names if n not in init_tools],
        "init_tools": init_tools,
        "system": {
            "note": "Size only; the text is not published.",
            "text_chars": len(system_text),
            "json_chars": parts["system"],
            "blocks": [block_shape(b) for b in system] if isinstance(system, list) else [block_shape(system)],
        },
        "call1": {
            "messages": len(messages),
            "message_shapes": [message_shape(m) for m in messages],
            "parts_chars": parts,
            "parts_total_chars": parts_total,
            "context_tokens": ctx1,
            "estimate": {
                "method": "context_tokens x each part's share of the characters; the recording has no per-part token count",
                "tools_tokens": round(ctx1 * parts["tools"] / parts_total),
                "system_tokens": round(ctx1 * parts["system"] / parts_total),
                "messages_tokens": round(ctx1 * parts["messages"] / parts_total),
                "tools_share": round(parts["tools"] / parts_total, 4),
                "system_share": round(parts["system"] / parts_total, 4),
            },
        },
        "across_requests": {
            "tools_identical": same("tools"),
            "system_identical": same("system"),
            "model_identical": same("model"),
            "settings_identical": all(same(k) for k in ("max_tokens", "stream", "thinking", "output_config",
                                                        "context_management")),
            "metadata_identical": same("metadata"),
            "messages_count": [len(b["messages"]) for b in bodies],
            "messages_kept_from_previous": [None] + [leading_identical(a["messages"], b["messages"])
                                                     for a, b in zip(bodies, bodies[1:])],
            "messages_kept_ignoring_cache_markers": [None] + [
                leading_identical(a["messages"], b["messages"], without_markers) for a, b in zip(bodies, bodies[1:])],
            "context_tokens": [c["context_tokens"] for c in calls],
        },
    }


def find_leaks(out, bodies, rec_dir, user):
    rec_dir = rec_dir.rstrip("/\\")
    secrets = {rec_dir, rec_dir.replace("\\", "/"), rec_dir.replace("/", "\\"), pathlib.PurePath(rec_dir).name}
    for b in bodies:  # metadata holds ids (device, account, session); none may turn up in the output
        for s in leakcheck.strings(b.get("metadata", {})):
            secrets |= set(re.findall(r"[0-9a-f-]{16,}", s, re.I)) | {s}
    return leakcheck.find_leaks(out, secrets, user, extra=[(r"scratch", re.I)])


def main(argv):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("bodies_dir")
    p.add_argument("raw")
    p.add_argument("rec_dir")
    p.add_argument("out")
    p.add_argument("--recording", help="the recording's number, e.g. 05 (default: from raw-NN.jsonl)")
    a = p.parse_args(argv)
    m = re.fullmatch(r"raw-(.+)", pathlib.Path(a.raw).stem)
    recording = a.recording or (m and m[1])
    if not recording:
        p.error(f"can't tell the recording's number from {a.raw}; pass --recording NN")
    rec_dir, out_path = a.rec_dir, a.out
    bodies = load(a.bodies_dir)
    out = build(bodies, a.raw, recording)
    leaks = find_leaks(out, bodies, rec_dir, getpass.getuser())
    if leaks:
        sys.exit("Leak check failed, nothing written. Still in the output:\n  " + "\n  ".join(leaks))

    out_path = pathlib.Path(out_path)
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    js = out_path.parent.parent / "site" / "data" / (out_path.stem + ".js")
    js.write_text("// Generated by scripts/extract-tools.py. Do not edit.\nwindow.TOOLS = "
                  + json.dumps(out, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")
    print("tools", [(t["name"], t["description_chars"]) for t in out["tools"]])
    print("tools json", out["tools_json_chars"], "system text", out["system"]["text_chars"],
          "call 1 parts", out["call1"]["parts_chars"], "estimate", out["call1"]["estimate"])
    print("across requests", out["across_requests"])
    print("leak check ok; wrote", out_path, "and", js)


if __name__ == "__main__":
    main(sys.argv[1:])
