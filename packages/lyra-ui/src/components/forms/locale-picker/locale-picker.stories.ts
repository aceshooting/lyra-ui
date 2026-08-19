import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraLocalePicker } from './locale-picker.js';
import './locale-picker.js';
// lr-locale-picker composes lr-flag, whose country/language resolution is inert until the optional
// peer entry is registered. Without this the docs page rendered flag-less rows and (since 10.1.0)
// logged the missing-resolver warning -- flag.stories.ts already imports it for the same reason.
import '../../media/flag/flag-peer.js';

const meta: Meta = {
  title: 'Locale Picker',
  component: 'lr-locale-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A single-select picker over the library's locale registry: a closed-list dropdown that offers every locale registered via `registerLyraLocale()` (plus `en`) by default, or an explicit `locales` catalog. Selecting a row calls `setLyraLocale()` unless the `lr-change` event is cancelled. Trigger focus/blur relay once each as native FocusEvents.",
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

/** `undefined` selects registry discovery; an explicit empty array is an authoritative empty
 * catalog and never silently falls back to registry rows. */
export const EmptyCatalog: Story = {
  render: () => html`
    <lr-locale-picker label="No locales available" .locales=${[]}></lr-locale-picker>
  `,
};

export const LiveCatalogShrink: Story = {
  name: 'Live catalog shrink',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-20rem);">
      <lr-locale-picker
        open
        label="Language"
        .locales=${['fr', 'de', 'it']}
      ></lr-locale-picker>
      <button
        type="button"
        @click=${(event: Event) => {
          const picker = (event.currentTarget as HTMLElement).parentElement?.querySelector(
            'lr-locale-picker',
          ) as LyraLocalePicker | null;
          if (picker) {
            picker.locales = ['fr'];
            picker.open = true;
          }
        }}
      >
        Replace with one locale
      </button>
    </div>
  `,
};

export const CountryOverride: Story = {
  name: 'Per-row flag override',
  render: () => html`
    <lr-locale-picker
      label="Language"
      .locales=${[
        { tag: 'ar', country: 'lb', label: 'العربية' },
        { tag: 'fr' },
        { tag: 'en' },
      ]}
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

export const Sizes: Story = {
  render: () => {
    const sizes = ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'] as const;
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${sizes.map(
          (size) => html`
            <lr-locale-picker size=${size} label=${`Size "${size}"`} .locales=${['fr', 'de']}></lr-locale-picker>
          `,
        )}
      </div>
    `;
  },
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

/** Ancestor theme values override the active size tier's private fallbacks. */
export const AncestorTheme: Story = {
  render: () => html`
    <div
      style="
        --lr-locale-picker-trigger-padding: var(--lr-space-m);
        --lr-locale-picker-trigger-min-height: var(--lr-size-3rem);
        --lr-locale-picker-font-size: var(--lr-font-size-lg);
        --lr-locale-picker-expand-size: var(--lr-size-1-5rem);
        --lr-locale-picker-gap: var(--lr-space-m);
        --lr-locale-picker-radius: var(--lr-radius);
        --lr-locale-picker-option-selected-font-weight: var(--lr-font-weight-normal);
      "
    >
      <lr-locale-picker size="2xs" open value="fr" label="Language" .locales=${['fr', 'de']}></lr-locale-picker>
    </div>
  `,
};
