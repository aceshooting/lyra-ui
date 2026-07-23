import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './prompt-input.js';

const meta: Meta = {
  title: 'Prompt Input',
  component: 'lr-prompt-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const renderPromptInput = () => html`
  <lr-prompt-input
    value="Summarize the attached report for the executive team."
    .attachments=${[
      { id: 'report', name: 'annual-report.pdf', mimeType: 'application/pdf' },
    ]}
    .modelCatalog=${['fast', 'accurate']}
    model="accurate"
    .voiceCatalog=${['calm', 'bright']}
    .sources=${[
      { id: 'report', label: 'Annual report' },
      { id: 'transcript', label: 'Earnings transcript' },
    ]}
    .selectedSourceIds=${['report']}
    .mentionItems=${[
      { id: 'finance', label: 'Finance team' },
      { id: 'legal', label: 'Legal team' },
    ]}
    .queue=${[{ id: 'follow-up', value: 'List the three largest risks.' }]}
  ></lr-prompt-input>
`;

export const Default: Story = {
  render: () => html`<div style="max-width: 48rem;">${renderPromptInput()}</div>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;">${renderPromptInput()}</div>`,
};
