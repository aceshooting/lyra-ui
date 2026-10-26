import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

test('declared stable inventory references existing executable cases and preserves unsupported scope', () => {
  const inventory = read('docs/a2ui-coverage.json');
  assert.equal(inventory.revision, read('test/fixtures/a2ui/v0.9.1/provenance.json').revision);
  assert.equal(new Set(inventory.areas.map(area => area.id)).size, inventory.areas.length);
  for (const area of inventory.areas) {
    assert.ok(area.scope && area.kind);
    for (const file of [...(area.fixtures ?? []), ...(area.runner ? [area.runner] : [])]) assert.ok(existsSync(resolve(root, file)), file);
    for (const { file, title } of area.tests ?? []) assert.ok(readFileSync(resolve(root, file), 'utf8').includes(title), `${file}: ${title}`);
  }
  for (const { test: evidence } of inventory.unsupported) assert.ok(readFileSync(resolve(root, evidence.file), 'utf8').includes(evidence.title));
  assert.equal(inventory.unsupported.length >= 3, true);
});

test('retained DOM report covers the declared real engines, examples, viewports and lifetime steps', () => {
  const report = read('test/fixtures/a2ui/dom/results.json');
  assert.equal(report.revision, read('docs/a2ui-coverage.json').revision);
  assert.equal(report.harnessSha256, createHash('sha256').update(readFileSync(resolve(root, 'scripts/compare-a2ui-dom.mjs'))).digest('hex'));
  assert.deepEqual(report.browsers.map(browser => browser.engine), ['chromium', 'firefox', 'webkit']);
  assert.equal(report.limitations.length >= 3, true);
  for (const browser of report.browsers) {
    assert.ok(browser.version);
    assert.equal(browser.examples.length, 6);
    assert.equal(new Set(browser.examples.map(entry => `${entry.file}/${entry.viewportWidth}`)).size, 6);
    for (const entry of browser.examples) {
      assert.equal(entry.result, 'declared-checks-pass');
      assert.equal(entry.wireVersion, 'v0.9');
      assert.equal(entry.fixtureSha256, createHash('sha256').update(readFileSync(resolve(root, 'test/fixtures/a2ui/v0.9.1', entry.file))).digest('hex'));
      assert.ok([320, 800].includes(entry.viewportWidth));
      assert.ok(entry.initial.reference.length && entry.initial.lyra.length && entry.updated.reference.length && entry.updated.lyra.length);
      assert.deepEqual(entry.deleted.reference, []);
      if (entry.file.includes('button')) assert.deepEqual(entry.actions.reference, entry.actions.lyra);
    }
  }
});
