import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { render } from 'lit';
import './ingestion-queue.js';
import type { LyraIngestionQueue, IngestionQueueItem } from './ingestion-queue.js';

function item(overrides: Partial<IngestionQueueItem> & Pick<IngestionQueueItem, 'id' | 'stage'>): IngestionQueueItem {
  return { document: { id: overrides.id, name: `Doc ${overrides.id}` }, ...overrides };
}

/** Waits two animation frames -- enough for a freshly-mounted <lr-virtual-list>'s container/row
 *  ResizeObservers to settle before the fixture is torn down for the next test, matching
 *  virtual-list.test.ts's own identical helper/rationale. Without this, a queued ResizeObserver
 *  callback can still be pending when mocha tears down this test's fixture and starts the next
 *  one, which is what surfaces Chromium's benign-but-uncaught "ResizeObserver loop completed with
 *  undelivered notifications" as a spurious failure attributed to an unrelated later test. */
async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

it('defaults to items=[], label="", virtualizeThreshold=100', async () => {
  const el = (await fixture(html`<lr-ingestion-queue></lr-ingestion-queue>`)) as LyraIngestionQueue;
  expect(el.items).to.deep.equal([]);
  expect(el.label).to.equal('');
  expect(el.virtualizeThreshold).to.equal(100);
});

it('renders the built-in lr-empty state with no items', async () => {
  const el = (await fixture(html`<lr-ingestion-queue></lr-ingestion-queue>`)) as LyraIngestionQueue;
  const empty = el.shadowRoot!.querySelector('lr-empty');
  expect(empty).to.exist;
  expect(empty!.getAttribute('heading')).to.equal('No documents queued');
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.exist;
});

it('is accessible in the empty state', async () => {
  const el = (await fixture(html`<lr-ingestion-queue></lr-ingestion-queue>`)) as LyraIngestionQueue;
  await expect(el).to.be.accessible();
});

it('clips horizontal overflow from long queue metadata', async () => {
  const el = (await fixture(
    html`<lr-ingestion-queue .items=${[item({ id: '1', stage: 'failed', error: 'x'.repeat(500) })]}></lr-ingestion-queue>`,
  )) as LyraIngestionQueue;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="item-error"]') as HTMLElement;
  expect(getComputedStyle(list).overflowX).to.be.oneOf(['clip', 'hidden']);
  expect(getComputedStyle(error).overflowWrap).to.equal('anywhere');
});

it('formats chunk progress and attempt counts with the effective locale', async () => {
  const el = (await fixture(html`
    <lr-ingestion-queue
      lang="ar-u-nu-arab"
      .items=${[
        item({ id: '1', stage: 'embedding', chunkCount: 1234, embeddedChunkCount: 1000, attempts: 2 }),
      ]}
    ></lr-ingestion-queue>
  `)) as LyraIngestionQueue;
  const meta = el.shadowRoot!.querySelector('[part="item-meta"]')!;
  expect(meta.textContent).to.include('١٬٢٣٤');
  expect(meta.textContent).to.include('١٬٠٠٠');
  expect(meta.textContent).to.include('٢');
});

