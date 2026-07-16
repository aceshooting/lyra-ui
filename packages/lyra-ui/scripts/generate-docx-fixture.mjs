// Manual, occasional regeneration tool -- not wired into any package.json
// script or CI step. Run it directly with `node scripts/generate-docx-fixture.mjs`
// (from `packages/lyra-ui/`) whenever `docx-viewer/fixtures/minimal-docx-fixture.ts`
// needs to be regenerated (e.g. its tiny hand-built DOCX structure needs a new
// field/style for a test). `jszip` is already a devDependency of this package,
// so no extra install is normally needed; if it's ever removed from
// devDependencies, reinstall it temporarily (`pnpm add -D jszip`) to run this.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, '..', 'src', 'components', 'docx-viewer', 'fixtures');

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

const zip = new JSZip();
zip.file('[Content_Types].xml', CONTENT_TYPES);
zip.file('_rels/.rels', ROOT_RELS);
zip.file('word/document.xml', DOCUMENT_XML);
zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
zip.file('word/styles.xml', STYLES_XML);

const buffer = await zip.generateAsync({ type: 'nodebuffer' });
writeFileSync(
  join(outDir, 'minimal-docx-fixture.ts'),
  `// Auto-generated fixture.\nexport const MINIMAL_DOCX_BASE64 = '${buffer.toString('base64')}';\n`,
);
console.log(`Wrote ${buffer.length}-byte DOCX fixture`);
