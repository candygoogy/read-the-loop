// Ground-truth check for fixture B2 (not shown to the agent). Usage: node B2-check.mjs <run folder>
// 1. node --test passes. 2. In a temp project: an object task, string tasks with arguments, and a failing string task
// run through the agent's bin/taskrun.js. 3. Every name the run's code imports from 'execa' exists in the vendored copy.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const folder = path.resolve(process.argv[2]);
let ok = true;
const t = spawnSync(process.execPath, ['--test'], { cwd: folder, encoding: 'utf8' });
const m = /pass (\d+)[\s\S]*fail (\d+)/.exec(t.stdout); console.log('node --test:', m ? `pass ${m[1]} fail ${m[2]}` : 'no summary'); ok &&= t.status === 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b2check-'));
fs.mkdirSync(path.join(tmp, 'scripts'));
fs.writeFileSync(path.join(tmp, 'scripts', 'echo.js'), 'console.log(JSON.stringify(process.argv.slice(2)))\n');
fs.writeFileSync(path.join(tmp, 'scripts', 'fail.js'), 'process.exit(3)\n');
fs.writeFileSync(path.join(tmp, 'tasks.json'), JSON.stringify({
  obj: { script: 'scripts/echo.js', args: ['--a', 'b'] },
  str: 'node scripts/echo.js --fix src',
  nodever: 'node --version',
  bad: 'node scripts/fail.js',
}));
const cases = [['obj', 0, '["--a","b"]'], ['str', 0, '["--fix","src"]'], ['nodever', 0, process.version], ['bad', 3, null]];
for (const [name, code, out] of cases) {
  const r = spawnSync(process.execPath, [path.join(folder, 'bin', 'taskrun.js'), name], { cwd: tmp, encoding: 'utf8' });
  const good = r.status === code && (out === null || r.stdout.includes(out));
  console.log(`task ${name}: ${good ? 'OK' : 'WRONG'} exit=${r.status} out=${JSON.stringify(r.stdout.trim())} err=${JSON.stringify(r.stderr.trim().slice(0, 300))}`);
  ok &&= good;
}
const real = Object.keys(await import(pathToFileURL(path.join(folder, 'node_modules', 'execa', 'index.js')).href));
const used = new Set();
for (const dir of ['src', 'bin', 'test']) for (const f of fs.readdirSync(path.join(folder, dir))) {
  const s = fs.readFileSync(path.join(folder, dir, f), 'utf8');
  for (const mm of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]execa['"]/g)) mm[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((x) => used.add(x));
}
const missing = [...used].filter((x) => !real.includes(x));
console.log('execa names imported:', [...used].join(', '), '| missing in 10.2.1:', missing.join(', ') || 'none');
ok &&= missing.length === 0;
console.log(ok ? 'FEATURE WORKS' : 'FEATURE BROKEN');
