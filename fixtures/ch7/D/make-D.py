"""Builds fixture D (a small notes web app in git, with build clutter and uncommitted work) at argv[1].

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
    "test": "node --test"
  }
}
"""
GITIGNORE = """dist/
.cache/
coverage/
logs/
*.log
"""
README = """# notes-app

A small notes app that runs in the browser and keeps notes in localStorage.

```
npm run build   # writes dist/
npm test
```

Open `dist/index.html` after a build.
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

# Ignored, regenerable clutter.
for i in range(12):
    blob(f"dist/app.{random.Random(i).randbytes(3).hex()}.js", 380_000 + i * 7_000, 100 + i, kind="js")
w("dist/index.html", INDEX.replace("{{bundle}}", "app.%s.js" % random.Random(11).randbytes(3).hex()))
for i in range(40):
    blob(f".cache/{random.Random(1000 + i).randbytes(20).hex()}", 260_000, 1000 + i)
blob("coverage/lcov.info", 220_000, 7, kind="js")
blob("coverage/lcov-report/index.html", 90_000, 8, kind="js")
blob("logs/build.log", 1_400_000, 9, kind="js")
blob("npm-debug.log", 600_000, 10, kind="js")

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
