import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './progress-ring.js';

const meta: Meta = { title: 'Feedback/Progress ring', component: 'lr-progress-ring', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-progress-ring value="65" show-value label="Upload progress">65%</lr-progress-ring>` };

/** The named label slot is the progress-bar-compatible alias for center content. */
export const LabelSlot: StoryObj = {
  render: () => html`
    <lr-progress-ring value="65"><span slot="label">Syncing</span></lr-progress-ring>
  `,
};

export const UpstreamThemeHooks: StoryObj = {
  render: () => html`
    <lr-progress-ring
      value="65"
      show-value
      label="Upload progress"
      style="--size:var(--lr-size-3rem);--track-width:var(--lr-border-width-medium);--indicator-width:var(--lr-size-4px);--track-color:var(--lr-color-brand-quiet);--indicator-color:var(--lr-color-success)"
    >65%</lr-progress-ring>
  `,
};

export const ShowValue: StoryObj = {
  render: () => html`
    <div style="display:flex;gap:var(--lr-size-1rem);align-items:center">
      <lr-progress-ring value="65" aria-label="No percentage text"></lr-progress-ring>
      <lr-progress-ring value="65" show-value aria-label="Upload progress"></lr-progress-ring>
    </div>
  `,
};
