import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './trace-tree.js';
import type { LyraTraceTree } from './trace-tree.js';
import type { LyraSpan } from './span.js';

const SPANS: LyraSpan[] = [
  { id: 'root', name: 'Plan trip', kind: 'agent', startMs: 0, endMs: 400, status: 'success' },
  {
    id: 'search',
    parentId: 'root',
    name: 'web_search',
    kind: 'tool',
    startMs: 10,
    endMs: 120,
    status: 'success',
    tokensIn: 12,
    tokensOut: 340,
    costText: '$0.0021',
    detail: 'Searching flights',
  },
  { id: 'llm', parentId: 'root', name: 'gpt-turbo', kind: 'llm', startMs: 130, endMs: 390, status: 'running' },
];

// One root-level row per status tone, so every active-row color rule has something to apply to.
const STATUS_SPANS: LyraSpan[] = [
  {
    id: 'ok',
    name: 'ok_span',
    kind: 'tool',
    startMs: 0,
    endMs: 100,
    status: 'success',
    detail: 'finished cleanly',
    tokensIn: 12,
    tokensOut: 340,
    costText: '$0.0021',
  },
  { id: 'ok2', name: 'ok_span_2', kind: 'tool', startMs: 100, endMs: 200, status: 'success', detail: 'also fine' },
  { id: 'bad', name: 'bad_span', kind: 'tool', startMs: 200, endMs: 300, status: 'error', detail: 'threw' },
  { id: 'nope', name: 'denied_span', kind: 'tool', startMs: 300, endMs: 400, status: 'denied', detail: 'blocked' },
  { id: 'run', name: 'running_span', kind: 'llm', startMs: 400, status: 'running', detail: 'streaming' },
  { id: 'wait', name: 'pending_span', kind: 'other', startMs: 500, status: 'pending', detail: 'queued' },
];

/** Resolve a color expression against the component's own token scope, as rendered. */
const probeColor = (el: LyraTraceTree, value: string): string => {
  const probe = document.createElement('span');
  probe.style.color = value;
  el.shadowRoot!.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
};

const partColor = (el: LyraTraceTree, id: string, part: string): string =>
  getComputedStyle(el.shadowRoot!.querySelector(`[data-id="${id}"] [part="${part}"]`) as HTMLElement).color;

/**
 * 8-bit RGB channels of a computed color. Chromium serializes a `color-mix(in srgb, ...)` result as
 * `color(srgb r g b)` with 0..1 floats and a plain token as `rgb(r, g, b)` with 0..255 integers, so
 * the two have to be normalized before they can be compared numerically.
 */
