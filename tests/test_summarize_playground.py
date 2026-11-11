"""Test for scripts/summarize-playground.py on tiny synthetic traces. Run with: python -m unittest discover tests"""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

REPO = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = REPO / "scripts" / "summarize-playground.py"
TMP_BASE = REPO / "out" / "test-tmp"  # gitignored, like the other tests'


def step(tool, inp, t, text="ok", is_error=False, denied=False):
    return {"kind": "tool", "id": "t", "tool": tool, "input": inp, "t_ms": t - 1,
            "result": {"text": text, "is_error": is_error, "denied": denied, "t_ms": t}}


def bash(command, t, **kw):
    return step("Bash", {"command": command, "description": "d"}, t, **kw)


def edit(t, path="~/game/game.js"):
    return step("Edit", {"file_path": path, "old_string": "a", "new_string": "b"}, t)


def trace(model, tools, calls):
    return {"recorded": "2026-01-02", "model": model, "claude_code_version": "9.9.9", "permission_mode": "acceptEdits",
            "tools_available": tools, "calls": [{"cached_tokens": 100 * n, "output": out} for n, out in enumerate(calls)],
            "final_answer": "Fixed.", "totals": {"model_calls": len(calls), "duration_s": 12.5, "cost_usd": 0.0123}}


def check(name, passed, failed, changed="game.js"):
    return (f"# check: node --test, with fixtures/game/game.test.js\n# run folder: ~/game ({name}, as the agent left it)\n"
            f"# changed against fixtures/game: {changed}\n# ran: 2026-01-02T00:00:00Z, node v1\n"
            f"\u2139 tests {passed + failed}\n\u2139 pass {passed}\n\u2139 fail {failed}\n# exit code {1 if failed else 0}\n")


class SummarizePlaygroundTest(unittest.TestCase):
    def run_script(self, traces, checks, out):
        return subprocess.run([sys.executable, str(SCRIPT), traces, "--checks", checks, "--out", out],
                              capture_output=True, text=True, encoding="utf-8")

    def test_summary_tests_order_and_leak_check(self):
        TMP_BASE.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP_BASE) as t:
            tmp = pathlib.Path(t)
            traces, checks, out = tmp / "traces", tmp / "checks", tmp / "out"
            traces.mkdir()
            checks.mkdir()
            with_bash = ["Bash", "Read", "Edit", "Glob", "Grep"]
            # Tests before the edit (a failing run still counts), a refused command, tests after the last edit.
            (traces / "trace-08-opus-bash-rule-run1.json").write_text(json.dumps(trace("claude-opus-5-5", with_bash, [
                [bash("cd ~/game && node --test 2>&1 | tail -20", 10, is_error=True)],
                [edit(20), bash("rm -rf x", 30, text="Refused.", is_error=True, denied=True)],
                [edit(40, "~/game/game.test.js"), bash("node --test game.test.js", 50)]])))
            (checks / "opus-bash-rule-run1.txt").write_text(check("opus-bash-rule run 1", 6, 0, "game.js, game.test.js"),
                                                            encoding="utf-8")
            # No Bash offered: the model calls it anyway; that is not a test run.
            (traces / "trace-08-haiku-nobash-norule-run2.json").write_text(json.dumps(trace(
                "claude-haiku-5-5", ["Read", "Edit", "Glob", "Grep"],
                [[edit(10)], [bash("node --test", 20, text="Error: No such tool available: Bash.", is_error=True)]])))
            (checks / "haiku-nobash-norule-run2.txt").write_text(check("haiku-nobash-norule run 2", 4, 1), encoding="utf-8")

            r = self.run_script(traces, checks, out)
            self.assertEqual(r.returncode, 0, r.stderr)
            summary = json.loads((out / "data" / "playground-08.json").read_text(encoding="utf-8"))
            js = (out / "site" / "data" / "playground-08.js").read_text(encoding="utf-8")
            self.assertEqual(json.loads(js.split("window.PLAYGROUND = ", 1)[1].rstrip().rstrip(";")), summary)

            opus, haiku = summary["runs"]  # page order: opus before haiku
            self.assertEqual((opus["switches"], opus["run"]), ({"model": "opus", "bash": "bash", "rule": "rule"}, 1))
            self.assertEqual(opus["tools"], {"Bash": 3, "Edit": 2})
            self.assertEqual(opus["refused"], 1)
            self.assertEqual([x["call"] for x in opus["test_runs"]], [1, 3])
            self.assertEqual((opus["tests_before_first_edit"], opus["tests_after_last_edit"]), (True, True))
            self.assertEqual(opus["files_changed"], ["game.js", "game.test.js"])
            self.assertTrue(opus["fix"]["correct"])
            self.assertEqual(opus["first_call_cached_tokens"], 0)

            self.assertEqual(haiku["unavailable"], [{"call": 2, "tool": "Bash", "command": "node --test",
                                                     "error": "Error: No such tool available: Bash."}])
            self.assertEqual(haiku["test_runs"], [])
            self.assertEqual((haiku["tests_before_first_edit"], haiku["tests_after_last_edit"]), (False, False))
            self.assertFalse(haiku["fix"]["correct"])
            self.assertEqual(summary["totals"], {"runs": 2, "model_calls": 5, "tool_requests": 7, "refused": 1,
                                                 "unavailable": 1, "fixed": 1})

            # A trace whose model doesn't match its name stops the build.
            bad = traces / "trace-08-haiku-nobash-norule-run2.json"
            good = bad.read_text()
            bad.write_text(good.replace("claude-haiku-5-5", "claude-opus-5-5"))
            r = self.run_script(traces, checks, out)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("not what its name says", r.stderr)

            # Leak check: a drive path left in a command means nothing is written.
            bad.write_text(good.replace("node --test", "cd C:/work && node --test"))
            for f in (out / "data" / "playground-08.json", out / "site" / "data" / "playground-08.js"):
                f.unlink()
            r = self.run_script(traces, checks, out)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("Leak check failed", r.stderr)
            self.assertFalse((out / "data" / "playground-08.json").exists())


if __name__ == "__main__":
    unittest.main()
