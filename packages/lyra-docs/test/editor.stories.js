import { html } from 'lit';
import '@aceshooting/lyra-ui/components/lr-button.js';
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
const headings = (secondLevel = 2) => docxFixture({ 'word/document.xml': `<w:document xmlns:w="${word}"><w:body>
  <w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>Project overview</w:t></w:r></w:p>
  <w:p><w:r><w:t>Find this example sentence. Find another example sentence.</w:t></w:r></w:p>
  <w:p><w:pPr><w:outlineLvl w:val="${secondLevel}"/></w:pPr><w:r><w:t>Delivery notes</w:t></w:r></w:p>
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
export const PaintedParagraphs = {
  render: () => html`<div style=${container} class="docx-painted-paragraphs-story">
    <style>.docx-painted-paragraphs-story [data-lr-block-index="1"] { outline: 2px solid currentColor; }</style>
    <p>The outline follows the second body paragraph. Change the zoom or insert a paragraph above it to see the index update.</p>
    <lr-docx-editor></lr-docx-editor>
  </div>`,
  play: load(headings),
};
export const NarrowEditor = {
  render: () => render('A narrow editor uses fit zoom. Open Commands, Find, Outline, Checks or Review to explore the same bounded controls at a small allocation.', true),
  play: load(headings),
};

export const DocumentToolsFirstRow = {
  render: () => html`<div style=${container}>
    <p>Document tools follow insertion controls in the first toolbar row. Select document text, then use formatting or open Outline, Checks or Review. The optional border color keeps quiet icon tools visually compact without changing their focus indicators.</p>
    <lr-docx-editor document-tools-placement="first-row" style="--lr-docx-editor-tool-border:transparent"></lr-docx-editor>
  </div>`,
  play: load(headings),
};
export const CompactToolbar = {
  render: () => html`<div style=${container}>
    <p>Compact tools fit on one row whenever the available width allows it. Resize the viewport or open a formatting popover: its fields keep their normal sizes. This toolbar shows Open and Save; New remains available from Commands.</p>
    <lr-docx-editor density="compact" toolbar-layout="auto" document-tools-placement="first-row" file-actions="open save" zoom="fit"></lr-docx-editor>
  </div>`,
  play: load(headings),
};
export const HostManagedNew = {
  render: () => html`<div style=${container}>
    <p>New uses the host's starter document, even when the current document is clean. A real application can open its template chooser before calling open().</p>
    <lr-docx-editor @lr-new-request=${async event => {
      event.preventDefault();
      const result = await event.currentTarget.open(headings(), { name: 'Starter document.docx' });
      if (!result.ok) throw new Error(`Starter document refused: ${result.code}`);
    }}></lr-docx-editor>
  </div>`,
  play: load(null),
};

function outlineHost(event) {
  const host = event.currentTarget.closest('.docx-host-outline-story');
  return { editor: host.querySelector('lr-docx-editor'), output: host.querySelector('output') };
}
function describeOutline(editor, output) {
  const result = editor.outline();
  output.textContent = result.ok
    ? result.value.items.map(item => `${item.text} (body block ${item.blockIndex + 1})`).join(' · ')
    : 'The document outline is unavailable.';
}
export const HostOutlineAndExport = {
  render: () => html`<div style=${container} class="docx-host-outline-story">
    <style>.docx-host-outline-story lr-docx-editor::part(outline-toggle) { display: none; }</style>
    <p>The application manages the outline here; Checks and Review remain in the editor. Move the first section after the second, then use Undo or Redo in the editor. Exporting a copy keeps the document's unsaved state.</p>
    <div style="display:flex;flex-wrap:wrap;gap:var(--lr-space-s)">
      <lr-button size="s" appearance="outlined" @click=${event => {
        const { editor, output } = outlineHost(event);
        describeOutline(editor, output);
      }}>Refresh outline</lr-button>
      <lr-button size="s" appearance="outlined" @click=${event => {
        const { editor, output } = outlineHost(event);
        const result = editor.selectionBlock();
        output.textContent = result.ok && result.value.index !== null
          ? `The caret is in body block ${result.value.index + 1}.`
          : 'Place the caret in the document to inspect its body block.';
      }}>Locate caret</lr-button>
      <lr-button size="s" appearance="outlined" @click=${async event => {
        const { editor, output } = outlineHost(event);
        const outline = editor.outline();
        if (!outline.ok || outline.value.truncated || outline.value.items.length < 2) {
          output.textContent = 'Two complete sections are needed for this example.';
          return;
        }
        const expectedRevision = outline.value.revision;
        const fragment = editor.readFragment({ maxBlocks: 1, expectedRevision });
        if (!fragment.ok) { output.textContent = 'Refresh the outline and try again.'; return; }
        const [first, second] = outline.value.items;
        const moved = await editor.applyEdits([{ edit: {
          type: 'move-blocks', start: first.blockIndex, end: second.blockIndex, before: fragment.value.blockCount,
        } }], { expectedRevision });
        if (moved.ok) describeOutline(editor, output);
        else output.textContent = 'The section could not be moved. The document remains available.';
      }}>Move first section to end</lr-button>
      <lr-button size="s" appearance="outlined" @click=${async event => {
        const { editor, output } = outlineHost(event);
        const exported = await editor.exportBytes();
        output.textContent = exported.ok
          ? `Exported a ${exported.value.byteLength}-byte DOCX copy. The document's saved state is unchanged.`
          : 'The document copy could not be exported.';
      }}>Inspect exported copy</lr-button>
    </div>
    <output aria-live="polite"></output>
    <lr-docx-editor aria-label="Document with application outline" zoom="fit"></lr-docx-editor>
  </div>`,
  play: async context => {
    await load(() => headings(0))(context);
    describeOutline(context.canvasElement.querySelector('lr-docx-editor'), context.canvasElement.querySelector('output'));
  },
};
export const PageWideToolbar = {
  render: () => html`<div style=${container}>
    <p>The toolbar spans the application grid above the document and two host-owned sidebars. Resize the viewport to stack the workspace and sidebars. Fit zoom follows the document column. Press Alt+F10 to enter the toolbar.</p>
    <div class="docx-page-toolbar-story">
      <style>
        .docx-page-toolbar-story {
          display: grid;
          grid-template-columns: minmax(0, 14rem) minmax(0, 1fr) minmax(0, 18rem);
          grid-template-areas: "tools tools tools" "filters document results";
          align-items: start;
          gap: var(--lr-space-m);
          min-inline-size: 0;
        }
        .docx-page-toolbar-story lr-docx-editor { --lr-docx-editor-tool-border: transparent; }
        .docx-page-toolbar-story lr-docx-editor::part(toolbar-area) { grid-area: tools; }
        .docx-page-toolbar-story lr-docx-editor::part(workspace) { grid-area: document; }
        .docx-page-toolbar-story lr-docx-editor::part(toolbar-first-row) { gap: var(--lr-space-s); }
        .docx-page-toolbar-story .filters { grid-area: filters; min-inline-size: 0; }
        .docx-page-toolbar-story .results { grid-area: results; min-inline-size: 0; }
        @media (max-width: 60rem) {
          .docx-page-toolbar-story {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas: "tools" "document" "filters" "results";
          }
        }
      </style>
      <lr-docx-editor aria-label="Document editor" toolbar-placement="layout" document-tools-placement="first-row" zoom="fit"></lr-docx-editor>
      <aside class="filters" aria-label="Document filters">
        <h2>Document filters</h2>
        <p>This sidebar belongs to the application. The editor remains responsible for its toolbar, selection and document.</p>
      </aside>
      <aside class="results" aria-label="Document results">
        <h2>Document results</h2>
        <p>Open Checks in the toolbar to inspect the fixture's skipped heading level. Application analysis can occupy this separate column.</p>
      </aside>
    </div>
  </div>`,
  play: load(headings),
};

export const stories = { CommandsOutlineAndChecks, CommentsAndTrackedText, TableFormatting, ImageReplacement, PaintedParagraphs, NarrowEditor, DocumentToolsFirstRow, CompactToolbar, HostManagedNew, HostOutlineAndExport, PageWideToolbar };
