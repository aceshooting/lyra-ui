import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyReviewedExceptions, diffPublicApi, minimumRequiredBump, normalizePublicApi,
} from './public-api-diff.mjs';

// Semantic rules: a change is only breaking when a consumer can observe a loss. Each rule below is
// paired with the real break it must keep reporting.

function packageFixture(files, exports = { './sample.js': './dist/sample.js' }) {
  return normalizePublicApi({
    packageJson: { name: 'sample', version: '1.0.0', exports },
    manifest: { modules: [] },
    declarations: {
      files,
      packageFiles: Object.keys(files).flatMap((file) => [file, file.replace('.d.ts', '.js')]),
    },
  });
}

const bump = (before, after) => minimumRequiredBump(diffPublicApi(before, after));

function litFixture(own) {
  return packageFixture({
    'dist/sample.d.ts': `import { LitElement, type PropertyValues } from 'lit';
      export declare class Sample extends LitElement { value: string; ${own} }`,
  });
}

test('removing a redundant lifecycle override still inherited from LitElement is not breaking', () => {
  const plain = litFixture('');
  for (const own of [
    'protected updated(changed: PropertyValues): void;',
    'protected willUpdate(changed: PropertyValues): void;',
    'connectedCallback(): void; disconnectedCallback(): void;',
  ]) {
    assert.notEqual(bump(litFixture(own), plain), 'major', own);
    assert.notEqual(bump(plain, litFixture(own)), 'major', own);
  }
});

test('a removed member that no ancestor provides, or a changed override, stays breaking', () => {
  const plain = litFixture('');
  for (const own of [
    'refresh(): void;',
    'updated(changed: PropertyValues): void;',
    'protected updated(changed: PropertyValues): string;',
    'protected requestUpdateLater(): void;',
  ]) {
    assert.equal(bump(litFixture(own), plain), 'major', own);
  }
  assert.equal(bump(plain, litFixture('protected updated(changed: string): void;')), 'major');
});

function mixinFixture(own, mixinMembers = 'checked: boolean;', baseMembers = 'connectedCallback(): void; label: string;') {
  return packageFixture({
    'dist/base.d.ts': `export declare class Base { ${baseMembers} }
      export interface Mixin { ${mixinMembers} }`,
    'dist/sample.d.ts': `import { Base, type Mixin } from './base.js';
      declare const Sample_base: typeof Base & (new (...args: any[]) => Mixin);
      export declare class Sample extends Sample_base { ${own} }`,
  });
}

test('members inherited through a mixin constructor keep a removed override reachable', () => {
  assert.notEqual(bump(mixinFixture('connectedCallback(): void;'), mixinFixture('')), 'major');
  assert.notEqual(bump(mixinFixture('label: string;'), mixinFixture('')), 'major');
});

test('a mixin that redeclares the name, or one that cannot be resolved, keeps the removal breaking', () => {
  assert.equal(bump(
    mixinFixture('connectedCallback(): void;', 'connectedCallback(): void;'),
    mixinFixture('', 'connectedCallback(): void;'),
  ), 'major');
  const unresolved = (own) => packageFixture({
    'dist/base.d.ts': 'export declare class Base { connectedCallback(): void; }',
    'dist/sample.d.ts': `import { Base } from './base.js'; import type { Mixin } from 'elsewhere';
      declare const Sample_base: typeof Base & (new (...args: any[]) => Mixin);
      export declare class Sample extends Sample_base { ${own} }`,
  });
  assert.equal(bump(unresolved('connectedCallback(): void;'), unresolved('')), 'major');
});

function movedFieldFixture(own, base) {
  return packageFixture({
    'dist/base.d.ts': `export declare class Base { ${base} }`,
    'dist/sample.d.ts': `import { Base } from './base.js';
      export declare class Sample extends Base { ${own} }`,
  });
}

test('a field that becomes an inherited accessor with the same type and writability is not breaking', () => {
  assert.notEqual(bump(
    movedFieldFixture('collapsed: boolean;', ''),
    movedFieldFixture('', 'get collapsed(): boolean; set collapsed(value: boolean);'),
  ), 'major');
  assert.notEqual(bump(
    movedFieldFixture('collapsed: boolean;', ''),
    movedFieldFixture('', 'collapsed: boolean;'),
  ), 'major');
});

