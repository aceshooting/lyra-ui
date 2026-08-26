import { isMainModule } from './is-main-module.mjs';

// Manual, occasional regeneration tool. Run it from packages/lyra-ui whenever the tiny fixture
// needs a new field or style. The fixed archive timestamp keeps repeated runs byte-identical.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const DOCX_FIXTURE_DIRECTORY = join(
  scriptDir,
  '..',
  'src',
  'components',
  'viewers',
  'docx-viewer',
  'fixtures',
);
const FIXTURE_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`;

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Lyra UI Test Fixture</w:t></w:r></w:p>
    <w:p><w:r><w:t>This is a tiny fixture document used by the test suite and Storybook stories.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

export async function generateDocxFixture(
  outputDirectory = DOCX_FIXTURE_DIRECTORY,
) {
  const zip = new JSZip();
  const options = { createFolders: false, date: FIXTURE_DATE };
  zip.file('[Content_Types].xml', CONTENT_TYPES, options);
  zip.file('_rels/.rels', ROOT_RELS, options);
  zip.file('word/document.xml', DOCUMENT_XML, options);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS, options);
  zip.file('word/styles.xml', STYLES_XML, options);

  const buffer = await zip.generateAsync({
    compression: 'STORE',
    platform: 'DOS',
    type: 'nodebuffer',
  });
  writeFileSync(
    join(outputDirectory, 'minimal-docx-fixture.ts'),
    `// Auto-generated fixture.\nexport const MINIMAL_DOCX_BASE64 = '${buffer.toString('base64')}';\n`,
  );
  return buffer.length;
}

if (isMainModule(import.meta.url)) {
  const byteLength = await generateDocxFixture();
  console.log(`Wrote ${byteLength}-byte DOCX fixture`);
}
