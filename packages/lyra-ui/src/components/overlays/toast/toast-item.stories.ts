import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './toast-item.js';

const meta: Meta = { title: 'Feedback/Toast item', component: 'lr-toast-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-toast-item>Saved successfully.</lr-toast-item>` };
