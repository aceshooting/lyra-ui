import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMemberVocabulary, vocabularyDescription } from './manifest-member-vocabulary.mjs';

const manifestOf = (declaration) => ({ modules: [{ path: 'src/x.ts', declarations: [declaration] }] });

test('fills native members and copies the description onto the backing attribute', () => {
  const declaration = {
    kind: 'class',
    name: 'X',
    members: [
      { kind: 'field', name: 'willValidate' },
      { kind: 'field', name: 'disabled', attribute: 'disabled' },
      { kind: 'method', name: 'formResetCallback' },
      { kind: 'field', name: 'inputMode', attribute: 'inputmode' },
    ],
    attributes: [{ name: 'disabled', fieldName: 'disabled' }, { name: 'inputmode', fieldName: 'inputMode' }],
  };
  applyMemberVocabulary(manifestOf(declaration));
  for (const member of declaration.members) assert.ok(member.description, member.name);
  for (const attribute of declaration.attributes) assert.ok(attribute.description, attribute.name);
});

test('never overrides authored JSDoc', () => {
  const declaration = {
    kind: 'class',
    name: 'X',
    members: [{ kind: 'method', name: 'focus', description: 'Focuses the first chip.' }],
  };
  applyMemberVocabulary(manifestOf(declaration));
  assert.equal(declaration.members[0].description, 'Focuses the first chip.');
});

test('component-defined names stay undescribed so the coverage check reports them', () => {
  const plain = { kind: 'class', name: 'X', members: [] };
  assert.equal(vocabularyDescription(plain, { kind: 'field', name: 'disabled' }), undefined);
  assert.equal(vocabularyDescription(plain, { kind: 'field', name: 'value' }), undefined);
  assert.equal(vocabularyDescription(plain, { kind: 'field', name: 'label' }), undefined);
  // `labels` is chart data, not the native NodeList, on a form-associated chart-like element.
  const formAssociated = { kind: 'class', name: 'X', members: [{ kind: 'field', name: 'willValidate' }] };
  assert.equal(
    vocabularyDescription(formAssociated, { kind: 'field', name: 'labels', type: { text: 'string[]' } }),
    undefined,
  );
  assert.equal(vocabularyDescription(plain, { kind: 'field', name: 'focus', privacy: 'private' }), undefined);
});

test('slot-backed chrome is filled only where the matching slot exists', () => {
  const withSlot = { kind: 'class', name: 'X', members: [], slots: [{ name: 'hint' }] };
  const without = { kind: 'class', name: 'X', members: [], slots: [] };
  assert.ok(vocabularyDescription(withSlot, { kind: 'field', name: 'hint' }));
  assert.equal(vocabularyDescription(without, { kind: 'field', name: 'hint' }), undefined);
});
