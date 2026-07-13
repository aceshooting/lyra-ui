import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'DatePicker/Inline',
  component: 'lyra-date-picker',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Single: Story = {
  render: () => html`<lyra-date-picker mode="single"></lyra-date-picker>`,
};

export const Range: Story = {
  render: () => html`<lyra-date-picker mode="range" months="2"></lyra-date-picker>`,
};

export const MinMax: Story = {
  render: () => html`<lyra-date-picker min="2026-07-10" max="2026-07-20" value="2026-07-15"></lyra-date-picker>`,
};

export const DisablePast: Story = {
  render: () => html`<lyra-date-picker disable-past></lyra-date-picker>`,
};

export const DisableFuture: Story = {
  render: () => html`<lyra-date-picker disable-future></lyra-date-picker>`,
};

export const WithOutsideDays: Story = {
  render: () => html`<lyra-date-picker with-outside-days value="2026-07-15"></lyra-date-picker>`,
};

export const Localized: Story = {
  render: () => html`
    <lyra-date-picker
      locale="fr-FR"
      first-day-of-week="mon"
      value="2026-07-15"
      previous-label="Mois précédent"
      next-label="Mois suivant"
    ></lyra-date-picker>
  `,
};
