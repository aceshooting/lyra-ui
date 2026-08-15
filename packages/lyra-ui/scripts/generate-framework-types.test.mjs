#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFrameworkTypes } from './generate-framework-types.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptsDir, '..');
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
assert.match(react, /'icon-only'\?: LyraAttributeValue<boolean>/);
assert.match(react, /'untyped-alias'\?: LyraUnknownAttributeValue/);
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
assert.match(vue, /'icon-only'\?: LyraAttributeValue<boolean>/);
assert.match(vue, /'untyped-alias'\?: LyraUnknownAttributeValue/);

const svelte = generated.get('src/svelte.ts');
assert.match(svelte, /declare module 'svelte\/elements'/);
assert.match(svelte, /export interface SvelteHTMLElements extends LyraSvelteElements/);
assert.match(svelte, /`on:\$\{Name\}`/);
assert.match(svelte, /`on\$\{Name\}`/);
assert.match(svelte, /`style:\$\{Name\}`/);
assert.doesNotMatch(svelte, /__lyraCSSCustomProperties__/);
assert.match(svelte, /'icon-only'\?: LyraAttributeValue<boolean>/);
assert.match(svelte, /'untyped-alias'\?: LyraUnknownAttributeValue/);

// Attribute aliases backed by public class fields are rendered through indexed access on the
// class. Their manifest type text is therefore not a dependency of this generated module. In
// particular, it may name a type imported privately by the class, a generic parameter, or a
// platform namespace member, and the same inherited alias can appear on several subclasses.
const fieldBackedDependencies = structuredClone(fixture);
const sampleTable = fieldBackedDependencies.modules[0].declarations[0];
sampleTable.members.push(
  {
    kind: 'field',
    name: 'headingLevel',
    type: { text: 'LyraHeadingLevel' },
    attribute: 'heading-level',
  },
  {
    kind: 'field',
    name: 'indexAxis',
    type: { text: 'LyraChartIndexAxis' },
    attribute: 'index-axis',
  },
  {
    kind: 'field',
    name: 'dataRows',
    type: { text: 'readonly Row[]' },
    attribute: 'data-rows',
  },
  {
    kind: 'field',
    name: 'timeZone',
    type: { text: "Intl.DateTimeFormatOptions['timeZone']" },
    attribute: 'time-zone',
  },
);
sampleTable.attributes.push(
  {
    name: 'heading-level',
    fieldName: 'headingLevel',
    type: { text: 'LyraHeadingLevel' },
  },
  {
    name: 'index-axis',
    fieldName: 'indexAxis',
    type: { text: 'LyraChartIndexAxis' },
  },
  {
    name: 'data-rows',
    fieldName: 'dataRows',
    type: { text: 'readonly Row[]' },
  },
  {
    name: 'time-zone',
    fieldName: 'timeZone',
    type: { text: "Intl.DateTimeFormatOptions['timeZone']" },
  },
);
const sampleField = fieldBackedDependencies.modules[1].declarations[0];
sampleField.members.push({
  kind: 'field',
  name: 'indexAxis',
  type: { text: 'LyraChartIndexAxis' },
  attribute: 'index-axis',
});
sampleField.attributes.push({
  name: 'index-axis',
  fieldName: 'indexAxis',
  type: { text: 'LyraChartIndexAxis' },
});

const fieldBackedGenerated = generateFrameworkTypes(fieldBackedDependencies);
for (const declarations of fieldBackedGenerated.values()) {
  assert.doesNotMatch(
    declarations,
    /import type \{[^}]*\b(?:LyraHeadingLevel|LyraChartIndexAxis|Row|Intl|DateTimeFormatOptions)\b[^}]*\}/,
    'field-backed aliases must not create imports from manifest type text',
  );
  assert.match(declarations, /'heading-level'\?: LyraSampleTable\['headingLevel'\]/);
  assert.match(declarations, /'data-rows'\?: LyraSampleTable\['dataRows'\]/);
  assert.match(declarations, /'time-zone'\?: LyraSampleTable\['timeZone'\]/);
  assert.equal(
    declarations.match(/\bLyraChartIndexAxis\b/g)?.length ?? 0,
    0,
    'a shared field type must not be imported once per subclass',
  );
}

