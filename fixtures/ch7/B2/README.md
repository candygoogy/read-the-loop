# taskrun

Runs the project's tasks, listed in `tasks.json`:

```json
{
  "build": { "script": "scripts/build.js", "args": ["--minify"] }
}
```

```
node bin/taskrun.js build     # runs: node scripts/build.js --minify
node bin/taskrun.js --list
```

Uses [execa](https://github.com/sindresorhus/execa) to run the tasks. Tests: `node --test`.
