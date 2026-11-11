"""Ground-truth check for fixture A (not shown to the agent). Usage: python -I A-check.py <run folder>
Runs the project's own CLI on both statements and compares each category total with Python's csv module."""
import csv, io, re, subprocess, sys
from decimal import Decimal
folder = sys.argv[1]
ok = True
for name in ("february.csv", "march.csv"):
    path = f"{folder}/statements/{name}"
    want = {}
    for r in csv.DictReader(io.open(path, encoding="utf-8", newline="")):
        c = r["Category"] or "Other"
        want[c] = want.get(c, Decimal(0)) + Decimal(r["Amount"].replace(",", ""))
    want["Total"] = sum(want.values())
    out = subprocess.run(["node", "bin/summary.js", f"statements/{name}"], cwd=folder, capture_output=True, text=True, encoding="utf-8")
    got = {}
    for line in out.stdout.splitlines()[2:]:
        m = re.match(r"^(.*\S)\s+(\S+)$", line)
        if m:
            got[m.group(1)] = m.group(2)
    bad = []
    for c, v in want.items():
        g = got.get(c)
        if g is None or g == "NaN" or Decimal(g.replace(",", "")) != v:
            bad.append(f"{c}: want {v}, got {g}")
    extra = sorted(set(got) - set(want))
    if extra:
        bad.append(f"unexpected rows {extra}")
    print(name, "OK" if not bad else "WRONG: " + "; ".join(bad))
    ok &= not bad
t = subprocess.run(["node", "--test"], cwd=folder, capture_output=True, text=True, encoding="utf-8")
print("node --test:", " ".join(l for l in t.stdout.splitlines() if re.match(r"^. (pass|fail) ", l)).encode("ascii","replace").decode())
print("REPORTED CASE FIXED" if ok else "REPORTED CASE NOT FIXED")
