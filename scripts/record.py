"""Record a command's stdout line by line, exactly as it arrives, and when each line arrived.

Usage: python scripts/record.py <out-raw.jsonl> -- <command...>

Runs the command in the current folder, directly (list form, no shell), and writes:
- <out-raw.jsonl>: every stdout line, byte for byte, written as soon as it arrives;
- <out stem>.times.json: {"started_at": ISO time of the spawn (UTC),
                          "arrivals_ms": [ms since the spawn, one per line]}.
stderr goes straight to the terminal, and the command's exit code is passed on.

The command gets a copy of this environment without the CLAUDE* variables (CLAUDECODE, CLAUDE_EFFORT,
CLAUDE_CODE_*...). When this runs inside a Claude Code session, those would otherwise leak into the recorded
session and change it. Only the child process is affected: nothing outside it changes.
"""
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time


def main(argv):
    if len(argv) < 3 or argv[1] != "--":
        sys.exit(__doc__)
    out = pathlib.Path(argv[0])
    cmd = argv[2:]
    # On Windows, CreateProcess only adds ".exe"; which() also finds .cmd/.bat shims on PATH.
    cmd[0] = shutil.which(cmd[0]) or cmd[0]
    times_path = out.with_name(out.stem + ".times.json")
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith("CLAUDE")}
    dropped = sorted(k for k in os.environ if k.upper().startswith("CLAUDE"))
    if dropped:
        print("record.py: not passing to the child:", ", ".join(dropped), file=sys.stderr)

    arrivals = []
    started_at = datetime.datetime.now(datetime.timezone.utc)
    t0 = time.perf_counter()
    # No stdin, so `claude -p` never waits for piped input; stderr is inherited.
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, env=env)
    try:
        with open(out, "wb") as f:
            assert proc.stdout is not None
            for line in iter(proc.stdout.readline, b""):
                arrivals.append(round((time.perf_counter() - t0) * 1000))
                f.write(line)
                f.flush()
    finally:
        code = proc.wait()
        times = {
            "started_at": started_at.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "arrivals_ms": arrivals,
        }
        times_path.write_text(json.dumps(times) + "\n", encoding="utf-8")
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
