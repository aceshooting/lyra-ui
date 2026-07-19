import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './spinner.js';
const meta: Meta = { title: 'Feedback/Spinner', component: 'lr-spinner', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-spinner label-placement="after">Loading data</lr-spinner>` };
