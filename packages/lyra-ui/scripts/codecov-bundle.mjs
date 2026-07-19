// Uploads a Codecov bundle-analysis report for the *published library*, complementing the
// `lyra-ui-docs` bundle that .storybook/main.js reports for the docs site.
//
// Why this exists rather than a bundler plugin: `pnpm build` is plain `tsc`, so dist/ is ~800
// unbundled ES modules with no bundler in the loop at all. Codecov's vite/rollup/webpack plugins
// have nothing to hook into here. scripts/check-bundle-size.mjs already esbuild-bundles the six
// representative entry points a consumer would actually import (optional peers externalized), so
// `--emit` writes those exact bundles to disk and this script points the standalone analyzer at
// them. The numbers therefore match the gzip budgets in scripts/bundle-budgets.json by
// construction -- same esbuild invocation, same externals -- with Codecov adding the per-PR delta
// reporting that a pass/fail budget check can't give you.
//
// Without CODECOV_TOKEN this is a no-op, so contributors and forked-PR builds are unaffected.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAndUploadReport } from '@codecov/bundle-analyzer';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const buildDir = join(packageDir, '.codecov-bundle');

const uploadToken = process.env.CODECOV_TOKEN;
if (!uploadToken) {
  console.log('codecov-bundle: CODECOV_TOKEN not set -- skipping bundle-analysis upload');
  process.exit(0);
}

if (!existsSync(buildDir)) {
  console.error(
    'codecov-bundle: .codecov-bundle not found -- run `node scripts/check-bundle-size.mjs --emit=.codecov-bundle` first',
  );
  process.exit(1);
}

try {
  await createAndUploadReport(
    [buildDir],
    {
      uploadToken,
      bundleName: 'lyra-ui-dist',
      enableBundleAnalysis: true,
      retryCount: 3,
      dryRun: process.argv.includes('--dry-run'),
    },
    {
      // The emitted bundles are minified esm with no sourcemaps; nothing to filter beyond the
      // usual map guard, kept so a future `sourcemap: true` in check-bundle-size doesn't silently
      // start counting .map weight as shipped bytes.
      ignorePatterns: ['*.map'],
    },
  );
  console.log('codecov-bundle: report uploaded for bundle `lyra-ui-dist`');
} catch (error) {
  // Non-fatal by design, matching `fail_ci_if_error: false` on the coverage uploads in ci.yml: a
  // Codecov outage should not turn a healthy build red. The budget check in check-bundle-size.mjs
  // is the blocking gate on bundle weight, and it has already run by this point.
  console.error(`codecov-bundle: upload failed (non-fatal): ${error?.message ?? error}`);
}
