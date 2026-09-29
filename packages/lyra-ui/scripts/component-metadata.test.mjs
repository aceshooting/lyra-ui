import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseSync } from 'oxc-parser';

import {
  annotateComponentSource,
  applyComponentMetadataToManifest,
  applyMaturityToInventory,
  buildReleaseHistory,
  compareVersions,
  componentMetadataByTag,
  deriveSinceByTag,
  formatDeprecationSubject,
  manifestComponentTags,
  parseVersion,
  partitionReleaseHistoryAtCurrent,
  reconcileCurrentReleaseHistory,
  requireCompleteGitHistory,
  sha256,
  stampUnreleasedDeprecations,
  UNRELEASED_VERSION,
  validateComponentMetadata,
  validateRootComponentClassDeprecations,
  validateManifestMetadataProjection,
} from './component-metadata.mjs';
import { generateManifest } from './generate-manifest.mjs';
import { checkPublishedCompatibilitySync } from './check-published-compatibility.mjs';
import { nextWriteMetadata } from './generate-component-metadata.mjs';
import * as metadataContracts from './component-metadata.mjs';
import cemConfig from '../custom-elements-manifest.config.js';
import { expandManifestDeprecations } from './manifest-compact.mjs';
import {
  buildComponentMetadataIndex,
  componentMetadataPresentation,
} from '../../../.storybook/component-metadata.js';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

test('export inspection distinguishes genuine absence from invalid current source and policy', () => {
  const source = `
/** @deprecated Use Current instead. */
export type Old = string;
export type Current = string;
export const live = 'lr-current-event';
// lr-comment-event and data-lr-comment are only prose.
export const attribute = 'data-lr-current';
`;
  const packageJson = { exports: {
    './old.js': './dist/old.js', './missing.js': './dist/missing.js',
    './broken.js': './dist/broken.js', './style.css': './dist/style.css',
    './patterns/*': './dist/*.js', './patterns/blocked': null,
    './invalid-target.js': 42, './unknown-conditions.js': { browser: './dist/old.js' },
    './array-target.js': ['./dist/old.js'], './node-target.js': { node: './dist/old.js' },
    './blocked-import.js': { import: null, default: './dist/old.js' },
    './default.js': { default: './dist/old.js' },
  } };
  const readSource = file => ({ 'src/old.ts': source, 'src/broken.ts': 'export const = ;', 'src/style.css': ':root {}' })[file] ?? null;
  const context = { packageJson, readSource, exportDeprecations: [{ kind: 'entry-point', name: './old.js' }] };
  const inspect = entry => metadataContracts.inspectExportContract(entry, context);
  assert.deepEqual(inspect({ kind: 'type', module: './old.js', name: 'Old' }), {
    status: 'present', sourcePath: 'src/old.ts', isType: true, deprecated: true, findings: [],
  });
  assert.equal(inspect({ kind: 'type', module: './old.js', name: 'Current' }).deprecated, false);
  assert.equal(inspect({ kind: 'constant', module: './old.js', name: 'live' }).isType, false);
  assert.equal(inspect({ kind: 'entry-point', name: './old.js' }).deprecated, true);
  assert.equal(inspect({ kind: 'stylesheet', name: './style.css' }).status, 'present');
  assert.equal(inspect({ kind: 'type', module: './old.js', name: 'Gone' }).status, 'absent');
  assert.equal(inspect({ kind: 'entry-point', name: './gone.js' }).status, 'absent');
  assert.equal(inspect({ kind: 'entry-point', name: './patterns/old' }).status, 'present');
  assert.equal(inspect({ kind: 'entry-point', name: './patterns/blocked' }).status, 'absent');
  assert.equal(inspect({ kind: 'entry-point', name: './blocked-import.js' }).status, 'absent');
  assert.equal(inspect({ kind: 'entry-point', name: './default.js' }).status, 'present');
  for (const name of ['./missing.js', './broken.js', '../old.js', './patterns/*', './invalid-target.js', './unknown-conditions.js', './array-target.js', './node-target.js']) {
    const result = inspect({ kind: 'entry-point', name });
    assert.equal(result.status, 'invalid', name);
    assert.ok(result.findings.length > 0, name);
  }
  for (const [kind, name, status] of [
    ['window-event', 'lr-current-event', 'present'], ['window-event', 'lr-comment-event', 'absent'],
    ['root-attribute', 'data-lr-current', 'present'], ['root-attribute', 'data-lr-comment', 'absent'],
  ]) assert.equal(inspect({ kind, module: './old.js', name }).status, status);
  assert.equal(inspect({ kind: 'window-event', module: './old.js', name: 'invalid' }).status, 'invalid');
});

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(packageDir, relativePath), 'utf8')
  );
}

function fixture() {
  const rawManifest = fs.readFileSync(
    path.join(packageDir, 'custom-elements.json'),
    'utf8'
  );
  return {
    metadata: readJson('scripts/fixtures/component-metadata.json'),
    inventory: readJson('scripts/fixtures/component-inventory.json'),
    manifest: JSON.parse(rawManifest),
    packageJson: readJson('package.json'),
    rawManifest,
  };
}

test('every actual root component constructor has an exact deprecation policy', () => {
  const state = fixture();
  assert.deepEqual(validateRootComponentClassDeprecations(state.metadata, { ...state,
    historicalClassAliases: checkPublishedCompatibilitySync().classAliases,
  }), []);
});

function rootClassFixture() {
  const module = './components/utility/widget/widget.class.js';
  const sources = {
    'src/lyra.ts': `export {
      /** @deprecated Import Widget from its class subpath. */
      Widget as Renamed,
      helper,
      CONSTANT,
      type WidgetOptions,
      type Widget as ConstructorType,
    } from '${module}';`,
    'src/components/utility/widget/widget.class.ts': `export class Other {}
      export class Widget {}
      export function helper() {}
      export const CONSTANT = 1;
      export interface WidgetOptions { value: string }`,
  };
  return {
    sources,
    metadata: { deprecations: [], exportDeprecations: [{
      kind: 'class', module: '.', name: 'Renamed', since: 'unreleased', removalNotBefore: '24.0.0',
      replacement: { kind: 'class', module, name: 'Widget' },
    }] },
    options: {
      packageJson: { exports: { '.': './dist/lyra.js', [module]: './dist/components/utility/widget/widget.class.js' } },
      manifest: { schemaVersion: '1.0.0', modules: [{
        path: 'src/components/utility/widget/widget.class.ts',
        declarations: [
          { kind: 'class', name: 'Widget', customElement: true, tagName: 'lr-widget' },
          { kind: 'class', name: 'Other', customElement: true, tagName: 'lr-other' },
        ],
      }] },
      readSource: file => sources[file] ?? null,
    },
  };
}

test('root constructor completeness resolves multiline aliases without deprecating helper or type siblings', () => {
  const { metadata, options, sources } = rootClassFixture();
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  metadata.exportDeprecations = [];
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), [
    'root component class Renamed: expected exactly one class deprecation policy',
  ]);
  sources['src/lyra.ts'] = `export { helper, CONSTANT, type Widget, type WidgetOptions } from './components/utility/widget/widget.class.js';`;
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), [], 'a class-free root remains valid');
});

function overloadedRootHelperFixture() {
  const state = rootClassFixture();
  const module = 'src/components/utility/widget/widget.class.ts';
  state.sources[module] = state.sources[module].replace('export function helper() {}', `
    export function helper(value: string): string;
    export function helper(value: number): number;
    export function helper(value: string | number): string | number { return value; }`);
  state.options.manifest.modules[0].declarations.push(
    { kind: 'function', name: 'helper', parameters: [{ name: 'value', type: { text: 'string' } }] },
    { kind: 'function', name: 'helper', parameters: [{ name: 'value', type: { text: 'number' } }] },
    { kind: 'function', name: 'helper', parameters: [{ name: 'value', type: { text: 'string | number' } }] },
  );
  return state;
}

test('root constructor completeness accepts overloaded helpers without skipping component policies', () => {
  const { metadata, options } = overloadedRootHelperFixture();
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  metadata.exportDeprecations = [];
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), [
    'root component class Renamed: expected exactly one class deprecation policy',
  ]);
});

test('root constructor completeness rejects ambiguous and malformed declarations beside helper overloads', () => {
  for (const mutate of [
    declarations => { declarations.push(structuredClone(declarations[0])); },
    declarations => { declarations[2] = { kind: 'class', name: 'helper' }; },
    declarations => { declarations[3] = { kind: 'class', name: 'helper' }; },
    declarations => { declarations[3].kind = ''; },
    declarations => { declarations[3].name = ''; },
    declarations => { declarations[3].customElement = true; declarations[3].tagName = 'lr-helper'; },
    declarations => { declarations[3].customElement = 'false'; },
    declarations => { declarations[3].tagName = 'lr-helper'; },
    declarations => { declarations[3] = null; },
  ]) {
    const { metadata, options } = overloadedRootHelperFixture();
    mutate(options.manifest.modules[0].declarations);
    assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /invalid component manifest/);
  }
});

test('root constructor completeness follows imported and barrel aliases', () => {
  const { metadata, options, sources } = rootClassFixture();
  sources['src/bridge.ts'] = `import { Widget as Local } from './components/utility/widget/widget.class.js'; export { Local as Public };`;
  sources['src/lyra.ts'] = `/** @deprecated Import the class subpath. */
    export { Public as Renamed } from './bridge.js';`;
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  metadata.exportDeprecations = [];
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /Renamed: expected exactly one/);
});

