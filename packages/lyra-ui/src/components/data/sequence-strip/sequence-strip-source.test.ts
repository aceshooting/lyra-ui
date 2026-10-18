import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './sequence-strip.js';
import type { LyraSequenceStrip, SequenceStripItem } from './sequence-strip.class.js';
import type { LyraSequenceSource } from './sequence-strip-source.js';

const item = (index: number): SequenceStripItem => ({ id: `item-${index}`, categoryId: 'a', label: `Item ${index}`, marker: index === 999999 });
const source = (): LyraSequenceSource<SequenceStripItem> => ({ revision: 1, length: 1000000,
  getItem: index => item(index), findIndex: id => Number(id.slice(5)),
  summarize: () => [{ startIndex: 0, endIndex: 1000000, categoryCounts: { a: 1000000 }, markerCount: 1, enabledCount: 1000000 }],
});
describe('sequence complete source', () => {
  it('represents the full range and resolves the final exact item', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .strings=${{ sequenceStripSourceItemLabel: '{label}, item {index} of {total}' }} .source=${source()}></lr-sequence-strip>`);
    await waitUntil(() => el.shadowRoot!.querySelector('[data-range-end]')?.getAttribute('data-range-end') === '999999');
    expect(await el.revealSourceItem(999999)).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent).to.include('Item 999999');
  });
});

const ready = async (el: LyraSequenceStrip) => { await el.updateComplete; await waitUntil(() => !!el.shadowRoot!.querySelector('[data-range-start]')); await el.updateComplete; };
const smallSource = (): LyraSequenceSource<SequenceStripItem> => ({ revision: 1, length: 3,
  getItem: index => ({ id: `id-${index}`, categoryId: 'a', label: `Exact ${index}`, disabled: index === 1 }),
  findIndex: id => Number(id.slice(3)),
  summarize: () => [{ startIndex: 0, endIndex: 3, categoryCounts: { a: 3 }, markerCount: 0, enabledCount: 2 }],
});

describe('sequence source admission and actions', () => {
  for (const invalid of ['gap', 'overlap', 'count', 'unsafe', 'marker', 'enabled', 'accessor', 'budget', 'category-budget', 'category-text']) {
    it(`rejects ${invalid} summary without legacy fallback`, async () => {
      let getterReads = 0;
      const input = smallSource();
      input.summarize = () => {
        const ranges = [{ startIndex: 0, endIndex: 3, categoryCounts: { a: 3 } as Record<string, number>, markerCount: 0, enabledCount: 2 }];
        if (invalid === 'gap') ranges[0]!.startIndex = 1;
        if (invalid === 'overlap') ranges.push(ranges[0]!);
        if (invalid === 'count') ranges[0]!.categoryCounts = { a: 2 };
        if (invalid === 'unsafe') ranges[0]!.endIndex = Number.MAX_SAFE_INTEGER + 1;
        if (invalid === 'marker') ranges[0]!.markerCount = 4;
        if (invalid === 'enabled') ranges[0]!.enabledCount = 4;
        if (invalid === 'accessor') Object.defineProperty(ranges[0], 'markerCount', { get() { getterReads++; return 0; } });
        if (invalid === 'budget') return new Array(201);
        if (invalid === 'category-budget') ranges[0]!.categoryCounts = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [String(index), 1]));
        if (invalid === 'category-text') ranges[0]!.categoryCounts = { ['x'.repeat(1025)]: 3 };
        return ranges;
      };
      const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input} .items=${[{ id: 'legacy', categoryId: 'a', label: 'Legacy' }]}></lr-sequence-strip>`);
      await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
      expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(0);
      expect(getterReads).to.equal(0);
    });
  }

  it('keeps exact disabled items inspectable without activation and uses original IDs', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${smallSource()}></lr-sequence-strip>`);
    await ready(el); const events: unknown[] = [];
    el.addEventListener('lr-item-activate', event => events.push((event as CustomEvent).detail));
    expect(await el.revealSourceItem('id-1')).to.equal(true);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-exact"]')!.click();
    expect(events.length).to.equal(0);
    expect(await el.revealSourceItem(2)).to.equal(true);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-exact"]')!.click();
    expect(events).to.deep.equal([{ index: 2, id: 'id-2', item: { id: 'id-2', categoryId: 'a', label: 'Exact 2', disabled: false } }]);
    expect(el.selectedIndex).to.equal(-1);
  });

  it('activates a range first item rather than its previously inspected final item', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${smallSource()}></lr-sequence-strip>`);
    await ready(el); await el.revealSourceItem(2); const indices: number[] = [];
    el.addEventListener('lr-item-activate', event => indices.push((event as CustomEvent<{ index: number }>).detail.index));
    el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!.click();
    await waitUntil(() => indices.length === 1); expect(indices).to.deep.equal([0]);
  });

  it('fails a mismatched ID lookup and malformed exact item without activation', async () => {
    const input = smallSource(); input.findIndex = () => 0;
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
    await ready(el); expect(await el.revealSourceItem('wrong')).to.equal(false);
    let reads = 0;
    input.getItem = () => Object.defineProperty({ id: 'id-0', categoryId: 'a' }, 'label', { get() { reads++; return 'unsafe'; } });
    el.source = input; await ready(el);
    expect(await el.revealSourceItem(0)).to.equal(false); expect(reads).to.equal(0);
  });

  it('clears source precedence on null and undefined and rejects other invalid values', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${smallSource()} .items=${[{ id: 'legacy', categoryId: 'a', label: 'Legacy' }]}></lr-sequence-strip>`);
    await ready(el); el.source = null; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="cell"]')!.getAttribute('data-item-id')).to.equal('legacy');
    el.source = {} as LyraSequenceSource<SequenceStripItem>; await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(1);
    el.source = undefined as unknown as null; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="cell"]')!.getAttribute('data-item-id')).to.equal('legacy');
  });
});

describe('sequence source authority', () => {
  it('retains one physical exact permit and only the latest ignored-abort intent', async () => {
    const input = smallSource(); const reads: number[] = []; const releases: (() => void)[] = [];
    let active = 0; let peak = 0;
    input.getItem = index => new Promise(resolve => {
      reads.push(index); active++; peak = Math.max(peak, active);
      releases.push(() => { active--; resolve({ id: `id-${index}`, categoryId: 'a', label: `Exact ${index}` }); });
    });
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`); await ready(el);
    const first = el.revealSourceItem(0); await waitUntil(() => releases.length === 1);
    const middle = el.revealSourceItem(1); const last = el.revealSourceItem(2);
    expect(await first).to.equal(false); expect(await middle).to.equal(false);
    releases.shift()!(); await waitUntil(() => reads.length === 2); expect(reads).to.deep.equal([0, 2]);
    releases.shift()!(); expect(await last).to.equal(true); expect(peak).to.equal(1);
  });

  it('revokes stale exact and overview controls immediately on provider replacement', async () => {
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${smallSource()}></lr-sequence-strip>`); await ready(el);
    await el.revealSourceItem(0);
    const exact = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-exact"]')!;
    const range = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
    let events = 0; el.addEventListener('lr-item-activate', () => events++);
    el.source = smallSource(); exact.click(); range.click(); await ready(el);
    expect(events).to.equal(0);
  });

  it('does not invoke a provider method returned by a getter that replaced its source', async () => {
    const input = smallSource(); let methodReads = 0; let staleCalls = 0;
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip></lr-sequence-strip>`);
    Object.defineProperty(input, 'getItem', { get() {
      methodReads++;
      if (methodReads > 1) el.source = smallSource();
      return () => { staleCalls++; return { id: 'bad', categoryId: 'a' }; };
    } });
    el.source = input; await ready(el);
    expect(await el.revealSourceItem(0)).to.equal(false); await ready(el); expect(staleCalls).to.equal(0);
  });

  it('preserves the newest exact request issued by an abort listener', async () => {
    const input = smallSource(); const reads: number[] = []; let release!: () => void;
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip></lr-sequence-strip>`);
    let newest: Promise<boolean> | undefined;
    input.getItem = (index, request) => {
      reads.push(index);
      if (index === 0) return new Promise(resolve => {
        release = () => resolve({ id: 'id-0', categoryId: 'a' });
        request.signal.addEventListener('abort', () => { newest = el.revealSourceItem(2); }, { once: true });
      });
      return { id: `id-${index}`, categoryId: 'a' };
    };
    el.source = input; await ready(el);
    const old = el.revealSourceItem(0); await waitUntil(() => !!release);
    const superseded = el.revealSourceItem(1); expect(await old).to.equal(false);
    release(); await waitUntil(() => reads.length === 2);
    expect(reads).to.deep.equal([0, 2]); expect(await superseded).to.equal(false); expect(await newest!).to.equal(true);
  });

  for (const lifecycle of ['reconnect', 'adoption', 'locale']) {
    it(`accepts only the current summary after ${lifecycle}`, async () => {
      const input = smallSource(); const replies: ((value: readonly import('./sequence-strip-source.js').LyraSequenceRangeSummary[]) => void)[] = [];
      input.summarize = () => new Promise(resolve => replies.push(resolve));
      const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
      await waitUntil(() => replies.length === 1);
      let frame: HTMLIFrameElement | undefined;
      try {
        if (lifecycle === 'reconnect') { const parent = el.parentNode!; el.remove(); parent.appendChild(el); }
        else if (lifecycle === 'adoption') { frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`); frame.contentDocument!.adoptNode(el); frame.contentDocument!.body.appendChild(el); }
        else { el.locale = 'fr'; await el.updateComplete; }
        replies[0]!([{ startIndex: 0, endIndex: 3, categoryCounts: { obsolete: 3 }, markerCount: 0, enabledCount: 3 }]);
        await waitUntil(() => replies.length === 2);
        expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(0);
        replies[1]!([{ startIndex: 0, endIndex: 3, categoryCounts: { a: 3 }, markerCount: 1, enabledCount: 3 }]);
        await ready(el); expect(el.shadowRoot!.querySelectorAll('[part="marker"]').length).to.equal(1);
        expect(replies.length).to.equal(2);
      } finally { if (frame) { el.remove(); frame.remove(); } }
    });
  }
});

