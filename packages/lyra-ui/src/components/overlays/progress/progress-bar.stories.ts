import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './progress-bar.js';

const meta: Meta = { title: 'Feedback/Progress bar', component: 'lr-progress-bar', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-progress-bar value="65" show-value>Uploading files</lr-progress-bar>` };

export const UpstreamThemeHooks: StoryObj = {
  render: () => html`
    <lr-progress-bar
      value="65"
      show-value
      style="--height:var(--lr-size-1rem);--track-color:var(--lr-color-brand-quiet);--indicator-color:var(--lr-color-success);--label-color:var(--lr-color-text-quiet)"
    >Uploading files</lr-progress-bar>
  `,
};

export const SizeTiers: StoryObj = {
  name: 'Size tiers',
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; inline-size: 16rem">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-progress-bar size=${size} value="65">${size}</lr-progress-bar>`,
      )}
      <lr-progress-bar size="large" value="65">large</lr-progress-bar>
    </div>
  `,
};
