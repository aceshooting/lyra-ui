import { twoFrames as nextFrame } from '../../../../test/frames.js';
import { resolvedInShadow } from '../../../../test/shadow-style.js';
import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './retrieval-results.js';
import type {
  LyraRetrievalResults,
  RetrievalResultsSelectDetail,
} from './retrieval-results.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraChunkInspector } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraCheckbox } from '../../forms/checkbox/checkbox.class.js';
import type { RetrievalChunk } from '../../../ai/types.js';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import {
  ANNOUNCEMENT_SINK_ATTRIBUTE,
  type AnnouncementPoliteness,
} from '../../../internal/announcer.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';

// The locale-aware metadata fixture formats numbers under an Arabic locale with no registered
// catalog; its English-default messages are intentional.
expectLocaleFallback('ar-u-nu-arab', [
  'chunkInspectorEmpty',
  'chunkInspectorLabel',
  'chunkScore',
  'retrievalResultsSelectRowOrdinal',
  'chunkInspectorOpenOrdinal',
  'scoreTierMedium',
  'showMore',
  'valueInvalid',
  'valueTruncated',
]);

function sinkOf(politeness: AnnouncementPoliteness): HTMLElement {
  return document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`
  )!;
}

// The opt-in mount announcement is deliberately deferred past the first paint, so the shared
// region is mounted in an earlier task than the text that lands in it.
async function settleInitialAnnouncement(
  el: LyraRetrievalResults
): Promise<void> {
  await el.updateComplete;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  await el.updateComplete;
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

function recordVirtualListOffsetRebuilds(list: LyraVirtualList): {
  count: () => number;
  updates: () => string[][];
  restore: () => void;
} {
  const seam = list as unknown as { recomputeOffsets: () => void };
  const updateSeam = list as unknown as { willUpdate: (changed: Map<PropertyKey, unknown>) => void };
  const original = seam.recomputeOffsets;
  const originalWillUpdate = updateSeam.willUpdate;
  let count = 0;
  const updates: string[][] = [];
  seam.recomputeOffsets = () => {
    count += 1;
    original.call(list);
  };
  updateSeam.willUpdate = (changed) => {
    updates.push([...changed.keys()].map(String));
    originalWillUpdate.call(list, changed);
  };
  return {
    count: () => count,
    updates: () => updates,
    restore: () => {
      seam.recomputeOffsets = original;
      updateSeam.willUpdate = originalWillUpdate;
    },
  };
}

function flatRows(el: LyraRetrievalResults): Element[] {
  return [...el.shadowRoot!.querySelectorAll('[part="row"]')];
}

// `<lr-checkbox>`'s own click handler lives on its internal `[part="base"]` span, not the host --
// a bare `.click()` on the custom element itself fires a `click` event at the host, which nothing
// inside its shadow root is listening for (see `checkbox.test.ts`'s own tests for the same idiom).
function clickCheckbox(checkbox: LyraCheckbox): void {
  (checkbox.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).click();
}

it('defaults to empty chunks/selectedChunkIds, withoutSelection=false, withoutDedupe=false, sort="score", grouping="none", presentation="expanded", virtualizeAt=50, loading=false, hasMore=false, errorText=""', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  expect(el.chunks).to.deep.equal([]);
  expect(el.selectedChunkIds).to.deep.equal([]);
  expect(el.withoutSelection).to.be.false;
  expect(el.withoutDedupe).to.be.false;
  expect(el.sort).to.equal('score');
  expect(el.grouping).to.equal('none');
  expect(el.presentation).to.equal('expanded');
  expect(el.virtualizeAt).to.equal(50);
  expect(el.activeChunkId).to.equal('');
  expect(el.loading).to.be.false;
  expect(el.hasMore).to.be.false;
  expect(el.errorText).to.equal('');
});

it('renders each row without a nested one-item group, list or listitem', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`,
  )) as LyraRetrievalResults;
  await el.updateComplete;
  const inspectors = [...el.shadowRoot!.querySelectorAll<LyraChunkInspector>('lr-chunk-inspector')];
  expect(inspectors.length).to.be.greaterThan(0);
  for (const inspector of inspectors) {
    await inspector.updateComplete;
    expect(inspector.shadowRoot!.querySelectorAll('[role="group"], [role="list"], [role="listitem"]').length).to.equal(0);
  }
});

it('shows chunkInspectorEmpty when chunks is empty and not loading', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')!.getAttribute('heading')
  ).to.equal('No chunks retrieved');
});

it('announces later settled empty transitions without replaying initial empty content', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  const sink = document.querySelector('[data-lr-live-region="polite"]')!;
  const initialCount = sink.children.length;

  el.loading = true;
  await el.updateComplete;
  expect(sink.children.length).to.equal(initialCount);

  el.loading = false;
  await el.updateComplete;
  expect(sink.lastElementChild?.textContent).to.equal('No chunks retrieved');

  el.chunks = chunks;
  await el.updateComplete;
  el.chunks = [];
  await el.updateComplete;
  expect(sink.children.length).to.equal(initialCount + 2);

  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
  await el.updateComplete;
  const reconnectedSink = document.querySelector(
    '[data-lr-live-region="polite"]'
  )!;
  expect(reconnectedSink.children.length).to.equal(0);
});

it('keeps explicit-empty and dynamic host naming distinct from the initial-load spinner', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      loading
      label="Policy results"
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  const spinner = el.shadowRoot!.querySelector(
    '[part="spinner"]'
  ) as HTMLElement & {
    updateComplete: Promise<boolean>;
    shadowRoot: ShadowRoot;
  };
  const spinnerLabel = () =>
    spinner.shadowRoot
      .querySelector('[role="progressbar"]')!
      .getAttribute('aria-label');

  expect(spinner != null).to.be.true;
  expect(spinnerLabel()).to.equal('Loading…');
  expect(el.shadowRoot!.querySelector('[part="empty"]') == null).to.be.true;

  el.setAttribute('aria-label', 'Loading policy search results');
  await el.updateComplete;
  await spinner.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(
    'Loading policy search results'
  );
  expect(spinnerLabel()).to.equal('Loading…');

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  await spinner.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(spinnerLabel()).to.equal('Loading…');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  await spinner.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(null);
  expect(spinnerLabel()).to.equal('Loading…');
});

it('keeps one populated owner across explicit-empty and dynamic host naming', async () => {
  const el = (await fixture(html`
    <lr-retrieval-results
      aria-label="Author results"
      label="Policy results"
      .chunks=${chunks}
    ></lr-retrieval-results>
  `)) as LyraRetrievalResults;
  const group = () => el.shadowRoot!.querySelector('[part="base"]')!;
  expect(el.getAttribute('aria-label')).to.equal('Author results');
  expect(group().getAttribute('aria-label')).to.equal(null);
  expect(group().getAttribute('role')).to.equal(null);
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(group().getAttribute('aria-label')).to.equal('');
  expect(group().getAttribute('role')).to.equal('group');
  el.setAttribute('aria-label', 'Revised results');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Revised results');
  expect(group().getAttribute('aria-label')).to.equal(null);
  expect(group().getAttribute('role')).to.equal(null);
});

it('honors an explicitly empty label as genuinely empty, distinct from omitting it', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  expect(el.label).to.equal(undefined);
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Retrieved chunks');

  el.label = '';
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('');
});

it('renders a neutral error message and announces only later errors from light DOM', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      error-text="Retrieval failed"
      .chunks=${chunks}
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await el.updateComplete;
  const alert = el.shadowRoot!.querySelector('[part="error"]')!;
  expect(alert.getAttribute('role')).to.be.null;
  expect(alert.textContent).to.include('Retrieval failed');
  expect(el.shadowRoot!.querySelector('[part="row"]') == null).to.be.true;
  const sink = () =>
    document.querySelector('[data-lr-live-region="assertive"]')!;
  expect(
    sink().children.length,
    'initial content is not replayed as an announcement'
  ).to.equal(0);

  el.errorText = 'A newer failure';
  await el.updateComplete;
  expect(sink().lastElementChild?.textContent).to.equal('A newer failure');

  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
  await el.updateComplete;
  expect(
    sink().children.length,
    'reconnect does not replay the current error'
  ).to.equal(0);
});

it('announces the error it already presents on mount when announce is set', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      announce
      error-text="Retrieval failed"
      .chunks=${chunks}
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await settleInitialAnnouncement(el);
  expect(el.announce, 'announce reflects the authored attribute').to.equal(
    true
  );
  expect(el.getAttribute('announce')).to.equal('');
  expect(
    Array.from(sinkOf('assertive').children, (child) => child.textContent)
  ).to.deep.equal(['Retrieval failed']);
  expect(
    sinkOf('polite').children.length,
    'an error state is announced assertively and only once'
  ).to.equal(0);
  await expect(el).to.be.accessible();
});

