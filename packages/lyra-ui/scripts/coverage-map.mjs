import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import libCoverage from 'istanbul-lib-coverage';

const require = createRequire(import.meta.url);
const runnerRequire = createRequire(require.resolve('@web/test-runner-playwright'));
// Keep every aggregation boundary on the pinned runner's function-aware merger.
// Its internal entry is also exercised directly by coverage-realms.test.mjs.
const { getTestCoverage } = runnerRequire(join(
  dirname(runnerRequire.resolve('@web/test-runner-core')), 'coverage/getTestCoverage.js',
));

/** Merge native report fragments without borrowing hits across function boundaries. */
export function mergeCoverageMaps(reports) {
  const files = new Map();
  for (const report of reports) {
    for (const [path, coverage] of Object.entries(report)) {
      let sessions = files.get(path);
      if (!sessions) files.set(path, sessions = []);
      sessions.push({ testCoverage: { [path]: coverage } });
    }
  }
  const merged = libCoverage.createCoverageMap({});
  // The runner clones its inputs. Limit that working copy to one source file,
  // rather than serializing all shards into one potentially enormous string.
  for (const [path, sessions] of files) {
    const { coverageMap } = getTestCoverage(sessions, {});
    merged.addFileCoverage(coverageMap.fileCoverageFor(path));
    files.delete(path);
  }
  return merged;
}
