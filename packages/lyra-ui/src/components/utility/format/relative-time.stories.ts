import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './relative-time.js';

const meta: Meta = { title: 'Utilities/Relative time', component: 'lr-relative-time', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-relative-time date="2030-01-01"></lr-relative-time>` };
export const NarrowSynchronized: StoryObj = {
  render: () => html`<lr-relative-time date="2030-01-01" format="narrow" numeric="always" sync></lr-relative-time>`,
};
export const EpochAttribute: StoryObj = {
  name: 'Numeric markup is epoch milliseconds',
  render: () => html`<lr-relative-time date="0" unit="year" numeric="always"></lr-relative-time>`,
};
