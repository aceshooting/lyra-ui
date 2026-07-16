import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './result-field.js';

const meta: Meta = { title: 'ResultCard/Result field', component: 'lyra-result-field', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-result-field label="Status" value="200 OK"></lyra-result-field>` };
