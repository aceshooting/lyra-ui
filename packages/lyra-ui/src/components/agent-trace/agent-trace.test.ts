import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './agent-trace.js';
import type { LyraAgentTrace } from './agent-trace.js';
import type { LyraSpan } from '../trace-tree/span.js';
import type { LyraTraceTree } from '../trace-tree/trace-tree.class.js';
import type { LyraGraphLegend } from '../graph-legend/graph-legend.class.js';
import type { LyraHandoffDivider } from '../handoff-divider/handoff-divider.class.js';

const SPANS: LyraSpan[] = [
  { id: 'root', name: 'Trip Planner', kind: 'agent', startMs: 0, endMs: 900, status: 'success' },
  { id: 'search', parentId: 'root', name: 'web_search', kind: 'tool', startMs: 10, endMs: 120, status: 'success' },
  { id: 'llm', parentId: 'root', name: 'gpt-turbo', kind: 'llm', startMs: 130, endMs: 390, status: 'success' },
  { id: 'retrieve', parentId: 'llm', name: 'vector_lookup', kind: 'retriever', startMs: 150, endMs: 200, status: 'success' },
  {
    id: 'sub-agent',
    parentId: 'root',
    name: 'Research Agent',
    kind: 'agent',
    startMs: 400,
    endMs: 880,
    status: 'success',
  },
];

