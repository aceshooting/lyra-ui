import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGaps } from '../packages/lyra-ui/scripts/llms-gaps.mjs';
import { parseSourceContractRequest } from './source-contract-request.mjs';
import { prepareSourceContractBaseline } from './prepare-source-contracts.mjs';

const fingerprints = {
  previous: 'a'.repeat(20),
  current: 'b'.repeat(20),
  unchanged: 'c'.repeat(20),
  legacy: 'd'.repeat(20),
  added: 'e'.repeat(20),
  unexpected: 'f'.repeat(20),
};

function owner(name) {
  return {
    module: `src/components/forms/${name}/${name}.class.ts`,
    exportName: `Lyra${name[0].toUpperCase()}${name.slice(1)}Entry`,
    kind: 'interface',
  };
}

function location(record) {
  return {
    document: 'llms/forms.md',
    family: 'forms',
    locator: {
      kind: 'component',
      tag: `lr-${record.module.split('/')[3]}`,
      declaration: record.exportName,
    },
  };
}

function censusRecord(record, fingerprint) {
  return {
    ...record,
    fingerprint,
    routes: [record.module, 'src/lyra.ts'],
    names: [],
    utilityRoutes: [],
  };
}

function documentedRecord(record, fingerprint) {
  return {
    ...record,
    fingerprint,
    routes: [record.module, 'src/lyra.ts'],
    ...location(record),
  };
}

