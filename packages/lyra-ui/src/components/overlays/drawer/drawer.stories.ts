import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Drawer',
  component: 'lr-drawer',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const End: Story = {
  render: (_args, context) => html`<lr-drawer .open=${context.viewMode !== 'docs'} placement="end" heading="Filters" closable>
    <p>Use this panel for contextual controls without leaving the current page.</p>
    <div slot="footer"><button type="button">Apply</button></div>
  </lr-drawer>`,
};

export const Start: Story = {
  render: (_args, context) => html`<lr-drawer .open=${context.viewMode !== 'docs'} placement="start" aria-label="Navigation">
    <nav aria-label="Sections"><a href="#overview">Overview</a></nav>
  </lr-drawer>`,
};
