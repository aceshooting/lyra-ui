import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'DatePicker/WithInput',
  component: 'lyra-date-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-date-input label="Start date" with-clear style="max-width: 16rem"></lyra-date-input>
  `,
};

export const MinMax: Story = {
  render: () => html`
    <lyra-date-input
      label="Appointment date"
      min="2026-07-10"
      max="2026-07-20"
      value="2026-07-15"
      style="max-width: 16rem"
    ></lyra-date-input>
  `,
};

export const DisablePast: Story = {
  render: () => html`
    <lyra-date-input label="Upcoming date" disable-past style="max-width: 16rem"></lyra-date-input>
  `,
};

export const DisableFuture: Story = {
  render: () => html`
    <lyra-date-input label="Historical date" disable-future style="max-width: 16rem"></lyra-date-input>
  `,
};

export const Range: Story = {
  render: () => html`
    <lyra-date-input label="Trip dates" mode="range" months="2" style="max-width: 20rem"></lyra-date-input>
  `,
};

export const WithOutsideDays: Story = {
  render: () => html`
    <lyra-date-input
      label="Meeting date"
      with-outside-days
      value="2026-07-15"
      style="max-width: 16rem"
    ></lyra-date-input>
  `,
};

export const Localized: Story = {
  render: () => html`
    <lyra-date-input
      label="Date de rendez-vous"
      locale="fr-FR"
      first-day-of-week="mon"
      with-clear
      clear-label="Effacer"
      open-label="Ouvrir le calendrier"
      dialog-label="Choisir une date"
      value="2026-07-15"
      style="max-width: 16rem"
    ></lyra-date-input>
  `,
};
