"""Ground-truth check for fixture B (not shown to the agent). Usage: python -I B-check.py <run folder>
Runs `total --week` with "today" pinned to several days and compares with a sum done here."""
import datetime, json, os, re, subprocess, sys, tempfile
folder = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
entries = json.load(open(os.path.join(here, "..", "B", "worklog.json"), encoding="utf-8"))["entries"]
def expect(today, project=None):
    t = datetime.date.fromisoformat(today); mon = t - datetime.timedelta(days=t.weekday())
    per = {}
    for e in entries:
        d = datetime.date.fromisoformat(e["day"])
        if mon <= d <= t and (project is None or e["project"] == project):
            per[e["project"]] = per.get(e["project"], 0) + e["hours"]
    return per, sum(per.values())
log = os.path.join(tempfile.mkdtemp(), "worklog.json")
json.dump({"version": 1, "entries": entries}, open(log, "w"))
ok = True
for today, project in (("2026-11-11", None), ("2026-11-09", None), ("2026-11-15", None), ("2026-11-08", None), ("2026-11-11", "acme")):
    args = ["node", "-r", os.path.join(here, "B-fakedate.js"), "bin/worklog.js", "total", "--week"] + (["--project", project] if project else [])
    env = dict(os.environ, WORKLOG_FILE=log, FAKE_NOW=today + "T12:00:00")
    r = subprocess.run(args, cwd=folder, capture_output=True, text=True, encoding="utf-8", env=env)
    per, total = expect(today, project)
    nums = {m.group(1): float(m.group(2)) for m in re.finditer(r"^(\S+)\s+([\d.]+)h\s*$", r.stdout, re.M)}
    good = r.returncode == 0 and abs(nums.get("Total", -1) - total) < 1e-9 and all(abs(nums.get(p, -1) - v) < 1e-9 for p, v in per.items())
    print(f"today={today} project={project}: {'OK' if good else 'WRONG'}  want {per} total {total}; got rc={r.returncode} {r.stdout.strip()!r} {r.stderr.strip()[:200]!r}")
    ok &= good
t = subprocess.run(["node", "--test"], cwd=folder, capture_output=True, text=True, encoding="utf-8")
print("node --test:", " ".join(l for l in t.stdout.splitlines() if re.match(r"^. (pass|fail) ", l)).encode("ascii", "replace").decode())
print("FEATURE WORKS" if ok else "FEATURE BROKEN")