describe('sequence exact navigation and focus', () => {
  it('starts the overview tab stop on an enabled range', async () => {
    const input = smallSource(); input.summarize = () => [
      { startIndex: 0, endIndex: 1, categoryCounts: { a: 1 }, markerCount: 0, enabledCount: 0 },
      { startIndex: 1, endIndex: 3, categoryCounts: { a: 2 }, markerCount: 0, enabledCount: 2 },
    ];
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`); await ready(el);
    expect(el.shadowRoot!.querySelector('[part="cell"][tabindex="0"]')!.getAttribute('data-index')).to.equal('1');
  });

  it('does not steal focus after it moves outside during exact resolution', async () => {
    const input = smallSource(); let release!: (value: SequenceStripItem) => void;
    input.getItem = () => new Promise(resolve => { release = resolve; });
    const wrapper = await fixture<HTMLDivElement>(html`<div><button id="before">Before</button><lr-sequence-strip .source=${input}></lr-sequence-strip><button id="after">After</button></div>`);
    const el = wrapper.querySelector<LyraSequenceStrip>('lr-sequence-strip')!; await ready(el);
    await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('#before')!);
    const pending = el.revealSourceItem(2); await waitUntil(() => !!release);
    await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('#after')!);
    release({ id: 'id-2', categoryId: 'a' }); expect(await pending).to.equal(true);
    expect(document.activeElement?.id).to.equal('after');
  });
});

describe('sequence source refresh and localization', () => {
  it('uses bound English messages and instance overrides without requerying for paints', async () => {
    const input = smallSource(); let summaries = 0; const summarize = input.summarize;
    input.summarize = request => { summaries++; return summarize(request); };
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`); await ready(el);
    expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent).to.include('Sequence item unavailable.');
    await el.revealSourceItem(2);
    expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent).to.include('Exact 2, item 3 of 3');
    el.strings = { sequenceStripSourceItemLabel: '{index}/{total}: {label}' }; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent).to.include('3/3: Exact 2');
    expect(summaries).to.equal(1);
    el.source = input; await ready(el); expect(summaries).to.equal(2);
    el.requestUpdate(); el.requestUpdate('strings'); await ready(el); expect(summaries).to.equal(3);
  });

  it('maps controlled selection and source ties without emitting activation', async () => {
    const input = smallSource(); input.summarize = () => [{ startIndex: 0, endIndex: 3, categoryCounts: { a: 1, b: 1, c: 1 }, markerCount: 0, enabledCount: 3 }];
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input} .categories=${[{ id: 'b', color: 'rgb(1, 2, 3)', label: 'Preferred' }]}></lr-sequence-strip>`); await ready(el);
    let events = 0; el.addEventListener('lr-item-activate', () => events++);
    el.selectedIndex = 2; await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent!.includes('Exact 2'));
    expect(el.shadowRoot!.querySelector('[part="cell"]')!.getAttribute('aria-current')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[part="cell"]')!.getAttribute('aria-label')).to.include('Preferred');
    expect(events).to.equal(0);
  });
});

it('fails a throwing metadata read once and waits for explicit retry', async () => {
  const input = smallSource(); let reads = 0;
  Object.defineProperty(input, 'revision', { get() { reads++; if (reads === 1) throw new Error('private metadata'); return 1; } });
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(1);
  expect(reads).to.equal(1);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click(); await ready(el);
});

it('closes the source keyboard tooltip when focus leaves the strip', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><lr-sequence-strip .source=${smallSource()}></lr-sequence-strip><button>Outside</button></div>`);
  const el = wrapper.querySelector<LyraSequenceStrip>('lr-sequence-strip')!; await ready(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!); await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(1);
  await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('button')!); await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(0);
});

