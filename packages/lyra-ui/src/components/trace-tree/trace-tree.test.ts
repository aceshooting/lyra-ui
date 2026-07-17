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

describe('lyra-trace-tree', () => {
  it('renders spans as a flattened tree with computed aria-level/posinset/setsize', async () => {
    const el = (await fixture(html`<lyra-trace-tree .spans=${SPANS}></lyra-trace-tree>`)) as LyraTraceTree;
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
    const el = (await fixture(html`<lyra-trace-tree .spans=${orphan}></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  });

  it('emits lyra-span-toggle and hides children when a parent row is collapsed', async () => {
    const el = (await fixture(html`<lyra-trace-tree .spans=${SPANS}></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(3);
    const toggle = el.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLElement;
    setTimeout(() => toggle.click());
    const ev = await oneEvent(el, 'lyra-span-toggle');
    expect(ev.detail).to.deep.equal({ id: 'root', expanded: false });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  });

  it('emits lyra-span-select on row click and on Enter', async () => {
    const el = (await fixture(html`<lyra-trace-tree .spans=${SPANS}></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    setTimeout(() => row.click());
    const ev = await oneEvent(el, 'lyra-span-select');
    expect(ev.detail).to.deep.equal({ id: 'search' });
  });

  it('moves roving tabindex with ArrowDown/ArrowUp', async () => {
    const el = (await fixture(html`<lyra-trace-tree .spans=${SPANS}></lyra-trace-tree>`)) as LyraTraceTree;
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
      html`<lyra-trace-tree .spans=${SPANS} active-span-id="llm"></lyra-trace-tree>`,
    )) as LyraTraceTree;
    await el.updateComplete;
    const llmRow = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    expect(llmRow.getAttribute('aria-current')).to.equal('true');
    expect(llmRow.hasAttribute('data-active')).to.be.true;
  });

  it('shows tokens/cost columns only when show-tokens/show-cost are set', async () => {
    const el = (await fixture(html`<lyra-trace-tree .spans=${SPANS}></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tokens-in"]')).to.not.exist;
    el.showTokens = true;
    el.showCost = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tokens-in"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="cost"]')).to.exist;
  });

  it('expandAll() and collapseAll() control every collapsible row', async () => {
    const el = (await fixture(html`<lyra-trace-tree .spans=${SPANS}></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    el.collapseAll();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
    await el.expandAll();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(3);
  });

  it('renders lyra-empty when spans is empty', async () => {
    const el = (await fixture(html`<lyra-trace-tree></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lyra-empty')).to.exist;
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = (await fixture(html`<lyra-trace-tree></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Trace tree');
    el.strings = { traceTree: 'Arbre de trace' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Arbre de trace');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-trace-tree .spans=${SPANS} show-tokens show-cost></lyra-trace-tree>`)) as LyraTraceTree;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
