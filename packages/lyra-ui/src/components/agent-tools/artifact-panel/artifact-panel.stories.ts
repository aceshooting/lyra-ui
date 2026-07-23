import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './artifact-panel.js';
import type { ArtifactVersion } from './artifact-panel.class.js';

const meta: Meta = {
  title: 'Artifact Panel',
  component: 'lr-artifact-panel',
};
export default meta;
type Story = StoryObj;

const versions: ArtifactVersion[] = [
  { id: 'v1', label: 'v1' },
  { id: 'v2', label: 'v2' },
  { id: 'v3', label: 'v3' },
];

const REPORT_MARKDOWN = '# Report\n\nHello';

export const Default: Story = {
  render: () => html`
    <lr-artifact-panel
      style="max-width:36rem;height:16rem"
      label="report.md"
      kind="document"
      .versions=${versions}
      .copyText=${REPORT_MARKDOWN}
    >
      <div style="padding:1rem">Rendered report preview</div>
      <pre slot="code">${REPORT_MARKDOWN}</pre>
    </lr-artifact-panel>
  `,
};

export const Streaming: Story = {
  render: () => html`
    <lr-artifact-panel style="max-width:36rem;height:16rem" label="report.md" kind="document" streaming>
      <div style="padding:1rem">Partial content…</div>
    </lr-artifact-panel>
  `,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="inline-size:320px;max-inline-size:100%">
      <lr-artifact-panel
        label="quarterly-customer-support-evaluation-report-with-a-long-name.md"
        kind="generated multilingual document"
        active-version-id="v1"
        .versions=${versions}
        .copyText=${REPORT_MARKDOWN}
        download-src="data:text/plain,report"
        download-name="quarterly-customer-support-evaluation-report.md"
      >
        <div style="overflow-wrap:anywhere">Rendered preview with long content that must stay inside the panel allocation.</div>
        <pre slot="code">${REPORT_MARKDOWN}</pre>
        <button slot="actions">Open in another workspace view</button>
      </lr-artifact-panel>
    </div>
  `,
};

export const RetintedViewToggle: Story = {
  render: () => html`
    <lr-artifact-panel
      style="max-width:36rem;height:16rem;--lr-artifact-panel-view-active-bg: var(--lr-color-success-quiet);--lr-artifact-panel-view-active-color: var(--lr-color-success)"
      label="report.md"
      kind="document"
      .versions=${versions}
      .copyText=${REPORT_MARKDOWN}
    >
      <div style="padding:1rem">Rendered report preview</div>
      <pre slot="code">${REPORT_MARKDOWN}</pre>
    </lr-artifact-panel>
  `,
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-artifact-panel-view-active-bg` and `--lr-artifact-panel-view-active-color` retint the pressed (active) preview/code toggle button. `::part(view-button)[aria-pressed]` is invalid CSS, so without these props the pressed button could only be restyled by overriding the library-wide brand tokens. Unset, it renders exactly as before.',
      },
    },
  },
};
