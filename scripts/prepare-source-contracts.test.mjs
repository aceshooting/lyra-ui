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

test('the parser accepts explicit additional public routes on update owners', () => {
  const { request } = fixture();
  request.updates[0].additionalRoutes = ['src/utilities/example.ts', 'src/example.ts'];
  assert.deepEqual(parse(request), request);
  assert.throws(() => parse(request, 'release'));
});

test('additional routes must be a nonempty array of unique canonical source paths', () => {
  for (const additionalRoutes of [
    [], null, {}, 'src/example.ts', ['src/example.ts', 'src/example.ts'],
    ...[
      '/src/example.ts', '../src/example.ts', 'src/../example.ts', './src/example.ts',
      'src//example.ts', 'src/./example.ts', 'src\\example.ts', 'dist/example.ts',
      'src/example.js', 'src/example.ts\n', 'src/example\0.ts', '', null, 1,
    ].map(route => [route]),
  ]) {
    rejectRequest(request => { request.updates[0].additionalRoutes = additionalRoutes; });
  }
});

test('additional routes require a fingerprint preimage and belong only to update owners', () => {
  rejectRequest(request => {
    request.updates[0].additionalRoutes = ['src/example.ts'];
    delete request.updates[0].expectedFingerprint;
  });
  rejectRequest(request => { request.enrollments[0].additionalRoutes = ['src/example.ts']; });
  rejectRelocationRequest(request => { request.relocations[0].additionalRoutes = ['src/example.ts']; });
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

function routeAdditionFixture(data = fixture()) {
  const additionalRoutes = ['src/utilities/example.ts', 'src/example.ts'];
  const record = data.census.find(entry => entry.exportName === 'LyraExampleEntry');
  record.fingerprint = fingerprints.previous;
  record.routes = [...record.routes, ...additionalRoutes].sort();
  data.request.updates[0].additionalRoutes = additionalRoutes;
  data.baseline.documented[1].routes.reverse();
  data.baseline.documented[1].annotations = { notes: ['Preserve owner metadata.'] };
  return data;
}

for (const [name, fingerprint] of [
  ['route-only', fingerprints.previous],
  ['signature and route', fingerprints.current],
]) {
  test(`${name} updates derive exact additions without mutating or aliasing inputs`, () => {
    const data = routeAdditionFixture();
    const record = data.census.find(entry => entry.exportName === 'LyraExampleEntry');
    record.fingerprint = fingerprint;
    const before = structuredClone(data);
    const expected = structuredClone(data.baseline);
    expected.documented[1].fingerprint = fingerprint;
    expected.documented[1].routes = [...record.routes];
    expected.documented.push(documentedRecord(owner('extra'), fingerprints.added));
    deepFreeze(data);

    const candidate = prepareSourceContractBaseline(data.census, data.baseline, data.request);
    assert.deepEqual(candidate, expected);
    assert.deepEqual(data, before);
    assert.notStrictEqual(candidate.documented[1].routes, record.routes);
    assert.notStrictEqual(candidate.documented[1].routes, data.request.updates[0].additionalRoutes);

    candidate.documented[1].routes.push('src/candidate.ts');
    candidate.documented[1].locator.tag = 'lr-candidate';
    candidate.documented[1].annotations.notes.push('Candidate-only owner note.');
    assert.deepEqual(data, before);
  });
}

test('different owners can explicitly add the same public route', () => {
  const data = routeAdditionFixture();
  const keeper = owner('keeper');
  const record = data.census.find(entry => entry.exportName === keeper.exportName);
  record.routes = [...record.routes, 'src/example.ts'].sort();
  data.request.updates.push({
    ...keeper,
    expectedFingerprint: fingerprints.unchanged,
    additionalRoutes: ['src/example.ts'],
  });
  const candidate = prepareSourceContractBaseline(data.census, data.baseline, data.request);
  assert.deepEqual(candidate.documented[0].routes, record.routes);
  assert.equal(candidate.documented[0].fingerprint, fingerprints.unchanged);
  assert.deepEqual(candidate.documented[1].routes,
    data.census.find(entry => entry.exportName === 'LyraExampleEntry').routes);
});

for (const [name, change] of [
  ['a stale fingerprint preimage', data => {
    data.request.updates[0].expectedFingerprint = fingerprints.unexpected;
  }],
  ['a previously recorded route in the requested additions', data => {
    data.request.updates[0].additionalRoutes.push('src/lyra.ts');
  }],
  ['a requested addition absent from the live routes', data => {
    const record = data.census.find(entry => entry.exportName === 'LyraExampleEntry');
    record.routes = record.routes.filter(route => route !== 'src/example.ts');
  }],
  ['a live addition absent from the request', data => {
    const record = data.census.find(entry => entry.exportName === 'LyraExampleEntry');
    record.routes = [...record.routes, 'src/unrequested.ts'].sort();
  }],
  ['an old route removed while adding new routes', data => {
    const record = data.census.find(entry => entry.exportName === 'LyraExampleEntry');
    record.routes = record.routes.filter(route => route !== 'src/lyra.ts');
  }],
  ['duplicate baseline routes', data => {
    data.baseline.documented[1].routes.push('src/lyra.ts');
  }],
  ['an empty old route list covered entirely by requested additions', data => {
    data.request.updates[0].additionalRoutes = [
      ...data.request.updates[0].additionalRoutes,
      ...data.baseline.documented[1].routes,
    ];
    data.baseline.documented[1].routes = [];
  }],
  ['duplicate live routes', data => {
    const record = data.census.find(entry => entry.exportName === 'LyraExampleEntry');
    record.routes = [...record.routes, 'src/example.ts'].sort();
  }],
  ['an owner absent from the baseline', data => {
    data.baseline.documented.pop();
  }],
  ['an owner absent from the live census', data => {
    data.census = data.census.filter(record => record.exportName !== 'LyraExampleEntry');
  }],
  ['a legacy owner', data => {
    data.baseline.legacy.push(data.baseline.documented.pop());
  }],
  ['unrelated signature drift', data => {
    data.census.find(record => record.exportName === 'LyraKeeperEntry').fingerprint = fingerprints.unexpected;
  }],
  ['unrelated route drift', data => {
    data.census.find(record => record.exportName === 'LyraKeeperEntry').routes.pop();
  }],
  ['an unrelated new owner', data => {
    data.census.push(censusRecord(owner('unrequested'), fingerprints.unexpected));
  }],
]) {
  test(`route additions reject ${name} without mutating inputs`, () => {
    rejectCandidate(data => {
      routeAdditionFixture(data);
      change(data);
    });
  });
}

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

test('route additions preserve the authored component declaration contract', () => {
  assert.deepEqual(documentationGaps(routeAdditionFixture(documentationFixture())), []);
});

test('route additions do not conceal a field missing from the preserved authored declaration', () => {
  const data = routeAdditionFixture(documentationFixture());
  data.documents['llms/forms.md'] = data.documents['llms/forms.md'].replace(
    'LyraExampleEntry { code: string; label: string }',
    'LyraExampleEntry { code: string }',
  );
  const gaps = documentationGaps(data);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].tag, 'lr-example');
  assert.deepEqual(gaps[0].names, ['label']);
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

function relocationFixture(data = fixture()) {
  const previous = owner('example');
  const toModule = 'src/components/forms/example/example-types.ts';
  data.census = data.census.filter(record => record.exportName !== 'LyraExtraEntry');
  const moved = data.census.find(record => record.exportName === previous.exportName);
  moved.module = toModule;
  moved.fingerprint = fingerprints.previous;
  data.baseline.documented[1].routes.reverse();
  data.baseline.documented[1].annotations = { notes: ['Preserve relocated owner metadata.'] };
  data.request = {
    schemaVersion: 1,
    updates: [],
    enrollments: [],
    relocations: [{ ...previous, toModule, expectedFingerprint: fingerprints.previous }],
  };
  return data;
}

function rejectRelocationRequest(change) {
  const { request } = relocationFixture();
  change(request);
  assert.throws(() => parse(request));
}

function rejectRelocationCandidate(change) {
  const data = relocationFixture();
  change(data);
  const before = structuredClone(data);
  deepFreeze(data);
  assert.throws(() => prepareSourceContractBaseline(data.census, data.baseline, data.request));
  assert.deepEqual(data, before);
}

test('the parser accepts a relocation-only request and optional empty relocations on existing requests', () => {
  const { request } = relocationFixture();
  assert.deepEqual(parse(request), request);
  const existing = { ...fixture().request, relocations: [] };
  assert.deepEqual(parse(existing), existing);
  assert.throws(() => parse(request, 'release'));
});

for (const [name, change] of [
  ['null relocations', request => { request.relocations = null; }],
  ['non-array relocations', request => { request.relocations = {}; }],
  ['three empty operation lists', request => { request.relocations = []; }],
  ['missing required updates', request => { delete request.updates; }],
  ['missing required enrollments', request => { delete request.enrollments; }],
  ['a null relocation', request => { request.relocations[0] = null; }],
  ['a missing source module', request => { delete request.relocations[0].module; }],
  ['a missing target module', request => { delete request.relocations[0].toModule; }],
  ['a missing fingerprint preimage', request => { delete request.relocations[0].expectedFingerprint; }],
  ['an unknown relocation field', request => { request.relocations[0].force = true; }],
  ['a caller-supplied relocation fingerprint', request => { request.relocations[0].fingerprint = fingerprints.current; }],
  ['caller-supplied relocation routes', request => { request.relocations[0].routes = ['src/lyra.ts']; }],
  ['a replacement documentation locator', request => { request.relocations[0].locator = location(owner('example')).locator; }],
  ['a replacement exported name', request => { request.relocations[0].toExportName = 'LyraOtherEntry'; }],
  ['an unsupported relocated kind', request => { request.relocations[0].kind = 'type'; }],
  ['an empty relocated export name', request => { request.relocations[0].exportName = ''; }],
  ['a self relocation', request => { request.relocations[0].toModule = request.relocations[0].module; }],
]) {
  test(`the relocation parser rejects ${name}`, () => rejectRelocationRequest(change));
}

test('relocations require canonical source and target paths', () => {
  for (const field of ['module', 'toModule']) {
    for (const path of [
      '/src/example.ts', '../src/example.ts', 'src/../example.ts', './src/example.ts',
      'src//example.ts', 'src/./example.ts', 'src\\example.ts', 'dist/example.ts',
      'src/example.js', 'src/example\0.ts', '', null,
    ]) {
      rejectRelocationRequest(request => { request.relocations[0][field] = path; });
    }
  }
});

test('relocations require exact fingerprint preimages', () => {
  for (const value of ['', 'a'.repeat(19), 'a'.repeat(21), 'A'.repeat(20), 'g'.repeat(20), null, 1]) {
    rejectRelocationRequest(request => { request.relocations[0].expectedFingerprint = value; });
  }
});

test('relocations can explicitly pin a reviewed target fingerprint', () => {
  const { request } = relocationFixture();
  request.relocations[0].expectedTargetFingerprint = fingerprints.current;
  assert.deepEqual(parse(request), request);
  for (const value of ['', 'a'.repeat(19), 'a'.repeat(21), 'A'.repeat(20), 'g'.repeat(20), null, 1]) {
    rejectRelocationRequest(candidate => { candidate.relocations[0].expectedTargetFingerprint = value; });
  }
  rejectRelocationRequest(candidate => {
    candidate.relocations[0].expectedTargetFingerprint = fingerprints.previous;
  });
  for (const operation of ['updates', 'enrollments']) {
    rejectRequest(candidate => { candidate[operation][0].expectedTargetFingerprint = fingerprints.current; });
  }
});

function reviewedRelocationFixture() {
  const data = relocationFixture();
  data.request.relocations[0].expectedTargetFingerprint = fingerprints.current;
  data.census.find(record => record.exportName === 'LyraExampleEntry').fingerprint = fingerprints.current;
  return data;
}

test('reviewed relocation derives the target fingerprint and preserves all other owner metadata', () => {
  const data = reviewedRelocationFixture();
  const before = structuredClone(data);
  const expected = structuredClone(data.baseline);
  expected.documented[1].module = data.request.relocations[0].toModule;
  expected.documented[1].fingerprint = fingerprints.current;
  deepFreeze(data);
  assert.deepEqual(prepareSourceContractBaseline(data.census, data.baseline, data.request), expected);
  assert.deepEqual(data, before);
});

for (const [name, change, pattern] of [
  ['a stale old fingerprint', data => {
    data.request.relocations[0].expectedFingerprint = fingerprints.unexpected;
  }, /Stale source-contract fingerprint preimage/u],
  ['a stale target fingerprint', data => {
    data.request.relocations[0].expectedTargetFingerprint = fingerprints.unexpected;
  }, /Reviewed relocation target fingerprint changed/u],
  ['an unreviewed target change', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').fingerprint = fingerprints.unexpected;
  }, /Reviewed relocation target fingerprint changed/u],
  ['a changed public route', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').routes.pop();
  }, /Relocation changed source-contract routes/u],
  ['unrelated signature drift', data => {
    data.census.find(record => record.exportName === 'LyraKeeperEntry').fingerprint = fingerprints.unexpected;
  }, /Candidate source-contract baseline has unresolved gaps/u],
]) {
  test(`reviewed relocation rejects ${name} without mutating inputs`, () => {
    const data = reviewedRelocationFixture();
    change(data);
    const before = structuredClone(data);
    deepFreeze(data);
    assert.throws(() => prepareSourceContractBaseline(data.census, data.baseline, data.request), pattern);
    assert.deepEqual(data, before);
  });
}

