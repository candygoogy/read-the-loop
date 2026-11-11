"""Write chapter 8's summary of the playground grid: data/playground-08.json and site/data/playground-08.js
(window.PLAYGROUND).

Usage: python scripts/summarize-playground.py [<traces dir>] [--checks data/checks-08] [--out <repo root>]

<traces dir> (default data/) holds the traces scripts/build-trace.py made from recording 08, named
trace-08-<model>-<bash>-<rule>-run<K>.json: model opus or haiku, bash or nobash, rule or norule (RECORDING-08).
--checks holds the saved outputs of scripts/check-playground.py, one <combo>-run<K>.txt per run.

SWITCHES says what each switch value was on the command line. Those flags aren't all in the stream: the model
and the tool list are (init), and the build stops if a trace disagrees with its name. The allowlist and the
appended rule are not, so they are written here as given to claude (RECORDING-08 shows the rule in each rule
run's session file).

Everything else is read from the traces and the check files. Per run:
  combo, switches {model, bash, rule}, run, trace, site_js (whether site/data/<trace>.js exists), model,
  claude_code_version, date, permission_mode, model_calls, duration_s, cost_usd, first_call_cached_tokens
  (call 1's cache read, which an earlier run left), tools_available
  tools            {tool: how many times the model called it}, every call, refused or not
  tool_requests    the sum of tools
  refused          how many the permission check refused (result.denied), with refused_commands
                   [{call (1-based), tool, command, reason}]
  unavailable      calls to a tool the run didn't offer: [{call, tool, command, error (as the model saw it)}]
  test_runs        [{call, command}]: Bash steps that ran the tests (TEST_COMMAND), with Bash offered and the
                   step not refused. A run whose tests fail still counts.
  tests_before_first_edit, tests_after_last_edit  whether a test run comes before the first edit and after
                   the last one. An edit is an Edit or Write step that didn't fail. Steps are taken in
                   conversation order (call, then position in it), and the build stops if their results came
                   back in another order. With no edit, "after" is null.
  edits            [{call, tool, file}]
  files_changed    what differs from fixtures/game at the end (from the check file)
  fix              {check, result_file, tests, passed, failed, exit_code, correct}: the fixture's own tests run
                   on the game as the agent left it; correct = exit code 0, nothing failed and something passed
Plus combinations (in page order, with their two runs) and totals: runs, model_calls, tool_requests,
refused, unavailable, fixed. There is no cost or duration total: the traces round each run's figures, and a sum
of rounded figures isn't the real total.

Like the trace builders, it runs scripts/leakcheck.py over the output and writes nothing if anything leaks.
"""
import argparse
import collections
import getpass
import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
import leakcheck  # noqa: E402

SWITCHES = {
    "model": {"opus": {"model": "claude-opus-5-5"}, "haiku": {"model": "claude-haiku-5-5"}},
    "bash": {"bash": {"tools": ["Bash", "Read", "Edit", "Glob", "Grep"],
                      "allowed_tools": ["Bash(node *)", "Read", "Edit", "Glob", "Grep"]},
             "nobash": {"tools": ["Read", "Edit", "Glob", "Grep"], "allowed_tools": ["Read", "Edit", "Glob", "Grep"]}},
    "rule": {"norule": {"append_system_prompt": None},
             "rule": {"append_system_prompt": "Run the tests before and after any change."}},
}
NAME = re.compile(r"trace-08-(opus|haiku)-(bash|nobash)-(rule|norule)-run(\d+)\.json$")
TEST_COMMAND = re.compile(r"\bnode\b[^|;&]*?(?:--test\b|\.test\.js\b)")
EDIT_TOOLS = {"Edit", "Write"}


def rel(path):
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.name


