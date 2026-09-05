import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.js';
import type { LyraGraph } from '../graph/graph.js';
import type { LyraPathStrip } from '../path-strip/path-strip.js';
import type { LyraPopover } from '../../overlays/overlay/popover.js';
import type { LyraInput } from '../../forms/input/input.js';
import { PresetSearchQuery } from './knowledge-graph-explorer.stories.js';

const nodes = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];

it('keeps a removed search-query null while clearing the actual search surface and results', async () => {
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
    search-query="Alpha" .nodes=${nodes}
  ></lr-knowledge-graph-explorer>`);
  el.removeAttribute('search-query');
  await el.updateComplete;
  expect(el.searchQuery).to.equal(null);
  const input = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
  await input.updateComplete;
  expect(input.value).to.equal('');
  expect(el.shadowRoot!.querySelectorAll('[part="search-results"]').length).to.equal(0);
  el.setAttribute('search-query', '');
  await el.updateComplete;
  expect(el.searchQuery).to.equal('');
  el.setAttribute('search-query', 'Beta');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="search-result"]')!.textContent).to.include('Beta');
});

it('routes native path-node activation through selection, graph focus and details once', async () => {
  const path = [{ kind: 'node', node: nodes[0] }, { kind: 'edge', relation: 'knows' }, { kind: 'node', node: nodes[1] }];
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
    .nodes=${nodes} .links=${[{ source: 'a', target: 'b' }]} .path=${path}
  ></lr-knowledge-graph-explorer>`);
  const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
  await waitUntil(() => graph.shadowRoot!.querySelectorAll('[part="node"]').length === 2, 'graph nodes render', { timeout: 5000 });
  const strip = el.shadowRoot!.querySelector<LyraPathStrip>('[part="path"]')!;
  await strip.updateComplete;
  const selections: unknown[] = [];
  let raw = 0;
  const relations: unknown[] = [];
  el.addEventListener('lr-selection-change', event => selections.push((event as CustomEvent).detail));
  el.addEventListener('lr-entity-activate', () => raw++);
  el.addEventListener('lr-relation-activate', event => relations.push((event as CustomEvent).detail));
  const target = strip.shadowRoot!.querySelectorAll<HTMLElement>('[part="node"]')[1]!;
  try {
    await hoverUntilMatched(target, 'path target is hovered');
    const rect = target.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
    await waitUntil(() => el.selectedNodeId === 'b', 'path selects Beta');
    const popover = el.shadowRoot!.querySelector<LyraPopover>('lr-popover')!;
    await waitUntil(() => popover.open, 'selected entity details open');
    expect(selections).to.deep.equal([{ selectedNodeId: 'b' }]);
    expect(raw).to.equal(0);
    expect(graph.selectedNodeIds).to.deep.equal(['b']);
    expect(el.shadowRoot!.querySelector('lr-entity-card')!.entity?.label).to.equal('Beta');
    const relation = strip.shadowRoot!.querySelector<HTMLElement>('[part="relation"]')!;
    relation.click();
    expect(relations).to.deep.equal([{ relation: 'knows', sourceNodeId: 'a', targetNodeId: 'b', occurrenceIndex: 1 }]);
    expect(selections.length).to.equal(1);
  } finally {
    await resetMouse();
  }
});

it('the actual preset-search story displays canonical query and match metadata after native input', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>${PresetSearchQuery.render!({}, {} as never)}</div>`);
  const el = wrapper.querySelector<LyraKnowledgeGraphExplorer>('lr-knowledge-graph-explorer')!;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
  input.focus();
  await sendKeys({ press: 'Control+A' });
  await sendKeys({ type: 'einstein' });
  await el.updateComplete;
  expect(el.searchQuery).to.equal('einstein');
  expect(wrapper.querySelector('output')!.textContent).to.equal('einstein');
  expect(wrapper.querySelectorAll('output')[1]?.textContent).to.equal('0 (exact)');
});