function fixture() {
  const updated = owner('example');
  const unchanged = owner('keeper');
  const legacy = owner('legacy');
  const added = owner('extra');
  return {
    census: [
      censusRecord(added, fingerprints.added),
      censusRecord(legacy, fingerprints.legacy),
      censusRecord(updated, fingerprints.current),
      censusRecord(unchanged, fingerprints.unchanged),
    ],
    baseline: {
      schemaVersion: 1,
      documented: [
        {
          ...documentedRecord(unchanged, fingerprints.unchanged),
          routes: ['src/lyra.ts', unchanged.module],
          annotations: { notes: ['Keep existing documentation metadata.'] },
        },
        documentedRecord(updated, fingerprints.previous),
      ],
      legacy: [{
        ...legacy,
        fingerprint: fingerprints.legacy,
        routes: [legacy.module, 'src/lyra.ts'],
        reason: 'Existing component contract.',
      }],
      annotations: { notes: ['Preserve baseline metadata.'] },
    },
    request: {
      schemaVersion: 1,
      updates: [{ ...updated, expectedFingerprint: fingerprints.previous }],
      enrollments: [{ ...added, ...location(added) }],
    },
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function parse(request, mode) {
  return parseSourceContractRequest(JSON.stringify(request), mode);
}

function rejectRequest(change) {
  const { request } = fixture();
  change(request);
  assert.throws(() => parse(request));
}

function rejectCandidate(change) {
  const data = fixture();
  change(data);
  const before = structuredClone(data);
  deepFreeze(data);
  assert.throws(() => prepareSourceContractBaseline(data.census, data.baseline, data.request));
  assert.deepEqual(data, before);
}

test('an omitted source-contract request is a no-op in source and release modes', () => {
  assert.equal(parseSourceContractRequest(), null);
  for (const mode of ['source', 'release']) {
    assert.equal(parseSourceContractRequest('', mode), null);
  }
});

test('the parser accepts exact explicit owners without supplying derived fingerprints or routes', () => {
  const { request } = fixture();
  assert.deepEqual(parse(request), request);
  assert.deepEqual(parse({ ...request, enrollments: [] }), { ...request, enrollments: [] });
  assert.deepEqual(parse({ ...request, updates: [] }), { ...request, updates: [] });
  const functionRequest = structuredClone(request);
  functionRequest.updates[0].kind = 'function';
  functionRequest.updates[0].exportName = 'discover';
  assert.deepEqual(parse(functionRequest), functionRequest);
});

test('owners with the same exported name in different modules remain distinct', () => {
  const { request } = fixture();
  request.updates.push({ ...request.updates[0], module: 'src/another.ts' });
  assert.deepEqual(parse(request), request);
});

test('the parser accepts each supported stable documentation locator', () => {
  const { request } = fixture();
  const declaration = request.enrollments[0].exportName;
  for (const locator of [
    { kind: 'utility', name: 'example', declaration },
    { kind: 'declaration', name: declaration },
    {
      kind: 'indexed-interface', name: 'example', declaration,
      specifier: '@aceshooting/lyra-ui/example.js', fields: ['code', 'label'],
    },
  ]) {
    request.enrollments[0].locator = locator;
    assert.deepEqual(parse(request), request);
  }
});

test('nonempty requests are forbidden in release mode', () => {
  assert.throws(() => parse(fixture().request, 'release'));
});

test('the parser rejects malformed JSON and non-object requests', () => {
  for (const source of ['{', 'null', '[]', 'true', '42', '"source"']) {
    assert.throws(() => parseSourceContractRequest(source), undefined, source);
  }
});

for (const [name, change] of [
  ['an unsupported schema', request => { request.schemaVersion = 2; }],
  ['a string schema version', request => { request.schemaVersion = '1'; }],
  ['a missing schema version', request => { delete request.schemaVersion; }],
  ['an unknown top-level key', request => { request.force = true; }],
  ['missing updates', request => { delete request.updates; }],
  ['missing enrollments', request => { delete request.enrollments; }],
  ['non-array updates', request => { request.updates = {}; }],
  ['non-array enrollments', request => { request.enrollments = null; }],
  ['no requested owners', request => { request.updates = []; request.enrollments = []; }],
  ['a null update', request => { request.updates[0] = null; }],
  ['an array enrollment', request => { request.enrollments[0] = []; }],
  ['an unknown update key', request => { request.updates[0].force = true; }],
  ['an unknown enrollment key', request => { request.enrollments[0].force = true; }],
  ['a caller-supplied update fingerprint', request => { request.updates[0].fingerprint = fingerprints.current; }],
  ['caller-supplied enrollment routes', request => { request.enrollments[0].routes = ['src/lyra.ts']; }],
  ['a caller-supplied enrollment fingerprint', request => { request.enrollments[0].fingerprint = fingerprints.added; }],
  ['a missing expected fingerprint', request => { delete request.updates[0].expectedFingerprint; }],
  ['an empty export name', request => { request.updates[0].exportName = ''; }],
  ['a NUL in an owner identity', request => { request.updates[0].exportName = 'Lyra\0Entry'; }],
  ['an unsupported contract kind', request => { request.updates[0].kind = 'type'; }],
  ['a missing document', request => { delete request.enrollments[0].document; }],
  ['a missing family', request => { delete request.enrollments[0].family; }],
  ['a missing locator', request => { delete request.enrollments[0].locator; }],
  ['a null locator', request => { request.enrollments[0].locator = null; }],
  ['an unsupported locator kind', request => { request.enrollments[0].locator.kind = 'heading'; }],
  ['a missing component tag', request => { delete request.enrollments[0].locator.tag; }],
  ['an unknown locator key', request => { request.enrollments[0].locator.ignore = true; }],
  ['a locator naming another declaration', request => { request.enrollments[0].locator.declaration = 'LyraOtherEntry'; }],
  ['a declaration locator naming another declaration', request => {
    request.enrollments[0].locator = { kind: 'declaration', name: 'LyraOtherEntry' };
  }],
]) {
  test(`the parser rejects ${name}`, () => rejectRequest(change));
}

test('fingerprints must be exactly twenty lowercase hexadecimal characters', () => {
  for (const fingerprint of [
    '', 'a'.repeat(19), 'a'.repeat(21), 'g'.repeat(20), 'A'.repeat(20), 123, null,
  ]) {
    rejectRequest(request => { request.updates[0].expectedFingerprint = fingerprint; });
  }
});

test('both owner lists reject noncanonical or non-source module paths', () => {
  for (const module of [
    '/src/example.ts', '../src/example.ts', 'src/../example.ts',
    './src/example.ts', 'src//example.ts', 'src/./example.ts',
    'src\\example.ts', 'dist/example.ts', 'src/example.js',
    'src/example.ts\n', 'src/example\0.ts', '', null,
  ]) {
    for (const list of ['updates', 'enrollments']) {
      rejectRequest(request => { request[list][0].module = module; });
    }
  }
});

test('documentation paths cannot escape the authored llms tree', () => {
  for (const document of [
    '../llms/forms.md', '/llms/forms.md', 'llms/../forms.md', 'llms//forms.md',
    'llms\\forms.md', 'docs/forms.md', 'llms/forms.txt', '', null,
  ]) {
    rejectRequest(request => { request.enrollments[0].document = document; });
  }
});

test('the parser rejects duplicate owners within and across request lists', () => {
  for (const list of ['updates', 'enrollments']) {
    rejectRequest(request => { request[list].push(structuredClone(request[list][0])); });
  }
  rejectRequest(request => {
    const { expectedFingerprint, ...updated } = request.updates[0];
    request.enrollments.push({ ...updated, ...location(updated) });
  });
});

test('preparation derives only requested signatures and enrollment fields while preserving existing data', () => {
  const data = fixture();
  const before = structuredClone(data);
  const expected = structuredClone(data.baseline);
  expected.documented[1].fingerprint = fingerprints.current;
  expected.documented.push(documentedRecord(owner('extra'), fingerprints.added));
  deepFreeze(data);

  const candidate = prepareSourceContractBaseline(data.census, data.baseline, data.request);
  assert.deepEqual(candidate, expected);
  assert.deepEqual(data, before);
  assert.notStrictEqual(candidate, data.baseline);
  assert.notStrictEqual(candidate.documented[0], data.baseline.documented[0]);
  assert.notStrictEqual(candidate.documented[2].routes, data.census[0].routes);
  assert.notStrictEqual(candidate.documented[2].locator, data.request.enrollments[0].locator);

  candidate.annotations.notes.push('Candidate-only note.');
  candidate.documented[0].annotations.notes.push('Candidate-only documentation note.');
  candidate.documented[2].routes.push('src/example.ts');
  candidate.documented[2].locator.tag = 'lr-candidate';
  candidate.legacy[0].reason = 'Candidate-only reason.';
  assert.deepEqual(data, before);
});

test('an update-only request preserves existing documented order without adding rows', () => {
  const data = fixture();
  data.request.enrollments = [];
  data.census = data.census.filter(record => record.exportName !== 'LyraExtraEntry');
  const candidate = prepareSourceContractBaseline(data.census, data.baseline, data.request);
  assert.deepEqual(candidate.documented.map(record => record.exportName), [
    'LyraKeeperEntry', 'LyraExampleEntry',
  ]);
  assert.equal(candidate.documented[1].fingerprint, fingerprints.current);
});

test('an enrollment-only request appends owners in request order instead of census order', () => {
  const data = fixture();
  data.request.updates = [];
  data.baseline.documented[1].fingerprint = fingerprints.current;
  const last = owner('last');
  data.census.unshift(censusRecord(last, fingerprints.unexpected));
  data.request.enrollments.push({ ...last, ...location(last) });
  const candidate = prepareSourceContractBaseline(data.census, data.baseline, data.request);
  assert.deepEqual(candidate.documented.map(record => record.exportName), [
    'LyraKeeperEntry', 'LyraExampleEntry', 'LyraExtraEntry', 'LyraLastEntry',
  ]);
});

for (const [name, change] of [
  ['a stale expected fingerprint', data => {
    data.request.updates[0].expectedFingerprint = fingerprints.unexpected;
  }],
  ['the live fingerprint supplied as the expected previous fingerprint', data => {
    data.request.updates[0].expectedFingerprint = fingerprints.current;
  }],
  ['a requested signature that has not changed', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').fingerprint = fingerprints.previous;
  }],
  ['an update to an owner absent from the baseline', data => {
    data.baseline.documented.pop();
  }],
  ['an update to an owner absent from the live census', data => {
    data.census = data.census.filter(record => record.exportName !== 'LyraExampleEntry');
  }],
  ['an update to a legacy owner', data => {
    data.baseline.legacy.push(data.baseline.documented.pop());
  }],
  ['an updated owner gaining a public route', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').routes.push('src/testing.ts');
  }],
  ['an updated owner losing a public route', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').routes.pop();
  }],
  ['an enrollment absent from the live census', data => {
    data.census = data.census.filter(record => record.exportName !== 'LyraExtraEntry');
  }],
  ['an enrollment already documented', data => {
    data.baseline.documented.push(documentedRecord(owner('extra'), fingerprints.added));
  }],
  ['an enrollment already in the legacy baseline', data => {
    const { names, utilityRoutes, ...record } = data.census[0];
    data.baseline.legacy.push(record);
  }],
  ['an unrelated signature change', data => {
    data.census.find(record => record.exportName === 'LyraKeeperEntry').fingerprint = fingerprints.unexpected;
  }],
  ['an unrelated route change', data => {
    data.census.find(record => record.exportName === 'LyraKeeperEntry').routes.pop();
  }],
  ['an unrelated new owner', data => {
    data.census.push(censusRecord(owner('unrequested'), fingerprints.unexpected));
  }],
  ['an unrelated removed owner', data => {
    data.census = data.census.filter(record => record.exportName !== 'LyraKeeperEntry');
  }],
  ['a changed legacy signature', data => {
    data.census.find(record => record.exportName === 'LyraLegacyEntry').fingerprint = fingerprints.unexpected;
  }],
  ['a duplicate baseline owner', data => {
    data.baseline.documented.push(structuredClone(data.baseline.documented[0]));
  }],
  ['a duplicate live census owner', data => {
    data.census.push(structuredClone(data.census[0]));
  }],
  ['a document locator already owned by another contract', data => {
    data.census[0].exportName = 'LyraKeeperEntry';
    data.request.enrollments[0].exportName = 'LyraKeeperEntry';
    data.request.enrollments[0].locator = structuredClone(data.baseline.documented[0].locator);
  }],
  ['an unrelated invalid documentation locator', data => {
    delete data.baseline.documented[0].locator;
  }],
  ['a legacy contract newly reachable through a utility route', data => {
    data.census.find(record => record.exportName === 'LyraLegacyEntry').utilityRoutes = ['src/lyra.ts'];
  }],
  ['an invalid baseline schema', data => {
    data.baseline.schemaVersion = 2;
  }],
]) {
  test(`preparation rejects ${name} without mutating inputs`, () => rejectCandidate(change));
}

