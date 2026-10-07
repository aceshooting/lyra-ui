import assert from 'node:assert/strict';

function exactKeys(value, keys, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} has unexpected or missing fields`);
}

function nonempty(value, label) {
  assert.ok(typeof value === 'string' && value.trim() === value && value.length > 0 && !value.includes('\0'),
    `${label} must be a nonempty string`);
}

function sourcePath(value, prefix, suffix, label) {
  nonempty(value, label);
  assert.ok(value.startsWith(prefix) && value.endsWith(suffix) && !value.includes('\\') &&
    value.split('/').every(part => part.length > 0 && !part.startsWith('.')), `${label} must be a source path`);
}

function assertLocator(locator) {
  const keys = {
    component: ['kind', 'tag', 'declaration'],
    utility: ['kind', 'name', 'declaration'],
    declaration: ['kind', 'name'],
    'indexed-interface': ['kind', 'name', 'declaration', 'specifier', 'fields'],
  }[locator?.kind];
  assert.ok(Array.isArray(keys), 'Unknown source-contract locator kind');
  exactKeys(locator, keys, 'Source-contract locator');
  for (const key of keys.filter(key => key !== 'fields')) nonempty(locator[key], `Locator ${key}`);
  if (locator.kind === 'indexed-interface') {
    assert.ok(Array.isArray(locator.fields) && locator.fields.length > 0, 'Indexed locator requires fields');
    locator.fields.forEach(field => nonempty(field, 'Indexed locator field'));
    assert.equal(new Set(locator.fields).size, locator.fields.length, 'Duplicate indexed locator field');
  }
}

export function assertSourceContractRequest(request) {
  const hasRelocations = request != null && Object.hasOwn(request, 'relocations');
  exactKeys(request, ['schemaVersion', 'updates', 'enrollments', ...(hasRelocations ? ['relocations'] : [])],
    'Source-contract request');
  assert.equal(request.schemaVersion, 1, 'Source-contract request schemaVersion must be 1');
  const relocations = hasRelocations ? request.relocations : [];
  assert.ok(Array.isArray(request.updates) && Array.isArray(request.enrollments) && Array.isArray(relocations),
    'Source-contract updates, enrollments and relocations must be arrays');
  assert.ok(request.updates.length + request.enrollments.length + relocations.length > 0,
    'Source-contract request must name owners');
  const owners = new Set();
  for (const [operation, entries] of [
    ['update', request.updates], ['enrollment', request.enrollments], ['relocation', relocations],
  ]) {
    for (const entry of entries) {
      const hasAdditionalRoutes = operation === 'update' && entry != null && Object.hasOwn(entry, 'additionalRoutes');
      const hasTargetFingerprint = operation === 'relocation' && entry != null &&
        Object.hasOwn(entry, 'expectedTargetFingerprint');
      const fields = ['module', 'exportName', 'kind', ...(operation === 'enrollment'
        ? ['document', 'family', 'locator'] : ['expectedFingerprint'])];
      if (operation === 'relocation') fields.push('toModule');
      if (hasAdditionalRoutes) fields.push('additionalRoutes');
      if (hasTargetFingerprint) fields.push('expectedTargetFingerprint');
      exactKeys(entry, fields, `Source-contract ${operation}`);
      sourcePath(entry.module, 'src/', '.ts', 'Contract module');
      nonempty(entry.exportName, 'Contract exportName');
      assert.ok(['interface', 'function'].includes(entry.kind), 'Unsupported source-contract kind');
      if (hasAdditionalRoutes) {
        assert.ok(Array.isArray(entry.additionalRoutes) && entry.additionalRoutes.length > 0,
          'Additional source-contract routes must be a nonempty array');
        entry.additionalRoutes.forEach(route => sourcePath(route, 'src/', '.ts', 'Additional contract route'));
        assert.equal(new Set(entry.additionalRoutes).size, entry.additionalRoutes.length,
          'Duplicate additional source-contract route');
      }
      const modules = [entry.module];
      if (operation === 'relocation') {
        sourcePath(entry.toModule, 'src/', '.ts', 'Relocation target module');
        assert.notEqual(entry.module, entry.toModule, 'Source-contract relocation must change its module');
        modules.push(entry.toModule);
      }
      for (const module of modules) {
        const key = JSON.stringify([module, entry.exportName, entry.kind]);
        assert.ok(!owners.has(key), `Duplicate requested source-contract owner ${key}`);
        owners.add(key);
      }
      if (operation !== 'enrollment') {
        assert.match(entry.expectedFingerprint, /^[a-f0-9]{20}$/u, 'Expected fingerprint must be the exact old census hash');
        if (hasTargetFingerprint) {
          assert.match(entry.expectedTargetFingerprint, /^[a-f0-9]{20}$/u,
            'Expected target fingerprint must be the exact reviewed live census hash');
          assert.notEqual(entry.expectedTargetFingerprint, entry.expectedFingerprint,
            'Expected target fingerprint must name a changed census hash');
        }
      } else {
        sourcePath(entry.document, 'llms/', '.md', 'Contract document');
        nonempty(entry.family, 'Contract family');
        assertLocator(entry.locator);
        assert.equal(entry.locator.kind === 'declaration' ? entry.locator.name : entry.locator.declaration,
          entry.exportName, 'Enrollment locator must name the exported declaration');
      }
    }
  }
}

export function parseSourceContractRequest(source = '', mode = 'source') {
  assert.ok(['source', 'release'].includes(mode), `Unknown preparation mode ${mode}`);
  assert.equal(typeof source, 'string', 'Source-contract request must be JSON text');
  if (source === '') return null;
  assert.equal(mode, 'source', 'Release preparation cannot update source-contract enrollment');
  const request = JSON.parse(source);
  assertSourceContractRequest(request);
  return request;
}
