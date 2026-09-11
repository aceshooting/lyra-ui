import assert from 'node:assert/strict';
import { publicStorybookManifest } from '../../../.storybook/storybook-manifest.js';
import { createManifestInheritanceFixture } from './fixtures/manifest-inheritance.mjs';
import { compactManifest, expandManifestInheritance } from './manifest-compact.mjs';

const fixture = createManifestInheritanceFixture();

const compact = compactManifest(fixture);
const base = compact.modules[0].declarations[0];
const child = compact.modules[1].declarations[0];
const mixed = compact.modules[2].declarations[0];
assert.deepEqual(base.members.map(({ name }) => name), ['locale', 'setRangeText', 'setRangeText']);
assert.equal(
  compact.modules.some((module) => module.declarations.some((declaration) =>
    declaration.members?.some((member) => member.name === 'defaultStrings'))),
  false,
  'generated protected component-default catalogs must not enter the published CEM surface',
);
assert.deepEqual(child.members.map(({ name }) => name), ['value', 'setRangeText']);
assert.deepEqual(child.attributes.map(({ name }) => name), ['value']);
assert.deepEqual(child.slots.map(({ name }) => name), ['', 'label']);
assert.equal(child.slots.find(({ name }) => name === 'label').description, 'The child-specific label.');
assert.deepEqual(child.cssProperties.map(({ name }) => name), ['--lr-fixture-base-color', '--lr-fixture-child-color']);
assert.equal(child.cssProperties[0].default, 'blue');
// Unlike members/attributes/events/slots/cssProperties, cssParts are never pruned back off a
// resolvable subclass: `::part()` consumers (docs generators, editor tooling, ::part() lint
// checks) look a tag's parts up per element and do not walk the JS superclass chain the way a
// TypeScript consumer naturally does for the JS-facing surfaces. This mirrors how `cssStates` --
// never listed in `INHERITABLE_ARRAYS` at all -- already survives compaction unpruned.
assert.deepEqual(child.cssParts.map(({ name }) => name), ['base', 'control']);
assert.deepEqual(mixed.members.map(({ name }) => name), ['mixedValue']);
assert.deepEqual(compactManifest(compact), compact, 'compaction must be idempotent');

const expanded = expandManifestInheritance(compact);
assert.deepEqual(
  expanded.modules[1].declarations[0].members.map(({ name }) => name),
  ['locale', 'setRangeText', 'setRangeText', 'value'],
);
assert.equal(
  expanded.modules[1].declarations[0].members.filter(({ name }) => name === 'setRangeText').length,
  2,
  'an own overload replaces only its matching inherited signature without collapsing siblings',
);
assert.deepEqual(expanded.modules[1].declarations[0].attributes.map(({ name }) => name), ['locale', 'value']);
assert.deepEqual(
  expanded.modules[1].declarations[0].events.map(({ name }) => name),
  ['lr-change', 'lr-ready'],
);
assert.deepEqual(
  expanded.modules[1].declarations[0].slots.map(({ name }) => name),
  ['', 'label'],
);
assert.equal(
  expanded.modules[1].declarations[0].slots.find(({ name }) => name === 'label').description,
  'The child-specific label.',
);
assert.deepEqual(
  expanded.modules[1].declarations[0].cssParts.map(({ name }) => name),
  ['base', 'control'],
);
assert.deepEqual(
  expanded.modules[1].declarations[0].cssProperties.map(({ name }) => name),
  ['--lr-fixture-base-color', '--lr-fixture-child-color'],
);
assert.equal(expanded.modules[1].declarations[0].cssProperties[0].default, 'blue');
assert.deepEqual(expanded.modules[2].declarations[0].members.map(({ name }) => name), ['mixedValue']);

const storybook = publicStorybookManifest(compact);
const storybookChild = storybook.modules[1].declarations[0];
assert.deepEqual(
  storybookChild.members.map(({ name }) => name),
  ['locale', 'setRangeText', 'setRangeText', 'value'],
  'Storybook autodocs must receive inherited public members and every method overload',
);
assert.deepEqual(storybookChild.events.map(({ name }) => name), ['lr-change', 'lr-ready']);
assert.deepEqual(storybookChild.slots.map(({ name }) => name), ['', 'label']);
assert.deepEqual(storybookChild.cssParts.map(({ name }) => name), ['base', 'control']);
assert.deepEqual(
  storybookChild.cssProperties.map(({ name }) => name),
  ['--lr-fixture-base-color', '--lr-fixture-child-color'],
);

// A subclass that re-types an inherited member is an override, not a redundant inherited copy.
// Before `type` joined SUBCLASS_ANNOTATION_KEYS this entry was pruned, so the published manifest
// reported the BASE type text plus a false `inheritedFrom` -- and that text is what the generated
// reference, the editor data and the React/Vue/Svelte declarations all read.
{
  const retyped = {
    schemaVersion: '2.1.0',
    modules: [
      {
        kind: 'javascript-module',
        path: 'base.js',
        declarations: [
          {
            kind: 'class',
            name: 'FixtureBase',
            members: [
              {
                kind: 'field',
                name: 'languages',
                privacy: 'public',
                type: { text: 'Readonly<Record<string, unknown>> | undefined' },
              },
            ],
          },
        ],
      },
      {
        kind: 'javascript-module',
        path: 'child.js',
        declarations: [
          {
            kind: 'class',
            name: 'FixtureChild',
            superclass: { name: 'FixtureBase', module: 'base.js' },
            members: [
              {
                kind: 'field',
                name: 'languages',
                privacy: 'public',
                // `type` is the ONLY field that differs from the base entry. Every other
                // annotation is identical on purpose: if this fixture also varied `default` or
                // `description`, the override would survive through one of the pre-existing keys
                // and the assertion below would pass even with `type` absent from
                // SUBCLASS_ANNOTATION_KEYS -- proving nothing.
                type: { text: 'Readonly<Record<string, unknown>>' },
                inheritedFrom: { name: 'FixtureBase', module: 'base.js' },
              },
            ],
          },
        ],
      },
    ],
  };

  const compactRetyped = compactManifest(retyped);
  const childMember = compactRetyped.modules[1].declarations[0].members?.find(
    ({ name }) => name === 'languages',
  );
  assert.ok(
    childMember,
    'a subclass that narrows an inherited member type must survive compaction, not be pruned as an inherited copy',
  );
  assert.equal(
    childMember.type.text,
    'Readonly<Record<string, unknown>>',
    'the retained override must carry the subclass type, not the base type',
  );

  const expandedRetyped = expandManifestInheritance(compactRetyped);
  assert.equal(
    expandedRetyped.modules[1].declarations[0].members.find(({ name }) => name === 'languages').type
      .text,
    'Readonly<Record<string, unknown>>',
    'expansion must let the subclass type win over the inherited one',
  );
}

console.log('manifest compaction and inheritance expansion tests passed.');
