import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from '../../lr-knowledge-graph-explorer.js';
import type { LyraGraph } from '../../lr-graph.js';
import type { LyraPathStrip } from '../../lr-path-strip.js';
import type { LyraPopover } from '../../lr-popover.js';
import type { LyraInput } from '../../lr-input.js';
import * as explorerStories from './knowledge-graph-explorer.stories.js';

const nodes = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];

it('keeps a removed query null while clearing the actual search surface and results', async () => {
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
    query="Alpha" .nodes=${nodes}
  ></lr-knowledge-graph-explorer>`);
  el.removeAttribute('query');
  await el.updateComplete;
  expect(el.query).to.equal(null);
  const input = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
  await input.updateComplete;
  expect(input.value).to.equal('');
  expect(el.shadowRoot!.querySelectorAll('[part="search-results"]').length).to.equal(0);
  el.setAttribute('query', '');
  await el.updateComplete;
  expect(el.query).to.equal('');
  el.setAttribute('query', 'Beta');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="search-result"]')!.textContent).to.include('Beta');
});

it('routes native path-node activation through selection, graph focus and details once', async () => {
  const path = [{ kind: 'node', node: nodes[0] }, { kind: 'edge', relation: 'knows' }, { kind: 'node', node: nodes[1] }];
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
    .nodes=${nodes} .edges=${[{ source: 'a', target: 'b' }]} .path=${path}
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
    expect(selections).to.deep.equal([{ selectedNodeId: 'b', selectedNodeIds: ['b'], selectedEdgeIds: [] }]);
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
  const wrapper = await fixture<HTMLDivElement>(html`<div>${explorerStories.PresetSearchQuery.render!({}, {} as never)}</div>`);
  const el = wrapper.querySelector<LyraKnowledgeGraphExplorer>('lr-knowledge-graph-explorer')!;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
  input.focus();
  await sendKeys({ press: 'Control+A' });
  await sendKeys({ type: 'einstein' });
  await el.updateComplete;
  expect(el.query).to.equal('einstein');
  expect(wrapper.querySelector('output')!.textContent).to.equal('einstein');
  expect(wrapper.querySelectorAll('output')[1]?.textContent).to.equal('0 (exact)');
});

it('leaves modified keys in the search results to the browser', async () => {
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer query="a" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="search-result"] button'));
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="search-result"] button')!;
  for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }]) {
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true, ...init });
    button.dispatchEvent(event);
    expect(event.defaultPrevented, JSON.stringify(init)).to.equal(false);
  }
});

it('keeps a canceled End key on the current search result', async () => {
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer query="a" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
  const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="search-result"] button');
  expect(buttons.length).to.equal(2);
  await focusByKeyboard(buttons[0]!);
  const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
  event.preventDefault();
  buttons[0]!.dispatchEvent(event);
  expect(el.shadowRoot!.activeElement === buttons[0]).to.equal(true);
});

it('finds an accented label from an unaccented query', async () => {
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer query="cafe"
    .nodes=${[{ id: 'c', label: 'Café' }, { id: 'o', label: 'Other' }]}></lr-knowledge-graph-explorer>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="search-result"]').length > 0);
  const results = [...el.shadowRoot!.querySelectorAll('[part="search-result"]')].map((r) => r.textContent!.trim());
  expect(results).to.have.length(1);
  expect(results[0]).to.include('Café');
});

it('falls back to a localized group name for whitespace and preserves an explicit empty label', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-knowledge-graph-explorer']>(html`<lr-knowledge-graph-explorer label="   "></lr-knowledge-graph-explorer>`);
  const name = () => el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label');
  expect(name()).to.equal('Knowledge graph explorer');
  el.label = '';
  await el.updateComplete;
  expect(name()).to.equal('');
});

it('lets a host veto or accept the proposed hidden types before the legend commits', async () => {
  const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer .nodeTypes=${[{id:'topic',label:'Topic'}]}></lr-knowledge-graph-explorer>`);
  const legend = el.shadowRoot!.querySelector('lr-graph-legend')!;
  const button = legend.shadowRoot!.querySelector('button')!;
  const proposals: string[][] = [];
  el.addEventListener('lr-hidden-types-change-request', event => {
    proposals.push((event as CustomEvent<{hiddenTypes:string[]}>).detail.hiddenTypes);
    if (proposals.length === 1) event.preventDefault();
  });
  button.click();
  expect(el.hiddenTypes).to.deep.equal([]);
  expect(legend.hiddenTypes).to.deep.equal([]);
  button.click();
  expect(proposals).to.deep.equal([['topic'], ['topic']]);
  expect(el.hiddenTypes).to.deep.equal(['topic']);
});

for (const change of ['hidden', 'types', 'detach'] as const) {
  it(`retires a legend proposal when a host changes ${change} during the request`, async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
      .nodeTypes=${[{ id: 'topic', label: 'Topic' }]}></lr-knowledge-graph-explorer>`);
    const legend = el.shadowRoot!.querySelector('lr-graph-legend')!;
    let commits = 0;
    el.addEventListener('lr-hidden-types-change', () => commits++);
    el.addEventListener('lr-hidden-types-change-request', () => {
      if (change === 'hidden') el.hiddenTypes = ['other'];
      if (change === 'types') el.nodeTypes = [];
      if (change === 'detach') el.remove();
    });
    legend.shadowRoot!.querySelector('button')!.click();
    expect(commits).to.equal(0);
    expect(el.hiddenTypes).to.deep.equal(change === 'hidden' ? ['other'] : []);
  });
}

it('keeps people visible and lets other types toggle in the legend request story', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>${explorerStories.KeepPeopleVisible.render!({}, {} as never)}</div>`);
  const explorer = wrapper.querySelector<LyraKnowledgeGraphExplorer>('lr-knowledge-graph-explorer')!;
  await explorer.updateComplete;
  const legend = explorer.shadowRoot!.querySelector('lr-graph-legend')!;
  await legend.updateComplete;
  const buttons = [...legend.shadowRoot!.querySelectorAll('button')];
  buttons.find(button => button.textContent?.includes('Person'))!.click();
  expect(explorer.hiddenTypes).to.deep.equal([]);
  buttons.find(button => button.textContent?.includes('Organization'))!.click();
  expect(explorer.hiddenTypes).to.deep.equal(['org']);
});
