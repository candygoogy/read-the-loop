# slugkit

Turns a title into a URL slug.

```js
const { slugify } = require('slugkit');

slugify('Hello, World!');            // 'hello-world'
slugify('Crème brûlée recipes');     // 'creme-brulee-recipes'
slugify('A very long title', { maxLength: 10 }); // 'a-very'
```

Options:
- `maxLength` (default 80): the slug is cut at a word boundary so it's no longer than this.
- `separator` (default `-`).

## Development

```
npm install
npm test        # or: node --test
```

The property tests in `test/slug.property.test.js` use [fast-check](https://github.com/dubzzz/fast-check).
