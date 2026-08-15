import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSizeStep } from '../../../internal/variants.js';

const meta: Meta = {
  title: 'DatePicker/Inline',
  component: 'lr-date-picker',
  tags: ['autodocs', 'experimental'],
  parameters: {
    docs: {
      description: {
        component: 'Experimental date-picker surface, including range constraints, calendar views, custom day content, and week numbers.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          '`firstDayOfWeek` uses the shared closed weekday vocabulary (`auto`, then `sun` through `sat`) on both `lr-date-picker` and `lr-date-input`; `auto` derives from the effective locale when the runtime exposes week info.',
      },
    },
  },
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
    const sizes: LyraSizeStep[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem">
        ${sizes.map((size) => html`<lr-date-picker size=${size} value="2026-07-15"></lr-date-picker>`)}
      </div>
    `;
  },
};

export const CustomCellGeometry: Story = {
  name: 'Custom day-cell geometry',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-cell-size` sets both dimensions of every day cell and the seven matching grid tracks. Its private default is `var(--lr-size-2-25rem)` and follows the public `size` tier; an inherited or direct `--lr-cell-size` remains authoritative.',
      },
    },
  },
  render: () => html`
    <lr-date-picker
      value="2026-07-15"
      style="--lr-cell-size: calc(var(--lr-size-2-5rem) + var(--lr-space-xs))"
    ></lr-date-picker>
  `,
};

export const PartAliases: Story = {
  name: 'Date-picker/base part aliases',
  parameters: {
    docs: {
      description: {
        story:
          'Web Awesome’s `date-picker` part and the deprecated Lyra `base` compatibility name are tokens on the same visible shell. Either consumer selector therefore reaches identical padding, background, border, and radius chrome.',
      },
    },
  },
  render: () => html`
    <style>
      .date-picker-part::part(date-picker),
      .base-part::part(base) {
        padding: var(--lr-space-m);
        background: var(--lr-color-brand-quiet);
        border-color: var(--lr-color-brand);
        border-radius: var(--lr-radius);
      }
    </style>
    <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-l);">
      <lr-date-picker
        class="date-picker-part"
        value="2026-07-15"
        aria-label="Styled through date-picker part"
      ></lr-date-picker>
      <lr-date-picker
        class="base-part"
        value="2026-07-15"
        aria-label="Styled through base part"
      ></lr-date-picker>
    </div>
  `,
};

export const ConstraintsAndSlots: Story = {
  name: 'Disabled dates, range limits, week numbers, and slots',
  render: () => html`
    <lr-date-picker
      mode="range"
      value="2026-07-10"
      focused-date="2026-07-10"
      today="2026-07-15"
      disabled-dates="2026-07-12 2026-07-19"
      disabled-days-of-week="sun"
      min-range="3"
      max-range="10"
      with-week-numbers
      .dayContent=${(date: Date) => date.getDate() === 15 ? html`<strong>${date.getDate()}</strong>` : undefined}
    >
      <span slot="previous-icon" aria-hidden="true">‹</span>
      <span slot="next-icon" aria-hidden="true">›</span>
      <small slot="footer">Select a period from 3 to 10 days.</small>
    </lr-date-picker>
  `,
};

export const CalendarViews: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Each month, year, and decade grid keeps one enabled Tab stop. Arrow keys follow its four-column layout (with horizontal movement mirrored in RTL), Home and End stay within the current page, and Enter or Space drills into the focused period.',
      },
    },
  },
  render: () => html`
    <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1rem;">
      <lr-date-picker view="months" value="2026-07-15"></lr-date-picker>
      <lr-date-picker view="years" value="2026-07-15"></lr-date-picker>
      <lr-date-picker view="decades" value="2026-07-15"></lr-date-picker>
    </div>
  `,
};

export const SelectionViewAvailability: Story = {
  name: 'Selection views respect date constraints',
  parameters: {
    docs: {
      description: {
        story:
          'Month, year, and decade choices are enabled only when they contain at least one selectable day under the same bounds, past/future, date-list, weekday, predicate, and pending-range constraints as the day grid. The frozen today makes earlier months visibly unavailable here.',
      },
    },
  },
  render: () => html`
    <lr-date-picker
      view="months"
      value="2026-07-15"
      today="2026-07-15"
      disable-past
    ></lr-date-picker>
  `,
};

export const ScopedStateTheme: Story = {
  name: 'Scoped calendar state theme',
  parameters: { docs: { description: { story: 'Day and selection-view states use independent component hooks while retaining the shared semantic tokens as defaults.' } } },
  render: () => html`
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--lr-space-l)">
      <lr-date-picker
        value="2026-07-15"
        today="2026-07-10"
        style="--lr-date-picker-title-hover-color: var(--lr-color-warning); --lr-date-picker-title-active-color: var(--lr-color-danger); --lr-date-picker-title-active-bg: var(--lr-color-danger-quiet); --lr-date-picker-title-active-radius: var(--lr-radius-pill); --lr-date-picker-day-hover-bg: var(--lr-color-warning-quiet); --lr-date-picker-selected-bg: var(--lr-color-success); --lr-date-picker-selected-color: var(--lr-color-on-success); --lr-date-picker-today-outline: var(--lr-color-warning)"
      ></lr-date-picker>
      <lr-date-picker
        view="months"
        value="2026-07-15"
        style="--lr-date-picker-view-hover-bg: var(--lr-color-warning-quiet); --lr-date-picker-view-selected-bg: var(--lr-color-danger); --lr-date-picker-view-selected-color: var(--lr-color-on-danger)"
      ></lr-date-picker>
    </div>
  `,
};