test('an inherited replacement that is read-only, retyped or hidden stays breaking', () => {
  for (const base of [
    'get collapsed(): boolean;',
    'collapsed: string;',
    'protected collapsed: boolean;',
    'private collapsed;',
  ]) {
    assert.equal(bump(movedFieldFixture('collapsed: boolean;', ''), movedFieldFixture('', base)), 'major', base);
  }
});

test('an inherited member is projected only when its named types mean the same in both scopes', () => {
  const fixture = (own, derivedImport) => packageFixture({
    'dist/kinds.d.ts': "export type Strategy = 'a' | 'b';",
    'dist/other.d.ts': "export type Strategy = 'z';",
    'dist/base.d.ts': `import type { Strategy } from './kinds.js';
      export declare class Base { protected moved(next: Strategy): void; }`,
    'dist/sample.d.ts': `import { Base } from './base.js'; import type { Strategy } from '${derivedImport}';
      export declare class Sample extends Base { ${own} }`,
  });
  const own = 'protected moved(next: Strategy): void;';
  assert.notEqual(bump(fixture(own, './kinds.js'), fixture('', './kinds.js')), 'major');
  assert.equal(bump(fixture(own, './other.js'), fixture('', './other.js')), 'major');
});

function eventFixture(detail) {
  return packageFixture({
    'dist/sample.d.ts': `export interface Base { id: string; }
      export interface SampleEventMap { 'lr-sample': CustomEvent<${detail}>; }`,
  });
}

test('an optional event-detail field added beside an intersection member is minor', () => {
  assert.equal(bump(eventFixture('Base & { args?: unknown }'),
    eventFixture('Base & { args?: unknown; waitUntil?: number }')), 'minor');
});

test('a required event-detail field, a removed one or a changed one stays breaking', () => {
  const before = eventFixture('Base & { args?: unknown }');
  for (const detail of [
    'Base & { args?: unknown; waitUntil: number }',
    'Base & {}',
    'Base & { args?: string }',
    '{ args?: unknown; waitUntil?: number }',
  ]) {
    assert.equal(bump(before, eventFixture(detail)), 'major', detail);
  }
});

function aliasFixture(field, extra = '') {
  return packageFixture({
    'dist/sample.d.ts': `${extra}
      export interface Detail { readonly via: ${field}; }`,
  });
}

test('extracting an alias for an identical union is not a change', () => {
  const changes = diffPublicApi(aliasFixture("'back' | 'goto' | 'next'"),
    aliasFixture('Navigation', "type Navigation = 'next' | 'back' | 'goto';"));
  assert.notEqual(minimumRequiredBump(changes), 'major');
  assert.ok(changes.every((change) => change.bump !== 'major'));
});

test('an extracted alias that narrows, or one that is ambiguous, stays breaking', () => {
  assert.equal(bump(aliasFixture("'back' | 'goto' | 'next'"),
    aliasFixture('Navigation', "type Navigation = 'back' | 'next';")), 'major');
  const ambiguous = packageFixture({
    'dist/sample.d.ts': `import type { Navigation } from './a.js';
      export interface Detail { readonly via: Navigation; }`,
    'dist/a.d.ts': "export type Navigation = 'back' | 'goto' | 'next';",
    'dist/b.d.ts': "export type Navigation = 'other';",
    'dist/c.d.ts': "export type { Navigation as Other } from './b.js';",
  }, { './sample.js': './dist/sample.js', './c.js': './dist/c.js' });
  assert.equal(bump(aliasFixture("'back' | 'goto' | 'next'"), ambiguous), 'major');
});

function unitsFixture(file, declarations) {
  return packageFixture({ 'dist/sample.d.ts': `export * from './${file}.js';`, [`dist/${file}.d.ts`]: declarations },
    { './sample.js': './dist/sample.js' });
}