describe('populated rows', () => {
  it('renders one [part="item"] row per item, carrying data-stage, name, and a stage badge', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'queued' }), item({ id: '2', stage: 'embedding' })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows.length).to.equal(2);
    expect(rows[0]!.dataset.stage).to.equal('queued');
    expect(rows[1]!.dataset.stage).to.equal('embedding');
    expect(rows[0]!.querySelector('[part="item-name"]')!.textContent!.trim()).to.equal('Doc 1');
    const badge0 = rows[0]!.querySelector('lr-badge')!;
    expect(badge0.getAttribute('variant')).to.equal('neutral');
    expect(badge0.textContent!.trim()).to.equal('Queued');
    const badge1 = rows[1]!.querySelector('lr-badge')!;
    expect(badge1.getAttribute('variant')).to.equal('brand');
    expect(badge1.textContent!.trim()).to.equal('Embedding');
  });

  it('maps every stage to its localized label and badge variant', async () => {
    const stages: Array<[IngestionQueueItem['stage'], string, string]> = [
      ['queued', 'neutral', 'Queued'],
      ['uploading', 'brand', 'Uploading'],
      ['extracting', 'brand', 'Extracting text'],
      ['chunking', 'brand', 'Chunking'],
      ['embedding', 'brand', 'Embedding'],
      ['indexing', 'brand', 'Indexing'],
      ['done', 'success', 'Done'],
      ['failed', 'danger', 'Failed'],
      ['cancelled', 'neutral', 'Cancelled'],
    ];
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${stages.map(([stage], i) => item({ id: String(i), stage }))}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const badges = [...el.shadowRoot!.querySelectorAll('lr-badge')] as HTMLElement[];
    stages.forEach(([, variant, label], i) => {
      expect(badges[i]!.getAttribute('variant')).to.equal(variant);
      expect(badges[i]!.textContent!.trim()).to.equal(label);
    });
  });

  it('shows a progress indicator only for active (non-queued, non-terminal) stages', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[
          item({ id: '1', stage: 'queued' }),
          item({ id: '2', stage: 'uploading', progress: 40 }),
          item({ id: '3', stage: 'done' }),
          item({ id: '4', stage: 'failed' }),
          item({ id: '5', stage: 'cancelled' }),
        ]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('lr-progress-bar')).to.not.exist;
    expect(rows[1]!.querySelector('lr-progress-bar')).to.exist;
    expect(rows[2]!.querySelector('lr-progress-bar')).to.not.exist;
    expect(rows[3]!.querySelector('lr-progress-bar')).to.not.exist;
    expect(rows[4]!.querySelector('lr-progress-bar')).to.not.exist;
  });

  it('passes a numeric progress value through, and marks indeterminate when progress is unset', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[
          item({ id: '1', stage: 'uploading', progress: 62 }),
          item({ id: '2', stage: 'chunking' }),
        ]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    const bar0 = rows[0]!.querySelector('lr-progress-bar') as HTMLElement & { value: number; indeterminate: boolean };
    expect(bar0.value).to.equal(62);
    expect(bar0.indeterminate).to.be.false;
    const bar1 = rows[1]!.querySelector('lr-progress-bar') as HTMLElement & { indeterminate: boolean };
    expect(bar1.indeterminate).to.be.true;
  });

  it('shows chunk count only once chunkCount is set', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'chunking' }), item({ id: '2', stage: 'embedding', chunkCount: 12 })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('[part="item-chunk-count"]')).to.not.exist;
    expect(rows[1]!.querySelector('[part="item-chunk-count"]')!.textContent!.trim()).to.equal('12 chunks');
  });

  it('pluralizes the chunk count (singular at 1)', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'embedding', chunkCount: 1 })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    expect(el.shadowRoot!.querySelector('[part="item-chunk-count"]')!.textContent!.trim()).to.equal('1 chunk');
  });

  it('shows "N of M chunks embedded" only once both chunkCount and embeddedChunkCount are set', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[
          item({ id: '1', stage: 'embedding', chunkCount: 10 }),
          item({ id: '2', stage: 'embedding', chunkCount: 10, embeddedChunkCount: 4 }),
        ]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('[part="item-embedding-status"]')).to.not.exist;
    expect(rows[1]!.querySelector('[part="item-embedding-status"]')!.textContent!.trim()).to.equal(
      '4 of 10 chunks embedded',
    );
  });

  it('shows the attempt count only once attempts is greater than 0', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'failed' }), item({ id: '2', stage: 'failed', attempts: 2 })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('[part="item-attempts"]')).to.not.exist;
    expect(rows[1]!.querySelector('[part="item-attempts"]')!.textContent!.trim()).to.equal('Attempt 2');
  });

  it('renders historical failure detail without mounting it as a fresh alert', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[
          item({ id: '1', stage: 'failed' }),
          item({ id: '2', stage: 'failed', error: 'Unsupported file type' }),
        ]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('[part="item-error"]')).to.not.exist;
    const error = rows[1]!.querySelector('[part="item-error"]') as HTMLElement;
    expect(error.textContent!.trim()).to.equal('Unsupported file type');
    expect(error.hasAttribute('role')).to.be.false;
    const live = el.shadowRoot!.querySelector('[part="failure-live"]') as HTMLElement;
    expect(live.getAttribute('role')).to.equal('alert');
    expect(live.textContent!.trim()).to.equal('');
  });

  it('announces only failures that transition or are added after mount', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'queued' })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const liveText = () => el.shadowRoot!.querySelector('[part="failure-live"]')!.textContent!.trim();
    expect(liveText()).to.equal('');

    el.items = [item({ id: '1', stage: 'failed', error: 'Unsupported file type' })];
    await el.updateComplete;
    expect(liveText()).to.equal('Unsupported file type');

    el.items = [
      item({ id: '1', stage: 'failed', error: 'Unsupported file type' }),
      item({ id: '2', stage: 'failed', error: 'Network unavailable' }),
    ];
    await el.updateComplete;
    expect(liveText()).to.equal('Network unavailable');
  });
});

