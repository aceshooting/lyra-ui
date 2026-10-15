import { html } from 'lit';
import '../src/docx/editor.js';
import '@aceshooting/lyra-docs/docx/editor.css';
import { docxFixture } from './admission-fixtures.js';
import { imageFixture, tableFixture } from './corpus.js';

export const storyMeta = {
  title: 'Companions/DOCX editor',
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Experimental local DOCX editing. Command search, bounded document checks and explicit review actions use the same revision and selection guards as the session API. Saved bytes remain host-owned; this demonstration does not acknowledge durable storage.' } },
  },
};

const container = 'padding:var(--lr-space-l);display:grid;gap:var(--lr-space-m);min-inline-size:0';
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const headings = () => docxFixture({ 'word/document.xml': `<w:document xmlns:w="${word}"><w:body>
  <w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>Project overview</w:t></w:r></w:p>
  <w:p><w:r><w:t>Find this example sentence. Find another example sentence.</w:t></w:r></w:p>
  <w:p><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:r><w:t>Delivery notes</w:t></w:r></w:p>
  <w:p><w:r><w:t>Select text, open Review, enter an author and add a comment.</w:t></w:r></w:p>
  </w:body></w:document>` });

const load = bytes => async ({ canvasElement }) => {
  await customElements.whenDefined('lr-docx-editor');
  const editor = canvasElement.querySelector('lr-docx-editor');
  if (!editor) throw new Error('Editor story mount is unavailable');
  const result = bytes ? await editor.open(bytes()) : await editor.newDocument();
  if (!result.ok) throw new Error(`Editor story refused: ${result.code}`);
};
const render = (description, narrow = false) => html`
  <div style=${container}>
    <p>${description}</p>
    <div style=${narrow ? 'inline-size:20rem;max-inline-size:100%;min-inline-size:0' : 'min-inline-size:0'}>
      <lr-docx-editor zoom=${narrow ? 'fit' : '1'}></lr-docx-editor>
    </div>
  </div>`;

export const CommandsOutlineAndChecks = {
  render: () => render('Use Commands or Ctrl/Command+K for formatting and navigation. Find “example” to explore clickable excerpts and Replace and advance. Outline lists the headings; Checks explains the skipped level. These are bounded body checks, not accessibility certification.'),
  play: load(headings),
};
export const CommentsAndTrackedText = {
  render: () => render('Select text and open Review. Enter an explicit author to add a comment or enable Track changes, then type in the document. Refresh Review to inspect the resulting records. Supported text revisions can be accepted or rejected; unsupported revisions remain read-only.'),
  play: load(headings),
};
export const TableFormatting = {
  render: () => render('Place the caret in a cell and open Format table to set first-row headers, current-cell vertical alignment, shading or borders, or a total width with equal columns. Merged and nested tables are outside this editing profile.'),
  play: load(() => tableFixture('table-simple')),
};
export const ImageReplacement = {
  render: () => render('Select an image, then use Replace image to choose a local PNG, JPEG or static GIF. Replacement keeps its dimensions, title and description. Resize and description are separate explicit edits. Undo restores the original image.'),
  play: load(() => imageFixture('image-simple')),
};
export const NarrowEditor = {
  render: () => render('A narrow editor uses fit zoom. Open Commands, Find, Outline, Checks or Review to explore the same bounded controls at a small allocation.', true),
  play: load(headings),
};

export const stories = { CommandsOutlineAndChecks, CommentsAndTrackedText, TableFormatting, ImageReplacement, NarrowEditor };
