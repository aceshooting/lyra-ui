import { isMainModule } from './is-main-module.mjs';

// Manual, occasional regeneration tool. Run it from packages/lyra-ui whenever the tiny fixture
// needs a new chapter or metadata field. The fixed archive timestamp keeps repeated runs
// byte-identical.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const EBOOK_FIXTURE_DIRECTORY = join(
  scriptDir,
  '..',
  'src',
  'components',
  'viewers',
  'ebook-viewer',
  'fixtures',
);
const FIXTURE_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));
const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">urn:uuid:lyra-ui-fixture</dc:identifier><dc:title>Lyra UI Test Fixture</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter1"/></spine></package>`;
const nav = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Navigation</title></head><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">Chapter 1</a></li></ol></nav></body></html>`;
const chapter = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>This is a tiny EPUB fixture for Lyra UI.</p></body></html>`;

export async function generateEbookFixture(
  outputDirectory = EBOOK_FIXTURE_DIRECTORY,
) {
  const zip = new JSZip();
  const options = { createFolders: false, date: FIXTURE_DATE };
  zip.file('mimetype', 'application/epub+zip', {
    ...options,
    compression: 'STORE',
  });
  zip.file('META-INF/container.xml', container, options);
  zip.file('OEBPS/content.opf', opf, options);
  zip.file('OEBPS/nav.xhtml', nav, options);
  zip.file('OEBPS/chapter1.xhtml', chapter, options);
  const buffer = await zip.generateAsync({
    compression: 'STORE',
    platform: 'DOS',
    type: 'nodebuffer',
  });
  writeFileSync(join(outputDirectory, 'minimal.epub'), buffer);
  writeFileSync(
    join(outputDirectory, 'minimal-epub-fixture.ts'),
    `export const MINIMAL_EPUB_BASE64 = '${buffer.toString('base64')}';\n`,
  );
  return buffer.length;
}

if (isMainModule(import.meta.url)) {
  const byteLength = await generateEbookFixture();
  console.log(`Wrote ${byteLength}-byte EPUB fixture`);
}
