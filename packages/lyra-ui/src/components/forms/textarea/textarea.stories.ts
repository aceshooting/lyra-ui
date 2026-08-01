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

/**
 * `size` scales the field's padding and font size on the library's one form-control ladder, shared
 * with `<lr-input>`/`<lr-select>`/`<lr-button>`. A textarea's own height comes from `rows`/`resize`,
 * so the ladder's control-height floor does not apply here.
 */
export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 24rem">
      ${['2xs', 'xs', 's', 'm', 'l', 'xl'].map(
        (size) => html`<lr-textarea size=${size} label=${size} rows="2"></lr-textarea>`,
      )}
    </div>
  `,
};

/** The `small`/`medium`/`large` spellings render exactly what `s`/`m`/`l` render. */
export const SizeSpellings: Story = {
  name: 'Both size spellings',
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 24rem">
      <lr-textarea size="s" label='size="s"' rows="2"></lr-textarea>
      <lr-textarea size="small" label='size="small"' rows="2"></lr-textarea>
    </div>
  `,
};

/**
 * `pill` rounds the field's corners fully, matching `<lr-input>`'s and `<lr-select>`'s own `pill`.
 * It reads best on a one- or two-row field; a tall surface with fully rounded ends wastes the first
 * and last line's inline space, which is why it is opt-in rather than tied to `size`.
 */
export const Pill: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-inline-size: 24rem">
      <lr-textarea pill label="pill" rows="2" placeholder="Rounded ends"></lr-textarea>
      <lr-textarea label="default" rows="2" placeholder="Square ends"></lr-textarea>
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
