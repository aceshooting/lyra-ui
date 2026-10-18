import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dataset-viewer.js';
import type { DatasetViewerSource } from './dataset-viewer.js';

const meta: Meta = {
  title: 'DocumentViewer/DatasetViewer',
  component: 'lr-dataset-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'A host `aria-label` names the loaded table by attribute presence, including an explicitly empty value; `name` and the localized row-count caption are fallbacks. Highlight actions localize their complete cell value and annotation through separate `{value}` and `{label}` placeholders. Quote-aware row, field, aggregate-cell, and diagnostic ceilings are enforced before PapaParse materializes records.' } } },
};
export default meta;
type Story = StoryObj;

const source = 'name\tstatus\nAda\tActive\nGrace\tActive';
const src = `data:text/tab-separated-values,${encodeURIComponent(source)}`;
const pageSource = [
  'name\tstatus',
  ...Array.from({ length: 80 }, (_, index) => `Person ${index + 1}\tActive`),
].join('\n');
const pageSrc = `data:text/tab-separated-values,${encodeURIComponent(pageSource)}`;

export const Default: Story = { render: () => html`<lr-dataset-viewer src=${src} name="People"></lr-dataset-viewer>` };
export const Empty: Story = { render: () => html`<lr-dataset-viewer></lr-dataset-viewer>` };

export const RecoverableParserDiagnostics: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'PapaParse diagnostics emit `lr-viewer-diagnostic` while a recoverable partial table remains visible.',
      },
    },
  },
  render: () => {
    const malformed = 'name,role\nAda,Mathematician,unexpected';
    return html`<lr-dataset-viewer
      src=${`data:text/csv,${encodeURIComponent(malformed)}`}
      name="Dataset with parser diagnostics"
    ></lr-dataset-viewer>`;
  },
};

/** A narrow host (320px), matching the library's baseline narrow-allocation check -- confirms the
 *  sticky header row stays visible and legible above the virtualized body at that width. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-dataset-viewer src=${src} name="People"></lr-dataset-viewer></div>`,
};

/** Hands an uncapped dataset's sticky header to the document scrollport. Use the default `self`
 *  mode instead when horizontal containment is more important than page-level sticky behavior. */
export const PageScrolling: Story = {
  parameters: { docs: { description: { story: 'Scroll the page while the populated table extends below the header. Page mode preserves the border and rounded corners without creating a competing scroll container.' } } },
  render: () => html`
    <lr-dataset-viewer
      src=${pageSrc}
      name="Page-scrolling people"
      scroll-mode="page"
    ></lr-dataset-viewer>
  `,
};

/** `--lr-dataset-viewer-header-row-bg` retints the sticky header row independent of the
 *  highlight outline (`--lr-dataset-viewer-highlight-color`). */
export const RetintedHeaderRow: Story = {
  render: () => html`<lr-dataset-viewer
    src=${src}
    name="People"
    style="--lr-dataset-viewer-header-row-bg: var(--lr-color-success-quiet);"
  ></lr-dataset-viewer>`,
};

export const InMemory: Story = {
  parameters: { docs: { description: { story: 'An owned scalar-cell snapshot bypasses fetch and parser loading. Set limits before assigning the input; clearing it restores src. Row, column, and byte limits can be raised to ten times their defaults, while the aggregate cell limit remains 1,000,000.' } } },
  render: () => html`<lr-dataset-viewer .maxRows=${20000} .maxColumns=${2000} .maxBytes=${52428800} .table=${{ fields: ['name', 'role'], rows: [{ name: 'Ada', role: 'Mathematician' }] }} max-height="20rem"></lr-dataset-viewer>`,
};


const indexedSource: DatasetViewerSource = { revision: 1, rowCount: 1_000_000, columnCount: 3,
  columnAt: (index: number) => ({ key: String(index), label: ['Record', 'Category', 'Value'][index]! }),
  cellAt: (row: number, column: number) => column === 0 ? row + 1 : column === 1 ? `Category ${row % 12}` : `Value ${row + 1}`,
};
export const MillionRecords: Story = {
  parameters: { docs: { description: { story: 'The host supplies one million logical body records without constructing a row array. Separate column labels occupy display row one; the last body row is A1000001. Source rows use the live --lr-size-3rem token, with bounded overflowing display. Global search is available only when the source supplies search(). Assign undefined to restore the ordinary input or URL.' } } },
  render: () => html`<lr-dataset-viewer .dataSource=${indexedSource} .anchor=${{ kind: 'cell-range', range: 'A1000001' } }></lr-dataset-viewer>`,
};
