import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { createCatalog, initialCatalog } from './catalog.js';
import { validateNavigationDestination } from './content-policy.js';
import { validateView } from './runtime.js';
import type { LyraGenNode } from './types.js';

test('accepted destinations always have the exact host-approved origin and no credentials', () => {
  fc.assert(fc.property(fc.oneof(fc.string(), fc.stringMatching(/^[a-zA-Z0-9/_-]{0,80}$/u).map(path => `https://media.example/${path}`)), input => {
    const checked = validateNavigationDestination(input, { origins: ['https://media.example'] });
    if (!checked.ok) return;
    const parsed = new URL(checked.value);
    assert.equal(parsed.origin, 'https://media.example');
    assert.equal(parsed.protocol, 'https:');
    assert.equal(parsed.username, '');
    assert.equal(parsed.password, '');
  }), propertyRuns());
});

test('generated field labels cannot change an approved sensitive declaration', () => {
  const node: LyraGenNode = { id: 'field', type: 'input', props: { label: 'Approved code' } };
  const catalog = createCatalog({ id: 'fields', version: '1', components: { input: { ...initialCatalog.components['input']!, fieldPurpose: 'one-time-code' } }, fieldPolicy: { approvedFields: [{ surfaceId: 'surface', node, purpose: 'one-time-code', allowSensitive: true }] } });
  fc.assert(fc.property(fc.string({ maxLength: 256 }), label => {
    const result = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 0, root: { ...node, props: { label } } }, catalog);
    assert.equal(result.ok, label === 'Approved code');
  }), propertyRuns());
});

test('every generated foreign subdomain stays outside an exact media origin grant', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-z]{1,20}$/u), subdomain => {
    assert.equal(validateNavigationDestination(`https://${subdomain}.media.example/image`, { origins: ['https://media.example'] }).ok, false);
  }), propertyRuns());
});