it('keeps a mixed range truthful when its first exact item is disabled', async () => {
  const input = smallSource(); input.getItem = index => ({ id: String(index), categoryId: 'a', disabled: index === 0 });
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`); await ready(el);
  let events = 0; el.addEventListener('lr-item-activate', () => events++);
  el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!.click();
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent!.includes('item 1 of 3'));
  expect(events).to.equal(0); expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.getAttribute('aria-disabled')).to.equal('true');
});

it('keeps the source view accessible with a narrow allocation and long exact label', async () => {
  const input = smallSource(); input.getItem = () => ({ id: 'long', categoryId: 'a', label: 'Long word '.repeat(80) });
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip style="width:320px" .source=${input}></lr-sequence-strip>`); await ready(el);
  await el.revealSourceItem(0);
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="source-exact"]')!;
  expect(button.getBoundingClientRect().width).to.be.at.most(320);
  await expect(el).to.be.accessible();
});

it('advances past an unavailable exact position without compacting indices', async () => {
  const reads: number[] = []; const input = smallSource();
  input.getItem = index => { reads.push(index); return index === 1 ? null : { id: String(index), categoryId: 'a' }; };
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`); await ready(el);
  await el.revealSourceItem(0);
  const exact = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-exact"]')!;
  await focusByKeyboard(exact);
  await sendKeys({ press: 'ArrowRight' }); await waitUntil(() => reads.length === 2); await el.updateComplete;
  await sendKeys({ press: 'ArrowRight' }); await waitUntil(() => reads.length === 3); await el.updateComplete;
  expect(reads).to.deep.equal([0, 1, 2]);
});

it('keeps a newer explicit reveal ahead of an earlier controlled selection write', async () => {
 const reads: number[] = [];
 const source: LyraSequenceSource<SequenceStripItem> = {revision: 1, length: 3,
 getItem: index => {reads.push(index); return {id: `i${index}`, categoryId: 'a', label: `Exact ${index}`};}, findIndex: () => null,
 summarize: () => [{startIndex: 0, endIndex: 3, categoryCounts: {a: 3}, markerCount: 0, enabledCount: 3}]};
 const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${source}></lr-sequence-strip>`);
 await waitUntil(() => !!el.shadowRoot!.querySelector('[data-range-start]')); await el.updateComplete;
 let events = 0; el.addEventListener('lr-item-activate', () => events++);
 el.selectedIndex = 1;
 const latest = el.revealSourceItem(2);
 expect(await latest).to.equal(true);
 await el.updateComplete;
 expect(el.shadowRoot!.querySelector('[part="source-exact"]')!.textContent).to.include('Exact 2');
 expect(el.selectedIndex).to.equal(1); expect(events).to.equal(0);
});

