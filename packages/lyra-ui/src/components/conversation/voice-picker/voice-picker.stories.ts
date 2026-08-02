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

/** No `catalog` at all falls back to plain free-text entry — any typed voice id commits on Enter. */
export const FreeTextNoCatalog: Story = {
  render: () => html`<lr-voice-picker label="Voice" placeholder="Type a voice id…"></lr-voice-picker>`,
};

/** `preview="false"` (via a property binding) omits both the standalone preview toggle and the
 *  per-row preview icons entirely. */
export const NoPreview: Story = {
  render: () => html`<lr-voice-picker label="Voice" .catalog=${catalog} .preview=${false}></lr-voice-picker>`,
};

/** A narrow 320px allocation — the control row still fits the trigger/combobox and the preview
 *  toggle without overflowing. */
export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; border: 1px dashed var(--lr-color-border); padding: 8px;">
      <lr-voice-picker label="Voice" .catalog=${catalog}></lr-voice-picker>
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
