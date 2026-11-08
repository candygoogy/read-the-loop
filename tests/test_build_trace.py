"""Tests for scripts/build-trace.py. Run with: python -m unittest discover tests"""
import getpass
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

REPO = pathlib.Path(__file__).resolve().parent.parent
BUILDER = REPO / "scripts" / "build-trace.py"
DATA = REPO / "tests" / "data"
SAMPLE = DATA / "sample-session.jsonl"
# Temp folders go in out/ (gitignored), next to the repo rather than in the system temp folder.
TMP_BASE = REPO / "out" / "test-tmp"

RECORDINGS = pathlib.Path("D:/Workspace/Docs/inside-the-loop/recordings")
PROMPT_02 = "In my game the ball sometimes goes straight through the paddle. Please find the bug and fix it."
# (name, rec dir, alias, prompt, uses a .times.json, run) for each committed trace.
COMMITTED = [("01", "D:/Workspace/Claude/scratch/itl-rec-01", "~/cart",
              "The tests are failing. Please find the bug and fix it.", False, None)] + [
    (f"02-run{k}", f"D:/Workspace/Claude/scratch/itl-rec-02c-run{k}", "~/game", PROMPT_02, True, (k, 3))
    for k in (1, 2, 3)]

BUGGY = b"def f():\n    return 1 - 2\n"
FIXED = b"def f():\n    return 1 + 2\n"


