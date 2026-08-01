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
  render: () => html`<lr-otp-input label="PIN" length="4" mask with-mask></lr-otp-input>`,
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
