import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './retrieval-results.js';
import type { LyraRetrievalResults, RetrievalResultsSelectDetail } from './retrieval-results.js';
import type { LyraVirtualList } from '../virtual-list/virtual-list.class.js';
import type { LyraChunkInspector } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraCheckbox } from '../checkbox/checkbox.class.js';
import type { RetrievalChunk } from '../../ai/types.js';

async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

const chunks: RetrievalChunk[] = [
  {
    id: 'c1',
    text: 'Marie Curie won the Nobel Prize in Physics in 1903.',
    score: 0.6,
    source: { id: 's1', name: 'curie-bio.pdf' },
  },
  {
    id: 'c2',
    text: 'Radium and polonium were both discovered by Marie and Pierre Curie in 1898.',
    score: 0.92,
    source: { id: 's1', name: 'curie-bio.pdf' },
    metadata: { author: 'M. Curie', section: 'Discoveries' },
  },
  {
    id: 'c3',
    text: 'Unrelated background text about the periodic table.',
    score: 0.2,
    source: { id: 's2', name: 'chemistry-101.pdf' },
  },
];

// Rendered content lives inside the internal `<lr-virtual-list>`'s own shadow root whenever
// virtualized, exactly like `<lr-thread-list>`'s own data mode -- `querySelector(All)` never
// crosses that boundary, so reaching a row requires walking through it explicitly.
function vlist(el: LyraRetrievalResults): LyraVirtualList {
  return el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
}

function flatRows(el: LyraRetrievalResults): Element[] {
  return [...el.shadowRoot!.querySelectorAll('[part="row"]')];
}

// `<lr-checkbox>`'s own click handler lives on its internal `[part="base"]` span, not the host --
// a bare `.click()` on the custom element itself fires a `click` event at the host, which nothing
// inside its shadow root is listening for (see `checkbox.test.ts`'s own tests for the same idiom).
function clickCheckbox(checkbox: LyraCheckbox): void {
  (checkbox.shadowRoot!.querySelector('[part="base"]') as HTMLElement).click();
}

it('defaults to empty chunks/selectedIds, selectable, dedupe, sort="score", grouping="none", presentation="expanded", virtualizeAt=50, loading=false, hasMore=false, error=""', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  expect(el.chunks).to.deep.equal([]);
  expect(el.selectedIds).to.deep.equal([]);
  expect(el.selectable).to.be.true;
  expect(el.dedupe).to.be.true;
  expect(el.sort).to.equal('score');
  expect(el.grouping).to.equal('none');
  expect(el.presentation).to.equal('expanded');
  expect(el.virtualizeAt).to.equal(50);
  expect(el.loading).to.be.false;
  expect(el.hasMore).to.be.false;
  expect(el.error).to.equal('');
});

it('shows chunkInspectorEmpty when chunks is empty and not loading', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No chunks retrieved');
});

it('shows a spinner instead of the empty state while loading with no chunks yet', async () => {
  const el = (await fixture(html`<lr-retrieval-results loading></lr-retrieval-results>`)) as LyraRetrievalResults;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.not.exist;
});

it('renders a role="alert" error message and suppresses everything else when error is set', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results error="Retrieval failed" .chunks=${chunks}></lr-retrieval-results>`,
  )) as LyraRetrievalResults;
  await el.updateComplete;
  const alert = el.shadowRoot!.querySelector('[part="error"]')!;
  expect(alert.getAttribute('role')).to.equal('alert');
  expect(alert.textContent).to.include('Retrieval failed');
  expect(el.shadowRoot!.querySelector('[part="row"]')).to.not.exist;
});

it('renders one row per chunk (unsorted input), sorted descending by score by default', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = chunks; // c1 (0.6), c2 (0.92), c3 (0.2) -- deliberately not pre-sorted
  await el.updateComplete;
  const rows = flatRows(el);
  expect(rows.length).to.equal(3);
  const firstInspector = rows[0]!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  expect(firstInspector.chunks[0]!.id).to.equal('c2'); // highest score (0.92) first
});

it('preserves given order when sort="none"', async () => {
  const el = (await fixture(html`<lr-retrieval-results sort="none"></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = [chunks[2]!, chunks[0]!, chunks[1]!];
  await el.updateComplete;
  const rows = flatRows(el);
  const ids = rows.map((r) => (r.querySelector('lr-chunk-inspector') as LyraChunkInspector).chunks[0]!.id);
  expect(ids).to.deep.equal(['c3', 'c1', 'c2']);
});