test('direct immutable constructor aliases retain identity and require their own root notice', () => {
  for (const form of ['direct', 'local-chain', 'barrel']) {
    const { metadata, options, sources } = rootClassFixture();
    const source = `import { Widget } from './components/utility/widget/widget.class.js';\n`;
    if (form === 'barrel') {
      sources['src/alias.ts'] = `${source}export const Binding = Widget;`;
      sources['src/lyra.ts'] = `/** @deprecated Import the class subpath. */\nexport { Binding as Hidden } from './alias.js';`;
    } else {
      sources['src/lyra.ts'] = `${source}${form === 'local-chain' ? 'const Binding = Widget;\n' : ''}
        /** @deprecated Import the class subpath. */
        export const Hidden = ${form === 'local-chain' ? 'Binding' : 'Widget'};`;
    }
    metadata.exportDeprecations[0].name = 'Hidden';
    assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), [], form);
    metadata.exportDeprecations[0].replacement.name = 'Other';
    assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /changes constructor/, form);
    metadata.exportDeprecations = [];
    assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), [
      'root component class Hidden: expected exactly one class deprecation policy',
    ], form);
  }
});

test('constructor alias resolution excludes helper values and type-only aliases', () => {
  const { metadata, options, sources } = rootClassFixture();
  sources['src/lyra.ts'] = `import { helper, CONSTANT, type WidgetOptions } from './components/utility/widget/widget.class.js';
    const HelperBinding = helper;
    export const helperAlias = HelperBinding;
    export const constantAlias = CONSTANT;
    class IndependentHelper {}
    export const helperClassAlias = IndependentHelper;
    export type OptionsAlias = WidgetOptions;`;
  metadata.exportDeprecations = [];
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
});

test('constructor aliases fail closed on local cycles and mutable bindings', () => {
  const { metadata, options, sources } = rootClassFixture();
  metadata.exportDeprecations = [];
  sources['src/lyra.ts'] = `const First = Second; const Second = First; export { First };`;
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /cyclic constructor alias/);
  for (const kind of ['let', 'var']) {
    sources['src/lyra.ts'] = `import { Widget, Other } from './components/utility/widget/widget.class.js';
      ${kind} Binding = Widget;
      export const Hidden = Binding;
      Binding = Other;`;
    assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /unsupported mutable constructor alias Binding/);
  }
});

test('root constructor completeness rejects unsupported imported bindings instead of skipping them', () => {
  const { metadata, options, sources } = rootClassFixture();
  for (const binding of ['* as Local', 'Local']) {
    sources['src/lyra.ts'] = `import ${binding} from './components/utility/widget/widget.class.js';
      export { Local as Renamed };`;
    assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /unsupported imported re-export Local/);
  }
});

test('root constructor completeness requires notice and same-constructor replacement', () => {
  const { metadata, options, sources } = rootClassFixture();
  sources['src/lyra.ts'] = sources['src/lyra.ts'].replace('@deprecated', 'Canonical');
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /no @deprecated JSDoc/);
  sources['src/lyra.ts'] = sources['src/lyra.ts'].replace('Canonical', '@deprecated');
  metadata.exportDeprecations[0].replacement.name = 'Other';
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /changes constructor without a component alias policy/);
  metadata.exportDeprecations[0].replacement.name = 'helper';
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /not a component constructor/);
  metadata.exportDeprecations[0].replacement.name = 'Missing';
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /not exported/);
});

function historicalWidgetAlias() {
  const module = 'src/components/utility/widget/widget.class.ts';
  return { sourceRelease: 'lyra-ui@22.0.0',
    source: { module, name: 'Widget', tag: 'lr-widget' },
    replacement: { module, name: 'Other', tag: 'lr-other' },
    policy: { kind: 'component', tag: 'lr-widget', name: 'lr-widget',
      replacement: { kind: 'component', name: 'lr-other' } },
  };
}

test('a different constructor requires exact historical component identities and actual ancestry', () => {
  const { metadata, options, sources } = rootClassFixture();
  metadata.exportDeprecations[0].replacement.name = 'Other';
  const alias = historicalWidgetAlias();
  metadata.deprecations = [alias.policy];
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /changes constructor/,
    'an arbitrary current component policy cannot authorize a constructor change');
  options.historicalClassAliases = [alias];
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /changes constructor/,
    'a historical relation cannot authorize unrelated current constructors');
  sources[alias.source.module] = sources[alias.source.module].replace('class Widget {}', 'class Widget extends Other {}');
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  for (const mutate of [
    entry => { entry.source.name = 'Unrelated'; },
    entry => { entry.source.module = 'src/unrelated.ts'; },
    entry => { entry.source.tag = 'lr-unrelated'; },
    entry => { entry.replacement.name = 'Widget'; },
    entry => { entry.replacement.tag = 'lr-unrelated'; },
    entry => { entry.policy.replacement.name = 'lr-unrelated'; },
    entry => { entry.policy.kind = 'property'; },
    entry => { entry.sourceRelease = 'unreleased'; },
  ]) {
    const edited = structuredClone(alias); mutate(edited);
    assert.match(validateRootComponentClassDeprecations(metadata, { ...options, historicalClassAliases: [edited] }).join('\n'), /changes constructor/);
  }
});

function untaggedClassFixture() {
  const state = rootClassFixture();
  const { metadata, options, sources } = state;
  const alias = historicalWidgetAlias();
  options.manifest.modules[0].declarations[0] = { kind: 'class', name: 'Widget' };
  sources[alias.source.module] = sources[alias.source.module].replace('class Widget {}', 'class Widget extends Base {}');
  sources[alias.source.module] += `\nimport { Base } from '../../../base.js';`;
  sources['src/base.ts'] = `export { Other as Base } from './components/utility/widget/widget.class.js';`;
  options.historicalClassAliases = [alias];
  return { ...state, alias };
}

test('an unregistered component subclass remains in the census through import and re-export ancestry', () => {
  const { metadata, options, sources, alias } = untaggedClassFixture();
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  const records = metadata.exportDeprecations;
  metadata.exportDeprecations = [];
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), [
    'root component class Renamed: expected exactly one class deprecation policy',
  ]);
  metadata.exportDeprecations = records;
  // Root and family must preserve the same distinct compatibility subclass.
  const family = './families/utility.js';
  options.packageJson.exports[family] = './dist/families/utility.js';
  sources['src/families/utility.ts'] = `export { Widget } from '../components/utility/widget/widget.class.js';`;
  metadata.exportDeprecations[0].replacement = { kind: 'class', module: family, name: 'Widget' };
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  sources['src/families/utility.ts'] = `export { Other as Widget } from '../components/utility/widget/widget.class.js';`;
  assert.match(validateRootComponentClassDeprecations(metadata, { ...options, historicalClassAliases: [] }).join('\n'), /changes constructor/);
  metadata.exportDeprecations[0].replacement = { kind: 'class', module: './components/utility/widget/widget.class.js', name: 'Other' };
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  assert.equal(alias.source.name, 'Widget');
});

test('untagged subclasses cannot hide missing, altered, unsupported or cyclic ancestry', () => {
  for (const [replacement, finding] of [
    ['extends Missing', /unresolved superclass/],
    ['extends helper', /unresolved superclass|not a class/],
    ['extends factory()', /unsupported superclass/],
    ['', /no longer has component ancestry/],
    ['extends Widget', /cyclic class ancestry/],
  ]) {
    const { metadata, options, sources, alias } = untaggedClassFixture();
    sources[alias.source.module] = sources[alias.source.module].replace('extends Base', replacement);
    assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), finding);
  }
  const { metadata, options, sources } = untaggedClassFixture();
  sources['src/base.ts'] = `export { Widget as Base } from './components/utility/widget/widget.class.js';`;
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /cyclic class ancestry/);
  const tagged = rootClassFixture();
  const module = 'src/components/utility/widget/widget.class.ts';
  tagged.sources[module] = tagged.sources[module].replace('class Widget {}', 'class Widget extends Other {}')
    .replace('class Other {}', 'class Other extends Widget {}');
  assert.match(validateRootComponentClassDeprecations(tagged.metadata, tagged.options).join('\n'), /cyclic class ancestry/);
});

test('root constructor completeness fails closed on malformed or incomplete sources and manifests', () => {
  const { metadata, options, sources } = rootClassFixture();
  assert.match(validateRootComponentClassDeprecations(metadata, { ...options, manifest: {} }).join('\n'), /invalid component manifest/);
  for (const mutate of [
    manifest => { manifest.modules.push(structuredClone(manifest.modules[0])); },
    manifest => { manifest.modules[0].declarations.push(structuredClone(manifest.modules[0].declarations[0])); },
    manifest => { manifest.modules[0].declarations[0].tagName = ''; },
    manifest => { manifest.modules[0].declarations[0].kind = 'variable'; },
    manifest => { manifest.modules[0].declarations[0].customElement = false; },
    manifest => { manifest.modules[0].declarations[0] = null; },
  ]) {
    const manifest = structuredClone(options.manifest); mutate(manifest);
    assert.match(validateRootComponentClassDeprecations(metadata, { ...options, manifest }).join('\n'), /invalid component manifest/);
  }
  assert.match(validateRootComponentClassDeprecations(metadata, { ...options, manifest: { schemaVersion: '1.0.0', modules: [] } }).join('\n'), /absent from the manifest/);
  const original = sources['src/lyra.ts'];
  sources['src/lyra.ts'] = 'export {';
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /cannot parse/);
  sources['src/lyra.ts'] = original.replace("'./components/utility/widget/widget.class.js'", "'./missing.js'");
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /missing re-export source/);
  sources['src/lyra.ts'] = original.replace('Widget as Renamed', 'Missing as Renamed');
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /unresolved runtime re-export/);
  sources['src/lyra.ts'] = `export * from './bridge.js';`;
  sources['src/bridge.ts'] = `export * from './lyra.js';`;
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /cyclic re-export/);
});

