import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './ingestion-queue.js';
import type { IngestionQueueItem } from './ingestion-queue.js';

const meta: Meta = {
  title: 'Ingestion Queue',
  component: 'lr-ingestion-queue',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A controlled list of documents moving through an ingestion pipeline (upload, extract, chunk, embed, index), each row showing its stage, progress, chunk/embedding counts, and a retry or cancel affordance. Presentation only -- retrying or cancelling a row fires an lr-retry/lr-cancel request event for the host to act on.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const mixedItems: IngestionQueueItem[] = [
  { id: '1', document: { id: '1', name: 'roadmap.pdf' }, stage: 'queued' },
  { id: '2', document: { id: '2', name: 'onboarding-guide.docx' }, stage: 'uploading', progress: 42 },
  { id: '3', document: { id: '3', name: 'security-policy.md' }, stage: 'extracting' },
  { id: '4', document: { id: '4', name: 'quarterly-report.pdf' }, stage: 'chunking', progress: 70 },
  {
    id: '5',
    document: { id: '5', name: 'release-notes.md' },
    stage: 'embedding',
    progress: 55,
    chunkCount: 48,
    embeddedChunkCount: 26,
  },
  { id: '6', document: { id: '6', name: 'handbook.pdf' }, stage: 'indexing', chunkCount: 120, embeddedChunkCount: 120 },
  { id: '7', document: { id: '7', name: 'faq.md' }, stage: 'done', chunkCount: 18, embeddedChunkCount: 18 },
  {
    id: '8',
    document: { id: '8', name: 'legacy-export.zip' },
    stage: 'failed',
    error: 'Unsupported file type',
    attempts: 1,
  },
  { id: '9', document: { id: '9', name: 'draft-notes.txt' }, stage: 'cancelled' },
];

export const Default: Story = {
  render: () => html`
    <div style="max-inline-size: 40rem;">
      <lr-ingestion-queue .items=${mixedItems}></lr-ingestion-queue>
    </div>
  `,
};

export const Empty: Story = {
  render: () => html`<lr-ingestion-queue></lr-ingestion-queue>`,
};

export const AllStages: Story = {
  name: 'One row per stage',
  render: () => html`
    <div style="max-inline-size: 40rem;">
      <lr-ingestion-queue
        .items=${(
          [
            'queued',
            'uploading',
            'extracting',
            'chunking',
            'embedding',
            'indexing',
            'done',
            'failed',
            'cancelled',
          ] as const
        ).map((stage, i) => ({
          id: String(i),
          document: { id: String(i), name: `document-${i}.pdf` },
          stage,
          progress: 50,
        }))}
      ></lr-ingestion-queue>
    </div>
  `,
};

export const Virtualized: Story = {
  name: 'Virtualized (500 items)',
  render: () => html`
    <div style="max-inline-size: 40rem;">
      <lr-ingestion-queue
        virtualize-threshold="50"
        style="--lr-ingestion-queue-max-height: 20rem;"
        .items=${Array.from({ length: 500 }, (_, i) => ({
          id: String(i),
          document: { id: String(i), name: `document-${i}.pdf` },
          stage: (['queued', 'uploading', 'embedding', 'done'] as const)[i % 4],
          progress: 40,
        }))}
      ></lr-ingestion-queue>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div style="max-inline-size: 40rem;">
      <lr-ingestion-queue
        .items=${[
          { id: '1', document: { id: '1', name: 'legacy-export.zip' }, stage: 'failed', error: 'Unsupported file type' },
          { id: '2', document: { id: '2', name: 'onboarding-guide.docx' }, stage: 'uploading', progress: 20 },
        ] as IngestionQueueItem[]}
        @lr-retry=${(e: CustomEvent<{ itemId: string; attempt: number }>) => {
          const out = document.getElementById('ingestion-queue-log');
          if (out) out.textContent = `lr-retry: ${JSON.stringify(e.detail)}`;
        }}
        @lr-cancel=${(e: CustomEvent<{ itemId: string }>) => {
          const out = document.getElementById('ingestion-queue-log');
          if (out) out.textContent = `lr-cancel: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-ingestion-queue>
      <p id="ingestion-queue-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-ingestion-queue .items=${mixedItems.slice(0, 4)}></lr-ingestion-queue>
    </div>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <div dir="rtl" style="max-inline-size: 40rem;">
      <lr-ingestion-queue
        .items=${[
          {
            id: '1',
            document: { id: '1', name: 'تقرير-ربع-سنوي.pdf' },
            stage: 'embedding',
            progress: 55,
            chunkCount: 48,
            embeddedChunkCount: 26,
          },
          { id: '2', document: { id: '2', name: 'ملف-غير-مدعوم.zip' }, stage: 'failed', error: 'نوع ملف غير مدعوم' },
        ] as IngestionQueueItem[]}
      ></lr-ingestion-queue>
    </div>
  `,
};
