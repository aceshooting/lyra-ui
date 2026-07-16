import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './toast-item.js';

const meta: Meta = { title: 'Feedback/Toast item', component: 'lyra-toast-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-toast-item open>Saved successfully.</lyra-toast-item>` };
