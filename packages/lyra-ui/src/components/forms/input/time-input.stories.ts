import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './time-input.js';
import type { LyraTimeInput } from './time-input.class.js';

const meta: Meta = {
  title: 'Input/Time input',
  component: 'lr-time-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-time-input label="Start time" value="09:30" with-clear with-now style="max-width: 20rem"></lr-time-input>
  `,
};

/** Host-owned guidance is resolved onto the segmented semantic group before its own hint text. */
export const ExternalDescription: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem)">
      <p id="time-input-external-description">Choose a time during staffed support hours.</p>
      <lr-time-input
        aria-describedby="time-input-external-description"
        hint="Times are shown in your selected locale."
        label="Appointment time"
        value="09:30"
      ></lr-time-input>
    </div>
  `,
};

/** Locale controls the segment order, separators, digits, and day-period labels. */
export const LocalesAndHourFormats: Story = {
  render: () => html`
    <div style="display: grid; gap: 1rem; max-width: 24rem">
      <lr-time-input label="US, automatic" locale="en-US" value="17:45"></lr-time-input>
      <lr-time-input label="French, automatic" locale="fr-FR" value="17:45"></lr-time-input>
      <lr-time-input label="Arabic, forced 12-hour" locale="ar" hour-format="12" value="17:45"></lr-time-input>
      <lr-time-input label="Japanese, forced 24-hour" locale="ja" hour-format="24" value="17:45"></lr-time-input>
    </div>
  `,
};

/** Focus the day-period segment, then use the pointer to remove it. Preventing the button's
 * pointer-down default keeps the segment's real focus ownership observable during the update. */
export const ControlledSegmentShrink: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem);">
      <button
        type="button"
        @pointerdown=${(event: PointerEvent) => event.preventDefault()}
        @click=${(event: Event) => {
          const input = (event.currentTarget as HTMLElement).parentElement?.querySelector<LyraTimeInput>('lr-time-input');
          if (input) input.hourFormat = '24';
        }}
      >Switch to 24-hour format</button>
      <lr-time-input label="Controlled time" hour-format="12" value="17:45"></lr-time-input>
    </div>
  `,
};

/** A step below 60 seconds adds the seconds segment and picker column. */
export const Seconds: Story = {
  render: () => html`
    <lr-time-input label="Precise start" step="15" value="09:30:15" with-now style="max-width: 20rem"></lr-time-input>
  `,
};

/** The picker derives every column from the complete offset step grid. Focus an option and use
 * ArrowUp/ArrowDown/Home/End; Enter or Space activates the focused native button. */
export const OffsetStepGrid: Story = {
  render: () => html`
    <lr-time-input
      open
      hour-format="24"
      label="Ten-minute grid offset by five"
      hint="Valid minutes are 05, 15, 25, 35, 45, and 55."
      min="00:05"
      step="600"
      value="09:05"
      style="max-width: 20rem"
    ></lr-time-input>
  `,
};

/** Reversed bounds describe a valid range that crosses midnight. */
export const OvernightRange: Story = {
  render: () => html`
    <lr-time-input
      label="Night shift"
      hint="Choose a time from 22:00 through 06:00"
      min="22:00"
      max="06:00"
      step="300"
      value="23:30"
      required
      style="max-width: 20rem"
    ></lr-time-input>
  `,
};

export const InitiallyOpen: Story = {
  render: () => html`
    <lr-time-input label="Appointment time" value="13:15" with-now open style="max-width: 20rem"></lr-time-input>
  `,
};

export const DisabledFocusGuard: Story = {
  name: 'Disabled focus guard',
  render: () => {
    const tryFocus = (event: Event): void => {
      const button = event.currentTarget as HTMLButtonElement;
      const root = button.closest<HTMLElement>('[data-disabled-focus-demo]');
      const fields = root?.querySelectorAll<LyraTimeInput>('lr-time-input');
      const field = fields?.[Number(button.dataset['field'])];
      field?.focus();
      const output = root?.querySelector('output');
      if (output) {
        output.textContent = field?.shadowRoot?.activeElement
          ? 'Unexpected internal focus'
          : 'Disabled focus request was ignored';
      }
    };
    return html`
      <div data-disabled-focus-demo style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem);">
        <lr-time-input disabled label="Directly disabled" value="10:00"></lr-time-input>
        <fieldset disabled>
          <lr-time-input label="Disabled by fieldset" value="11:00"></lr-time-input>
        </fieldset>
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-xs);">
          <button type="button" data-field="0" @click=${tryFocus}>Try direct focus</button>
          <button type="button" data-field="1" @click=${tryFocus}>Try fieldset focus</button>
        </div>
        <output aria-live="polite">Choose a focus request.</output>
      </div>
    `;
  },
};

/** Undersized picker columns retain block scrolling without a phantom inline scrollbar. */
export const CrossAxisContainment: Story = {
  render: () => html`
    <lr-time-input
      label="Appointment time"
      value="13:15"
      open
      style="--column-width: 1rem; max-inline-size: 20rem"
    ></lr-time-input>
  `,
};

/** Picker-bearing rows use the shared hit-floor-aware control ladder at every size. */
export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem)">
      ${['2xs', 'xs', 's', 'm', 'l', 'xl'].map(
        (size) => html`<lr-time-input size=${size} label=${size} value="10:00"></lr-time-input>`,
      )}
    </div>
  `,
};

/** Component geometry hooks inherit through a theme wrapper across size and pill fallbacks. */
export const AncestorGeometryTheme: Story = {
  render: () => html`
    <div
      style="
        --lr-time-input-gap: var(--lr-space-l);
        --lr-time-input-radius: var(--lr-radius-xs);
        --lr-time-input-focus-border-color: var(--lr-color-danger);
        --lr-time-input-column-selected-bg: var(--lr-color-danger);
        --lr-time-input-column-selected-color: var(--lr-color-on-danger);
        --lr-time-input-column-selected-font-weight: var(--lr-font-weight-normal);
      "
    >
      <lr-time-input size="2xs" pill open label="Start time" value="10:00"></lr-time-input>
    </div>
  `,
};

/** Exact 320px RTL allocation with an unbroken label and the open seconds picker. */
export const NarrowRightToLeft: Story = {
  name: 'Narrow RTL (320px)',
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%">
      <lr-time-input
        open
        step="15"
        value="10:00:15"
        label="InternationalizedUnbrokenAppointmentLabelThatMustRemainInsideTheAllocation"
        hint="Supporting copy wraps within the same narrow allocation."
      ></lr-time-input>
    </div>
  `,
};
