#!/usr/bin/env node
import { loadTasks, TaskError } from '../src/tasks.js';
import { runTask } from '../src/run.js';

const [name] = process.argv.slice(2);

try {
  const tasks = loadTasks();
  if (!name || name === '--list') {
    for (const key of Object.keys(tasks)) console.log(key);
    process.exit(0);
  }
  const task = tasks[name];
  if (!task) {
    console.error(`taskrun: no task "${name}". Tasks: ${Object.keys(tasks).join(', ')}`);
    process.exit(1);
  }
  process.exitCode = await runTask(task);
} catch (err) {
  if (err instanceof TaskError) {
    console.error(`taskrun: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
