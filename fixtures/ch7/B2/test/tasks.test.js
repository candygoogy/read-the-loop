import test from 'node:test';
import assert from 'node:assert';
import { validateTask, commandFor, TaskError } from '../src/tasks.js';
import { runTask } from '../src/run.js';

test('a task needs a script', () => {
  assert.throws(() => validateTask('x', {}), TaskError);
  assert.throws(() => validateTask('x', { script: 'a.js', args: [1] }), TaskError);
  validateTask('x', { script: 'a.js', args: ['--fast'] });
});

test('a task runs its script with node', () => {
  assert.deepStrictEqual(commandFor({ script: 'scripts/build.js', args: ['--minify'] }), {
    file: process.execPath,
    args: ['scripts/build.js', '--minify'],
  });
});

test('runTask resolves to the exit code', async () => {
  assert.strictEqual(await runTask({ script: 'scripts/hello.js' }, { stdio: 'ignore' }), 0);
});
