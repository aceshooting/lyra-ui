import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { projectQualityMetadata, qualityArtifactFindings } from './generate-component-quality.mjs';
import { retainedComponentQualityMetadata } from './generate-component-inventory.mjs';

const inventory = {
  schemaVersion: 1,
  components: [
    { tag: 'lr-a', maturity: { status: 'stable' }, surface: { form: { associated: true } } },
    { tag: 'lr-b', maturity: { status: 'experimental' }, surface: { form: { associated: false } } },
  ],
};

const qualification = {
  components: [
    {
      tag: 'lr-a',
      qualification: { status: 'incomplete', humanReview: 'pending' },
      dimensions: { accessibility: { status: 'automated' } },
    },
    {
      tag: 'lr-b',
      qualification: { status: 'pending-human-review', humanReview: 'pending' },
      dimensions: { accessibility: { status: 'reviewed-exemption' } },
    },
  ],
};

const integration = {
  components: [
    { tag: 'lr-a', dependencies: { direct: ['lr-b'], transitive: [] } },
    { tag: 'lr-b', dependencies: { direct: [], transitive: [] } },
  ],
};

test('projects compact qualification and dependency metadata without changing maturity or FACE truth', () => {
  const projected = projectQualityMetadata(inventory, qualification, integration);
  assert.equal(projected.components[0].maturity.status, 'stable');
  assert.equal(projected.components[1].maturity.status, 'experimental');
  assert.equal(projected.components[0].surface.form.associated, true);
  assert.deepEqual(projected.components[0].qualification, {
    status: 'incomplete',
    humanReview: 'pending',
    reviewer: null,
    reviewedAt: null,
    accessibility: 'automated',
    ledger: 'scripts/fixtures/component-qualification.json',
  });
  assert.deepEqual(projected.components[0].dependencies, {
    direct: ['lr-b'],
    transitive: [],
    ledger: 'scripts/fixtures/component-integration.json',
  });
});

test('new inventory entries fail visibly as pending instead of inheriting another tag’s evidence', () => {
  const projected = projectQualityMetadata(
    { schemaVersion: 1, components: [...inventory.components, { tag: 'lr-new', maturity: { status: 'experimental' } }] },
    qualification,
    integration,
  );
  assert.deepEqual(projected.components[2].qualification, {
    status: 'pending-generation',
    humanReview: 'pending',
    reviewer: null,
    reviewedAt: null,
    accessibility: 'not-recorded',
    ledger: 'scripts/fixtures/component-qualification.json',
  });
  assert.deepEqual(projected.components[2].dependencies.direct, []);
});

test('component inventory regeneration retains quality metadata and defaults new tags to pending', () => {
  const retained = retainedComponentQualityMetadata({
    qualification: inventory.components[0].qualification ?? qualification.components[0].qualification,
    dependencies: integration.components[0].dependencies,
  });
  assert.equal(retained.qualification.status, 'incomplete');
  assert.deepEqual(retained.dependencies.direct, ['lr-b']);
  const pending = retainedComponentQualityMetadata(null);
  assert.equal(pending.qualification.status, 'pending-generation');
  assert.equal(pending.qualification.humanReview, 'pending');
  assert.deepEqual(pending.dependencies.direct, []);
});

test('artifact freshness compares every generated ledger, dashboard, and projected inventory', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-quality-artifacts-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const paths = Object.fromEntries(
    ['inventory', 'qualification', 'integration', 'qualityDocs', 'integrationDocs']
      .map((name) => [name, path.join(directory, `${name}.txt`)]),
  );
  const artifacts = {
    inventory: { schemaVersion: 1 },
    qualification: { schemaVersion: 1 },
    integration: { schemaVersion: 1 },
    qualityDocs: '# quality\n',
    integrationDocs: '# integration\n',
  };
  fs.writeFileSync(paths.inventory, `${JSON.stringify(artifacts.inventory, null, 2)}\n`);
  fs.writeFileSync(paths.qualification, `${JSON.stringify(artifacts.qualification, null, 2)}\n`);
  fs.writeFileSync(paths.integration, `${JSON.stringify(artifacts.integration, null, 2)}\n`);
  fs.writeFileSync(paths.qualityDocs, artifacts.qualityDocs);
  fs.writeFileSync(paths.integrationDocs, artifacts.integrationDocs);
  assert.deepEqual(qualityArtifactFindings(artifacts, paths), []);
  fs.writeFileSync(paths.qualityDocs, '# stale\n');
  assert.equal(qualityArtifactFindings(artifacts, paths).length, 1);
});
