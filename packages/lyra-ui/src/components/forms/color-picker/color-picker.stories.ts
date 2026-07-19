import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './color-picker.js';
const meta: Meta = { title: 'Form/Color picker', component: 'lr-color-picker', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-color-picker label="Accent color"></lr-color-picker>` };