it('deduplicates by id, keeping the higher-scoring duplicate', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = [
    { id: 'dup', text: 'low score copy', score: 0.3, source: { id: 's1', name: 'a.pdf' } },
    { id: 'dup', text: 'high score copy', score: 0.8, source: { id: 's1', name: 'a.pdf' } },
  ];
  await el.updateComplete;
  const rows = flatRows(el);
  expect(rows.length).to.equal(1);
  const inspector = rows[0]!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  expect(inspector.chunks[0]!.text).to.equal('high score copy');
});

it('keeps every duplicate when dedupe is false', async () => {
  // `.dedupe=` (a property binding), not `?dedupe=` -- `dedupe` defaults to `true`, and a boolean
  // attribute binding that evaluates to `false` on a freshly-created element never actually removes
  // an attribute that was never present, so `attributeChangedCallback` never fires and the
  // constructor-time default would silently win.
  const el = (await fixture(html`<lr-retrieval-results .dedupe=${false}></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = [
    { id: 'dup', text: 'a', score: 0.3, source: { id: 's1', name: 'a.pdf' } },
    { id: 'dup', text: 'b', score: 0.8, source: { id: 's1', name: 'a.pdf' } },
  ];
  await el.updateComplete;
  expect(flatRows(el).length).to.equal(2);
});

it('renders through the internal virtual-list once the deduplicated count exceeds virtualizeAt', async () => {
  const many: RetrievalChunk[] = Array.from({ length: 5 }, (_, i) => ({
    id: `m${i}`,
    text: `chunk ${i}`,
    score: 0.5,
    source: { id: 's1', name: 'a.pdf' },
  }));
  const el = (await fixture(
    html`<lr-retrieval-results virtualize-at="3"></lr-retrieval-results>`,
  )) as LyraRetrievalResults;
  el.chunks = many;
  await el.updateComplete;
  expect(vlist(el)).to.exist;
  expect(vlist(el).items.length).to.equal(5);
});

it('stays in flat (non-virtualized) mode below the virtualizeAt threshold', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  expect(vlist(el)).to.not.exist;
  expect(flatRows(el).length).to.equal(3);
});

describe('grouping', () => {
  it('always virtualizes and buckets by source.id, best-scoring group first', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`,
    )) as LyraRetrievalResults;
    el.chunks = chunks; // s1: c1(0.6)+c2(0.92) -> best 0.92; s2: c3(0.2) -> best 0.2
    await el.updateComplete;
    const list = vlist(el);
    expect(list).to.exist;
    const groups = list.groups as { key: string | number; label?: string; startIndex: number }[];
    expect(groups.map((g) => g.key)).to.deep.equal(['s1', 's2']);
    expect(groups[0]!.label).to.equal('curie-bio.pdf');
    expect(groups[0]!.startIndex).to.equal(0);
    expect(groups[1]!.startIndex).to.equal(2);
    const items = list.items as RetrievalChunk[];
    expect(items.map((c) => c.id)).to.deep.equal(['c2', 'c1', 'c3']);
  });

  it('falls back to the untitled-source label when a group has no source name', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`,
    )) as LyraRetrievalResults;
    el.chunks = [{ id: 'x', text: 'x', score: 0.5, source: { id: 's9', name: '' } }];
    await el.updateComplete;
    const groups = vlist(el).groups as { label?: string }[];
    expect(groups[0]!.label).to.equal('Untitled source');
  });
});

describe('selection', () => {
  it('emits lr-select with the updated ids and matching chunks, and reflects the checked state', async () => {
    const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const rows = flatRows(el);
    const topRow = rows[0]!; // c2, highest score
    const checkbox = topRow.querySelector('lr-checkbox') as LyraCheckbox;
    const listener = oneEvent(el, 'lr-select');
    clickCheckbox(checkbox);
    const event = (await listener) as CustomEvent<RetrievalResultsSelectDetail>;
    expect(event.detail.ids).to.deep.equal(['c2']);
    expect(event.detail.chunks.map((c) => c.id)).to.deep.equal(['c2']);
    expect(el.selectedIds).to.deep.equal(['c2']);
    await el.updateComplete;
    expect((flatRows(el)[0]!.querySelector('lr-checkbox') as LyraCheckbox).checked).to.be.true;

    // Toggling again deselects.
    const listener2 = oneEvent(el, 'lr-select');
    clickCheckbox(flatRows(el)[0]!.querySelector('lr-checkbox') as LyraCheckbox);
    const event2 = (await listener2) as CustomEvent<RetrievalResultsSelectDetail>;
    expect(event2.detail.ids).to.deep.equal([]);
  });

  it('omits the checkbox entirely when selectable is false', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results .selectable=${false}></lr-retrieval-results>`,
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-checkbox')).to.not.exist;
  });

  it('tolerates a dangling id in selectedIds (no matching chunk) without throwing', async () => {
    const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = chunks;
    el.selectedIds = ['does-not-exist'];
    await el.updateComplete;
    expect(flatRows(el).length).to.equal(3);
    for (const row of flatRows(el)) {
      expect((row.querySelector('lr-checkbox') as LyraCheckbox).checked).to.be.false;
    }
  });
});

