import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './otp-input.js';
import type { LyraOtpInput } from './otp-input.class.js';

const meta: Meta = { title: 'Forms/OTP input', component: 'lr-otp-input', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<lr-otp-input label="Verification code" hint="Check your email for a 6-digit code."></lr-otp-input>`,
};

export const Length: StoryObj = {
  render: () => html`
    <lr-otp-input label="Card PIN" length="4"></lr-otp-input>
    <lr-otp-input label="Backup code" length="8"></lr-otp-input>
  `,
};

export const Format: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Format parsing reads at most 4,096 UTF-16 code units, coalesces literal runs, and retains at most 32 `#` segments. Value normalization uses the same source ceiling and stops earlier once every effective segment is full.',
      },
    },
  },
  render: () => html`
    <lr-otp-input label="Invite code" type="alphanumeric" case="upper" format="### ###"></lr-otp-input>
    <lr-otp-input label="License key" type="alphanumeric" case="upper" format="####-####-####"></lr-otp-input>
  `,
};

export const Masked: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      <lr-otp-input label="Entered characters masked" length="4" mask></lr-otp-input>
      <lr-otp-input label="Empty placeholders only" length="4" with-mask></lr-otp-input>
      <lr-otp-input label="Filled and empty segments masked" length="4" mask with-mask></lr-otp-input>
    </div>
  `,
};

export const AppearancesAndSizes: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      <lr-otp-input label="Outlined, extra small" appearance="outlined" size="xs" length="4"></lr-otp-input>
      <lr-otp-input label="Filled, small" appearance="filled" size="s" length="4"></lr-otp-input>
      <lr-otp-input label="Filled outlined, large" appearance="filled-outlined" size="l" length="4"></lr-otp-input>
      <lr-otp-input label="Contained, extra large" appearance="contained" size="xl" length="4"></lr-otp-input>
    </div>
  `,
};

export const CustomSegments: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          "Mapped `--segment-*` properties control geometry; the retained `--lr-otp-input-segment-*` hooks independently retune each cell's fill, border color, and radius.",
      },
    },
  },
  render: () => html`
    <lr-otp-input
      label="Access code"
      format="###-###"
      type="alphanumeric"
      case="upper"
      style="
        --segment-size: var(--lr-size-3rem);
        --segment-gap: var(--lr-space-s);
        --mask-char: '×';
        --lr-otp-input-segment-fill: var(--lr-color-brand-fill-quiet);
        --lr-otp-input-segment-border-color: var(--lr-color-brand-fill-loud);
        --lr-otp-input-segment-radius: var(--lr-radius-pill);
      "
      mask
      with-mask
    ></lr-otp-input>
  `,
};

export const AutoSubmitAndClear: StoryObj = {
  render: () => html`
    <form style="display: grid; gap: var(--lr-space-s);" @submit=${(event: SubmitEvent) => event.preventDefault()}>
      <lr-otp-input
        name="code"
        label="Auto-submitting code"
        hint="Entering the fourth character requests form submission."
        length="4"
        autosubmit
      ></lr-otp-input>
      <button
        type="button"
        @click=${(event: Event) =>
          (event.currentTarget as HTMLButtonElement).form?.querySelector('lr-otp-input')?.clear()}
      >
        Clear and focus
      </button>
    </form>
  `,
};

export const ReplacedCompletionCancelsAutoSubmit: StoryObj = {
  name: 'Replaced completion cancels auto-submit',
  render: () => html`
    <form
      style="display: grid; gap: var(--lr-space-s);"
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const output = (event.currentTarget as HTMLFormElement).querySelector('output');
        if (output) output.textContent = 'Unexpected stale submission';
      }}
    >
      <lr-otp-input
        name="code"
        label="Replacement-safe code"
        hint="Entering 123 replaces it with 456 and retires the queued submit for 123."
        length="3"
        autosubmit
        @lr-complete=${(event: CustomEvent<{ value: string }>) => {
          const field = event.currentTarget as LyraOtpInput;
          field.value = event.detail.value === '123' ? '456' : event.detail.value;
          const output = field.parentElement?.querySelector('output');
          if (output) output.textContent = `Live code is now ${field.value}; no stale submit ran.`;
        }}
      ></lr-otp-input>
      <output aria-live="polite">Enter 123 to replace the completed code.</output>
    </form>
  `,
};

/**
 * The host selection facade edits the compact code without reaching into the shadow root. Range
 * replacements stay sanitized and synchronize the form value without emitting user-input events.
 */
export const SelectionEditingFacade: StoryObj = {
  render: () => {
    const fieldFor = (event: Event) =>
      (event.currentTarget as HTMLElement)
        .closest('[data-selection-demo]')
        ?.querySelector<LyraOtpInput>('lr-otp-input');
    return html`
      <div data-selection-demo style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem);">
        <lr-otp-input
          name="code"
          label="Editable compact code"
          hint="The replacement is uppercased and the dash is discarded by the field sanitizer."
          length="4"
          type="alphanumeric"
          case="upper"
          value="12AB"
        ></lr-otp-input>
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-xs);">
          <button type="button" @click=${(event: Event) => fieldFor(event)?.select()}>Select code</button>
          <button type="button" @click=${(event: Event) => fieldFor(event)?.setRangeText('z-', 1, 3, 'select')}>
            Replace middle range
          </button>
        </div>
      </div>
    `;
  },
};

export const Required: StoryObj = {
  render: () => html`
    <form @submit=${(e: Event) => e.preventDefault()}>
      <lr-otp-input
        name="code"
        label="Verification code"
        required
        error-text="Enter the code we sent you."
      ></lr-otp-input>
      <button type="submit">Verify</button>
    </form>
  `,
};

export const RightToLeft: StoryObj = {
  name: 'RTL',
  render: () =>
    html`<div dir="rtl"><lr-otp-input label="رمز التحقق" hint="تحقق من بريدك الإلكتروني."></lr-otp-input></div>`,
};

/** Ancestor theme values override appearance fallbacks without an inline host override. */
export const AncestorTheme: StoryObj = {
  render: () => html`
    <div
      style="
        --lr-otp-input-segment-fill: var(--lr-color-brand-quiet);
        --lr-otp-input-segment-border-color: var(--lr-color-brand);
        --lr-otp-input-segment-radius: var(--lr-radius);
        --lr-otp-input-active-border-color: var(--lr-color-danger);
        --lr-otp-input-active-ring-color: var(--lr-color-danger);
        --lr-otp-input-invalid-border-color: var(--lr-color-warning);
      "
    >
      <lr-otp-input appearance="filled-outlined" autofocus label="Verification code"></lr-otp-input>
    </div>
  `,
};

/** Exact 320px RTL allocation with long copy and a horizontally reachable fixed-cell row. */
export const NarrowRightToLeft: StoryObj = {
  name: 'Narrow RTL (320px)',
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%">
      <lr-otp-input
        length="8"
        label="InternationalizedUnbrokenVerificationCodeLabelThatMustRemainInsideItsAllocation"
        hint="Supporting copy wraps while every fixed cell remains horizontally reachable."
      ></lr-otp-input>
    </div>
  `,
};

export const ExternalDescription: StoryObj = {
  parameters: { docs: { description: { story: 'External guidance is resolved onto the value control before its local hint; changing the referenced content keeps the relationship current.' } } },
  render: () => html`
    <div>
      <p id="lr-otp-input-external-guidance">Use the details associated with your account.</p>
      <lr-otp-input label="Verification code" hint="Enter all six digits" aria-describedby="lr-otp-input-external-guidance"></lr-otp-input>
    </div>
  `,
};