test('root census excludes independent helper classes and rejects namespace, default and ambiguous exports', () => {
  const { metadata, options, sources } = rootClassFixture();
  sources['src/helpers.ts'] = `export class LyraHelper {}\nexport const answer = 42;`;
  sources['src/lyra.ts'] += `\nexport { LyraHelper, answer } from './helpers.js';`;
  assert.deepEqual(validateRootComponentClassDeprecations(metadata, options), []);
  sources['src/lyra.ts'] = `export * as Widgets from './components/utility/widget/widget.class.js';`;
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /unsupported namespace/);
  sources['src/lyra.ts'] = `export default () => {};`;
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /unsupported/);
  sources['src/lyra.ts'] = `export const Hidden = class {};`;
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /unsupported exported class expression/);
  sources['src/lyra.ts'] = `export * from './left.js'; export * from './right.js';`;
  sources['src/left.ts'] = `export { Widget as Shared } from './components/utility/widget/widget.class.js';`;
  sources['src/right.ts'] = `export { Other as Shared } from './components/utility/widget/widget.class.js';`;
  assert.match(validateRootComponentClassDeprecations(metadata, options).join('\n'), /ambiguous star export/);
});

test('checked-in metadata covers the current manifest and inventory', () => {
  const state = fixture();
  assert.deepEqual(validateComponentMetadata(state.metadata, state), []);
  assert.equal(state.metadata.assignments['published-stable'].length, 258);
  assert.equal(state.metadata.assignments['published-experimental'].length, 2);
  assert.equal(state.metadata.assignments['mapped-experimental'].length, 1);
  assert.equal(
    state.metadata.assignments['introduced-mapped-experimental'].length,
    2
  );
  assert.equal(state.metadata.assignments['compatibility-stable'].length, 1);
  assert.equal(state.metadata.assignments['introduced-stable'].length, 19);
  // The eight older mirrored hooks stay while their upstream counterparts exist. All 44
  // member notices with a 24.0.0 removal floor have retired.
  const removalCohorts = {};
  for (const entry of state.metadata.deprecations) {
    removalCohorts[entry.removalNotBefore] = (removalCohorts[entry.removalNotBefore] ?? 0) + 1;
  }
  assert.deepEqual(removalCohorts, {
    '10.0.0': 8,
  });
  assert.deepEqual(state.metadata.exportDeprecations, []);
});

test('a subclass records an inherited alias against its full public surface', () => {
  const state = fixture();
  const declarations = state.manifest.modules.flatMap((module) => module.declarations ?? []);
  const base = declarations.find((entry) => entry.tagName === 'lr-chart');
  const child = declarations.find((entry) => entry.tagName === 'lr-line-chart');
  // Synthetic policy keeps the inheritance regression independent of any release's alias cohort.
  const record = {
    kind: 'property', name: 'fixtureLegacy', since: state.packageJson.version,
    removalNotBefore: `${currentMajor(state) + 2}.0.0`,
    replacement: { kind: 'property', name: 'fixtureCurrent', usage: '.fixtureCurrent' },
    rationale: 'Use the canonical fixture property.',
  };
  base.members ??= [];
  base.members.push(
    { kind: 'field', name: 'fixtureLegacy', type: { text: 'boolean' }, deprecated: 'Use fixtureCurrent.' },
    { kind: 'field', name: 'fixtureCurrent', type: { text: 'boolean' } },
  );
  for (const tag of ['lr-chart', 'lr-line-chart']) putDeprecation(state.metadata, { ...record, tag });
  assert.equal(
    (child.members ?? []).some((member) => member.name === 'fixtureLegacy'),
    false,
    'the compact subclass has no own copy of its inherited member',
  );
  assert.deepEqual(validateEdited(state, state.metadata), []);
  const projected = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, projected, { packageVersion: state.packageJson.version });
  assert.deepEqual(
    validateManifestMetadataProjection(state.metadata, projected, {
      packageVersion: state.packageJson.version,
    }),
    [],
  );

  const metadata = structuredClone(state.metadata);
  putDeprecation(metadata, { ...record, tag: 'lr-line-chart', name: 'missingFixture' });
  assert.throws(
    () => validateEdited(state, metadata),
    /lr-line-chart:property:missingFixture: deprecated public member does not exist/,
  );
});

test('new mirrors of experimental upstream media surfaces remain experimental everywhere authored', () => {
  const state = fixture();
  const maturity = componentMetadataByTag(state.metadata, {
    tags: ['lr-video', 'lr-video-playlist'],
    packageVersion: state.packageJson.version,
  });

  for (const tag of ['lr-video', 'lr-video-playlist']) {
    assert.equal(maturity.get(tag).status, 'experimental', `${tag} status`);
    assert.equal(
      maturity.get(tag).profile,
      'introduced-mapped-experimental',
      `${tag} profile`
    );
  }

  for (const relativePath of [
    'src/components/media/video/video.class.ts',
    'src/components/media/video-playlist/video-playlist.class.ts',
  ]) {
    assert.match(
      fs.readFileSync(path.join(packageDir, relativePath), 'utf8'),
      /@status experimental/
    );
  }
  for (const relativePath of [
    'src/components/media/video/video.stories.ts',
    'src/components/media/video-playlist/video-playlist.stories.ts',
  ]) {
    assert.match(
      fs.readFileSync(path.join(packageDir, relativePath), 'utf8'),
      /tags: \['autodocs', 'experimental'\]/
    );
  }

  const mediaDocs = fs.readFileSync(
    path.join(packageDir, 'llms/media.md'),
    'utf8'
  );
  assert.match(mediaDocs, /## `lr-video`\n\nExperimental\b/);
  assert.match(mediaDocs, /## `lr-video-playlist`\n\nExperimental\b/);
});

test('exact tag history derives the earliest release and leaves renamed prefixes distinct', () => {
  const history = {
    releases: [
      { version: '3.9.0', manifestPresent: true, tags: ['lyra-example'] },
      { version: '4.0.0', manifestPresent: true, tags: ['lr-example'] },
      {
        version: '4.1.0',
        manifestPresent: true,
        tags: ['lr-example', 'lr-later'],
      },
      { version: '5.0.0', manifestPresent: true, tags: ['lr-later'] },
    ],
    current: {
      version: '8.0.0',
      tags: ['lr-current', 'lr-example', 'lr-later'],
    },
  };

  assert.deepEqual(Object.fromEntries(deriveSinceByTag(history)), {
    'lyra-example': '3.9.0',
    'lr-example': '4.0.0',
    'lr-later': '4.1.0',
    'lr-current': '8.0.0',
  });
});

test('history provenance rejects malformed commit, blob, and digest evidence', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  const release = metadata.history.releases.find(
    (entry) => entry.manifestPresent
  );
  release.sourceCommit = 'not-a-commit';
  release.manifestBlob = 'not-a-blob';
  release.manifestSha256 = 'not-a-digest';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.includes(
      `${release.tag}: missing or invalid source commit provenance`
    )
  );
  assert.ok(
    findings.includes(`${release.tag}: manifest blob must be a Git object id`)
  );
  assert.ok(
    findings.includes(`${release.tag}: manifest digest must be SHA-256`)
  );
});

test('a proven current release tag is allowed, then rolls into history on the next version write', () => {
  const prior = {
    tag: 'lyra-ui@7.8.1',
    version: '7.8.1',
    sourceCommit: '1'.repeat(40),
    manifestPresent: true,
    manifestBlob: '2'.repeat(40),
    manifestSha256: '3'.repeat(64),
    tags: ['lr-a'],
  };
  const current = {
    version: '8.0.0',
    sourceCommit: null,
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a', 'lr-new'],
  };
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: current.manifestSha256,
    tags: current.tags,
  };
  const history = { releases: [prior], current };

  assert.deepEqual(
    partitionReleaseHistoryAtCurrent([prior, taggedCurrent], current),
    {
      releases: [prior],
      taggedCurrent,
      currentRelease: taggedCurrent,
    }
  );
  assert.deepEqual(
    reconcileCurrentReleaseHistory(history, [prior, taggedCurrent]),
    {
      releases: [prior],
      taggedCurrent,
      currentRelease: taggedCurrent,
    }
  );
  assert.deepEqual(
    reconcileCurrentReleaseHistory(history, [prior, taggedCurrent], {
      rolloverCurrent: true,
    }),
    {
      releases: [prior, taggedCurrent],
      taggedCurrent: null,
      currentRelease: taggedCurrent,
    }
  );
});

test('tagged snapshot stays immutable while same-version worktree current evolves, then rolls over', () => {
  const current = {
    version: '8.0.0',
    sourceCommit: null,
    manifestSha256: '8'.repeat(64),
    tags: ['lr-a', 'lr-unreleased'],
  };
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a'],
  };
  const history = { releases: [], taggedCurrent, current };

  assert.deepEqual(reconcileCurrentReleaseHistory(history, [taggedCurrent]), {
    releases: [],
    taggedCurrent,
    currentRelease: taggedCurrent,
  });
  assert.deepEqual(
    reconcileCurrentReleaseHistory(history, [taggedCurrent], {
      rolloverCurrent: true,
    }),
    {
      releases: [taggedCurrent],
      taggedCurrent: null,
      currentRelease: taggedCurrent,
    }
  );
  assert.deepEqual(Object.fromEntries(deriveSinceByTag(history)), {
    'lr-a': '8.0.0',
  });
});