test('a function moved to another module with an identically resolving signature is not breaking', () => {
  const before = unitsFixture('file-size', `declare const BYTE_UNITS: readonly ['B', 'KB'];
    export declare function formatSize(bytes: number, unit?: (typeof BYTE_UNITS)[number]): string;`);
  const after = unitsFixture('bytes', `declare const SIZE_UNITS: readonly ['B', 'KB'];
    export type SizeUnit = (typeof SIZE_UNITS)[number];
    export declare function formatSize(bytes: number, unit?: SizeUnit): string;`);
  assert.notEqual(bump(before, after), 'major');
});

test('a moved function whose resolved parameter or return type changed stays breaking', () => {
  const before = unitsFixture('file-size', `declare const BYTE_UNITS: readonly ['B', 'KB'];
    export declare function formatSize(bytes: number, unit?: (typeof BYTE_UNITS)[number]): string;`);
  for (const declarations of [
    `declare const SIZE_UNITS: readonly ['B'];
      export type SizeUnit = (typeof SIZE_UNITS)[number];
      export declare function formatSize(bytes: number, unit?: SizeUnit): string;`,
    `declare const SIZE_UNITS: readonly ['B', 'KB'];
      export type SizeUnit = (typeof SIZE_UNITS)[number];
      export declare function formatSize(bytes: number, unit: SizeUnit): string;`,
    `declare const SIZE_UNITS: readonly ['B', 'KB'];
      export type SizeUnit = (typeof SIZE_UNITS)[number];
      export declare function formatSize(bytes: number, unit?: SizeUnit): number;`,
  ]) {
    assert.equal(bump(before, unitsFixture('bytes', declarations)), 'major', declarations);
  }
});

function internalMoveFixture(file, hooks, retainOriginal = false) {
  const files = {
    'dist/sample.d.ts': `import type { Hooks } from './${file}.js';
      export declare function attach(hooks: Hooks): void;`,
    [`dist/${file}.d.ts`]: `export interface Hooks { ${hooks} }`,
  };
  if (!retainOriginal) return packageFixture(files);
  files['dist/anchor.d.ts'] = 'export interface Hooks { onAnchor(): void; }';
  return packageFixture(files, { './sample.js': './dist/sample.js', './anchor.js': './dist/anchor.js' });
}

test('an unexported declaration moved between internal modules is compared, not removed', () => {
  assert.notEqual(bump(internalMoveFixture('anchor', 'onAnchor(): void;'),
    internalMoveFixture('anchor-base', 'onAnchor(): void;')), 'major');
  assert.equal(bump(internalMoveFixture('anchor', 'onAnchor(): void;'),
    internalMoveFixture('anchor-base', 'onAnchor(): void; onMove(): void;')), 'minor');
});

test('a moved internal declaration that lost a member, or a rewiring to a surviving namesake, stays breaking', () => {
  assert.equal(bump(internalMoveFixture('anchor', 'onAnchor(): void; onMove(): void;'),
    internalMoveFixture('anchor-base', 'onAnchor(): void;')), 'major');
  // The original is still public, so pointing at a same-named declaration elsewhere is a rewiring.
  assert.equal(bump(packageFixture({
    'dist/sample.d.ts': `import type { Hooks } from './anchor.js';
      export declare function attach(hooks: Hooks): void;`,
    'dist/anchor.d.ts': 'export interface Hooks { onAnchor(): void; }',
  }, { './sample.js': './dist/sample.js', './anchor.js': './dist/anchor.js' }),
  internalMoveFixture('anchor-base', 'onAnchor(): void;', true)), 'major');
});

function heritageFixture(clause, own = '') {
  return packageFixture({
    'dist/sample.d.ts': `export interface PanelEventMap { 'lr-toggle': CustomEvent<string>; 'lr-open': CustomEvent<number>; 'lr-close': Event; }
      export interface SampleEventMap extends ${clause} { 'lr-select': Event; ${own} }`,
  });
}

test('interface heritage that omits a key the interface redeclares itself is not breaking', () => {
  assert.notEqual(bump(heritageFixture("Omit<PanelEventMap, 'lr-toggle'>", "'lr-toggle': CustomEvent<boolean>;"),
    heritageFixture("Omit<PanelEventMap, 'lr-toggle' | 'lr-open'>",
      "'lr-toggle': CustomEvent<boolean>; 'lr-open': CustomEvent<number>;")), 'major');
  assert.notEqual(bump(heritageFixture("Pick<PanelEventMap, 'lr-open'>"),
    heritageFixture("Pick<PanelEventMap, 'lr-open' | 'lr-close'>")), 'major');
});

