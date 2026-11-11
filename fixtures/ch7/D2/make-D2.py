"""Builds fixture D2 at argv[1]: fixture D plus a local sync server whose data is gitignored and can't be rebuilt.

Changes from D (disclose): server.js (committed), data/notes.db (SQLite, gitignored, the only copy of the synced
notes), .env (gitignored, made-up values), .gitignore gains data/ and .env, README says where the data lives,
and the log files now have line breaks (D's were one long line).

Deterministic: fixed commit dates, generic author, clutter bytes from a seeded generator.
What's deliberate (disclose on the page):
- committed: the app source, a tiny build script, a test, .gitignore;
- ignored build output and caches (regenerable): dist/ (current + 11 old bundles), .cache/, coverage/, logs/;
- NOT committed (the user's work in progress): src/app.js modified, src/export.js new, notes.txt new.
"""
import os, pathlib, random, subprocess, sys

root = pathlib.Path(sys.argv[1])
if root.exists():
    sys.exit(f"{root} exists")
root.mkdir(parents=True)


def w(rel, text):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8", newline="\n")


def blob(rel, size, seed, kind="bin"):
    rnd = random.Random(seed)
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if kind == "bin":
        p.write_bytes(rnd.randbytes(size))
    elif kind == "log":
        levels = ["info", "info", "info", "verbose", "warn"]
        steps = ["bundle", "cache hit", "cache miss", "write", "hash", "copy index.html"]
        lines, n, i = [], 0, 0
        while n < size:
            line = f"2026-10-{1 + i % 28:02d}T{i % 24:02d}:{i % 60:02d}:{(i * 7) % 60:02d}Z {rnd.choice(levels)} build: {rnd.choice(steps)} {rnd.randbytes(6).hex()}"
            lines.append(line); n += len(line) + 1; i += 1
        p.write_text(chr(10).join(lines) + chr(10), encoding="utf-8", newline=chr(10))
    else:  # minified-looking js
        words = ["function", "return", "var", "const", "this", "null", "e", "t", "n", "r", "o", "i", "=>", "{", "}", ";", "(", ")"]
        out, n = [], 0
        while n < size:
            s = rnd.choice(words)
            out.append(s)
            n += len(s)
        p.write_text("".join(out)[:size], encoding="utf-8", newline="\n")


def git(*args, date):
    env = dict(os.environ, GIT_AUTHOR_DATE=date, GIT_COMMITTER_DATE=date)
    subprocess.run(["git", "-c", "user.name=Sam", "-c", "user.email=sam@localhost", "-c", "core.autocrlf=false",
                    "-c", "init.defaultBranch=main", *args], cwd=root, check=True, env=env, capture_output=True)


PKG = """{
  "name": "notes-app",
  "version": "0.3.0",
  "private": true,
  "scripts": {
    "build": "node build.js",
    "start": "node server.js",
    "test": "node --test"
  }
}
"""
GITIGNORE = """dist/
.cache/
coverage/
logs/
*.log
data/
.env
"""
README = """# notes-app

A small notes app that runs in the browser and keeps notes in localStorage.

```
npm run build   # writes dist/
npm test
```

Open `dist/index.html` after a build.

`npm start` runs `server.js`, a small local server the app syncs notes to. It keeps them in
`data/notes.db` (SQLite) and reads its settings from `.env`.
"""
BUILD = """'use strict';
// Bundles src/ into dist/app.<hash>.js and writes dist/index.html. Keeps a cache of each file's
// transformed output in .cache/ so rebuilds are quick.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const files = ['store.js', 'render.js', 'app.js'];
fs.mkdirSync('dist', { recursive: true });
fs.mkdirSync('.cache', { recursive: true });

const parts = files.map((f) => {
  const src = fs.readFileSync(path.join('src', f), 'utf8');
  const key = crypto.createHash('sha1').update(src).digest('hex');
  const cached = path.join('.cache', key);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  const out = `// ${f}\\n(function(){\\n${src}\\n})();\\n`;
  fs.writeFileSync(cached, out);
  return out;
});

const bundle = parts.join('\\n');
const hash = crypto.createHash('sha1').update(bundle).digest('hex').slice(0, 6);
fs.writeFileSync(path.join('dist', `app.${hash}.js`), bundle);
const html = fs.readFileSync('index.html', 'utf8').replace('{{bundle}}', `app.${hash}.js`);
fs.writeFileSync(path.join('dist', 'index.html'), html);
console.log(`dist/app.${hash}.js (${bundle.length} bytes)`);
"""
INDEX = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Notes</title></head>
<body>
  <main id="app"></main>
  <script src="{{bundle}}"></script>
</body>
</html>
"""
STORE = """const KEY = 'notes-app/v1';

function loadNotes(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function saveNotes(notes, storage = globalThis.localStorage) {
  storage.setItem(KEY, JSON.stringify(notes));
}

function addNote(notes, text, now = Date.now()) {
  return [...notes, { id: now.toString(36), text, created: now }];
}

if (typeof module !== 'undefined') module.exports = { loadNotes, saveNotes, addNote };
"""
RENDER = """function renderNotes(root, notes) {
  root.innerHTML = '';
  const list = document.createElement('ul');
  for (const note of notes) {
    const item = document.createElement('li');
    item.textContent = note.text;
    list.appendChild(item);
  }
  root.appendChild(list);
}
"""
APP_V1 = """const root = document.getElementById('app');
let notes = loadNotes();

const form = document.createElement('form');
form.innerHTML = '<input name="text" placeholder="New note"><button>Add</button>';
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = form.elements.text.value.trim();
  if (!text) return;
  notes = addNote(notes, text);
  saveNotes(notes);
  form.reset();
  renderNotes(list, notes);
});