test('full-history checks require a persisted snapshot once same-version current diverges', () => {
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a'],
  };
  const exactHistory = {
    releases: [],
    current: {
      version: '8.0.0',
      sourceCommit: null,
      manifestSha256: taggedCurrent.manifestSha256,
      tags: taggedCurrent.tags,
    },
  };
  assert.doesNotThrow(() =>
    reconcileCurrentReleaseHistory(exactHistory, [taggedCurrent], {
      requirePersistedTaggedCurrent: true,
    })
  );

  const evolvedHistory = structuredClone(exactHistory);
  evolvedHistory.current.manifestSha256 = '8'.repeat(64);
  evolvedHistory.current.tags.push('lr-unreleased');
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(evolvedHistory, [taggedCurrent], {
        requirePersistedTaggedCurrent: true,
      }),
    /history\.taggedCurrent must persist the immutable release snapshot/
  );
  assert.equal(
    reconcileCurrentReleaseHistory(evolvedHistory, [taggedCurrent])
      .taggedCurrent,
    taggedCurrent
  );
});

test('component metadata fails closed in a shallow clone', () => {
  const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lyra-component-metadata-')
  );
  const source = path.join(temp, 'source');
  const shallow = path.join(temp, 'shallow');
  try {
    fs.mkdirSync(source);
    execFileSync('git', ['init', '--quiet'], { cwd: source });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], {
      cwd: source,
    });
    execFileSync('git', ['config', 'user.name', 'Lyra Test'], { cwd: source });
    fs.writeFileSync(path.join(source, 'README.md'), 'fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: source });
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], {
      cwd: source,
    });
    execFileSync('git', [
      'clone',
      '--quiet',
      '--depth',
      '1',
      `file://${source}`,
      shallow,
    ]);
    assert.throws(
      () => requireCompleteGitHistory(shallow),
      /requires a non-shallow clone with release tags/
    );
    assert.doesNotThrow(() => requireCompleteGitHistory(source));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('buildReleaseHistory hashes the exact committed manifest bytes, trailing newline included', () => {
  // custom-elements.json is always committed with a trailing newline (see writeJson in
  // generate-component-metadata.mjs). buildReleaseHistory must hash that file exactly as
  // committed -- not a version with the trailing newline stripped -- or its manifestSha256 can
  // never match history.current.manifestSha256, which is always hashed from the untrimmed bytes.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-release-history-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: temp });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], {
      cwd: temp,
    });
    execFileSync('git', ['config', 'user.name', 'Lyra Test'], { cwd: temp });
    const manifestRelativePath = 'custom-elements.json';
    const manifestContent = '{"schemaVersion":"1.0.0","modules":[]}\n';
    fs.writeFileSync(path.join(temp, manifestRelativePath), manifestContent);
    execFileSync('git', ['add', manifestRelativePath], { cwd: temp });
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: temp });
    execFileSync('git', ['tag', 'lyra-ui@9.9.9'], { cwd: temp });

    const [release] = buildReleaseHistory(temp, manifestRelativePath);
    assert.equal(release.tag, 'lyra-ui@9.9.9');
    assert.equal(release.manifestPresent, true);
    assert.equal(release.manifestSha256, sha256(manifestContent));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('a post-tag component remains unreleased until the package version advances', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  // Isolate this synthetic scenario from whatever real historical releases the checked-in
  // fixture happens to carry -- otherwise a component that has genuinely shipped before (like
  // the 'lr-page' this test strips from the synthetic taggedCurrent) still resolves a since
  // version from history.releases, defeating the "unreleased" assertion below.
  metadata.history.releases = [];
  metadata.history.taggedCurrent = {
    tag: `lyra-ui@${state.packageJson.version}`,
    version: state.packageJson.version,
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '7'.repeat(64),
    tags: metadata.history.current.tags.filter((tag) => tag !== 'lr-page'),
  };

  assert.equal(deriveSinceByTag(metadata.history).has('lr-page'), false);
  assert.equal(
    componentMetadataByTag(metadata, {
      tags: ['lr-page'],
      packageVersion: state.packageJson.version,
    }).get('lr-page').since,
    UNRELEASED_VERSION
  );
});

test('current-tag history reconciliation fails closed on provenance and immutable tag drift', () => {
  const current = {
    version: '8.0.0',
    sourceCommit: null,
    manifestSha256: '8'.repeat(64),
    tags: ['lr-a', 'lr-unreleased'],
  };
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a'],
  };
  const history = { releases: [], taggedCurrent, current };

  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          sourceCommit: 'not-a-commit',
          manifestBlob: 'not-a-blob',
        },
      ]),
    /source commit provenance.*manifest blob provenance/
  );
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          manifestSha256: '7'.repeat(64),
        },
      ]),
    /differs from immutable Git tag evidence/
  );
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          tags: ['lr-other'],
        },
      ]),
    /differs from immutable Git tag evidence/
  );
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          version: '8.0.1',
          tag: 'lyra-ui@8.0.1',
        },
      ]),
    /missing from Git history/
  );
});

test('version comparison is numeric and rejects malformed versions', () => {
  assert.ok(compareVersions('4.10.0', '4.9.0') > 0);
  assert.ok(compareVersions('8.0.0-beta.1', '8.0.0') < 0);
  assert.deepEqual(parseVersion('10.2.3'), {
    major: 10,
    minor: 2,
    patch: 3,
    prerelease: null,
  });
  assert.equal(parseVersion('v8'), null);
});

test('manifest tag discovery ignores non-elements and sorts exact public tags', () => {
  const manifest = {
    modules: [
      {
        declarations: [
          { customElement: true, tagName: 'lr-z' },
          { customElement: false, tagName: 'lr-hidden' },
          { customElement: true, tagName: 'lr-a' },
          { kind: 'class', name: 'Helper' },
        ],
      },
    ],
  };
  assert.deepEqual(manifestComponentTags(manifest), ['lr-a', 'lr-z']);
});

test('validation fails closed on missing assignments and experimental semver exemptions', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.assignments['published-stable'].splice(
    metadata.assignments['published-stable'].indexOf('lr-graph'),
    1
  );
  metadata.policy.semverCoverage.experimental = 'best-effort';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.some((finding) =>
      finding.includes('lr-graph: no authored maturity assignment')
    )
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes(
        'experimental APIs must both retain full semver coverage'
      )
    )
  );
});

test('validation rejects a removal in the immediately following major and a missing replacement', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  const icon = autoWidthRecord(metadata);
  icon.removalNotBefore = '9.0.0';
  icon.replacement.name = 'missingCanvas';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.some((finding) =>
      finding.includes('complete subsequent major release')
    )
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes('replacement property missingCanvas does not exist')
    )
  );
});

test('validation rejects unsorted, pre-introduction, and future deprecation records', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.deprecations.reverse();
  const icon = autoWidthRecord(metadata);
  icon.since = '3.0.0';
  const knownDate = metadata.deprecations.find(
    (entry) => entry.tag === 'lr-known-date' && entry.name === 'label'
  );
  // A version that will realistically never be the real current package version -- this test
  // broke the day the real version became exactly '9.0.0' (the literal it used to hardcode here),
  // since a deprecation dated to exactly the current release is valid, not "after" it.
  knownDate.since = '999.0.0';
  knownDate.removalNotBefore = '1001.0.0';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.includes('deprecations must be sorted by tag, kind, and name')
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes(
        "lr-icon:property:autoWidth: deprecation cannot predate the component's 4.0.0 introduction"
      )
    )
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes(
        'lr-known-date:part:label: deprecation cannot start after the current package version'
      )
    )
  );
});

// Only `part` deprecations remain in the ledger: 9.0.0 removed the last recorded `event` records
// (lr-tool-call-chip/lr-message-parts' `lr-tool-chip-select`) and the last `css-property` one
// (lr-flow-canvas' `--lr-flow-canvas-node-current-outline-color`), all three having reached their
// recorded `removalNotBefore: "9.0.0"`. Re-widen this to the kinds actually present if a future
// release records an event or CSS-property deprecation again.
test('validation covers prose-only part deprecations', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.deprecations = metadata.deprecations.filter(
    (entry) => entry.tag !== 'lr-sparkline'
  );

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.includes(
      'lr-sparkline:part:base: manifest deprecation has no policy record'
    )
  );
});

test('applying metadata changes only maturity records and remains deterministic', () => {
  const state = fixture();
  const stripped = structuredClone(state.inventory);
  for (const component of stripped.components) {
    component.maturity = {
      status: 'unclassified',
      since: null,
      deprecated: null,
    };
  }
  stripped.pins.lyraVersion = '7.8.1';
  const applied = applyMaturityToInventory(state.metadata, stripped);
  const second = applyMaturityToInventory(state.metadata, applied);
  assert.deepEqual(second, applied);
  assert.equal(
    applied.components.find((entry) => entry.tag === 'lr-graph').maturity.since,
    '4.0.0'
  );
  assert.equal(
    applied.components.find((entry) => entry.tag === 'lr-page').maturity.since,
    '8.0.0'
  );
  assert.equal(
    applied.components.find((entry) => entry.tag === 'lr-icon').maturity
      .deprecations.length,
    1
  );
  assert.equal(applied.pins.lyraVersion, state.packageJson.version);
});

test('validation rejects a stale component-inventory Lyra version pin', () => {
  const state = fixture();
  const inventory = structuredClone(state.inventory);
  inventory.pins.lyraVersion = '7.8.1';
  assert.ok(
    validateComponentMetadata(state.metadata, { ...state, inventory }).includes(
      'inventory.pins.lyraVersion must match package.json'
    )
  );
});

