'use strict';

const test = require('node:test');
const fc = require('fast-check');
const { slugify } = require('../src/slug');

const SLUG = /^([a-z0-9]+(-[a-z0-9]+)*)?$/;

test('every slug is lowercase words joined by single dashes', () => {
  fc.assert(fc.property(fc.string(), (title) => SLUG.test(slugify(title))));
});

test('slugify is idempotent', () => {
  fc.assert(fc.property(fc.string(), (title) => slugify(slugify(title)) === slugify(title)));
});

test('slugs never exceed maxLength', () => {
  fc.assert(
    fc.property(fc.string(), fc.integer({ min: 1, max: 40 }), (title, maxLength) =>
      slugify(title, { maxLength }).length <= maxLength,
    ),
  );
});
