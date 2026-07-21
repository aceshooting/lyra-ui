import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraDatePickerSize } from './date-picker.js';

const meta: Meta = {
  title: 'DatePicker/Inline',
  component: 'lr-date-picker',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Single: Story = {
  render: () => html`<lr-date-picker mode="single"></lr-date-picker>`,
};

export const Range: Story = {
  render: () => html`<lr-date-picker mode="range" months="2"></lr-date-picker>`,
};

export const RangeNarrowAllocation: Story = {
  name: 'Two months at a 320px allocation',
  parameters: {
    docs: {
      description: {
        story:
          'At a 320px allocation -- narrower than the two fixed-width month grids side by side -- the second month wraps onto its own line instead of overflowing the panel.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%;">
      <lr-date-picker mode="range" months="2"></lr-date-picker>
    </div>
  `,
};

export const MinMax: Story = {
  render: () => html`<lr-date-picker min="2026-07-10" max="2026-07-20" value="2026-07-15"></lr-date-picker>`,
};

export const DisablePast: Story = {
  render: () => html`<lr-date-picker disable-past></lr-date-picker>`,
};

export const DisableFuture: Story = {
  render: () => html`<lr-date-picker disable-future></lr-date-picker>`,
};

export const WithOutsideDays: Story = {
  render: () => html`<lr-date-picker with-outside-days value="2026-07-15"></lr-date-picker>`,
};

export const Localized: Story = {
  render: () => html`
    <lr-date-picker
      locale="fr-FR"
      first-day-of-week="mon"
      value="2026-07-15"
      previous-label="Mois précédent"
      next-label="Mois suivant"
    ></lr-date-picker>
  `,
};

/** `size` scales calendar cell density proportionally — `2xs`–`xl` range, default `m`.
 * Unlike `lr-input`'s row-height scale (rows are text containers), this scales cell
 * density itself (fewer/more days per visual unit); neither label nor nav buttons rescale. */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraDatePickerSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem">
        ${sizes.map((size) => html`<lr-date-picker size=${size} value="2026-07-15"></lr-date-picker>`)}
      </div>
    `;
  },
};
