import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './retrieval-results.js';
import type { LyraRetrievalResults, RetrievalResultsSelectDetail } from './retrieval-results.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraChunkInspector } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraCheckbox } from '../../forms/checkbox/checkbox.class.js';
import type { RetrievalChunk } from '../../../ai/types.js';
import { styles } from './retrieval-results.styles.js';

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

it('uses finite normalized scores when sorting and deduplicating hostile result data', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = [
    { id: 'dup', text: 'invalid copy', score: Number.NaN, source: { id: 's1', name: 'a.pdf' } },
    { id: 'dup', text: 'clamped copy', score: 2, source: { id: 's1', name: 'a.pdf' } },
    { id: 'low', text: 'low', score: -1, source: { id: 's2', name: 'b.pdf' } },
  ];
  await el.updateComplete;
  const inspectors = [...el.shadowRoot!.querySelectorAll('lr-chunk-inspector')];
  expect(inspectors[0]!.chunks[0]!.text).to.equal('clamped copy');
  expect(inspectors[0]!.shadowRoot!.querySelector('[part~="score"]')!.textContent).to.include('100%');
  expect(inspectors[1]!.shadowRoot!.querySelector('[part~="score"]')!.textContent).to.include('0%');
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

it('keeps every duplicate when dedupe="false" is set as a plain HTML attribute (not a property binding)', async () => {
  // Unlike the `.dedupe=${false}` property-binding test above, this proves the *attribute* form
  // actually clears the `true` default too -- the gap a stock `type: Boolean` converter can't
  // close, since removing an attribute that was never present fires no `attributeChangedCallback`.
  const el = (await fixture(html`<lr-retrieval-results dedupe="false"></lr-retrieval-results>`)) as LyraRetrievalResults;
  expect(el.dedupe).to.be.false;
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
    expect(el.shadowRoot!.querySelectorAll('lr-checkbox').length).to.equal(0);
  });

  it('omits the checkbox when selectable="false" is set as a plain HTML attribute (not a property binding)', async () => {
    const el = (await fixture(html`<lr-retrieval-results selectable="false"></lr-retrieval-results>`)) as LyraRetrievalResults;
    expect(el.selectable).to.be.false;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-checkbox').length).to.equal(0);
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

it('forwards lr-chunk-open from a row\'s lr-chunk-inspector, and never leaks the original alongside the re-emit', async () => {
  const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
  el.chunks = [chunks[0]!];
  await el.updateComplete;
  const events: CustomEvent[] = [];
  el.addEventListener('lr-chunk-open', (e) => events.push(e as CustomEvent));
  // [part="open-button"] lives inside the nested <lr-chunk-inspector>'s own shadow root.
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  (inspector.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(
    events.length,
    'exactly one lr-chunk-open must reach the host, not the re-emit plus the leaked original from lr-chunk-inspector',
  ).to.equal(1);
  expect(events[0]!.detail).to.deep.equal({ id: 'c1', sourceId: 's1' });
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

  it('never leaks the internal virtual-list\'s own lr-load-more alongside the re-emit', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results grouping="source" has-more></lr-retrieval-results>`,
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const events: CustomEvent[] = [];
    el.addEventListener('lr-load-more', (e) => events.push(e as CustomEvent));
    vlist(el).dispatchEvent(new CustomEvent('lr-load-more', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(
      events.length,
      'exactly one lr-load-more must reach the host, not the re-emit plus the leaked original from lr-virtual-list',
    ).to.equal(1);
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

describe('selected-row cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraRetrievalResults, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  // Default LTR fixture: the `[part='row-body']` selected indicator is a `border-inline-start-color`,
  // which resolves to the physical left border here.
  async function selected(style = ''): Promise<{ el: LyraRetrievalResults; rowBody: HTMLElement }> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-retrieval-results></lr-retrieval-results></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-retrieval-results') as LyraRetrievalResults;
    el.chunks = chunks;
    el.selectedIds = ['c1'];
    await el.updateComplete;
    const rowBody = el.shadowRoot!.querySelector('[part~="row-body"][data-selected]') as HTMLElement;
    return { el, rowBody };
  }

  it('recolors the selected-row indicator from an ancestor via --lr-retrieval-results-selected-border', async () => {
    const { rowBody } = await selected('--lr-retrieval-results-selected-border: rgb(0, 51, 102)');
    expect(getComputedStyle(rowBody).borderLeftColor).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the brand token when unset', async () => {
    const { el, rowBody } = await selected();
    expect(getComputedStyle(rowBody).borderLeftColor).to.equal(
      resolvedInShadow(el, 'border-left-color: var(--lr-color-brand)', 'border-left-color'),
    );
  });

  it('is accessible with the selected-row prop themed', async () => {
    const { el } = await selected('--lr-retrieval-results-selected-border: rgb(0, 51, 102)');
    await expect(el).to.be.accessible();
  });
});

// Grouped mode always renders through the internal `<lr-virtual-list>`, so every row-level part
// below lives one shadow boundary deeper than this component's own shadow root. The flat path
// renders the identical template directly into this component's shadow root; both are asserted.
describe('row styling across both rendering paths', () => {
  function resolvedInShadow(el: LyraRetrievalResults, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function render(path: 'flat' | 'virtualized'): Promise<{ el: LyraRetrievalResults; root: ParentNode }> {
    const el = (await fixture(
      html`<lr-retrieval-results grouping=${path === 'virtualized' ? 'source' : 'none'}></lr-retrieval-results>`,
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    el.selectedIds = ['c2']; // c2 is the top-scoring chunk and the only one carrying metadata
    await el.updateComplete;
    await nextFrame();
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    expect(!!list, `${path}: virtual-list presence`).to.equal(path === 'virtualized');
    return { el, root: list ? list.shadowRoot! : el.shadowRoot! };
  }

  for (const path of ['flat', 'virtualized'] as const) {
    describe(path, () => {
      it('offsets the per-row checkbox from the row body', async () => {
        const { root } = await render(path);
        const select = root.querySelector('[part~="select"]') as HTMLElement;
        expect(getComputedStyle(select).flexGrow).to.equal('0');
        expect(parseFloat(getComputedStyle(select).marginTop)).to.be.greaterThan(0);
      });

      it('gives the row body a transparent indicator border that turns brand-colored once selected', async () => {
        const { el, root } = await render(path);
        const bodies = [...root.querySelectorAll('[part~="row-body"]')] as HTMLElement[];
        expect(bodies.length).to.equal(3);
        const selected = root.querySelector('[part~="row-body-selected"]') as HTMLElement;
        expect(parseFloat(getComputedStyle(selected).borderLeftWidth)).to.be.greaterThan(0);
        expect(getComputedStyle(selected).borderLeftColor).to.equal(
          resolvedInShadow(el, 'color: var(--lr-color-brand)', 'color'),
        );
        const unselected = root.querySelector('[part~="row-body"]:not([data-selected])') as HTMLElement;
        expect(getComputedStyle(unselected).borderLeftColor).to.equal('rgba(0, 0, 0, 0)');
        expect(parseFloat(getComputedStyle(unselected).paddingLeft)).to.be.greaterThan(0);
      });

      it('lays the metadata list out as a wrapping, quiet-toned dl', async () => {
        const { el, root } = await render(path);
        const dl = root.querySelector('[part~="metadata"]') as HTMLElement;
        expect(getComputedStyle(dl).display).to.equal('flex');
        expect(getComputedStyle(dl).flexWrap).to.equal('wrap');
        expect(getComputedStyle(dl).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color'));
        const entry = root.querySelector('[part~="metadata-entry"]') as HTMLElement;
        expect(getComputedStyle(entry).display).to.equal('flex');
      });

      it('emphasizes the metadata term, appends its colon, and resets the value margin', async () => {
        const { el, root } = await render(path);
        const term = root.querySelector('[part~="metadata-term"]') as HTMLElement;
        expect(getComputedStyle(term).fontWeight).to.equal(
          resolvedInShadow(el, 'font-weight: var(--lr-font-weight-medium)', 'font-weight'),
        );
        expect(getComputedStyle(term, '::after').content).to.include(':');
        const value = root.querySelector('[part~="metadata-value"]') as HTMLElement;
        expect(getComputedStyle(value).marginTop).to.equal('0px');
        expect(getComputedStyle(value).overflowWrap).to.equal('anywhere');
      });

      it('is accessible', async () => {
        const { el } = await render(path);
        await expect(el).to.be.accessible();
      });
    });
  }

  it('lays the row wrapper out identically in both paths', async () => {
    const flat = await render('flat');
    const flatRow = flat.root.querySelector('[part~="row"]') as HTMLElement;
    const virtual = await render('virtualized');
    const virtualRow = virtual.root.querySelector('[part~="row"]') as HTMLElement;
    for (const row of [flatRow, virtualRow]) {
      const style = getComputedStyle(row);
      expect(style.display).to.equal('flex');
      expect(style.alignItems).to.equal('flex-start');
      expect(parseFloat(style.paddingLeft)).to.be.greaterThan(0);
    }
  });

  it('styles the group header rendered by the internal virtual-list', async () => {
    const { el, root } = await render('virtualized');
    const header = root.querySelector('[part~="group"]') as HTMLElement;
    expect(header.textContent).to.include('curie-bio.pdf');
    // The list's own `group` styling supplies the surface/quiet/semibold treatment; this component
    // adds the separator between the header and the first row under it.
    expect(getComputedStyle(header).borderBottomStyle).to.equal('solid');
    expect(parseFloat(getComputedStyle(header).borderBottomWidth)).to.be.greaterThan(0);
    expect(getComputedStyle(header).borderBottomColor).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-border)', 'color'),
    );
    expect(getComputedStyle(header).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-surface)', 'background-color'),
    );
  });

  it('exposes its own row parts and the nested chunk-inspector parts to a consumer stylesheet', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = `
      lr-retrieval-results::part(group-header) { letter-spacing: 1px; }
      lr-retrieval-results::part(select) { letter-spacing: 2px; }
      lr-retrieval-results::part(row-body) { letter-spacing: 3px; }
      lr-retrieval-results::part(row-body-selected) { letter-spacing: 4px; }
      lr-retrieval-results::part(metadata) { letter-spacing: 5px; }
      lr-retrieval-results::part(metadata-entry) { letter-spacing: 6px; }
      lr-retrieval-results::part(metadata-term) { letter-spacing: 7px; }
      lr-retrieval-results::part(metadata-value) { letter-spacing: 8px; }
      lr-retrieval-results::part(chunk-score-fill-success) { background: rgb(10, 11, 12); }
      lr-retrieval-results::part(chunk-open-button) { letter-spacing: 9px; }
    `;
    document.head.appendChild(sheet);
    try {
      const { root } = await render('virtualized');
      const spacing = (selector: string): string =>
        getComputedStyle(root.querySelector(selector) as HTMLElement).letterSpacing;
      expect(spacing('[part~="group"]')).to.equal('1px');
      expect(spacing('[part~="select"]')).to.equal('2px');
      expect(spacing('[part~="row-body"]:not([data-selected])')).to.equal('3px');
      expect(spacing('[part~="row-body-selected"]')).to.equal('4px');
      expect(spacing('[part~="metadata"]')).to.equal('5px');
      expect(spacing('[part~="metadata-entry"]')).to.equal('6px');
      expect(spacing('[part~="metadata-term"]')).to.equal('7px');
      expect(spacing('[part~="metadata-value"]')).to.equal('8px');

      // Two shadow hops deep: the per-row <lr-chunk-inspector> forwards its own parts into the
      // virtual-list's tree, which forwards them onward from here.
      const inspectors = [...root.querySelectorAll('lr-chunk-inspector')] as LyraChunkInspector[];
      const fill = inspectors
        .map((i) => i.shadowRoot!.querySelector('[part~="score-fill-success"]'))
        .find(Boolean) as HTMLElement;
      expect(getComputedStyle(fill).backgroundColor).to.equal('rgb(10, 11, 12)');
      const openButton = inspectors[0]!.shadowRoot!.querySelector('[part~="open-button"]') as HTMLElement;
      expect(getComputedStyle(openButton).letterSpacing).to.equal('9px');
    } finally {
      sheet.remove();
    }
  });
});

describe('styling', () => {
  it('gives load-more a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='load-more'\]:hover/);
  });
});