describe('presentation', () => {
  it('forwards compact to every per-row lr-chunk-inspector', async () => {
    const el = (await fixture(html`<lr-retrieval-results presentation="compact"></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const inspector = flatRows(el)[0]!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
    expect(inspector.compact).to.be.true;
  });

  it('renders a metadata key/value list in expanded presentation only', async () => {
    const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = [chunks[1]!]; // carries metadata: { author, section }
    await el.updateComplete;
    const entries = [...el.shadowRoot!.querySelectorAll('[part="metadata-entry"]')];
    expect(entries.length).to.equal(2);
    expect(entries.map((e) => e.textContent).join(' ')).to.include('M. Curie');

    el.presentation = 'compact';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="metadata"]')).to.not.exist;
  });

  it('omits the metadata list entirely for a chunk with no metadata', async () => {
    const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = [chunks[0]!];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="metadata"]')).to.not.exist;
  });
});

it('forwards lr-chunk-open from a row\'s lr-chunk-inspector', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = [chunks[0]!];
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-chunk-open');
  // [part="open-button"] lives inside the nested <lr-chunk-inspector>'s own shadow root.
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  (inspector.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'c1', sourceId: 's1' });
});

describe('pagination', () => {
  it('shows a Load more button in flat mode when hasMore is true, firing lr-load-more on click', async () => {
    const el = (await fixture(html`<lr-retrieval-results has-more></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="load-more"]') as HTMLButtonElement;
    expect(button).to.exist;
    expect(button.textContent).to.include('Load more');
    const listener = oneEvent(el, 'lr-load-more');
    button.click();
    await listener;
  });

  it('shows a spinner instead of the button while loading more in flat mode', async () => {
    const el = (await fixture(html`<lr-retrieval-results has-more loading></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="load-more"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="load-more-row"] [part="spinner"]')).to.exist;
  });

  it('omits the footer entirely when hasMore is false', async () => {
    const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="load-more-row"]')).to.not.exist;
  });

  it('forwards has-more/loading to the internal virtual-list and re-emits its lr-load-more while virtualized', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results grouping="source" has-more></lr-retrieval-results>`,
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(vlist(el).hasMore).to.be.true;
    expect(vlist(el).loading).to.be.false;
    const listener = oneEvent(el, 'lr-load-more');
    vlist(el).dispatchEvent(new CustomEvent('lr-load-more', { bubbles: true, composed: true }));
    await listener;
  });
});

it('is accessible with a populated, selectable, metadata-carrying result set', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = chunks;
  el.selectedIds = ['c1'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while grouped and virtualized', async () => {
  const el = (await fixture(html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  await nextFrame();
  await expect(el).to.be.accessible();
});

it('applies a .strings override for the reused empty-state key', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results .strings=${{ chunkInspectorEmpty: 'Texte vide' }}></lr-retrieval-results>`,
  )) as LyraRetrievalResults;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('Texte vide');
});

it('renders and lets selection work under dir="rtl"', async () => {
  const el = (await fixture(html`<lr-retrieval-results dir="rtl"></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  const rows = flatRows(el);
  expect(rows.length).to.equal(3);
  const checkbox = rows[0]!.querySelector('lr-checkbox') as LyraCheckbox;
  const listener = oneEvent(el, 'lr-select');
  clickCheckbox(checkbox);
  const event = (await listener) as CustomEvent<RetrievalResultsSelectDetail>;
  expect(event.detail.ids.length).to.equal(1);
});

it('can shrink to a 320px allocation without overflowing its host box', async () => {
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`, { parentNode: container })) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  expect(flatRows(el).length).to.equal(3);
});