test('both relocation endpoints are reserved against updates and enrollments', () => {
  for (const endpoint of ['module', 'toModule']) {
    for (const operation of ['updates', 'enrollments']) {
      rejectRelocationRequest(request => {
        const move = request.relocations[0];
        const overlapping = {
          module: move[endpoint], exportName: move.exportName, kind: move.kind,
        };
        request[operation].push(operation === 'updates'
          ? { ...overlapping, expectedFingerprint: move.expectedFingerprint }
          : { ...overlapping, ...location(overlapping) });
      });
    }
  }
});

for (const [name, secondMove] of [
  ['duplicate moves', move => ({ ...move })],
  ['one source moving to two targets', move => ({ ...move, toModule: 'src/other.ts' })],
  ['two sources moving to one target', move => ({ ...move, module: 'src/other.ts' })],
  ['a forward relocation chain', move => ({ ...move, module: move.toModule, toModule: 'src/other.ts' })],
  ['a reverse relocation chain', move => ({ ...move, module: 'src/other.ts', toModule: move.module })],
  ['a relocation swap', move => ({ ...move, module: move.toModule, toModule: move.module })],
]) {
  test(`the relocation parser rejects ${name}`, () => {
    rejectRelocationRequest(request => {
      request.relocations.push(secondMove(request.relocations[0]));
    });
  });
}