def load_builder():
    spec = importlib.util.spec_from_file_location("build_trace", BUILDER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def tmpdir():
    TMP_BASE.mkdir(parents=True, exist_ok=True)
    return tempfile.TemporaryDirectory(dir=TMP_BASE)


def write_sample(tmp, rec, src=SAMPLE):
    """A test recording, with the real user name and a real folder filled in at test time
    (__PROJ__ is the folder as Claude Code names it under ~/.claude/projects)."""
    text = src.read_text(encoding="utf-8")
    text = (text.replace("__REC__", json.dumps(str(rec))[1:-1]).replace("__USER__", getpass.getuser())
            .replace("__PROJ__", load_builder().project_folder(str(rec))))
    raw = tmp / src.name
    raw.write_text(text, encoding="utf-8", newline="\n")
    return raw


def run_builder(*args):
    return subprocess.run([sys.executable, str(BUILDER), *map(str, args)], capture_output=True, text=True)


class BuildTraceTest(unittest.TestCase):
    def test_redaction_tokens_and_timing(self):
        with tmpdir() as t:
            tmp = pathlib.Path(t)
            rec = tmp / "rec"
            rec.mkdir()
            raw = write_sample(tmp, rec)
            out = tmp / "data" / "trace-sample.json"
            out.parent.mkdir()

            r = run_builder(raw, out, rec, "--prompt", "Fix it.", "--alias", "~/app", "--run", 2, "--runs", 3)
            self.assertEqual(r.returncode, 0, r.stderr)
            text = out.read_text(encoding="utf-8")
            trace = json.loads(text)

            # Redaction: no folder, no user name; the folder became the alias.
            self.assertNotIn(getpass.getuser(), text)
            self.assertNotIn(str(rec), text)
            self.assertNotIn(json.dumps(str(rec))[1:-1], text)
            calls = trace["calls"]
            self.assertEqual(calls[0]["output"][0]["input"]["command"], "cd ~/app && ls -la")
            self.assertIn("1 you 197121", calls[0]["output"][0]["result"]["text"])
            self.assertEqual(calls[1]["output"][1]["input"]["file_path"], "~/app/app.py")
            self.assertEqual(trace["final_answer"], "Fixed the sign in ~/app/app.py.")
            js = (tmp / "site" / "data" / "trace-sample.js").read_text(encoding="utf-8")
            self.assertEqual(json.loads(js.split("window.TRACE = ", 1)[1].rstrip().rstrip(";")), trace)

            # Token maths: context = input + cache read + cache write; growth between calls.
            self.assertEqual([c["context_tokens"] for c in calls], [1003, 1152, 1191, 1211])
            self.assertEqual([c["cached_tokens"] for c in calls], [0, 1000, 1150, 1190])
            self.assertEqual([c["new_tokens"] for c in calls], [1003, 152, 41, 21])
            self.assertEqual([c["added_since_previous"] for c in calls], [None, 149, 39, 20])
            self.assertEqual(trace["totals"]["model_calls"], 4)
            self.assertEqual(trace["totals"]["cost_usd"], 0.0123)

            # Timing from event timestamps: start = first model event - ttft_ms.
            self.assertEqual(trace["started_at"], "2026-01-02T10:00:00.000Z")
            self.assertEqual(trace["recorded"], "2026-01-02")
            self.assertEqual(trace["time_source"], "event_timestamps")
            self.assertEqual(trace["totals"]["ttft_ms"], 1500)
            self.assertEqual([c["t_ms"] for c in calls], [1500, 3000, 4000, 5000])
            self.assertEqual(calls[0]["output"][0]["result"]["t_ms"], 2250)
            self.assertEqual([o["t_ms"] for o in calls[1]["output"]], [3000, 3400])
            self.assertEqual(calls[1]["output"][1]["result"]["t_ms"], 3450)
            self.assertEqual(trace["run"], {"index": 2, "of": 3})
            self.assertEqual(trace["prompt"], "Fix it.")

            # Timing from a record.py sidecar: t_ms is the arrival of each line.
            times = tmp / "sample.times.json"
            arrivals = [10 * i for i in range(10)]
            times.write_text(json.dumps({"started_at": "2026-01-02T09:59:59.000Z", "arrivals_ms": arrivals}))
            r = run_builder(raw, out, rec, "--prompt", "Fix it.", "--alias", "~/app", "--times", times)
            self.assertEqual(r.returncode, 0, r.stderr)
            trace = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(trace["time_source"], "arrival")
            self.assertEqual(trace["started_at"], "2026-01-02T09:59:59.000Z")
            self.assertEqual([c["t_ms"] for c in trace["calls"]], [10, 30, 60, 80])
            self.assertEqual(trace["calls"][1]["output"][1]["result"]["t_ms"], 50)
            self.assertNotIn("run", trace)

            # Leak check: with the wrong folder nothing is redacted, so the build fails and writes nothing.
            out.unlink()
            r = run_builder(raw, out, tmp / "elsewhere", "--prompt", "Fix it.")
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("Leak check failed", r.stderr)
            self.assertFalse(out.exists())

    def test_replay_of_edits(self):
        with tmpdir() as t:
            tmp = pathlib.Path(t)
            fixture, rec, files = tmp / "fixture", tmp / "rec", tmp / "files"
            for d in (fixture, rec, rec / "__pycache__", rec / ".git"):
                d.mkdir()
            (fixture / "app.py").write_bytes(BUGGY)
            (rec / "app.py").write_bytes(FIXED)
            (rec / "__pycache__" / "app.cpython-314.pyc").write_bytes(b"ignored")
            (rec / ".git" / "HEAD").write_bytes(b"ignored")
            raw = write_sample(tmp, rec)
            out = tmp / "data" / "trace-sample.json"
            out.parent.mkdir()
            args = [raw, out, rec, "--prompt", "Fix it.", "--fixture", fixture, "--files-out", files]

            # The Edit applied to the fixture gives the recorded file; the failed Edit is skipped.
            r = run_builder(*args)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual((files / "before" / "app.py").read_bytes(), BUGGY)
            self.assertEqual((files / "after" / "app.py").read_bytes(), FIXED)

            # A file changed or created some other way (e.g. by Bash) is a mismatch.
            (rec / "app.py").write_bytes(b"def f():\n    return 3\n")
            (rec / "notes.txt").write_bytes(b"made by Bash\n")
            out.unlink()
            r = run_builder(*args)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("app.py: differs from the recording folder", r.stderr)
            self.assertIn("notes.txt: in the recording folder but not made by Edit/Write", r.stderr)
            self.assertFalse(out.exists())

    def test_leak_check_allows_only_redacted_homes(self):
        bt = load_builder()
        ok = {"text": r"C:\Users\you\AppData\Local\Python\python.exe: No module named pytest", "p": "/Users/you/x"}
        self.assertEqual(bt.find_leaks(ok, set(), "someone"), [])
        for bad in (r"D:\Workspace\Docs\notes", r"C:\Users\someone\x", "/Users/bob/x"):
            self.assertTrue(bt.find_leaks({"text": bad}, set(), "someone"), bad)

    def test_leak_check_catches_email_addresses(self):
        bt = load_builder()
        self.assertTrue(bt.find_leaks({"t": "the account is someone@example.org"}, set(), "x"))
        self.assertEqual(bt.find_leaks({"t": "Co-Authored-By: Claude <noreply@anthropic.com>"}, set(), "x"), [])

    def test_short_home_form_is_redacted(self):
        bt = load_builder()
        redact = bt.make_redact(set(), "~/x", "someone")
        out = redact(r"see C:\Users\SOMEON~1\AppData\Local\Temp\blk_1.log")
        self.assertEqual(out, r"see C:\Users\you\AppData\Local\Temp\blk_1.log")
        self.assertEqual(bt.find_leaks({"t": out}, set(), "someone"), [])

    def test_record_drops_claude_env_for_the_child_only(self):
        TMP_BASE.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP_BASE) as d:
            out = pathlib.Path(d) / "rec.jsonl"
            env = dict(os.environ, CLAUDE_EFFORT="high", CLAUDECODE="1", AI_AGENT="x", KEEP_ME="yes")
            code = "import os, json; print(json.dumps(sorted(k for k in os.environ if k.startswith(('CLAUDE', 'KEEP', 'AI_AGENT')))))"
            r = subprocess.run([sys.executable, str(REPO / "scripts" / "record.py"), str(out), "--", sys.executable, "-c", code],
                               env=env, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(json.loads(out.read_text()), ["KEEP_ME"])
            self.assertIn("CLAUDE_EFFORT", r.stderr)

    def test_denials_come_from_the_result_list(self):
        with tmpdir() as t:
            tmp = pathlib.Path(t)
            rec = tmp / "rec"
            rec.mkdir()
            raw = write_sample(tmp, rec, DATA / "denial-session.jsonl")
            out = tmp / "data" / "trace-denial.json"
            out.parent.mkdir()
            prompt = tmp / "prompt.txt"
            prompt.write_bytes("Check it.\nThanks \u2014 me\n".encode("utf-8"))

            r = run_builder(raw, out, rec, "--prompt-file", prompt, "--alias", "~/app")
            self.assertEqual(r.returncode, 0, r.stderr)
            trace = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(trace["prompt"], "Check it.\nThanks \u2014 me\n")
            steps = {s["id"]: s["result"] for c in trace["calls"] for s in c["output"] if s["kind"] == "tool"}
            # Listed in permission_denials: denied. An error whose text sounds like a denial: not denied.
            self.assertEqual({k: (v["is_error"], v["denied"]) for k, v in steps.items()},
                             {"tu_denied": (True, True), "tu_lookalike": (True, False), "tu_ok": (False, False)})
            # The new per-call usage; output_tokens needs the session file, so it's None here.
            c = trace["calls"][1]
            self.assertEqual((c["input_tokens"], c["cache_write_5m"], c["cache_write_1h"], c["output_tokens"]),
                             (2, 0, 60, None))

    def test_compaction_segment_and_its_cost(self):
        with tmpdir() as t:
            tmp = pathlib.Path(t)
            rec = tmp / "rec"
            rec.mkdir()
            raw, then, session = (write_sample(tmp, rec, DATA / n) for n in
                                  ("compact-run.jsonl", "compact-segment.jsonl", "compact-session.jsonl"))
            then_times = tmp / "segment.times.json"
            then_times.write_text(json.dumps({"started_at": "2026-01-02T10:01:00.000Z",
                                              "arrivals_ms": [0, 100, 200, 300, 400, 500]}))
            out = tmp / "data" / "trace-compact.json"
            out.parent.mkdir()
            args = [raw, out, rec, "--prompt", "What does app.py print?", "--alias", "~/app",
                    "--then", then, "--then-times", then_times, "--session", session]

            r = run_builder(*args)
            self.assertEqual(r.returncode, 0, r.stderr)
            text = out.read_text(encoding="utf-8")
            trace = json.loads(text)
            # Final output tokens come from the session file and add up to the result's 300.
            self.assertEqual([c["output_tokens"] for c in trace["calls"]], [120, 180])
            comp = trace["compaction"]
            self.assertEqual({k: comp[k] for k in ("trigger", "pre_tokens", "post_tokens", "t_ms", "calls")},
                             {"trigger": "manual", "pre_tokens": 1100, "post_tokens": 400, "t_ms": 60200, "calls": []})
            # Its own cost, not the cumulative total_cost_usd (0.08) of the resumed session.
            self.assertEqual(comp["cost_usd"], 0.03)
            self.assertEqual(comp["reattached"], [{"path": "~/app/notes.md", "kind": "stub", "chars": None},
                                                  {"path": "~/app/app.py", "kind": "full", "chars": 9}])
            # Redacted, including the folder in Claude Code's projects form; nothing else from the session file.
            self.assertTrue(comp["summary_text"].startswith("Summary: the user asked what ~/app/app.py prints."))
            self.assertIn(r"C:\Users\you\.claude\projects\--app\<session>.jsonl", comp["summary_text"])
            for s in (getpass.getuser(), str(rec), "SECRET", "environment", "prompt_snapshot"):
                self.assertNotIn(s, text)

            # Without model_usage_since_last_result, the cost is the per-model delta.
            then.write_text(then.read_text(encoding="utf-8").replace("model_usage_since_last_result", "x"),
                            encoding="utf-8", newline="\n")
            r = run_builder(*args)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["compaction"]["cost_usd"], 0.03)

            # Output tokens that don't add up to the result stop the build.
            session.write_text(session.read_text(encoding="utf-8").replace('"output_tokens":180', '"output_tokens":181'),
                               encoding="utf-8", newline="\n")
            r = run_builder(*args)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("add up to 301", r.stderr)

    def test_prompt_after_compaction(self):
        with tmpdir() as t:
            tmp = pathlib.Path(t)
            rec = tmp / "rec"
            rec.mkdir()
            raw, then, after, session = (write_sample(tmp, rec, DATA / n) for n in
                                         ("compact-run.jsonl", "compact-segment.jsonl", "after-segment.jsonl",
                                          "after-session.jsonl"))
            after_times = tmp / "after.times.json"
            # An hour after the run started (10:00:00, from its event timestamps).
            after_times.write_text(json.dumps({"started_at": "2026-01-02T11:00:00.000Z",
                                               "arrivals_ms": [0, 100, 200, 300, 400]}))
            out = tmp / "data" / "trace-after.json"
            out.parent.mkdir()
            args = [raw, out, rec, "--prompt", "What does app.py print?", "--alias", "~/app",
                    "--then", then, "--session", session, "--after", after, "--after-times", after_times]

            r = run_builder(*args)
            self.assertEqual(r.returncode, 0, r.stderr)
            text = out.read_text(encoding="utf-8")
            trace = json.loads(text)
            aft = trace["after_compaction"]
            # The prompt isn't in the stream; it comes from the session file, redacted.
            self.assertEqual(aft["prompt"], "What did you change in ~/app/app.py?")
            keys = ("t_ms", "context_tokens", "cached_tokens", "new_tokens", "input_tokens", "cache_write_5m",
                    "cache_write_1h", "output_tokens", "added_since_previous")
            self.assertEqual(set(aft["calls"][0]), set(trace["calls"][0]))
            self.assertEqual([tuple(c[k] for k in keys) for c in aft["calls"]],
                             [(3600100, 1102, 600, 502, 2, 0, 500, 40, None),
                              (3600300, 1131, 1100, 31, 1, 0, 30, 60, 29)])
            self.assertEqual(aft["calls"][0]["output"][0]["input"]["file_path"], "~/app/app.py")
            # Its own totals: 0.02, not the cumulative total_cost_usd 0.10.
            self.assertEqual(aft["totals"], {"model_calls": 2, "output_tokens": 100, "cache_read_tokens": 1700,
                                             "cache_write_tokens": 530, "cost_usd": 0.02, "duration_s": 0.4,
                                             "ttft_ms": 100})
            self.assertEqual(aft["final_answer"], "I changed nothing in ~/app/app.py; it prints 1.")
            # The compaction part is unchanged by the later records in the session file.
            self.assertEqual(trace["compaction"]["reattached"],
                             [{"path": "~/app/notes.md", "kind": "stub", "chars": None},
                              {"path": "~/app/app.py", "kind": "full", "chars": 9}])
            for s in (getpass.getuser(), str(rec), "SECRET", "budget_usd"):
                self.assertNotIn(s, text)

            # --after needs the session file.
            r = run_builder(*args[:args.index("--session")] + args[args.index("--after"):])
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("--after needs --session", r.stderr)

    def test_committed_traces_keep_existing_fields(self):
        """Rebuilding 01 and 02-run1..3 keeps every field and value; only new fields may appear."""
        bt = load_builder()
        for name, rec_dir, alias, prompt, timed, run in COMMITTED:
            raw = RECORDINGS / f"raw-{name}.jsonl"
            if not raw.exists():
                self.skipTest(f"{raw.name} not on this machine")
            with self.subTest(name):
                committed = json.loads((REPO / "data" / f"trace-{name}.json").read_text(encoding="utf-8"))
                events, _ = bt.read_events(raw)
                times = json.loads(raw.with_suffix(".times.json").read_text(encoding="utf-8")) if timed else None
                redact = bt.make_redact(bt.dir_variants(rec_dir), alias, getpass.getuser())
                self.same(committed, bt.clean(bt.build(events, prompt, times, run), redact), "trace")

    def same(self, old, new, where):
        if isinstance(old, dict):
            self.assertIsInstance(new, dict, where)
            for k, v in old.items():
                self.assertIn(k, new, f"{where}.{k} is gone")
                self.same(v, new[k], f"{where}.{k}")
        elif isinstance(old, list):
            self.assertIsInstance(new, list, where)
            self.assertEqual(len(old), len(new), f"{where} changed length")
            for i, (a, b) in enumerate(zip(old, new)):
                self.same(a, b, f"{where}[{i}]")
        else:
            self.assertEqual(old, new, where)


if __name__ == "__main__":
    unittest.main()
