import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Drawer',
  component: 'lyra-drawer',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const End: Story = {
  render: () => html`<lyra-drawer open placement="end" heading="Filters" closable>
    <p>Use this panel for contextual controls without leaving the current page.</p>
    <div slot="footer"><button type="button">Apply</button></div>
  </lyra-drawer>`,
};

export const Start: Story = {
  render: () => html`<lyra-drawer open placement="start" aria-label="Navigation">
    <nav aria-label="Sections"><a href="#overview">Overview</a></nav>
  </lyra-drawer>`,
};