it('announces the settled empty state it already presents on mount when announce is set', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results announce></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await settleInitialAnnouncement(el);
  expect(
    Array.from(sinkOf('polite').children, (child) => child.textContent)
  ).to.deep.equal(['No chunks retrieved']);
  expect(
    sinkOf('assertive').children.length,
    'there is no error state to announce'
  ).to.equal(0);
});

it('keeps an announce results panel that is still loading silent on mount', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results announce loading></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await settleInitialAnnouncement(el);
  expect(
    sinkOf('polite').children.length,
    'an empty result set is not settled while loading'
  ).to.equal(0);
});

it('keeps an announce results panel with chunks silent on mount', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results announce .chunks=${chunks}></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await settleInitialAnnouncement(el);
  expect(
    sinkOf('polite').children.length,
    'rendered results are read in document order, not announced'
  ).to.equal(0);
});

it('keeps mount silent while announce is unset, with later transitions still announced', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      error-text="Retrieval failed"
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await settleInitialAnnouncement(el);
  expect(el.announce, 'announce defaults to false').to.equal(false);
  expect(el.hasAttribute('announce')).to.equal(false);
  expect(
    sinkOf('assertive').children.length,
    'an unannounced results panel stays silent on mount'
  ).to.equal(0);

  el.errorText = 'A newer failure';
  await el.updateComplete;
  expect(
    Array.from(sinkOf('assertive').children, (child) => child.textContent)
  ).to.deep.equal(['A newer failure']);
});

it('does not replay the initial announcement when an announce results panel reconnects', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      announce
      error-text="Retrieval failed"
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await settleInitialAnnouncement(el);
  expect(sinkOf('assertive').children.length).to.equal(1);

  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
  await settleInitialAnnouncement(el);
  expect(
    sinkOf('assertive').children.length,
    'reconnect stages the existing error again rather than replaying it'
  ).to.equal(0);
});

// 9.0.0 renamed `error` -> `errorText`/`error-text`, matching the sibling `<lr-retrieval-search>`
// (and the 25 other components that already spell this member that way).
it('exposes caller-supplied failure text only as errorText; the removed `error` spelling is inert', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  let el: LyraRetrievalResults;
  try {
    el = (await fixture(
      html`<lr-retrieval-results
        error="Legacy failure"
        .chunks=${chunks}
      ></lr-retrieval-results>`
    )) as LyraRetrievalResults;
  } finally {
    console.warn = originalWarn;
  }
  await el.updateComplete;
  expect('error' in el).to.equal(false);
  expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  expect(
    el.shadowRoot!.querySelectorAll('[part="row"]').length
  ).to.be.greaterThan(0);

  el.errorText = 'Current failure';
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="error"]')?.textContent
  ).to.include('Current failure');
});

it('renders one row per chunk (unsorted input), sorted descending by score by default', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = chunks; // c1 (0.6), c2 (0.92), c3 (0.2) -- deliberately not pre-sorted
  await el.updateComplete;
  const rows = flatRows(el);
  expect(rows.length).to.equal(3);
  const firstInspector = rows[0]!.querySelector(
    'lr-chunk-inspector'
  ) as LyraChunkInspector;
  expect(firstInspector.chunks[0]!.id).to.equal('c2'); // highest score (0.92) first
});

it('preserves given order when sort="none"', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results sort="none"></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = [chunks[2]!, chunks[0]!, chunks[1]!];
  await el.updateComplete;
  const rows = flatRows(el);
  const ids = rows.map(
    (r) =>
      (r.querySelector('lr-chunk-inspector') as LyraChunkInspector).chunks[0]!
        .id
  );
  expect(ids).to.deep.equal(['c3', 'c1', 'c2']);
});

it('omits blank and later-duplicate chunk ids first-wins before sorting', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = [
    {
      id: '',
      text: 'empty id',
      score: 1,
      source: { id: 's0', name: 'invalid.pdf' },
    },
    {
      id: 'dup',
      text: 'low score copy',
      score: 0.3,
      source: { id: 's1', name: 'a.pdf' },
    },
    {
      id: 'dup',
      text: 'high score copy',
      score: 0.8,
      source: { id: 's1', name: 'a.pdf' },
    },
    {
      id: '   ',
      text: 'blank id',
      score: 1,
      source: { id: 's0', name: 'invalid.pdf' },
    },
  ];
  await el.updateComplete;
  const rows = flatRows(el);
  expect(rows.length).to.equal(1);
  const inspector = rows[0]!.querySelector(
    'lr-chunk-inspector'
  ) as LyraChunkInspector;
  expect(inspector.chunks[0]!.text).to.equal('low score copy');
});

it('omits valid-id chunks whose nested source record is malformed', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  (el as unknown as { chunks: unknown }).chunks = [
    { id: 'missing-source', text: 'bad', score: 0.8 },
    chunks[0],
  ];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="row"]')).to.have.length(1);
  expect(
    (el.shadowRoot!.querySelector('lr-chunk-inspector') as LyraChunkInspector)
      .chunks
  ).to.have.length(1);
});

it('uses finite normalized scores when sorting hostile result data', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = [
    {
      id: 'high',
      text: 'invalid copy',
      score: Number.NaN,
      source: { id: 's1', name: 'a.pdf' },
    },
    {
      id: 'dup',
      text: 'clamped copy',
      score: 2,
      source: { id: 's1', name: 'a.pdf' },
    },
    { id: 'low', text: 'low', score: -1, source: { id: 's2', name: 'b.pdf' } },
  ];
  await el.updateComplete;
  const inspectors = [...el.shadowRoot!.querySelectorAll('lr-chunk-inspector')];
  expect(inspectors[0]!.chunks[0]!.text).to.equal('clamped copy');
  expect(
    inspectors[0]!.shadowRoot!.querySelector('[part~="score"]')!.textContent
  ).to.include('100%');
  expect(
    inspectors[1]!.shadowRoot!.querySelector('[part~="score"]')!.textContent
  ).to.include('0%');
});

it('retains non-finite numeric scores for the existing finite display normalization', async () => {
  const el = await fixture<LyraRetrievalResults>(html`
    <lr-retrieval-results sort="none"></lr-retrieval-results>
  `);
  el.chunks = [
    {
      id: 'non-finite',
      text: 'Still renderable',
      score: Number.POSITIVE_INFINITY,
      source: { id: 'source-a', name: 'Source A' },
    },
    {
      id: 'neighbor',
      text: 'Valid neighbor',
      score: 0.5,
      source: { id: 'source-b', name: 'Source B' },
    },
  ];
  await el.updateComplete;

  const inspectors = [
    ...el.shadowRoot!.querySelectorAll<LyraChunkInspector>(
      'lr-chunk-inspector'
    ),
  ];
  expect(inspectors.map((inspector) => inspector.chunks[0]!.id)).to.deep.equal([
    'non-finite',
    'neighbor',
  ]);
  expect(
    inspectors[0]!.shadowRoot!.querySelector('[part~="score"]')!.textContent
  ).to.include('0%');
});

it('refreshes localized source-group fallback labels after a runtime strings change', async () => {
  const el = await fixture<LyraRetrievalResults>(html`
    <lr-retrieval-results
      grouping="source"
      .chunks=${[
        {
          id: 'chunk',
          text: 'Grounded text',
          score: 0.8,
          source: { id: 'source', name: '' },
        },
      ]}
    ></lr-retrieval-results>
  `);
  const virtual = el.shadowRoot!.querySelector(
    'lr-virtual-list'
  ) as HTMLElement & {
    groups: readonly { label: string }[];
  };
  expect(virtual.groups[0]?.label).to.equal('Untitled source');

  el.strings = { untitledSource: 'Source sans titre' };
  await el.updateComplete;
  expect(virtual.groups[0]?.label).to.equal('Source sans titre');
});

it('keeps first-wins identity when withoutDedupe is set', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results .withoutDedupe=${true}></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = [
    { id: 'dup', text: 'a', score: 0.3, source: { id: 's1', name: 'a.pdf' } },
    { id: 'dup', text: 'b', score: 0.8, source: { id: 's1', name: 'a.pdf' } },
  ];
  await el.updateComplete;
  expect(flatRows(el).length).to.equal(1);
  expect(
    (flatRows(el)[0]!.querySelector('lr-chunk-inspector') as LyraChunkInspector)
      .chunks[0]!.text
  ).to.equal('a');
});

