import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './prompt-input.js';
import type { LyraPromptInput } from './prompt-input.class.js';

const meta: Meta = {
  title: 'Prompt Input',
  component: 'lr-prompt-input',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Attachment chips use unique nonempty attachmentId values; source roots and queued prompts use unique nonblank ids; selected source ids are unique and nonblank. Malformed and later duplicate rows are omitted first-wins before section gating or forwarding. Every array-valued input, including nested source children and queue attachments, is a bounded clone-owned frozen snapshot; reassign a new collection after changes.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const renderPromptInput = () => html`
  <lr-prompt-input
    value="Summarize the attached report for the executive team."
    .attachments=${[
      { attachmentId: 'report', name: 'annual-report.pdf', mimeType: 'application/pdf', bytes: 2_408_448 },
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
      { suggestionId: 'finance', label: 'Finance team' },
      { suggestionId: 'legal', label: 'Legal team' },
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

export const AdornmentSlots: Story = {
  name: 'Start/end adornment slots',
  parameters: {
    docs: {
      description: {
        story:
          'Supplying `start` replaces the generated attachment trigger. Supplying `end` replaces the built-in send/stop action.',
      },
    },
  },
  render: () => html`
    <div style="max-inline-size: var(--lr-size-32rem);">
      <lr-prompt-input placeholder="Compose a message">
        <button slot="start" type="button">Start</button>
        <button slot="end" type="button">End</button>
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
