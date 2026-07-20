import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './locale-picker.js';

const meta: Meta = {
  title: 'Locale Picker',
  component: 'lr-locale-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A single-select picker over the library's locale registry: a closed-list dropdown that offers every locale registered via `registerLyraLocale()` (plus `en`) by default, or an explicit `locales` catalog. Selecting a row calls `setLyraLocale()` unless the `lr-change` event is cancelled.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-locale-picker label="Language"></lr-locale-picker>`,
};

export const CustomCatalog: Story = {
  name: 'Custom catalog with labels',
  render: () => html`
    <lr-locale-picker
      label="Language"
      .locales=${[{ tag: 'fr' }, { tag: 'de' }, { tag: 'es', label: 'Español (coming soon)' }]}
    ></lr-locale-picker>
  `,
};

export const NoFlags: Story = {
  name: 'Flags off',
  render: () => html`
    <lr-locale-picker label="Language" .showFlags=${false} .locales=${['fr', 'de', 'ja']}></lr-locale-picker>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-locale-picker disabled label="Language" .locales=${['fr', 'de']}></lr-locale-picker>`,
};

export const RequiredInForm: Story = {
  render: () => html`
    <form style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      <lr-locale-picker name="locale" required label="Language" .locales=${['fr', 'de']}></lr-locale-picker>
      <button type="submit">Submit</button>
    </form>
  `,
};

/** Narrow-allocation evidence: rows reflow inside a 320px panel/dialog/split-pane rather than
 *  overflowing it. */
export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-locale-picker label="Language" .locales=${['fr', 'de', 'ja', 'es', 'pt-BR']}></lr-locale-picker>
    </div>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`<lr-locale-picker dir="rtl" label="اللغة" .locales=${['ar', 'fr', 'en']}></lr-locale-picker>`,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lr-locale-picker
        label="Language"
        .locales=${['fr', 'de']}
        @lr-change=${(e: CustomEvent<{ value: string; previousValue: string }>) => {
          const out = document.getElementById('locale-picker-log');
          if (out) out.textContent = `lr-change: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-locale-picker>
      <p id="locale-picker-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};