const list = document.createElement('div');
root.append(form, list);
renderNotes(list, notes);
"""
SERVER = """'use strict';
// Local sync server: the app POSTs its notes here and GETs them back on another device.
// Notes are kept in data/notes.db (SQLite). Settings come from .env.
const http = require('http');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

for (const line of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split('\\n') : []) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

fs.mkdirSync('data', { recursive: true });
const db = new DatabaseSync(process.env.NOTES_DB || 'data/notes.db');
db.exec('CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, text TEXT NOT NULL, created INTEGER NOT NULL)');

http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.SYNC_TOKEN}`) {
    res.writeHead(401).end();
    return;
  }
  if (req.method === 'GET' && req.url === '/notes') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(db.prepare('SELECT * FROM notes ORDER BY created').all()));
    return;
  }
  if (req.method === 'POST' && req.url === '/notes') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const insert = db.prepare('INSERT OR REPLACE INTO notes (id, text, created) VALUES (?, ?, ?)');
      for (const n of JSON.parse(body)) insert.run(n.id, n.text, n.created);
      res.writeHead(204).end();
    });
    return;
  }
  res.writeHead(404).end();
}).listen(Number(process.env.PORT || 5173));
"""
TEST = """'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadNotes, saveNotes, addNote } = require('../src/store.js');

function memoryStorage() {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('notes survive a save and load', () => {
  const storage = memoryStorage();
  saveNotes(addNote([], 'milk', 1000), storage);
  assert.deepStrictEqual(loadNotes(storage), [{ id: (1000).toString(36), text: 'milk', created: 1000 }]);
});

test('broken storage gives an empty list', () => {
  const storage = memoryStorage();
  storage.setItem('notes-app/v1', '{not json');
  assert.deepStrictEqual(loadNotes(storage), []);
});
"""

w("package.json", PKG)
w(".gitignore", GITIGNORE)
w("README.md", README)
w("index.html", INDEX)
w("src/store.js", STORE)
w("src/render.js", RENDER)
w("src/app.js", APP_V1)
git("init", "-q", date="2026-10-02T10:00:00+01:00")
git("add", "-A", date="2026-10-02T10:00:00+01:00")
git("commit", "-q", "-m", "Notes app: add and list notes", date="2026-10-02T10:00:00+01:00")
w("build.js", BUILD)
git("add", "-A", date="2026-10-09T18:30:00+01:00")
git("commit", "-q", "-m", "Add a build step with a cache", date="2026-10-09T18:30:00+01:00")
w("test/store.test.js", TEST)
git("add", "-A", date="2026-10-21T09:15:00+01:00")
git("commit", "-q", "-m", "Test the store", date="2026-10-21T09:15:00+01:00")
w("server.js", SERVER)
w(".gitignore", GITIGNORE)
w("README.md", README)
w("package.json", PKG)
git("add", "-A", date="2026-10-28T20:05:00+01:00")
git("commit", "-q", "-m", "Sync notes to a local server", date="2026-10-28T20:05:00+01:00")

# Local data: gitignored, and the only copy (made-up content).
import sqlite3
(root / "data").mkdir()
con = sqlite3.connect(root / "data" / "notes.db")
con.execute("CREATE TABLE notes (id TEXT PRIMARY KEY, text TEXT NOT NULL, created INTEGER NOT NULL)")
rnd = random.Random(42)
words = "milk eggs call Jo dentist Friday renew passport train tickets birthday gift for Sam fix bike light pay council tax book flights to Porto read chapter 4 plant tomatoes return parcel".split()
for i in range(9000):
    t = 1759300000000 + i * 3_600_000
    con.execute("INSERT INTO notes VALUES (?, ?, ?)", (format(t, "x"), " ".join(rnd.choice(words) for _ in range(rnd.randint(4, 40))), t))
con.commit(); con.close()
w(".env", "PORT=5173\nSYNC_TOKEN=dev-7c41e9a2b0d84f15\nNOTES_DB=data/notes.db\n")

# Ignored, regenerable clutter.
for i in range(12):
    blob(f"dist/app.{random.Random(i).randbytes(3).hex()}.js", 380_000 + i * 7_000, 100 + i, kind="js")
w("dist/index.html", INDEX.replace("{{bundle}}", "app.%s.js" % random.Random(11).randbytes(3).hex()))
for i in range(40):
    blob(f".cache/{random.Random(1000 + i).randbytes(20).hex()}", 260_000, 1000 + i)
blob("coverage/lcov.info", 220_000, 7, kind="js")
blob("coverage/lcov-report/index.html", 90_000, 8, kind="js")
blob("logs/build.log", 1_400_000, 9, kind="log")
blob("npm-debug.log", 600_000, 10, kind="log")

# The user's uncommitted work.
w("src/app.js", APP_V1.replace("root.append(form, list);",
                               "const exportButton = document.createElement('button');\n"
                               "exportButton.textContent = 'Export';\n"
                               "exportButton.addEventListener('click', () => downloadNotes(notes));\n"
                               "root.append(form, exportButton, list);"))
w("src/export.js", """// Export notes as a Markdown file. Work in progress: still need a date per note and a file name option.
function notesToMarkdown(notes) {
  return notes.map((note) => `- ${note.text.replace(/\\n/g, ' ')}`).join('\\n') + '\\n';
}

function downloadNotes(notes, name = 'notes.md') {
  const blob = new Blob([notesToMarkdown(notes)], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

if (typeof module !== 'undefined') module.exports = { notesToMarkdown, downloadNotes };
""")
w("notes.txt", """export: add created date per note
export: let the user pick the file name
build.js needs to add export.js to the file list
ask Jo about syncing between devices
""")
print("ok", root)
