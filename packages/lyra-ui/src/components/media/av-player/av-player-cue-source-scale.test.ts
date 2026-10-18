import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './av-player.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
expectLocaleFallback('tr', ['avPlayerLabel', 'avPlayerPlaybackRate', 'avPlayerPosition', 'avPlayerRateOption',
  'avPlayerTimeline', 'avPlayerTranscript', 'loading', 'sourceSearchUnavailable']);
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import type { LyraAvPlayer, LyraAvCue, LyraAvCueSource, LyraAvActiveCue } from './av-player.class.js';
import type { AvCueSourceController } from './av-player-cue-source-controller.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';

(globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> }).litIssuedWarnings?.add('virtual-list-scroll-scaling');
const cueAt = (index: number): LyraAvCue => ({ cueId: `cue-${index}`, start: index, end: index + 1, text: `Cue ${index}` });
function provider(overrides: Partial<LyraAvCueSource> = {}): LyraAvCueSource {
  return { revision: 'one', count: 1_000_000,
    getCue: cueAt,
    findCue: id => { const index = Number(id.slice(4)); return { index, cue: cueAt(index) }; },
    activeAt: time => {
      const index = Math.floor(time);
      return index < 1_000_000 ? { index, cue: cueAt(index), validFrom: index, validUntil: index + 1 }
        : { index: null, cue: null, validFrom: 1_000_000, validUntil: Infinity };
    },
    search: () => ({ count: 0, getMatch: () => { throw new Error('No matches'); } }), ...overrides };
}
function control(element: LyraAvPlayer): AvCueSourceController {
  return (element as unknown as { cueSourceController: AvCueSourceController }).cueSourceController;
}
function listOf(element: LyraAvPlayer): LyraVirtualList {
  return element.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
}
async function mount(source: LyraAvCueSource): Promise<{ element: LyraAvPlayer; media: HTMLMediaElement }> {
  const element = await fixture<LyraAvPlayer>(html`<lr-av-player kind="audio" .cueSource=${source}></lr-av-player>`);
  const media = element.shadowRoot!.querySelector<HTMLMediaElement>('[part="media"]')!;
  Object.defineProperty(media, 'duration', { configurable: true, value: 1_000_000 });
  Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
  media.dispatchEvent(new Event('loadedmetadata'));
  await element.updateComplete;
  return { element, media };
}
async function active(element: LyraAvPlayer, index: number): Promise<void> {
  await waitUntil(() => control(element).active?.index === index, 'active source cue');
}

it('reads initial, middle and final million-cue rows with bounded cache, DOM and tick work', async () => {
  let reads = 0, queries = 0, legacyReads = 0;
  const indices = new Set<number>();
  const source = provider({ getCue: index => { reads++; indices.add(index); return cueAt(index); },
    activeAt: time => { queries++; return provider().activeAt(time, { signal: new AbortController().signal }); } });
  const { element, media } = await mount(source);
  Object.defineProperty(element, 'cues', { configurable: true, get: () => { legacyReads++; throw new Error('Legacy cue read'); } });
  const list = listOf(element);
  expect((list.source as { count: number }).count).to.equal(1_000_000);
  await active(element, 0);
  const events: { cueId: string | null; index: number }[] = [];
  element.addEventListener('lr-cue-change', event => events.push(event.detail));
  for (const index of [500_000, 999_999]) {
    element.seek(index + 0.1);
    await active(element, index);
    await waitUntil(() => list.shadowRoot!.textContent!.includes(`Cue ${index}`), 'remote row reveal');
  }
  const beforeQueries = queries, beforeReads = reads;
  for (let tick = 0; tick < 100; tick++) {
    media.currentTime = 999_999.1 + tick / 1000;
    media.dispatchEvent(new Event('timeupdate'));
  }
  await element.updateComplete;
  expect(queries - beforeQueries).to.equal(0);
  expect(legacyReads).to.equal(0);
  expect([...indices].includes(999_999)).to.equal(true);
  expect(events.at(-1)).to.deep.equal({ cueId: 'cue-999999', index: 999_999 });
  const cache = control(element).window as unknown as { pages: Map<number, { slots?: unknown[] }> };
  const cachedRows = [...cache.pages.values()].reduce((n, page) => n + (page.slots?.length ?? 0), 0);
  expect(cachedRows).to.be.at.most(128);
  expect(renderedNodeCount(element)).to.be.at.most(300);
  recordScaleMeasurement('lr-av-player', 'cue-source@1000000', { logicalCues: 1_000_000, getCueCalls: reads,
    activeAtCalls: queries, cachedRows, domNodes: renderedNodeCount(element), ticks: 100, tickQueries: queries - beforeQueries, tickReads: reads - beforeReads });
});

