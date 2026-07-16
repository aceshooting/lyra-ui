import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio-group.js';
import './radio.js';

const meta: Meta = { title: 'Input/Radio group', component: 'lyra-radio-group', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-radio-group label="Size"><lyra-radio value="small">Small</lyra-radio><lyra-radio value="large">Large</lyra-radio></lyra-radio-group>` };
