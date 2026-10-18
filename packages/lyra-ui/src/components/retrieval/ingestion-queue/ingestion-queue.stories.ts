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
          'A controlled ingestion list that omits malformed, blank-id, and later duplicate rows first-wins before counts, virtualization, failure announcements, rendering, and retry/cancel actions. Nonstring failure details use the localized failed-stage label; historical failures remain silent on mount. Every documented row part, including stage and detailed count/status fields, remains forwarded in virtualized mode.',
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
        virtualize-at="50"
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

export const AnnounceMountedFailures: Story = {
  name: 'Announce mounted failures',
  parameters: {
    docs: {
      description: {
        story:
          'A queue created to report a retried run that already failed mounts with `stage: "failed"` rows, so there is no later `items` write for the live region to catch. `announce` opts that one mount pass in: the caller-supplied `item.error` strings are list-formatted in the effective locale and sent once to the shared light-DOM assertive sink, through the same path a later failure uses. Leave it off for a queue that is simply part of the page being loaded — those rows already read in document order. It is read once per element lifetime, so reconnecting or adopting the queue stages the same rows again rather than replaying the announcement.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); justify-items: start;">
      <button
        @click=${(event: Event) => {
          const host = (event.currentTarget as HTMLElement).parentElement!;
          host.querySelector('lr-ingestion-queue')?.remove();
          const queue = document.createElement('lr-ingestion-queue');
          queue.setAttribute('announce', '');
          (queue as unknown as { items: IngestionQueueItem[] }).items = [
            { id: '1', document: { id: '1', name: 'roadmap.pdf' }, stage: 'done', chunkCount: 12, embeddedChunkCount: 12 },
            { id: '2', document: { id: '2', name: 'legacy-export.zip' }, stage: 'failed', error: 'Unsupported file type' },
            { id: '3', document: { id: '3', name: 'handbook.pdf' }, stage: 'failed', error: 'Network unavailable' },
          ];
          host.append(queue);
        }}
      >Retry ingestion (fails)</button>
    </div>
  `,
};

export const InputLimit: Story = {
  render: () => html`<lr-ingestion-queue .items=${Array.from({ length: 10001 }, (_, index) => ({
    id: `item-${index}`, document: { id: `document-${index}`, name: `Document ${index + 1}` }, stage: 'queued',
  }))}></lr-ingestion-queue>`,
};

const millionQueueSource: import('./ingestion-queue.class.js').IngestionQueueSource = {
  revision: 1,
  async query({ page, pageSize, signal }) {
    await new Promise(resolve => setTimeout(resolve, 40));
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return { total: 1_000_000, rows: Array.from({ length: Math.min(pageSize, Math.max(0, 1_000_000 - page * pageSize)) }, (_, offset) => {
      const order = page * pageSize + offset;
      const value: IngestionQueueItem = { id: `queue-${order}`, document: { id: `document-${order}`, name: `Document ${order}` },
        stage: order % 3 === 0 ? 'failed' : order % 3 === 1 ? 'embedding' : 'done',
        ...(order % 3 === 0 ? { error: 'An earlier ingestion attempt failed', attempts: 1 } : { progress: 60 }) };
      return { key: value.id, order, value };
    }) };
  },
  async lookup(keys) {
    return keys.flatMap(key => {
      const order = /^queue-\d+$/.test(key) ? Number(key.slice(6)) : -1;
      return Number.isSafeInteger(order) && order >= 0 && order < 1_000_000
        ? [{ key, order, value: { id: key, document: { id: `document-${order}`, name: `Document ${order}` }, stage: 'done' as const } }] : [];
    });
  },
  async locate(key) {
    const order = /^queue-\d+$/.test(key) ? Number(key.slice(6)) : -1;
    return Number.isSafeInteger(order) && order >= 0 && order < 1_000_000 ? order : null;
  },
};

/** Paging historical failures does not replay their live failure announcements. */
export const MillionSource: Story = {
  render: () => html`<p>Browse one million generated queue records. Retry and cancel remain requests for the host to handle.</p><lr-ingestion-queue .dataSource=${millionQueueSource}></lr-ingestion-queue>`,
};
