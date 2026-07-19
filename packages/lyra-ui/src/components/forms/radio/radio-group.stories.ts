import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio-group.js';
import './radio.js';

const meta: Meta = { title: 'Input/Radio group', component: 'lr-radio-group', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-radio-group label="Size"><lr-radio value="small">Small</lr-radio><lr-radio value="large">Large</lr-radio></lr-radio-group>` };
