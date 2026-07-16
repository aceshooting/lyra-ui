import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './progress-bar.js';

const meta: Meta = { title: 'Feedback/Progress bar', component: 'lyra-progress-bar', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-progress-bar value="65" show-value></lyra-progress-bar>` };
