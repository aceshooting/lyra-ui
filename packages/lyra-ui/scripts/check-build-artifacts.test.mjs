import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { findBuildArtifactFindings } from './check-build-artifacts.mjs';

test('reports emitted maps and source map references', () => {
  const files = [
    '/workspace/dist/component.d.ts.map',
    '/workspace/dist/component.js',
    '/workspace/dist/component.css',
  ];
  const contents = new Map([
    ['/workspace/dist/component.js', 'export {}\n//# sourceMappingURL=component.js.map\n'],
    ['/workspace/dist/component.css', '.component {}\n'],
  ]);

  assert.deepEqual(findBuildArtifactFindings(files, (file) => contents.get(file) ?? ''), [
    '/workspace/dist/component.d.ts.map: source map emitted into dist -- package.json#files ships dist without src, so its `sources` paths do not exist in an install',
    "/workspace/dist/component.js: carries a sourceMappingURL comment -- the referenced map is not published, so a consumer's devtools 404s on it",
  ]);
});

test('rejects build-only fixture directories in dist', () => {
  const files = [
    '/workspace/dist/components/viewers/docx-viewer/docx-viewer.js',
    '/workspace/dist/components/viewers/docx-viewer/fixtures/minimal-docx-fixture.d.ts',
    '/workspace/dist/components/viewers/docx-viewer/fixtures/minimal-docx-fixture.js',
    '/workspace/dist/components/viewers/ebook-viewer/fixtures/minimal-epub-fixture.d.ts',
    '/workspace/dist/components/viewers/ebook-viewer/fixtures/minimal-epub-fixture.js',
    '/workspace/dist/components/viewers/spreadsheet-viewer/fixtures/minimal-xlsx-fixture.d.ts',
    '/workspace/dist/components/viewers/spreadsheet-viewer/fixtures/minimal-xlsx-fixture.js',
  ];

  assert.deepEqual(findBuildArtifactFindings(files, () => ''), [
    '/workspace/dist/components/viewers/docx-viewer/fixtures/minimal-docx-fixture.d.ts: build-only fixture emitted into dist',
    '/workspace/dist/components/viewers/docx-viewer/fixtures/minimal-docx-fixture.js: build-only fixture emitted into dist',
    '/workspace/dist/components/viewers/ebook-viewer/fixtures/minimal-epub-fixture.d.ts: build-only fixture emitted into dist',
    '/workspace/dist/components/viewers/ebook-viewer/fixtures/minimal-epub-fixture.js: build-only fixture emitted into dist',
    '/workspace/dist/components/viewers/spreadsheet-viewer/fixtures/minimal-xlsx-fixture.d.ts: build-only fixture emitted into dist',
    '/workspace/dist/components/viewers/spreadsheet-viewer/fixtures/minimal-xlsx-fixture.js: build-only fixture emitted into dist',
  ]);
});

test('recognizes Windows fixture directories without matching plural near-misses', () => {
  assert.deepEqual(
    findBuildArtifactFindings(
      [
        'C:\\workspace\\dist\\components\\viewers\\ebook-viewer\\fixtures\\minimal-epub-fixture.js',
        'C:\\workspace\\dist\\components\\viewers\\fixtures-browser\\fixtures-browser.js',
      ],
      () => '',
    ),
    [
      'C:\\workspace\\dist\\components\\viewers\\ebook-viewer\\fixtures\\minimal-epub-fixture.js: build-only fixture emitted into dist',
    ],
  );
});

test('allows ordinary emitted modules whose names merely mention fixtures', () => {
  assert.deepEqual(
    findBuildArtifactFindings(
      [
        '/workspace/dist/components/viewers/fixture-browser/fixture-browser.d.ts',
        '/workspace/dist/components/viewers/fixtures-browser/fixtures-browser.js',
        '/workspace/dist/components/viewers/docx-viewer/fixtures-browser/minimal-docx-fixture.js',
      ],
      () => '',
    ),
    [],
  );
});

test('rejects a stripped code-block base required by public subclass declarations', () => {
  const base = '/workspace/dist/components/conversation/code-block/code-block-base.class.d.ts';
  const regular = '/workspace/dist/components/conversation/code-block/code-block.class.d.ts';
  const lean = '/workspace/dist/components/conversation/code-block/code-block-core.class.d.ts';
  const declarations = new Map([
    [base, 'export interface LyraCodeBlockBaseEventMap {}\n'],
    [regular, "import { LyraCodeBlockBase } from './code-block-base.class.js'; export declare class LyraCodeBlock extends LyraCodeBlockBase {}\n"],
    [lean, "import { LyraCodeBlockBase } from './code-block-base.class.js'; export declare class LyraCodeBlockCore extends LyraCodeBlockBase {}\n"],
  ]);

  assert.deepEqual(
    findBuildArtifactFindings([base, regular, lean], (file) => declarations.get(file) ?? ''),
    [
      `${regular}: declaration ./code-block-base.class.js does not export LyraCodeBlockBase`,
      `${lean}: declaration ./code-block-base.class.js does not export LyraCodeBlockBase`,
    ],
  );
});

