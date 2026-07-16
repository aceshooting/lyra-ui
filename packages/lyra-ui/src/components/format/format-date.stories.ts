import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './format-date.js';

const meta: Meta = { title: 'Utilities/Format date', component: 'lyra-format-date', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-format-date date="2024-01-01"></lyra-format-date>` };