it('keeps first-wins identity when without-dedupe is set as a plain HTML attribute', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results without-dedupe></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  expect(el.withoutDedupe).to.be.true;
  el.chunks = [
    { id: 'dup', text: 'a', score: 0.3, source: { id: 's1', name: 'a.pdf' } },
    { id: 'dup', text: 'b', score: 0.8, source: { id: 's1', name: 'a.pdf' } },
  ];
  await el.updateComplete;
  expect(flatRows(el).length).to.equal(1);
});

it('renders through the internal virtual-list once the canonical count exceeds virtualizeAt', async () => {
  const many: RetrievalChunk[] = Array.from({ length: 5 }, (_, i) => ({
    id: `m${i}`,
    text: `chunk ${i}`,
    score: 0.5,
    source: { id: 's1', name: 'a.pdf' },
  }));
  const el = (await fixture(
    html`<lr-retrieval-results virtualize-at="3"></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = many;
  await el.updateComplete;
  expect(vlist(el)).to.exist;
  expect(vlist(el).items.length).to.equal(5);
});

it('keeps the retrieval virtual-list key callback stable across a selection-only update', async () => {
  const el = await fixture<LyraRetrievalResults>(
    html`<lr-retrieval-results virtualize-at="1"></lr-retrieval-results>`,
  );
  el.chunks = chunks;
  await el.updateComplete;
  const list = vlist(el);
  const keyFunction = list.keyFunction;

  el.selectedChunkIds = ['c1'];
  await el.updateComplete;
  await list.updateComplete;

  expect(list.keyFunction).to.equal(keyFunction);
});

it('refreshes virtual result rows without offset rebuilds for controlled state updates while chunk data reconciles', async () => {
  const el = await fixture<LyraRetrievalResults>(
    html`<lr-retrieval-results virtualize-at="1"></lr-retrieval-results>`,
  );
  el.chunks = chunks;
  await el.updateComplete;
  const list = vlist(el);
  list.rowHeight = 24;
  await list.updateComplete;
  await waitUntil(
    () => list.shadowRoot!.querySelector('lr-checkbox[data-chunk-id="c1"]') != null,
    'virtual rows rendered'
  );
  const items = list.items;
  const rebuilds = recordVirtualListOffsetRebuilds(list);
  try {
    const selectedCheckbox = (): LyraCheckbox =>
      list.shadowRoot!.querySelector<LyraCheckbox>('lr-checkbox[data-chunk-id="c1"]')!;
    expect(selectedCheckbox().checked).to.equal(false);

    el.selectedChunkIds = ['c1'];
    await el.updateComplete;
    await list.updateComplete;

    expect(rebuilds.count(), JSON.stringify(rebuilds.updates())).to.equal(0);
    expect(list.items).to.equal(items);
    expect(selectedCheckbox().checked).to.equal(true);

    el.presentation = 'compact';
    await el.updateComplete;
    await list.updateComplete;

    const inspector = list.shadowRoot!.querySelector<LyraChunkInspector>(
      'lr-chunk-inspector[data-chunk-id="c1"]',
    )!;
    expect(inspector.size).to.equal('s');
    expect(rebuilds.count()).to.equal(0);
    expect(list.items).to.equal(items);

    el.chunks = [
      ...chunks,
      {
        id: 'c4',
        text: 'A newly arrived chunk still reconciles the virtualized source.',
        score: 0.4,
        source: { id: 's3', name: 'new-source.pdf' },
      },
    ];
    await el.updateComplete;
    await list.updateComplete;

    expect(rebuilds.count()).to.equal(1);
    expect(list.items).to.not.equal(items);
    expect((list.items as RetrievalChunk[]).some((chunk) => chunk.id === 'c4')).to.equal(true);
  } finally {
    rebuilds.restore();
  }
});

it('stays in flat (non-virtualized) mode below the virtualizeAt threshold', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  expect(vlist(el) == null).to.be.true;
  expect(flatRows(el).length).to.equal(3);
});

describe('grouping', () => {
  it('always virtualizes and buckets by source.id, best-scoring group first', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks; // s1: c1(0.6)+c2(0.92) -> best 0.92; s2: c3(0.2) -> best 0.2
    await el.updateComplete;
    const list = vlist(el);
    expect(list).to.exist;
    const groups = list.groups as {
      key: string | number;
      label?: string;
      startIndex: number;
    }[];
    expect(groups.map((g) => g.key)).to.deep.equal(['s1', 's2']);
    expect(groups[0]!.label).to.equal('curie-bio.pdf');
    expect(groups[0]!.startIndex).to.equal(0);
    expect(groups[1]!.startIndex).to.equal(2);
    const items = list.items as RetrievalChunk[];
    expect(items.map((c) => c.id)).to.deep.equal(['c2', 'c1', 'c3']);
  });

  describe('custom', () => {
    const tiered: RetrievalChunk[] = [
      { id: 'hi', text: 'hi', score: 0.9, source: { id: 's1', name: 'A' } },
      { id: 'lo', text: 'lo', score: 0.1, source: { id: 's2', name: 'B' } },
      { id: 'mid', text: 'mid', score: 0.5, source: { id: 's1', name: 'A' } },
    ];
    const tierOf = (chunk: RetrievalChunk): string =>
      chunk.score >= 0.75 ? 'high' : chunk.score >= 0.4 ? 'medium' : 'low';

    it('buckets by a host-supplied groupBy key, labelling each group through groupLabel', async () => {
      const el = (await fixture(
        html`<lr-retrieval-results grouping="custom"></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      el.groupBy = tierOf;
      el.groupLabel = (id, groupChunks) => `${id} (${groupChunks.length})`;
      el.chunks = tiered;
      await el.updateComplete;

      const groups = vlist(el).groups!;
      expect(
        groups.map((g) => g.key),
        'first-seen order follows the sorted rows'
      ).to.deep.equal(['high', 'medium', 'low']);
      expect(groups.map((g) => g.label)).to.deep.equal([
        'high (1)',
        'medium (1)',
        'low (1)',
      ]);
      expect(groups.map((g) => g.startIndex)).to.deep.equal([0, 1, 2]);
      expect(
        (vlist(el).items as RetrievalChunk[]).map((c) => c.id)
      ).to.deep.equal(['hi', 'mid', 'lo']);
    });

    it('shows the group id verbatim when groupLabel is left unset', async () => {
      const el = (await fixture(
        html`<lr-retrieval-results grouping="custom"></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      el.groupBy = tierOf;
      el.chunks = tiered;
      await el.updateComplete;
      expect(
        vlist(el).groups!.map((g) => g.label)
      ).to.deep.equal(['high', 'medium', 'low']);
    });

    it('honours an explicit groupOrder array, keeping unlisted ids in first-seen order', async () => {
      const el = (await fixture(
        html`<lr-retrieval-results grouping="custom"></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      el.groupBy = tierOf;
      el.groupOrder = ['low'];
      el.chunks = tiered;
      await el.updateComplete;
      const groups = vlist(el).groups!;
      expect(groups.map((g) => g.key)).to.deep.equal(['low', 'high', 'medium']);
      expect(groups.map((g) => g.startIndex)).to.deep.equal([0, 1, 2]);
      expect(
        (vlist(el).items as RetrievalChunk[]).map((c) => c.id)
      ).to.deep.equal(['lo', 'hi', 'mid']);
    });

    it('honours a groupOrder comparator', async () => {
      const el = (await fixture(
        html`<lr-retrieval-results grouping="custom"></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      el.groupBy = tierOf;
      el.groupOrder = (a, b) => a.localeCompare(b);
      el.chunks = tiered;
      await el.updateComplete;
      expect(
        vlist(el).groups!.map((g) => g.key)
      ).to.deep.equal(['high', 'low', 'medium']);
    });

    it('degrades to a flat, ungrouped list when groupBy is left unset', async () => {
      const el = (await fixture(
        html`<lr-retrieval-results grouping="custom"></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      el.chunks = tiered;
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelectorAll('lr-virtual-list').length,
        'a short flat list is not virtualized'
      ).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(
        3
      );
    });

    it('recomputes the memoized pipeline when a grouping callback is reassigned', async () => {
      const el = (await fixture(
        html`<lr-retrieval-results grouping="custom"></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      el.groupBy = tierOf;
      el.chunks = tiered;
      await el.updateComplete;
      expect(
        vlist(el).groups!.map((g) => g.key)
      ).to.deep.equal(['high', 'medium', 'low']);

      el.groupBy = (chunk) => chunk.source.id;
      await el.updateComplete;
      expect(
        vlist(el).groups!.map((g) => g.key)
      ).to.deep.equal(['s1', 's2']);

      el.groupLabel = (id) => `src:${id}`;
      await el.updateComplete;
      expect(
        vlist(el).groups!.map((g) => g.label)
      ).to.deep.equal(['src:s1', 'src:s2']);
    });

    it('leaves grouping="none" and grouping="source" behaviour unchanged when the callbacks are unset', async () => {
      const flat = (await fixture(
        html`<lr-retrieval-results></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      flat.chunks = tiered;
      await flat.updateComplete;
      expect(flat.grouping).to.equal('none');
      expect(flat.groupBy).to.equal(undefined);
      expect(flat.groupLabel).to.equal(undefined);
      expect(flat.groupOrder).to.equal(undefined);
      expect(
        flat.shadowRoot!.querySelectorAll('lr-virtual-list').length
      ).to.equal(0);
      expect(flat.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(
        3
      );

      const bySource = (await fixture(
        html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`
      )) as LyraRetrievalResults;
      bySource.chunks = tiered;
      await bySource.updateComplete;
      expect(
        vlist(bySource).groups!.map((g) => g.key)
      ).to.deep.equal(['s1', 's2']);
    });
  });

  it('falls back to the untitled-source label when a group has no source name', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = [
      { id: 'x', text: 'x', score: 0.5, source: { id: 's9', name: '' } },
    ];
    await el.updateComplete;
    const groups = vlist(el).groups!;
    expect(groups[0]!.label).to.equal('Untitled source');
  });

  // The identity + sort + group pipeline (`processedChunks`) is memoized on an instance field,
  // refreshed only when `chunks`/`withoutDedupe`/`sort`/`grouping` change (see `willUpdate()`).
  // This exercises the full pipeline together -- a later duplicate id resolves to a different source,
  // so the first owner's source must be the one that determines its group bucket -- then proves an
  // unrelated `selectedChunkIds`-only update leaves
  // the memoized output untouched, and a genuine `chunks` change still correctly invalidates and
  // recomputes it.
  it('memoizes the canonicalized/sorted/grouped output, refreshing only when identity inputs change', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = [
      {
        id: 'a1',
        text: 'a1-lo',
        score: 0.4,
        source: { id: 's1', name: 'Source A' },
      },
      {
        id: 'a1',
        text: 'a1-hi',
        score: 0.9,
        source: { id: 's2', name: 'Source B' },
      }, // dup id, higher score, different source
      {
        id: 'a2',
        text: 'a2',
        score: 0.3,
        source: { id: 's1', name: 'Source A' },
      },
      {
        id: 'a3',
        text: 'a3',
        score: 0.5,
        source: { id: 's2', name: 'Source B' },
      },
    ];
    await el.updateComplete;
    const list = vlist(el);
    const itemsOf = () => vlist(el).items as RetrievalChunk[];
    const groupsOf = () => vlist(el).groups!;

    expect(itemsOf().map((c) => c.id)).to.deep.equal(['a3', 'a1', 'a2']);
    expect(
      itemsOf().find((c) => c.id === 'a1')!.text,
      'kept the first valid duplicate'
    ).to.equal('a1-lo');
    expect(
      groupsOf().map((g) => g.key),
      'the first duplicate owner drives its group'
    ).to.deep.equal(['s2', 's1']);
    expect(groupsOf()[0]!.startIndex).to.equal(0);
    expect(groupsOf()[1]!.startIndex).to.equal(1);
    expect(list).to.exist;

    // Unrelated update (selectedChunkIds only): the memoized identity/sort/group output stays unchanged.
    el.selectedChunkIds = ['a3'];
    await el.updateComplete;
    expect(itemsOf().map((c) => c.id)).to.deep.equal(['a3', 'a1', 'a2']);
    expect(groupsOf().map((g) => g.key)).to.deep.equal(['s2', 's1']);

    // A genuine `chunks` change must still invalidate the cache and be reflected.
    el.chunks = [
      {
        id: 'b1',
        text: 'b1',
        score: 0.1,
        source: { id: 's3', name: 'Source C' },
      },
    ];
    await el.updateComplete;
    expect(itemsOf().map((c) => c.id)).to.deep.equal(['b1']);
    expect(groupsOf().map((g) => g.key)).to.deep.equal(['s3']);
  });
});

describe('selection', () => {
  it('emits lr-select with the updated ids and matching chunks, and reflects the checked state', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const rows = flatRows(el);
    const topRow = rows[0]!; // c2, highest score
    const checkbox = topRow.querySelector('lr-checkbox') as LyraCheckbox;
    const listener = oneEvent(el, 'lr-select');
    clickCheckbox(checkbox);
    const event = (await listener) as CustomEvent<RetrievalResultsSelectDetail>;
    expect(event.detail.chunkIds).to.deep.equal(['c2']);
    expect(event.detail.chunks.map((c) => c.id)).to.deep.equal(['c2']);
    expect(el.selectedChunkIds).to.deep.equal(['c2']);
    await el.updateComplete;
    expect(
      (flatRows(el)[0]!.querySelector('lr-checkbox') as LyraCheckbox).checked
    ).to.be.true;

    // Toggling again deselects.
    const listener2 = oneEvent(el, 'lr-select');
    clickCheckbox(
      flatRows(el)[0]!.querySelector('lr-checkbox') as LyraCheckbox
    );
    const event2 =
      (await listener2) as CustomEvent<RetrievalResultsSelectDetail>;
    expect(event2.detail.chunkIds).to.deep.equal([]);
  });

  it('derives exactly one first-wins selected record when without-dedupe is set', async () => {
    const low = {
      id: 'dup',
      text: 'low',
      score: 0.2,
      source: { id: 's1', name: 'a.pdf' },
    };
    const high = {
      id: 'dup',
      text: 'high',
      score: 0.9,
      source: { id: 's1', name: 'a.pdf' },
    };
    const el = (await fixture(
      html`<lr-retrieval-results
        sort="none"
        without-dedupe
        .chunks=${[low, high]}
      ></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    expect(flatRows(el).length).to.equal(1);

    const pending = oneEvent(el, 'lr-select');
    clickCheckbox(
      flatRows(el)[0]!.querySelector('lr-checkbox') as LyraCheckbox
    );
    const detail = (await pending).detail as RetrievalResultsSelectDetail;
    expect(detail.chunkIds).to.deep.equal(['dup']);
    expect(detail.chunks.map((chunk) => [chunk.id, chunk.text])).to.deep.equal([
      ['dup', 'low'],
    ]);
  });

  it('derives the same first-wins duplicate record from a virtualized projection', async () => {
    const low = {
      id: 'dup',
      text: 'low',
      score: 0.2,
      source: { id: 's1', name: 'a.pdf' },
    };
    const high = {
      id: 'dup',
      text: 'high',
      score: 0.9,
      source: { id: 's1', name: 'a.pdf' },
    };
    const el = (await fixture(
      html`<lr-retrieval-results
        grouping="source"
        sort="none"
        without-dedupe
        .chunks=${[low, high]}
      ></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    await nextFrame();
    const checkbox = vlist(el).shadowRoot!.querySelector(
      'lr-checkbox'
    ) as LyraCheckbox;
    expect(checkbox).to.exist;
    const pending = oneEvent(el, 'lr-select');
    clickCheckbox(checkbox);
    const detail = (await pending).detail as RetrievalResultsSelectDetail;
    expect(detail.chunkIds).to.deep.equal(['dup']);
    expect(detail.chunks.map((chunk) => [chunk.id, chunk.text])).to.deep.equal([
      ['dup', 'low'],
    ]);
  });

  it('omits the checkbox entirely when withoutSelection is set', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results .withoutSelection=${true}></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-checkbox').length).to.equal(0);
  });

  it('omits the checkbox when without-selection is set as a plain HTML attribute (not a property binding)', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results without-selection></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    expect(el.withoutSelection).to.be.true;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-checkbox').length).to.equal(0);
  });

  it('canonicalizes and prunes selectedChunkIds against the current chunk model', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    el.selectedChunkIds = ['c1', ' ', 'c1', 'does-not-exist', 'c2'];
    await el.updateComplete;
    expect(el.selectedChunkIds).to.deep.equal(['c1', 'c2']);
    expect(flatRows(el).length).to.equal(3);
    expect(
      flatRows(el).filter(
        (row) => (row.querySelector('lr-checkbox') as LyraCheckbox).checked
      ).length
    ).to.equal(2);

    el.chunks = [chunks[1]!];
    await el.updateComplete;
    expect(el.selectedChunkIds).to.deep.equal(['c2']);
  });

  it('keeps a normalized selection when a host rebinds the same stale chunk-id array', async () => {
    const el = (await fixture(html`<lr-retrieval-results></lr-retrieval-results>`)) as LyraRetrievalResults;
    el.chunks = chunks;
    const hostSelection = ['c1', 'missing'];
    el.selectedChunkIds = hostSelection;
    await el.updateComplete;
    expect(el.selectedChunkIds).to.deep.equal(['c1']);

    let changes = 0;
    el.addEventListener('lr-selection-change', () => changes++);
    el.selectedChunkIds = hostSelection;
    expect(el.isUpdatePending).to.equal(false);
    expect(el.selectedChunkIds).to.deep.equal(['c1']);
    expect(changes).to.equal(0);

    el.chunks = [chunks[1]!];
    await el.updateComplete;
    expect(changes).to.equal(1);
    expect(el.selectedChunkIds).to.deep.equal([]);

    el.selectedChunkIds = ['c2'];
    await el.updateComplete;
    expect(el.selectedChunkIds).to.deep.equal(['c2']);
  });

  /**
   * Regression: a `chunks` reassignment silently pruning stale selected ids never fired
   * `lr-select`, so a host's own external copy of `selectedChunkIds` diverged from the
   * component's with no event to resync it.
   */
  it('emits lr-select when a chunks reassignment prunes previously-selected ids', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    el.selectedChunkIds = ['c1', 'c2'];
    await el.updateComplete;

    const listener = oneEvent(el, 'lr-select');
    el.chunks = [chunks[1]!]; // drops c1, keeps c2
    const event = (await listener) as CustomEvent<RetrievalResultsSelectDetail>;

    expect(event.detail.chunkIds).to.deep.equal(['c2']);
    expect(event.detail.chunks.map((c) => c.id)).to.deep.equal(['c2']);
    await el.updateComplete;
    expect(el.selectedChunkIds).to.deep.equal(['c2']);
  });

  it('does not emit lr-select on the very first update (nothing to resync yet)', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results
        .chunks=${chunks}
        .selectedChunkIds=${['does-not-exist']}
      ></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    let emitted = 0;
    el.addEventListener('lr-select', () => emitted++);
    await el.updateComplete;
    expect(el.selectedChunkIds).to.deep.equal([]);
    expect(emitted).to.equal(0);
  });
});

describe('presentation', () => {
  it('forwards presentation="compact" to every per-row lr-chunk-inspector as size="s"', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results presentation="compact"></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const inspector = flatRows(el)[0]!.querySelector(
      'lr-chunk-inspector'
    ) as LyraChunkInspector;
    expect(inspector.size).to.equal('s');
  });

  it('renders a metadata key/value list in expanded presentation only', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = [chunks[1]!]; // carries metadata: { author, section }
    await el.updateComplete;
    const entries = [
      ...el.shadowRoot!.querySelectorAll('[part="metadata-entry"]'),
    ];
    expect(entries.length).to.equal(2);
    expect(entries.map((e) => e.textContent).join(' ')).to.include('M. Curie');

    el.presentation = 'compact';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="metadata"]') == null).to.be
      .true;
  });

  it('formats numeric metadata with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results lang="ar-u-nu-arab"></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = [{ ...chunks[0]!, metadata: { matches: 1234 } }];
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="metadata-value"]')!.textContent
    ).to.equal('١٬٢٣٤');
  });

  it('omits the metadata list entirely for a chunk with no metadata', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = [chunks[0]!];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="metadata"]') == null).to.be
      .true;
  });
});

it("forwards lr-chunk-open from a row's lr-chunk-inspector, and never leaks the original alongside the re-emit", async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = [chunks[0]!];
  await el.updateComplete;
  const events: CustomEvent[] = [];
  el.addEventListener('lr-chunk-open', (e) => events.push(e as CustomEvent));
  // [part="open-button"] lives inside the nested <lr-chunk-inspector>'s own shadow root.
  const inspector = el.shadowRoot!.querySelector(
    'lr-chunk-inspector'
  ) as LyraChunkInspector;
  (
    inspector.shadowRoot!.querySelector(
      '[part="open-button"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;
  expect(
    events.length,
    'exactly one lr-chunk-open must reach the host, not the re-emit plus the leaked original from lr-chunk-inspector'
  ).to.equal(1);
  expect(events[0]!.detail).to.deep.equal({ chunkId: 'c1', sourceId: 's1' });
});

it('suppresses the raw child checkbox change event after consuming it', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = [chunks[0]!];
  await el.updateComplete;
  let leaked = 0;
  el.addEventListener('lr-change', () => leaked++);
  el.shadowRoot!.querySelector('lr-checkbox')!.dispatchEvent(
    new CustomEvent('lr-change', {
      detail: { checked: true },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(leaked).to.equal(0);
});

it('carries a retrieval locator through to lr-chunk-open and derives its visible page', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  const locator = { kind: 'page' as const, page: 7 };
  el.chunks = [{ ...chunks[0]!, locator }];
  await el.updateComplete;
  const inspector = el.shadowRoot!.querySelector(
    'lr-chunk-inspector'
  ) as LyraChunkInspector;
  expect(inspector.chunks[0]!.anchor).to.deep.equal(locator);
  expect(inspector.chunks[0]!.page).to.equal(7);
  const pending = oneEvent(el, 'lr-chunk-open');
  (
    inspector.shadowRoot!.querySelector(
      '[part="open-button"]'
    ) as HTMLButtonElement
  ).click();
  expect((await pending).detail).to.deep.equal({
    chunkId: 'c1',
    sourceId: 's1',
    anchor: locator,
  });
});

it('forwards activeChunkId to flat rows and the virtual list identity owner', async () => {
  const flat = (await fixture(
    html`<lr-retrieval-results active-chunk-id="c2"></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  flat.chunks = chunks;
  await flat.updateComplete;
  const currentInspector = flatRows(flat)
    .map((row) => row.querySelector('lr-chunk-inspector') as LyraChunkInspector)
    .find((inspector) => inspector.chunks[0]?.id === 'c2')!;
  await currentInspector.updateComplete;
  expect(currentInspector.activeChunkId).to.equal('c2');
  expect(
    currentInspector
      .shadowRoot!.querySelector('[part~="chunk"]')!
      .getAttribute('aria-current')
  ).to.equal('true');

  const virtualized = (await fixture(
    html`<lr-retrieval-results
      active-chunk-id="c2"
      virtualize-at="1"
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  virtualized.chunks = chunks;
  await virtualized.updateComplete;
  expect(vlist(virtualized).activeItemId).to.equal('c2');
});

describe('pagination', () => {
  it('shows a Load more button in flat mode when hasMore is true, firing lr-load-more on click', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results has-more></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector(
      '[part="load-more"]'
    ) as HTMLButtonElement;
    expect(button != null).to.equal(true);
    expect(button.textContent).to.include('Load more');
    const listener = oneEvent(el, 'lr-load-more');
    button.click();
    await listener;
  });

  it('shows a spinner instead of the button while loading more in flat mode', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results has-more loading></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="load-more"]') == null).to.be
      .true;
    expect(
      el.shadowRoot!.querySelector('[part="load-more-row"] [part="spinner"]')
    ).to.exist;
  });

  it('omits the footer entirely when hasMore is false', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="load-more-row"]') == null).to.be
      .true;
  });

  it('forwards has-more/loading to the internal virtual-list and re-emits its lr-load-more while virtualized', async () => {
    const el = (await fixture(
      html`<lr-retrieval-results
        grouping="source"
        has-more
      ></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    expect(vlist(el).hasMore).to.be.true;
    expect(vlist(el).loading).to.be.false;
    const listener = oneEvent(el, 'lr-load-more');
    vlist(el).dispatchEvent(
      new CustomEvent('lr-load-more', { bubbles: true, composed: true })
    );
    await listener;
  });

  it("never leaks the internal virtual-list's own lr-load-more alongside the re-emit", async () => {
    const el = (await fixture(
      html`<lr-retrieval-results
        grouping="source"
        has-more
      ></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    await el.updateComplete;
    const events: CustomEvent[] = [];
    el.addEventListener('lr-load-more', (e) => events.push(e as CustomEvent));
    vlist(el).dispatchEvent(
      new CustomEvent('lr-load-more', { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(
      events.length,
      'exactly one lr-load-more must reach the host, not the re-emit plus the leaked original from lr-virtual-list'
    ).to.equal(1);
  });
});

it('is accessible with a populated, selectable, metadata-carrying result set', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = chunks;
  el.selectedChunkIds = ['c1'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('moves focus to the closest surviving result when controlled chunks remove the focused row', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      .chunks=${chunks}
      sort="none"
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  const secondCheckbox = flatRows(el)[1]!.querySelector(
    'lr-checkbox'
  ) as LyraCheckbox;
  secondCheckbox.focus();
  expect(el.shadowRoot!.activeElement?.tagName).to.equal('LR-CHECKBOX');

  el.chunks = [chunks[0]!, chunks[2]!];
  await el.updateComplete;
  await nextFrame();

  expect(el.shadowRoot!.activeElement?.tagName).to.equal('LR-CHECKBOX');
  expect(el.shadowRoot!.activeElement?.getAttribute('data-chunk-id')).to.equal(
    'c3'
  );
});

it('moves focus to the stable base when a controlled transition removes every result action', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      .chunks=${chunks}
      sort="none"
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  const firstCheckbox = flatRows(el)[0]!.querySelector(
    'lr-checkbox'
  ) as LyraCheckbox;
  firstCheckbox.focus();

  el.errorText = 'Unavailable';
  await el.updateComplete;
  await nextFrame();

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)?.tabIndex
  ).to.equal(-1);
});

it('recovers virtualized inspector focus from rendered rows when the controlled-ID cache is unavailable', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      grouping="source"
      sort="none"
      without-selection
      .chunks=${chunks}
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await el.updateComplete;
  const list = vlist(el);
  await list.updateComplete;
  await nextFrame();

  const focusedInspector = list.shadowRoot!.querySelector(
    'lr-chunk-inspector[data-chunk-id="c2"]'
  ) as LyraChunkInspector;
  await focusedInspector.updateComplete;
  const focusedAction = focusedInspector.shadowRoot!.querySelector(
    '[part="open-button"]'
  ) as HTMLButtonElement;
  focusedAction.focus();

  // The previous-ID array is a cache. Its fallback must derive identities from the virtual list's
  // shadow DOM, then restore focus to the nearest surviving inspector action.
  (
    el as unknown as { previousProcessedChunkIds: string[] }
  ).previousProcessedChunkIds = [];
  el.chunks = [chunks[0]!, chunks[2]!];
  await el.updateComplete;
  await list.updateComplete;
  await nextFrame();

  const restoredInspector = list.shadowRoot!.querySelector(
    'lr-chunk-inspector[data-chunk-id="c3"]'
  ) as LyraChunkInspector;
  await restoredInspector.updateComplete;
  expect(
    restoredInspector.shadowRoot!.activeElement?.getAttribute('part')
  ).to.equal('open-button');
});

it('keeps focus on a surviving virtualized inspector action through a controlled reorder', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      grouping="source"
      sort="none"
      without-selection
      .chunks=${chunks}
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await el.updateComplete;
  const list = vlist(el);
  await list.updateComplete;
  await nextFrame();

  const inspector = list.shadowRoot!.querySelector(
    'lr-chunk-inspector[data-chunk-id="c2"]'
  ) as LyraChunkInspector;
  await inspector.updateComplete;
  (
    inspector.shadowRoot!.querySelector(
      '[part="open-button"]'
    ) as HTMLButtonElement
  ).focus();

  el.chunks = [chunks[2]!, chunks[1]!, chunks[0]!];
  await el.updateComplete;
  await list.updateComplete;
  await nextFrame();

  const survivingInspector = list.shadowRoot!.querySelector(
    'lr-chunk-inspector[data-chunk-id="c2"]'
  ) as LyraChunkInspector;
  await survivingInspector.updateComplete;
  expect(
    survivingInspector.shadowRoot!.activeElement?.getAttribute('part')
  ).to.equal('open-button');
});

it('renders non-serializable metadata through a safe string fallback', async () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = [{ ...chunks[0]!, metadata: { diagnostic: cyclic } }];
  await el.updateComplete;

  const metadataValue = el.shadowRoot!.querySelector('[part="metadata-value"]');
  expect(metadataValue?.textContent).to.equal('{self: The value is invalid.}');
});

it('is accessible while grouped and virtualized', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results grouping="source"></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  await nextFrame();
  await expect(el).to.be.accessible();
});

it('applies a .strings override for the reused empty-state key', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results
      .strings=${{ chunkInspectorEmpty: 'Texte vide' }}
    ></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')!.getAttribute('heading')
  ).to.equal('Texte vide');
});

it('localizes the whole row-selection accessible name instead of concatenating translated fragments', async () => {
  const el = (await fixture(html`
    <lr-retrieval-results
      .strings=${{ retrievalResultsSelectRowOrdinal: 'Choisir le résultat {index} sur {total}, « {label} »' }}
    ></lr-retrieval-results>
  `)) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;

  const checkbox = flatRows(el)[0]!.querySelector(
    'lr-checkbox'
  ) as LyraCheckbox;
  expect(checkbox.getAttribute('aria-label')).to.equal(
    'Choisir le résultat 1 sur 3, « curie-bio.pdf »'
  );
  const inspector = flatRows(el)[0]!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  await inspector.updateComplete;
  expect(inspector.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.include('Result 1 of 3');
});

it('renders and lets selection work under dir="rtl"', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results dir="rtl"></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  const rows = flatRows(el);
  expect(rows.length).to.equal(3);
  const checkbox = rows[0]!.querySelector('lr-checkbox') as LyraCheckbox;
  const listener = oneEvent(el, 'lr-select');
  clickCheckbox(checkbox);
  const event = (await listener) as CustomEvent<RetrievalResultsSelectDetail>;
  expect(event.detail.chunkIds.length).to.equal(1);
});

it('can shrink to a 320px allocation without overflowing its host box', async () => {
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`,
    { parentNode: container }
  )) as LyraRetrievalResults;
  el.chunks = chunks;
  await el.updateComplete;
  expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  expect(flatRows(el).length).to.equal(3);
});

describe('selected-row cssprop escape hatch', () => {

  // Default LTR fixture: the `[part='row-body']` selected indicator is a `border-inline-start-color`,
  // which resolves to the physical left border here.
  async function selected(
    style = ''
  ): Promise<{ el: LyraRetrievalResults; rowBody: HTMLElement }> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-retrieval-results></lr-retrieval-results>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector(
      'lr-retrieval-results'
    ) as LyraRetrievalResults;
    el.chunks = chunks;
    el.selectedChunkIds = ['c1'];
    await el.updateComplete;
    const rowBody = el.shadowRoot!.querySelector(
      '[part~="row-body"][data-selected]'
    ) as HTMLElement;
    return { el, rowBody };
  }

  it('recolors the selected-row indicator from an ancestor via --lr-retrieval-results-selected-border', async () => {
    const { rowBody } = await selected(
      '--lr-retrieval-results-selected-border: rgb(0, 51, 102)'
    );
    expect(getComputedStyle(rowBody).borderLeftColor).to.equal(
      'rgb(0, 51, 102)'
    );
  });

  it('renders byte-identical to the brand token when unset', async () => {
    const { el, rowBody } = await selected();
    expect(getComputedStyle(rowBody).borderLeftColor).to.equal(
      resolvedInShadow(
        el,
        'border-left-color: var(--lr-color-brand)',
        'border-left-color'
      )
    );
  });

  it('is accessible with the selected-row prop themed', async () => {
    const { el } = await selected(
      '--lr-retrieval-results-selected-border: rgb(0, 51, 102)'
    );
    await expect(el).to.be.accessible();
  });
});

// Grouped mode always renders through the internal `<lr-virtual-list>`, so every row-level part
// below lives one shadow boundary deeper than this component's own shadow root. The flat path
// renders the identical template directly into this component's shadow root; both are asserted.
describe('row styling across both rendering paths', () => {

  async function render(
    path: 'flat' | 'virtualized'
  ): Promise<{ el: LyraRetrievalResults; root: ParentNode }> {
    const el = (await fixture(
      html`<lr-retrieval-results
        grouping=${path === 'virtualized' ? 'source' : 'none'}
      ></lr-retrieval-results>`
    )) as LyraRetrievalResults;
    el.chunks = chunks;
    el.selectedChunkIds = ['c2']; // c2 is the top-scoring chunk and the only one carrying metadata
    await el.updateComplete;
    await nextFrame();
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    expect(!!list, `${path}: virtual-list presence`).to.equal(
      path === 'virtualized'
    );
    return { el, root: list ? list.shadowRoot! : el.shadowRoot! };
  }

  for (const path of ['flat', 'virtualized'] as const) {
    describe(path, () => {
      it('offsets the per-row checkbox from the row body', async () => {
        const { root } = await render(path);
        const select = root.querySelector('[part~="select"]') as HTMLElement;
        expect(getComputedStyle(select).flexGrow).to.equal('0');
        expect(
          parseFloat(getComputedStyle(select).marginTop)
        ).to.be.greaterThan(0);
      });

      it('gives the row body a transparent indicator border that turns brand-colored once selected', async () => {
        const { el, root } = await render(path);
        const bodies = [
          ...root.querySelectorAll('[part~="row-body"]'),
        ] as HTMLElement[];
        expect(bodies.length).to.equal(3);
        const selected = root.querySelector(
          '[part~="row-body-selected"]'
        ) as HTMLElement;
        expect(
          parseFloat(getComputedStyle(selected).borderLeftWidth)
        ).to.be.greaterThan(0);
        expect(getComputedStyle(selected).borderLeftColor).to.equal(
          resolvedInShadow(el, 'color: var(--lr-color-brand)', 'color')
        );
        const unselected = root.querySelector(
          '[part~="row-body"]:not([data-selected])'
        ) as HTMLElement;
        expect(getComputedStyle(unselected).borderLeftColor).to.equal(
          'rgba(0, 0, 0, 0)'
        );
        expect(
          parseFloat(getComputedStyle(unselected).paddingLeft)
        ).to.be.greaterThan(0);
      });

      it('lays the metadata list out as a wrapping, quiet-toned dl', async () => {
        const { el, root } = await render(path);
        const dl = root.querySelector('[part~="metadata"]') as HTMLElement;
        expect(getComputedStyle(dl).display).to.equal('flex');
        expect(getComputedStyle(dl).flexWrap).to.equal('wrap');
        expect(getComputedStyle(dl).color).to.equal(
          resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color')
        );
        const entry = root.querySelector(
          '[part~="metadata-entry"]'
        ) as HTMLElement;
        expect(getComputedStyle(entry).display).to.equal('flex');
      });

      it('emphasizes the metadata term without fixed generated punctuation and resets the value margin', async () => {
        const { el, root } = await render(path);
        const term = root.querySelector(
          '[part~="metadata-term"]'
        ) as HTMLElement;
        expect(getComputedStyle(term).fontWeight).to.equal(
          resolvedInShadow(
            el,
            'font-weight: var(--lr-font-weight-medium)',
            'font-weight'
          )
        );
        expect(getComputedStyle(term, '::after').content).to.equal('none');
        const value = root.querySelector(
          '[part~="metadata-value"]'
        ) as HTMLElement;
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
    const virtualRow = virtual.root.querySelector(
      '[part~="row"]'
    ) as HTMLElement;
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
    expect(
      parseFloat(getComputedStyle(header).borderBottomWidth)
    ).to.be.greaterThan(0);
    expect(getComputedStyle(header).borderBottomColor).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-border-subtle)', 'color')
    );
    expect(getComputedStyle(header).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        'background: var(--lr-color-surface)',
        'background-color'
      )
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
        getComputedStyle(root.querySelector(selector) as HTMLElement)
          .letterSpacing;
      expect(spacing('[part~="group"]')).to.equal('1px');
      expect(spacing('[part~="select"]')).to.equal('2px');
      expect(spacing('[part~="row-body"]:not([data-selected])')).to.equal(
        '3px'
      );
      expect(spacing('[part~="row-body-selected"]')).to.equal('4px');
      expect(spacing('[part~="metadata"]')).to.equal('5px');
      expect(spacing('[part~="metadata-entry"]')).to.equal('6px');
      expect(spacing('[part~="metadata-term"]')).to.equal('7px');
      expect(spacing('[part~="metadata-value"]')).to.equal('8px');

      // Two shadow hops deep: the per-row <lr-chunk-inspector> forwards its own parts into the
      // virtual-list's tree, which forwards them onward from here.
      const inspectors = [
        ...root.querySelectorAll('lr-chunk-inspector'),
      ] as LyraChunkInspector[];
      const fill = inspectors
        .map((i) => i.shadowRoot!.querySelector('[part~="score-fill-success"]'))
        .find(Boolean) as HTMLElement;
      expect(getComputedStyle(fill).backgroundColor).to.equal(
        'rgb(10, 11, 12)'
      );
      const openButton = inspectors[0]!.shadowRoot!.querySelector(
        '[part~="open-button"]'
      ) as HTMLElement;
      expect(getComputedStyle(openButton).letterSpacing).to.equal('9px');
    } finally {
      sheet.remove();
    }
  });
});

describe('styling', () => {
  it('paints load-more hover feedback under a real pointer', async () => {
    const el = await fixture<LyraRetrievalResults>(html`
      <lr-retrieval-results
        has-more
        style="--lr-color-brand-quiet: rgb(1, 2, 3)"
        .chunks=${chunks}
      ></lr-retrieval-results>
    `);
    const target = el.shadowRoot!.querySelector<HTMLElement>('[part="load-more"]')!;
    target.scrollIntoView({ block: 'center' });
    const rect = target.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(
        () => getComputedStyle(target).backgroundColor === 'rgb(1, 2, 3)',
        'the retrieval load-more hover background never painted'
      );
    } finally {
      await resetMouse();
    }
  });
});

it('walks from a foreign-realm shadow descendant to its chunk host', async () => {
  const el = (await fixture(
    html`<lr-retrieval-results></lr-retrieval-results>`
  )) as LyraRetrievalResults;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const host = iframe.contentDocument!.createElement('article');
    host.setAttribute('data-chunk-id', 'foreign-chunk');
    const shadow = host.attachShadow({ mode: 'open' });
    const action = iframe.contentDocument!.createElement('button');
    shadow.append(action);
    expect(
      shadow instanceof ShadowRoot,
      'fixture really crosses constructor realms'
    ).to.equal(false);

    const anchor = (
      el as unknown as {
        chunkAnchor(start: Element | null): Element | null;
      }
    ).chunkAnchor(action);
    expect(anchor?.getAttribute('data-chunk-id')).to.equal('foreign-chunk');
  } finally {
    iframe.remove();
  }
});

describe('row checkbox containment', () => {
  const CHECKBOX_EVENTS = ['lr-checkbox-toggle-request', 'input', 'change', 'lr-input', 'lr-change'];

  function trackLeaks(el: HTMLElement): { leaked: string[]; stop: () => void } {
    const leaked: string[] = [];
    const onHost = (event: Event): void => {
      leaked.push(`host:${event.type}`);
    };
    const onDocument = (event: Event): void => {
      leaked.push(`document:${event.type}`);
    };
    for (const name of CHECKBOX_EVENTS) {
      el.addEventListener(name, onHost);
      document.addEventListener(name, onDocument);
    }
    return {
      leaked,
      stop: () => {
        for (const name of CHECKBOX_EVENTS) {
          el.removeEventListener(name, onHost);
          document.removeEventListener(name, onDocument);
        }
      },
    };
  }

  function rowCheckbox(el: LyraRetrievalResults, chunkId: string): LyraCheckbox {
    return el.shadowRoot!.querySelector<LyraCheckbox>(`lr-checkbox[data-chunk-id="${chunkId}"]`)!;
  }

  it('keeps the toggle proposal and its input/change aliases inside for native pointer and keyboard activation while lr-select still reports', async () => {
    const el = await fixture<LyraRetrievalResults>(
      html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`
    );
    await el.updateComplete;
    const first = rowCheckbox(el, 'c2');
    const second = rowCheckbox(el, 'c1');
    await first.updateComplete;
    const proposals: CustomEvent<{ checked: boolean }>[] = [];
    const onProposal = (event: Event): void => {
      proposals.push(event as CustomEvent<{ checked: boolean }>);
    };
    const selections: string[][] = [];
    const onSelect = (event: Event): void => {
      selections.push([...(event as CustomEvent<RetrievalResultsSelectDetail>).detail.chunkIds]);
    };
    first.addEventListener('lr-checkbox-toggle-request', onProposal);
    second.addEventListener('lr-checkbox-toggle-request', onProposal);
    el.addEventListener('lr-select', onSelect);
    const { leaked, stop } = trackLeaks(el);
    try {
      await resetMouse();
      first.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = first.getBoundingClientRect();
      await sendMouse({
        type: 'click',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => selections.length === 1, 'native pointer activation did not select a row');

      second.focus();
      await sendKeys({ press: 'Space' });
      await waitUntil(() => selections.length === 2, 'keyboard activation did not select a row');
    } finally {
      await resetMouse();
      stop();
      first.removeEventListener('lr-checkbox-toggle-request', onProposal);
      second.removeEventListener('lr-checkbox-toggle-request', onProposal);
      el.removeEventListener('lr-select', onSelect);
    }

    expect(leaked).to.deep.equal([]);
    expect(proposals.map((event) => event.detail.checked)).to.deep.equal([true, true]);
    expect(
      proposals.map((event) => event.defaultPrevented),
      'containment never cancels the child proposal'
    ).to.deep.equal([false, false]);
    expect(selections).to.deep.equal([['c2'], ['c2', 'c1']]);
  });

  it('keeps a checkbox-level veto authoritative while containing the proposal', async () => {
    const el = await fixture<LyraRetrievalResults>(
      html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`
    );
    await el.updateComplete;
    const checkbox = rowCheckbox(el, 'c2');
    await checkbox.updateComplete;
    const vetoes: boolean[] = [];
    const onProposal = (event: Event): void => {
      event.preventDefault();
      vetoes.push(event.defaultPrevented);
    };
    let selects = 0;
    const onSelect = (): void => {
      selects += 1;
    };
    checkbox.addEventListener('lr-checkbox-toggle-request', onProposal);
    el.addEventListener('lr-select', onSelect);
    const { leaked, stop } = trackLeaks(el);
    try {
      checkbox.focus();
      await sendKeys({ press: 'Space' });
      await waitUntil(() => vetoes.length === 1, 'keyboard activation did not propose a toggle');
      await checkbox.updateComplete;
      await el.updateComplete;
    } finally {
      stop();
      checkbox.removeEventListener('lr-checkbox-toggle-request', onProposal);
      el.removeEventListener('lr-select', onSelect);
    }

    expect(vetoes).to.deep.equal([true]);
    expect(leaked).to.deep.equal([]);
    expect(selects).to.equal(0);
    expect(el.selectedChunkIds).to.deep.equal([]);
    expect(checkbox.checked).to.equal(false);
  });
});

describe('lr-retrieval-results retired selectable alias', () => {
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-retrieval-results', kind: 'property', name: 'selectable' }];
  const observe = (el: LyraRetrievalResults): string => String(el.shadowRoot!.querySelectorAll('lr-checkbox').length);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraRetrievalResults>(markup);

  it('applies without-selection with canonical defaults and no deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-retrieval-results .chunks=${chunks} without-selection></lr-retrieval-results>`));
      plain = observe(await mount(html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });
});

describe('lr-retrieval-results retired dedupe alias', () => {
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-retrieval-results', kind: 'property', name: 'dedupe' }];
  const duplicates: RetrievalChunk[] = [
    { id: 'dup', text: 'a', score: 0.3, source: { id: 's1', name: 'a.pdf' } },
    { id: 'dup', text: 'b', score: 0.8, source: { id: 's1', name: 'a.pdf' } },
    { id: 'other', text: 'c', score: 0.5, source: { id: 's2', name: 'b.pdf' } },
  ];
  // The switch never changes the rendered rows, so the observable result is the row list itself
  // plus the canonical state it resolves to.
  const observe = (el: LyraRetrievalResults): string =>
    JSON.stringify([
      el.withoutDedupe,
      el.hasAttribute('without-dedupe'),
      flatRows(el).map(
        (row) => (row.querySelector('lr-chunk-inspector') as LyraChunkInspector).chunks[0]!.text
      ),
    ]);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraRetrievalResults>(markup);

  it('applies without-dedupe with canonical defaults and no deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-retrieval-results .chunks=${duplicates} without-dedupe></lr-retrieval-results>`));
      plain = observe(await mount(html`<lr-retrieval-results .chunks=${duplicates}></lr-retrieval-results>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });
});

function inspectorFor(el: LyraRetrievalResults, id: string): LyraChunkInspector | null {
  for (const root of [el.shadowRoot!, vlist(el)?.shadowRoot].filter((r): r is ShadowRoot => !!r)) {
    const found = root.querySelector<LyraChunkInspector>(`lr-chunk-inspector[data-chunk-id="${id}"]`);
    if (found) return found;
  }
  return null;
}

const isExpanded = (inspector: LyraChunkInspector): boolean =>
  inspector.shadowRoot!.querySelector('[part="toggle"]')!.getAttribute('aria-expanded') === 'true';

describe('review fixes', () => {
  it('reports a selection change as lr-selection-change, then the deprecated lr-select', async () => {
    const el = (await fixture(html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`)) as LyraRetrievalResults;
    const seen: string[] = [];
    el.addEventListener('lr-selection-change', (event) => {
      const detail = (event as CustomEvent<{ selectedChunkIds: string[]; chunks: RetrievalChunk[] }>).detail;
      seen.push(`selection:${detail.selectedChunkIds}:${detail.chunks.map((chunk) => chunk.id)}`);
    });
    el.addEventListener('lr-select', (event) => {
      const detail = (event as CustomEvent<RetrievalResultsSelectDetail>).detail;
      seen.push(`select:${detail.chunkIds}:${detail.chunks.map((chunk) => chunk.id)}`);
    });
    clickCheckbox(el.shadowRoot!.querySelector('lr-checkbox') as LyraCheckbox);
    await el.updateComplete;
    expect(seen).to.deep.equal(['selection:c2:c2', 'select:c2:c2']);
  });

  it('keeps a row\'s expansion toggle and the virtual list events inside', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ id: `m${index}`, text: 'text', score: 0.9 - index / 100, source: { id: 's', name: 'doc.pdf' } }));
    const leaked: string[] = [];
    const names = ['lr-chunk-toggle', 'lr-toggle', 'lr-virtual-scroll', 'lr-visible-range-change'];
    const onLeak = (event: Event): void => {
      leaked.push(event.type);
    };
    for (const name of names) document.addEventListener(name, onLeak);
    try {
      const el = (await fixture(html`<lr-retrieval-results virtualize-at="3" .chunks=${many}></lr-retrieval-results>`)) as LyraRetrievalResults;
      await vlist(el).updateComplete;
      await nextFrame();
      const inspector = inspectorFor(el, 'm0')!;
      await inspector.updateComplete;
      inspector.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!.click();
      vlist(el).scrollToIndex(8, { align: 'start', behavior: 'auto' });
      await nextFrame();
    } finally {
      for (const name of names) document.removeEventListener(name, onLeak);
    }
    expect(leaked).to.deep.equal([]);
  });

  it('keeps a row\'s expansion when the list re-sorts', async () => {
    const el = (await fixture(html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`)) as LyraRetrievalResults;
    const first = inspectorFor(el, 'c1')!;
    await first.updateComplete;
    first.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!.click();
    await el.updateComplete;
    el.chunks = [{ id: 'c0', text: 'new', score: 0.99, source: { id: 's9', name: 'new.pdf' } }, ...chunks];
    await el.updateComplete;
    const moved = inspectorFor(el, 'c1')!;
    await moved.updateComplete;
    expect(isExpanded(moved)).to.equal(true);
    const other = inspectorFor(el, 'c2')!;
    await other.updateComplete;
    expect(isExpanded(other)).to.equal(false);
  });

  it('keeps a row\'s expansion when the virtualized row scrolls out and back', async () => {
    const many = Array.from({ length: 200 }, (_, index) => ({ id: `m${index}`, text: 'text', score: 0.9 - index / 100, source: { id: 's', name: 'doc.pdf' } }));
    const el = (await fixture(html`<lr-retrieval-results virtualize-at="3" .chunks=${many}></lr-retrieval-results>`)) as LyraRetrievalResults;
    await vlist(el).updateComplete;
    await nextFrame();
    const top = inspectorFor(el, 'm0')!;
    await top.updateComplete;
    top.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!.click();
    await el.updateComplete;
    vlist(el).scrollToIndex(199, { align: 'start', behavior: 'auto' });
    await nextFrame();
    expect(inspectorFor(el, 'm0') === null).to.equal(true);
    vlist(el).scrollToIndex(0, { align: 'start', behavior: 'auto' });
    await nextFrame();
    await waitUntil(() => inspectorFor(el, 'm0') !== null, 'the first row did not come back');
    const back = inspectorFor(el, 'm0')!;
    await back.updateComplete;
    expect(isExpanded(back)).to.equal(true);
  });

  it('hands each row inspector the same one-chunk array across unrelated updates', async () => {
    const el = (await fixture(html`<lr-retrieval-results .chunks=${chunks}></lr-retrieval-results>`)) as LyraRetrievalResults;
    const before = inspectorFor(el, 'c2')!.chunks;
    clickCheckbox(el.shadowRoot!.querySelector('lr-checkbox') as LyraCheckbox);
    await el.updateComplete;
    el.presentation = 'compact';
    await el.updateComplete;
    expect(inspectorFor(el, 'c2')!.chunks === before).to.equal(true);
  });

  it('bounds the metadata it renders: entry count, long arrays and cycles', async () => {
    const wide = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`key${index}`, index]));
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const el = (await fixture(html`<lr-retrieval-results
      .chunks=${[{ ...chunks[0]!, metadata: { ...wide, embedding: Array.from({ length: 1536 }, () => 0.01), cyclic } }]}
    ></lr-retrieval-results>`)) as LyraRetrievalResults;
    const entries = el.shadowRoot!.querySelectorAll('[part="metadata-entry"]');
    expect(entries.length).to.be.at.most(33);
    const text = el.shadowRoot!.querySelector('[part="metadata"]')!.textContent!;
    expect(text.length).to.be.lessThan(2_000);
  });
});
