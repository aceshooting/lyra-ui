import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './time-input.js';

const meta: Meta = { title: 'Input/Time input', component: 'lr-time-input', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-time-input label="Start time" value="09:30"></lr-time-input>` };
