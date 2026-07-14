import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { PhoneNumberAdapter } from './phone-input.class.js';

const demoAdapter: PhoneNumberAdapter = {
  countries: [
    { code: 'LU', callingCode: '352' },
    { code: 'FR', callingCode: '33' },
    { code: 'DE', callingCode: '49' },
    { code: 'BE', callingCode: '32' },
  ],
  parse(input, country) {
    const raw = input.trim();
    if (!raw) return { status: 'empty' };
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 6) return { status: 'incomplete', formatted: raw };
    const callingCode = this.countries?.find((row) => row.code === country)?.callingCode;
    if (!callingCode) return { status: 'invalid', formatted: raw };
    const national = digits.replace(new RegExp(`^${callingCode}`), '').replace(/^0/, '');
    return {
      status: 'valid',
      country,
      e164: `+${callingCode}${national}`,
      formatted: national.replace(/(\d{3})(?=\d)/g, '$1 '),
    };
  },
};

const meta: Meta = {
  title: 'Forms/PhoneInput',
  component: 'lyra-phone-input',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-phone-input
      label="Mobile number"
      hint="Used only for account security"
      placeholder="621 123 456"
      default-country="LU"
      .adapter=${demoAdapter}
      style="max-width: 24rem"
    ></lyra-phone-input>
  `,
};

export const Required: Story = {
  render: () => html`
    <lyra-phone-input
      label="Contact number"
      required
      default-country="FR"
      .adapter=${demoAdapter}
      style="max-width: 24rem"
    ></lyra-phone-input>
  `,
};

export const OptionalCountryAdornment: Story = {
  render: () => html`
    <lyra-phone-input
      label="Mobile number"
      default-country="LU"
      .adapter=${demoAdapter}
      style="max-width: 24rem"
    >
      <span slot="country-prefix" aria-hidden="true">🌍</span>
    </lyra-phone-input>
  `,
};

export const E164WithoutMetadata: Story = {
  render: () => html`
    <lyra-phone-input
      label="International number"
      hint="Already-international E.164 input works without a numbering-plan adapter."
      value="+352621123456"
      style="max-width: 24rem"
    ></lyra-phone-input>
  `,
};

export const Narrow: Story = {
  render: () => html`
    <div style="inline-size: 20rem; max-inline-size: 100%">
      <lyra-phone-input
        label="A deliberately long translated telephone-field label"
        hint="Long supporting text wraps within the component's own narrow allocation."
        default-country="DE"
        .adapter=${demoAdapter}
      ></lyra-phone-input>
    </div>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl" lang="ar" style="max-width: 24rem">
      <lyra-phone-input
        label="رقم الهاتف"
        country-label="البلد"
        default-country="LU"
        .adapter=${demoAdapter}
      ></lyra-phone-input>
    </div>
  `,
};
