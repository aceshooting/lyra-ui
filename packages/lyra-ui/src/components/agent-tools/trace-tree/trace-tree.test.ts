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

describe('lr-trace-tree', () => {
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
});
