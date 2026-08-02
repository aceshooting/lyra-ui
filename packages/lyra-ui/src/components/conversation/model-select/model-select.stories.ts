import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './model-select.js';
import type { LyraModelSelect } from './model-select.js';

const meta: Meta = {
  title: 'ModelSelect',
  component: 'lr-model-select',
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

/** A fixed catalog with `allow-custom` unset renders a plain closed dropdown, like `<lr-select>`. */
export const ClosedDropdown: Story = {
  render: () => html`
    <lr-model-select
      provider="ollama"
      placeholder="Pick a model…"
      .catalog=${OLLAMA_CATALOG}
    ></lr-model-select>
  `,
};

/** Object-shaped catalog rows carry a separate id/label pair (e.g. an API model id vs. its display name). */
export const ObjectCatalog: Story = {
  render: () => html`
    <lr-model-select
      provider="openai"
      placeholder="Pick a model…"
      .catalog=${OPENAI_CATALOG}
    ></lr-model-select>
  `,
};

/** No `catalog` at all falls back to plain free-text entry — any typed value commits on Enter. */
export const FreeTextNoCatalog: Story = {
  render: () => html`<lr-model-select provider="custom" placeholder="Type any model id…"></lr-model-select>`,
};

/**
 * `allow-custom` keeps the catalog's suggestions but switches the control to
 * the text-input shape so a value outside the list can still be typed and committed.
 */
export const AllowCustomWithCatalog: Story = {
  render: () => html`
    <lr-model-select
      provider="ollama"
      allow-custom
      placeholder="Pick a model or type your own…"
      .catalog=${OLLAMA_CATALOG}
    ></lr-model-select>
  `,
};

/**
 * `value` set to something absent from the current `catalog` (e.g. restored
 * from a saved conversation whose provider catalog has since changed) still
 * renders — as a dashed, italic "not in catalog" row appended to the list —
 * instead of silently vanishing.
 */
export const StaleValue: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      <lr-model-select
        provider="ollama"
        placeholder="Pick a model…"
        value="llama2-uncensored"
        .catalog=${OLLAMA_CATALOG}
      ></lr-model-select>
      <lr-model-select
        provider="ollama"
        allow-custom
        placeholder="Pick a model or type your own…"
        value="llama2-uncensored"
        .catalog=${OLLAMA_CATALOG}
      ></lr-model-select>
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-model-select disabled placeholder="Can't touch this" .catalog=${OLLAMA_CATALOG}></lr-model-select>
  `,
};

/** `required` blocks a containing form from submitting while empty. */
export const RequiredInForm: Story = {
  render: () => html`
    <form style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      <lr-model-select name="model" required .catalog=${OLLAMA_CATALOG} placeholder="Pick a model…">
      </lr-model-select>
      <button type="submit">Submit</button>
    </form>
  `,
};

export const FormLifecycle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`defaultValue` supplies the reset value while live `value` stays dirty. The buttons also demonstrate `customError`, `getForm()`, and `lr-invalid`.',
      },
    },
  },
  render: () => {
    const pickerFor = (event: Event) =>
      (event.currentTarget as HTMLElement)
        .closest('form')
        ?.querySelector('lr-model-select') as LyraModelSelect | null;
    const outputFor = (event: Event) =>
      (event.currentTarget as HTMLElement).closest('form')?.querySelector('output');
    const choose = (event: Event) => {
      const picker = pickerFor(event);
      const output = outputFor(event);
      if (!picker || !output) return;
      picker.value = 'o3';
      output.textContent = `Live value: ${picker.value}; reset default: ${picker.defaultValue}`;
    };
    const reject = (event: Event) => {
      const picker = pickerFor(event);
      if (!picker) return;
      picker.customError = 'This model is unavailable for the current account.';
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
      if (output) output.textContent = 'lr-invalid: model selection rejected.';
    };

    return html`
      <form style="display:grid;gap:0.75rem;max-width:24rem" @submit=${(event: Event) => event.preventDefault()}>
        <lr-model-select
          name="model"
          required
          .defaultValue=${'gpt-4.1'}
          .catalog=${OPENAI_CATALOG}
          @lr-invalid=${reportInvalid}
        ></lr-model-select>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
          <button type="button" @click=${choose}>Choose o3 in code</button>
          <button type="button" @click=${reset}>Reset</button>
          <button type="button" @click=${reject}>Set server error</button>
          <button type="button" @click=${clear}>Clear error</button>
        </div>
        <output aria-live="polite"></output>
      </form>
    `;
  },
};
