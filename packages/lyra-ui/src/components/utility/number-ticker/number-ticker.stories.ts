import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-number-ticker.js';

const meta: Meta = {
  title: 'Utility/Number ticker',
  component: 'lr-number-ticker',
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-number-ticker value="12840" style="font-size: 2rem"></lr-number-ticker>`,
};

export const Currency: StoryObj = {
  render: () => html`<lr-number-ticker type="currency" currency="EUR" value="98765.43" duration="2500" style="font-size: 2rem"></lr-number-ticker>`,
};

export const Percent: StoryObj = {
  render: () => html`<lr-number-ticker type="percent" value="0.874" maximum-fraction-digits="1" eager></lr-number-ticker>`,
};

export const Restart: StoryObj = {
  render: () => html`
    <lr-number-ticker id="ticker" value="500" eager></lr-number-ticker>
    <button @click=${() => (document.getElementById('ticker') as unknown as { restart(): void }).restart()}>Restart</button>
  `,
};

export const Rtl: StoryObj = {
  render: () => html`<div dir="rtl"><lr-number-ticker lang="ar" value="12840" eager></lr-number-ticker></div>`,
};
