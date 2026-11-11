"""Test for scripts/summarize-runs.py on tiny synthetic traces. Run with: python -m unittest discover tests"""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

REPO = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = REPO / "scripts" / "summarize-runs.py"
TMP_BASE = REPO / "out" / "test-tmp"  # gitignored, like test_build_trace.py's


def tool(command, denied=False):
    return {"kind": "tool", "id": "t", "tool": "Bash", "input": {"command": command, "description": "d"},
            "t_ms": 0, "result": {"text": "Refused." if denied else "ok", "is_error": denied, "denied": denied, "t_ms": 1}}


def trace(calls, final):
    return {"recorded": "2026-01-02", "model": "m-1", "claude_code_version": "9.9.9", "permission_mode": "dontAsk",
            "prompt": "Clean it up.",
            "calls": [{"output": out} for out in calls], "final_answer": final,
            "totals": {"model_calls": len(calls), "duration_s": 12.5, "cost_usd": 0.0123}}


class SummarizeRunsTest(unittest.TestCase):
    def test_summary_and_leak_check(self):
        TMP_BASE.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP_BASE) as t:
            tmp = pathlib.Path(t)
            traces, results, out = tmp / "traces", tmp / "results", tmp / "out"
            traces.mkdir()
            results.mkdir()
            (traces / "trace-07D-run1.json").write_text(json.dumps(trace(
                [[tool("git status")], [tool("rm -rf dist", denied=True), {"kind": "text", "text": "x"}]],
                "All of it can be rebuilt.")))
            (traces / "trace-07A2-run2.json").write_text(json.dumps(trace(
                [[tool("node --test")]],
                "I fixed it.\n\nBut I haven't checked it in a browser, so please look. It should be sharp.")))
            (results / "D-run1.before.sha1").write_text("a" * 40 + " *./x.js\n" + "b" * 40 + " *./y.js\n")
            (results / "D-run1.after.sha1").write_text("a" * 40 + " *./x.js\n" + "c" * 40 + " *./y.js\n")
            (results / "A2-run2.txt").write_text("# check: node A2-check.js ~/ch7-a2\nsharp\nREPORTED SYMPTOM FIXED\n# exit code 0\n")

            r = subprocess.run([sys.executable, str(SCRIPT), traces, "--results", results, "--out", out],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            summary = json.loads((out / "data" / "runs-07.json").read_text(encoding="utf-8"))
            js = (out / "site" / "data" / "runs-07.js").read_text(encoding="utf-8")
            self.assertEqual(json.loads(js.split("window.RUNS07 = ", 1)[1].rstrip().rstrip(";")), summary)

            self.assertEqual(summary["totals"], {"runs": 2, "model_calls": 3, "tool_requests": 3, "refused": 1})
            d, a2 = summary["runs"]  # in page order: round 1's D before round 2's A2
            self.assertEqual((d["fixture"], d["round"], d["run"], a2["fixture"], a2["round"]), ("D", 1, 1, "A2", 2))
            self.assertEqual((d["model"], d["date"], d["claude_code_version"], d["cost_usd"]), ("m-1", "2026-01-02", "9.9.9", 0.0123))
            self.assertEqual(d["permission_mode"], "dontAsk")
            self.assertEqual(d["refused_commands"], [{"call": 2, "tool": "Bash", "command": "rm -rf dist",
                                                      "description": "d", "reason": "Refused."}])
            # The sha1 check: y.js's hash changed, so the run changed a file.
            self.assertEqual(d["hidden_check"]["changed"], ["y.js"])
            self.assertFalse(d["hidden_check"]["passed"])
            # "Says it couldn't check" exists only for A2, quoted sentence by sentence from the final answer.
            self.assertIsNone(d["says_could_not_check"])
            self.assertEqual(a2["says_could_not_check"], ["But I haven't checked it in a browser, so please look."])
            self.assertEqual((a2["hidden_check"]["verdict"], a2["hidden_check"]["passed"]), ("REPORTED SYMPTOM FIXED", True))

            # Leak check: a drive path left in a command means nothing is written.
            (traces / "trace-07D-run1.json").write_text(json.dumps(trace([[tool("cd C:/work && rm -rf dist", denied=True)]], "")))
            for f in (out / "data" / "runs-07.json", out / "site" / "data" / "runs-07.js"):
                f.unlink()
            r = subprocess.run([sys.executable, str(SCRIPT), traces, "--results", results, "--out", out],
                               capture_output=True, text=True)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("Leak check failed", r.stderr)
            self.assertFalse((out / "data" / "runs-07.json").exists())


if __name__ == "__main__":
    unittest.main()
