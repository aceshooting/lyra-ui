import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './prompt-input.js';
import type { LyraPromptInput } from './prompt-input.class.js';

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

export const AdornmentSlotAliases: Story = {
  name: 'Start/end adornment slot aliases',
  parameters: {
    docs: {
      description: {
        story:
          'The canonical `start` and `end` slots coexist with the established `leading` and `trailing` aliases. Supplying any attachment-control alias replaces the generated attachment trigger; supplying either action alias replaces the built-in send/stop action.',
      },
    },
  },
  render: () => html`
    <div style="max-inline-size: var(--lr-size-32rem);">
      <lr-prompt-input placeholder="Compose a message">
        <button slot="start" type="button">Start</button>
        <button slot="leading" type="button">Leading</button>
        <button slot="end" type="button">End</button>
        <button slot="trailing" type="button">Trailing</button>
      </lr-prompt-input>
    </div>
  `,
};

/** The composed textarea's editing assistance and native selection facade remain available on the prompt host. */
export const NativeTextareaFacade: Story = {
  render: () => {
    const promptFor = (event: Event) =>
      (event.currentTarget as HTMLElement).closest('[data-textarea-demo]')?.querySelector<LyraPromptInput>('lr-prompt-input');
    return html`
      <div data-textarea-demo style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-32rem)">
        <lr-prompt-input
          value="Draft a concise project update."
          spellcheck="false"
          autocapitalize="sentences"
          autocorrect="on"
          wrap="hard"
          autocomplete="off"
          inputmode="text"
          enterkeyhint="send"
        ></lr-prompt-input>
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-xs)">
          <button type="button" @click=${(event: Event) => promptFor(event)?.select()}>Select text</button>
          <button
            type="button"
            @click=${(event: Event) => {
              const prompt = promptFor(event);
              if (!prompt?.input) return;
              prompt.setRangeText('Send an update.', 0, prompt.input.value.length, 'select');
            }}
          >Replace text</button>
        </div>
      </div>
    `;
  },
};