it('holds two physical getCue permits across ignored abort and stops each revoked page before its next row', async () => {
  const pending: { index: number; settle: (cue: LyraAvCue) => void }[] = [];
  let running = 0, maximum = 0, calls = 0;
  const { element } = await mount(provider({ activeAt: () => ({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }),
    getCue: index => { calls++; running++; maximum = Math.max(maximum, running); return new Promise<LyraAvCue>(resolve => {
      pending.push({ index, settle: cue => { running--; resolve(cue); } });
    }); } }));
  const window = control(element).window;
  window.requestRange(0, 64);
  await waitUntil(() => pending.length === 2);
  window.requestRange(500_000, 500_064);
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(calls).to.equal(2);
  pending.shift()!.settle(cueAt(0));
  await waitUntil(() => calls === 3);
  expect(maximum).to.equal(2);
  element.remove();
  while (pending.length) { const row = pending.shift()!; row.settle(cueAt(row.index)); }
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(calls).to.equal(3);
  recordScaleMeasurement('lr-av-player', 'cue-source-permits@1000000', { getCueCalls: calls, maxPhysicalGetCue: maximum });
});

it('coalesces activeAt, retains ignored-abort permits and rejects obsolete answers', async () => {
  const pending: { time: number; settle: (value: unknown) => void }[] = [];
  let calls = 0, running = 0, maximum = 0;
  const { element, media } = await mount(provider({ activeAt: time => {
    calls++; running++; maximum = Math.max(maximum, running);
    return new Promise(resolve => pending.push({ time, settle: value => { running--; resolve(value as never); } }));
  } }));
  await waitUntil(() => calls === 1);
  for (const time of [10, 20, 30]) { media.currentTime = time; media.dispatchEvent(new Event('timeupdate')); }
  element.seek(40);
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(calls).to.equal(1);
  pending.shift()!.settle({ index: 0, cue: cueAt(0), validFrom: 0, validUntil: 1 });
  await waitUntil(() => calls === 2);
  expect(pending[0]!.time).to.equal(40);
  expect(control(element).active).to.equal(undefined);
  pending.shift()!.settle({ index: 40, cue: cueAt(40), validFrom: 40, validUntil: 41 });
  await active(element, 40);
  element.seek(40.5);
  await waitUntil(() => calls === 3);
  pending.shift()!.settle({ index: 40, cue: cueAt(40), validFrom: 40, validUntil: 41 });
  await active(element, 40);
  expect(maximum).to.equal(1);
  recordScaleMeasurement('lr-av-player', 'cue-active-permits@1000000', { activeAtCalls: calls, maxPhysicalActiveAt: maximum });
});

it('keeps legacy transcript/search behavior when cueSource is unset and restores it when cleared', async () => {
  const element = await fixture<LyraAvPlayer>(html`<lr-av-player .cues=${[cueAt(0), cueAt(1)]}></lr-av-player>`);
  expect(element.cueSource).to.equal(null);
  expect(await element.search('Cue')).to.equal(2);
  expect(await element.searchPrevious()).to.equal(true);
  element.cueSource = provider();
  await element.updateComplete;
  expect((listOf(element).source as { count: number }).count).to.equal(1_000_000);
  element.cueSource = null;
  await element.updateComplete;
  expect(await element.search('Cue')).to.equal(2);
});

it('rejects null positions, duplicate IDs and contradictory active replies with localized states', async () => {
  const { element } = await mount(provider({ count: 64, getCue: () => null,
    activeAt: () => ({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }) }));
  await waitUntil(() => element.shadowRoot!.textContent!.includes('Transcript data is unavailable.'));
  expect((listOf(element).source as { count: number }).count).to.equal(64);
  await waitUntil(() => listOf(element).shadowRoot!.textContent!.includes('Transcript data is unavailable.'));
  expect(listOf(element).shadowRoot!.querySelectorAll('button[part~="cue"]').length).to.equal(0);
  element.strings = { avPlayerTranscriptUnavailable: 'Transcript indisponible' };
  await element.updateComplete;
  await listOf(element).updateComplete;
  expect(listOf(element).shadowRoot!.textContent).to.contain('Transcript indisponible');
  element.cueSource = provider({ count: 64, getCue: () => cueAt(0),
    activeAt: () => ({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }) });
  await element.updateComplete;
  await waitUntil(() => control(element).unavailable);
  element.cueSource = provider({ count: 64, activeAt: () => ({ index: 0, cue: { ...cueAt(0), text: 'contradiction' }, validFrom: 0, validUntil: 1 }) });
  await element.updateComplete;
  await waitUntil(() => control(element).unavailable);
});

