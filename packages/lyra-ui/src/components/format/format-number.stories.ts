import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './format-number.js';

const meta: Meta = { title: 'Utilities/Format number', component: 'lyra-format-number', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-format-number value="12345.67"></lyra-format-number>` };
