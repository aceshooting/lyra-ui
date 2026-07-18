import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Textarea',
  component: 'lr-textarea',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-textarea
      label="Notes"
      hint="Add the context another reader will need."
      placeholder="Write something…"
    ></lr-textarea>
  `,
};

export const AutoResize: Story = {
  render: () => html`
    <lr-textarea
      label="Growing notes"
      resize="auto"
      rows="2"
      style="--lr-textarea-max-block-size: 12rem"
      placeholder="Add several lines…"
    ></lr-textarea>
  `,
};

export const ValidationMessage: Story = {
  render: () => html`
    <lr-textarea label="Summary" error-text="A summary is required." required></lr-textarea>
  `,
};

export const NoResize: Story = {
  render: () => html`<lr-textarea placeholder="Fixed size" resize="none" rows="4"></lr-textarea>`,
};

export const Disabled: Story = {
  render: () => html`<lr-textarea placeholder="Can't type here" disabled></lr-textarea>`,
};
