import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Textarea',
  component: 'lyra-textarea',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-textarea
      label="Notes"
      hint="Add the context another reader will need."
      placeholder="Write something…"
    ></lyra-textarea>
  `,
};

export const AutoResize: Story = {
  render: () => html`
    <lyra-textarea
      label="Growing notes"
      resize="auto"
      rows="2"
      style="--lyra-textarea-max-block-size: 12rem"
      placeholder="Add several lines…"
    ></lyra-textarea>
  `,
};

export const ValidationMessage: Story = {
  render: () => html`
    <lyra-textarea label="Summary" error-text="A summary is required." required></lyra-textarea>
  `,
};

export const NoResize: Story = {
  render: () => html`<lyra-textarea placeholder="Fixed size" resize="none" rows="4"></lyra-textarea>`,
};

export const Disabled: Story = {
  render: () => html`<lyra-textarea placeholder="Can't type here" disabled></lyra-textarea>`,
};
