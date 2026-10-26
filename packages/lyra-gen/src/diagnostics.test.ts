import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LYRA_GEN_FAILURE_CATEGORIES, notifyFailureCategories, summarizeFailureCategories } from './diagnostics.js';
import type { LyraGenDiagnostic } from './types.js';
const diagnostic = (code: string): LyraGenDiagnostic => ({ code, path: '/private-value', message: 'sensitive message', severity: 'error', hint: 'sensitive hint', source: { start: 1, end: 2 } });

test('taxonomy maps known failures to stable categories and never copies diagnostic payloads', () => {
  const codes = ['schema.enum', 'identity.duplicate', 'security.prototype', 'source.bytes', 'view.catalog', 'a11y.name', 'json.duplicate-key', 'revision.conflict', 'unrecognized-sensitive-code'];
  const categories = summarizeFailureCategories(codes.map(diagnostic));
  assert.deepEqual(categories, LYRA_GEN_FAILURE_CATEGORIES);
  assert.equal(Object.isFrozen(categories), true);
  assert.equal(JSON.stringify(categories).includes('sensitive'), false);
  assert.equal(JSON.stringify(categories).includes('private-value'), false);
  assert.deepEqual(summarizeFailureCategories([...codes.reverse(), 'schema.enum'].map(diagnostic)), categories);
});

test('disabled, successful and throwing callbacks leave diagnostics unchanged and perform no network access', () => {
  const diagnostics = Object.freeze([Object.freeze(diagnostic('schema.type'))]);
  const before = JSON.stringify(diagnostics);
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = () => { networkCalls++; throw new Error('Unexpected network call'); };
  try {
    assert.equal(notifyFailureCategories(diagnostics), undefined);
    let observed: readonly string[] | undefined;
    assert.equal(notifyFailureCategories(diagnostics, value => { observed = value; }), undefined);
    assert.deepEqual(observed, ['validation']);
    assert.doesNotThrow(() => notifyFailureCategories(diagnostics, () => { throw new Error('observer failure'); }));
    assert.equal(JSON.stringify(diagnostics), before);
    assert.equal(networkCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('diagnostic getters are never invoked and category output is bounded', () => {
  let invoked = false;
  const item = Object.defineProperty({}, 'code', { enumerable: true, get() { invoked = true; return 'secret'; } }) as LyraGenDiagnostic;
  assert.deepEqual(summarizeFailureCategories([item]), ['internal']);
  notifyFailureCategories([item]);
  assert.equal(invoked, false);
  const categories = summarizeFailureCategories(Array.from({ length: 1000 }, () => diagnostic('schema.enum')));
  assert.deepEqual(categories, ['budget', 'validation']);
  assert.deepEqual(summarizeFailureCategories([]), []);
});

test('asynchronous observer rejection is isolated without waiting for it', async () => {
  notifyFailureCategories([diagnostic('schema.type')], async () => { throw new Error('async observer failure'); });
  await new Promise<void>(resolve => setTimeout(resolve, 0));
});
