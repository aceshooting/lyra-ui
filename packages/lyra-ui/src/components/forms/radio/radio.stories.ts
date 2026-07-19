import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio.js';
import './radio-group.js';
const meta: Meta = { title: 'Form/Radio', component: 'lr-radio-group', tags: ['autodocs'] };
export default meta;
export const Group: StoryObj = { render: () => html`<lr-radio-group label="Format" name="format"><lr-radio value="json">JSON</lr-radio><lr-radio value="csv">CSV</lr-radio></lr-radio-group>` };
