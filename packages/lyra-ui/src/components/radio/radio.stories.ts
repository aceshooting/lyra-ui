import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio.js';
import './radio-group.js';
const meta: Meta = { title: 'Form/Radio', component: 'lyra-radio-group', tags: ['autodocs'] };
export default meta;
export const Group: StoryObj = { render: () => html`<lyra-radio-group label="Format" name="format"><lyra-radio value="json">JSON</lyra-radio><lyra-radio value="csv">CSV</lyra-radio></lyra-radio-group>` };
