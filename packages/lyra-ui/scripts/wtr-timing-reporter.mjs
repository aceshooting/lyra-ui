import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

/** Appends `{ file, deltaMs }` per completed test file: its own wall time when the run uses one page. */
export function timingReporter(outputPath, { cwd = process.cwd() } = {}) {
  const file = resolve(cwd, outputPath);
  mkdirSync(dirname(file), { recursive: true });
  let previous = Date.now();
  let manager;
  let activeRun;
  const completions = new Map();
  const observeCompletions = () => {
    const now = Date.now();
    for (const session of manager.all()) {
      if (session.status !== 'FINISHED' || session.testRun !== activeRun) continue;
      if (!completions.has(session.id)) completions.set(session.id, now);
    }
  };
  return {
    start({ sessions }) {
      manager?.off('session-updated', observeCompletions);
      manager = sessions;
      // This event precedes status listeners that synchronously aggregate whole-run coverage.
      manager.on('session-updated', observeCompletions);
    },
    onTestRunStarted({ testRun } = {}) {
      activeRun = testRun;
      completions.clear();
      previous = Date.now();
    },
    reportTestFileResults({ testFile, sessionsForTestFile }) {
      const captured = sessionsForTestFile?.map(session => completions.get(session.id));
      const now = captured?.length && captured.every(value => value !== undefined)
        ? Math.max(...captured)
        : Date.now();
      appendFileSync(file, `${JSON.stringify({ file: relative(cwd, testFile).split('\\').join('/'), deltaMs: now - previous })}\n`);
      previous = now;
    },
    stop() {
      manager?.off('session-updated', observeCompletions);
      manager = undefined;
      completions.clear();
    },
  };
}
