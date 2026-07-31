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

export const Readonly: Story = {
  render: () => html`
    <lr-textarea
      label="Published summary"
      value="This text remains focusable, selectable, copyable, and form-submittable."
      readonly
    ></lr-textarea>
  `,
};

/** `size` scales the field's padding and font size on the shared `2xs`-`xl` scale. */
export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 24rem">
      <lr-textarea size="xs" label="xs" rows="2"></lr-textarea>
      <lr-textarea size="m" label="m (default)" rows="2"></lr-textarea>
      <lr-textarea size="xl" label="xl" rows="2"></lr-textarea>
    </div>
  `,
};

/** `appearance` swaps the field's fill and border, matching `lr-input`'s vocabulary. */
export const Appearance: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 24rem">
      <lr-textarea appearance="filled-outlined" label="filled-outlined (default)" rows="2"></lr-textarea>
      <lr-textarea appearance="outlined" label="outlined" rows="2"></lr-textarea>
      <lr-textarea appearance="filled" label="filled" rows="2"></lr-textarea>
      <lr-textarea appearance="plain" label="plain" rows="2"></lr-textarea>
      <lr-textarea appearance="accent" label="accent" rows="2"></lr-textarea>
    </div>
  `,
};

/** `with-count` counts characters, or counts down the remaining ones under a `maxlength`. */
export const WithCount: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 24rem">
      <lr-textarea with-count label="Notes" rows="3" value="Counting up"></lr-textarea>
      <lr-textarea with-count maxlength="120" label="Bio" rows="3" value="Counting down"></lr-textarea>
    </div>
  `,
};

export const HorizontalResize: Story = {
  render: () => html`<lr-textarea label="Drag the corner sideways" resize="horizontal" rows="3"></lr-textarea>`,
};

export const Disabled: Story = {
  render: () => html`<lr-textarea placeholder="Can't type here" disabled></lr-textarea>`,
};
