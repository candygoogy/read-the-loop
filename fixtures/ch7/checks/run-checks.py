"""Run chapter 7's hidden checks on the run folders as the agents left them, and save what they print.

Usage: python fixtures/ch7/checks/run-checks.py [<runs dir>]
<runs dir> holds the run folders itl-rec-07<M>-run<K> (default: "scratch" in local.json). Writes
fixtures/ch7/checks/results/<M>-run<K>.txt, one per run that has a check:

  A   python -I A-check.py <run folder>    the project's CLI on both statements against Python's csv module
  A2  node A2-check.js <run folder>        the page in Chromium at devicePixelRatio 1 and 2
  B   python -I B-check.py <run folder>    total --week with "today" pinned to 4 days, against a sum done here
  B2  node B2-check.mjs <run folder>       node --test, 4 tasks through bin/taskrun.js, execa names that exist

D and D2's check is the launcher's sha1 of every file outside .git before and after each run. Those lists were
written at recording time; this copies them as they are to results/<M>-run<K>.before.sha1 and .after.sha1.
C and C2 have no hidden check.

Each output file starts with a few '#' lines (the command, when it ran, the Node and Python versions); the rest
is the check's stdout and stderr as printed, with the run folder replaced by the fixture's alias and the local
user name by "you" (the same redaction as scripts/build-trace.py). Nothing is written if the leak check
(scripts/leakcheck.py) still finds the folder, the user name, a home folder, a drive path or an email.
"""
import datetime
import getpass
import importlib.util
import json
import pathlib
import platform
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent
RESULTS = HERE / "results"
sys.path.insert(0, str(REPO / "scripts"))
import leakcheck  # noqa: E402

spec = importlib.util.spec_from_file_location("build_trace", REPO / "scripts" / "build-trace.py")
build_trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_trace)

RUNS = {"A": 3, "A2": 3, "B": 3, "B2": 3, "D": 3, "D2": 3}
CHECKS = {
    "A": [sys.executable, "-I", "A-check.py"],
    "A2": ["node", "A2-check.js"],
    "B": [sys.executable, "-I", "B-check.py"],
    "B2": ["node", "B2-check.mjs"],
}


def alias(mode):
    return "~/ch7-" + mode.lower()


def save(path, text, variants, user):
    leaks = leakcheck.find_leaks(text, variants, user)
    if leaks:
        sys.exit(f"Leak check failed for {path.name}, nothing written:\n  " + "\n  ".join(leaks))
    path.write_bytes(text.encode("utf-8"))
    print("wrote", path.relative_to(REPO).as_posix())


def main():
    local = REPO / "local.json"
    runs_dir = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else
                            json.loads(local.read_text(encoding="utf-8"))["scratch"])
    user = getpass.getuser()
    RESULTS.mkdir(exist_ok=True)
    node = subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip()
    for mode, n in RUNS.items():
        for k in range(1, n + 1):
            folder = runs_dir / f"itl-rec-07{mode}-run{k}"
            variants = build_trace.dir_variants(str(folder))
            redact = build_trace.make_redact(variants, alias(mode), user)
            if mode in ("D", "D2"):
                for side in ("before", "after"):
                    src = runs_dir / f"itl-rec-07{mode}-run{k}.{side}.sha1"
                    save(RESULTS / f"{mode}-run{k}.{side}.sha1", redact(src.read_bytes().decode("utf-8")),
                         variants, user)
                continue
            cmd = CHECKS[mode] + [str(folder)]
            ran = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
            r = subprocess.run(cmd, cwd=HERE, capture_output=True, encoding="utf-8", errors="replace")
            shown = " ".join(["python" if c == sys.executable else c for c in CHECKS[mode]] + [alias(mode)])
            text = (f"# check: {shown}\n# run folder: {alias(mode)} (run {k} of fixture {mode}, as the agent left it)\n"
                    f"# ran: {ran}, node {node}, python {platform.python_version()}\n"
                    + r.stdout + (("# stderr:\n" + r.stderr) if r.stderr else "") + f"# exit code {r.returncode}\n")
            save(RESULTS / f"{mode}-run{k}.txt", redact(text.replace("\r\n", "\n")), variants, user)


if __name__ == "__main__":
    main()
