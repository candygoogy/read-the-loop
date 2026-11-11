'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { slugify } = require('../src/slug');

test('lowercases and joins words with dashes', () => {
  assert.strictEqual(slugify('Hello World'), 'hello-world');
});

test('drops punctuation at both ends', () => {
  assert.strictEqual(slugify('  Hello, World!  '), 'hello-world');
});

test('removes accents', () => {
  assert.strictEqual(slugify('Crème brûlée recipes'), 'creme-brulee-recipes');
});

test('cuts long slugs at a word boundary', () => {
  assert.strictEqual(slugify('A very long title', { maxLength: 10 }), 'a-very');
});

test('custom separator', () => {
  assert.strictEqual(slugify('Hello World', { separator: '_' }), 'hello_world');
});
