import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';

import {
  DOCX_FIXTURE_DIRECTORY,
  generateDocxFixture,
} from './generate-docx-fixture.mjs';
import {
  EBOOK_FIXTURE_DIRECTORY,
  generateEbookFixture,
} from './generate-ebook-fixture.mjs';

test('viewer fixture generators target the family-scoped source directories', () => {
  assert.match(
    normalize(DOCX_FIXTURE_DIRECTORY),
    /src[\\/]components[\\/]viewers[\\/]docx-viewer[\\/]fixtures$/u,
  );
  assert.match(
    normalize(EBOOK_FIXTURE_DIRECTORY),
    /src[\\/]components[\\/]viewers[\\/]ebook-viewer[\\/]fixtures$/u,
  );
});

test('DOCX fixture generation is deterministic and produces the required package entries', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-docx-fixture-'));
  try {
    const first = join(root, 'first');
    const second = join(root, 'second');
    mkdirSync(first);
    mkdirSync(second);

    await generateDocxFixture(first);
    await generateDocxFixture(second);

    const firstSource = readFileSync(
      join(first, 'minimal-docx-fixture.ts'),
      'utf8',
    );
    const secondSource = readFileSync(
      join(second, 'minimal-docx-fixture.ts'),
      'utf8',
    );
    assert.equal(firstSource, secondSource);

    const base64 = firstSource.match(/MINIMAL_DOCX_BASE64 = '([^']+)'/u)?.[1];
    assert.ok(base64);
    const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
    assert.equal(
      zip.file('[Content_Types].xml')?.date.toISOString(),
      '1980-01-01T00:00:00.000Z',
    );
    for (const entry of [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
    ]) {
      assert.ok(zip.file(entry), `DOCX fixture is missing ${entry}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('EPUB fixture generation is deterministic and keeps source and binary copies aligned', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-ebook-fixture-'));
  try {
    const first = join(root, 'first');
    const second = join(root, 'second');
    mkdirSync(first);
    mkdirSync(second);

    await generateEbookFixture(first);
    await generateEbookFixture(second);

    const firstBinary = readFileSync(join(first, 'minimal.epub'));
    const secondBinary = readFileSync(join(second, 'minimal.epub'));
    assert.deepEqual(firstBinary, secondBinary);

    const firstSource = readFileSync(
      join(first, 'minimal-epub-fixture.ts'),
      'utf8',
    );
    const secondSource = readFileSync(
      join(second, 'minimal-epub-fixture.ts'),
      'utf8',
    );
    assert.equal(firstSource, secondSource);
    const sourceBase64 = firstSource.match(
      /MINIMAL_EPUB_BASE64 = '([^']+)'/u,
    )?.[1];
    assert.equal(sourceBase64, firstBinary.toString('base64'));

    const zip = await JSZip.loadAsync(firstBinary);
    assert.equal(await zip.file('mimetype')?.async('string'), 'application/epub+zip');
    assert.equal(
      zip.file('mimetype')?.date.toISOString(),
      '1980-01-01T00:00:00.000Z',
    );
    for (const entry of [
      'META-INF/container.xml',
      'OEBPS/content.opf',
      'OEBPS/nav.xhtml',
      'OEBPS/chapter1.xhtml',
    ]) {
      assert.ok(zip.file(entry), `EPUB fixture is missing ${entry}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