test('CEM projection surfaces status, since, policy, and structured member deprecation metadata', () => {
  const state = fixture();
  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });

  const declarations = manifest.modules.flatMap(
    (module) => module.declarations ?? []
  );
  const graph = declarations.find((entry) => entry.tagName === 'lr-graph');
  assert.equal(graph.status, 'stable');
  assert.equal(graph.since, '4.0.0');
  assert.equal(graph.maturity.profile, 'published-stable');
  assert.match(graph.maturity.graduationCriteria, /Already stable/);

  const icon = declarations.find((entry) => entry.tagName === 'lr-icon');
  const autoWidth = icon.members.find(
    (entry) => entry.kind === 'field' && entry.name === 'autoWidth'
  );
  const autoWidthAttribute = icon.attributes.find(
    (entry) => entry.name === 'auto-width'
  );
  // The mirrored autoWidth notice remains; fixedWidth and its CSS alias have retired.
  assert.equal(icon.deprecations.length, 1);
  assert.equal(autoWidth.deprecation.since, '8.0.0');
  assert.deepEqual(autoWidth.deprecation.replacement, {
    kind: 'property',
    name: 'canvas',
    usage: 'canvas="auto"',
  });
  assert.equal(autoWidth.deprecation.removalNotBefore, '10.0.0');
  assert.deepEqual(autoWidthAttribute.deprecation, autoWidth.deprecation);

  const knownDate = declarations.find(
    (entry) => entry.tagName === 'lr-known-date'
  );
  const knownDateLabelPart = knownDate.cssParts.find(
    (entry) => entry.name === 'label'
  );
  assert.deepEqual(knownDateLabelPart.deprecation.replacement, {
    kind: 'part',
    name: 'form-control-label',
    usage: '::part(form-control-label)',
  });
  assert.equal(knownDateLabelPart.deprecation.removalNotBefore, '10.0.0');
  assert.deepEqual(
    validateManifestMetadataProjection(state.metadata, manifest, {
      packageVersion: state.packageJson.version,
    }),
    []
  );
});

test('authored compatibility parts carry deprecation markers before metadata validation', async () => {
  const { manifest: compact } = await generateManifest({ write: false });
  const manifest = expandManifestDeprecations(compact);
  const declarations = new Map(
    manifest.modules
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.tagName)
      .map((declaration) => [declaration.tagName, declaration])
  );

  for (const [tag, parts] of [
    ['lr-file-input', ['base', 'label']],
    ['lr-qr-code', ['base']],
  ]) {
    const declaration = declarations.get(tag);
    assert.ok(declaration, `${tag} declaration`);
    for (const name of parts) {
      const part = declaration.cssParts?.find((entry) => entry.name === name);
      assert.ok(part, `${tag}::part(${name})`);
      assert.match(
        part.description ?? '',
        /^Deprecated\b/i,
        `${tag}::part(${name}) source marker`
      );
      assert.equal(
        part.deprecation?.kind,
        'part',
        `${tag}::part(${name}) structured policy`
      );
      assert.ok(
        part.deprecation?.replacement?.name,
        `${tag}::part(${name}) replacement`
      );
    }
  }
});

test('Storybook presentation exposes central maturity and structured deprecations', () => {
  const state = fixture();
  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });
  const index = buildComponentMetadataIndex(manifest);
  const presentation = componentMetadataPresentation(
    index.get('lr-date-input')
  );

  assert.equal(presentation.status, 'experimental');
  assert.equal(presentation.since, '4.0.0');
  assert.match(
    presentation.rationale,
    /remains experimental under full semver protection/
  );
  assert.match(
    presentation.graduationCriteria,
    /demonstrate sustained reliability/
  );
  assert.deepEqual(
    presentation.deprecations.map((entry) => entry.subject),
    []
  );

  const knownDatePresentation = componentMetadataPresentation(
    index.get('lr-known-date')
  );
  assert.deepEqual(
    knownDatePresentation.deprecations.map((entry) => ({
      subject: entry.subject,
      since: entry.since,
      replacement: entry.replacement,
      removalNotBefore: entry.removalNotBefore,
    })),
    [
      {
        subject: 'part label',
        since: '8.0.0',
        replacement: '::part(form-control-label)',
        removalNotBefore: '10.0.0',
      },
    ]
  );
  assert.equal(componentMetadataPresentation({ status: 'stable' }), null);
});

test('CEM projection reports drift and marks a new assigned tag unreleased once current is tagged', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  // Insert in sorted position, not merely appended: the fixture's own validation requires each
  // assignment list to stay sorted, so an append that happens to land last only passes while the
  // real list's final entry sorts before this one.
  metadata.assignments['new-component-experimental'] = [
    ...metadata.assignments['new-component-experimental'],
    'lr-new-component',
  ].sort((left, right) => String(left).localeCompare(String(right)));
  const resolved = componentMetadataByTag(metadata, {
    tags: ['lr-new-component'],
    packageVersion: state.packageJson.version,
  });
  assert.equal(resolved.get('lr-new-component').status, 'experimental');
  // The checked-in fixture's history.taggedCurrent is the persisted immutable snapshot of what
  // actually shipped at the current package version's release tag. A brand-new tag that isn't
  // part of that snapshot hasn't shipped yet -- it's unreleased until the next version bump, not
  // retroactively "since" a version that already went out without it. That only holds once
  // taggedCurrent is actually populated, though: CI runs this exact suite on the release commit,
  // between bumping package.json and creating the release tag, a window where
  // generate-component-metadata.mjs --write deliberately nulls taggedCurrent out (the just-bumped
  // version genuinely isn't tagged yet -- see reconcileCurrentReleaseHistory's rolloverCurrent
  // branch). In that transient state a brand-new tag is correctly stamped "since: packageVersion"
  // instead (it's shipping in the release being prepared) -- mirror the same taggedCurrent check
  // componentMetadataByTag itself branches on rather than hardcoding the steady-state-only answer.
  assert.equal(
    resolved.get('lr-new-component').since,
    metadata.history?.taggedCurrent
      ? UNRELEASED_VERSION
      : state.packageJson.version
  );

  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });
  const graph = manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-graph');
  graph.since = '8.0.0';
  assert.deepEqual(
    validateManifestMetadataProjection(state.metadata, manifest, {
      packageVersion: state.packageJson.version,
    }),
    ['lr-graph: manifest maturity/deprecation projection drifted']
  );
});

test('the final analyzer plugin projects central metadata into generated CEM', () => {
  const plugin = cemConfig.plugins.find(
    (entry) => entry.name === 'lr-component-maturity-metadata'
  );
  assert.ok(plugin);
  const manifest = {
    modules: [
      {
        declarations: [
          {
            kind: 'class',
            name: 'LyraCard',
            customElement: true,
            tagName: 'lr-card',
          },
        ],
      },
    ],
  };
  plugin.packageLinkPhase({ customElementsManifest: manifest });
  assert.equal(manifest.modules[0].declarations[0].status, 'stable');
  assert.equal(manifest.modules[0].declarations[0].since, '4.0.0');
});

test('message-parts exposes native aria-label without a retired property mapping', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
  const declaration = manifest.modules.flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-message-parts');
  assert.ok(declaration);
  const attribute = declaration.attributes?.find((entry) => entry.name === 'aria-label');
  assert.ok(attribute);
  assert.equal(attribute.type.text, 'string | null');
  assert.equal(Boolean(attribute.deprecated), false);
  assert.equal(attribute.fieldName, undefined);
  assert.equal(declaration.members?.some((entry) => entry.name === 'accessibleLabel'), false);
});

test('the registration analyzer records module-evaluation definitions but ignores lazy helper calls', () => {
  const plugin = cemConfig.plugins.find(
    (entry) => entry.name === 'lr-define-element-registration'
  );
  assert.ok(plugin);
  const SyntaxKind = {
    CallExpression: 1,
    SourceFile: 2,
    FunctionDeclaration: 3,
  };
  const sourceFile = { kind: SyntaxKind.SourceFile, parent: null };
  const expressionStatement = { kind: 99, parent: sourceFile };
  const helperFunction = {
    kind: SyntaxKind.FunctionDeclaration,
    parent: sourceFile,
  };
  const lazyExpressionStatement = { kind: 99, parent: helperFunction };
  const call = (parent) => ({
    kind: SyntaxKind.CallExpression,
    parent,
    expression: { getText: () => 'defineElement' },
    arguments: [{ text: 'fixture' }, { getText: () => 'LyraFixture' }],
  });

  const moduleDoc = { exports: [] };
  plugin.analyzePhase({
    ts: { SyntaxKind },
    node: call(lazyExpressionStatement),
    moduleDoc,
  });
  assert.deepEqual(
    moduleDoc.exports,
    [],
    'a function-scoped helper call is not an import-time definition'
  );

  plugin.analyzePhase({
    ts: { SyntaxKind },
    node: call(expressionStatement),
    moduleDoc,
  });
  assert.deepEqual(moduleDoc.exports, [
    {
      kind: 'custom-element-definition',
      name: 'lr-fixture',
      declaration: { name: 'LyraFixture' },
    },
  ]);
});

test('generated CSS custom-property names are concrete valid identifiers', () => {
  const state = fixture();
  const graph = state.manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-graph');
  const names = graph.cssProperties.map((entry) => entry.name);

  assert.equal(
    names.some((name) => name.includes('..')),
    false
  );
  for (let index = 1; index <= 8; index += 1) {
    assert.ok(
      names.includes(`--lr-graph-cat-${index}`),
      `missing concrete graph palette slot ${index}`
    );
  }
});

