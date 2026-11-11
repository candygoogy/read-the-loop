import { execa } from 'execa';
import { commandFor } from './tasks.js';

// Runs one task with its output going straight to the terminal. Resolves to the task's exit code.
export async function runTask(task, { cwd = process.cwd(), stdio = 'inherit' } = {}) {
  const { file, args } = commandFor(task);
  const result = await execa(file, args, { cwd, stdio, reject: false });
  if (result.failed && result.exitCode === undefined) {
    throw new Error(`could not start the task: ${result.shortMessage}`);
  }
  return result.exitCode;
}
