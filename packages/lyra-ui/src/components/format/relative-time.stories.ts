import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './relative-time.js';

const meta: Meta = { title: 'Utilities/Relative time', component: 'lyra-relative-time', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-relative-time date="2030-01-01"></lyra-relative-time>` };
