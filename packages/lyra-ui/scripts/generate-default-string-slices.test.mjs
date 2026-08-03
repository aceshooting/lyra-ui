import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  catalogEntries,
  generateDefaultStringSlices,
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
  assert.equal(first.rewrittenFileCount, 2);
  assert.equal(first.usedKeyCount, 2);
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
    return this.localize('direct');
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

console.log('per-component default-string slice generator tests passed.');
