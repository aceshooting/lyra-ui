import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './model-settings-panel.js';

const meta: Meta = {
  title: 'ModelSettingsPanel',
  component: 'lyra-model-settings-panel',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const OLLAMA_CATALOG = ['llama3.1', 'llama3.1:70b', 'mistral', 'qwen2.5-coder'];

const OPENAI_CATALOG = [
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'o3', label: 'o3' },
];

export const Vertical: Story = {
  render: () => html`
    <lyra-model-settings-panel
      provider="ollama"
      model-value="mistral"
      .catalog=${OLLAMA_CATALOG}
      temperature="0.7"
    ></lyra-model-settings-panel>
  `,
};

export const Compact: Story = {
  render: () => html`
    <lyra-model-settings-panel
      layout="compact"
      provider="openai"
      model-value="gpt-4.1"
      .catalog=${OPENAI_CATALOG}
      temperature="1"
    ></lyra-model-settings-panel>
  `,
};

/** Narrow-allocation evidence for the compact toolbar layout: the model/temperature rows
 *  (`flex: 1 1 12rem; min-inline-size: 10rem` each) must wrap onto separate lines rather
 *  than clipping or overflowing once the panel is placed in a 320px sidebar/toolbar. */
export const CompactNarrow: Story = {
  name: 'Compact, narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lyra-model-settings-panel
        layout="compact"
        provider="openai"
        model-value="gpt-4.1"
        .catalog=${OPENAI_CATALOG}
        temperature="1"
      ></lyra-model-settings-panel>
    </div>
  `,
};

/** `allow-custom` keeps the catalog's suggestions but still lets a value outside it be typed and committed. */
export const AllowCustomModel: Story = {
  render: () => html`
    <lyra-model-settings-panel
      provider="ollama"
      allow-custom
      .catalog=${OLLAMA_CATALOG}
      temperature="0.4"
    ></lyra-model-settings-panel>
  `,
};

/** A `model-value` absent from the current `catalog` still renders, as `lyra-model-select`'s own stale-value row. */
export const StaleModelValue: Story = {
  render: () => html`
    <lyra-model-settings-panel
      provider="ollama"
      model-value="llama2-uncensored"
      .catalog=${OLLAMA_CATALOG}
      temperature="0.9"
    ></lyra-model-settings-panel>
  `,
};

export const WideTemperatureRange: Story = {
  render: () => html`
    <lyra-model-settings-panel
      provider="anthropic"
      model-value="claude"
      temperature="0.5"
      temperature-min="0"
      temperature-max="1"
      temperature-step="0.05"
    ></lyra-model-settings-panel>
  `,
};

export const ListensForConsolidatedChange: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <lyra-model-settings-panel
        provider="ollama"
        model-value="mistral"
        .catalog=${OLLAMA_CATALOG}
        temperature="0.7"
        @lyra-change=${(e: CustomEvent) => {
          const out = document.getElementById('model-settings-panel-log');
          if (out) out.textContent = JSON.stringify(e.detail, null, 2);
        }}
      ></lyra-model-settings-panel>
      <pre id="model-settings-panel-log" style="font-size: 0.75rem;">(change the model or temperature above)</pre>
    </div>
  `,
};
