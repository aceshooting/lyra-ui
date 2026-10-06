import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

/** Appends `{ file, deltaMs }` per completed test file: its own wall time when the run uses one page. */
export function timingReporter(outputPath, { cwd = process.cwd() } = {}) {
  const file = resolve(cwd, outputPath);
  mkdirSync(dirname(file), { recursive: true });
  let previous = Date.now();
  return {
    onTestRunStarted() {
      previous = Date.now();
    },
    reportTestFileResults({ testFile }) {
      const now = Date.now();
      appendFileSync(file, `${JSON.stringify({ file: relative(cwd, testFile).split('\\').join('/'), deltaMs: now - previous })}\n`);
      previous = now;
    },
  };
}