test('preparation rechecks indexed locator fields against the live contract', () => {
  rejectCandidate(data => {
    const record = data.census.find(entry => entry.exportName === 'LyraKeeperEntry');
    record.indexedFields = ['value'];
    record.indexedSpecifiers = ['@aceshooting/lyra-ui/example.js'];
    data.baseline.documented[0].locator = {
      kind: 'indexed-interface',
      name: 'Example types',
      declaration: 'LyraKeeperEntry',
      specifier: '@aceshooting/lyra-ui/example.js',
      fields: ['oldValue'],
    };
  });
});

function documentationFixture() {
  const data = fixture();
  for (const record of data.census) record.names = ['code', 'label'];
  return {
    ...data,
    documents: {
      'llms/forms.md': [
        '## `lr-keeper`',
        '',
        '`LyraKeeperEntry { code: string; label: string }`',
        '',
        '## `lr-example`',
        '',
        '`LyraExampleEntry { code: string; label: string }`',
        '',
        '## `lr-extra`',
        '',
        '`LyraExtraEntry { code: string; label: string }`',
      ].join('\n'),
      'llms/data.md': '# Data components\n',
    },
  };
}

function documentationGaps(data) {
  const candidate = prepareSourceContractBaseline(data.census, data.baseline, data.request);
  return collectGaps([], { modules: [] }, {
    census: data.census,
    baseline: candidate,
    documents: data.documents,
  });
}