const asymmetric = structuredClone(fixture);
const asymmetricValue = asymmetric.modules[1].declarations[0].members.find(
  ({ name }) => name === 'value',
);
asymmetricValue.type = { text: 'string | null | undefined' };
asymmetricValue.lyraReadType = { text: 'string' };
asymmetric.modules[1].declarations[0].members.push(
  {
    kind: 'field',
    name: 'filters',
    type: { text: 'readonly string[] | null | undefined' },
    lyraReadType: { text: 'readonly string[]' },
  },
  {
    kind: 'field',
    name: 'form',
    type: { text: 'HTMLFormElement | string | null' },
    lyraReadType: { text: 'HTMLFormElement | null' },
  },
  {
    kind: 'field',
    name: 'options',
    type: { text: 'SampleSetterOptions | null | undefined' },
    lyraReadType: { text: 'SampleSetterOptions' },
  },
  {
    kind: 'field',
    name: 'timeZone',
    type: { text: "Intl.DateTimeFormatOptions['timeZone'] | null" },
    lyraReadType: { text: "Intl.DateTimeFormatOptions['timeZone']" },
  },
);
const asymmetricGenerated = generateFrameworkTypes(asymmetric);
for (const [relative, frameworkName] of [
  ['src/custom-elements-jsx.ts', 'React'],
  ['src/svelte.ts', 'Svelte'],
  ['src/vue.ts', 'Vue'],
]) {
  const declarations = asymmetricGenerated.get(relative);
  const block = declarations.match(
    new RegExp(`export type LyraSampleField${frameworkName}Props[\\s\\S]*?\\n>;`),
  )?.[0];
  assert.ok(block, `${relative}: missing asymmetric sample-field props block`);
  assert.match(
    block,
    /value: string \| null \| undefined/,
    `${relative}: framework props must preserve the wider setter vocabulary`,
  );
  assert.match(block, /filters: readonly string\[\] \| null \| undefined/);
  assert.match(block, /form: HTMLFormElement \| string \| null/);
  assert.match(block, /options: SampleSetterOptions \| null \| undefined/);
  assert.match(block, /timeZone: Intl\.DateTimeFormatOptions\['timeZone'\] \| null/);
  assert.match(
    declarations,
    /import type \{ [^}]*SampleSetterOptions[^}]* \} from '\.\/components\/forms\/sample-field\/sample-field\.class\.js';/,
    `${relative}: a needed exported dependency must come from its canonical class module`,
  );
  assert.doesNotMatch(
    declarations,
    /import type \{[^}]*\b(?:Intl|DateTimeFormatOptions)\b[^}]*\}/,
    `${relative}: platform namespace members must not become class-module imports`,
  );
}
for (const declarations of asymmetricGenerated.values()) {
  assert.match(
    declarations,
    /Omit<Pick<ElementType, PropertyNames>, keyof PropertyOverrides>/,
    'framework helpers must replace narrow getter properties with write-type overrides',
  );
}

