import { sendKeys } from '@web/test-runner-commands';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-sequence-strip.js';
import type { LyraSequenceStrip, SequenceStripItem } from './sequence-strip.class.js';
import type { LyraSequenceRangeSummary, LyraSequenceSource } from './sequence-strip-source.js';

const smallSource = (): LyraSequenceSource<SequenceStripItem> => ({ revision: 1, length: 3,
  getItem: index => ({ id: `id-${index}`, categoryId: 'a', label: `Exact ${index}` }),
  findIndex: id => Number(id.slice(3)),
  summarize: () => [{ startIndex: 0, endIndex: 3, categoryCounts: { a: 3 }, markerCount: 0, enabledCount: 3 }],
});
const ready = async (el: LyraSequenceStrip) => {
  await el.updateComplete;
  await waitUntil(() => !!el.shadowRoot!.querySelector('[data-range-start]'));
  await el.updateComplete;
};
const cells = (el: LyraSequenceStrip) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];

describe('sequence strip exact inspection boundaries', () => {
  it('reports false when asked to reveal a source item while no source is assigned', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .items=${[{ id: 'a', categoryId: 'x' }]}></lr-sequence-strip>`);
    expect(await el.revealSourceItem(0)).to.equal(false);
    expect(await el.revealSourceItem('a')).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="source-exact"]').length).to.equal(0);
  });

  it('rejects blank, oversized and out-of-range targets without calling the provider', async () => {
    const input = smallSource(); let lookups = 0; let reads = 0;
    input.findIndex = id => { lookups++; return Number(id.slice(3)); };
    input.getItem = index => { reads++; return { id: `id-${index}`, categoryId: 'a' }; };
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
    await ready(el);
    for (const target of ['', '   ', 'x'.repeat(65_537), -1, 3, 1.5, Number.NaN]) {
      expect(await el.revealSourceItem(target), String(target).slice(0, 8)).to.equal(false);
    }
    expect(lookups).to.equal(0);
    expect(reads).to.equal(0);
    expect(await el.revealSourceItem('id-2')).to.equal(true);
    expect(lookups).to.equal(1);
  });

  it('resolves false and keeps the replacement exact control when the source changes during a pending item read', async () => {
    const input = smallSource(); let release!: (item: SequenceStripItem) => void;
    input.getItem = () => new Promise(resolve => { release = resolve; });
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
    await ready(el);
    const pending = el.revealSourceItem(1);
    await waitUntil(() => typeof release === 'function');
    const replacement = smallSource();
    replacement.getItem = index => ({ id: `id-${index}`, categoryId: 'a', label: `Replacement ${index}` });
    el.source = replacement;
    release({ id: 'id-1', categoryId: 'a', label: 'Stale 1' });
    expect(await pending).to.equal(false);
    await ready(el);
    expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent).not.to.include('Stale 1');
    expect(await el.revealSourceItem(1)).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent).to.include('Replacement 1');
  });
});

describe('sequence strip source summaries', () => {
  it('discards a summary that settles after its source was replaced', async () => {
    const stale = smallSource();
    let release!: (ranges: LyraSequenceRangeSummary[]) => void;
    stale.summarize = () => new Promise(resolve => { release = resolve; });
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${stale}></lr-sequence-strip>`);
    await waitUntil(() => typeof release === 'function');
    const replacement = smallSource();
    replacement.summarize = () => [
      { startIndex: 0, endIndex: 1, categoryCounts: { a: 1 }, markerCount: 0, enabledCount: 1 },
      { startIndex: 1, endIndex: 3, categoryCounts: { a: 2 }, markerCount: 0, enabledCount: 2 },
    ];
    el.source = replacement;
    await el.updateComplete;
    // The stale reply settles only after its provider lost authority.
    release([{ startIndex: 0, endIndex: 3, categoryCounts: { a: 3 }, markerCount: 0, enabledCount: 3 }]);
    await ready(el);
    expect(cells(el).map(cell => cell.dataset['rangeEnd'])).to.deep.equal(['0', '2']);
  });

  it('renders the legend in source mode', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip with-legend marker-label="Flag" .source=${smallSource()}
      .categories=${[{ id: 'a', label: 'Alpha', color: 'rgb(1, 2, 3)' }]}></lr-sequence-strip>`);
    await ready(el);
    const labels = [...el.shadowRoot!.querySelectorAll('[part="legend-label"]')].map(node => node.textContent!.trim());
    expect(labels).to.deep.equal(['Alpha', 'Flag']);
    expect(el.shadowRoot!.querySelector('[part="legend"]')!.getAttribute('aria-hidden')).to.equal('true');
  });

  it('fails a scalar source visibly and accepts a callable provider', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip></lr-sequence-strip>`);
    el.source = 'not a provider' as unknown as LyraSequenceSource<SequenceStripItem>;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(1);
    const provider = smallSource();
    const callable = function provide() { return undefined; } as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(provider)) Object.defineProperty(callable, key, { value, configurable: true });

    el.source = callable as unknown as LyraSequenceSource<SequenceStripItem>;
    await ready(el);
    expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(0);
    expect(cells(el).length).to.equal(1);
  });

  it('does not re-read a failed provider for unrelated updates', async () => {
    const input = smallSource(); let reads = 0;
    Object.defineProperty(input, 'revision', { get() { reads++; throw new Error('metadata unavailable'); } });
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
    await el.updateComplete;
    expect(reads).to.equal(1);
    el.selectedIndex = 1; await el.updateComplete;
    el.markerLabel = 'Marker'; await el.updateComplete;
    expect(reads).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(1);
  });
});

describe('sequence strip item tab stop', () => {
  it('degrades a disabled selected final cell back to the nearest earlier enabled cell', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip selected-index="2" .items=${[
      { id: 'a', categoryId: 'x' }, { id: 'b', categoryId: 'x' }, { id: 'c', categoryId: 'x', disabled: true },
    ]}></lr-sequence-strip>`);
    expect(cells(el).map(cell => cell.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
    expect(cells(el)[2]!.getAttribute('aria-current')).to.equal('true');
  });

  it('keeps focus in place when Home or End finds no enabled cell', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .items=${[
      { id: 'a', categoryId: 'x', disabled: true }, { id: 'b', categoryId: 'x', disabled: true },
    ]}></lr-sequence-strip>`);
    await focusByKeyboard(cells(el)[0]!);
    for (const key of ['End', 'Home', 'ArrowRight']) {
      await sendKeys({ press: key });
      await el.updateComplete;
      expect(el.shadowRoot!.activeElement?.getAttribute('data-index'), key).to.equal('0');
    }
  });
});
