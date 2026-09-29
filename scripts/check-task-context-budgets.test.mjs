import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { extractStep, measureRoutes, ROUTES } from './check-task-context-budgets.mjs';

test('discovery transcript selects whole task words with original line numbers', () => {
  const step = ROUTES.find((route) => route.id === 'component-discovery').steps[1];
  const index = 'stable component\nData grid\nA tabular table\n';
  assert.equal(extractStep(index, step), '2:Data grid\n3:A tabular table\n');
  assert.throws(() => extractStep('stable component\n', step), /search returned no matches/u);
});

test('a focused section ends at the next peer heading and fails on missing or duplicated anchors', () => {
  const step = ROUTES.find((route) => route.id === 'look-composition').steps[1];
  const section = '### Composing looks, surfaces and density\nBody\n#### Detail\nMore\n';
  assert.equal(extractStep(`## Earlier\n${section}### Other\nLater\n`, step), section);
  assert.throws(() => extractStep('### Other\n', step), /expected one heading.*found 0/u);
  assert.throws(() => extractStep(section + section, step), /expected one heading.*found 2/u);
});

test('byte ceilings use the exact delivered wrapper and fail closed on drift', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'lyra-task-context-'));
  try {
    mkdirSync(path.join(directory, 'llms'));
    writeFileSync(path.join(directory, 'llms', 'probe.md'), 'Café\n');
    const routes = [{ id: 'probe', steps: [{ path: 'llms/probe.md', kind: 'full', label: 'probe API' }] }];
    const delivered = '[[llms/probe.md :: probe API]]\nCafé\n\n';
    const bytes = Buffer.byteLength(delivered, 'utf8');
    const config = { schemaVersion: 1, reviewedBasis: {}, routes: { probe: { ceilingUtf8Bytes: bytes } } };
    const result = measureRoutes(directory, routes, config);
    assert.equal(result.transcripts.get('probe'), delivered);
    assert.equal(result.receipt.routes.probe.utf8Bytes, bytes);
    assert.throws(() => measureRoutes(directory, routes, {
      ...config, routes: { probe: { ceilingUtf8Bytes: bytes - 1 } },
    }), /exceed reviewed ceiling/u);
    assert.throws(() => measureRoutes(directory, routes, { ...config, routes: {} }),
      /cover exactly the reviewed task routes/u);
    writeFileSync(path.join(directory, 'llms', 'probe.md'),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Café\n')]));
    const withBom = measureRoutes(directory, routes, {
      ...config, routes: { probe: { ceilingUtf8Bytes: bytes + 3 } },
    });
    assert.equal(withBom.transcripts.get('probe'), '[[llms/probe.md :: probe API]]\n\uFEFFCafé\n\n');
    assert.equal(withBom.receipt.routes.probe.utf8Bytes, bytes + 3);
    writeFileSync(path.join(directory, 'llms', 'probe.md'), Buffer.from([0xff]));
    assert.throws(() => measureRoutes(directory, routes, config), /valid for encoding utf-8|encoded data was not valid/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