test('accepts the emitted code-block base required by public subclass declarations', () => {
  const base = '/workspace/dist/components/conversation/code-block/code-block-base.class.d.ts';
  const regular = '/workspace/dist/components/conversation/code-block/code-block.class.d.ts';
  const lean = '/workspace/dist/components/conversation/code-block/code-block-core.class.d.ts';
  const declarations = new Map([
    [base, 'export declare abstract class LyraCodeBlockBase {}\n'],
    [regular, "import { LyraCodeBlockBase } from './code-block-base.class.js'; export declare class LyraCodeBlock extends LyraCodeBlockBase {}\n"],
    [lean, "import { LyraCodeBlockBase } from './code-block-base.class.js'; export declare class LyraCodeBlockCore extends LyraCodeBlockBase {}\n"],
  ]);

  assert.deepEqual(
    findBuildArtifactFindings([base, regular, lean], (file) => declarations.get(file) ?? ''),
    [],
  );
});

test('rejects stripped named imports, re-exports and inline import types', () => {
  const entry = '/workspace/dist/entry.d.ts';
  const declarations = new Map([
    [entry, `
      import type { Controller as Session } from './controller.js';
      export { load as preload } from './loader.js';
      export type Result = import('./loader.js').Result;
      export declare function run(session: Session): Result;
    `],
    ['/workspace/dist/controller.d.ts', 'export {};'],
    ['/workspace/dist/loader.d.ts', 'export {};'],
  ]);
  assert.deepEqual(findBuildArtifactFindings([...declarations.keys()], (file) => declarations.get(file)), [
    `${entry}: declaration ./controller.js does not export Controller`,
    `${entry}: declaration ./loader.js does not export load`,
    `${entry}: declaration ./loader.js does not export Result`,
  ]);
});

test('resolves named and default exports through aliases and export-star cycles', () => {
  const declarations = new Map([
    ['/workspace/dist/entry.d.ts', `
      import Loader, { Alias, Model } from './bridge.js';
      export type Result = import('./bridge.js').Model;
      export declare const value: Model;
      export { Loader, Alias };
    `],
    ['/workspace/dist/bridge.d.ts', `
      export { default, Original as Alias } from './model.js';
      export * from './cycle.js';
    `],
    ['/workspace/dist/cycle.d.ts', "export * from './bridge.js'; export * from './model.js';"],
    ['/workspace/dist/model.d.ts', `
      export interface Model { value: string; }
      export declare class Original {}
      export default function load(): Model;
    `],
  ]);
  assert.deepEqual(findBuildArtifactFindings([...declarations.keys()], (file) => declarations.get(file)), []);
});

test('declaration emit retains helpers referenced by the public component graph', (t) => {
  const declarations = new Map();
  const helpers = [
    ['loader', '../src/components/charts/chart/box-plot-loader.ts'],
    ['dates', '../src/components/forms/date-picker/date-picker-disabled-dates.ts'],
    ['controller', '../src/internal/drop-session-controller.ts'],
  ].map(([name, source]) => [name, fileURLToPath(new URL(source, import.meta.url))]);
  const root = mkdtempSync(join(tmpdir(), 'lyra-declaration-emit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, source] of helpers) {
    writeFileSync(join(root, `${name}.ts`), readFileSync(source, 'utf8'));
  }
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      declaration: true, emitDeclarationOnly: true, stripInternal: true,
      noCheck: true, noResolve: true, types: [], target: 'ESNext',
    },
    files: helpers.map(([name]) => `${name}.ts`),
  }));
  const require = createRequire(import.meta.url);
  const compiler = resolve(dirname(require.resolve('typescript/package.json')), require('typescript/package.json').bin.tsc);
  const result = spawnSync(process.execPath, [compiler, '-p', join(root, 'tsconfig.json')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const [name] of helpers) {
    const declaration = readFileSync(join(root, `${name}.d.ts`), 'utf8');
    declarations.set(`/workspace/dist/${name}.d.ts`, declaration);
  }
  declarations.set('/workspace/dist/entry.d.ts', `
    export { loadBoxPlotAndRegister } from './loader.js';
    export { projectDisabledDateKeys, parseDisabledWeekdays, inclusiveDayCount } from './dates.js';
    import type { DropSessionController } from './controller.js';
    export declare function consume(controller: DropSessionController): void;
  `);
  assert.deepEqual(findBuildArtifactFindings([...declarations.keys()], (file) => declarations.get(file)), []);
});

test('requires exact exported stylesheets to exist in the emitted package', () => {
  assert.deepEqual(
    findBuildArtifactFindings(['/workspace/dist/theme.css'], () => '', {
      packageDirectory: '/workspace',
      exports: {
        './theme.css': './dist/theme.css',
        './preferences.css': './dist/preferences.css',
        './themes/*': './dist/themes/*',
      },
    }),
    ['./preferences.css: exported stylesheet is missing: ./dist/preferences.css'],
  );
  assert.deepEqual(
    findBuildArtifactFindings(['/workspace/dist/preferences.css'], () => '', {
      packageDirectory: '/workspace',
      exports: { './preferences.css': './dist/preferences.css' },
    }),
    [],
  );
});
