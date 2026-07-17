import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './swatch-picker.js';

const accents = () => [
  { value: 'blue', color: '#0969da', label: 'Blue' },
  { value: 'green', color: '#1a7f37', label: 'Green' },
  { value: 'purple', color: '#8250df', label: 'Purple' },
  { value: 'orange', color: '#bc4c00', label: 'Orange' },
  { value: 'red', color: '#cf222e', label: 'Red' },
];

const meta: Meta = {
  title: 'Swatch Picker',
  component: 'lyra-swatch-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single-select picker over a small, fixed set of color swatches with the WAI-ARIA APG `radiogroup` contract built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or arrow-key move both select immediately), cyclic Arrow/Home/End navigation. Distinct from `<lyra-color-picker>`\'s freeform native input -- it picks exactly one of N designer-chosen named colors.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-swatch-picker label="Accent color" .options=${accents()} value="purple"></lyra-swatch-picker>
  `,
};

export const NoSelection: Story = {
  name: 'No selection',
  parameters: {
    docs: {
      description: {
        story:
          'With `value` left `null`, no swatch is checked, but the first swatch stays tabbable so the radiogroup is keyboard-reachable.',
      },
    },
  },
  render: () => html`
    <lyra-swatch-picker label="Accent color" .options=${accents()}></lyra-swatch-picker>
  `,
};

export const Rethemed: Story = {
  name: 'Rethemed selection ring',
  parameters: {
    docs: {
      description: {
        story:
          'The `--lyra-swatch-picker-selected-color` custom property retints the ring drawn around the selected swatch, independently of the focus outline.',
      },
    },
  },
  render: () => html`
    <lyra-swatch-picker
      label="Accent color"
      style="--lyra-swatch-picker-selected-color: #1a7f37;"
      .options=${accents()}
      value="red"
    ></lyra-swatch-picker>
  `,
};

/** Narrow-allocation evidence: a many-swatch row reflowing inside a 320px panel/dialog/split-pane
 *  rather than overflowing it. */
export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lyra-swatch-picker
        label="Accent color"
        .options=${[
          ...accents(),
          { value: 'teal', color: '#0d9488', label: 'Teal' },
          { value: 'pink', color: '#db2777', label: 'Pink' },
          { value: 'slate', color: '#475569', label: 'Slate' },
          { value: 'amber', color: '#b45309', label: 'Amber' },
          { value: 'indigo', color: '#4338ca', label: 'Indigo' },
        ]}
        value="teal"
      ></lyra-swatch-picker>
    </div>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <lyra-swatch-picker
      dir="rtl"
      label="لون التمييز"
      .options=${[
        { value: 'blue', color: '#0969da', label: 'أزرق' },
        { value: 'green', color: '#1a7f37', label: 'أخضر' },
        { value: 'red', color: '#cf222e', label: 'أحمر' },
      ]}
      value="green"
    ></lyra-swatch-picker>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lyra-swatch-picker
        label="Accent color"
        .options=${accents()}
        value="blue"
        @lyra-change=${(e: CustomEvent<{ value: string }>) => {
          const out = document.getElementById('swatch-picker-log');
          if (out) out.textContent = `lyra-change: ${JSON.stringify(e.detail)}`;
        }}
      ></lyra-swatch-picker>
      <p id="swatch-picker-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};