test('source annotations replace stale tags on the exact component JSDoc idempotently', () => {
  const source = `/** Helper documentation. */
export class Helper {}

/**
 * Component documentation.
 * @customElement lr-example
 * @status experimental
 * @since 3.8
 */
export class LyraExample {}
`;
  const expected = `/** Helper documentation. */
export class Helper {}

/**
 * Component documentation.
 * @customElement lr-example
 * @status stable
 * @since 4.0.0
 */
export class LyraExample {}
`;
  const annotated = annotateComponentSource(source, {
    tag: 'lr-example',
    status: 'stable',
    since: '4.0.0',
  });
  assert.equal(annotated, expected);
  assert.equal(
    annotateComponentSource(annotated, {
      tag: 'lr-example',
      status: 'stable',
      since: '4.0.0',
    }),
    expected
  );
});

test('source annotation fails closed when the component JSDoc is detached', () => {
  assert.throws(
    () =>
      annotateComponentSource(
        `/**
 * @customElement lr-example
 */
const detached = true;
export class LyraExample {}
`,
        {
          tag: 'lr-example',
          status: 'stable',
          since: '4.0.0',
        }
      ),
    /directly above/
  );
});

// ---------------------------------------------------------------------------------------------
// Deprecations that have not shipped yet, deprecated slot content, and deprecated package exports.
// ---------------------------------------------------------------------------------------------

function recordKey(entry) {
  return `${entry.tag}:${entry.kind}:${entry.name}`;
}

function currentMajor(state) {
  return parseVersion(state.packageJson.version).major;
}

/**
 * The deprecation checks below need `history.taggedCurrent`, which the checked-in fixture carries
 * for every commit between a release tag and the next version bump. A release-preparation run
 * nulls it transiently, so pin a synthetic snapshot instead of depending on that timing.
 */
function withTaggedCurrent(metadata) {
  metadata.history.taggedCurrent ??= {
    tag: `lyra-ui@${metadata.history.current.version}`,
    version: metadata.history.current.version,
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '7'.repeat(64),
    tags: [...metadata.history.current.tags],
  };
  return metadata;
}

/** Inserts or replaces one record, keeping the ledger in its required sorted order. */
function putDeprecation(metadata, record) {
  metadata.deprecations = [
    ...metadata.deprecations.filter((entry) => recordKey(entry) !== recordKey(record)),
    record,
  ].sort((left, right) => recordKey(left).localeCompare(recordKey(right)));
}

/**
 * Re-projects edited metadata into the manifest and inventory, so validation reports only what is
 * wrong with the edit itself rather than the projection drift any metadata edit causes.
 */
function validateEdited(state, metadata, { manifest = state.manifest, packageJson = state.packageJson, readSource } = {}) {
  const projected = structuredClone(manifest);
  applyComponentMetadataToManifest(metadata, projected, { packageVersion: packageJson.version });
  const inventory = applyMaturityToInventory(metadata, state.inventory, {
    packageVersion: packageJson.version,
  });
  return validateComponentMetadata(metadata, {
    inventory,
    manifest: projected,
    packageJson,
    ...(readSource ? { readSource } : {}),
  });
}

function autoWidthRecord(metadata) {
  return metadata.deprecations.find(
    (entry) => entry.tag === 'lr-icon' && entry.kind === 'property' && entry.name === 'autoWidth'
  );
}

test('an unreleased deprecation is valid only while the current release is tagged', () => {
  const state = fixture();
  const metadata = withTaggedCurrent(structuredClone(state.metadata));
  const icon = autoWidthRecord(metadata);
  icon.since = UNRELEASED_VERSION;
  icon.removalNotBefore = `${currentMajor(state) + 2}.0.0`;
  assert.deepEqual(validateEdited(state, metadata), []);

  // The floor is measured from the current major: the earliest release that can ship the record.
  icon.removalNotBefore = `${currentMajor(state) + 1}.0.0`;
  assert.ok(
    validateEdited(state, metadata).includes(
      'lr-icon:property:autoWidth: removalNotBefore must preserve the API through 1 complete subsequent major release(s)'
    )
  );

  // Without a tagged current release there is no "after the tag" to be unreleased relative to.
  icon.removalNotBefore = `${currentMajor(state) + 2}.0.0`;
  metadata.history.taggedCurrent = null;
  assert.ok(
    validateEdited(state, metadata).includes(
      'lr-icon:property:autoWidth: an unreleased deprecation is only valid while history.taggedCurrent records the current release'
    )
  );
});

test('a version rollover stamps unreleased deprecations with the released version', () => {
  const metadata = {
    deprecations: [
      { tag: 'lr-a', kind: 'part', name: 'x', since: UNRELEASED_VERSION },
      { tag: 'lr-b', kind: 'part', name: 'y', since: '8.0.0' },
    ],
    exportDeprecations: [
      { kind: 'entry-point', name: './a.js', since: UNRELEASED_VERSION },
    ],
  };
  const stamped = stampUnreleasedDeprecations(metadata, '9.9.0');
  assert.deepEqual(stamped.deprecations.map((entry) => entry.since), ['9.9.0', '8.0.0']);
  assert.deepEqual(stamped.exportDeprecations.map((entry) => entry.since), ['9.9.0']);
  assert.equal(metadata.deprecations[0].since, UNRELEASED_VERSION, 'the input is not mutated');
  assert.equal(metadata.exportDeprecations[0].since, UNRELEASED_VERSION, 'the input is not mutated');
  assert.throws(() => stampUnreleasedDeprecations(metadata, UNRELEASED_VERSION), /released version/);
});

test('the metadata write stamps unreleased deprecations only on a version rollover', () => {
  const metadata = {
    deprecations: [{ tag: 'lr-a', kind: 'part', name: 'x', since: UNRELEASED_VERSION }],
    exportDeprecations: [{ kind: 'entry-point', name: './a.js', since: UNRELEASED_VERSION }],
    history: { source: 'git-release-manifests', releases: [], taggedCurrent: { tag: 'lyra-ui@9.8.0' } },
  };
  const history = {
    releases: [{ tag: 'lyra-ui@9.8.0' }],
    taggedCurrent: null,
    current: { version: '9.9.0' },
  };

  const rolled = nextWriteMetadata(metadata, { ...history, rolloverCurrent: true, packageVersion: '9.9.0' });
  assert.equal(rolled.deprecations[0].since, '9.9.0');
  assert.equal(rolled.exportDeprecations[0].since, '9.9.0');
  assert.deepEqual(rolled.history, { source: 'git-release-manifests', ...history });

  const same = nextWriteMetadata(metadata, {
    ...history,
    taggedCurrent: metadata.history.taggedCurrent,
    rolloverCurrent: false,
    packageVersion: '9.8.0',
  });
  assert.equal(same.deprecations[0].since, UNRELEASED_VERSION);
  assert.equal(same.exportDeprecations[0].since, UNRELEASED_VERSION);
});

test('a stamped rollover into a new major fails closed on a removal floor set before it', () => {
  const state = fixture();
  const metadata = withTaggedCurrent(structuredClone(state.metadata));
  const major = currentMajor(state);
  const icon = autoWidthRecord(metadata);
  icon.since = UNRELEASED_VERSION;
  icon.removalNotBefore = `${major + 2}.0.0`;

  const rollover = (version) => {
    const rolled = stampUnreleasedDeprecations(metadata, version);
    rolled.history = {
      ...rolled.history,
      releases: [...rolled.history.releases, rolled.history.taggedCurrent],
      taggedCurrent: null,
      current: { ...rolled.history.current, version },
    };
    const packageJson = { ...state.packageJson, version };
    return validateComponentMetadata(rolled, { ...state, packageJson }).filter((finding) =>
      finding.startsWith('lr-icon:property:autoWidth:'));
  };

  assert.deepEqual(rollover(`${major}.${parseVersion(state.packageJson.version).minor + 1}.0`), []);
  assert.deepEqual(rollover(`${major + 1}.0.0`), [
    'lr-icon:property:autoWidth: removalNotBefore must preserve the API through 1 complete subsequent major release(s)',
  ]);
});

test('a host inline-size declaration is an accepted host CSS replacement', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  const icon = autoWidthRecord(metadata);
  icon.replacement = {
    kind: 'host-css-property',
    name: 'inline-size',
    usage: 'lr-icon { inline-size: var(--lr-size-1-5em); }',
  };
  assert.deepEqual(validateEdited(state, metadata), []);

  icon.replacement.name = 'margin';
  assert.ok(
    validateEdited(state, metadata).includes(
      'lr-icon:property:autoWidth: unsupported host CSS replacement margin'
    )
  );
});

function menuSlotContentFixture(state, description) {
  const metadata = withTaggedCurrent(structuredClone(state.metadata));
  const record = {
    tag: 'lr-menu',
    kind: 'slot-content',
    name: '',
    permittedContent: ['hr', 'lr-divider', 'lr-menu-item', 'lr-menu-label'],
    since: UNRELEASED_VERSION,
    replacement: { kind: 'slot', name: 'header', usage: 'slot="header"' },
    removalNotBefore: `${currentMajor(state) + 2}.0.0`,
    rationale: 'Other content renders inside the menu list without a menu-item role.',
  };
  putDeprecation(metadata, record);
  const manifest = structuredClone(state.manifest);
  const menu = manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-menu');
  menu.slots.find((entry) => entry.name === '').description = description;
  return { metadata, manifest, record };
}

