import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './voice-picker.js';
import type { LyraVoiceCatalogEntry, LyraVoicePicker } from './voice-picker.class.js';

const meta: Meta = {
  title: 'Voice Picker',
  component: 'lr-voice-picker',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const catalog: LyraVoiceCatalogEntry[] = [
  {
    id: 'aria',
    label: 'Aria',
    language: 'en-US',
    description: 'Warm, narrative',
    previewUrl: 'https://example.com/aria.mp3',
  },
  { id: 'sage', label: 'Sage', language: 'en-GB', description: 'Calm, measured' },
  {
    id: 'nova',
    label: 'Nova',
    language: 'fr-FR',
    description: 'Bright, energetic',
    previewUrl: 'https://example.com/nova.mp3',
  },
];
const narrowUnbrokenVoiceText = 'VoiceIdentifierWithoutNaturalBreaks'.repeat(8);
const narrowRtlCatalog: LyraVoiceCatalogEntry[] = [
  {
    id: narrowUnbrokenVoiceText,
    label: narrowUnbrokenVoiceText,
    language: narrowUnbrokenVoiceText,
    description: narrowUnbrokenVoiceText,
  },
];

/** A fixed catalog with `allow-custom` unset renders a plain closed dropdown, plus a standalone
 *  preview toggle beside the trigger for voices that carry a `previewUrl`. */
export const Default: Story = {
  render: () => html`<lr-voice-picker provider="elevenlabs" label="Voice" .catalog=${catalog}></lr-voice-picker>`,
};

/** `allow-custom` keeps the catalog's suggestions but switches to the free-text combobox shape so a
 *  voice id outside the list can still be typed and committed. */
export const AllowCustom: Story = {
  render: () => html`
    <lr-voice-picker provider="elevenlabs" label="Voice" .catalog=${catalog} allow-custom></lr-voice-picker>
  `,
};

/** Free-text mode exposes the native selection facade while keeping the committed voice id in sync. */
export const SelectionEditingFacade: Story = {
  render: () => {
    const pickerFor = (event: Event) =>
      (event.currentTarget as HTMLElement).closest('[data-selection-demo]')?.querySelector<LyraVoicePicker>('lr-voice-picker');
    return html`
      <div data-selection-demo style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-24rem)">
        <lr-voice-picker name="voice" value="aria" allow-custom .catalog=${catalog}></lr-voice-picker>
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-xs)">
          <button type="button" @click=${(event: Event) => pickerFor(event)?.select()}>Select text</button>
          <button
            type="button"
            @click=${(event: Event) => {
              const picker = pickerFor(event);
              if (!picker?.input) return;
              picker.setRangeText('custom-voice', 0, picker.input.value.length, 'select');
            }}
          >Replace selection</button>
        </div>
      </div>
    `;
  },
};

/** No `catalog` at all falls back to plain free-text entry — any typed voice id commits on Enter. */
export const FreeTextNoCatalog: Story = {
  render: () => html`<lr-voice-picker label="Voice" placeholder="Type a voice id…"></lr-voice-picker>`,
};

/** Custom label markup occupies the same native label and standard form-control frame in either
 *  picker mode; the property remains available for plain text. */
export const SlottedLabel: Story = {
  render: () => html`
    <lr-voice-picker .catalog=${catalog}>
      <span slot="label">Narration <small>(required for spoken replies)</small></span>
    </lr-voice-picker>
  `,
};

/** `preview="false"` (via a property binding) omits both the standalone preview toggle and the
 *  per-row preview icons entirely. */
export const NoPreview: Story = {
  render: () => html`<lr-voice-picker label="Voice" .catalog=${catalog} .preview=${false}></lr-voice-picker>`,
};

/** All six shared size tiers. Compact fields retain a 40px preview-action hit area; large tiers
 *  grow that action with the field. */
export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); max-inline-size: var(--lr-size-24rem);">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`
          <lr-voice-picker
            size=${size}
            label=${`Voice (${size})`}
            value="aria"
            .catalog=${catalog}
          ></lr-voice-picker>
        `
      )}
    </div>
  `,
};

/** Exact 320px RTL allocation with long unbroken caller content in both the catalog dropdown and
 * free-text combobox modes. */
