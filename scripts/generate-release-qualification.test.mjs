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

  const qualityToolsSource = `
name: Quality tools
on:
  workflow_dispatch:
  schedule:
    - cron: '23 2 * * *'
jobs:
  # release-qualification: required
  flake-hunt:
    name: flake hunt (Chromium)
    if: github.event_name == 'workflow_dispatch' || github.event.schedule == '23 2 * * *'
  # release-qualification: required
  mutation:
    name: mutation testing (lyra-map)
  # release-qualification: required
  silent-name:
    runs-on: ubuntu-latest
  `;

  const qualification = deriveReleaseQualification({
    ciSource,
    fullEngineSource,
    qualityToolsSource,
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
      qualityTools: {
        name: 'Quality tools',
        path: '.github/workflows/quality-tools.yml',
        event: 'workflow_dispatch',
        headBranch: 'main',
        // A job without a `name:` is reported under its id, like the other workflows.
        requiredJobs: ['flake hunt (Chromium)', 'mutation testing (lyra-map)', 'silent-name'],
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
  // The manifest is read by humans and diffed in review: keep its workflows alphabetical.
  assert.deepEqual(Object.keys(qualification.workflows), ['ci', 'fullEngine', 'qualityTools', 'testAllBrowsers']);
});

const markedQualityTools = `name: Quality tools\njobs:\n  # release-qualification: required\n  flake-hunt:\n    runs-on: ubuntu-latest`;

test('fails closed on an unmarked workflow or unresolved matrix interpolation', () => {
  assert.throws(
    () =>
      deriveReleaseQualification({
        ciSource: 'name: CI\njobs:\n  lint:\n    runs-on: ubuntu-latest',
        fullEngineSource: 'name: Full\njobs: {}',
        qualityToolsSource: markedQualityTools,
        testAllBrowsersSource: `name: Browsers\non:\n  workflow_dispatch:\n    inputs:\n      browsers:\n        default: chromium\njobs:\n  # release-qualification: required\n  test:\n    runs-on: ubuntu-latest`,
      }),
    /no release-qualification jobs/
  );
  assert.throws(
    () =>
      deriveReleaseQualification({
        ciSource: `name: CI\njobs:\n  # release-qualification: matrix\n  platform:\n    name: \${{ matrix.missing }}\n    strategy:\n      matrix:\n        browser: [firefox]`,
        fullEngineSource: `name: Full\njobs:\n  # release-qualification: required\n  full:\n    runs-on: ubuntu-latest`,
        qualityToolsSource: markedQualityTools,
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
        qualityToolsSource: markedQualityTools,
        testAllBrowsersSource,
      }),
    /browsers.*default/iu
  );
});

test('fails closed when the quality-tools workflow marks no job, so it cannot qualify nothing', () => {
  const marked = `name: Marked\njobs:\n  # release-qualification: required\n  job:\n    runs-on: ubuntu-latest`;
  const browsers = `name: Browsers\non:\n  workflow_dispatch:\n    inputs:\n      browsers:\n        default: chromium\njobs:\n  # release-qualification: required\n  test:\n    runs-on: ubuntu-latest`;
  assert.throws(
    () =>
      deriveReleaseQualification({
        ciSource: marked,
        fullEngineSource: marked,
        qualityToolsSource: 'name: Quality tools\njobs:\n  flake-hunt:\n    runs-on: ubuntu-latest',
        testAllBrowsersSource: browsers,
      }),
    /no release-qualification jobs/
  );
  // A marker that is not directly above a job header is a mistake, not a pass.
  assert.throws(
    () =>
      deriveReleaseQualification({
        ciSource: marked,
        fullEngineSource: marked,
        qualityToolsSource: 'name: Quality tools\njobs:\n  # release-qualification: required\n  # a stray comment\n  flake-hunt:\n    runs-on: ubuntu-latest',
        testAllBrowsersSource: browsers,
      }),
    /not directly above a job/
  );
});
