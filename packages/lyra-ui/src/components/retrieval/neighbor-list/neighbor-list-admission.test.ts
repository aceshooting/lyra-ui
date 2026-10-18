import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { LyraNeighborList } from './neighbor-list.js';

it('discloses outer neighbor input loss and clears the notice after replacement', async () => {
  const warning = '<lr-neighbor-list>: \'rows\' kept 8333 of 10001 entries, the oldest; an assignment keeps at most 10000 per array and 50000 values, and drops values it cannot copy.';
  const warningKey = collectionTruncationWarningKey('lr-neighbor-list', 'rows');
  const store = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  const wasIssued = store?.has(warningKey);
  store?.delete(warningKey);
  const previousWarn = console.warn;
  let warningCount = 0;
  console.warn = (...args: unknown[]) => {
    if (args.length === 1 && args[0] === warning) warningCount++;
    else previousWarn.apply(console, args);
  };
  let el: LyraNeighborList | undefined;
  try {
    const rows = Array.from({ length: 10_001 }, (_, index) => ({ relation: 'related', direction: 'out' as const, node: { id: `n${index}`, label: 'Node' } }));
    el = await fixture<LyraNeighborList>(html`<lr-neighbor-list .rows=${rows}></lr-neighbor-list>`);
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.include('10,001');
    el.strings = { graphDataListLimit: 'Retained {shown} from {total}' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.include(`Retained ${el.rows.length.toLocaleString('en')} from 10,001`);
    el.rows = rows.slice(0, 1);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
    el.rows = rows;
    await el.updateComplete;
    expect(sinkTexts()).to.include(`Retained ${el.rows.length.toLocaleString('en')} from 10,001`);
  } finally {
    try {
      // Disconnect can schedule another render; keep the diagnostic captured through teardown.
      el?.remove();
      await el?.updateComplete;
    } finally {
      console.warn = previousWarn;
      if (wasIssued) store?.add(warningKey);
      else store?.delete(warningKey);
    }
  }
  expect(warningCount).to.equal(store ? 1 : 0);
});
