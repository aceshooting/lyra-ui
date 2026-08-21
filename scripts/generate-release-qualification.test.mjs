import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveReleaseQualification } from './generate-release-qualification.mjs';

test('derives required job names and expands workflow-owned matrices', () => {
  const ciSource = `
name: CI
jobs:
  # release-qualification: required
  lint:
    runs-on: ubuntu-latest
  # release-qualification: required
  aggregate:
    name: stable-check
    runs-on: ubuntu-latest
  # release-qualification: matrix
  platform:
    name: \${{ matrix.browser }} / Node \${{ matrix.node-version }} / shard \${{ matrix.shard_index }}/\${{ matrix.shard_total }}
    strategy:
      matrix:
        include:
          - browser: firefox
            node-version: 20
            shard_index: 1
            shard_total: 1
          - browser: chromium
            node-version: 22
            shard_index: 1
            shard_total: 2
          - browser: chromium
            node-version: 22
            shard_index: 2
            shard_total: 2
  `;
  const fullEngineSource = `
name: Full browser-engine suite
jobs:
  # release-qualification: matrix
  full-engine:
    name: \${{ matrix.browser }} / shard \${{ matrix.shard }}/2
    strategy:
      matrix:
        browser: [firefox, webkit]
        shard: [1, 2]
  `;
  const testAllBrowsersSource = `
name: Test All Browsers
on:
  workflow_dispatch:
    inputs:
      browsers:
        default: chromium,firefox,chrome,edge,safari
jobs:
  plan:
    runs-on: ubuntu-latest
  # release-qualification: matrix
  test:
    name: \${{ matrix.browser }}
    strategy:
      matrix:
        browser: \${{ fromJSON(needs.plan.outputs.browsers) }}
  `;

  const qualification = deriveReleaseQualification({
    ciSource,
    fullEngineSource,
    testAllBrowsersSource,
  });
  assert.deepEqual(qualification, {
    schemaVersion: 1,
    workflows: {
      ci: {
        name: 'CI',
        path: '.github/workflows/ci.yml',
        event: 'push',
        headBranch: 'main',
        requiredJobs: [
          'chromium / Node 22 / shard 1/2',
          'chromium / Node 22 / shard 2/2',
          'firefox / Node 20 / shard 1/1',
          'lint',
          'stable-check',
        ],
      },
      fullEngine: {
        name: 'Full browser-engine suite',
        path: '.github/workflows/full-engine.yml',
        event: 'workflow_dispatch',
        headBranch: 'main',
        requiredJobs: [
          'firefox / shard 1/2',
          'firefox / shard 2/2',
          'webkit / shard 1/2',
          'webkit / shard 2/2',
        ],
      },
      testAllBrowsers: {
        name: 'Test All Browsers',
        path: '.github/workflows/test-all-browsers.yml',
        event: 'workflow_dispatch',
        headBranch: 'main',
        requiredJobs: ['chrome', 'chromium', 'edge', 'firefox', 'safari'],
      },
    },
  });
});

test('fails closed on an unmarked workflow or unresolved matrix interpolation', () => {
  assert.throws(
    () =>
      deriveReleaseQualification({
        ciSource: 'name: CI\njobs:\n  lint:\n    runs-on: ubuntu-latest',
        fullEngineSource: 'name: Full\njobs: {}',
        testAllBrowsersSource: `name: Browsers\non:\n  workflow_dispatch:\n    inputs:\n      browsers:\n        default: chromium\njobs:\n  # release-qualification: required\n  test:\n    runs-on: ubuntu-latest`,
      }),
    /no release-qualification jobs/
  );
  assert.throws(
    () =>
      deriveReleaseQualification({
        ciSource: `name: CI\njobs:\n  # release-qualification: matrix\n  platform:\n    name: \${{ matrix.missing }}\n    strategy:\n      matrix:\n        browser: [firefox]`,
        fullEngineSource: `name: Full\njobs:\n  # release-qualification: required\n  full:\n    runs-on: ubuntu-latest`,
        testAllBrowsersSource: `name: Browsers\non:\n  workflow_dispatch:\n    inputs:\n      browsers:\n        default: chromium\njobs:\n  # release-qualification: required\n  test:\n    runs-on: ubuntu-latest`,
      }),
    /unresolved matrix expression/
  );
});

test('fails closed when a dynamic browser matrix is not bound to a finite dispatch default', () => {
  const ciSource = `name: CI\njobs:\n  # release-qualification: required\n  lint:\n    runs-on: ubuntu-latest`;
  const fullEngineSource = `name: Full\njobs:\n  # release-qualification: required\n  full:\n    runs-on: ubuntu-latest`;
  const testAllBrowsersSource = `
name: Browsers
on:
  workflow_dispatch:
    inputs:
      browsers:
        description: Missing finite default
jobs:
  # release-qualification: matrix
  test:
    name: \${{ matrix.browser }}
    strategy:
      matrix:
        browser: \${{ fromJSON(needs.plan.outputs.browsers) }}
  `;

  assert.throws(
    () =>
      deriveReleaseQualification({
        ciSource,
        fullEngineSource,
        testAllBrowsersSource,
      }),
    /browsers.*default/iu
  );
});