describe('lr-agent-trace', () => {
  it('defaults to empty spans, no active span, and no hidden kinds', async () => {
    const el = (await fixture(html`<lr-agent-trace></lr-agent-trace>`)) as LyraAgentTrace;
    expect(el.spans).to.deep.equal([]);
    expect(el.activeSpanId).to.equal(null);
    expect(el.hiddenKinds).to.deep.equal([]);
  });

  it('renders through the composed lr-trace-tree, passing spans/activeSpanId/label straight through', async () => {
    const el = (await fixture(
      html`<lr-agent-trace .spans=${SPANS} active-span-id="llm" label="My trace"></lr-agent-trace>`,
    )) as LyraAgentTrace;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree).to.exist;
    expect(tree.spans).to.deep.equal(SPANS);
    expect(tree.activeSpanId).to.equal('llm');
    expect(tree.label).to.equal('My trace');
    // The tree itself owns row rendering -- this component never builds its own [role="treeitem"]
    // rows, it only renders through lr-trace-tree.
    expect(tree.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(SPANS.length);
  });

  it('renders one filter legend item per span kind present in spans, labeled via the shared spanKind* strings', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    expect(legend).to.exist;
    // agent, tool, llm, retriever are present in SPANS; embedding/other are not.
    expect(legend.types.map((t) => t.id)).to.deep.equal(['agent', 'llm', 'tool', 'retriever']);
    expect(legend.types.map((t) => t.label)).to.deep.equal(['Agent', 'LLM', 'Tool', 'Retriever']);
  });

  it('filters the spans passed into lr-trace-tree when a filter legend item is toggled off, and reflects hiddenKinds', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    const toolItem = [...legend.shadowRoot!.querySelectorAll('[part~="item"]')].find((i) =>
      i.textContent!.includes('Tool'),
    ) as HTMLButtonElement;
    toolItem.click();
    await el.updateComplete;
    expect(el.hiddenKinds).to.deep.equal(['tool']);
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.spans.map((s) => s.id)).to.not.include('search');
    expect(tree.spans.length).to.equal(SPANS.length - 1);
  });

  it('bubbles lr-visibility-change from the composed lr-graph-legend out through lr-agent-trace', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    const toolItem = [...legend.shadowRoot!.querySelectorAll('[part~="item"]')].find((i) =>
      i.textContent!.includes('Tool'),
    ) as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-visibility-change');
    toolItem.click();
    const ev = await listener;
    expect(ev.detail.hiddenTypes).to.deep.equal(['tool']);
  });

  it('renders one handoff quick-jump entry per visible agent-kind span, composing lr-handoff-divider', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const handoffs = el.shadowRoot!.querySelectorAll('[part="handoff"]');
    expect(handoffs.length).to.equal(2);
    const dividers = el.shadowRoot!.querySelectorAll('lr-handoff-divider') as NodeListOf<LyraHandoffDivider>;
    expect(dividers.length).to.equal(2);
    // 'root' has no resolvable parent -> agent only. 'sub-agent's parent is 'root' -> from+to.
    const rootHandoff = [...dividers].find((d) => d.agent === 'Trip Planner')!;
    expect(rootHandoff.fromAgent).to.equal('');
    const subAgentHandoff = [...dividers].find((d) => d.agent === 'Research Agent')!;
    expect(subAgentHandoff.fromAgent).to.equal('Trip Planner');
    // Decorative here -- this component's own [part="handoff"] button already carries the
    // accessible name, so the divider itself is hidden from the accessibility tree rather than
    // firing its own mount-time live-region announcement redundantly for every entry at once.
    expect(dividers[0].getAttribute('aria-hidden')).to.equal('true');
  });

  it('gives each handoff button an accessible name built from the same handoffToAgent/handoffFromToAgent strings lr-handoff-divider itself uses', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part="handoff"]')] as HTMLButtonElement[];
    const rootButton = buttons.find((b) => b.getAttribute('aria-label') === 'Transferred to Trip Planner');
    expect(rootButton).to.exist;
    const subAgentButton = buttons.find(
      (b) => b.getAttribute('aria-label') === 'Transferred from Trip Planner to Research Agent',
    );
    expect(subAgentButton).to.exist;
  });

  it('omits the handoffs section entirely when there are no agent-kind spans', async () => {
    const noAgentSpans = SPANS.filter((s) => s.kind !== 'agent');
    const el = (await fixture(html`<lr-agent-trace .spans=${noAgentSpans}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="handoffs"]')).to.not.exist;
  });

  it('clicking a handoff entry sets activeSpanId, forwards it into lr-trace-tree, and emits lr-span-select', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part="handoff"]')] as HTMLButtonElement[];
    const subAgentButton = buttons.find((b) => b.getAttribute('aria-label')?.includes('Research Agent'))!;
    const listener = oneEvent(el, 'lr-span-select');
    subAgentButton.click();
    const ev = await listener;
    expect(ev.detail).to.deep.equal({ id: 'sub-agent' });
    expect(el.activeSpanId).to.equal('sub-agent');
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.activeSpanId).to.equal('sub-agent');
    expect(subAgentButton.getAttribute('aria-current')).to.equal('true');
  });

  it('keeps activeSpanId (and handoff highlighting) in sync when lr-span-select instead comes from the composed lr-trace-tree', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    const row = tree.shadowRoot!.querySelector('[data-id="sub-agent"]') as HTMLElement;
    const listener = oneEvent(el, 'lr-span-select');
    row.click();
    const ev = await listener;
    expect(ev.detail).to.deep.equal({ id: 'sub-agent' });
    expect(el.activeSpanId).to.equal('sub-agent');
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part="handoff"]')] as HTMLButtonElement[];
    const subAgentButton = buttons.find((b) => b.getAttribute('aria-label')?.includes('Research Agent'))!;
    expect(subAgentButton.getAttribute('aria-current')).to.equal('true');
  });

  it('bubbles lr-span-toggle from the composed lr-trace-tree out through lr-agent-trace unchanged', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    const toggle = tree.shadowRoot!.querySelector('[data-id="root"] [part="toggle"]') as HTMLElement;
    const listener = oneEvent(el, 'lr-span-toggle');
    toggle.click();
    const ev = await listener;
    expect(ev.detail).to.deep.equal({ id: 'root', expanded: false });
  });

  it('forwards show-tokens/show-cost/hide-bars to the composed lr-trace-tree', async () => {
    const el = (await fixture(
      html`<lr-agent-trace .spans=${SPANS} show-tokens show-cost hide-bars></lr-agent-trace>`,
    )) as LyraAgentTrace;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.showTokens).to.be.true;
    expect(tree.showCost).to.be.true;
    expect(tree.hideBars).to.be.true;
  });

  it('renders lr-trace-tree even with an empty spans array, deferring to its own empty state', async () => {
    const el = (await fixture(html`<lr-agent-trace></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.shadowRoot!.querySelector('lr-empty')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="filter"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="handoffs"]')).to.not.exist;
  });

  it('registers lr-trace-tree, lr-graph-legend, and lr-handoff-divider as a side effect of importing agent-trace.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement() -- only the barrel
    // (*.js) does. Rendering an un-registered dependency silently produces a plain, un-upgraded
    // HTMLElement instead of the real composed component.
    expect(customElements.get('lr-trace-tree')).to.exist;
    expect(customElements.get('lr-graph-legend')).to.exist;
    expect(customElements.get('lr-handoff-divider')).to.exist;
  });

  it('shrinks to a 320px allocation without horizontal overflow', async () => {
    const el = (await fixture(html`
      <lr-agent-trace style="inline-size: 320px; max-inline-size: 100%;" .spans=${SPANS}></lr-agent-trace>
    `)) as LyraAgentTrace;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(el.clientWidth + 1);
  });

  it('renders correctly under dir="rtl" and stays accessible', async () => {
    const el = (await fixture(html`
      <div dir="rtl"><lr-agent-trace .spans=${SPANS}></lr-agent-trace></div>
    `)) as HTMLElement;
    const trace = el.querySelector('lr-agent-trace') as LyraAgentTrace;
    await trace.updateComplete;
    expect(trace.shadowRoot!.querySelector('lr-trace-tree')).to.exist;
    await expect(trace).to.be.accessible();
  });

  it('is accessible with a populated, multi-kind span set including handoffs', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  // No empty-state axe assertion here: the empty state renders entirely through the composed
  // <lr-trace-tree>'s own `role="tree"` + <lr-empty> markup (confirmed reproducible on
  // <lr-trace-tree> alone, outside this component), so an empty-state accessibility regression
  // there belongs to that component's own test suite, not this one.
});
