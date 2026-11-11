"""Check whether each chapter 8 run fixed the bug: run the fixture's tests on the game as the agent left it.

Usage: python scripts/check-playground.py [<runs dir>]
<runs dir> holds the 16 run folders run01 ... run16 (default: itl-rec-08 inside "scratch" in local.json).
RUNS below says which combination and run each folder holds: the order they were recorded in (RECORDING-08).

For each run it copies the run folder to out/check-08/<combo>-run<K>/, puts fixtures/game/game.test.js back in
place of the run's own copy (so tests the agent added or changed don't decide the verdict), runs `node --test`
there, and writes data/checks-08/<combo>-run<K>.txt:
  # check: node --test, with fixtures/game/game.test.js
  # run folder: ~/game (<combo> run <K>, as the agent left it)
  # changed against fixtures/game: <files, comma-separated, or "nothing">
  # ran: <UTC time>, node <version>
  <node's stdout and stderr as printed>
  # exit code <N>
The folder paths are replaced by ~/game and the local user name by "you" (the same redaction as
scripts/build-trace.py). Nothing is written if the leak check (scripts/leakcheck.py) still finds anything.
scripts/summarize-playground.py reads these files.
"""
import datetime
import filecmp
import getpass
import importlib.util
import json
import pathlib
import shutil
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
FIXTURE = REPO / "fixtures" / "game"
RESULTS = REPO / "data" / "checks-08"
WORK = REPO / "out" / "check-08"
ALIAS = "~/game"
sys.path.insert(0, str(REPO / "scripts"))
import leakcheck  # noqa: E402

spec = importlib.util.spec_from_file_location("build_trace", REPO / "scripts" / "build-trace.py")
build_trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_trace)

ORDER = ["opus-bash-norule", "haiku-bash-norule", "opus-bash-rule", "haiku-bash-rule",
         "opus-nobash-norule", "haiku-nobash-norule", "opus-nobash-rule", "haiku-nobash-rule"]
# run folder -> (combination, run): run 1 of all 8 in ORDER, then run 2 of all 8 in the same order.
RUNS = {f"run{(k - 1) * 8 + i + 1:02d}": (combo, k) for k in (1, 2) for i, combo in enumerate(ORDER)}


def files(root):
    return sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file())


def changed(folder):
    """Files that differ from the fixture, appeared or went."""
    have, had = set(files(folder)), set(files(FIXTURE))
    return sorted(f for f in have | had
                  if f not in have or f not in had or not filecmp.cmp(folder / f, FIXTURE / f, shallow=False))


def main():
    runs_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else \
        pathlib.Path(json.loads((REPO / "local.json").read_text(encoding="utf-8"))["scratch"]) / "itl-rec-08"
    user = getpass.getuser()
    node = subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip()
    RESULTS.mkdir(parents=True, exist_ok=True)
    for name, (combo, k) in RUNS.items():
        folder = runs_dir / name
        if not folder.is_dir():
            sys.exit(f"No run folder {folder}")
        work = WORK / f"{combo}-run{k}"
        if work.exists():
            shutil.rmtree(work)
        shutil.copytree(folder, work)
        shutil.copyfile(FIXTURE / "game.test.js", work / "game.test.js")
        diff = changed(folder)
        ran = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        r = subprocess.run(["node", "--test"], cwd=work, capture_output=True, encoding="utf-8", errors="replace")
        text = ("# check: node --test, with fixtures/game/game.test.js\n"
                f"# run folder: {ALIAS} ({combo} run {k}, as the agent left it)\n"
                f"# changed against fixtures/game: {', '.join(diff) or 'nothing'}\n"
                f"# ran: {ran}, node {node}\n"
                + r.stdout + r.stderr + f"# exit code {r.returncode}\n").replace("\r\n", "\n")
        variants = build_trace.dir_variants(str(folder)) | build_trace.dir_variants(str(work))
        text = build_trace.make_redact(variants, ALIAS, user)(text)
        leaks = leakcheck.find_leaks(text, variants, user)
        if leaks:
            sys.exit(f"Leak check failed for {combo}-run{k}, nothing written:\n  " + "\n  ".join(leaks))
        out = RESULTS / f"{combo}-run{k}.txt"
        out.write_bytes(text.encode("utf-8"))
        print(out.relative_to(REPO).as_posix(), "exit", r.returncode, "changed", diff)


if __name__ == "__main__":
    main()
