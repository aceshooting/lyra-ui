import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './format-bytes.js';

const meta: Meta = { title: 'Utilities/Format bytes', component: 'lr-format-bytes', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-format-bytes value="1048576"></lr-format-bytes>` };