test('relocation changes only the owner module in place and returns an isolated deep clone', () => {
  const data = relocationFixture();
  const before = structuredClone(data);
  const expected = structuredClone(data.baseline);
  expected.documented[1].module = data.request.relocations[0].toModule;
  deepFreeze(data);

  const candidate = prepareSourceContractBaseline(data.census, data.baseline, data.request);
  assert.deepEqual(candidate, expected);
  assert.deepEqual(data, before);
  assert.notStrictEqual(candidate.documented[1], data.baseline.documented[1]);
  assert.notStrictEqual(candidate.documented[1].routes, data.baseline.documented[1].routes);
  assert.notStrictEqual(candidate.documented[1].locator, data.baseline.documented[1].locator);

  candidate.documented[1].routes.push('src/candidate.ts');
  candidate.documented[1].locator.tag = 'lr-candidate';
  candidate.documented[1].annotations.notes.push('Candidate-only relocation note.');
  candidate.annotations.notes.push('Candidate-only baseline note.');
  candidate.legacy[0].reason = 'Candidate-only legacy reason.';
  assert.deepEqual(data, before);
});

test('disjoint updates, enrollments and relocations can be prepared in one request', () => {
  const data = fixture();
  const keeper = owner('keeper');
  const toModule = 'src/components/forms/keeper/keeper-types.ts';
  data.census.find(record => record.exportName === keeper.exportName).module = toModule;
  data.request.relocations = [{ ...keeper, toModule, expectedFingerprint: fingerprints.unchanged }];
  const expected = structuredClone(data.baseline);
  expected.documented[0].module = toModule;
  expected.documented[1].fingerprint = fingerprints.current;
  expected.documented.push(documentedRecord(owner('extra'), fingerprints.added));
  assert.deepEqual(prepareSourceContractBaseline(data.census, data.baseline, data.request), expected);
});

