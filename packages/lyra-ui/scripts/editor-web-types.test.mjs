#!/usr/bin/env node
// Guards the web-types projection against the exact regression that shipped 284 attributes-only
// tags: `custom-elements.json` documented 1029 events, 3102 public fields and 445 slots that
// `web-types.json` never mentioned, so JetBrains completion covered only the minority (attribute)
// binding style while every `.property=` and `@event=` binding -- the idiomatic Lit spelling --
// resolved to nothing. The completeness assertions below run against the real manifest, so a new
// element (or a new member on an existing one) cannot silently ship without its projection.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  elementEvents,
  elementProperties,
  elementSlots,
  isEditorProperty,
  webTypesElementContributions,
} from './editor-web-types.mjs';
import { expandManifestInheritance } from './manifest-compact.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

for (const name of ['vscode-html-data.json', 'vscode-css-data.json', 'web-types.json']) {
  const serialized = readFileSync(join(packageDir, name), 'utf8');
  assert.equal(
    serialized,
    `${JSON.stringify(JSON.parse(serialized))}\n`,
    `${name} remains deterministically compact in the published package`,
  );
}

// --- unit coverage over a synthetic declaration --------------------------------------------------

const synthetic = {
  kind: 'class',
  customElement: true,
  tagName: 'lr-example',
  members: [
    {
      kind: 'field',
      name: 'datasets',
      type: { text: 'readonly ExampleDataset[]' },
      default: '[]',
      description: 'Series rendered by the chart.\n\nSecond paragraph.',
    },
    {
      kind: 'field',
      name: 'labelText',
      type: { text: 'string' },
      default: "''",
      attribute: 'label-text',
      reflects: true,
      privacy: 'public',
      description: 'Accessible label.',
    },
    {
      kind: 'field',
      name: 'resolved',
      type: { text: 'number' },
      readonly: true,
      description: 'Resolved size.',
    },
    {
      kind: 'field',
      name: 'autoWidth',
      type: { text: 'boolean' },
      deprecated: 'Use `canvas="auto"` instead.',
      deprecation: {
        kind: 'property',
        name: 'autoWidth',
        since: '8.0.0',
        replacement: { kind: 'property', name: 'canvas', usage: 'canvas="auto"' },
        removalNotBefore: '10.0.0',
        rationale: 'Superseded by canvas.',
      },
      description: 'Legacy sizing switch.',
    },
    { kind: 'field', name: 'formAssociated', type: { text: 'boolean' }, static: true },
    { kind: 'field', name: 'internals', type: { text: 'ElementInternals' }, privacy: 'private' },
    { kind: 'method', name: 'focusCell', description: 'Focuses a cell.' },
  ],
  events: [
    {
      name: 'lr-cell-click',
      type: { text: 'CustomEvent<LyraExampleCellClickDetail>' },
      description: 'Fired on cell activation.',
    },
    { name: 'lr-change' },
  ],
  slots: [
    { name: '', description: 'Default content.' },
    { name: 'header', description: 'Header content.' },
  ],
};

const properties = elementProperties(synthetic);
assert.deepEqual(
  properties.map(({ name }) => name),
  ['datasets', 'labelText', 'resolved', 'autoWidth'],
  'static, private and method members are not JS properties',
);

const datasets = properties[0];
assert.equal(datasets.type, 'readonly ExampleDataset[]');
assert.equal(datasets.default, '[]');
assert.equal(datasets.description, 'Series rendered by the chart.\n\nSecond paragraph.');
assert.ok(!Object.hasOwn(datasets, 'read-only'), 'a writable property carries no read-only flag');

const labelText = properties[1];
assert.match(labelText.description, /^Accessible label\./);
assert.match(labelText.description, /Attribute: `label-text`/);
assert.match(labelText.description, /Reflected to its attribute\./);

assert.equal(properties[2]['read-only'], true);

const autoWidth = properties[3];
assert.equal(autoWidth.deprecated, 'Use `canvas="auto"` instead.');
assert.match(autoWidth.description, /Deprecated since `8\.0\.0`/);
assert.match(autoWidth.description, /Removal is not permitted before `10\.0\.0`/);

assert.deepEqual(elementEvents(synthetic), [
  {
    name: 'lr-cell-click',
    description: 'Fired on cell activation.',
    type: 'CustomEvent<LyraExampleCellClickDetail>',
  },
  { name: 'lr-change' },
]);

assert.deepEqual(elementSlots(synthetic), [
  { name: '', description: 'Default content.' },
  { name: 'header', description: 'Header content.' },
]);

const contributions = webTypesElementContributions(synthetic);
assert.deepEqual(Object.keys(contributions), ['slots', 'js']);
assert.deepEqual(Object.keys(contributions.js), ['properties', 'events']);
assert.equal(contributions.js.properties.length, 4);

assert.deepEqual(
  webTypesElementContributions({ tagName: 'lr-bare' }),
  {},
  'an element with no members, events or slots contributes no empty containers',
);

