import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './currency-picker.js';
import '../button/button.js';

const everydayCurrencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR', 'BRL', 'AED', 'SAR', 'LBP'];

const meta: Meta = {
  title: 'Forms & Inputs/Currency Picker',
  component: 'lr-currency-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A currency-code field with localized names and symbols. The compact trigger shows the ISO code. Choose an ordered subset for your application; exchange rates and amount conversion remain application data.',
      },
    },
  },
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-currency-picker label="Currency" value="EUR"></lr-currency-picker>`,
};

export const EverydayCurrencies: StoryObj = {
  render: () => html`<lr-currency-picker label="Display currency" value="EUR"
    hint="Choose the currency used for prices." .currencies=${everydayCurrencies}></lr-currency-picker>`,
};

export const CompactToolbar: StoryObj = {
  render: () => html`<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--lr-space-m);max-inline-size:var(--lr-size-20rem)">
    <span>Catalogue prices</span>
    <lr-currency-picker aria-label="Display currency" value="EUR" size="s" top-layer
      style="inline-size:var(--lr-size-8rem)" .currencies=${everydayCurrencies}></lr-currency-picker>
  </div>`,
};

export const RequiredForm: StoryObj = {
  render: () => html`<form style="display:grid;gap:var(--lr-space-m);max-inline-size:var(--lr-size-20rem)"
    @submit=${(event: SubmitEvent) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const output = form.querySelector('output');
      if (output) output.value = String(new FormData(form).get('currency') ?? '');
    }}>
    <lr-currency-picker name="currency" label="Currency" required clearable
      .currencies=${everydayCurrencies}></lr-currency-picker>
    <div style="display:flex;gap:var(--lr-space-s)">
      <lr-button type="submit">Submit</lr-button>
      <lr-button type="reset" appearance="outlined">Reset</lr-button>
    </div>
    <output aria-label="Submitted currency"></output>
  </form>`,
};

export const CustomLabels: StoryObj = {
  render: () => html`<lr-currency-picker label="Settlement currency" value="EUR" .currencies=${[
    { code: 'EUR', label: 'Euro account', symbol: '€' },
    { code: 'USD', label: 'US dollar account', symbol: 'US$' },
    { code: 'GBP', label: 'Pound sterling account unavailable', disabled: true },
  ]}></lr-currency-picker>`,
};

export const UnavailableSelection: StoryObj = {
  render: () => html`<lr-currency-picker label="Currency" value="GBP" clearable
    hint="The saved currency is no longer supported. Choose another or clear it."
    .currencies=${['EUR', 'USD']}></lr-currency-picker>`,
};

export const EmptyCatalog: StoryObj = {
  render: () => html`<lr-currency-picker label="Currency" hint="No currencies are available."
    .currencies=${[]}></lr-currency-picker>`,
};

export const RightToLeft: StoryObj = {
  render: () => html`<div dir="rtl" style="max-inline-size:var(--lr-size-20rem)">
    <lr-currency-picker locale="ar" label="العملة" value="AED"
      .currencies=${['AED', 'SAR', 'EUR', 'USD']}></lr-currency-picker>
  </div>`,
};