it('keeps a keyboard-reachable fallback while the first summary is pending', async () => {
 let release!: (value: readonly import('./sequence-strip-source.js').LyraSequenceRangeSummary[]) => void;
 const source: LyraSequenceSource<SequenceStripItem> = {revision: 1, length: 1, getItem: () => null, findIndex: () => null, summarize: () => new Promise(resolve => {release = resolve;})};
 const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${source}></lr-sequence-strip>`);
 await waitUntil(() => !!release); await el.updateComplete;
 try {
  const controls = [...el.shadowRoot!.querySelectorAll<HTMLElement>('button, input, a[href], [tabindex]')].filter(node => node.tabIndex >= 0 && !node.hasAttribute('disabled'));
  expect(controls.length).to.be.greaterThan(0);
 } finally {release([{startIndex: 0, endIndex: 1, categoryCounts: {a: 1}, markerCount: 0, enabledCount: 1}]);}
});

for (const state of ['empty', 'error'] as const) {
  it(`keeps a named fallback reachable for a ${state} source`, async () => {
    const input = smallSource();
    if (state === 'empty') Object.defineProperty(input, 'length', { value: 0 });
    else input.summarize = () => { throw new Error('unavailable'); };
    const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${input}></lr-sequence-strip>`);
    await waitUntil(() => !!el.shadowRoot!.querySelector(state === 'empty' ? '[part="empty"]' : '[part="source-retry"]'));
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.tabIndex).to.equal(0);
    expect(base.getAttribute('aria-label')).to.be.a('string').and.not.equal('');
    await focusByKeyboard(base);
    expect(el.shadowRoot!.activeElement === base).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('[part="source-exact"]').length).to.equal(0);
  });
}

it('lets a later controlled selection supersede an earlier reveal', async () => {
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .source=${smallSource()}></lr-sequence-strip>`);
  await ready(el);
  const earlier = el.revealSourceItem(2);
  el.selectedIndex = 1;
  expect(await earlier).to.equal(false);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-exact"]')?.textContent?.includes('Exact 1') === true);
});
