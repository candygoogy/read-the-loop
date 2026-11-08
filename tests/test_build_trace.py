"""Tests for scripts/build-trace.py. Run with: python -m unittest discover tests"""
import getpass
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

REPO = pathlib.Path(__file__).resolve().parent.parent
BUILDER = REPO / "scripts" / "build-trace.py"
SAMPLE = REPO / "tests" / "data" / "sample-session.jsonl"
# Temp folders go in out/ (gitignored), next to the repo rather than in the system temp folder.
TMP_BASE = REPO / "out" / "test-tmp"

RAW_01 = pathlib.Path("D:/Workspace/Docs/inside-the-loop/recordings/raw-01.jsonl")
REC_01 = "D:/Workspace/Claude/scratch/itl-rec-01"
PROMPT_01 = "The tests are failing. Please find the bug and fix it."

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


def write_sample(tmp, rec):
    """The sample recording, with the real user name and a real folder filled in at test time."""
    text = SAMPLE.read_text(encoding="utf-8")
    text = text.replace("__REC__", json.dumps(str(rec))[1:-1]).replace("__USER__", getpass.getuser())
    raw = tmp / "sample.jsonl"
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

    @unittest.skipUnless(RAW_01.exists(), "raw-01 recording not on this machine")
    def test_trace_01_keeps_existing_fields(self):
        bt = load_builder()
        committed = json.loads((REPO / "data" / "trace-01.json").read_text(encoding="utf-8"))
        events, _ = bt.read_events(RAW_01)
        variants = bt.dir_variants(REC_01)
        rebuilt = bt.clean(bt.build(events, PROMPT_01), bt.make_redact(variants, "~/cart", getpass.getuser()))

        def same(old, new, where):
            if isinstance(old, dict):
                self.assertIsInstance(new, dict, where)
                for k, v in old.items():
                    self.assertIn(k, new, f"{where}.{k} is gone")
                    same(v, new[k], f"{where}.{k}")
            elif isinstance(old, list):
                self.assertIsInstance(new, list, where)
                self.assertEqual(len(old), len(new), f"{where} changed length")
                for i, (a, b) in enumerate(zip(old, new)):
                    same(a, b, f"{where}[{i}]")
            else:
                self.assertEqual(old, new, where)

        same(committed, rebuilt, "trace")


if __name__ == "__main__":
    unittest.main()