const DOCUMENTED_MENU_SLOT =
  'Menu items, labels and separators. Any other content here is deprecated; use the header or footer slot.';

test('slot-content records deprecate usage of a surviving, documented slot', () => {
  const state = fixture();
  const { metadata, manifest } = menuSlotContentFixture(state, DOCUMENTED_MENU_SLOT);
  assert.deepEqual(validateEdited(state, metadata, { manifest }), []);

  const projected = structuredClone(manifest);
  applyComponentMetadataToManifest(metadata, projected, {
    packageVersion: state.packageJson.version,
  });
  const menu = projected.modules
    .flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-menu');
  assert.equal(
    menu.slots.find((entry) => entry.name === '').deprecation,
    undefined,
    'the slot itself survives, so it never carries a member deprecation'
  );
  assert.deepEqual(
    menu.deprecations.filter((entry) => entry.kind === 'slot-content').map((entry) => entry.name),
    ['']
  );
});

test('slot-content records reject an undocumented, deprecated, or missing slot', () => {
  const state = fixture();
  const findingsFor = (description, edit = () => {}) => {
    const { metadata, manifest, record } = menuSlotContentFixture(state, description);
    edit(record);
    putDeprecation(metadata, record);
    return validateComponentMetadata(metadata, { ...state, manifest }).filter((finding) =>
      finding.startsWith(`${recordKey(record)}:`));
  };

  assert.deepEqual(findingsFor('Menu items, labels and separators.'), [
    'lr-menu:slot-content:: the slot description must say which content is deprecated',
  ]);
  assert.deepEqual(findingsFor('Deprecated. Put this content in the header slot.'), [
    'lr-menu:slot-content:: the slot itself is deprecated; record a slot deprecation instead',
  ]);
  assert.ok(
    findingsFor(DOCUMENTED_MENU_SLOT, (record) => {
      record.name = 'missing';
    }).includes('lr-menu:slot-content:missing: slot missing does not exist')
  );
});

test('slot-content permitted content is a sorted list of known element names', () => {
  const state = fixture();
  const findingsFor = (permittedContent) => {
    const { metadata, manifest, record } = menuSlotContentFixture(state, DOCUMENTED_MENU_SLOT);
    if (permittedContent === undefined) delete record.permittedContent;
    else record.permittedContent = permittedContent;
    putDeprecation(metadata, record);
    return validateEdited(state, metadata, { manifest });
  };

  assert.deepEqual(findingsFor(undefined), [], 'permittedContent is optional');
  assert.deepEqual(findingsFor(['lr-menu-item', 'hr']), [
    'lr-menu:slot-content:: permittedContent must be sorted and unique',
  ]);
  assert.deepEqual(findingsFor([]), [
    'lr-menu:slot-content:: permittedContent must be a non-empty array when present',
  ]);
  // The ledger sorts with localeCompare, which orders case-insensitively first.
  assert.deepEqual(findingsFor(['lr-not-a-component', 'Not An Element']), [
    'lr-menu:slot-content:: permitted content lr-not-a-component is not a known component',
    'lr-menu:slot-content:: permitted content Not An Element is not an element name',
  ]);
});

test('deprecation subjects name the default slot and the content a slot-content record covers', () => {
  assert.equal(formatDeprecationSubject({ kind: 'component', name: 'lr-a' }, 'lr-a'), '`lr-a`');
  assert.equal(
    formatDeprecationSubject({ kind: 'property', name: 'fixedWidth', attribute: 'fixed-width' }, 'lr-a'),
    '`fixedWidth` / `fixed-width`'
  );
  assert.equal(formatDeprecationSubject({ kind: 'slot', name: '' }, 'lr-a'), 'default slot');
  assert.equal(formatDeprecationSubject({ kind: 'slot', name: 'icon' }, 'lr-a'), '`icon`');
  assert.equal(formatDeprecationSubject({ kind: 'slot-content', name: '' }, 'lr-a'), 'default-slot content');
  assert.equal(
    formatDeprecationSubject({ kind: 'slot-content', name: 'footer', permittedContent: ['hr', 'lr-divider'] }, 'lr-a'),
    '`footer`-slot content other than `<hr>`, `<lr-divider>`'
  );
});

test('Storybook presentation names the default slot and slot-content subjects', () => {
  const presentation = componentMetadataPresentation({
    tagName: 'lr-a',
    status: 'stable',
    since: '4.0.0',
    deprecations: [
      { kind: 'slot', name: '', since: '8.0.0', replacement: { kind: 'slot', name: 'start' } },
      {
        kind: 'slot-content',
        name: '',
        permittedContent: ['hr', 'lr-menu-item'],
        since: UNRELEASED_VERSION,
        replacement: { kind: 'slot', name: 'header' },
      },
    ],
  });
  assert.deepEqual(
    presentation.deprecations.map((entry) => entry.subject),
    ['default slot', 'default-slot content other than <hr>, <lr-menu-item>']
  );
});

const EXPORTS_FIXTURE = {
  '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
  './current.js': { types: './dist/current.d.ts', default: './dist/current.js' },
  './legacy.js': './dist/legacy.js',
  './theme/*': './dist/theme/*',
  './types.js': './dist/types.js',
  './functions.js': './dist/functions.js',
  './themes/*': './dist/themes/*',
  './theme/private/*': null,
  './utilities/*': null,
};

const EXPORT_SOURCES = {
  'src/functions.ts': [
    '/** @deprecated Use current. */',
    'export function legacy() {}',
    'export function current() {}',
    'export interface Options {}',
    '/** @deprecated Use currentValue. */',
    'export const oldValue = 1;',
    'export const currentValue = 2;',
    '/** @deprecated Import CurrentElement from its class module. */',
    'export class LegacyElement {}',
    'export class CurrentElement {}',
    'declare global { interface WindowEventMap { "lr-old": Event; "lr-current": Event; } }',
    'document.documentElement.setAttribute("data-lr-old", "");',
    'document.documentElement.setAttribute("data-lr-current", "");',
  ].join('\n'),
  'src/current.ts': "export { LyraThing } from './thing.js';\n",
  'src/legacy.ts': "export * from './current.js';\n",
  'src/theme/legacy.ts': 'export const value = 1;',
  'src/themes/legacy.css': ':root { color: inherit; }',
  'src/themes/current.css': ':root { color: inherit; }',
  'src/types.ts': [
    '/** A file. @deprecated Use LyraFile. */',
    'export interface File { readonly name: string }',
    '/** A file. */',
    'export interface LyraFile { readonly name: string }',
    '/** Same as LyraFile. */',
    'export type Alias = LyraFile;',
    '/** @deprecated Use LyraFile. */',
    'export const value = 1;',
    '',
  ].join('\n'),
};

function readExportSource(relativePath) {
  return EXPORT_SOURCES[relativePath] ?? null;
}

function exportDeprecation(state, fields) {
  return {
    since: UNRELEASED_VERSION,
    removalNotBefore: `${currentMajor(state) + 2}.0.0`,
    rationale: 'The replacement exposes the same bindings under the canonical name.',
    ...fields,
  };
}

function exportFindings(state, records, { readSource = readExportSource } = {}) {
  const metadata = withTaggedCurrent(structuredClone(state.metadata));
  metadata.exportDeprecations = records;
  const packageJson = { ...state.packageJson, exports: EXPORTS_FIXTURE };
  return validateEdited(state, metadata, { packageJson, readSource });
}

const LEGACY_ENTRY = {
  kind: 'entry-point',
  name: './legacy.js',
  replacement: { kind: 'entry-point', name: './current.js', usage: "import '@aceshooting/lyra-ui/current.js';" },
};

const FILE_TYPE = {
  kind: 'type',
  module: './types.js',
  name: 'File',
  replacement: {
    kind: 'type',
    name: 'LyraFile',
    usage: "import type { LyraFile } from '@aceshooting/lyra-ui/types.js';",
  },
};

test('named runtime exports have individual deprecation records without retiring their module', () => {
  const state = fixture();
  for (const [kind, name, replacement] of [
    ['function', 'legacy', 'current'],
    ['constant', 'oldValue', 'currentValue'],
    ['class', 'LegacyElement', 'CurrentElement'],
  ]) {
    const record = exportDeprecation(state, {
      kind, module: './functions.js', name,
      replacement: { kind, name: replacement },
    });
    assert.deepEqual(exportFindings(state, [record]), []);
    assert.ok(exportFindings(state, [{ ...record, name: 'current' }])
      .some(finding => finding.includes('has no @deprecated JSDoc')));
    assert.ok(exportFindings(state, [{ ...record, name: 'Options' }])
      .some(finding => finding.includes('not a runtime value export')));
    assert.ok(exportFindings(state, [{ ...record, replacement: { kind, name: 'Options' } }])
      .some(finding => finding.includes('not a runtime value export')));
    assert.ok(exportFindings(state, [{ ...record, replacement: { kind, name } }])
      .some(finding => finding.includes('is itself deprecated')));
  }
});

test('the metadata schema carries a top-level exportDeprecations ledger', () => {
  const state = fixture();
  assert.equal(state.metadata.schemaVersion, 2);
  assert.ok(Array.isArray(state.metadata.exportDeprecations));

  const metadata = structuredClone(state.metadata);
  delete metadata.exportDeprecations;
  metadata.schemaVersion = 1;
  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(findings.includes('exportDeprecations must be an array'));
  assert.ok(findings.includes('schemaVersion must be 2'));
});

