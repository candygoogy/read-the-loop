# spend

Adds up a bank statement export (CSV) per category.

```
node bin/summary.js statements/february.csv
```

The export needs the columns `Date`, `Description`, `Category` and `Amount`. Rows without a category are counted
as `Other`.

Tests: `npm test` (or `node --test`).
