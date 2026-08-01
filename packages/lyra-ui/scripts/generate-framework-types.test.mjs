#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFrameworkTypes } from './generate-framework-types.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(path.join(scriptsDir, 'fixtures', 'framework-types-manifest.json'), 'utf8'),
);

const generated = generateFrameworkTypes(fixture);
assert.deepEqual([...generated.keys()], [
  'src/custom-elements-jsx.ts',
  'src/svelte.ts',
  'src/vue.ts',
]);

const react = generated.get('src/custom-elements-jsx.ts');
assert.match(
  react,
  /import type \{ [^}]*LyraSampleField[^}]*LyraSampleFieldEventMap[^}]* \} from '\.\/components\/forms\/sample-field\/sample-field\.class\.js';/,
);
assert.match(react, /export interface LyraReactIntrinsicElements/);
assert.match(react, /export type LyraSampleFieldReactProps = LyraReactElementProps</);
assert.match(react, /'lr-sample-field': LyraSampleFieldReactProps/);
assert.match(react, /LyraSampleField,[\s\S]*'accessibleLabel'[\s\S]*'disabled'[\s\S]*'value'/);
assert.doesNotMatch(react, /formAssociated|effectiveLocale|internalRows|computedRows/);
assert.match(react, /'aria-label'\?: LyraSampleField\['accessibleLabel'\]/);
assert.match(react, /'icon-only'\?: LyraUnknownAttributeValue/);
assert.match(react, /'lr-change'/);
assert.match(react, /'--lr-sample-field-width'/);
assert.match(react, /React\.RefAttributes<ElementType>/);
assert.match(react, /LyraSampleFieldEventMap,/);
assert.match(react, /declare module 'react'/);

const vue = generated.get('src/vue.ts');
assert.match(vue, /export interface LyraVueGlobalComponents/);
assert.match(vue, /export type LyraSampleTableVueProps = LyraVueCustomElement</);
assert.match(vue, /'lr-sample-table': LyraSampleTableVueProps/);
assert.match(vue, /\$emit: LyraVueEmit<ElementType, ElementEvents, EventNames>/);
assert.match(vue, /declare module 'vue'/);

const svelte = generated.get('src/svelte.ts');
assert.match(svelte, /declare module 'svelte\/elements'/);
assert.match(svelte, /export interface SvelteHTMLElements extends LyraSvelteElements/);
assert.match(svelte, /`on:\$\{Name\}`/);
assert.match(svelte, /`on\$\{Name\}`/);
assert.match(svelte, /`style:\$\{Name\}`/);
assert.doesNotMatch(svelte, /__lyraCSSCustomProperties__/);

const reversed = {
  ...fixture,
  modules: [...fixture.modules].reverse(),
};
assert.deepEqual(
  [...generateFrameworkTypes(reversed)],
  [...generated],
  'module order must not affect generated declarations',
);

const inherited = structuredClone(fixture);
inherited.modules.push({
  kind: 'javascript-module',
  path: 'src/components/forms/sample-number-field/sample-number-field.class.ts',
  declarations: [
    {
      kind: 'class',
      name: 'LyraSampleNumberField',
      customElement: true,
      tagName: 'lr-sample-number-field',
      superclass: {
        name: 'LyraSampleField',
        module: '/src/components/forms/sample-field/sample-field.class.js',
      },
      members: [],
      attributes: [],
      events: structuredClone(fixture.modules[1].declarations[0].events),
      cssProperties: [],
    },
  ],
});
const inheritedReact = generateFrameworkTypes(inherited).get('src/custom-elements-jsx.ts');
assert.match(
  inheritedReact,
  /export type LyraSampleNumberFieldReactProps = LyraReactElementProps<[\s\S]*?LyraSampleFieldEventMap,/,
);
assert.doesNotMatch(inheritedReact, /LyraSampleNumberFieldEventMap/);

const duplicate = structuredClone(fixture);
duplicate.modules[1].declarations[0].tagName = 'lr-sample-table';
assert.throws(
  () => generateFrameworkTypes(duplicate),
  /duplicate custom-element tag name "lr-sample-table"/,
);

const unsafePath = structuredClone(fixture);
unsafePath.modules[0].path = '../outside.ts';
assert.throws(
  () => generateFrameworkTypes(unsafePath),
  /must be a TypeScript module below src\//,
);

console.log('Framework declaration generator fixture tests passed.');
