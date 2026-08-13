import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  catalogEntries,
  generateDefaultStringSlices,
  generationFailures,
  rewriteClassSource,
} from './generate-default-string-slices.mjs';

const catalog = `
export type LyraMessage = string | { other: string };
type Key = 'cancel' | 'itemCount';
const DEFAULT_STRINGS: Record<Key, LyraMessage> = {
  cancel: 'Cancel',
  itemCount: { one: '{count} item', other: '{count} items' },
};
`;
assert.deepEqual([...catalogEntries(catalog)], [
  ['cancel', "'Cancel'"],
  ['itemCount', "{ one: '{count} item', other: '{count} items' }"],
]);

const sample = `import { LyraElement } from '../../../internal/lyra-element.js';
import { SAMPLE_KEYS } from './sample-export.class.js';

// Concurrent authored prose must survive byte-for-byte.
export class LyraSample extends LyraElement {
  render() {
    return this.localize(SAMPLE_KEYS.cancel) + this.localize('itemCount', undefined, { count: 2 });
  }
}
`;
const rewritten = rewriteClassSource(
  sample,
  '/repo/src/components/forms/sample/sample.class.ts',
  '/repo/src/internal/default-strings.generated.ts',
  ['cancel', 'itemCount'],
);
assert.match(rewritten, /LYRA_DEFAULT_cancel, LYRA_DEFAULT_itemCount/);
assert.match(rewritten, /\.\.\.super\.defaultStrings/);
assert.match(rewritten, /import type \{ LyraLocaleStrings \} from .*localization\.js/);
assert.match(rewritten, /protected static override readonly defaultStrings: Readonly<LyraLocaleStrings>/);
assert.match(rewritten, /\/\*\* @internal \*\//);
assert.match(rewritten, /Concurrent authored prose must survive byte-for-byte/);
assert.equal(
  rewriteClassSource(rewritten, '/repo/src/components/forms/sample/sample.class.ts', '/repo/src/internal/default-strings.generated.ts', ['cancel', 'itemCount']),
  rewritten,
  'marker replacement must be idempotent',
);

const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-default-slices-'));
try {
  const internal = path.join(fixture, 'src', 'internal');
  const component = path.join(fixture, 'src', 'components', 'forms', 'sample');
  await mkdir(internal, { recursive: true });
  await mkdir(component, { recursive: true });
  await writeFile(path.join(internal, 'localization.ts'), catalog);
  await writeFile(path.join(component, 'sample.class.ts'), sample);
  await writeFile(
    path.join(component, 'sample-keys.ts'),
    "export const SAMPLE_KEYS = { cancel: 'cancel' } as const;\n",
  );
  await writeFile(
    path.join(component, 'sample-export.class.ts'),
    "export { SAMPLE_KEYS } from './sample-keys.js';\nexport class LyraSampleExport extends LyraElement {}\n",
  );
  const first = await generateDefaultStringSlices({ packageDir: fixture, write: true });
  // Only `sample.class.ts` gets a slice. `sample-export.class.ts` re-exports the key map but never
  // calls localize() itself, so it needs no messages of its own -- it used to receive a slice purely
  // because helper modules were literal-walked unconditionally. `sample.class.ts` still resolves
  // `cancel` through that same re-export chain, because its own
  // `this.localize(SAMPLE_KEYS.cancel)` is a dynamic key and dynamic keys are exactly what keeps
  // the broad walk switched on for this graph.
  assert.equal(first.rewrittenFileCount, 1);
  assert.equal(first.usedKeyCount, 2);
  const reExportOnly = await readFile(path.join(component, 'sample-export.class.ts'), 'utf8');
  assert.doesNotMatch(
    reExportOnly,
    /LYRA_DEFAULT_/,
    'a class that only re-exports a key map, never localizing, carries no default-string slice',
  );
  const authored = await readFile(path.join(component, 'sample.class.ts'), 'utf8');
  assert.match(authored, /Concurrent authored prose must survive byte-for-byte/);
  const generated = await readFile(path.join(internal, 'default-strings.generated.ts'), 'utf8');
  assert.match(generated, /LYRA_DEFAULT_itemCount: LyraMessage = \{ one:/);
  const second = await generateDefaultStringSlices({ packageDir: fixture, write: false });
  assert.equal(second.rewrittenFileCount, 0);
  assert.equal(second.generatedChanged, false);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const graphCatalog = `
type Key = 'direct' | 'runtimeImport' | 'runtimeExport' | 'sideEffect' | 'typeOnly';
const DEFAULT_STRINGS: Record<Key, string> = {
  direct: 'Direct',
  runtimeImport: 'Runtime import',
  runtimeExport: 'Runtime export',
  sideEffect: 'Side effect',
  typeOnly: 'Type only',
};
`;
const graphFixture = await mkdtemp(path.join(tmpdir(), 'lyra-default-slice-graph-'));
try {
  const internal = path.join(graphFixture, 'src', 'internal');
  const component = path.join(graphFixture, 'src', 'components', 'forms', 'graph-sample');
  await mkdir(internal, { recursive: true });
  await mkdir(component, { recursive: true });
  await writeFile(path.join(internal, 'localization.ts'), graphCatalog);
  await writeFile(
    path.join(component, 'graph-sample.class.ts'),
    `import type { TypeOnly } from './type-only.js';
import { type TypeSpecifierOnly } from './type-specifier-only.js';
import { type RuntimeShape, RUNTIME_IMPORT_KEYS } from './runtime-import.js';
import './side-effect.js';
export type { ExportTypeOnly } from './export-type-only.js';
export { type ExportSpecifierOnly } from './export-specifier-only.js';
export type * from './export-star-type-only.js';
export { type RuntimeExportShape, RUNTIME_EXPORT_KEYS } from './runtime-export.js';

export class LyraGraphSample extends LyraElement {
  render() {
    // The dynamic key is what this fixture needs to probe module-graph EDGES at all: only a key
    // that cannot be read off the call expression keeps the broad literal walk of helper modules
    // switched on, and that walk is how a traversed edge makes itself observable here. With a
    // purely literal key the helpers' own literals are (correctly) ignored, and this test could no
    // longer distinguish a traversed runtime edge from a skipped type-only one.
    return this.localize('direct') + this.localize(RUNTIME_IMPORT_KEYS.label);
  }
}
`,
  );
  for (const file of [
    'type-only.ts',
    'type-specifier-only.ts',
    'export-type-only.ts',
    'export-specifier-only.ts',
    'export-star-type-only.ts',
  ]) {
    await writeFile(path.join(component, file), "export type TypeOnly = 'typeOnly';\n");
  }
  await writeFile(
    path.join(component, 'runtime-import.ts'),
    "import type { NestedTypeOnly } from './nested-type-only.js';\n" +
      "export interface RuntimeShape {}\n" +
      "export const RUNTIME_IMPORT_KEYS = { label: 'runtimeImport' } as const;\n",
  );
  await writeFile(
    path.join(component, 'nested-type-only.ts'),
    "export type NestedTypeOnly = 'typeOnly';\n",
  );
  await writeFile(
    path.join(component, 'runtime-export.ts'),
    "export interface RuntimeExportShape {}\nexport const RUNTIME_EXPORT_KEYS = { label: 'runtimeExport' } as const;\n",
  );
  await writeFile(
    path.join(component, 'side-effect.ts'),
    "export const SIDE_EFFECT_KEYS = { label: 'sideEffect' } as const;\n",
  );

  const result = await generateDefaultStringSlices({ packageDir: graphFixture, write: true });
  assert.equal(result.usedKeyCount, 4, 'type-only dependency edges must not enter runtime slices');
  const generated = await readFile(path.join(internal, 'default-strings.generated.ts'), 'utf8');
  assert.match(generated, /LYRA_DEFAULT_direct/);
  assert.match(generated, /LYRA_DEFAULT_runtimeImport/);
  assert.match(generated, /LYRA_DEFAULT_runtimeExport/);
  assert.match(generated, /LYRA_DEFAULT_sideEffect/);
  assert.doesNotMatch(generated, /LYRA_DEFAULT_typeOnly/);
} finally {
  await rm(graphFixture, { recursive: true, force: true });
}

// reachableCatalogKeys() must only treat a literal as a localize() key when it is the actual
// argument of a this.localize(...)/resolveLyraString(...) call -- never merely a string literal
// that textually collides with a catalog key name (a type-union member, an object-literal tag, a
// Lit `changed.has('propName')` check, ...). The ternary-operand pattern this repo actually uses
// (`this.localize(expanded ? 'a' : 'b')`) and a direct resolveLyraString(...) call must still be
// detected.
const falsePositiveCatalog = `
type Key = 'copy' | 'loading' | 'open' | 'search' | 'remove' | 'date' | 'jsonCollapseLabel' | 'jsonExpandLabel' | 'directResolve';
const DEFAULT_STRINGS: Record<Key, string> = {
  copy: 'Copy',
  loading: 'Loading',
  open: 'Open',
  search: 'Search',
  remove: 'Remove',
  date: 'Date',
  jsonCollapseLabel: 'Collapse',
  jsonExpandLabel: 'Expand',
  directResolve: 'Direct resolve',
};
`;
const falsePositiveFixture = await mkdtemp(path.join(tmpdir(), 'lyra-default-slice-false-positive-'));
try {
  const internal = path.join(falsePositiveFixture, 'src', 'internal');
  const component = path.join(falsePositiveFixture, 'src', 'components', 'utility', 'false-positive-sample');
  await mkdir(internal, { recursive: true });
  await mkdir(component, { recursive: true });
  await writeFile(path.join(internal, 'localization.ts'), falsePositiveCatalog);
  await writeFile(
    path.join(component, 'false-positive-sample.class.ts'),
    `import { LyraElement } from '../../../internal/lyra-element.js';
import { resolveLyraString } from '../../../internal/localization-runtime.js';

// A union member that textually collides with a catalog key name (copy-button.class.ts's
// LyraCopyButtonTooltip does this for 'copy').
export type LyraFalsePositiveSampleTooltip = 'full' | 'copy' | 'none';

// A discriminated-union tag colliding with a catalog key name (icon.class.ts's IconFetchState
// does this for 'loading').
interface FetchState {
  kind: 'idle' | 'loading' | 'done';
}

export class LyraFalsePositiveSample extends LyraElement {
  private fetchState: FetchState = { kind: 'loading' };

  // Lit changed.has()/changed.get() property checks colliding with catalog key names
  // (export-button.class.ts's 'loading'/'open', json-viewer.class.ts's 'search',
  // relative-time.class.ts's 'date').
  protected override updated(changed: Map<string, unknown>): void {
    if (changed.has('loading') || changed.get('open') || changed.has('search') || changed.has('date')) {
      // no-op: exercising the collision, not a real localize() argument
    }
  }

  // A diff-line-type discriminator colliding with a catalog key name (diff-view.class.ts's
  // op.type === 'remove').
  private marker(op: { type: 'add' | 'remove' }): string {
    return op.type === 'remove' ? '-' : '+';
  }

  render() {
    const expanded = true;
    const direct = resolveLyraString(this, 'directResolve', this.strings, undefined, undefined, undefined);
    return direct + this.localize(expanded ? 'jsonCollapseLabel' : 'jsonExpandLabel', undefined, { label: 'x' });
  }
}
`,
  );
  const result = await generateDefaultStringSlices({ packageDir: falsePositiveFixture, write: true });
  const generated = await readFile(path.join(internal, 'default-strings.generated.ts'), 'utf8');
  assert.doesNotMatch(generated, /LYRA_DEFAULT_copy\b/, 'a type-union member must not be treated as a localize() key');
  assert.doesNotMatch(generated, /LYRA_DEFAULT_loading\b/, 'a discriminated-union tag must not be treated as a localize() key');
  assert.doesNotMatch(generated, /LYRA_DEFAULT_open\b/, 'a changed.get() literal must not be treated as a localize() key');
  assert.doesNotMatch(generated, /LYRA_DEFAULT_search\b/, 'a changed.has() literal must not be treated as a localize() key');
  assert.doesNotMatch(generated, /LYRA_DEFAULT_remove\b/, 'a diff-line-type discriminator must not be treated as a localize() key');
  assert.doesNotMatch(generated, /LYRA_DEFAULT_date\b/, 'a changed.has() literal must not be treated as a localize() key');
  assert.match(generated, /LYRA_DEFAULT_directResolve/, 'a real resolveLyraString(...) call must still be detected');
  assert.match(generated, /LYRA_DEFAULT_jsonCollapseLabel/, 'a ternary operand of this.localize(...) must still be detected');
  assert.match(generated, /LYRA_DEFAULT_jsonExpandLabel/, 'a ternary operand of this.localize(...) must still be detected');
  assert.equal(result.usedKeyCount, 3, 'only the 3 real localize()/resolveLyraString() keys must be reachable');
} finally {
  await rm(falsePositiveFixture, { recursive: true, force: true });
}


// A helper module reached through the import graph must NOT leak literals that merely collide with
// catalog key names (internal/a11y.ts -> accessibility-visibility.ts's `visibility === 'collapse'`,
// `localName !== 'details'`, `hasAttribute('open')` did exactly this for lr-typing-indicator, which
// only ever localizes `thinking`). The broad literal walk is reserved for the one shape that
// genuinely hides its key from the call expression -- a dynamic argument like
// `this.localize(FILE_SIZE_UNIT_KEYS[unit])` -- and must still work there.
const helperCatalog = `
type Key = 'collapse' | 'details' | 'open' | 'thinking' | 'byteUnitKb' | 'byteUnitMb';
const DEFAULT_STRINGS: Record<Key, string> = {
  collapse: 'Collapse',
  details: 'Details',
  open: 'Open',
  thinking: 'Thinking',
  byteUnitKb: 'KB',
  byteUnitMb: 'MB',
};
`;
const helperFixture = await mkdtemp(path.join(tmpdir(), 'lyra-default-slice-helper-'));
try {
  const internal = path.join(helperFixture, 'src', 'internal');
  const staticOnly = path.join(helperFixture, 'src', 'components', 'utility', 'static-key-sample');
  const dynamicOnly = path.join(helperFixture, 'src', 'components', 'utility', 'dynamic-key-sample');
  await mkdir(internal, { recursive: true });
  await mkdir(staticOnly, { recursive: true });
  await mkdir(dynamicOnly, { recursive: true });
  await writeFile(path.join(internal, 'localization.ts'), helperCatalog);

  // A pure a11y-style helper with incidental literals and no localize() call of its own.
  await writeFile(
    path.join(internal, 'visibility-helper.ts'),
    `export function isHidden(visibility: string): boolean {
  return visibility === 'hidden' || visibility === 'collapse';
}
export function isOpenDetails(el: Element): boolean {
  return el.localName === 'details' && el.hasAttribute('open');
}
`,
  );
  // A real runtime key map, consumed only through a dynamic subscript.
  await writeFile(
    path.join(internal, 'byte-units.ts'),
    `export const BYTE_UNIT_KEYS: Record<string, string> = { kb: 'byteUnitKb', mb: 'byteUnitMb' };
`,
  );

  await writeFile(
    path.join(staticOnly, 'static-key-sample.class.ts'),
    `import { LyraElement } from '../../../internal/lyra-element.js';
import { isHidden, isOpenDetails } from '../../../internal/visibility-helper.js';

export class LyraStaticKeySample extends LyraElement {
  render() {
    void isHidden('visible');
    void isOpenDetails(this);
    return this.localize('thinking');
  }
}
`,
  );
  await writeFile(
    path.join(dynamicOnly, 'dynamic-key-sample.class.ts'),
    `import { LyraElement } from '../../../internal/lyra-element.js';
import { BYTE_UNIT_KEYS } from '../../../internal/byte-units.js';

export class LyraDynamicKeySample extends LyraElement {
  render() {
    const unit = 'kb';
    return this.localize(BYTE_UNIT_KEYS[unit]!);
  }
}
`,
  );

  await generateDefaultStringSlices({ packageDir: helperFixture, write: true });
  const staticSlice = await readFile(path.join(staticOnly, 'static-key-sample.class.ts'), 'utf8');
  const dynamicSlice = await readFile(path.join(dynamicOnly, 'dynamic-key-sample.class.ts'), 'utf8');

  for (const phantom of ['collapse', 'details', 'open']) {
    assert.doesNotMatch(
      staticSlice,
      new RegExp(`LYRA_DEFAULT_${phantom}\\b`),
      `a helper module's incidental '${phantom}' literal must not become a reachable key`,
    );
  }
  assert.match(staticSlice, /LYRA_DEFAULT_thinking\b/, 'the one real localize() key is still detected');

  // The dynamic-subscript case still pulls the whole key map in, from the helper that declares it.
  assert.match(dynamicSlice, /LYRA_DEFAULT_byteUnitKb\b/, 'a dynamic localize() key map is still reachable');
  assert.match(dynamicSlice, /LYRA_DEFAULT_byteUnitMb\b/, 'a dynamic localize() key map is still reachable');
} finally {
  await rm(helperFixture, { recursive: true, force: true });
}


// A key map feeding a dynamic localize() call very often lives in the CLASS FILE itself rather
// than a helper module (lr-citation-badge's STATUS_MESSAGE_KEY -> this.localize(key)). Restricting
// the broad literal walk to helper modules silently dropped every one of those messages, which
// renders the raw key name to the user.
const rootMapCatalog = `
type Key = 'statusHigh' | 'statusLow' | 'plainLabel';
const DEFAULT_STRINGS: Record<Key, string> = {
  statusHigh: 'High confidence',
  statusLow: 'Low confidence',
  plainLabel: 'Plain',
};
`;
const rootMapFixture = await mkdtemp(path.join(tmpdir(), 'lyra-default-slice-root-map-'));
try {
  const internal = path.join(rootMapFixture, 'src', 'internal');
  const component = path.join(rootMapFixture, 'src', 'components', 'utility', 'root-map-sample');
  await mkdir(internal, { recursive: true });
  await mkdir(component, { recursive: true });
  await writeFile(path.join(internal, 'localization.ts'), rootMapCatalog);
  await writeFile(
    path.join(component, 'root-map-sample.class.ts'),
    `import { LyraElement } from '../../../internal/lyra-element.js';

// Module-level key map in the CLASS file, consumed only through a dynamic subscript.
const STATUS_MESSAGE_KEY: Record<string, string | null> = {
  none: null,
  high: 'statusHigh',
  low: 'statusLow',
};

export class LyraRootMapSample extends LyraElement {
  status = 'high';
  render() {
    const key = STATUS_MESSAGE_KEY[this.status];
    return (key ? this.localize(key) : '') + this.localize('plainLabel');
  }
}
`,
  );
  await generateDefaultStringSlices({ packageDir: rootMapFixture, write: true });
  const slice = await readFile(path.join(component, 'root-map-sample.class.ts'), 'utf8');
  assert.match(slice, /LYRA_DEFAULT_statusHigh\b/, 'a key map in the class file must be reachable through its dynamic call');
  assert.match(slice, /LYRA_DEFAULT_statusLow\b/, 'a key map in the class file must be reachable through its dynamic call');
  assert.match(slice, /LYRA_DEFAULT_plainLabel\b/, 'the literal key alongside it is still detected');
} finally {
  await rm(rootMapFixture, { recursive: true, force: true });
}

// The walk has always COMPUTED the orphaned-key set and the CLI has always ignored it, so a
// DEFAULT_STRINGS entry no component can reach shipped as a dead translated string in all ten
// locales (check-translations.mjs enforces key parity in both directions) with no gate anywhere.
{
  const clean = {
    classFileCount: 3,
    rewrittenFileCount: 0,
    usedKeyCount: 2,
    unusedKeys: [],
    generatedChanged: false,
  };
  assert.deepEqual(generationFailures(clean), [], 'a clean, orphan-free run must not fail');

  const orphaned = { ...clean, unusedKeys: ['trendGoodSuffix', 'spanTokens'] };
  const checkFailures = generationFailures(orphaned);
  assert.equal(checkFailures.length, 1, 'an orphaned key must fail the check run');
  assert.match(checkFailures[0], /2 orphaned key\(s\)/);
  assert.match(checkFailures[0], /- trendGoodSuffix/);
  assert.match(checkFailures[0], /- spanTokens/);
  assert.match(
    checkFailures[0],
    /localization-types\.ts/,
    'the message must name every file the key has to be removed from',
  );

  // `--write` regenerates slices; it cannot delete a catalog entry, so it must still report.
  assert.equal(
    generationFailures(orphaned, { write: true }).length,
    1,
    'an orphaned key must fail in --write mode too, where it is most likely to be introduced',
  );

  // Staleness stays a separate, check-only failure, and the two are reported together.
  const staleAndOrphaned = { ...orphaned, rewrittenFileCount: 2, generatedChanged: true };
  assert.equal(generationFailures(staleAndOrphaned).length, 2);
  assert.equal(
    generationFailures(staleAndOrphaned, { write: true }).length,
    1,
    '--write fixes staleness by definition, so only the orphan survives',
  );
  assert.equal(generationFailures({ ...clean, generatedChanged: true }).length, 1);
}

console.log('per-component default-string slice generator tests passed.');