test('interface heritage that omits an inherited key nobody redeclares stays breaking', () => {
  assert.equal(bump(heritageFixture("Omit<PanelEventMap, 'lr-toggle'>"),
    heritageFixture("Omit<PanelEventMap, 'lr-toggle' | 'lr-open'>")), 'major');
  assert.equal(bump(heritageFixture("Pick<PanelEventMap, 'lr-open' | 'lr-close'>"),
    heritageFixture("Pick<PanelEventMap, 'lr-open'>")), 'major');
});

test('the generated framework map gaining its first event map is additive', () => {
  const snapshot = (events, eventNames) => packageFixture({
    'dist/framework-types.d.ts': [
      "export interface LyraSampleEventMap { 'lr-show': Event; }",
      `export interface LyraComponentTypeMap { 'lr-sample': { events: ${events}; eventNames: ${eventNames} } }`,
      "export type Consumer = LyraComponentTypeMap['lr-sample'];",
    ].join('\n'),
  }, { './framework-types': './dist/framework-types.js' });
  assert.equal(bump(snapshot('{}', 'never'), snapshot('LyraSampleEventMap', "'lr-show'")), 'minor');
  assert.equal(bump(snapshot('{ old: Event }', 'never'), snapshot('LyraSampleEventMap', "'lr-show'")), 'major');
  assert.equal(bump(snapshot('LyraSampleEventMap', "'lr-show'"), snapshot('{}', 'never')), 'major');
});

function registrationFixture(withChild) {
  return packageFixture({
    'dist/child.d.ts': `export declare class Child {} declare global { interface HTMLElementTagNameMap { 'lr-child': Child; } }`,
    'dist/parent.d.ts': `${withChild ? "import './child.js';" : ''}
      export declare class Parent {} declare global { interface HTMLElementTagNameMap { 'lr-parent': Parent; } }`,
  }, { './parent.js': './dist/parent.js', './child.js': './dist/child.js' });
}

test('a member exception lowers only the reviewed members of every matching route', () => {
  const before = registrationFixture(true);
  const after = registrationFixture(false);
  const changes = diffPublicApi(before, after);
  const reviewed = (members, changeId = 'augmentation:*:"global":HTMLElementTagNameMap:contract') => ({
    exceptions: [{
      changeId, requiredBump: 'major', allowedBump: 'minor', members,
      reason: 'Child registration moved to its own entry point.', reviewer: 'maintainer', reviewedOn: '2026-11-20',
    }],
  });
  const removal = [{ key: ':property:lr-child', before: true, after: null }];
  const adjusted = applyReviewedExceptions(changes, reviewed(removal), { baseline: before, current: after });
  assert.notEqual(minimumRequiredBump(adjusted), 'major');
  assert.ok(adjusted.some((change) => change.exception));

  // Another loss in the same contract is still breaking, so the review does not apply there.
  const parentLoss = packageFixture({
    'dist/child.d.ts': `export declare class Child {} declare global { interface HTMLElementTagNameMap { 'lr-child': Child; } }`,
    'dist/parent.d.ts': 'export declare class Parent {} declare global { interface HTMLElementTagNameMap { } }',
  }, { './parent.js': './dist/parent.js', './child.js': './dist/child.js' });
  assert.throws(() => applyReviewedExceptions(diffPublicApi(before, parentLoss), reviewed(removal),
    { baseline: before, current: parentLoss }), /does not match/);

  assert.throws(() => applyReviewedExceptions(changes,
    reviewed([...removal, { key: ':property:lr-other', before: true, after: null }]),
    { baseline: before, current: after }), /unused members: :property:lr-other/);
  assert.throws(() => applyReviewedExceptions(changes, reviewed(removal)), /needs the compared snapshots/);
  assert.throws(() => applyReviewedExceptions(changes, reviewed([{ key: ':property:lr-child' }]),
    { baseline: before, current: after }), /members need key, before and after/);
});
