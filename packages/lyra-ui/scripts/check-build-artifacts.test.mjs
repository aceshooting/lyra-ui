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
