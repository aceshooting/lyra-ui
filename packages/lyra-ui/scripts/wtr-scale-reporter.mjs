import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Console transport survives WTR closing the page before reporter callbacks run. */
export function scaleReporter(outputPath = 'coverage/scale-measurements.jsonl') {
  const file = resolve(outputPath);
  const reset = () => {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '');
  };
  return {
    start: reset,
    onTestRunStarted: reset,
    onTestRunFinished({ sessions }) {
      for (const session of sessions) {
        for (const args of session.logs) {
          if (typeof args[0] !== 'string' || !args[0].startsWith('[lr-scale] ')) continue;
          const row = JSON.parse(args[0].slice('[lr-scale] '.length));
          appendFileSync(file, `${JSON.stringify({ ...row, engine: session.browser.product })}\n`);
        }
      }
      if (sessions.length && sessions.every(session => session.passed && !session.errors.length)) {
        appendFileSync(file, `${JSON.stringify({ complete: true })}\n`);
      }
    },
  };
}
