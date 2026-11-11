# worklog

Log hours per project from the command line. Entries are kept in `worklog.json` in the current folder
(or the file named by `WORKLOG_FILE`).

```
node bin/worklog.js add 2.5 acme "API review"
node bin/worklog.js add 1 internal --day 2026-11-03
node bin/worklog.js list --project acme
node bin/worklog.js total
node bin/worklog.js total --project acme
```

Tests: `npm test` (or `node --test`).
