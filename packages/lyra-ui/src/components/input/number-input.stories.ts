import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './number-input.js';

const meta: Meta = { title: 'Input/Number input', component: 'lr-number-input', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-number-input label="Quantity" value="2" min="0" max="10"></lr-number-input>` };
