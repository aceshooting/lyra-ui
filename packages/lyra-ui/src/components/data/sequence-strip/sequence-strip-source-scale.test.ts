import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import './sequence-strip.js';
import type { LyraSequenceStrip, SequenceStripItem } from './sequence-strip.class.js';
import type { LyraSequenceSource } from './sequence-strip-source.js';

describe('sequence full source scale', () => {
  it('aggregates one million allocated source positions and activates exact middle and tail items', async () => {
    const length = 1_000_000;
    const values = new Uint8Array(length);
    const prefixes = [new Uint32Array(length + 1), new Uint32Array(length + 1), new Uint32Array(length + 1)];
    const counts = [0, 0, 0];
    for (let index = 0; index < length; index++) {
      const category = index === length - 1 ? 2 : index % 3; values[index] = category; counts[category]!++;
      for (let cat = 0; cat < 3; cat++) prefixes[cat]![index + 1] = prefixes[cat]![index]! + (category === cat ? 1 : 0);
    }
    let summaries = 0; let exactReads = 0; let finds = 0; let submittedRanges = 0;
    const input: LyraSequenceSource<SequenceStripItem> = { revision: 1, length,
      getItem: index => { exactReads++; return { id: `item-${index}`, categoryId: String(values[index]), label: `Exact ${index}`, marker: index === length - 1 }; },
      findIndex: id => { finds++; return Number(id.slice(5)); },
      summarize: ({ maxRanges }) => { summaries++; submittedRanges += maxRanges;
        return Array.from({ length: maxRanges }, (_, index) => {
          const startIndex = index === 0 ? 0 : 1 + Math.floor((index - 1) * (length - 1) / (maxRanges - 1));
          const endIndex = index === 0 ? 1 : 1 + Math.floor(index * (length - 1) / (maxRanges - 1));
          const categoryCounts: Record<string, number> = {};
          for (let cat = 0; cat < 3; cat++) { const count = prefixes[cat]![endIndex]! - prefixes[cat]![startIndex]!; if (count) categoryCounts[String(cat)] = count; }
          return { startIndex, endIndex, categoryCounts, markerCount: endIndex === length ? 1 : 0, enabledCount: endIndex - startIndex };
        });
      },
    };
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip style="width:800px" marker-label="Marked" .strings=${{ sequenceStripSourceItemLabel: '{label}, item {index} of {total}' }}
      .categories=${[{ id: '0', label: 'First', color: 'red' }, { id: '1', label: 'Second', color: 'green' }, { id: '2', label: 'Third', color: 'blue' }]}
      .source=${input}></lr-sequence-strip>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 200);
    expect(summaries).to.equal(1); expect(exactReads).to.equal(0); expect(finds).to.equal(0);
    const cells = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]');
    expect(cells[199]!.getAttribute('data-range-end')).to.equal('999999');
    expect(cells[199]!.querySelectorAll('[part="marker"]').length).to.equal(1);
    expect(Number(cells[0]!.style.flexGrow)).to.be.lessThan(Number(cells[199]!.style.flexGrow));
    const summary = el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')!;
    expect(summary).to.include(new Intl.NumberFormat('en').format(counts[2]!));
    const activate = async (index: number) => {
      expect(await el.revealSourceItem(index)).to.equal(true);
      const exact = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-exact"]')!;
      await focusByKeyboard(exact); const event = oneEvent(el, 'lr-item-activate'); await sendKeys({ press: 'Enter' });
      expect((await event).detail.index).to.equal(index);
    };
    await activate(0); await activate(500000);
    await sendKeys({ press: 'End' }); await waitUntil(() => el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent!.includes('999999'));
    const tail = oneEvent(el, 'lr-item-activate'); await sendKeys({ press: 'Enter' });
    const detail = (await tail).detail; expect(detail.index).to.equal(999999); expect(detail.id).to.equal('item-999999'); expect(detail.item.marker).to.equal(true);
    expect(exactReads).to.equal(3); expect(summaries).to.equal(1);
    const probe = el as unknown as { sourceController: { snapshot: { ranges: readonly unknown[]; counts: ReadonlyMap<string, number> }; exact: unknown } };
    recordScaleMeasurement('lr-sequence-strip', 'one million allocated indexed positions', { logicalPositions: length, allocatedPositions: values.length,
      providerSummaries: summaries, submittedRanges, exactReads, findCalls: finds, retainedRanges: probe.sourceController.snapshot.ranges.length,
      retainedCategories: probe.sourceController.snapshot.counts.size, retainedExact: Number(!!probe.sourceController.exact), mountedCells: cells.length, domNodes: renderedNodeCount(el) });
  });
});

it('addresses a separate lazy million-position source without allocating its corpus', async () => {
  let summaries = 0; let exactReads = 0; let finds = 0;
  const input: LyraSequenceSource<SequenceStripItem> = { revision: 1, length: 1_000_000,
    summarize: () => { summaries++; return [{ startIndex: 0, endIndex: 1_000_000, categoryCounts: { all: 1_000_000 }, markerCount: 1, enabledCount: 1_000_000 }]; },
    getItem: index => { exactReads++; return { id: `lazy-${index}`, categoryId: 'all', label: `Lazy ${index}`, marker: index === 999999 }; },
    findIndex: id => { finds++; return Number(id.slice(5)); },
  };
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="cell"]'));
  for (const target of [0, 500000, 'lazy-999999']) {
    expect(await el.revealSourceItem(target)).to.equal(true);
    const selected = oneEvent(el, 'lr-item-activate'); el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-exact"]')!.click();
    expect((await selected).detail.index).to.equal(typeof target === 'number' ? target : 999999);
  }
  expect(exactReads).to.equal(3); expect(finds).to.equal(1); expect(summaries).to.equal(1);
  recordScaleMeasurement('lr-sequence-strip', 'lazy million logical positions', { logicalPositions: 1_000_000, providerSummaries: summaries,
    exactReads, findCalls: finds, mountedCells: el.shadowRoot!.querySelectorAll('[part="cell"]').length, domNodes: renderedNodeCount(el) });
});
