import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraHierarchyRow, LyraTraceSourceSummary } from '../../../data-sources.js';
import type { LyraAgentTrace } from './agent-trace.class.js';
import type { LyraTraceTree } from '../trace-tree/trace-tree.class.js';
import type { LyraSpan } from '../trace-tree/span.js';
import type { LyraGraphLegend } from '../../retrieval/graph-legend/graph-legend.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './agent-trace.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning('virtual-list-scroll-scaling');

type Source = LyraHierarchySource<LyraSpan, LyraHierarchyQuery, LyraTraceSourceSummary>;
type Trace = LyraAgentTrace & { treeSource: Source | undefined; revealSourceKey(key: string): Promise<boolean> };
const count = 1_000_000;
function span(index: number): LyraSpan { return { id: `span${index}`, name: `Span ${index}`, kind: 'agent', status: 'success', startMs: 110, endMs: 120 }; }
function provider() {
  const actions: string[] = []; const queries: string[][] = []; let reads = 0;
  const source: Source = { revision: 1, async project(request) {
    actions.push(request.action.type); queries.push([...request.query.hiddenKinds]);
    return { state: String(actions.length), total: count, summary: { startMs: 100, endMs: 200 },
      rows: { count, keyAt: index => `span${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(4)),
        itemAt(index): LyraHierarchyRow<LyraSpan> { reads++; return { key: `span${index}`, value: span(index),
          parentKey: null, level: 1, position: index + 1, setSize: count, childCount: 1, expanded: false, selected: false }; } },
      ...(request.action.type === 'reveal' && /^span\d+$/.test(request.action.key) ? { focusIndex: Number(request.action.key.slice(4)) } : {}) };
  } };
  return { source, actions, queries, reads: () => reads };
}
function tree(el: Trace): LyraTraceTree { return el.shadowRoot!.querySelector<LyraTraceTree>('lr-trace-tree')!; }
async function ready(el: Trace, key = 'span0') {
  await waitUntil(() => Boolean(tree(el)?.shadowRoot?.querySelector(`[data-source-key="${key}"]`)), 'provider row mounts');
}
it('forwards a generated million-span source to one child with the accepted global summary', async () => {
  const p = provider();
  const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source} .spans=${[span(0)]}></lr-agent-trace>`);
  await ready(el);
  expect(p.actions).to.deep.equal(['reset']);
  expect(await el.revealSourceKey('span999999')).to.equal(true); await ready(el, 'span999999');
  expect(el.shadowRoot!.querySelectorAll('lr-trace-tree').length).to.equal(1);
  expect(tree(el).treeSource === p.source).to.equal(true);
  expect(tree(el).shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.style.inlineSize).to.equal('10%');
  const mounted = tree(el).shadowRoot!.querySelectorAll('[data-source-key]').length;
  expect(mounted).to.be.at.most(301); expect(p.reads()).to.be.lessThan(500);
  recordScaleMeasurement('lr-agent-trace', 'forwarded million spans final key', { reads: p.reads(), mountedRows: mounted, projections: p.actions.length });
});
it('shows six global filter choices and no legacy handoff list in source mode', async () => {
  const p = provider();
  const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source} .spans=${[span(0)]}></lr-agent-trace>`);
  await ready(el);
  const legend = el.shadowRoot!.querySelector<LyraGraphLegend>('lr-graph-legend')!;
  expect(legend.types.map(item => item.id)).to.deep.equal(['agent', 'llm', 'tool', 'retriever', 'embedding', 'other']);
  expect(el.shadowRoot!.querySelector('[part="handoffs"]') === null).to.equal(true);
  el.hiddenKinds = ['tool']; await el.updateComplete;
  await waitUntil(() => p.queries.length === 2);
  expect(p.queries[1]).to.deep.equal(['tool']);
});
it('forwards accepted original events once and updates the wrapper active span', async () => {
  const p = provider(); const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source}></lr-agent-trace>`); await ready(el);
  const selected: string[] = []; const toggled: boolean[] = [];
  el.addEventListener('lr-span-select', event => selected.push(event.detail.spanId));
  el.addEventListener('lr-span-toggle', event => toggled.push(event.detail.expanded));
  tree(el).shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!.click();
  await waitUntil(() => selected.length === 1); await ready(el);
  expect(el.activeSpanId).to.equal('span0');
  await waitUntil(() => p.actions.includes('reveal')); await tree(el).updateComplete;
  tree(el).shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key] button')!.click();
  await waitUntil(() => toggled.length === 1);
  expect(selected).to.deep.equal(['span0']); expect(toggled).to.deep.equal([true]);
  expect(p.actions.filter(action => action === 'select').length).to.equal(1);
});
it('rejects retained legacy handoff controls immediately after source entry and after removal', async () => {
  const el = await fixture<Trace>(html`<lr-agent-trace .spans=${[span(0)]}></lr-agent-trace>`);
  const old = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="handoff"]')!;
  let events = 0; el.addEventListener('lr-span-select', () => events++);
  el.treeSource = provider().source; old.click(); expect(events).to.equal(0); await ready(el);
  el.treeSource = undefined; await el.updateComplete; old.click(); expect(events).to.equal(0);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="handoff"]')!.click(); expect(events).to.equal(1);
});

