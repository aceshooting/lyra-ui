import assert from 'node:assert/strict';
import test from 'node:test';
import type { OoxmlPackage } from '@docx-editor.dev/core/store';
const store = await import('@docx-editor.dev/core/store');
import { docxFixture, relationship } from '../../test/admission-fixtures.js';
import { decodePort, insertionFixture as fixture, insertionSource as input, valid } from '../../test/image-preflight-harness.js';
import { preflightImageInsertion } from './eigenpal-image-insertion.js';
import { qualifyImageInsertionPackage } from './eigenpal-image-insertion-profile.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

type Harness = ReturnType<typeof fixture>;
const stale = (code: DocxRefusalCode = 'stale-selection'): DocxResult<void> => ({ ok: false, code });

/** Counts the isolated work a preflight performs; any piece can be replaced. */
function observed(h: Harness, replace: { store?: typeof store.TreePackageStore; write?: typeof store.writeOoxmlPackage; readZip?: typeof store.readZip } = {}) {
  const counts = { constructed: 0, written: 0, zipReads: 0 };
  class Candidate extends (replace.store ?? store.TreePackageStore) {
    constructor(...args: ConstructorParameters<typeof store.TreePackageStore>) { counts.constructed++; super(...args); }
  }
  const dependencies = { ...h.dependencies, TreePackageStore: Candidate,
    writeOoxmlPackage: (pkg: OoxmlPackage) => { counts.written++; return (replace.write ?? store.writeOoxmlPackage)(pkg); },
    readZip: (...args: Parameters<typeof store.readZip>) => { counts.zipReads++; return (replace.readZip ?? store.readZip)(...args); } };
  return { counts, dependencies };
}

test('insertion preflight returns the first owner refusal before qualifying, allocating or serializing', async () => {
  for (const [label, failFrom] of [['before qualification', 1], ['after qualification', 2]] as const) {
    const h = fixture(), seen = observed(h); let checks = 0;
    const result = await preflightImageInsertion(h.pkg, h.target, input(), seen.dependencies, decodePort, () => ++checks >= failFrom ? stale('destroyed') : valid(), h.signal);
    assert.deepEqual(result, { ok: false, code: 'destroyed' }, label);
    assert.equal(checks, failFrom, label); assert.deepEqual(seen.counts, { constructed: 0, written: 0, zipReads: 0 }, label);
  }
});

test('insertion preflight prefers an owner refusal to an abort and reports an abort at every later point', async () => {
  const h = fixture(), seen = observed(h), aborted = new AbortController(); aborted.abort();
  assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, input(), seen.dependencies, decodePort, valid, aborted.signal), { ok: false, code: 'aborted' });
  assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, input(), seen.dependencies, decodePort, () => stale(), aborted.signal), { ok: false, code: 'stale-selection' });
  assert.deepEqual(seen.counts, { constructed: 0, written: 0, zipReads: 0 });
  const during = new AbortController();
  assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, input(), seen.dependencies,
    { async decode() { during.abort(); return decodePort.decode(); } }, valid, during.signal), { ok: false, code: 'aborted' });
  assert.equal(seen.counts.written, 0);
});

test('insertion preflight maps engine refusals onto resource, document and engine failures', async () => {
  const outcomes = [
    ['a resource refusal', { ok: false, reason: 'resource-limit' }, 'resource-limit'],
    ['any other refusal', { ok: false, reason: 'unknown-paragraph' }, 'invalid-document'],
    ['a transaction that changed nothing', { ok: true, change: null }, 'engine-failed'],
  ] as const;
  for (const [label, outcome, code] of outcomes) {
    class Refusing extends store.TreePackageStore { override async insertImage() { return outcome; } }
    const h = fixture(), seen = observed(h, { store: Refusing });
    assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, input(), seen.dependencies, decodePort, valid, h.signal), { ok: false, code }, label);
    assert.deepEqual(seen.counts, { constructed: 1, written: 0, zipReads: 0 }, label);
  }
});

test('insertion preflight returns an owner refusal that arrives after serialization, admission or archive reading', async () => {
  for (const checkpoint of ['serialization', 'admission', 'archive'] as const) {
    const h = fixture(); let revoked = false, signalReads = 0;
    // The abort flag is only read here by admission, once the owner has already been refused.
    const signal = new AbortController().signal;
    Object.defineProperty(signal, 'aborted', { get() { if (revoked) signalReads++; return false; } });
    const seen = observed(h, {
      write: pkg => {
        const bytes = store.writeOoxmlPackage(pkg);
        if (checkpoint === 'serialization') revoked = true;
        if (checkpoint === 'admission') queueMicrotask(() => { revoked = true; });
        return bytes;
      },
      readZip: (...args) => { const result = store.readZip(...args); if (checkpoint === 'archive') revoked = true; return result; },
    });
    const result = await preflightImageInsertion(h.pkg, h.target, input(), seen.dependencies, decodePort, () => revoked ? stale() : valid(), signal);
    assert.deepEqual(result, { ok: false, code: 'stale-selection' }, checkpoint);
    assert.equal(seen.counts.zipReads, checkpoint === 'archive' ? 1 : 0, checkpoint);
    if (checkpoint === 'serialization') assert.equal(signalReads, 0, 'a refused owner never reaches admission');
  }
});

test('insertion preflight refuses an archive beyond the profiled bound before admission and passes admission refusals through', async () => {
  const h = fixture(), source = input();
  const bound = qualifyImageInsertionPackage(h.pkg, h.target, { mediaBytes: source.bytes.length, pixelWidth: source.metadata.pixelWidth,
    pixelHeight: source.metadata.pixelHeight, titleLength: source.title.length, descriptionLength: source.description.length }, h.dependencies);
  assert(bound.ok); const limit = bound.value.upperZipBytes;
  const external = docxFixture({ 'word/_rels/document.xml.rels': relationship('https://example.test/object', 'oleObject') });
  assert(external.length < limit);
  for (const [label, bytes, code] of [
    ['one byte over the bound', new Uint8Array(limit + 1), 'resource-limit'],
    ['exactly the bound', new Uint8Array(limit), 'invalid-document'],
    ['not an archive', Uint8Array.of(1, 2, 3), 'invalid-document'],
    ['an archive with an external object', external, 'external-resource'],
  ] as const) {
    const seen = observed(h, { write: () => bytes });
    assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, source, seen.dependencies, decodePort, valid, h.signal), { ok: false, code }, label);
    assert.equal(seen.counts.zipReads, 0, label);
  }
});

test('insertion preflight maps archive reader refusals onto resource and document failures', async () => {
  for (const [reason, code] of [['too-large', 'resource-limit'], ['too-many-entries', 'resource-limit'], ['bad-name', 'invalid-document'], ['inflate-error', 'invalid-document']] as const) {
    const h = fixture(), seen = observed(h, { readZip: (() => ({ ok: false, reason })) as typeof store.readZip });
    assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, input(), seen.dependencies, decodePort, valid, h.signal), { ok: false, code }, reason);
  }
});