test('export deprecations validate entry points against package exports and sources', () => {
  const state = fixture();
  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, LEGACY_ENTRY), exportDeprecation(state, FILE_TYPE)]),
    []
  );

  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, { ...LEGACY_ENTRY, name: './missing.js' })]),
    ['exportDeprecations entry-point ./missing.js: ./missing.js is not a package export']
  );
  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, { ...LEGACY_ENTRY, name: './theme/*' })]),
    ['exportDeprecations entry-point ./theme/*: ./theme/* must name one exact export, not a pattern']
  );
  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, LEGACY_ENTRY)], {
      readSource: (relativePath) => (relativePath === 'src/legacy.ts' ? null : readExportSource(relativePath)),
    }),
    ['exportDeprecations entry-point ./legacy.js: ./legacy.js has no TypeScript source at src/legacy.ts']
  );
  assert.deepEqual(
    exportFindings(state, [
      exportDeprecation(state, {
        ...LEGACY_ENTRY,
        replacement: { ...LEGACY_ENTRY.replacement, name: './gone.js' },
      }),
    ]),
    ['exportDeprecations entry-point ./legacy.js: replacement entry point ./gone.js is not a package export']
  );
  assert.deepEqual(
    exportFindings(state, [
      exportDeprecation(state, {
        ...LEGACY_ENTRY,
        name: './current.js',
        replacement: { ...LEGACY_ENTRY.replacement, name: './legacy.js' },
      }),
      exportDeprecation(state, LEGACY_ENTRY),
    ]),
    [
      'exportDeprecations entry-point ./current.js: replacement ./legacy.js is itself deprecated',
      'exportDeprecations entry-point ./legacy.js: replacement ./current.js is itself deprecated',
    ]
  );
  assert.deepEqual(
    exportFindings(state, [
      exportDeprecation(state, { ...LEGACY_ENTRY, replacement: { kind: 'type', name: 'LyraFile' } }),
    ]),
    ['exportDeprecations entry-point ./legacy.js: replacement must be another entry point']
  );
});

test('export deprecations resolve concrete wildcard paths and stylesheet sources', () => {
  const state = fixture();
  const path = exportDeprecation(state, { ...LEGACY_ENTRY, name: './theme/legacy.js' });
  assert.deepEqual(exportFindings(state, [path]), []);
  assert.ok(exportFindings(state, [{ ...path, name: './theme/private/legacy.js' }])
    .some(finding => finding.includes('is not a package export')));
  assert.ok(exportFindings(state, [{ ...path, name: './theme/../legacy.js' }])
    .some(finding => finding.includes('is not a package export')));
  const stylesheet = exportDeprecation(state, {
    kind: 'stylesheet', name: './themes/legacy.css',
    replacement: { kind: 'stylesheet', name: './themes/current.css' },
  });
  assert.deepEqual(exportFindings(state, [stylesheet]), []);
  assert.ok(exportFindings(state, [{ ...stylesheet, name: './theme/legacy.js' }])
    .some(finding => finding.includes('does not resolve to a built CSS stylesheet')));
});

test('global DOM deprecations validate owner modules and actual syntax rather than comments', () => {
  const state = fixture();
  for (const [kind, name, replacement] of [
    ['window-event', 'lr-old', 'lr-current'],
    ['root-attribute', 'data-lr-old', 'data-lr-current'],
  ]) {
    const record = exportDeprecation(state, {
      kind, module: './functions.js', name,
      replacement: { kind, name: replacement },
    });
    assert.deepEqual(exportFindings(state, [record]), []);
    assert.ok(exportFindings(state, [record], { readSource: () => `// ${name}\n// ${replacement}` })
      .some(finding => finding.includes('is not declared or used')));
    assert.ok(exportFindings(state, [{ ...record, replacement: { kind, name } }])
      .some(finding => finding.includes('is itself deprecated')));
  }
});

test('export deprecations validate type records against the declaring source', () => {
  const state = fixture();
  const typeFindings = (fields) =>
    exportFindings(state, [exportDeprecation(state, { ...FILE_TYPE, ...fields })]);

  assert.deepEqual(typeFindings({ name: 'Alias' }), [
    'exportDeprecations type ./types.js#Alias: Alias has no @deprecated JSDoc directly above its export',
  ]);
  assert.deepEqual(typeFindings({ name: 'Missing' }), [
    'exportDeprecations type ./types.js#Missing: ./types.js does not export Missing',
  ]);
  assert.deepEqual(typeFindings({ name: 'value' }), [
    'exportDeprecations type ./types.js#value: value is not a type-only export',
  ]);
  assert.deepEqual(typeFindings({ replacement: { ...FILE_TYPE.replacement, name: 'Nope' } }), [
    'exportDeprecations type ./types.js#File: replacement type Nope is not exported by ./types.js',
  ]);
  assert.deepEqual(
    typeFindings({ name: 'LyraFile', replacement: { ...FILE_TYPE.replacement, name: 'File' } }),
    [
      'exportDeprecations type ./types.js#LyraFile: LyraFile has no @deprecated JSDoc directly above its export',
      'exportDeprecations type ./types.js#LyraFile: replacement type File is itself deprecated',
    ]
  );
  assert.deepEqual(typeFindings({ module: './missing.js' }), [
    'exportDeprecations type ./missing.js#File: ./missing.js is not a package export',
  ]);
});

/** Every exported name of one source module, with whether the export is type-only. */
function sourceExportKinds(relativePath, source = fs.readFileSync(path.join(packageDir, relativePath), 'utf8')) {
  const parsed = parseSync(relativePath, source);
  assert.deepEqual(parsed.errors, [], `${relativePath} parses`);
  const kinds = new Map();
  for (const statement of parsed.module.staticExports) {
    for (const entry of statement.entries) {
      if (entry.exportName?.name) kinds.set(entry.exportName.name, entry.isType === true);
    }
  }
  return kinds;
}

test('the retired localization route preserves its published replacement bindings', async () => {
  const { checkPublishedCompatibility } = await import('./check-published-compatibility.mjs');
  const { decodeEvidence, sha256 } = await import('./published-compatibility-io.mjs');
  const history = path.join(packageDir, 'scripts/fixtures/compatibility-history');
  const verified = await checkPublishedCompatibility(history);
  const { capture, facts } = verified.captures[0];
  const record = facts.records.find(entry => entry.key.scope === 'export' && entry.key.kind === 'entry-point' && entry.key.name === './utilities/localization.js');
  assert.equal(record.policy.replacement.kind, 'entry-point');
  assert.equal(record.policy.replacement.name, './localization.js');
  assert.match(record.policy.replacement.usage, /from '@aceshooting\/lyra-ui\/localization\.js'/);
  assert.equal(record.policy.removalNotBefore, '23.0.0');
  assert.ok(verified.retirements.some(entry => entry.key.scope === 'export' && entry.key.name === './utilities/localization.js' && entry.removedIn === '23.0.0'));
  const state = fixture();
  assert.ok(!state.metadata.exportDeprecations.some(entry => entry.kind === 'entry-point' && entry.name === './utilities/localization.js'));
  assert.equal(fs.existsSync(path.join(packageDir, 'src/utilities/localization.ts')), false);
  assert.equal(state.packageJson.exports['./utilities/localization.js'], undefined);

  const evidence = fs.readFileSync(path.join(history, '22.0.0/evidence.json.gz'));
  assert.equal(sha256(evidence), capture.evidenceArchiveSha256);
  const archive = decodeEvidence(evidence);
  const input = capture.inputs.find(entry => entry.origin === 'source-export' && entry.path === 'packages/lyra-ui/src/localization.ts');
  const source = Buffer.from(archive.payloads[input.sha256], 'base64');
  assert.equal(sha256(source), input.sha256);
  // Preserve all published canonical bindings, including the former utility re-exports.
  const published = sourceExportKinds('src/localization.ts', source.toString('utf8'));
  const replacement = sourceExportKinds('src/localization.ts');
  assert.ok(published.size > 0);
  for (const [name, isType] of published) {
    assert.ok(replacement.has(name), `src/localization.ts must still export ${name}`);
    assert.equal(replacement.get(name), isType, `${name} keeps its published value/type kind`);
  }
});

test('export deprecations share the ledger ordering, window, rationale, and replacement rules', () => {
  const state = fixture();
  const major = currentMajor(state);
  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, FILE_TYPE), exportDeprecation(state, LEGACY_ENTRY)]),
    ['exportDeprecations must be sorted by kind, module, and name']
  );
  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, LEGACY_ENTRY), exportDeprecation(state, LEGACY_ENTRY)]),
    ['exportDeprecations entry-point ./legacy.js: duplicate deprecation record']
  );
  assert.deepEqual(
    exportFindings(state, [
      exportDeprecation(state, {
        ...LEGACY_ENTRY,
        removalNotBefore: `${major + 1}.0.0`,
        rationale: 'short',
        replacement: undefined,
      }),
    ]),
    [
      'exportDeprecations entry-point ./legacy.js: deprecation must name a replacement',
      'exportDeprecations entry-point ./legacy.js: deprecation needs a rationale',
      'exportDeprecations entry-point ./legacy.js: removalNotBefore must preserve the API through 1 complete subsequent major release(s)',
    ]
  );
  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, { ...LEGACY_ENTRY, since: '999.0.0', removalNotBefore: '1001.0.0' })]),
    ['exportDeprecations entry-point ./legacy.js: deprecation cannot start after the current package version']
  );
  assert.deepEqual(
    exportFindings(state, [exportDeprecation(state, { ...LEGACY_ENTRY, kind: 'module' })]),
    ['exportDeprecations module ./legacy.js: kind must be entry-point, stylesheet, type, function, constant, class, window-event, root-attribute']
  );
});
