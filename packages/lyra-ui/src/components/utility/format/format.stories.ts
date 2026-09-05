import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './format-number.js';
import './format-date.js';
import './format-bytes.js';
import './relative-time.js';
const meta: Meta = { title: 'Utilities/Formatting guides', tags: ['autodocs'] };
export default meta;
export const Examples: StoryObj = { render: () => html`<div style="display:grid;gap:0.5rem"><lr-format-number value="12345.67"></lr-format-number><lr-format-date date="2024-01-01"></lr-format-date><lr-format-bytes value="1048576"></lr-format-bytes><lr-relative-time date="2030-01-01"></lr-relative-time></div>` };


export const CurrencyRemoval: StoryObj = {
  render: () => html`
    <div>
      <lr-format-number type="currency" value="12.5" currency="EUR"></lr-format-number>
      <button @click=${(event: Event) => (event.currentTarget as HTMLElement).parentElement!
        .querySelector('lr-format-number')!.removeAttribute('currency')}>Remove currency (USD fallback)</button>
    </div>
  `,
};
