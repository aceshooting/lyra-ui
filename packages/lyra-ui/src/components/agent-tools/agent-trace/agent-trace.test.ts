import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './agent-trace.js';
import type { LyraAgentTrace } from './agent-trace.js';
import type { LyraSpan } from '../trace-tree/span.js';
import type { LyraTraceTree } from '../trace-tree/trace-tree.class.js';
import type { LyraGraphLegend } from '../../retrieval/graph-legend/graph-legend.class.js';
import type { LyraHandoffDivider } from '../../conversation/handoff-divider/handoff-divider.class.js';

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

  it('leaves its own label unset by default so the composed tree falls back to its localized name', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    expect(el.label).to.be.undefined;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.label).to.be.undefined;
    expect(tree.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Trace tree');
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

  it('shares trace-tree normalization: invalid/duplicate spans cannot escape the 500-row projection', async () => {
    const many = Array.from({ length: 520 }, (_, index): LyraSpan => ({
      id: `span-${index}`,
      name: `Span ${index}`,
      kind: index === 1 ? ('foreign-kind' as LyraSpan['kind']) : index === 0 ? 'agent' : 'tool',
      status: index === 2 ? ('foreign-status' as LyraSpan['status']) : 'success',
      startMs: index,
    }));
    const malformed = [
      many[0],
      { ...many[0]!, name: 'duplicate must be ignored' },
      { ...many[3]!, id: 'not-finite', startMs: Number.NaN },
      null,
      ...many.slice(1),
    ] as unknown as LyraSpan[];
    const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${malformed}></lr-agent-trace>`);
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.spans.length).to.be.at.most(500);
    expect(tree.spans.filter((span) => span.id === 'span-0')).to.have.length(1);
    expect(tree.spans.find((span) => span.id === 'span-1')!.kind).to.equal('other');
    expect(tree.spans.find((span) => span.id === 'span-2')!.status).to.equal('pending');
    expect(tree.spans.some((span) => span.id === 'not-finite')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="handoff"]')).to.have.length(1);
  });

  it('names the span-kind filter as a trace filter instead of a graph legend', async () => {
    const el = (await fixture(html`
      <lr-agent-trace
        .spans=${SPANS}
        .strings=${{ agentTraceFilterLabel: 'Trace categories' }}
      ></lr-agent-trace>
    `)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    await legend.updateComplete;
    expect(legend.label).to.equal('Trace categories');
    expect(legend.shadowRoot!.querySelector('[role="group"]')!.getAttribute('aria-label')).to.equal(
      'Trace categories',
    );
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

  it('contains the graph event and emits the agent-owned span visibility contract', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    const toolItem = [...legend.shadowRoot!.querySelectorAll('[part~="item"]')].find((i) =>
      i.textContent!.includes('Tool'),
    ) as HTMLButtonElement;
    let rawEvents = 0;
    el.addEventListener('lr-visibility-change', () => rawEvents++);
    const listener = oneEvent(el, 'lr-span-visibility-change');
    toolItem.click();
    const ev = await listener;
    expect(ev.detail.hiddenKinds).to.deep.equal(['tool']);
    expect(rawEvents).to.equal(0);
  });

  it('renders one handoff quick-jump entry per visible agent-kind span, composing lr-handoff-divider', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const handoffs = el.shadowRoot!.querySelectorAll('[part="handoff"]');
    expect(handoffs.length).to.equal(2);
    const dividers = el.shadowRoot!.querySelectorAll('lr-handoff-divider') as NodeListOf<LyraHandoffDivider>;
    expect(dividers.length).to.equal(2);
    // 'root' has no resolvable parent -> agent only. 'sub-agent's parent is 'root' -> from+to.
    const rootHandoff = [...dividers].find((d) => d.toAgent === 'Trip Planner')!;
    expect(rootHandoff.fromAgent).to.equal('');
    const subAgentHandoff = [...dividers].find((d) => d.toAgent === 'Research Agent')!;
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
    expect((rootButton) != null).to.equal(true);
    const subAgentButton = buttons.find(
      (b) => b.getAttribute('aria-label') === 'Transferred from Trip Planner to Research Agent',
    );
    expect((subAgentButton) != null).to.equal(true);
  });

  it('does not announce a direct non-agent parent as the source agent of a handoff', async () => {
    const spans: LyraSpan[] = [
      { id: 'root', name: 'Planner', kind: 'agent', startMs: 0, endMs: 100, status: 'success' },
      { id: 'model', parentId: 'root', name: 'Model step', kind: 'llm', startMs: 10, endMs: 80, status: 'success' },
      { id: 'child', parentId: 'model', name: 'Researcher', kind: 'agent', startMs: 20, endMs: 70, status: 'success' },
    ];
    const el = (await fixture(html`<lr-agent-trace .spans=${spans}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const child = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="handoff"]')].find(
      (button) => button.getAttribute('aria-label')?.includes('Researcher'),
    )!;
    expect(child.getAttribute('aria-label')).to.equal('Transferred to Researcher');
    const divider = child.querySelector('lr-handoff-divider') as LyraHandoffDivider;
    expect(divider.fromAgent).to.equal('');
  });

  it('applies localized handoff accessible names', async () => {
    const el = (await fixture(html`
      <lr-agent-trace
        .spans=${SPANS}
        .strings=${{
          handoffToAgent: 'Transféré vers {agent}',
          handoffFromToAgent: 'Transféré de {from} vers {to}',
        }}
      ></lr-agent-trace>
    `)) as LyraAgentTrace;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part="handoff"]')] as HTMLButtonElement[];
    expect((buttons.find((button) => button.getAttribute('aria-label') === 'Transféré vers Trip Planner')) != null).to.equal(true);
    expect((buttons.find((button) => button.getAttribute('aria-label') === 'Transféré de Trip Planner vers Research Agent')) != null).to.equal(true);
  });

  it('omits the handoffs section entirely when there are no agent-kind spans', async () => {
    const noAgentSpans = SPANS.filter((s) => s.kind !== 'agent');
    const el = (await fixture(html`<lr-agent-trace .spans=${noAgentSpans}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="handoffs"]')) == null).to.be.true;
  });

  it('clicking a handoff entry sets activeSpanId, forwards it into lr-trace-tree, and emits lr-span-select', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part="handoff"]')] as HTMLButtonElement[];
    const subAgentButton = buttons.find((b) => b.getAttribute('aria-label')?.includes('Research Agent'))!;
    expect(subAgentButton.getAttribute('aria-current')).to.equal('false');
    const listener = oneEvent(el, 'lr-span-select');
    subAgentButton.click();
    const ev = await listener;
    expect(ev.detail).to.deep.equal({ spanId: 'sub-agent' });
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
    expect(ev.detail).to.deep.equal({ spanId: 'sub-agent' });
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
    expect(ev.detail).to.deep.equal({ spanId: 'root', expanded: false });
  });

  it('defaults showBars to true and forwards the inverse to the composed lr-trace-tree', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    expect(el.showBars).to.be.true;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.hideBars).to.be.false;
  });

  it('parses the literal show-bars="false" attribute and forwards hide-bars to the composed lr-trace-tree', async () => {
    const el = (await fixture(
      html`<lr-agent-trace .spans=${SPANS} show-tokens show-cost show-bars="false"></lr-agent-trace>`,
    )) as LyraAgentTrace;
    await el.updateComplete;
    expect(el.showBars).to.be.false;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.showTokens).to.be.true;
    expect(tree.showCost).to.be.true;
    expect(tree.hideBars).to.be.true;
  });

  it('keeps a controlled active path beyond the shared projection boundary in the composed tree', async () => {
    const fillers: LyraSpan[] = Array.from({ length: 500 }, (_, index) => ({
      id: `filler-${index}`,
      name: `Filler ${index}`,
      kind: 'tool',
      status: 'success',
      startMs: index,
    }));
    const el = await fixture<LyraAgentTrace>(html`
      <lr-agent-trace
        .spans=${[
          ...fillers,
          { id: 'reserved-parent', name: 'Reserved parent', kind: 'agent', status: 'success', startMs: 501 },
          {
            id: 'reserved-active',
            parentId: 'reserved-parent',
            name: 'Reserved active',
            kind: 'tool',
            status: 'running',
            startMs: 502,
          },
        ]}
        .activeSpanId=${'reserved-active'}
      ></lr-agent-trace>
    `);
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    await tree.updateComplete;

    expect(tree.shadowRoot!.querySelectorAll('[part="row"]')).to.have.length(500);
    expect(tree.shadowRoot!.querySelector('[data-id="reserved-parent"]') !== null).to.equal(true);
    expect(tree.shadowRoot!.querySelector('[data-id="reserved-active"]')?.getAttribute('aria-current')).to.equal('true');
  });

  it('renders lr-trace-tree even with an empty spans array, deferring to its own empty state', async () => {
    const el = (await fixture(html`<lr-agent-trace></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.shadowRoot!.querySelector('lr-empty')).to.exist;
    expect((el.shadowRoot!.querySelector('[part="filter"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="handoffs"]')) == null).to.be.true;
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

  describe('--lr-agent-trace-handoff-active-bg', () => {
    const activeFixture = async (): Promise<LyraAgentTrace> => {
      const el = (await fixture(
        html`<lr-agent-trace .spans=${SPANS} .activeSpanId=${'sub-agent'}></lr-agent-trace>`,
      )) as LyraAgentTrace;
      await el.updateComplete;
      return el;
    };

    it('retints only the active handoff entry via the cssprop', async () => {
      const el = await activeFixture();
      el.style.setProperty('--lr-agent-trace-handoff-active-bg', 'rgb(10, 20, 30)');
      const active = el.shadowRoot!.querySelector('[part="handoff"][data-active]') as HTMLElement;
      const inactive = el.shadowRoot!.querySelector('[part="handoff"]:not([data-active])') as HTMLElement;
      expect((active) != null).to.equal(true);
      expect(getComputedStyle(active).backgroundColor).to.equal('rgb(10, 20, 30)');
      expect(getComputedStyle(inactive).backgroundColor).to.not.equal('rgb(10, 20, 30)');
    });

    it('renders byte-identically to the brand-quiet token default when unset', async () => {
      const el = await activeFixture();
      const active = el.shadowRoot!.querySelector('[part="handoff"][data-active]') as HTMLElement;
      const unset = getComputedStyle(active).backgroundColor;
      el.style.setProperty('--lr-agent-trace-handoff-active-bg', 'var(--lr-color-brand-quiet)');
      expect(getComputedStyle(active).backgroundColor).to.equal(unset);
    });

    it('is accessible with the matching composed trace-tree row active', async () => {
      const el = await activeFixture();
      await expect(el).to.be.accessible();
    });
  });
});
