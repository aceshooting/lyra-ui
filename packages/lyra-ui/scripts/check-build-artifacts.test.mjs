import assert from 'node:assert/strict';
import test from 'node:test';
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
    [regular, 'export declare class LyraCodeBlock extends LyraCodeBlockBase {}\n'],
    [lean, 'export declare class LyraCodeBlockCore extends LyraCodeBlockBase {}\n'],
  ]);

  assert.deepEqual(
    findBuildArtifactFindings([base, regular, lean], (file) => declarations.get(file) ?? ''),
    [
      `${base}: missing exported LyraCodeBlockBase required by published subclass declarations`,
    ],
  );
});

test('accepts the emitted code-block base required by public subclass declarations', () => {
  const base = '/workspace/dist/components/conversation/code-block/code-block-base.class.d.ts';
  const regular = '/workspace/dist/components/conversation/code-block/code-block.class.d.ts';
  const lean = '/workspace/dist/components/conversation/code-block/code-block-core.class.d.ts';
  const declarations = new Map([
    [base, 'export declare abstract class LyraCodeBlockBase {}\n'],
    [regular, 'export declare class LyraCodeBlock extends LyraCodeBlockBase {}\n'],
    [lean, 'export declare class LyraCodeBlockCore extends LyraCodeBlockBase {}\n'],
  ]);

  assert.deepEqual(
    findBuildArtifactFindings([base, regular, lean], (file) => declarations.get(file) ?? ''),
    [],
  );
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
