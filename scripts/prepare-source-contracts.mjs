import assert from 'node:assert/strict';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectGaps } from '../packages/lyra-ui/scripts/llms-gaps.mjs';
import {
  sourceContractCensus,
  sourceContractKey,
  validateSourceContractBaseline,
} from '../packages/lyra-ui/scripts/llms-source-contracts.mjs';
import { assertSourceContractRequest } from './source-contract-request.mjs';

// This is an explicit documented-owner update, never a blanket census rebaseline. The current
// scanner remains the only authority for fingerprints/routes; authored locators remain reviewed.
export function prepareSourceContractBaseline(census, baseline, request) {
  assertSourceContractRequest(request);
  assert.equal(baseline.schemaVersion, 1, 'Source-contract baseline schemaVersion must be 1');
  assert.ok(Array.isArray(baseline.documented) && Array.isArray(baseline.legacy), 'Invalid source-contract baseline');
  const actual = new Map(census.map(contract => [sourceContractKey(contract), contract]));
  assert.equal(actual.size, census.length, 'Duplicate live source-contract owner');
  const next = structuredClone(baseline);
  const documented = new Map(next.documented.map(owner => [sourceContractKey(owner), owner]));
  const legacy = new Set(next.legacy.map(sourceContractKey));
  assert.equal(documented.size, next.documented.length, 'Duplicate documented source-contract owner');
  for (const relocation of request.relocations ?? []) {
    const key = sourceContractKey(relocation);
    const targetKey = sourceContractKey({ ...relocation, module: relocation.toModule });
    assert.ok(!legacy.has(key), `Cannot relocate legacy source-contract owner ${key}`);
    const owner = documented.get(key);
    const contract = actual.get(targetKey);
    assert.ok(owner && contract, `Relocation requires a documented source and live target ${key}`);
    assert.ok(!actual.has(key), `Relocated source-contract owner remains live ${key}`);
    assert.ok(!documented.has(targetKey) && !legacy.has(targetKey), `Relocation target is already enrolled ${targetKey}`);
    assert.equal(owner.fingerprint, relocation.expectedFingerprint, `Stale source-contract fingerprint preimage ${key}`);
    assert.equal(contract.fingerprint, relocation.expectedTargetFingerprint ?? owner.fingerprint,
      relocation.expectedTargetFingerprint === undefined ? `Relocation changed source-contract signature ${key}`
        : `Reviewed relocation target fingerprint changed ${key}`);
    assert.deepEqual(owner.routes.slice().sort(), contract.routes, `Relocation changed source-contract routes ${key}`);
    owner.module = contract.module;
    owner.fingerprint = contract.fingerprint;
    documented.delete(key);
    documented.set(targetKey, owner);
  }
  for (const update of request.updates) {
    const key = sourceContractKey(update);
    assert.ok(!legacy.has(key), `Cannot update legacy source-contract owner ${key}`);
    const owner = documented.get(key);
    const contract = actual.get(key);
    assert.ok(owner && contract, `Update requires an existing documented and live source-contract owner ${key}`);
    assert.equal(owner.fingerprint, update.expectedFingerprint, `Stale source-contract fingerprint preimage ${key}`);
    const additionalRoutes = update.additionalRoutes ?? [];
    assert.ok(Array.isArray(owner.routes) && owner.routes.length > 0,
      `Source-contract owner lacks recorded routes ${key}`);
    if (additionalRoutes.length === 0) {
      assert.notEqual(contract.fingerprint, owner.fingerprint, `Source-contract fingerprint is unchanged ${key}`);
    }
    for (const route of additionalRoutes) {
      assert.ok(!owner.routes.includes(route), `Source-contract route is already recorded ${key}: ${route}`);
    }
    assert.deepEqual([...owner.routes, ...additionalRoutes].sort(), contract.routes,
      additionalRoutes.length > 0 ? `Source-contract routes changed beyond the requested additions ${key}`
        : `Source-contract routes changed ${key}`);
    if (additionalRoutes.length > 0) owner.routes = [...contract.routes];
    owner.fingerprint = contract.fingerprint;
  }
  for (const enrollment of request.enrollments) {
    const key = sourceContractKey(enrollment);
    assert.ok(!documented.has(key) && !legacy.has(key), `Source-contract owner is already enrolled ${key}`);
    const contract = actual.get(key);
    assert.ok(contract, `Enrollment requires a live source-contract owner ${key}`);
    const owner = {
      module: contract.module,
      exportName: contract.exportName,
      kind: contract.kind,
      fingerprint: contract.fingerprint,
      routes: [...contract.routes],
      document: enrollment.document,
      family: enrollment.family,
      locator: structuredClone(enrollment.locator),
    };
    next.documented.push(owner);
    documented.set(key, owner);
  }
  assert.deepEqual(validateSourceContractBaseline(census, next), [], 'Candidate source-contract baseline has unresolved gaps');
  return next;
}

export function writePreparedSourceContracts(root, request) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Use the hosted generation workflow');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Generation requires main');
  assert.equal(process.env.PREPARATION_MODE, 'source', 'Source-contract enrollment requires source mode');
  const packageDir = join(root, 'packages/lyra-ui');
  const file = join(packageDir, 'scripts/fixtures/llms-source-contracts.json');
  const before = readFileSync(file, 'utf8');
  const baseline = JSON.parse(before);
  const census = sourceContractCensus(packageDir);
  const next = prepareSourceContractBaseline(census, baseline, request);
  // Read the real authored documents and the regenerated manifest/shared assembly. No request can
  // supply alternate documents, census data, or relaxed gap findings to this hosted writer.
  assert.deepEqual(collectGaps(undefined, null, { census, baseline: next }), [],
    'Authored documentation has unresolved source-contract or component gaps');
  const relocations = request.relocations ?? [];
  const requested = new Set([
    ...request.updates,
    ...request.enrollments,
    ...relocations.map(relocation => ({ ...relocation, module: relocation.toModule })),
  ].map(sourceContractKey));
  const oldOwners = new Map(baseline.documented.map(owner => [sourceContractKey(owner), owner]));
  for (const relocation of relocations) {
    oldOwners.set(sourceContractKey({ ...relocation, module: relocation.toModule }),
      oldOwners.get(sourceContractKey(relocation)));
  }
  const changes = next.documented.filter(owner => requested.has(sourceContractKey(owner))).map(owner => ({
    before: oldOwners.get(sourceContractKey(owner)) ?? null,
    after: owner,
  }));
  assert.equal(readFileSync(file, 'utf8'), before, 'Source-contract baseline changed during preparation');
  const temporary = `${file}.${process.pid}.tmp`;
  let created = false;
  try {
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
    created = true;
    renameSync(temporary, file);
  } finally {
    if (created) rmSync(temporary, { force: true });
  }
  console.log(JSON.stringify({ sourceContractChanges: changes }, null, 2));
}