test('prepared enrollment resolves exact typed declarations in the authored component sections', () => {
  assert.deepEqual(documentationGaps(documentationFixture()), []);
});

test('a valid candidate still fails authored-document validation when its document is wrong', () => {
  const data = documentationFixture();
  data.request.enrollments[0].document = 'llms/data.md';
  const gaps = documentationGaps(data);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].tag, 'lr-extra');
  assert.match(gaps[0].names.join('\n'), /LyraExtraEntry.*found 0/u);
});

test('an exact signature in another component section does not satisfy the locator', () => {
  const data = documentationFixture();
  data.request.enrollments[0].locator.tag = 'lr-example';
  const gaps = documentationGaps(data);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].tag, 'lr-example');
  assert.match(gaps[0].names.join('\n'), /LyraExtraEntry.*signature, found 0/u);
});

test('authored-document validation detects an omitted field in the enrolled exact signature', () => {
  const data = documentationFixture();
  data.documents['llms/forms.md'] = data.documents['llms/forms.md'].replace(
    'LyraExtraEntry { code: string; label: string }',
    'LyraExtraEntry { code: string }',
  );
  const gaps = documentationGaps(data);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].tag, 'lr-extra');
  assert.deepEqual(gaps[0].names, ['label']);
});

test('authored-document validation rejects duplicate exact signatures', () => {
  const data = documentationFixture();
  data.documents['llms/forms.md'] += '\n\n`LyraExtraEntry { code: string; label: string }`\n';
  const gaps = documentationGaps(data);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].tag, 'lr-extra');
  assert.match(gaps[0].names.join('\n'), /LyraExtraEntry.*signature, found 2/u);
});
