import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './html-viewer.js';

const meta: Meta = { title: 'DocumentViewer/HtmlViewer', component: 'lr-html-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = '<article><h2>Rendered report</h2><p>This content is sanitized before it reaches the DOM.</p></article>';
const src = `data:text/html,${encodeURIComponent(source)}`;
const narrowSource = '<article><h2>International quarterly analytical-engine research report</h2><p>InternationalQuarterlyAnalyticalEngineResearchWithoutConvenientBreakpoints</p></article>';
const narrowSrc = `data:text/html,${encodeURIComponent(narrowSource)}`;

export const Default: Story = { render: () => html`<lr-html-viewer src=${src} name="Rendered report"></lr-html-viewer>` };
export const Empty: Story = { render: () => html`<lr-html-viewer></lr-html-viewer>` };

/** Baseline narrow-allocation coverage with long sanitized content. */
export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size:320px">
      <lr-html-viewer
        src=${narrowSrc}
        name="International quarterly analytical-engine research report.html"
      ></lr-html-viewer>
    </div>
  `,
};
