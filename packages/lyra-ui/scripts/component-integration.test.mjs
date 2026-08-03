import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildComponentIntegration,
  renderIntegrationCards,
  validateComponentIntegration,
} from './component-integration.mjs';

const inventory = {
  components: [
    {
      tag: 'lr-a',
      family: 'utility',
      classModule: 'src/components/utility/a/a.class.ts',
      registrationModule: 'src/components/utility/a/a.ts',
      optionalPeers: [],
    },
    {
      tag: 'lr-b',
      family: 'data',
      classModule: 'src/components/data/b/b.class.ts',
      registrationModule: 'src/components/data/b/b.ts',
      optionalPeers: ['example-peer'],
    },
  ],
};

const graph = {
  findings: [],
  graph: [
    {
      tag: 'lr-a',
      classModule: inventory.components[0].classModule,
      registrationModule: inventory.components[0].registrationModule,
      directComponents: ['lr-b'],
      transitiveComponents: [],
    },
    {
      tag: 'lr-b',
      classModule: inventory.components[1].classModule,
      registrationModule: inventory.components[1].registrationModule,
      directComponents: [],
      transitiveComponents: [],
    },
  ],
};

test('builds one deterministic card per public tag with honest missing gzip evidence', async () => {
  const ledger = await buildComponentIntegration({
    packageDir: '/not-used',
    inventory,
    packageJson: {},
    graph,
  });
  assert.equal(ledger.summary.componentCount, 2);
  assert.equal(ledger.summary.missingGzipCount, 2);
  assert.deepEqual(ledger.components[0], {
    tag: 'lr-a',
    family: 'utility',
    imports: {
      registration: '@aceshooting/lyra-ui/components/utility/a/a.js',
      class: '@aceshooting/lyra-ui/components/utility/a/a.class.js',
    },
    peers: [],
    dependencies: { direct: ['lr-b'], transitive: [] },
    gzip: {
      status: 'not-measured',
      bytes: null,
      kib: null,
      bundleSha256: null,
      limitation: 'Per-tag gzip data has not been generated from built dist output.',
    },
  });
  assert.deepEqual(validateComponentIntegration(ledger, inventory, graph), []);
});

test('preserves prior measured gzip data during source-only freshness checks', async () => {
  const previous = {
    components: [{
      tag: 'lr-a',
      gzip: {
        status: 'measured',
        bytes: 1024,
        kib: 1,
        bundleSha256: 'a'.repeat(64),
        limitation: 'fixture',
      },
    }],
  };
  const ledger = await buildComponentIntegration({
    packageDir: '/not-used',
    inventory,
    packageJson: {},
    graph,
    previous,
  });
  assert.equal(ledger.components[0].gzip.status, 'measured');
  assert.equal(ledger.components[0].gzip.bytes, 1024);
  assert.equal(ledger.components[1].gzip.status, 'not-measured');
});

test('validation catches stale imports, peers, dependency edges, and invalid gzip claims', async () => {
  const ledger = await buildComponentIntegration({
    packageDir: '/not-used',
    inventory,
    packageJson: {},
    graph,
  });
  const stale = structuredClone(ledger);
  stale.components[0].imports.registration = 'wrong';
  stale.components[0].dependencies.direct = [];
  stale.components[0].gzip = { status: 'measured', bytes: 0, bundleSha256: null };
  stale.components[1].peers = [];
  const findings = validateComponentIntegration(stale, inventory, graph);
  assert.ok(findings.some((finding) => finding.includes('stale registration import')));
  assert.ok(findings.some((finding) => finding.includes('stale direct dependencies')));
  assert.ok(findings.some((finding) => finding.includes('invalid measured gzip evidence')));
  assert.ok(findings.some((finding) => finding.includes('stale peer list')));
});

test('validation checks gzip digest/rounding, missing-state nulls, and summary arithmetic', async () => {
  const ledger = await buildComponentIntegration({
    packageDir: '/not-used',
    inventory,
    packageJson: {},
    graph,
  });
  const invalid = structuredClone(ledger);
  invalid.components[0].gzip = {
    status: 'measured',
    bytes: 1025,
    kib: 99,
    bundleSha256: 'not-a-sha',
    limitation: 'fixture',
  };
  invalid.components[1].gzip.bytes = 1;
  invalid.summary.measuredGzipCount = 2;
  invalid.summary.missingGzipCount = 0;
  invalid.summary.averageGzipKib = 99;
  const findings = validateComponentIntegration(invalid, inventory, graph);
  assert.ok(findings.some((finding) => finding.includes('invalid measured gzip evidence')));
  assert.ok(findings.some((finding) => finding.includes('not-measured gzip evidence must use null')));
  assert.ok(findings.some((finding) => finding.includes('stale integration summary')));
});

test('renders explicit none and not-measured states instead of ambiguous blanks', async () => {
  const ledger = await buildComponentIntegration({
    packageDir: '/not-used',
    inventory,
    packageJson: {},
    graph,
  });
  const markdown = renderIntegrationCards(ledger);
  assert.match(markdown, /id="lr-a"/);
  assert.match(markdown, /Optional peers: none/);
  assert.match(markdown, /Direct Lyra dependencies: `lr-b`/);
  assert.match(markdown, /Standalone gzip: not measured/);
});
