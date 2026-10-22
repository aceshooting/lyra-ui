import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const firstLine = (text) => String(text ?? '').split('\n', 1)[0].trim();

/** Yields every test of a Web Test Runner result tree with its ` > `-joined suite path. */
function* walkTests(results, path = []) {
  for (const test of results?.tests ?? []) yield { name: [...path, test.name].join(' > '), test };
  for (const suite of results?.suites ?? []) {
    yield* walkTests(suite, suite.name ? [...path, suite.name] : path);
  }
}

/**
 * Appends one JSON line per failed test, per file-level error and per completed file, so the flake
 * hunt (scripts/flake-hunt.mjs) can count first-attempt failures across repeated runs. Enabled by
 * `WTR_FAILURE_REPORT=<file>`; with `WTR_RETRIES=0` a test that only passes on its retry still
 * shows up here.
 */
export function failureReporter(outputPath, { cwd = process.cwd() } = {}) {
  const file = resolve(cwd, outputPath);
  mkdirSync(dirname(file), { recursive: true });
  return {
    reportTestFileResults({ sessionsForTestFile, testFile }) {
      const name = relative(cwd, testFile).split('\\').join('/');
      const lines = [];
      let tests = 0;
      let failed = 0;
      for (const session of sessionsForTestFile) {
        for (const { name: test, test: result } of walkTests(session.testResults)) {
          if (result.skipped) continue;
          tests += 1;
          if (result.passed) continue;
          failed += 1;
          lines.push({ type: 'failure', file: name, test, message: firstLine(result.error?.message) });
        }
        for (const error of session.errors ?? []) {
          lines.push({ type: 'error', file: name, message: firstLine(error.message) });
        }
      }
      lines.push({ type: 'file', file: name, tests, failed });
      appendFileSync(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
    },
  };
}
