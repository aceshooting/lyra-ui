import { expect, fixture, html } from '@open-wc/testing';
import './ingestion-queue.js';
import type { LyraIngestionQueue, IngestionQueueItem, IngestionQueueStagePresentation } from './ingestion-queue.class.js';
import type { LyraProgressBar } from '../../overlays/progress/progress-bar.class.js';

function item(id: string, stage: IngestionQueueItem['stage'], customStage?: IngestionQueueStagePresentation, progress?: number): IngestionQueueItem {
  return { id, document: { id: `doc-${id}`, name: `Document ${id}` }, stage, customStage, progress };
}

function publish(el: LyraIngestionQueue, items: readonly IngestionQueueItem[]): void {
  Object.assign(el, { items });
}

function rows(el: LyraIngestionQueue): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')];
}

function stageText(row: HTMLElement): string {
  return row.querySelector('[part="item-stage"]')!.textContent!.trim();
}

describe('ingestion queue host stage presentation', () => {
  it('preserves standard stage presentation and keeps unconfigured custom stages neutral and actionless', async () => {
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    publish(el, [item('upload', 'uploading', undefined, 25), item('failed', 'failed'), item('custom', 'custom')]);
    await el.updateComplete;
    const [upload, failed, custom] = rows(el);
    expect(stageText(upload!)).to.equal('Uploading');
    expect(upload!.querySelectorAll('[part="cancel-button"]').length).to.equal(1);
    expect(stageText(failed!)).to.equal('Failed');
    expect(failed!.querySelectorAll('[part="retry-button"]').length).to.equal(1);
    expect(stageText(custom!)).to.equal('Unknown stage');
    expect(custom!.querySelector('[part="item-stage"]')!.getAttribute('variant')).to.equal('neutral');
    expect(custom!.querySelectorAll('button,[part="item-progress"]').length).to.equal(0);
  });

  it('renders distinct host stages as caller text without treating them as standard failures or adding default actions', async () => {
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    publish(el, [
      item('paused', 'custom', { id: 'paused', label: 'Paused by user', variant: 'warning' }, 50),
      item('interrupted', 'custom', { id: 'interrupted', label: '<b>Choose the file again</b>' }),
    ]);
    await el.updateComplete;
    const [paused, interrupted] = rows(el);
    expect(stageText(paused!)).to.equal('Paused by user');
    expect(paused!.querySelector('[part="item-stage"]')!.getAttribute('variant')).to.equal('warning');
    expect(stageText(interrupted!)).to.equal('<b>Choose the file again</b>');
    expect(el.shadowRoot!.querySelectorAll('b').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="item-progress"],[part="item-error"],button').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="failure-live"]')?.textContent?.trim() ?? '').to.equal('');
  });

  it('shows custom progress only when explicitly requested and keeps raw custom labels in its accessible name', async () => {
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    publish(el, [
      item('finite', 'custom', { id: 'waiting', label: 'Waiting for acknowledgement', showProgress: true }, 150),
      item('indeterminate', 'custom', { id: 'checking', label: 'Checking', showProgress: true }),
      item('hidden', 'custom', { id: 'paused', label: 'Paused' }, 75),
    ]);
    await el.updateComplete;
    const indicators = [...el.shadowRoot!.querySelectorAll<LyraProgressBar>('[part="item-progress"]')];
    expect(indicators.length).to.equal(2);
    await Promise.all(indicators.map(indicator => indicator.updateComplete));
    const semantics = indicators[0]!.shadowRoot!.querySelector('[role="progressbar"]')!;
    expect(semantics.getAttribute('aria-valuenow')).to.equal('100');
    expect(indicators[0]!.getAttribute('aria-label')).to.include('Waiting for acknowledgement');
    expect(indicators[1]!.indeterminate).to.equal(true);
    expect(rows(el)[2]!.querySelectorAll('[part="item-progress"]').length).to.equal(0);
  });

  it('ignores custom metadata on standard stages and fails malformed custom metadata closed without invoking getters', async () => {
    let reads = 0;
    const unsafe = { id: 'host-stage' };
    Object.defineProperty(unsafe, 'label', { enumerable: true, get() { reads++; throw new Error('stage label getter must not run'); } });
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    const invalid = [
      item('standard', 'queued', { id: 'done', label: 'Misleading completion', variant: 'success' }),
      item('blank', 'custom', { id: 'paused', label: '  ' }),
      item('unsafe', 'custom', unsafe as IngestionQueueStagePresentation),
      item('safe', 'custom', { id: 'paused', label: 'A safe later row' }),
    ];
    publish(el, invalid);
    await el.updateComplete;
    expect(rows(el).map(stageText)).to.deep.equal(['Queued', 'Unknown stage', 'Unknown stage', 'A safe later row']);
    expect(reads).to.equal(0);
    expect(rows(el)[1]!.querySelectorAll('button').length).to.equal(0);
    expect(rows(el)[2]!.querySelectorAll('button').length).to.equal(0);
  });

  it('keeps a populated custom stage contained and accessible at 320px in RTL', async () => {
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue dir="rtl" style="inline-size: 320px"></lr-ingestion-queue>`);
    publish(el, [item('narrow', 'custom', { id: 'waiting', label: 'بانتظار استعادة الاتصال والمتابعة '.repeat(4), showProgress: true }, 40)]);
    await el.updateComplete;
    expect(stageText(rows(el)[0]!)).to.include('بانتظار');
    expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
    const host = el.getBoundingClientRect();
    const label = rows(el)[0]!.querySelector('[part="item-stage"]')!.getBoundingClientRect();
    expect(label.left).to.be.at.least(host.left - 1);
    expect(label.right).to.be.at.most(host.right + 1);
    await expect(el).to.be.accessible();
  });
});
