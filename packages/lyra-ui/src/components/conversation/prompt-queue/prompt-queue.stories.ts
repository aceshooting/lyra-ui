import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  LyraPromptQueue,
  PromptQueueChangeDetail,
  PromptQueueItem,
} from './prompt-queue.class.js';
import './prompt-queue.js';

const meta: Meta = {
  title: 'Prompt Queue',
  component: 'lr-prompt-queue',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const items: PromptQueueItem[] = [
  {
    id: 'risks',
    value: 'List the three largest risks and cite the supporting passages.',
    attachments: [
      { id: 'report', name: 'annual-report.pdf' },
      { id: 'notes', name: 'review-notes.txt' },
    ],
  },
  {
    id: 'comparison',
    value: 'Compare those risks with the previous annual report.',
  },
];

export const Default: Story = {
  render: () => html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`,
};

/** This fixture accepts every controlled queue proposal immediately. Tab to a Remove action and
 * activate it: focus follows the same action on the nearest survivor, or the queue region after
 * the final removal. */
export const ControlledRemovalFocus: Story = {
  render: () => html`
    <lr-prompt-queue
      .items=${items}
      @lr-queue-change=${(event: CustomEvent<PromptQueueChangeDetail>) => {
        (event.currentTarget as LyraPromptQueue).items = event.detail.items;
      }}
    ></lr-prompt-queue>
  `,
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-prompt-queue .items=${items}></lr-prompt-queue>
    </div>
  `,
};

/** Pages bound editor work while proposals continue to contain the complete admitted queue. */
export const PagedQueue: Story = {
  render: () => html`<lr-prompt-queue .items=${Array.from({ length: 60 }, (_, index) => ({
    id: `q${index}`, value: `Follow-up ${index + 1}`,
    attachments: index === 0 ? Array.from({ length: 100 }, (_, document) => ({ id: `d${document}`, name: `Document ${document + 1}` })) : [],
  }))}></lr-prompt-queue>`,
};

export const InputLimit: Story = {
  render: () => html`<lr-prompt-queue .items=${[{
    id: 'draft', value: 'Review the retained documents',
    attachments: Array.from({ length: 10_001 }, (_, index) => ({ id: `d${index}`, name: `Document ${index + 1}` })),
  }]}></lr-prompt-queue>`,
};