it('invalidates old row actions on replacement, same-reference rebind and keyless refresh', async () => {
  const source = provider({ count: 64 });
  const { element, media } = await mount(source);
  await active(element, 0);
  await waitUntil(() => !!listOf(element).shadowRoot!.querySelector('button[part~="cue"]'));
  const oldButton = listOf(element).shadowRoot!.querySelector<HTMLButtonElement>('button[part~="cue"]')!;
  media.currentTime = 25;
  element.cueSource = source;
  oldButton.click();
  expect(media.currentTime).to.equal(25);
  await element.updateComplete;
  await active(element, 25);
  await waitUntil(() => !!listOf(element).shadowRoot!.querySelector('button[part~="cue"]'));
  const currentButton = listOf(element).shadowRoot!.querySelector<HTMLButtonElement>('button[part~="cue"]')!;
  element.requestUpdate();
  currentButton.click();
  expect(media.currentTime).to.equal(25);
  await element.updateComplete;
  await active(element, 25);
  element.cueSource = provider({ count: 64, getCue: index => ({ ...cueAt(index), cueId: `new-${index}` }),
    activeAt: time => { const index = Math.floor(time); return { index, cue: { ...cueAt(index), cueId: `new-${index}` }, validFrom: index, validUntil: index + 1 }; } });
  await element.updateComplete;
  await waitUntil(() => control(element).active?.cue.cueId === 'new-25');
  oldButton.click();
  expect(media.currentTime).to.equal(25);
});

