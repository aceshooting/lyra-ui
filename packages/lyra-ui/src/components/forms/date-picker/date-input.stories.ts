import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraDateInputValidator } from './date-input.class.js';

const meta: Meta = {
  title: 'DatePicker/WithInput',
  component: 'lr-date-input',
  tags: ['autodocs', 'experimental'],
  parameters: {
    docs: {
      description: {
        component: 'Experimental form-associated date input with single/range values, a positioned calendar, mapped lifecycle events, and SSR slot hints.',
      },
    },
  },
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

/**
 * `size` also accepts the Web Awesome / Shoelace spellings — `small`, `medium` and `large` render
 * exactly as `s`, `m` and `l` — and `pill` rounds the input row to a full pill.
 */
export const AliasSizesAndPill: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      <lr-date-input size="small" placeholder='size="small"'></lr-date-input>
      <lr-date-input size="medium" placeholder='size="medium"'></lr-date-input>
      <lr-date-input size="large" placeholder='size="large"'></lr-date-input>
      <lr-date-input pill placeholder="pill"></lr-date-input>
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

const mappedObjectValidator: LyraDateInputValidator = {
  observedAttributes: ['data-booking-window'],
  checkValidity: (input) => {
    const isValid = (input as unknown as HTMLElement).getAttribute('data-booking-window') === 'open';
    return {
      isValid,
      message: 'Choose a date in the active booking window.',
      invalidKeys: ['customError'],
    };
  },
};

export const UpstreamObjectValidator: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `validators` property accepts Web Awesome-compatible `{ observedAttributes?, checkValidity(), message? }` objects in addition to Lyra function and `validate()` forms. Changing a listed host attribute automatically re-runs validity.',
      },
    },
  },
  render: () => {
    const toggleBookingWindow = (event: Event) => {
      const container = (event.currentTarget as HTMLElement).parentElement;
      const input = container?.querySelector('lr-date-input');
      if (!input) return;
      const open = input.getAttribute('data-booking-window') === 'open';
      input.setAttribute('data-booking-window', open ? 'closed' : 'open');
      const output = container?.querySelector('output');
      if (output) output.textContent = open ? 'Booking window closed' : 'Booking window open';
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-s); max-width: 20rem;">
        <lr-date-input
          label="Appointment date"
          value="2026-07-15"
          data-booking-window="closed"
          .validators=${[mappedObjectValidator]}
        ></lr-date-input>
        <button type="button" @click=${toggleBookingWindow}>Toggle booking window</button>
        <output aria-live="polite">Booking window closed</output>
      </div>
    `;
  },
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

export const RangeConstraintsAndLifecycle: Story = {
  name: 'Range constraints, delegated slots, and lifecycle',
  render: () => html`
    <lr-date-input
      appearance="filled-outlined"
      label="Reporting period"
      hint="Choose between 3 and 14 days"
      name="period"
      mode="range"
      months="2"
      min-range="3"
      max-range="14"
      disabled-dates="2026-07-12 2026-07-19"
      disabled-days-of-week="sun"
      placement="bottom-start"
      distance="6"
      today="2026-07-15"
      with-clear
      with-week-numbers
      style="max-width: 24rem; --show-duration: 120ms; --hide-duration: 90ms"
    >
      <span slot="start" aria-hidden="true">📅</span>
      <span slot="clear-icon" aria-hidden="true">×</span>
      <span slot="expand-icon" aria-hidden="true">▾</span>
      <span slot="previous-icon" aria-hidden="true">‹</span>
      <span slot="next-icon" aria-hidden="true">›</span>
      <strong slot="day-2026-07-15">15</strong>
      <small slot="footer">Dates are submitted in ISO 8601 form.</small>
    </lr-date-input>
  `,
};

export const SsrSlotHints: Story = {
  name: 'SSR label and hint hints',
  render: () => html`
    <lr-date-input with-label with-hint>
      <span slot="label">Hydrated date</span>
      <span slot="hint">These wrappers are present on the first server render.</span>
    </lr-date-input>
  `,
};
