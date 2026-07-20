import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'DatePicker/WithInput',
  component: 'lr-date-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-date-input label="Start date" with-clear style="max-width: 16rem"></lr-date-input>
  `,
};

/** `size` spans the same `2xs`–`xl` scale as `lr-input`/`lr-select`, default `m`. */
export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`
          <lr-date-input size=${size} placeholder=${`Size "${size}"`}></lr-date-input>
        `,
      )}
    </div>
  `,
};

export const MinMax: Story = {
  render: () => html`
    <lr-date-input
      label="Appointment date"
      min="2026-07-10"
      max="2026-07-20"
      value="2026-07-15"
      style="max-width: 16rem"
    ></lr-date-input>
  `,
};

export const DisablePast: Story = {
  render: () => html`
    <lr-date-input label="Upcoming date" disable-past style="max-width: 16rem"></lr-date-input>
  `,
};

export const DisableFuture: Story = {
  render: () => html`
    <lr-date-input label="Historical date" disable-future style="max-width: 16rem"></lr-date-input>
  `,
};

export const Range: Story = {
  render: () => html`
    <lr-date-input label="Trip dates" mode="range" months="2" style="max-width: 20rem"></lr-date-input>
  `,
};

export const WithOutsideDays: Story = {
  render: () => html`
    <lr-date-input
      label="Meeting date"
      with-outside-days
      value="2026-07-15"
      style="max-width: 16rem"
    ></lr-date-input>
  `,
};

export const Localized: Story = {
  render: () => html`
    <lr-date-input
      label="Date de rendez-vous"
      locale="fr-FR"
      first-day-of-week="mon"
      with-clear
      clear-label="Effacer"
      open-label="Ouvrir le calendrier"
      dialog-label="Choisir une date"
      value="2026-07-15"
      style="max-width: 16rem"
    ></lr-date-input>
  `,
};

export const Adornments: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `start` and `end` slots place decorative chrome inside the input row. `end` renders ' +
          'before the calendar toggle, so consumer content is never outboard of it.',
      },
    },
  },
  render: () => html`
    <lr-date-input label="Departure" with-clear value="2026-07-15" style="max-width: 22rem">
      <span slot="start" aria-hidden="true">✈</span>
      <small slot="end">UTC</small>
    </lr-date-input>
  `,
};

export const PinnedControlHeight: Story = {
  name: 'Pinned control height (--lr-date-input-control-height)',
  parameters: {
    docs: {
      description: {
        story:
          'The input row grows to fit its content by default, floored per tier by `--lr-date-input-control-min-height`. Set `--lr-date-input-control-height` to pin an exact row height; the calendar toggle keeps its own 24x24 touch target even when the row is pinned shorter.',
      },
    },
  },
  render: () => html`
    <lr-date-input label="Departure" with-clear value="2026-07-15" style="max-width: 22rem; --lr-date-input-control-height: 52px"></lr-date-input>
  `,
};
