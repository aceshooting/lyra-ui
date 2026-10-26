import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { catalogExportCohort, referenceRevision } from './catalog-export-cohort.mjs';

test('stable and candidate catalog exports satisfy their pinned schema profiles independently', async () => {
  const { stable, candidate, cases } = await catalogExportCohort();
  assert.equal(Object.keys(stable.components).length, 28);
  assert.equal(Object.keys(candidate.components).length, 28);
  assert.equal(cases.filter(item => item.name === 'authored-example').length, 56);
  assert.equal(cases.filter(item => item.name === 'undeclared-property').length, 56);
  assert.ok(cases.some(item => item.name.startsWith('missing-')));
  const report = JSON.parse(await readFile(new URL('../test/fixtures/a2ui/catalog-export-results.json', import.meta.url), 'utf8'));
  assert.equal(report.revision, referenceRevision);
  for (const [version, artifact] of [['v0.9.1', stable], ['v1.0-candidate', candidate]]) {
    const profile = report.profiles.find(item => item.version === version);
    assert.ok(profile, `${version}: actual consumer receipt required`);
    assert.equal(profile.artifactSha256, createHash('sha256').update(JSON.stringify(artifact)).digest('hex'), `${version}: rerun the pinned consumer after an export changes`);
    assert.deepEqual(profile.cases, cases.filter(entry => entry.version === version).map(({ role, name, accepted }) => ({ role, name, accepted })));
  }
});
