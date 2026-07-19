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
