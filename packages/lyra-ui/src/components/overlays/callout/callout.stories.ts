import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './callout.js';
const meta: Meta = { title: 'Feedback/Callout', component: 'lr-callout', tags: ['autodocs'] };
export default meta;
export const Dismissible: StoryObj = { render: () => html`<lr-callout variant="warning" heading="Attention" closable>Review the pending changes before continuing.</lr-callout>` };
export const InlineError: StoryObj = {
  name: 'Inline error',
  render: () => html`<lr-callout inline variant="danger"><span slot="icon" aria-hidden="true">!</span>Unable to save changes.</lr-callout>`,
};