assert.equal(isEditorProperty({ kind: 'field', name: 'value' }), true);
assert.equal(isEditorProperty({ kind: 'field', name: 'value', privacy: 'protected' }), false);
assert.equal(isEditorProperty({ kind: 'field', name: 'value', static: true }), false);
assert.equal(isEditorProperty({ kind: 'method', name: 'focus' }), false);

// --- completeness against the shipped manifest ---------------------------------------------------

const manifest = expandManifestInheritance(
  JSON.parse(readFileSync(join(packageDir, 'custom-elements.json'), 'utf8')),
);
const declarations = [];
for (const module of manifest.modules ?? []) {
  for (const declaration of module.declarations ?? []) {
    if (declaration.kind === 'class' && declaration.customElement === true && declaration.tagName) {
      declarations.push(declaration);
    }
  }
}
assert.ok(declarations.length > 250, 'the manifest still describes the full component inventory');

let projectedProperties = 0;
let projectedEvents = 0;
let projectedSlots = 0;
let tagsWithProperties = 0;
let tagsWithEvents = 0;
let tagsWithSlots = 0;

for (const declaration of declarations) {
  const projection = webTypesElementContributions(declaration);
  const expectedProperties = (declaration.members ?? [])
    .filter((member) => member.kind === 'field' && !member.static &&
      (member.privacy === undefined || member.privacy === 'public'))
    .map(({ name }) => name);
  const expectedEvents = (declaration.events ?? []).map(({ name }) => name);
  const expectedSlots = (declaration.slots ?? []).map(({ name }) => name);

  assert.deepEqual(
    projection.js?.properties?.map(({ name }) => name) ?? [],
    expectedProperties,
    `${declaration.tagName} projects every public instance field to js/properties`,
  );
  assert.deepEqual(
    projection.js?.events?.map(({ name }) => name) ?? [],
    expectedEvents,
    `${declaration.tagName} projects every declared event to js/events`,
  );
  assert.deepEqual(
    projection.slots?.map(({ name }) => name) ?? [],
    expectedSlots,
    `${declaration.tagName} projects every declared slot`,
  );

  for (const property of projection.js?.properties ?? []) {
    assert.equal(
      typeof property.type,
      'string',
      `${declaration.tagName}.${property.name} carries its manifest type text`,
    );
  }
  for (const member of declaration.members ?? []) {
    if (!isEditorProperty(member) || !member.description) continue;
    const property = projection.js.properties.find(({ name }) => name === member.name);
    assert.ok(
      property.description?.includes(member.description),
      `${declaration.tagName}.${member.name} carries its manifest description`,
    );
  }
  for (const event of declaration.events ?? []) {
    const projected = projection.js.events.find(({ name }) => name === event.name);
    if (event.description) assert.equal(projected.description, event.description);
    if (event.type?.text) assert.equal(projected.type, event.type.text);
  }
  for (const slot of declaration.slots ?? []) {
    const projected = projection.slots.find(({ name }) => name === slot.name);
    if (slot.description) assert.equal(projected.description, slot.description);
  }

  projectedProperties += projection.js?.properties?.length ?? 0;
  projectedEvents += projection.js?.events?.length ?? 0;
  projectedSlots += projection.slots?.length ?? 0;
  if (projection.js?.properties?.length) tagsWithProperties += 1;
  if (projection.js?.events?.length) tagsWithEvents += 1;
  if (projection.slots?.length) tagsWithSlots += 1;
}

assert.ok(projectedProperties > 3000, `expected the full field inventory, got ${projectedProperties}`);
assert.ok(projectedEvents > 1000, `expected the full event inventory, got ${projectedEvents}`);
assert.ok(projectedSlots > 400, `expected the full slot inventory, got ${projectedSlots}`);
assert.equal(tagsWithProperties, declarations.length, 'every element contributes JS properties');
assert.ok(tagsWithEvents > 200, `expected most elements to contribute events, got ${tagsWithEvents}`);
assert.ok(tagsWithSlots > 150, `expected most elements to contribute slots, got ${tagsWithSlots}`);

// The attribute-less fields are the ones the projection exists for: `lr-chart.datasets` and friends
// are the primary API of their components and have no attribute contribution to fall back on.
const attributeless = declarations.flatMap((declaration) =>
  (declaration.members ?? [])
    .filter((member) => isEditorProperty(member) && !member.attribute)
    .map((member) => `${declaration.tagName}.${member.name}`));
assert.ok(
  attributeless.length > 800,
  `expected the attribute-less field inventory, got ${attributeless.length}`,
);
for (const expected of ['lr-chart.datasets', 'lr-chart.labels', 'lr-heatmap.legendStops']) {
  assert.ok(attributeless.includes(expected), `${expected} is projected as a JS property`);
}

console.log(
  `web-types projection tests passed: ${projectedProperties} properties, ${projectedEvents} events, ` +
    `${projectedSlots} slots across ${declarations.length} tags.`,
);