describe('retry/cancel affordances', () => {
  it('renders a retry button only for stage="failed"', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'uploading' }), item({ id: '2', stage: 'failed' })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('[part="retry-button"]')).to.not.exist;
    expect(rows[1]!.querySelector('[part="retry-button"]')).to.exist;
  });

  it('renders a cancel button for every non-terminal stage, and none for done/failed/cancelled', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[
          item({ id: '1', stage: 'queued' }),
          item({ id: '2', stage: 'uploading' }),
          item({ id: '3', stage: 'done' }),
          item({ id: '4', stage: 'failed' }),
          item({ id: '5', stage: 'cancelled' }),
        ]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('[part="cancel-button"]')).to.exist;
    expect(rows[1]!.querySelector('[part="cancel-button"]')).to.exist;
    expect(rows[2]!.querySelector('[part="cancel-button"]')).to.not.exist;
    expect(rows[3]!.querySelector('[part="cancel-button"]')).to.not.exist;
    expect(rows[4]!.querySelector('[part="cancel-button"]')).to.not.exist;
  });

  it('fires lr-retry with { itemId, attempt } on click, attempt = (attempts ?? 0) + 1', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'failed', attempts: 2 })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const firing = oneEvent(el, 'lr-retry');
    (el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement).click();
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ itemId: '1', attempt: 3 });
  });

  it('defaults attempt to 1 when the item has never been retried', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue .items=${[item({ id: '1', stage: 'failed' })]}></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const firing = oneEvent(el, 'lr-retry');
    (el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement).click();
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ itemId: '1', attempt: 1 });
  });

  it('fires lr-cancel with { itemId } on click', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue .items=${[item({ id: '9', stage: 'embedding' })]}></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const firing = oneEvent(el, 'lr-cancel');
    (el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLButtonElement).click();
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ itemId: '9' });
  });

  it('gives the retry/cancel buttons an accessible name that includes the document name', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .items=${[item({ id: '1', stage: 'failed', document: { id: '1', name: 'Q3 report.pdf' } })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const retry = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
    expect(retry.getAttribute('aria-label')).to.equal('Retry Q3 report.pdf');
  });

  it('keeps compact retry/cancel targets at the live hit-area token override', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        style="--lr-icon-button-size: 52px"
        .items=${[
          item({ id: '1', stage: 'failed' }),
          item({ id: '2', stage: 'queued' }),
        ]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    for (const part of ['retry-button', 'cancel-button']) {
      const target = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      const bounds = target.getBoundingClientRect();
      expect(bounds.width, part).to.be.at.least(52);
      expect(bounds.height, part).to.be.at.least(52);
    }
  });
});

