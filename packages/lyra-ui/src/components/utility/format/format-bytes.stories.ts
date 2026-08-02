import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './format-bytes.js';

const meta: Meta = { title: 'Utilities/Format bytes', component: 'lr-format-bytes', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-format-bytes value="1000000"></lr-format-bytes>` };
export const BitsAndDisplay: StoryObj = {
  render: () => html`
    <p><lr-format-bytes value="1000000" unit="bit" display="long"></lr-format-bytes></p>
    <p><lr-format-bytes value="1000000" unit="byte" display="narrow"></lr-format-bytes></p>
  `,
};
