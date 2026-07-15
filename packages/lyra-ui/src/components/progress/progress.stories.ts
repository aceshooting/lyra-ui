import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './progress-bar.js';
import './progress-ring.js';
const meta: Meta = { title: 'Feedback/Progress', component: 'lyra-progress-bar', tags: ['autodocs'] };
export default meta;
export const Bar: StoryObj = { render: () => html`<lyra-progress-bar value="65" show-value></lyra-progress-bar>` };
export const Ring: StoryObj = { render: () => html`<lyra-progress-ring value="65"></lyra-progress-ring>` };