it('forwards keyless refresh and same-source rebind once while named presentation paints stay independent', async () => {
  const p = provider();
  const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source} .hiddenKinds=${['tool']}></lr-agent-trace>`); await ready(el);
  expect(p.actions).to.deep.equal(['reset']); expect(p.queries[0]).to.deep.equal(['tool']);
  el.label = 'Full trace'; el.withTokens = true; el.withCost = true; el.withoutBars = true;
  await el.updateComplete; await tree(el).updateComplete;
  expect(p.actions).to.deep.equal(['reset']);
  expect(tree(el).label).to.equal('Full trace'); expect(tree(el).withTokens).to.equal(true);
  expect(tree(el).withCost).to.equal(true); expect(tree(el).withoutBars).to.equal(true);
  const readyFocused = async () => {
    await ready(el, 'span500000');
    // Mounted rows precede navigation's focus commit, which the next refresh must preserve.
    const child = tree(el) as unknown as { sourceControl: { whenReady(): Promise<boolean> } };
    expect(await child.sourceControl.whenReady(), 'provider navigation completes').to.equal(true);
    expect(tree(el).shadowRoot!.querySelector('[data-source-key="span500000"]')?.matches(':focus'),
      'the revealed provider row receives focus').to.equal(true);
  };
  el.activeSpanId = 'span500000'; await readyFocused();
  expect(p.actions).to.deep.equal(['reset', 'reveal']);
  el.activeSpanId = null; await el.updateComplete;
  el.requestUpdate(); await waitUntil(() => p.actions.length === 3); await readyFocused();
  expect(p.actions[2]).to.equal('reset');
  el.treeSource = p.source; await waitUntil(() => p.actions.length === 4); await readyFocused();
  expect(p.actions[3]).to.equal('reset');
  Object.defineProperty(p.source, 'revision', { value: 2 });
  el.requestUpdate(); await waitUntil(() => p.actions.length === 5); await readyFocused();
  expect(p.actions[4]).to.equal('reset');
});
it('preserves the source filter proposal veto, exact commit and request containment', async () => {
  const p = provider(); const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source}></lr-agent-trace>`); await ready(el);
  const legend = el.shadowRoot!.querySelector<LyraGraphLegend>('lr-graph-legend')!;
  const button = () => [...legend.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="item"]')].find(item => item.textContent!.includes('Tool'))!;
  let leaked = 0; const commits: string[][] = [];
  el.addEventListener('lr-visibility-change-request', () => leaked++);
  el.addEventListener('lr-visibility-change', () => leaked++);
  el.addEventListener('lr-span-visibility-change', event => commits.push([...event.detail.hiddenKinds]));
  const veto = (event: Event) => event.preventDefault();
  legend.addEventListener('lr-visibility-change-request', veto);
  button().click(); await el.updateComplete;
  expect(p.actions.length).to.equal(1); expect(el.hiddenKinds).to.deep.equal([]); expect(commits).to.deep.equal([]);
  legend.removeEventListener('lr-visibility-change-request', veto);
  button().click(); await waitUntil(() => p.queries.length === 2); await ready(el);
  expect(p.queries[1]).to.deep.equal(['tool']); expect(commits).to.deep.equal([['tool']]); expect(leaked).to.equal(0);
});
it('never reads the legacy span model while a source is present and restores it on removal', async () => {
  const p = provider(); const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source} .spans=${[span(0)]}></lr-agent-trace>`); await ready(el);
  let reads = 0; const spans = el.spans;
  Object.defineProperty(el, 'spans', { get() { reads++; throw new Error('Unused legacy model'); }, configurable: true });
  el.label = 'Changed'; await el.updateComplete; await tree(el).updateComplete;
  expect(reads).to.equal(0); expect(tree(el).spans.length).to.equal(0);
  delete (el as unknown as { spans?: unknown }).spans;
  el.treeSource = undefined; await el.updateComplete; await tree(el).updateComplete;
  expect(el.spans === spans).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="handoff"]').length).to.equal(1);
  const legend = el.shadowRoot!.querySelector<LyraGraphLegend>('lr-graph-legend')!;
  expect(legend.types.map(type => type.id)).to.deep.equal(['agent']);
  expect(tree(el).shadowRoot!.querySelector('[data-id="span0"]') !== null).to.equal(true);
});
it('keeps invalid source presence authoritative and can reveal immediately after assignment', async () => {
  const el = await fixture<Trace>(html`<lr-agent-trace .spans=${[span(0)]} .treeSource=${null}></lr-agent-trace>`);
  await waitUntil(() => Boolean(tree(el).shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.querySelector('[part="handoff"]') === null).to.equal(true);
  el.treeSource = provider().source;
  expect(await el.revealSourceKey('span999999')).to.equal(true); await ready(el, 'span999999');
  expect(await el.revealSourceKey('missing')).to.equal(false);
});
it('preserves replacement authority when the forwarded provider revision getter reenters the wrapper', async () => {
  const p = provider(); const replacement = provider();
  const el = await fixture<Trace>(html`<lr-agent-trace></lr-agent-trace>`);
  let changed = false;
  Object.defineProperty(p.source, 'revision', { get() {
    if (!changed) { changed = true; el.treeSource = replacement.source; }
    return 1;
  } });
  el.treeSource = p.source; await ready(el);
  expect(el.treeSource === replacement.source).to.equal(true); expect(tree(el).treeSource === replacement.source).to.equal(true);
  expect(p.actions.length).to.equal(0); expect(replacement.actions).to.deep.equal(['reset']);
});
it('revokes wrapper filter notification if child forwarding replaces the provider', async () => {
  const p = provider(); const replacement = provider();
  let armed = false; let swapped = false; let el: Trace;
  Object.defineProperty(p.source, 'revision', { get() {
    if (armed) { armed = false; swapped = true; el.treeSource = replacement.source; }
    return 1;
  } });
  el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source}></lr-agent-trace>`); await ready(el);
  let events = 0; el.addEventListener('lr-span-visibility-change', () => events++);
  const legend = el.shadowRoot!.querySelector<LyraGraphLegend>('lr-graph-legend')!;
  armed = true;
  [...legend.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="item"]')].find(item => item.textContent!.includes('Tool'))!.click();
  await waitUntil(() => swapped); await ready(el);
  expect(events).to.equal(0); expect(tree(el).treeSource === replacement.source).to.equal(true);
  expect(replacement.queries[0]).to.deep.equal(['tool']);
});
it('lets accepted child events bubble once when a host listener replaces the provider', async () => {
  const p = provider(); const replacement = provider();
  const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source}></lr-agent-trace>`); await ready(el);
  let selected = 0;
  el.addEventListener('lr-span-select', () => { selected++; el.treeSource = replacement.source; });
  tree(el).shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!.click();
  await waitUntil(() => replacement.actions.length > 0); await ready(el);
  expect(selected).to.equal(1); expect(el.activeSpanId).to.equal('span0');
  expect(tree(el).treeSource === replacement.source).to.equal(true);
  expect(replacement.actions.filter(action => action === 'reset').length).to.equal(1);
});
it('keeps one bounded child request lane through ignored-abort replacement', async () => {
  let finish!: (value: Awaited<ReturnType<Source['project']>>) => void; let calls = 0;
  const slow: Source = { revision: 1, project() { calls++; return new Promise(resolve => { finish = resolve; }); } };
  const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${slow}></lr-agent-trace>`);
  await waitUntil(() => calls === 1);
  const replacement = provider();
  for (let i = 0; i < 100; i++) el.treeSource = replacement.source;
  await el.updateComplete; expect(replacement.actions.length).to.equal(0);
  finish({ state: 'old', total: 0, summary: { startMs: 0, endMs: 1 }, rows: { count: 0, keyAt: () => '', indexOfKey: () => -1, itemAt: () => { throw new Error('empty'); } } });
  await ready(el); expect(replacement.actions).to.deep.equal(['reset']);
});
it('reconnects and adopts through the same child without duplicate provider replay', async () => {
  const p = provider(); const el = await fixture<Trace>(html`<lr-agent-trace .treeSource=${p.source}></lr-agent-trace>`); await ready(el);
  const parent = el.parentNode!; const child = tree(el);
  el.remove(); parent.append(el); await waitUntil(() => p.actions.length === 2); await ready(el);
  expect(tree(el) === child).to.equal(true);
  const frame = document.createElement('iframe'); document.body.append(frame);
  try {
    const owner = frame.contentDocument!; owner.body.append(owner.adoptNode(el));
    await waitUntil(() => p.actions.length === 3); await ready(el);
    expect(tree(el) === child).to.equal(true); expect(tree(el).ownerDocument === owner).to.equal(true);
  } finally { parent.append(document.adoptNode(el)); frame.remove(); }
});
it('forwards source strings and inherits direction without creating another provider request', async () => {
  let calls = 0;
  const source: Source = { revision: 1, async project() { calls++; throw new Error('provider detail'); } };
  const el = await fixture<Trace>(html`<lr-agent-trace dir="rtl" .treeSource=${source}
    .strings=${{ treeSourceError: 'Trace offline', retry: 'Retry trace' }}></lr-agent-trace>`);
  await waitUntil(() => Boolean(tree(el).shadowRoot!.querySelector('[part~="source-error"]')));
  expect(tree(el).shadowRoot!.textContent).to.contain('Trace offline');
  expect(tree(el).shadowRoot!.textContent).to.contain('Retry trace');
  expect(getComputedStyle(tree(el)).direction).to.equal('rtl');
  el.strings = { treeSourceError: 'New trace wording' }; await el.updateComplete; await tree(el).updateComplete;
  expect(tree(el).shadowRoot!.textContent).to.contain('New trace wording'); expect(calls).to.equal(1);
});
it('revokes a legacy limit announcement if localization enters provider mode', async () => {
  const el = await fixture<Trace>(html`<lr-agent-trace></lr-agent-trace>`);
  const seam = el as unknown as { localize(key: string, ...args: unknown[]): string };
  const original = seam.localize; let labels = 0; let switched = false;
  seam.localize = (key, ...args) => {
    if (key === 'spanProjectionLimit' && !switched && ++labels === 2) {
      switched = true; el.treeSource = provider().source; return 'Obsolete handoff limit marker';
    }
    return original.call(el, key, ...args);
  };
  try {
    expectDevWarning(collectionTruncationWarningKey('lr-agent-trace', 'spans'));
    const warnings = await captureReentrantUpdateWarning('lr-agent-trace', async () => {
      el.spans = [span(0), ...Array.from({ length: 10000 }, () => ({} as LyraSpan))];
      await waitUntil(() => switched); await ready(el);
    });
    expect(warnings).to.equal(1);
    const text = Array.from(document.querySelectorAll('[aria-live]')).map(node => node.textContent).join(' ');
    expect(text).not.to.include('Obsolete handoff limit marker');
  } finally { seam.localize = original; }
});
