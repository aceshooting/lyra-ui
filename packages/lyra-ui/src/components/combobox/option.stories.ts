import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './option.js';

const meta: Meta = { title: 'Combobox/Option', component: 'lyra-option', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-option value="example">Example option</lyra-option>` };
