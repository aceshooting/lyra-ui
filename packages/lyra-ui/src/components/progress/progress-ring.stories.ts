import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './progress-ring.js';

const meta: Meta = { title: 'Feedback/Progress ring', component: 'lyra-progress-ring', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-progress-ring value="65"></lyra-progress-ring>` };
