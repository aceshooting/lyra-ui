import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './eval-dataset.js';
import type { EvalExample } from './eval-dataset.class.js';

const meta: Meta = {
  title: 'EvalDataset',
  component: 'lr-eval-dataset',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Dataset management for an evaluation suite: a filterable/taggable list of eval examples, plus add/remove/import/export affordances. Fully controlled -- every action fires a request event and the host performs the actual mutation.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const examples: EvalExample[] = [
  { id: '1', input: 'What is the capital of France?', expectedOutput: 'Paris', tags: ['geography', 'easy'] },
  {
    id: '2',
    input: 'Summarize the quarterly earnings report in two sentences.',
    expectedOutput: 'Revenue grew 12% year over year, driven by strong demand in the enterprise segment.',
    tags: ['summarization'],
  },
  {
    id: '3',
    input: 'Translate "good morning" to Spanish.',
    expectedOutput: 'Buenos días',
    tags: ['translation', 'easy'],
  },
  {
    id: '4',
    input: 'Is the following claim supported by the source document: "The bridge was built in 1932"?',
    expectedOutput: 'Yes',
    tags: ['grounding', 'hard'],
  },
];

const logEvent = (name: string) => (e: Event) => console.log(name, (e as CustomEvent).detail);

export const Default: Story = {
  render: () => html`
    <div style="inline-size: 40rem; max-inline-size: 100%;">
      <lr-eval-dataset
        searchable
        .examples=${examples}
        @lr-example-select=${logEvent('lr-example-select')}
        @lr-example-add-request=${logEvent('lr-example-add-request')}
        @lr-example-remove-request=${logEvent('lr-example-remove-request')}
        @lr-import-request=${logEvent('lr-import-request')}
        @lr-export-request=${logEvent('lr-export-request')}
      ></lr-eval-dataset>
    </div>
  `,
};

export const Empty: Story = {
  render: () => html`
    <div style="inline-size: 40rem; max-inline-size: 100%;">
      <lr-eval-dataset searchable .examples=${[]}></lr-eval-dataset>
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <div style="inline-size: 40rem; max-inline-size: 100%;">
      <lr-eval-dataset disabled searchable .examples=${examples}></lr-eval-dataset>
    </div>
  `,
};

export const SingleExportFormat: Story = {
  render: () => html`
    <div style="inline-size: 40rem; max-inline-size: 100%;">
      <lr-eval-dataset .examples=${examples} .exportFormats=${['csv']}></lr-eval-dataset>
    </div>
  `,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; border: 1px dashed var(--lr-color-border); padding: 0.5rem;">
      <lr-eval-dataset searchable .examples=${examples}></lr-eval-dataset>
    </div>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="inline-size: 40rem; max-inline-size: 100%;">
      <lr-eval-dataset searchable .examples=${examples}></lr-eval-dataset>
    </div>
  `,
};
