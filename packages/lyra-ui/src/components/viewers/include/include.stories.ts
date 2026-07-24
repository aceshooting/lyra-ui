import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './include.js';

const meta: Meta = { title: 'Utilities/Include', component: 'lr-include' };
export default meta;
type Story = StoryObj;

// A data: URL avoids a live network dependency in Storybook, same pattern as
// html-viewer.stories.ts.
const fragment = '<article><h2>Included fragment</h2><p>This markup was fetched and sanitized, then transcluded as light-DOM content.</p></article>';
const src = `data:text/html,${encodeURIComponent(fragment)}`;
const narrowFragment = '<article><h2>International quarterly analytical-engine research fragment</h2><p>InternationalQuarterlyAnalyticalEngineResearchWithoutConvenientBreakpoints</p></article>';
const narrowSrc = `data:text/html,${encodeURIComponent(narrowFragment)}`;

export const Default: Story = {
  render: () => html`<lr-include src=${src} @lr-load=${(event: CustomEvent) => console.log('lr-load', event.detail)}></lr-include>`,
};

export const Empty: Story = { render: () => html`<lr-include></lr-include>` };

export const WithFallbackContent: Story = {
  render: () => html`<lr-include>Loading…</lr-include>`,
};

/** Baseline narrow-allocation coverage with long transcluded content. */
export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size:320px">
      <lr-include src=${narrowSrc}>Loading a long international research fragment…</lr-include>
    </div>
  `,
};