export const Narrow320: Story = {
  name: 'Narrow RTL (320px, both modes)',
  render: () => html`
    <div
      dir="rtl"
      style="display:grid;gap:var(--lr-space-s);inline-size:320px;max-inline-size:100%;outline:1px dashed var(--lr-color-border);"
    >
      <lr-voice-picker
        provider=${narrowUnbrokenVoiceText}
        label=${narrowUnbrokenVoiceText}
        hint=${narrowUnbrokenVoiceText}
        error-text=${narrowUnbrokenVoiceText}
        value=${narrowUnbrokenVoiceText}
        .catalog=${narrowRtlCatalog}
      ></lr-voice-picker>
      <lr-voice-picker
        allow-custom
        provider=${narrowUnbrokenVoiceText}
        label=${narrowUnbrokenVoiceText}
        hint=${narrowUnbrokenVoiceText}
        error-text=${narrowUnbrokenVoiceText}
        value=${narrowUnbrokenVoiceText}
        .catalog=${narrowRtlCatalog}
      ></lr-voice-picker>
    </div>
  `,
};

/** Component-scoped state hooks inherit from the wrapper and independently retheme the open
 *  trigger plus the synthetic stale-value row. */
export const ThemeableStateHooks: Story = {
  render: () => html`
    <div
      style="
        display: grid;
        max-inline-size: var(--lr-size-24rem);
        --lr-voice-picker-open-border-color: var(--lr-color-success);
        --lr-voice-picker-option-synthetic-border-style: dotted;
        --lr-voice-picker-option-synthetic-border-color: var(--lr-color-warning);
        --lr-voice-picker-option-synthetic-font-style: normal;
      "
    >
      <lr-voice-picker
        provider="elevenlabs"
        value="retired-voice"
        .catalog=${catalog}
        .open=${true}
      ></lr-voice-picker>
    </div>
  `,
};

export const FormLifecycle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`defaultValue` supplies the reset voice while live `value` remains dirty. The buttons also demonstrate `customError`, `getForm()`, and `lr-invalid`.',
      },
    },
  },
  render: () => {
    const pickerFor = (event: Event) =>
      (event.currentTarget as HTMLElement)
        .closest('form')
        ?.querySelector('lr-voice-picker') as LyraVoicePicker | null;
    const outputFor = (event: Event) =>
      (event.currentTarget as HTMLElement).closest('form')?.querySelector('output');
    const choose = (event: Event) => {
      const picker = pickerFor(event);
      const output = outputFor(event);
      if (!picker || !output) return;
      picker.value = 'nova';
      output.textContent = `Live value: ${picker.value}; reset default: ${picker.defaultValue}`;
    };
    const reject = (event: Event) => {
      const picker = pickerFor(event);
      if (!picker) return;
      picker.customError = 'This voice is unavailable for the current account.';
      picker.reportValidity();
    };
    const clear = (event: Event) => {
      const picker = pickerFor(event);
      const output = outputFor(event);
      if (!picker || !output) return;
      picker.customError = null;
      output.textContent = `Owner resolved: ${picker.getForm() === picker.closest('form')}`;
    };
    const reset = (event: Event) => {
      const picker = pickerFor(event);
      const output = outputFor(event);
      picker?.closest('form')?.reset();
      if (picker && output) output.textContent = `Reset value: ${picker.value}`;
    };
    const reportInvalid = (event: Event) => {
      const output = (event.currentTarget as HTMLElement).closest('form')?.querySelector('output');
      if (output) output.textContent = 'lr-invalid: voice selection rejected.';
    };

    return html`
      <form style="display:grid;gap:0.75rem;max-width:24rem" @submit=${(event: Event) => event.preventDefault()}>
        <lr-voice-picker
          name="voice"
          label="Voice"
          required
          .defaultValue=${'aria'}
          .catalog=${catalog}
          @lr-invalid=${reportInvalid}
        ></lr-voice-picker>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
          <button type="button" @click=${choose}>Choose Nova in code</button>
          <button type="button" @click=${reset}>Reset</button>
          <button type="button" @click=${reject}>Set server error</button>
          <button type="button" @click=${clear}>Clear error</button>
        </div>
        <output aria-live="polite"></output>
      </form>
    `;
  },
};
