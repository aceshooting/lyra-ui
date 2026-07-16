import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './include.js';

const meta: Meta = { title: 'Utilities/Include', component: 'lyra-include' };
export default meta;
type Story = StoryObj;

// A data: URL avoids a live network dependency in Storybook, same pattern as
// html-viewer.stories.ts.
const fragment = '<article><h2>Included fragment</h2><p>This markup was fetched and sanitized, then transcluded as light-DOM content.</p></article>';
const src = `data:text/html,${encodeURIComponent(fragment)}`;

export const Default: Story = {
  render: () => html`<lyra-include src=${src} @lyra-load=${(event: CustomEvent) => console.log('lyra-load', event.detail)}></lyra-include>`,
};

export const Empty: Story = { render: () => html`<lyra-include></lyra-include>` };

export const WithFallbackContent: Story = {
  render: () => html`<lyra-include>Loading…</lyra-include>`,
};
