import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './progress-bar.js';
import './progress-ring.js';
const meta: Meta = { title: 'Feedback/Progress', component: 'lr-progress-bar', tags: ['autodocs'] };
export default meta;
export const Bar: StoryObj = { render: () => html`<lr-progress-bar value="65" show-value></lr-progress-bar>` };
export const CustomHeight: StoryObj = {
  render: () => html`<lr-progress-bar value="65" style="--lr-progress-height: 10px"></lr-progress-bar>`,
};
export const Ring: StoryObj = { render: () => html`<lr-progress-ring value="65"></lr-progress-ring>` };
export const NarrowLocalized: StoryObj = {
  render: () => html`
    <div style="inline-size:320px">
      <lr-progress-bar value="65" show-value aria-label="Uploading an unusually long archive">
        <span slot="label">Uploading an unusually long archive whose name must wrap safely</span>
      </lr-progress-bar>
    </div>
  `,
};
