import { resolvedInShadow } from '../../../../test/shadow-style.js';
import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './agent-trace.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
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

  it('preserves incomplete spans through the composed trace tree', async () => {
    const spans: LyraSpan[] = [{ id: 'stopped', name: 'Search', kind: 'tool', startMs: 0, endMs: 40, status: 'incomplete' }];
    const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${spans}></lr-agent-trace>`);
    const tree = el.shadowRoot!.querySelector<LyraTraceTree>('lr-trace-tree')!;
    await tree.updateComplete;
    expect(tree.spans[0]!.status).to.equal('incomplete');
    expect(tree.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Incomplete');
  });

  it('retains and reuses the one-read shared span projection without re-reading admitted source rows', async () => {
    const source: LyraSpan = {
      id: 'safe',
      name: 'Safe span',
      kind: 'tool',
      startMs: 0,
      status: 'success',
    };
    const el = await fixture<LyraAgentTrace>(html`
      <lr-agent-trace .spans=${[source]}></lr-agent-trace>
    `);
    await el.updateComplete;
    expect(el.spans[0] === source).to.equal(true);
    const tree = el.shadowRoot!.querySelector<LyraTraceTree>('lr-trace-tree')!;
    expect(tree.shadowRoot!.querySelector('[part="row"]')?.getAttribute('data-id')).to.equal('safe');

    let sourceReads = 0;
    Object.defineProperty(source, 'name', {
      configurable: true,
      get: () => {
        sourceReads += 1;
        throw new Error('admitted span sources must stay opaque after projection');
      },
    });
    el.label = 'Trace';
    await el.updateComplete;

    expect(sourceReads).to.equal(0);
    expect(tree.shadowRoot!.querySelector('[part="row"]')?.getAttribute('data-id')).to.equal('safe');
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

  it('refreshes the projected tree after mutating a span and reassigning the same source array', async () => {
    const spans: LyraSpan[] = [{ id: 'agent', name: 'Before', kind: 'agent', startMs: 0, status: 'running' }];
    const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${spans}></lr-agent-trace>`);
    const tree = el.shadowRoot!.querySelector<LyraTraceTree>('lr-trace-tree')!;
    expect(tree.shadowRoot!.querySelector('[part="name"]')?.textContent).to.equal('Before');

    spans[0]!.name = 'After';
    el.spans = spans;
    await el.updateComplete;
    await tree.updateComplete;
    expect(tree.shadowRoot!.querySelector('[part="name"]')?.textContent).to.equal('After');
  });

  it('does not re-project source descriptors for an unrelated workspace label update', async () => {
    const source: LyraSpan = { id: 'agent', name: 'Agent', kind: 'agent', startMs: 0, status: 'running' };
    const spans = [source];
    const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${spans}></lr-agent-trace>`);
    const original = Object.getOwnPropertyDescriptor;
    let descriptorReads = 0;
    Object.getOwnPropertyDescriptor = ((target: object, key: PropertyKey) => {
      if (target === source) descriptorReads++;
      return original.call(Object, target, key);
    }) as typeof Object.getOwnPropertyDescriptor;
    try {
      el.label = 'Updated label';
      await el.updateComplete;
      expect(descriptorReads).to.equal(0);
      el.spans = spans;
      await el.updateComplete;
      expect(descriptorReads).to.be.greaterThan(0);
    } finally {
      Object.getOwnPropertyDescriptor = original;
    }
  });

  it('reuses legend types on unrelated updates and refreshes localized kind labels', async () => {
    const spans: LyraSpan[] = [{ id: 'agent', name: 'Agent', kind: 'agent', startMs: 0, status: 'running' }];
    const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${spans}></lr-agent-trace>`);
    const legend = el.shadowRoot!.querySelector<LyraGraphLegend>('lr-graph-legend')!;
    const initialTypes = legend.types;
    el.label = 'Updated trace';
    await el.updateComplete;
    expect(legend.types === initialTypes).to.equal(true);

    el.strings = { spanKindAgent: 'Delegate' };
    await el.updateComplete;
    expect(legend.types === initialTypes).to.equal(false);
    expect(legend.types[0]!.label).to.equal('Delegate');

    spans[0]!.kind = 'tool';
    el.spans = spans;
    await el.updateComplete;
    expect(legend.types.map((type) => type.id)).to.deep.equal(['tool']);
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
    const root = tree.shadowRoot!;
    expect(root.querySelectorAll('[part="row"]').length).to.be.at.most(500);
    expect(root.querySelectorAll('[data-id="span-0"]')).to.have.length(1);
    expect(root.querySelector('[data-id="span-1"]')!.getAttribute('aria-label')).to.contain('Other');
    expect(root.querySelector('[data-id="span-2"] [part="status-text"]')!.textContent).to.equal('Unknown');
    expect(root.querySelector('[data-id="span-2"] [part="status-text"]')!.getAttribute('data-status')).to.equal('unknown');
    expect(root.querySelector('[data-id="not-finite"]') === null).to.equal(true);
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

  it('hides a kind in lr-trace-tree when a filter legend item is toggled off, and reflects hiddenKinds', async () => {
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
    await tree.updateComplete;
    expect(tree.hiddenKinds).to.deep.equal(['tool']);
    expect(tree.shadowRoot!.querySelector('[data-id="search"]') === null).to.equal(true);
    expect(tree.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(SPANS.length - 1);
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

  it('contains the canonical child visibility proposal without canceling its eventual commit', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    const toolItem = [...legend.shadowRoot!.querySelectorAll('[part~="item"]')].find((item) =>
      item.textContent!.includes('Tool'),
    ) as HTMLButtonElement;
    let leakedProposals = 0;
    let childProposals = 0;
    let childCommits = 0;
    let wrapperCommits = 0;
    el.addEventListener('lr-visibility-change-request', () => leakedProposals += 1);
    legend.addEventListener('lr-visibility-change-request', () => childProposals += 1);
    legend.addEventListener('lr-visibility-change', () => childCommits += 1);
    el.addEventListener('lr-span-visibility-change', () => wrapperCommits += 1);

    toolItem.click();
    await el.updateComplete;

    expect(leakedProposals).to.equal(0);
    expect(childProposals).to.equal(1);
    expect(childCommits).to.equal(1);
    expect(wrapperCommits).to.equal(1);
    expect(el.hiddenKinds).to.deep.equal(['tool']);
  });

  it('contains the canonical lr-visibility-change-request proposal from native pointer and keyboard activation', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    const toolItem = [...legend.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="item"]')].find((item) =>
      item.textContent!.includes('Tool'),
    )!;
    const proposalNames = ['lr-visibility-change-request'];
    const leaked: string[] = [];
    const onHost = (event: Event): void => {
      leaked.push(`host:${event.type}`);
    };
    const onDocument = (event: Event): void => {
      leaked.push(`document:${event.type}`);
    };
    const proposals: CustomEvent<{ hiddenTypes: string[] }>[] = [];
    const notifications: string[][] = [];
    legend.addEventListener('lr-visibility-change-request', (event) => {
      proposals.push(event as CustomEvent<{ hiddenTypes: string[] }>);
    });
    el.addEventListener('lr-span-visibility-change', (event) => {
      notifications.push([...(event as CustomEvent<{ hiddenKinds: string[] }>).detail.hiddenKinds]);
    });
    for (const name of proposalNames) {
      el.addEventListener(name, onHost);
      document.addEventListener(name, onDocument);
    }
    try {
      await resetMouse();
      toolItem.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = toolItem.getBoundingClientRect();
      await sendMouse({
        type: 'click',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => el.hiddenKinds.join(',') === 'tool', 'native pointer activation did not commit');

      toolItem.focus();
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => el.hiddenKinds.length === 0, 'keyboard activation did not commit');
    } finally {
      await resetMouse();
      for (const name of proposalNames) {
        el.removeEventListener(name, onHost);
        document.removeEventListener(name, onDocument);
      }
    }

    expect(leaked).to.deep.equal([]);
    expect(proposals.map((event) => [...event.detail.hiddenTypes])).to.deep.equal([['tool'], []]);
    expect(
      proposals.map((event) => event.defaultPrevented),
      'containment never cancels the child proposal',
    ).to.deep.equal([false, false]);
    expect(notifications).to.deep.equal([['tool'], []]);
  });

  it('keeps a legend-level veto of the canonical proposal authoritative while containing it', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('lr-graph-legend') as LyraGraphLegend;
    const toolItem = [...legend.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="item"]')].find((item) =>
      item.textContent!.includes('Tool'),
    )!;
    const leaked: string[] = [];
    const onHost = (event: Event): void => {
      leaked.push(`host:${event.type}`);
    };
    const onDocument = (event: Event): void => {
      leaked.push(`document:${event.type}`);
    };
    const vetoes: boolean[] = [];
    let childCommits = 0;
    let wrapperNotifications = 0;
    legend.addEventListener('lr-visibility-change-request', (event) => {
      event.preventDefault();
      vetoes.push(event.defaultPrevented);
    });
    legend.addEventListener('lr-visibility-change', () => childCommits += 1);
    el.addEventListener('lr-span-visibility-change', () => wrapperNotifications += 1);
    el.addEventListener('lr-visibility-change-request', onHost);
    document.addEventListener('lr-visibility-change-request', onDocument);
    try {
      toolItem.focus();
      await sendKeys({ press: 'Space' });
      await waitUntil(() => vetoes.length === 1, 'keyboard activation did not propose a change');
      await el.updateComplete;
      await legend.updateComplete;
    } finally {
      el.removeEventListener('lr-visibility-change-request', onHost);
      document.removeEventListener('lr-visibility-change-request', onDocument);
    }

    expect(vetoes).to.deep.equal([true]);
    expect(leaked).to.deep.equal([]);
    expect(childCommits).to.equal(0);
    expect(wrapperNotifications).to.equal(0);
    expect(el.hiddenKinds).to.deep.equal([]);
    expect(legend.hiddenTypes).to.deep.equal([]);
    expect(toolItem.getAttribute('aria-pressed')).to.equal('true');
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.spans.map((span) => span.id)).to.include('search');
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
    expect(dividers[0]!.getAttribute('aria-hidden')).to.equal('true');
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

  it('defaults withoutBars to false and forwards it to the composed lr-trace-tree', async () => {
    const el = (await fixture(html`<lr-agent-trace .spans=${SPANS}></lr-agent-trace>`)) as LyraAgentTrace;
    await el.updateComplete;
    expect(el.withoutBars).to.be.false;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.withoutBars).to.be.false;
  });

  it('forwards with-tokens, with-cost and without-bars to the composed lr-trace-tree', async () => {
    const el = (await fixture(
      html`<lr-agent-trace .spans=${SPANS} with-tokens with-cost without-bars></lr-agent-trace>`,
    )) as LyraAgentTrace;
    await el.updateComplete;
    expect(el.withoutBars).to.be.true;
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    expect(tree.withTokens).to.be.true;
    expect(tree.withCost).to.be.true;
    expect(tree.withoutBars).to.be.true;
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

  it('shows the span limit notice and keeps the bars on the whole trace while a kind is hidden', async () => {
    const spans: LyraSpan[] = [
      ...Array.from({ length: 500 }, (_unused, index) => ({
        id: `early-${index}`, name: `Early ${index}`, kind: index === 0 ? ('llm' as const) : ('tool' as const),
        startMs: 0, endMs: 1000, status: 'success' as const,
      })),
      { id: 'late', name: 'Late', kind: 'tool', startMs: 9000, endMs: 10_000, status: 'success' },
    ];
    const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${spans} .hiddenKinds=${['llm']}></lr-agent-trace>`);
    const tree = el.shadowRoot!.querySelector('lr-trace-tree') as LyraTraceTree;
    await tree.updateComplete;
    expect(tree.shadowRoot!.querySelector('[part="limit"]') !== null).to.equal(true);
    expect(tree.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('style')).to.contain('inline-size:10%');
  });

  it('keeps a handoff entry on its own span when an earlier agent span is added', async () => {
    const agents: LyraSpan[] = [
      { id: 'a1', name: 'Planner', kind: 'agent', status: 'success', startMs: 1 },
      { id: 'a2', name: 'Writer', kind: 'agent', status: 'success', startMs: 2 },
    ];
    const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${agents}></lr-agent-trace>`);
    const before = el.shadowRoot!.querySelectorAll('[part="handoff"]')[1];
    el.spans = [{ id: 'a0', name: 'Router', kind: 'agent', status: 'success', startMs: 0 }, ...agents];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="handoff"]')[2] === before).to.equal(true);
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
        html`<lr-agent-trace
          style="--lr-transition-fast: 0s;"
          .spans=${SPANS}
          .activeSpanId=${'sub-agent'}
        ></lr-agent-trace>`,
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

describe('active-handoff pointer feedback', () => {

  async function themed(): Promise<LyraAgentTrace> {
    const el = (await fixture(html`
      <lr-agent-trace
        style="--lr-transition-fast: 0s; --lr-agent-trace-handoff-active-bg: rgb(0, 51, 102);"
        .spans=${SPANS}
        .activeSpanId=${'sub-agent'}
      ></lr-agent-trace>
    `)) as LyraAgentTrace;
    await el.updateComplete;
    return el;
  }

  async function moveMouseTo(target: HTMLElement): Promise<void> {
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
  }

  it('deepens the ACTIVE handoff entry while it is held', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await themed();
    const active = el.shadowRoot!.querySelector('[part="handoff"][data-active]') as HTMLElement;
    expect(active != null, 'expected an active handoff entry').to.equal(true);
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(0, 51, 102)');
    const held = resolvedInShadow(
      el,
      'background: color-mix(in oklab, rgb(0, 51, 102), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
      'background-color',
    );
    expect(held).to.not.equal('rgb(0, 51, 102)');

    try {
      await resetMouse();
      await moveMouseTo(active);
      // The active entry deliberately keeps its own fill while merely hovered -- the active
      // treatment is the point, and hover already reads on every other entry.
      expect(getComputedStyle(active).backgroundColor).to.equal('rgb(0, 51, 102)');
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(active).backgroundColor === held,
        'the held active handoff entry kept its resting fill',
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('deepens an INACTIVE handoff entry while it is held -- the contrast case', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await themed();
    const inactive = el.shadowRoot!.querySelector('[part="handoff"]:not([data-active])') as HTMLElement;
    const held = resolvedInShadow(
      el,
      'background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))',
      'background-color',
    );

    try {
      await resetMouse();
      await moveMouseTo(inactive);
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(inactive).backgroundColor === held,
        'the held inactive handoff entry kept its resting fill',
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it("restores the active entry's resting fill once the pointer is released", async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await themed();
    const active = el.shadowRoot!.querySelector('[part="handoff"][data-active]') as HTMLElement;
    try {
      await resetMouse();
      await moveMouseTo(active);
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(active).backgroundColor !== 'rgb(0, 51, 102)',
        'the held active handoff entry kept its resting fill',
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
    await waitUntil(
      () => getComputedStyle(active).backgroundColor === 'rgb(0, 51, 102)',
      'the released active handoff entry never returned to its active fill',
    );
  });
});