for (const [name, change] of [
  ['a stale relocation fingerprint preimage', data => {
    data.request.relocations[0].expectedFingerprint = fingerprints.unexpected;
  }],
  ['a source owner still present in the live census', data => {
    data.census.push(censusRecord(owner('example'), fingerprints.previous));
  }],
  ['a source owner absent from the documented baseline', data => {
    data.baseline.documented.pop();
  }],
  ['a source owner enrolled only as legacy', data => {
    data.baseline.legacy.push(data.baseline.documented.pop());
  }],
  ['a source owner also enrolled as legacy', data => {
    data.baseline.legacy.push(structuredClone(data.baseline.documented[1]));
  }],
  ['a target owner absent from the live census', data => {
    data.census = data.census.filter(record => record.exportName !== 'LyraExampleEntry');
  }],
  ['a target already in the documented baseline', data => {
    const target = structuredClone(data.baseline.documented[1]);
    target.module = data.request.relocations[0].toModule;
    data.baseline.documented.push(target);
  }],
  ['a target already in the legacy baseline', data => {
    const target = structuredClone(data.baseline.documented[1]);
    target.module = data.request.relocations[0].toModule;
    data.baseline.legacy.push(target);
  }],
  ['a target with a changed signature', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').fingerprint = fingerprints.current;
  }],
  ['a target with an extra public route', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').routes.push('src/testing.ts');
  }],
  ['a target with a missing public route', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').routes.pop();
  }],
  ['a target with a renamed export', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').exportName = 'LyraRenamedEntry';
  }],
  ['a target with a changed contract kind', data => {
    data.census.find(record => record.exportName === 'LyraExampleEntry').kind = 'function';
  }],
  ['an unrequested dependent signature change', data => {
    data.census.find(record => record.exportName === 'LyraKeeperEntry').fingerprint = fingerprints.unexpected;
  }],
  ['an unrequested route change beside a relocation', data => {
    data.census.find(record => record.exportName === 'LyraKeeperEntry').routes.pop();
  }],
  ['an unrequested new owner beside a relocation', data => {
    data.census.push(censusRecord(owner('unrequested'), fingerprints.unexpected));
  }],
  ['an unrequested removed owner beside a relocation', data => {
    data.census = data.census.filter(record => record.exportName !== 'LyraKeeperEntry');
  }],
  ['a changed legacy owner beside a relocation', data => {
    data.census.find(record => record.exportName === 'LyraLegacyEntry').fingerprint = fingerprints.unexpected;
  }],
]) {
  test(`relocation rejects ${name} without mutating inputs`, () => rejectRelocationCandidate(change));
}

test('relocated ownership preserves the authored component declaration contract', () => {
  assert.deepEqual(documentationGaps(relocationFixture(documentationFixture())), []);
});

test('relocation does not conceal a field missing from the preserved authored declaration', () => {
  const data = relocationFixture(documentationFixture());
  data.documents['llms/forms.md'] = data.documents['llms/forms.md'].replace(
    'LyraExampleEntry { code: string; label: string }',
    'LyraExampleEntry { code: string }',
  );
  const gaps = documentationGaps(data);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].tag, 'lr-example');
  assert.deepEqual(gaps[0].names, ['label']);
});
