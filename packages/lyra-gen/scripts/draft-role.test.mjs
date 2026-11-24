import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMember, draftRole, literalUnion } from './draft-role.mjs';

const aliases = new Map([['Shape', "'radial' | 'ring'"], ['Size', 'Step | Alias'], ['Step', "'s' | 'm'"], ['Alias', "'small'"]]);

test('literal unions resolve through nested aliases and ignore nullish members', () => {
  assert.deepEqual(literalUnion('Shape | undefined', aliases), ['radial', 'ring']);
  assert.deepEqual(literalUnion('Size', aliases), ['s', 'm', 'small']);
  assert.equal(literalUnion('Shape | number', aliases), undefined);
  assert.equal(literalUnion('Unknown', aliases), undefined);
});

test('members are bounded, or listed for review instead of exposed', () => {
  assert.deepEqual(classifyMember({ name: 'label', type: { text: 'string' } }, aliases), { schema: 'label' });
  assert.deepEqual(classifyMember({ name: 'description', type: { text: 'string | null' } }, aliases), { schema: 'string(1024)' });
  assert.equal(classifyMember({ name: 'max', type: { text: 'number' } }, aliases).schema, 'number');
  assert.deepEqual(classifyMember({ name: 'shape', type: { text: 'Shape' } }, aliases), { schema: "choice('radial', 'ring')" });
  for (const member of [
    { name: 'href', type: { text: 'string' } },
    { name: 'imageSrc', type: { text: 'string' } },
    { name: 'image', type: { text: 'string' } },
    { name: 'valueFormatter', type: { text: '(value: number) => string' } },
    { name: 'anchor', type: { text: 'HTMLElement | null' } },
    { name: 'stages', type: { text: 'readonly Stage[]' } },
    { name: 'config', type: { text: 'ChartConfig' } },
  ]) assert.ok(classifyMember(member, aliases).review, member.name);
});

test('drafting a published tag yields a reviewable overlay and never registers it', () => {
  const draft = draftRole('lr-gauge');
  assert.equal(draft.role, 'gauge');
  assert.match(draft.source, /tag: 'lr-gauge'/u);
  assert.match(draft.source, /shape: choice\('radial', 'ring', 'linear'\)/u);
  assert.match(draft.source, /accessibleName: \{ required: true, properties: \['label'\] \}/u);
  assert.ok(draft.properties.includes('value: number'));
  assert.ok(draft.review.some(entry => entry.startsWith('thresholds:')));
  assert.throws(() => draftRole('lr-not-a-component'), /Unknown published tag/u);
});