// Compile the generated declarations as framework consumers, rather than merely matching their
// text. This proves each adapter accepts the complete setter vocabulary while the element class
// itself retains narrow getter types. The fixture is self-contained under /tmp and never refreshes
// checked-in generated artifacts.
const semanticFixture = mkdtempSync(path.join(os.tmpdir(), 'lyra-framework-accessors-'));
try {
  for (const [relative, contents] of asymmetricGenerated) {
    const target = path.join(semanticFixture, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  const write = (relative, contents) => {
    const target = path.join(semanticFixture, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  write(
    'src/components/forms/sample-field/sample-field.class.ts',
    [
      "export interface LyraSampleFieldEventMap { 'lr-change': CustomEvent<{ value: string }>; focus: FocusEvent; }",
      'export interface SampleSetterOptions { readonly strict: boolean; }',
      'export declare class LyraSampleField extends HTMLElement {',
      '  get value(): string;',
      '  set value(next: string | null | undefined);',
      '  get filters(): readonly string[];',
      '  set filters(next: readonly string[] | null | undefined);',
      '  get form(): HTMLFormElement | null;',
      '  set form(next: HTMLFormElement | string | null);',
      '  get options(): SampleSetterOptions;',
      '  set options(next: SampleSetterOptions | null | undefined);',
      "  get timeZone(): Intl.DateTimeFormatOptions['timeZone'];",
      "  set timeZone(next: Intl.DateTimeFormatOptions['timeZone'] | null);",
      '  accessibleLabel: string | null;',
      '  disabled: boolean;',
      '}',
    ].join('\n'),
  );
  write(
    'src/components/data/sample-table/sample-table.class.ts',
    [
      'export interface SampleRow { readonly id: string; }',
      "export interface LyraSampleTableEventMap { 'lr-row-activate': CustomEvent<{ row: SampleRow }>; }",
      'export declare class LyraSampleTable extends HTMLElement {',
      '  rows: readonly SampleRow[];',
      "  density: 'compact' | 'comfortable';",
      '}',
    ].join('\n'),
  );
  write(
    'src/events.ts',
    [
      'export interface LyraGlobalEventMap {',
      "  'lr-change': CustomEvent<{ value: string }>;",
      '  focus: FocusEvent;',
      "  'lr-row-activate': CustomEvent<{ row: { readonly id: string } }>;",
      '}',
    ].join('\n'),
  );
  write(
    'node_modules/react/index.d.ts',
    [
      'export interface HTMLAttributes<T> { style?: unknown; }',
      'export interface RefAttributes<T> { ref?: unknown; }',
      'export interface CSSProperties {}',
      'export namespace JSX { interface IntrinsicElements {} }',
    ].join('\n'),
  );
  write(
    'node_modules/vue/index.d.ts',
    [
      'export type EmitFn<T> = <K extends keyof T>(name: K, ...args: unknown[]) => void;',
      'export interface HTMLAttributes { style?: unknown; }',
      'export interface PublicProps {}',
      'export interface GlobalComponents {}',
    ].join('\n'),
  );
  write(
    'node_modules/svelte/elements.d.ts',
    [
      'export interface HTMLAttributes<T> {}',
      'export interface SvelteHTMLElements {}',
    ].join('\n'),
  );
  const assignments = (propsType, prefix) => [
    `const ${prefix}FiltersNull: ${propsType} = { filters: null };`,
    `const ${prefix}FiltersUndefined: ${propsType} = { filters: undefined };`,
    `const ${prefix}ValueNull: ${propsType} = { value: null };`,
    `const ${prefix}ValueUndefined: ${propsType} = { value: undefined };`,
    `const ${prefix}FormId: ${propsType} = { form: 'external-form' };`,
    `const ${prefix}FormElement: ${propsType} = { form: document.createElement('form') };`,
    `const ${prefix}FormNull: ${propsType} = { form: null };`,
    '// @ts-expect-error numbers are not form-owner writes',
    `const ${prefix}InvalidForm: ${propsType} = { form: 1 };`,
  ].join('\n');
  write(
    'src/consumer.ts',
    [
      "import type { LyraSampleFieldReactProps } from './custom-elements-jsx.js';",
      "import type { LyraSampleFieldSvelteProps } from './svelte.js';",
      "import type { LyraSampleFieldVueProps } from './vue.js';",
      assignments('LyraSampleFieldReactProps', 'react'),
      assignments('LyraSampleFieldSvelteProps', 'svelte'),
      "type VueProps = InstanceType<LyraSampleFieldVueProps>['$props'];",
      assignments('VueProps', 'vue'),
    ].join('\n'),
  );
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2022', 'DOM'],
      },
      include: ['src/**/*.ts'],
    }),
  );
  const require = createRequire(import.meta.url);
  const tsc = path.resolve(path.dirname(require.resolve('typescript')), '../bin/tsc');
  execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], {
    cwd: semanticFixture,
    stdio: 'pipe',
  });
} finally {
  rmSync(semanticFixture, { recursive: true, force: true });
}

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

const currentManifest = JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
const flowCanvas = currentManifest.modules
  .flatMap(({ declarations = [] }) => declarations)
  .find(({ tagName }) => tagName === 'lr-flow-canvas');
assert.ok(flowCanvas, 'current manifest must contain lr-flow-canvas');
for (const name of ['zoomIn', 'zoomOut', 'resetZoom']) {
  assert.equal(
    flowCanvas.members.find((member) => member.name === name)?.kind,
    'method',
    `lr-flow-canvas#${name} must remain callable method metadata`,
  );
}
for (const [relative, typeName] of [
  ['src/custom-elements-jsx.ts', 'React'],
  ['src/svelte.ts', 'Svelte'],
  ['src/vue.ts', 'Vue'],
]) {
  const declarations = readFileSync(path.join(packageDir, relative), 'utf8');
  const block = declarations.match(
    new RegExp(`export type LyraFlowCanvas${typeName}Props[\\s\\S]*?(?=\\nexport type LyraFlowControls)`),
  )?.[0];
  assert.ok(block, `${relative}: missing LyraFlowCanvas props block`);
  assert.doesNotMatch(
    block,
    /'zoomIn'|'zoomOut'|'resetZoom'/,
    `${relative}: methods must not be emitted as assignable framework props`,
  );
}

console.log('Framework declaration generator fixture tests passed.');
