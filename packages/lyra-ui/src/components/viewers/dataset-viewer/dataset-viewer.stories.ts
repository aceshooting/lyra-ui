import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dataset-viewer.js';

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
          'PapaParse diagnostics emit `lr-render-error` even when a recoverable partial table remains visible.',
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
  render: () => html`
    <lr-dataset-viewer
      src=${pageSrc}
      name="Page-scrolling people"
      scroll-mode="page"
    ></lr-dataset-viewer>
  `,
};
