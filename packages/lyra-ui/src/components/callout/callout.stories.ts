import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './callout.js';
const meta: Meta = { title: 'Feedback/Callout', component: 'lyra-callout', tags: ['autodocs'] };
export default meta;
export const Dismissible: StoryObj = { render: () => html`<lyra-callout variant="warning" heading="Attention" closable>Review the pending changes before continuing.</lyra-callout>` };
export const InlineError: StoryObj = {
  name: 'Inline error',
  render: () => html`<lyra-callout inline variant="danger"><span slot="icon" aria-hidden="true">!</span>Unable to save changes.</lyra-callout>`,
};