const channels = (color: string): number[] => {
  const nums = (color.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
  return color.startsWith('color(') ? nums.map((n) => Math.round(n * 255)) : nums;
};

describe('lr-trace-tree', () => {
  it('never scrolls vertically -- overflow-x:auto alone lets the y axis compute to auto too, which can show a phantom scrollbar', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).overflowY).to.equal('hidden');
  });

  it('renders spans as a flattened tree with computed aria-level/posinset/setsize', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll('[part="row"]');
    expect(rows.length).to.equal(3);
    const root = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(root.getAttribute('aria-level')).to.equal('1');
    expect(root.getAttribute('aria-posinset')).to.equal('1');
    expect(root.getAttribute('aria-setsize')).to.equal('1');
    const search = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(search.getAttribute('aria-level')).to.equal('2');
    expect(search.getAttribute('aria-posinset')).to.equal('1');
    expect(search.getAttribute('aria-setsize')).to.equal('2');
  });

  it('treats a span with an unresolvable parentId as a root instead of dropping it', async () => {
    const orphan: LyraSpan[] = [{ id: 'x', parentId: 'missing', name: 'orphan', kind: 'other', startMs: 0, status: 'pending' }];
    const el = (await fixture(html`<lr-trace-tree .spans=${orphan}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  });

  it('emits lr-span-toggle and hides children when a parent row is collapsed', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(3);
    const toggle = el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLElement;
    setTimeout(() => toggle.click());
    const ev = await oneEvent(el, 'lr-span-toggle');
    expect(ev.detail).to.deep.equal({ id: 'root', expanded: false });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  });

  it('emits lr-span-select on row click and on Enter', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    setTimeout(() => row.click());
    const ev = await oneEvent(el, 'lr-span-select');
    expect(ev.detail).to.deep.equal({ id: 'search' });
  });

  it('moves roving tabindex with ArrowDown/ArrowUp', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const root = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(root.getAttribute('tabindex')).to.equal('0');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;
    const search = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(search.getAttribute('tabindex')).to.equal('0');
    expect(root.getAttribute('tabindex')).to.equal('-1');
  });

  it('marks the row matching activeSpanId with aria-current and data-active', async () => {
    const el = (await fixture(
      html`<lr-trace-tree .spans=${SPANS} active-span-id="llm"></lr-trace-tree>`,
    )) as LyraTraceTree;
    await el.updateComplete;
    const llmRow = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    expect(llmRow.getAttribute('aria-current')).to.equal('true');
    expect(llmRow.hasAttribute('data-active')).to.be.true;
    expect(el.shadowRoot!.querySelector('[data-id="root"]')!.getAttribute('aria-current')).to.equal('false');
  });

  it('includes visible token and cost metadata in each explicit row name', async () => {
    const el = (await fixture(
      html`<lr-trace-tree .spans=${SPANS} show-tokens show-cost></lr-trace-tree>`,
    )) as LyraTraceTree;
    const label = el.shadowRoot!.querySelector('[data-id="search"]')!.getAttribute('aria-label')!;
    expect(label).to.include('Tokens in: 12');
    expect(label).to.include('Tokens out: 340');
    expect(label).to.include('Cost: $0.0021');
  });

  it('formats duration numbers with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-trace-tree
        lang="de-DE"
        .spans=${[{ id: 'one', name: 'One', kind: 'agent', status: 'success', startMs: 0, endMs: 1500 }]}
      ></lr-trace-tree>`,
    )) as LyraTraceTree;
    expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent).to.equal('1,5s');
  });

  it('moves actual focus to the surviving ancestor before collapse removes a focused child', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    const child = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    child.focus();
    (el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[data-id="root"]'));
  });

  it('normalizes duplicate/cyclic/non-finite data and bounds deep rendering', async () => {
    const deep = Array.from({ length: 2_000 }, (_, index) => ({
      id: `deep-${index}`,
      parentId: index === 0 ? undefined : `deep-${index - 1}`,
      name: `Deep ${index}`,
      kind: 'agent' as const,
      status: 'success' as const,
      startMs: index,
      endMs: index + 1,
    }));
    deep.push({ ...deep[0]!, name: 'duplicate' });
    deep.push({ ...deep[0]!, id: 'invalid', startMs: Number.NaN });
    const el = (await fixture(html`<lr-trace-tree .spans=${deep}></lr-trace-tree>`)) as LyraTraceTree;
    const rows = el.shadowRoot!.querySelectorAll('[part="row"]');
    expect(rows.length).to.be.at.most(500);
    expect(el.shadowRoot!.querySelectorAll('[data-id="deep-0"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.querySelector('[data-id="invalid"]')).to.not.exist;

    el.spans = [
      { id: 'a', parentId: 'b', name: 'A', kind: 'agent', status: 'success', startMs: 0 },
      { id: 'b', parentId: 'a', name: 'B', kind: 'agent', status: 'success', startMs: 1 },
    ];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]')).to.have.lengthOf(2);
  });

  it('reveals and scrolls a controlled active row when data arrives under a collapsed ancestor', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    (el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    el.activeSpanId = 'search';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-id="search"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-id="search"]')!.hasAttribute('data-active')).to.be.true;
  });

  it('keeps a newest running span visibly nonzero on the duration scale', async () => {
    const el = (await fixture(
      html`<lr-trace-tree
        .spans=${[{ id: 'run', name: 'Run', kind: 'agent', status: 'running', startMs: 100 }]}
      ></lr-trace-tree>`,
    )) as LyraTraceTree;
    expect((el.shadowRoot!.querySelector('[part="bar"]') as HTMLElement).style.inlineSize).to.equal('1%');
  });

  it('shows tokens/cost columns only when show-tokens/show-cost are set', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tokens-in"]')).to.not.exist;
    el.showTokens = true;
    el.showCost = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tokens-in"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="cost"]')).to.exist;
  });

  it('keeps duration, token, and cost headers on the same grid tracks as row values', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '900px';
    const el = (await fixture(
      html`<lr-trace-tree .spans=${SPANS} show-tokens show-cost></lr-trace-tree>`,
      { parentNode: container },
    )) as LyraTraceTree;
    const pairs = [
      ['.col-duration', '[part="duration"]'],
      ['.col-tokens', '[part="tokens-in"]'],
      ['.col-cost', '[part="cost"]'],
    ] as const;
    for (const [headerSelector, rowSelector] of pairs) {
      const header = el.shadowRoot!.querySelector(headerSelector) as HTMLElement;
      const row = el.shadowRoot!.querySelector(`[data-id="root"] ${rowSelector}`) as HTMLElement;
      expect(Math.abs(header.getBoundingClientRect().left - row.getBoundingClientRect().left)).to.be.lessThan(1);
    }
  });

  it('expandAll() and collapseAll() control every collapsible row', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    el.collapseAll();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
    await el.expandAll();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(3);
  });

  it('keeps a roving tabindex when a different row is toggled than the focused one (regression)', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const search = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    search.click();
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLElement;
    setTimeout(() => toggle.click());
    await oneEvent(el, 'lr-span-toggle');
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="row"]')];
    expect(rows).to.have.length(1);
    const zeroTab = rows.filter((r) => r.getAttribute('tabindex') === '0');
    expect(zeroTab).to.have.length(1);
    expect(zeroTab[0].getAttribute('data-id')).to.equal('root');
  });

  it('keeps a roving tabindex after collapseAll() hides the focused row (regression)', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const search = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    search.click();
    await el.updateComplete;
    el.collapseAll();
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="row"]')];
    expect(rows).to.have.length(1);
    const zeroTab = rows.filter((r) => r.getAttribute('tabindex') === '0');
    expect(zeroTab).to.have.length(1);
    expect(zeroTab[0].getAttribute('data-id')).to.equal('root');
  });

  it('renders lr-empty when spans is empty', async () => {
    const el = (await fixture(html`<lr-trace-tree></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('registers lr-live-region and lr-empty as a side effect of importing trace-tree.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement -- only the barrel (*.js)
    // does. A component that imports its dependencies via the .class.js path renders an
    // un-upgraded, plain HTMLElement for them, silently breaking anything that calls a method on
    // that dependency (e.g. announce()).
    expect(customElements.get('lr-live-region')).to.exist;
    expect(customElements.get('lr-empty')).to.exist;
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = (await fixture(html`<lr-trace-tree></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Trace tree');
    el.strings = { traceTree: 'Arbre de trace' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Arbre de trace');
  });

  it('builds status-change announcements from the traceTreeSpanStatus template, so a locale controls name/status order', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    // reorder the placeholders to prove the announcement is interpolated,
    // not the span name concatenated with the localized status
    el.strings = { traceTreeSpanStatus: 'Status {status} for {name}' };
    const live = el.shadowRoot!.querySelector('lr-live-region')!;
    live.throttleMs = 0;
    await el.updateComplete;
    await live.updateComplete;
    el.spans = SPANS.map((s) => (s.id === 'llm' ? { ...s, status: 'success' as const } : s));
    await el.updateComplete;
    // the live region's announcer flushes on a (zero-length) timeout
    await new Promise((resolve) => setTimeout(resolve, 60));
    const region = live.shadowRoot!.querySelector('[part="region"]')!;
    expect(region.textContent).to.equal('Status Success for gpt-turbo');
  });

  it('does not let a hidden descendant status overwrite the visible tree announcement channel', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    const live = el.shadowRoot!.querySelector('lr-live-region')!;
    live.throttleMs = 0;
    (el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    el.spans = SPANS.map((span) =>
      span.id === 'search' ? { ...span, status: 'error' as const } : span,
    );
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(live.shadowRoot!.querySelector('[part="region"]')!.textContent).to.equal('');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS} show-tokens show-cost></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('gives the expand/collapse toggle the shared minimum tappable size without inflating the chevron glyph', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLElement;
    expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
    expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
  });

  it('renders the embedding- and retriever-kind icons, and formats a >=1s duration in seconds', async () => {
    const spans: LyraSpan[] = [
      { id: 'emb', name: 'embed_docs', kind: 'embedding', startMs: 0, endMs: 1500, status: 'success' },
      { id: 'retr', name: 'vector_lookup', kind: 'retriever', startMs: 0, endMs: 40, status: 'success' },
    ];
    const el = (await fixture(html`<lr-trace-tree .spans=${spans}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const embRow = el.shadowRoot!.querySelector('[data-id="emb"]') as HTMLElement;
    // embeddingIcon() is the only kind icon built from five <circle>s -- this distinguishes it
    // from the other five kind icons rather than merely asserting "an svg exists".
    expect(embRow.querySelectorAll('[part="icon"] circle').length).to.equal(5);
    expect(embRow.querySelector('[part="duration"]')!.textContent).to.equal('1.5s');
    const retrRow = el.shadowRoot!.querySelector('[data-id="retr"]') as HTMLElement;
    // retrieverIcon() is the only kind icon built from exactly one <circle> plus one <line>.
    expect(retrRow.querySelectorAll('[part="icon"] circle').length).to.equal(1);
    expect(retrRow.querySelectorAll('[part="icon"] line').length).to.equal(1);
  });

  it('moves roving tabindex with Home/End', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');
    expect((el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement).getAttribute('tabindex')).to.equal('-1');
  });

  it('moves roving tabindex with ArrowUp', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');
  });

  it('expands or moves focus into a child with ArrowRight, and no-ops on a leaf', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    // "root" starts expanded -> ArrowRight moves focus into its first child.
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');

    // "search" is a leaf -> ArrowRight is a no-op.
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');

    // Collapse everything (focus re-points to "root"), then ArrowRight re-expands it.
    el.collapseAll();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');
    setTimeout(() => base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })));
    const ev = await oneEvent(el, 'lr-span-toggle');
    expect(ev.detail).to.deep.equal({ id: 'root', expanded: true });
  });

  it('collapses with ArrowLeft, and walks up to the nearest shallower ancestor from a leaf', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    (el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).click();
    await el.updateComplete;

    // "search" has no children -> ArrowLeft walks back to the nearest shallower ancestor ("root").
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');

    // "root" has children and is expanded -> ArrowLeft collapses it.
    setTimeout(() => base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true })));
    const ev = await oneEvent(el, 'lr-span-toggle');
    expect(ev.detail).to.deep.equal({ id: 'root', expanded: false });
  });

  it('emits lr-span-select on Enter and on Space (keyboard activation)', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    setTimeout(() => base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })));
    const enterEv = await oneEvent(el, 'lr-span-select');
    expect(enterEv.detail).to.deep.equal({ id: 'root' });

    setTimeout(() => base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true })));
    const spaceEv = await oneEvent(el, 'lr-span-select');
    expect(spaceEv.detail).to.deep.equal({ id: 'root' });
  });

  it('ignores unhandled keys', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const root = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(root.getAttribute('tabindex')).to.equal('0');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(root.getAttribute('tabindex')).to.equal('0');
  });

  it('prunes collapsed ids that disappear from a spans update, falling back to the first row when activeSpanId is unset', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS}></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLElement;
    setTimeout(() => toggle.click());
    await oneEvent(el, 'lr-span-toggle');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);

    const newSpans: LyraSpan[] = [{ id: 'other', name: 'other_root', kind: 'other', startMs: 0, endMs: 50, status: 'success' }];
    el.spans = newSpans;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="other"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');

    // The stale "root" collapsed id was pruned rather than lingering -- bringing spans back
    // renders fully expanded instead of silently honoring a collapse for an id that no longer exists.
    el.spans = [...SPANS];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(3);
  });

  it('falls back to activeSpanId (not just the first row) when the focused row disappears but activeSpanId is still present', async () => {
    const el = (await fixture(
      html`<lr-trace-tree .spans=${SPANS} active-span-id="llm"></lr-trace-tree>`,
    )) as LyraTraceTree;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).click();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');

    el.spans = SPANS.filter((s) => s.id !== 'search');
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');
  });

  it('does not throw when activeSpanId does not match any rendered row', async () => {
    const el = (await fixture(
      html`<lr-trace-tree .spans=${SPANS} active-span-id="missing"></lr-trace-tree>`,
    )) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-active]')).to.not.exist;
  });

  it('shows only the tokens columns, or only the cost column, in the header row', async () => {
    const el = (await fixture(html`<lr-trace-tree .spans=${SPANS} show-tokens></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.col-tokens')).to.exist;
    expect(el.shadowRoot!.querySelector('.col-cost')).to.not.exist;

    el.showTokens = false;
    el.showCost = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.col-tokens')).to.not.exist;
    expect(el.shadowRoot!.querySelector('.col-cost')).to.exist;
  });

  it('ignores keydown when there are no rows to navigate', async () => {
    const el = (await fixture(html`<lr-trace-tree></lr-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Should not throw despite there being no rows for onKeyDown to index into.
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('suppresses the duration bar (both header and rows) when hide-bars is set', async () => {
    const el = (await fixture(
      html`<lr-trace-tree .spans=${SPANS} show-tokens hide-bars></lr-trace-tree>`,
    )) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.col-bar')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="bar-track"]')).to.not.exist;
  });

  it('swaps ArrowLeft/ArrowRight for expand/collapse under RTL', async () => {
    const el = (await fixture(
      html`<lr-trace-tree dir="rtl" .spans=${SPANS}></lr-trace-tree>`,
    )) as LyraTraceTree;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Under RTL, ArrowLeft is the expand key: "root" starts expanded, so it moves focus into
    // its first child rather than toggling -- the mirror image of the LTR ArrowRight test.
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');

    // ArrowRight is the collapse key under RTL: "search" is a leaf, so it walks up to "root".
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement).getAttribute('tabindex')).to.equal('0');
  });

  describe('--lr-trace-tree-row-active-bg', () => {
    const activeFixture = async (): Promise<LyraTraceTree> => {
      const el = (await fixture(
        html`<lr-trace-tree .spans=${SPANS} .activeSpanId=${'root'}></lr-trace-tree>`,
      )) as LyraTraceTree;
      await el.updateComplete;
      return el;
    };

    it('retints only the active row via the cssprop', async () => {
      const el = await activeFixture();
      el.style.setProperty('--lr-trace-tree-row-active-bg', 'rgb(10, 20, 30)');
      const active = el.shadowRoot!.querySelector('[part="row"][data-active]') as HTMLElement;
      const inactive = el.shadowRoot!.querySelector('[part="row"]:not([data-active])') as HTMLElement;
      expect(active).to.exist;
      expect(getComputedStyle(active).backgroundColor).to.equal('rgb(10, 20, 30)');
      expect(getComputedStyle(inactive).backgroundColor).to.not.equal('rgb(10, 20, 30)');
    });

    it('renders byte-identically to the brand-quiet token default when unset', async () => {
      const el = await activeFixture();
      const active = el.shadowRoot!.querySelector('[part="row"][data-active]') as HTMLElement;
      const unset = getComputedStyle(active).backgroundColor;
      el.style.setProperty('--lr-trace-tree-row-active-bg', 'var(--lr-color-brand-quiet)');
      expect(getComputedStyle(active).backgroundColor).to.equal(unset);
    });

  });

  describe('active-row contrast', () => {
    const statusFixture = async (activeId: string): Promise<LyraTraceTree> => {
      const el = (await fixture(
        html`<lr-trace-tree .spans=${STATUS_SPANS} .activeSpanId=${activeId} show-tokens show-cost></lr-trace-tree>`,
      )) as LyraTraceTree;
      await el.updateComplete;
      return el;
    };

    it('raises the active row quiet neutrals to the full-strength text color', async () => {
      const el = await statusFixture('ok');
      // [part='name'] declares no color of its own, so it renders whatever --lr-color-text
      // currently resolves to -- an in-DOM reference for "full-strength text" that stays correct
      // in either color scheme.
      const full = partColor(el, 'ok', 'name');
      const quiet = probeColor(el, 'var(--lr-color-text-quiet)');
      expect(full).to.not.equal(quiet);
      for (const part of ['detail', 'duration', 'tokens-in', 'tokens-out', 'cost']) {
        expect(partColor(el, 'ok', part), part).to.equal(full);
      }
      // regression: the identical parts on an inactive row stay quiet
      for (const part of ['detail', 'duration']) {
        expect(partColor(el, 'ok2', part), part).to.equal(quiet);
      }
    });

    it('raises the active row pending status label to the full-strength text color', async () => {
      const el = await statusFixture('wait');
      const full = partColor(el, 'wait', 'name');
      expect(partColor(el, 'wait', 'status-text')).to.equal(full);

      // regression: the same row, inactive, keeps the quiet token
      el.activeSpanId = 'ok';
      await el.updateComplete;
      expect(partColor(el, 'wait', 'status-text')).to.equal(probeColor(el, 'var(--lr-color-text-quiet)'));
    });

    it('retunes only the active row neutrals via --lr-trace-tree-row-active-color', async () => {
      const el = await statusFixture('ok');
      el.style.setProperty('--lr-trace-tree-row-active-color', 'rgb(7, 8, 9)');
      for (const part of ['detail', 'duration', 'tokens-in', 'tokens-out', 'cost']) {
        expect(partColor(el, 'ok', part), part).to.equal('rgb(7, 8, 9)');
      }
      expect(partColor(el, 'ok2', 'duration')).to.not.equal('rgb(7, 8, 9)');
    });

    // The semantic status labels are mixed toward the same override, not toward --lr-color-text
    // directly. Without this, a consumer who moves the active tint across the lightness midpoint
    // could correct the neutrals but would leave every status label stranded at a contrast the
    // override cannot reach.
    it('re-aims the active row status mix at --lr-trace-tree-row-active-color too', async () => {
      const el = await statusFixture('ok');
      const before = partColor(el, 'ok', 'status-text');
      el.style.setProperty('--lr-trace-tree-row-active-color', 'rgb(255, 255, 255)');
      const after = partColor(el, 'ok', 'status-text');
      expect(after).to.not.equal(before);
      // mixed toward white => every channel moves up, and the hue is still not flattened to it
      const [br, bg, bb] = channels(before);
      const [ar, ag, ab] = channels(after);
      expect(ar).to.be.greaterThan(br);
      expect(ag).to.be.greaterThan(bg);
      expect(ab).to.be.greaterThan(bb);
      expect(after).to.not.equal('rgb(255, 255, 255)');
      // regression: an inactive row's status label is untouched by the override
      expect(partColor(el, 'ok2', 'status-text')).to.equal(probeColor(el, 'var(--lr-color-success)'));
    });

    it('mixes the active row status label toward the text color instead of flattening its hue', async () => {
      const el = await statusFixture('ok');
      const raw = probeColor(el, 'var(--lr-color-success)');
      const full = partColor(el, 'ok', 'name');
      const mixed = partColor(el, 'ok', 'status-text');
      // neither the raw semantic token nor the plain text color
      expect(mixed).to.not.equal(raw);
      expect(mixed).to.not.equal(full);
      // ...but strictly between them per channel, i.e. the hue is preserved and pulled toward the
      // text color. --lr-color-text flips with the color scheme, so this darkens in light mode and
      // lightens in dark mode -- the correct direction in both.
      const [mr, mg, mb] = channels(mixed);
      const [rr, rg, rb] = channels(raw);
      const [fr, fg, fb] = channels(full);
      const between = (m: number, a: number, b: number): boolean => m >= Math.min(a, b) && m <= Math.max(a, b);
      expect(between(mr, rr, fr), `r ${mr} between ${rr} and ${fr}`).to.be.true;
      expect(between(mg, rg, fg), `g ${mg} between ${rg} and ${fg}`).to.be.true;
      expect(between(mb, rb, fb), `b ${mb} between ${rb} and ${fb}`).to.be.true;
    });

    it('flips the mix direction with the color scheme: darkens in light mode, lightens in dark', async () => {
      const el = await statusFixture('ok');
      const brightness = (color: string): number => {
        const [r, g, b] = channels(color);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      // Light mode (the shipped defaults): the mix pulls the label toward a dark text color.
      expect(brightness(partColor(el, 'ok', 'status-text'))).to.be.lessThan(
        brightness(probeColor(el, 'var(--lr-color-success)')),
      );
      // The `prefers-color-scheme: dark` media query is not forceable from this harness, so drive
      // the same two token inputs that block sets -- which is also exactly how a consumer rethemes.
      el.style.setProperty('--lr-theme-color-text-normal', '#f2f2f2');
      el.style.setProperty('--lr-theme-color-success-fill-loud', '#3fb950');
      expect(brightness(partColor(el, 'ok', 'status-text'))).to.be.greaterThan(
        brightness(probeColor(el, 'var(--lr-color-success)')),
      );
    });

    it('leaves every inactive row status label at its raw semantic token (regression)', async () => {
      const el = await statusFixture('ok');
      const expected: Array<[string, string]> = [
        ['ok2', 'var(--lr-color-success)'],
        ['bad', 'var(--lr-color-danger)'],
        ['nope', 'var(--lr-color-warning)'],
        ['run', 'var(--lr-color-brand)'],
        ['wait', 'var(--lr-color-text-quiet)'],
      ];
      for (const [id, token] of expected) {
        expect(partColor(el, id, 'status-text'), id).to.equal(probeColor(el, token));
      }
    });

    it('mixes every semantic status tone, not only the two that fail today', async () => {
      const el = await statusFixture('ok');
      const tones: Array<[string, string]> = [
        ['ok', 'var(--lr-color-success)'],
        ['bad', 'var(--lr-color-danger)'],
        ['nope', 'var(--lr-color-warning)'],
        ['run', 'var(--lr-color-brand)'],
      ];
      for (const [id, token] of tones) {
        el.activeSpanId = id;
        await el.updateComplete;
        expect(partColor(el, id, 'status-text'), id).to.not.equal(probeColor(el, token));
      }
    });

    it('leaves [part=bar] identical on active and inactive rows', async () => {
      const el = await statusFixture('ok');
      const barBg = (id: string): string =>
        getComputedStyle(el.shadowRoot!.querySelector(`[data-id="${id}"] [part="bar"]`) as HTMLElement).backgroundColor;
      // 'ok' is active, 'ok2' is not, and both are success spans -- the duration bar is a non-text
      // graphic on a 3:1 floor that it already passes, so the mix is scoped to [part='status-text']
      // and must not reach it.
      expect(barBg('ok')).to.equal(barBg('ok2'));
      expect(barBg('ok')).to.equal(probeColor(el, 'var(--lr-color-success)'));
      expect(barBg('bad')).to.equal(probeColor(el, 'var(--lr-color-danger)'));
      expect(barBg('nope')).to.equal(probeColor(el, 'var(--lr-color-warning)'));
      expect(barBg('wait')).to.equal(probeColor(el, 'var(--lr-color-text-quiet)'));
    });

    it('is accessible with an active row, for every status tone', async () => {
      const el = (await fixture(
        html`<lr-trace-tree .spans=${STATUS_SPANS} show-tokens show-cost></lr-trace-tree>`,
      )) as LyraTraceTree;
      await el.updateComplete;
      for (const span of STATUS_SPANS) {
        el.activeSpanId = span.id;
        await el.updateComplete;
        // Prove the fixture actually reached the active state before asserting on it -- an axe run
        // against a row that never rendered [data-active] would pass vacuously and say nothing
        // about the tinted-row contrast this test exists for.
        const active = el.shadowRoot!.querySelector('[part="row"][data-active]') as HTMLElement;
        expect(active.getAttribute('data-id'), span.id).to.equal(span.id);
        expect(active.querySelector('[part="status-text"]')!.getAttribute('data-status')).to.equal(span.status);
        await expect(el).to.be.accessible();
      }
    });
  });
});
