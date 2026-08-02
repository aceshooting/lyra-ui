import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './otp-input.js';

const meta: Meta = { title: 'Forms/OTP input', component: 'lr-otp-input', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-otp-input label="Verification code" hint="Check your email for a 6-digit code."></lr-otp-input>`,
};

export const Length: StoryObj = {
  render: () => html`
    <lr-otp-input label="Card PIN" length="4"></lr-otp-input>
    <lr-otp-input label="Backup code" length="8"></lr-otp-input>
  `,
};

export const Format: StoryObj = {
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
          'Mapped `--segment-*` properties control geometry; the retained `--lr-otp-input-segment-*` hooks independently retune each cell\'s fill, border color, and radius.',
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
    <form
      style="display: grid; gap: var(--lr-space-s);"
      @submit=${(event: SubmitEvent) => event.preventDefault()}
    >
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

export const Required: StoryObj = {
  render: () => html`
    <form @submit=${(e: Event) => e.preventDefault()}>
      <lr-otp-input name="code" label="Verification code" required error-text="Enter the code we sent you."></lr-otp-input>
      <button type="submit">Verify</button>
    </form>
  `,
};

export const RightToLeft: StoryObj = {
  name: 'RTL',
  render: () => html`<div dir="rtl"><lr-otp-input label="رمز التحقق" hint="تحقق من بريدك الإلكتروني."></lr-otp-input></div>`,
};
