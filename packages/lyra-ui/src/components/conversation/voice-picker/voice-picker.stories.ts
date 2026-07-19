import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './voice-picker.js';
import type { LyraVoiceCatalogEntry } from './voice-picker.class.js';

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