describe('accessible name', () => {
  it('defaults the region name to the localized "Ingestion queue"', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue .items=${[item({ id: '1', stage: 'queued' })]}></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Ingestion queue');
  });

  it('lets the label property override the default name', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        label="Uploads"
        .items=${[item({ id: '1', stage: 'queued' })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Uploads');
  });

  it('lets a host aria-label win over both the label property and the localized default', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        aria-label="Custom name"
        label="Uploads"
        .items=${[item({ id: '1', stage: 'queued' })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Custom name');
  });
});

describe('.strings overrides', () => {
  it('lets .strings override the empty-state heading', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue .strings=${{ ingestionQueueEmpty: 'Rien en attente' }}></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Rien en attente');
  });

  it('lets .strings override the retry and cancel verbs', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        .strings=${{ retry: 'Réessayer', cancel: 'Annuler' }}
        .items=${[item({ id: '1', stage: 'failed' }), item({ id: '2', stage: 'embedding' })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
    expect(rows[0]!.querySelector('[part="retry-button"] span')!.textContent).to.equal('Réessayer');
    expect(rows[1]!.querySelector('[part="cancel-button"] span')!.textContent).to.equal('Annuler');
  });
});

describe('virtualization', () => {
  it('renders a plain [part="list"] below virtualizeThreshold', async () => {
    const el = (await fixture(
      html`<lr-ingestion-queue
        virtualize-threshold="5"
        .items=${[item({ id: '1', stage: 'queued' }), item({ id: '2', stage: 'queued' })]}
      ></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    expect(el.shadowRoot!.querySelector('[part="list"]')).to.exist;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.not.exist;
  });

  it('switches to an internal lr-virtual-list at/above virtualizeThreshold, wired with items/keyFunction', async () => {
    const items = [item({ id: '1', stage: 'queued' }), item({ id: '2', stage: 'uploading' })];
    const el = (await fixture(
      html`<lr-ingestion-queue virtualize-threshold="2" .items=${items}></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const virtualList = el.shadowRoot!.querySelector('lr-virtual-list') as unknown as {
      items: unknown[];
      keyFunction: (item: unknown, index: number) => string | number;
      renderItem: (item: unknown, index: number) => unknown;
    } | null;
    expect(virtualList).to.exist;
    expect(el.shadowRoot!.querySelector('[part="list"]')).to.not.exist;
    expect(virtualList!.items).to.equal(items);
    expect(virtualList!.keyFunction(items[1], 1)).to.equal('2');
    await nextFrame();
  });

  it('exports every styled virtualized row part so a consumer stylesheet reaches them', async () => {
    // Row markup is rendered inside <lr-virtual-list>'s own shadow root, two hops from a consumer:
    // without exportparts on that element, lr-ingestion-queue::part(item) matches nothing at all.
    const names = [
      'item',
      'item-header',
      'item-name',
      'item-progress',
      'item-meta',
      'item-error',
      'item-actions',
      'retry-button',
      'cancel-button',
    ];
    const style = document.createElement('style');
    style.textContent = names
      .map((name, i) => `lr-ingestion-queue::part(${name}) { padding-block-start: ${i + 1}px; }`)
      .join('\n');
    document.head.append(style);
    try {
      const el = (await fixture(
        html`<lr-ingestion-queue
          virtualize-threshold="1"
          .items=${[
            item({ id: '1', stage: 'failed', error: 'Boom', attempts: 1, chunkCount: 4 }),
            item({ id: '2', stage: 'uploading', progress: 30 }),
          ]}
        ></lr-ingestion-queue>`,
      )) as LyraIngestionQueue;
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await nextFrame();
      const rows = [...list.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
      expect(rows.length).to.be.greaterThan(1);
      // `retry-button`/`item-error` only exist on the failed row, `item-progress`/`cancel-button`
      // on the in-flight one -- resolve each name across every rendered row.
      for (const [i, name] of names.entries()) {
        const target = list.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
        expect(getComputedStyle(target).paddingBlockStart, name).to.equal(`${i + 1}px`);
      }
    } finally {
      style.remove();
    }
  });

  it('renders row content identically through the internal lr-virtual-list renderItem callback', async () => {
    // Real virtualized row layout isn't reliably assertable without real browser viewport
    // sizing, so -- matching <lr-activity-feed>'s own equivalent test -- this invokes the
    // internal lr-virtual-list's .renderItem callback directly against a scratch container.
    const el = (await fixture(
      html`<lr-ingestion-queue virtualize-threshold="1"></lr-ingestion-queue>`,
    )) as LyraIngestionQueue;
    const target = item({ id: '1', stage: 'failed', error: 'Boom' });
    el.items = [target, item({ id: '2', stage: 'queued' })];
    await el.updateComplete;
    const virtualList = el.shadowRoot!.querySelector('lr-virtual-list') as unknown as {
      renderItem: (item: unknown, index: number) => unknown;
    };
    const container = document.createElement('div');
    render(virtualList.renderItem(target, 0) as ReturnType<typeof html>, container);
    expect(container.querySelector('[part="item-name"]')!.textContent!.trim()).to.equal('Doc 1');
    expect(container.querySelector('[part="item-error"]')!.textContent!.trim()).to.equal('Boom');
    // Rendered outside the internal virtual-list's own role="listitem" row wrapper here, so this
    // component's own item div deliberately omits a redundant role in that mode.
    expect(container.querySelector('[part="item"]')!.hasAttribute('role')).to.be.false;
    await nextFrame();
  });
});

it('is accessible with a populated, mixed-stage queue', async () => {
  const el = (await fixture(
    html`<lr-ingestion-queue
      .items=${[
        item({ id: '1', stage: 'queued' }),
        item({ id: '2', stage: 'uploading', progress: 30 }),
        item({ id: '3', stage: 'embedding', chunkCount: 10, embeddedChunkCount: 4 }),
        item({ id: '4', stage: 'done', chunkCount: 10, embeddedChunkCount: 10 }),
        item({ id: '5', stage: 'failed', error: 'Unsupported file type', attempts: 1 }),
      ]}
    ></lr-ingestion-queue>`,
  )) as LyraIngestionQueue;
  expect(el.shadowRoot!.querySelectorAll('[part="item"]')).to.have.length(5);
  await expect(el).to.be.accessible();
});
