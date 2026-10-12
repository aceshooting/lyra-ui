import { CONTENT_TYPES, docxFixture } from './admission-fixtures.js';

/** Synthetic plain-body review document; no document from another application is bundled. */
export function reviewFixture(): Uint8Array {
  const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  return docxFixture({
    '[Content_Types].xml': CONTENT_TYPES.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'),
    'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="reviewComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>',
    'word/document.xml': `<w:document xmlns:w="${word}"><w:body><w:p><w:r><w:t xml:space="preserve">Opening </w:t></w:r><w:ins w:id="1" w:author="First reviewer"><w:r><w:t>suggestion</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> and </w:t></w:r><w:del w:id="2" w:author="Second reviewer"><w:r><w:delText>deletion</w:delText></w:r></w:del></w:p><w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Discuss this paragraph.</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p></w:body></w:document>`,
    'word/comments.xml': `<w:comments xmlns:w="${word}"><w:comment w:id="0" w:author="Third reviewer"><w:p><w:r><w:t>Please clarify.</w:t></w:r></w:p></w:comment></w:comments>`,
  });
}