def read_check(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    head = dict(l[2:].split(": ", 1) for l in lines if l.startswith("# ") and ": " in l)
    counts = {m[1]: int(m[2]) for l in lines if (m := re.fullmatch(r"ℹ (tests|pass|fail) (\d+)", l))}
    exit_code = int(re.fullmatch(r"# exit code (-?\d+)", lines[-1])[1])
    files = head["changed against fixtures/game"]
    return ([] if files == "nothing" else files.split(", ")), {
        "check": head["check"], "result_file": rel(path), "tests": counts.get("tests"), "passed": counts.get("pass"),
        "failed": counts.get("fail"), "exit_code": exit_code,
        "correct": exit_code == 0 and counts.get("fail") == 0 and (counts.get("pass") or 0) > 0}


def summarize(path, sw, run, checks):
    trace = json.loads(path.read_text(encoding="utf-8"))
    combo = "-".join(sw.values())
    if trace["model"] != SWITCHES["model"][sw["model"]]["model"]:
        sys.exit(f"{path.name}: model is {trace['model']}, not what its name says")
    if sorted(trace["tools_available"]) != sorted(SWITCHES["bash"][sw["bash"]]["tools"]):
        sys.exit(f"{path.name}: tools are {trace['tools_available']}, not what its name says")
    offered = set(trace["tools_available"])
    steps = [(n, s) for n, c in enumerate(trace["calls"], 1) for s in c["output"] if s["kind"] == "tool"]

    def command(s):
        return s["input"].get("command", json.dumps(s["input"]))

    result = [s.get("result") or {} for _, s in steps]
    refused = [{"call": n, "tool": s["tool"], "command": command(s), "reason": r["text"]}
               for (n, s), r in zip(steps, result) if r.get("denied")]
    unavailable = [{"call": n, "tool": s["tool"], "command": command(s), "error": r.get("text")}
                   for (n, s), r in zip(steps, result) if s["tool"] not in offered]
    tests = [i for i, ((n, s), r) in enumerate(zip(steps, result))
             if s["tool"] == "Bash" and "Bash" in offered and r and not r.get("denied") and TEST_COMMAND.search(command(s))]
    edits = [i for i, ((n, s), r) in enumerate(zip(steps, result))
             if s["tool"] in EDIT_TOOLS and s["tool"] in offered and r and not r.get("is_error")]
    # Only the order of test runs and edits matters here (parallel Reads may come back in any order).
    arrived = [result[i]["t_ms"] for i in sorted(tests + edits)]
    if arrived != sorted(arrived):
        sys.exit(f"{path.name}: test runs and edits came back out of conversation order")
    files_changed, fix = read_check(checks / f"{combo}-run{run}.txt")
    t = trace["totals"]
    return {"combo": combo, "switches": dict(sw), "run": run, "trace": path.stem,
            "site_js": (REPO / "site" / "data" / (path.stem + ".js")).exists(),
            "model": trace["model"], "claude_code_version": trace["claude_code_version"], "date": trace["recorded"],
            "permission_mode": trace["permission_mode"], "model_calls": t["model_calls"],
            "duration_s": t["duration_s"], "cost_usd": t["cost_usd"],
            "first_call_cached_tokens": trace["calls"][0]["cached_tokens"],
            "tools_available": trace["tools_available"],
            "tools": dict(collections.Counter(s["tool"] for _, s in steps)), "tool_requests": len(steps),
            "refused": len(refused), "refused_commands": refused, "unavailable": unavailable,
            "test_runs": [{"call": steps[i][0], "command": command(steps[i][1])} for i in tests],
            "tests_before_first_edit": any(i < edits[0] for i in tests) if edits else bool(tests),
            "tests_after_last_edit": any(i > edits[-1] for i in tests) if edits else None,
            "edits": [{"call": steps[i][0], "tool": steps[i][1]["tool"], "file": steps[i][1]["input"].get("file_path")}
                      for i in edits],
            "files_changed": files_changed, "fix": fix}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("traces", nargs="?", default=str(REPO / "data"))
    p.add_argument("--checks", default=str(REPO / "data" / "checks-08"))
    p.add_argument("--out", default=str(REPO), help="where data/ and site/data/ go (default: the repo)")
    a = p.parse_args(argv)
    order = {k: list(v) for k, v in SWITCHES.items()}  # page order: opus, bash, norule first
    order["rule"] = ["norule", "rule"]
    found = []
    for path in pathlib.Path(a.traces).glob("trace-08-*-run*.json"):
        if m := NAME.search(path.name):
            sw = {"model": m[1], "bash": m[2], "rule": m[3]}
            found.append(([order[k].index(v) for k, v in sw.items()], int(m[4]), sw, path))
    if not found:
        sys.exit(f"No trace-08-<model>-<bash>-<rule>-run<K>.json in {a.traces}")
    runs = [summarize(path, sw, k, pathlib.Path(a.checks)) for _, k, sw, path in sorted(found, key=lambda f: f[:2])]
    combos = {}
    for r in runs:
        combos.setdefault(r["combo"], {"combo": r["combo"], "switches": r["switches"], "runs": []})["runs"].append(r["trace"])
    out = {
        "source": "Chapter 8's playground: real Claude Code sessions recorded with claude -p on chapter 1's game, "
                  "2 runs for each of 8 combinations of 3 switches, summarised from their traces "
                  "(scripts/build-trace.py) and from the fixture's own tests run on each game as the agent left it "
                  "(scripts/check-playground.py, data/checks-08). Written by scripts/summarize-playground.py.",
        "switches": SWITCHES,
        "test_command": TEST_COMMAND.pattern,
        "totals": {"runs": len(runs),
                   **{k: sum(r[k] for r in runs) for k in ("model_calls", "tool_requests", "refused")},
                   "unavailable": sum(len(r["unavailable"]) for r in runs),
                   "fixed": sum(r["fix"]["correct"] for r in runs)},
        "combinations": list(combos.values()),
        "runs": runs,
    }
    leaks = leakcheck.find_leaks(out, (), getpass.getuser())
    if leaks:
        sys.exit("Leak check failed, nothing written. Still in the summary:\n  " + "\n  ".join(leaks))
    root = pathlib.Path(a.out)
    (root / "data").mkdir(parents=True, exist_ok=True)
    (root / "site" / "data").mkdir(parents=True, exist_ok=True)
    (root / "data" / "playground-08.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                                                      encoding="utf-8", newline="\n")
    (root / "site" / "data" / "playground-08.js").write_text(
        "// Generated by scripts/summarize-playground.py. Do not edit.\nwindow.PLAYGROUND = "
        + json.dumps(out, ensure_ascii=False) + ";\n", encoding="utf-8", newline="\n")
    print("runs", len(runs), "totals", out["totals"])
    for r in runs:
        print(f"  {r['combo']:<19} run {r['run']}: calls {r['model_calls']}, ${r['cost_usd']}, tools {r['tools']},"
              f" unavailable {len(r['unavailable'])}, tests before {r['tests_before_first_edit']}"
              f" after {r['tests_after_last_edit']}, changed {r['files_changed']}, fixed {r['fix']['correct']}")


if __name__ == "__main__":
    main()
