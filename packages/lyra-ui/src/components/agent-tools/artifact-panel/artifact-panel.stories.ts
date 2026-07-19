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
    <div style="max-width:320px">
      <lr-artifact-panel label="report.md" kind="document" .versions=${versions}>
        <div>Preview</div>
        <pre slot="code">code</pre>
      </lr-artifact-panel>
    </div>
  `,
};