it('rejects reentrant source capture and active-change callbacks before further effects', async () => {
  const replacement = provider({ revision: 'new', count: 64 });
  const { element } = await mount(provider({ count: 64 }));
  const input = new Proxy(provider(), { getOwnPropertyDescriptor(target, key) {
    if (key === 'getCue') element.cueSource = replacement;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  element.cueSource = input;
  await waitUntil(() => element.cueSource === replacement && control(element).count === 64);
  const obsolete: { cueId: string | null; index: number }[] = [];
  element.addEventListener('lr-cue-change', event => {
    obsolete.push(event.detail);
    if (event.detail.index === 30) element.cueSource = provider({ revision: 'after-event', count: 0,
      activeAt: () => ({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }) });
  });
  element.seek(30);
  await waitUntil(() => control(element).count === 0);
  expect(element.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
  expect(obsolete.some(event => event.index === 30)).to.equal(true);
});

it('clears source state across disconnect and iframe adoption, then rebinds in the new owner', async () => {
  let calls = 0;
  const source = provider({ count: 64, activeAt: time => { calls++; return provider({ count: 64 }).activeAt(time, { signal: new AbortController().signal }); } });
  const { element } = await mount(source);
  await active(element, 0);
  const container = element.parentElement!;
  element.remove();
  expect(control(element).active).to.equal(undefined);
  container.append(element);
  await active(element, 0);
  const before = calls;
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    frame.contentDocument!.body.append(frame.contentDocument!.adoptNode(element));
    await active(element, 0);
    expect(calls).to.be.greaterThan(before);
    expect(element.ownerDocument === frame.contentDocument).to.equal(true);
  } finally { element.remove(); frame.remove(); }
});

it('uses provider overlap/tie/no-active intervals and full original cue indices without duration clamping', async () => {
  const cues = [
    { cueId: 'long', start: 2, end: 30, text: 'long' },
    { cueId: 'short', start: 10, end: 15, text: 'short' },
    { cueId: 'tie', start: 10, end: 12, text: 'tie' },
  ];
  const boundaries = [0, 2, 10, 12, 15, 30, Infinity];
  const answers = [-1, 0, 2, 1, 0, -1];
  const { element, media } = await mount(provider({ count: cues.length, getCue: index => cues[index]!,
    activeAt: time => {
      const interval = boundaries.findIndex((value, index) => time >= value && time < boundaries[index + 1]!);
      const index = answers[interval]!;
      return { index: index < 0 ? null : index, cue: cues[index] ?? null, validFrom: boundaries[interval]!, validUntil: boundaries[interval + 1]! };
    } }));
  const events: { cueId: string | null; index: number }[] = [];
  element.addEventListener('lr-cue-change', event => events.push(event.detail));
  for (const time of [2, 10, 12, 15, 30, 10]) {
    element.seek(time);
    await waitUntil(() => control(element).active?.index === (time === 2 || time === 15 ? 0 : time === 10 ? 2 : time === 12 ? 1 : undefined));
  }
  expect(events).to.deep.equal([{ cueId: 'long', index: 0 }, { cueId: 'tie', index: 2 },
    { cueId: 'short', index: 1 }, { cueId: 'long', index: 0 }, { cueId: null, index: -1 }, { cueId: 'tie', index: 2 }]);
  Object.defineProperty(media, 'duration', { configurable: true, value: 5 });
  media.currentTime = 5;
  element.cueSource = provider({ activeAt: () => ({ index: 10, cue: cueAt(10), validFrom: 0, validUntil: 20 }) });
  await element.updateComplete;
  await waitUntil(() => control(element).unavailable);
  expect(control(element).active).to.equal(undefined);
});

it('bounds key lookup and cancels logically while an ignored-abort findCue keeps its permit', async () => {
  let calls = 0;
  const pending: { id: string; resolve: (value: unknown) => void }[] = [];
  const { element } = await mount(provider({ findCue: id => { calls++; return new Promise(resolve => pending.push({ id, resolve: value => resolve(value as never) })); } }));
  const window = control(element).window;
  const old = window.resolveKey('cue-999999');
  await waitUntil(() => calls === 1);
  const latest = window.resolveKey('cue-500000');
  expect(await old).to.equal(null);
  expect(calls).to.equal(1);
  pending.shift()!.resolve({ index: 999999, cue: cueAt(999999) });
  await waitUntil(() => calls === 2);
  expect(pending[0]!.id).to.equal('cue-500000');
  pending.shift()!.resolve({ index: 500000, cue: cueAt(500000) });
  expect(await latest).to.equal(500000);
  const mismatch = window.resolveKey('wrong-id');
  await waitUntil(() => calls === 3);
  pending.shift()!.resolve({ index: 500000, cue: cueAt(500000) });
  expect(await mismatch).to.equal(null);
});


it('revokes an outstanding answer when playback returns to a completed interval', async () => {
  const cue = (index: number): LyraAvCue => ({ cueId: `c${index}`, start: index * 10, end: index * 10 + 10, text: `Cue ${index}` });
  let release!: (answer: LyraAvActiveCue) => void;
  let signal: AbortSignal | undefined;
  let calls = 0;
  const source = provider({ count: 3, getCue: cue, activeAt: (time, request) => {
    calls++;
    if (time < 10) return { index: 0, cue: cue(0), validFrom: 0, validUntil: 10 };
    signal = request.signal;
    return new Promise(resolve => { release = resolve; });
  } });
  const { element, media } = await mount(source);
  const list = listOf(element);
  await waitUntil(() => list.activeItemId === 'c0');
  const events: unknown[] = [];
  element.addEventListener('lr-cue-change', event => events.push(event.detail));
  media.currentTime = 20;
  media.dispatchEvent(new Event('timeupdate'));
  await waitUntil(() => !!release);
  media.currentTime = 5;
  media.dispatchEvent(new Event('timeupdate'));
  release({ index: 2, cue: cue(2), validFrom: 20, validUntil: 30 });
  await new Promise(resolve => setTimeout(resolve, 40));
  await element.updateComplete;
  expect(calls).to.equal(2);
  expect(events.length).to.equal(0);
  expect(list.activeItemId).to.equal('c0');
  expect(signal!.aborted).to.equal(true);
});

it('searches the full million-cue source and wraps final match navigation without seeking media', async () => {
  let searches = 0, matches = 0;
  const source = provider({ search: (query, request) => {
    searches++;
    expect(query).to.equal('Cue');
    expect(request.locale).to.equal('en');
    return { count: 1_000_000, getMatch: index => { matches++; return { index, cue: cueAt(index) }; } };
  } });
  const { element, media } = await mount(source);
  await active(element, 0);
  media.currentTime = 42;
  const events: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }[] = [];
  element.addEventListener('lr-search-change', event => events.push(event.detail));
  expect(await element.search('  Cue  ')).to.equal(1_000_000);
  expect(await element.searchPrevious()).to.equal(true);
  expect(events.at(-1)).to.deep.equal({ query: 'Cue', matchCount: 1_000_000, matchCountExact: true, activeIndex: 999_999 });
  await waitUntil(() => listOf(element).shadowRoot!.textContent!.includes('Cue 999999'));
  expect(media.currentTime).to.equal(42);
  expect(await element.searchNext()).to.equal(true);
  expect(events.at(-1)!.activeIndex).to.equal(0);
  expect(searches).to.equal(1);
  expect(matches).to.equal(3);
  recordScaleMeasurement('lr-av-player', 'cue-source-search@1000000', { exactMatches: 1_000_000, searchCalls: searches, getMatchCalls: matches });
});

it('coalesces source search with prompt cancellation and one physical ignored-abort call', async () => {
  let calls = 0, running = 0, maximum = 0;
  const pending: { query: string; signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
  const { element } = await mount(provider({ search: (query, request) => {
    calls++; running++; maximum = Math.max(maximum, running);
    return new Promise(resolve => pending.push({ query, signal: request.signal, resolve: value => { running--; resolve(value as never); } }));
  } }));
  const events: unknown[] = [];
  element.addEventListener('lr-search-change', event => events.push(event.detail));
  const old = element.search('old');
  await waitUntil(() => calls === 1);
  const middle = element.search('middle');
  const latest = element.search('Cue');
  expect(await old).to.equal(0);
  expect(await middle).to.equal(0);
  expect(pending[0]!.signal.aborted).to.equal(true);
  expect(calls).to.equal(1);
  pending.shift()!.resolve({ count: 0, getMatch: () => ({ index: 0, cue: cueAt(0) }) });
  await waitUntil(() => calls === 2);
  expect(pending[0]!.query).to.equal('Cue');
  pending.shift()!.resolve({ count: 1_000_000, getMatch: (index: number) => ({ index, cue: cueAt(index) }) });
  expect(await latest).to.equal(1_000_000);
  expect(events.length).to.equal(1);
  expect(maximum).to.equal(1);
  recordScaleMeasurement('lr-av-player', 'cue-search-permits@1000000', { searchCalls: calls, maxPhysicalSearch: maximum, committedEvents: events.length });
});

it('holds the match permit through ignored abort, wraps latest navigation and clears promptly', async () => {
  let calls = 0, running = 0, maximum = 0;
  const pending: { index: number; resolve: (value: unknown) => void }[] = [];
  const { element, media } = await mount(provider({ search: () => ({ count: 1_000_000, getMatch: index => {
    calls++; running++; maximum = Math.max(maximum, running);
    if (index === 0) { running--; return { index, cue: cueAt(index) }; }
    return new Promise(resolve => pending.push({ index, resolve: value => { running--; resolve(value as never); } }));
  } }) }));
  expect(await element.search('Cue')).to.equal(1_000_000);
  const events: { activeIndex: number; matchCount: number }[] = [];
  element.addEventListener('lr-search-change', event => events.push(event.detail));
  const old = element.searchNext();
  await waitUntil(() => calls === 2);
  const latest = element.searchPrevious();
  expect(await old).to.equal(false);
  expect(calls).to.equal(2);
  pending.shift()!.resolve({ index: 1, cue: cueAt(1) });
  expect(await latest).to.equal(true);
  expect(events.map(event => event.activeIndex)).to.deep.equal([0]);
  const canceled = element.searchNext();
  await waitUntil(() => pending.length === 1);
  element.clearSearch();
  expect(await canceled).to.equal(false);
  pending.shift()!.resolve({ index: 1, cue: cueAt(1) });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(events.map(event => event.activeIndex)).to.deep.equal([0, -1]);
  expect(await element.searchNext()).to.equal(false);
  expect(media.currentTime).to.equal(0);
  expect(maximum).to.equal(1);
  recordScaleMeasurement('lr-av-player', 'cue-match-permits@1000000', { getMatchCalls: calls, maxPhysicalGetMatch: maximum, committedEvents: events.length });
});

it('rejects malformed handles and nonmatching or contradictory matches without false exact-zero events', async () => {
  let response: unknown = { count: 2, getMatch: (index: number) => ({ index, cue: cueAt(index) }) };
  const { element } = await mount(provider({ count: 64, search: () => response as never }));
  expect(await element.search('Cue')).to.equal(2);
  const events: unknown[] = [];
  element.addEventListener('lr-search-change', event => events.push(event.detail));
  let getterReads = 0;
  for (const value of [
    { count: 65, getMatch: () => ({ index: 0, cue: cueAt(0) }) },
    { count: 1, get getMatch() { getterReads++; return () => ({ index: 0, cue: cueAt(0) }); } },
    { count: 1, getMatch: () => ({ index: -1, cue: cueAt(0) }) },
    { count: 1, getMatch: () => ({ index: 1, cue: { ...cueAt(1), text: 'no match' } }) },
    { count: 1, getMatch: () => ({ index: 0, cue: { ...cueAt(0), text: 'Cue contradiction' } }) },
  ]) {
    response = value;
    expect(await element.search('Cue')).to.equal(0);
    expect(await element.searchNext()).to.equal(false);
  }
  expect(getterReads).to.equal(0);
  expect(events.length).to.equal(0);
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.contain('Search is unavailable for this data source.');
  element.strings = { sourceSearchUnavailable: 'Recherche indisponible' };
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.contain('Recherche indisponible');
  response = { count: 0, getMatch: () => { throw new Error('No result'); } };
  expect(await element.search('absent')).to.equal(0);
  expect(events.length).to.equal(1);
});

it('cancels pending reveal before stale navigation can scroll or highlight a row', async () => {
  const pending: { index: number; resolve: (cue: LyraAvCue) => void }[] = [];
  const { element } = await mount(provider({ getCue: index => index < 32 ? cueAt(index) : new Promise(resolve => pending.push({ index, resolve })),
    activeAt: () => ({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }),
    search: () => ({ count: 1, getMatch: () => ({ index: 500_000, cue: cueAt(500_000) }) }) }));
  const list = listOf(element);
  let scrolls = 0;
  const original = list.scrollToIndex;
  list.scrollToIndex = function (...args) { scrolls++; return original.apply(this, args); };
  const search = element.search('Cue');
  await waitUntil(() => pending.length > 0);
  element.clearSearch();
  expect(await search).to.equal(0);
  while (pending.length) { const item = pending.shift()!; item.resolve(cueAt(item.index)); }
  element.remove();
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(scrolls).to.equal(0);
  expect(list.shadowRoot!.querySelectorAll('[data-active-match]').length).to.equal(0);
});

it('preserves newer search intent from provider and committed-event reentry', async () => {
  let element!: LyraAvPlayer;
  let newer: Promise<number> | undefined;
  const mounted = await mount(provider({ count: 64, search: query => {
    if (query === 'old') {
      newer = element.search('Cue');
      return { count: 0, getMatch: () => ({ index: 0, cue: cueAt(0) }) };
    }
    return { count: 64, getMatch: index => ({ index, cue: cueAt(index) }) };
  } }));
  element = mounted.element;
  const events: string[] = [];
  element.addEventListener('lr-search-change', event => {
    events.push(event.detail.query);
    if (event.detail.query === 'Cue') element.clearSearch();
  });
  expect(await element.search('old')).to.equal(0);
  await waitUntil(() => newer !== undefined);
  expect(await newer).to.equal(0);
  expect(events).to.deep.equal(['Cue', '']);
  expect(await element.searchNext()).to.equal(false);
});

it('settles pending search/navigation on source rebind, disconnection and adoption', async () => {
  let resolveSearch!: (value: unknown) => void;
  const { element } = await mount(provider({ search: () => new Promise(resolve => { resolveSearch = value => resolve(value as never); }) }));
  const old = element.search('Cue');
  await waitUntil(() => !!resolveSearch);
  element.cueSource = provider();
  expect(await old).to.equal(0);
  resolveSearch({ count: 1, getMatch: () => ({ index: 0, cue: cueAt(0) }) });
  await element.updateComplete;
  let resolveMatch!: (value: unknown) => void;
  element.cueSource = provider({ search: () => ({ count: 1, getMatch: () => new Promise(resolve => { resolveMatch = value => resolve(value as never); }) }) });
  await element.updateComplete;
  const pending = element.search('Cue');
  await waitUntil(() => !!resolveMatch);
  const parent = element.parentElement!;
  element.remove();
  expect(await pending).to.equal(0);
  resolveMatch({ index: 0, cue: cueAt(0) });
  parent.append(element);
  await element.updateComplete;
  const adopted = element.search('Cue');
  await new Promise(resolve => setTimeout(resolve, 20));
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    frame.contentDocument!.body.append(frame.contentDocument!.adoptNode(element));
    expect(await adopted).to.equal(0);
  } finally { element.remove(); frame.remove(); resolveMatch({ index: 0, cue: cueAt(0) }); }
});


it('matches full text or speaker with the effective locale and restarts only when locale changes', async () => {
  const cues = [{ cueId: 'text', start: 0, end: 1, text: 'İSTANBUL' },
    { cueId: 'speaker', start: 1, end: 2, text: 'Other content', speaker: 'İSTANBUL' }];
  const requests: { query: string; locale: string }[] = [];
  const { element, media } = await mount(provider({ count: 2, getCue: index => cues[index]!,
    activeAt: () => ({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }),
    search: (query, request) => {
      requests.push({ query, locale: request.locale });
      const folded = query.toLocaleLowerCase(request.locale);
      const matches = cues.flatMap((cue, index) => cue.text.toLocaleLowerCase(request.locale).includes(folded) ||
        (cue.speaker ?? '').toLocaleLowerCase(request.locale).includes(folded) ? [{ index, cue }] : []);
      return { count: matches.length, getMatch: index => matches[index]! };
    } }));
  const events: { matchCount: number; activeIndex: number }[] = [];
  element.addEventListener('lr-search-change', event => events.push(event.detail));
  expect(await element.search('istanbul')).to.equal(0);
  element.lang = 'tr';
  await waitUntil(() => events.at(-1)?.matchCount === 2);
  expect(requests).to.deep.equal([{ query: 'istanbul', locale: 'en' }, { query: 'istanbul', locale: 'tr' }]);
  expect(await element.searchNext()).to.equal(true);
  await element.updateComplete;
  await listOf(element).updateComplete;
  expect(listOf(element).shadowRoot!.querySelectorAll('[data-match]').length).to.equal(2);
  for (let tick = 0; tick < 100; tick++) { media.currentTime = tick / 100; media.dispatchEvent(new Event('timeupdate')); }
  await element.updateComplete;
  expect(requests.length).to.equal(2);
  expect(await element.search('  ')).to.equal(0);
  expect(requests.length).to.equal(2);
  expect(events.at(-1)).to.include({ matchCount: 0, activeIndex: -1 });
});

it('validates a newly loaded distant match against its row before scrolling', async () => {
  const { element } = await mount(provider({ activeAt: () => ({ index: null, cue: null, validFrom: -Infinity, validUntil: Infinity }),
    search: () => ({ count: 1, getMatch: () => ({ index: 500_000, cue: { ...cueAt(500_000), text: 'Cue mismatch' } }) }) }));
  const list = listOf(element);
  let scrolls = 0;
  const original = list.scrollToIndex;
  list.scrollToIndex = function (...args) { scrolls++; return original.apply(this, args); };
  expect(await element.search('Cue')).to.equal(0);
  expect(scrolls).to.equal(0);
  expect(list.shadowRoot!.querySelectorAll('[data-active-match]').length).to.equal(0);
});

it('keeps search intent established synchronously by a canceled provider abort callback', async () => {
  let element!: LyraAvPlayer;
  let release!: (value: unknown) => void;
  let newer: Promise<number> | undefined;
  const mounted = await mount(provider({ search: (query, request) => {
    if (query === 'old') {
      request.signal.addEventListener('abort', () => { newer = element.search('Cue'); }, { once: true });
      return new Promise(resolve => { release = value => resolve(value as never); });
    }
    return { count: 1_000_000, getMatch: index => ({ index, cue: cueAt(index) }) };
  } }));
  element = mounted.element;
  const events: string[] = [];
  element.addEventListener('lr-search-change', event => events.push(event.detail.query));
  const old = element.search('old');
  await waitUntil(() => !!release);
  element.clearSearch();
  expect(await old).to.equal(0);
  release({ count: 0, getMatch: () => ({ index: 0, cue: cueAt(0) }) });
  expect(await newer).to.equal(1_000_000);
  expect(events).to.deep.equal(['Cue']);
});
