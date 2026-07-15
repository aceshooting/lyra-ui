import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'ebook-viewer', 'fixtures');
const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">urn:uuid:lyra-ui-fixture</dc:identifier><dc:title>Lyra UI Test Fixture</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter1"/></spine></package>`;
const nav = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Navigation</title></head><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">Chapter 1</a></li></ol></nav></body></html>`;
const chapter = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>This is a tiny EPUB fixture for Lyra UI.</p></body></html>`;

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file('META-INF/container.xml', container);
zip.file('OEBPS/content.opf', opf);
zip.file('OEBPS/nav.xhtml', nav);
zip.file('OEBPS/chapter1.xhtml', chapter);
const buffer = await zip.generateAsync({ type: 'nodebuffer' });
writeFileSync(join(outDir, 'minimal.epub'), buffer);
writeFileSync(join(outDir, 'minimal-epub-fixture.ts'), `export const MINIMAL_EPUB_BASE64 = '${buffer.toString('base64')}';\n`);
