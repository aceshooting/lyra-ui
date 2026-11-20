import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-knowledge-graph-explorer.js';
import type { LyraKnowledgeGraphExplorer } from '../../lr-knowledge-graph-explorer.js';

const nodes = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }];

const resultButton = (el: LyraKnowledgeGraphExplorer, label: string): HTMLButtonElement =>
  [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="search-result"] button')]
    .find((button) => button.textContent!.trim() === label)!;
const pinButton = (el: LyraKnowledgeGraphExplorer): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('[part="detail-card"] lr-button[slot="actions"]')!;

describe('knowledge-graph-explorer change requests', () => {
  it('lets a listener veto or resolve a user selection before it commits', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
      query="a" .nodes=${nodes}></lr-knowledge-graph-explorer>`);
    const log: string[] = [];
    const requests: unknown[] = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    el.addEventListener('lr-selection-change-request', (event) => {
      requests.push({ ...event.detail });
      log.push(`request:${String(el.selectedNodeId)}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.selectedNodeId = 'c';
    });
    el.addEventListener('lr-selection-change', () => log.push('lr-selection-change'));

    resultButton(el, 'Alpha').click();
    await el.updateComplete;
    expect(el.selectedNodeId).to.equal(null);
    expect(log).to.deep.equal(['request:null:true']);
    expect(requests).to.deep.equal([{ selectedNodeId: 'a', previousSelectedNodeId: null }]);

    log.length = 0;
    mode = 'resolve';
    resultButton(el, 'Beta').click();
    await el.updateComplete;
    expect(el.selectedNodeId, 'a listener write wins over the proposal').to.equal('c');
    expect(log).to.deep.equal(['request:null:true']);

    log.length = 0;
    mode = 'allow';
    resultButton(el, 'Alpha').click();
    await el.updateComplete;
    expect(el.selectedNodeId).to.equal('a');
    expect(log).to.deep.equal(['request:c:true', 'lr-selection-change']);
  });

  it('lets a listener veto or resolve a pin toggle before it commits', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
      .nodes=${nodes} selected-node-id="a"></lr-knowledge-graph-explorer>`);
    await el.updateComplete;
    const log: string[] = [];
    const requests: unknown[] = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    el.addEventListener('lr-pin-change-request', (event) => {
      requests.push({ ...event.detail });
      log.push(`request:${el.pinnedNodeIds.join(',')}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.pinnedNodeIds = ['b'];
    });
    el.addEventListener('lr-pin-change', () => log.push('lr-pin-change'));

    pinButton(el).click();
    await el.updateComplete;
    expect([...el.pinnedNodeIds]).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[part="pinned"]') === null).to.equal(true);
    expect(log).to.deep.equal(['request::true']);
    expect(requests).to.deep.equal([{ pinnedNodeIds: ['a'], previousPinnedNodeIds: [] }]);

    log.length = 0;
    mode = 'resolve';
    pinButton(el).click();
    await el.updateComplete;
    expect([...el.pinnedNodeIds], 'a listener write wins over the proposal').to.deep.equal(['b']);
    expect(log).to.deep.equal(['request::true']);

    log.length = 0;
    mode = 'allow';
    pinButton(el).click();
    await el.updateComplete;
    expect([...el.pinnedNodeIds]).to.deep.equal(['b', 'a']);
    expect(log).to.deep.equal(['request:b:true', 'lr-pin-change']);
  });

  it('reports the previous hidden types on the legend proposal', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer
      .nodeTypes=${[{ id: 'topic', label: 'Topic' }]}></lr-knowledge-graph-explorer>`);
    const legend = el.shadowRoot!.querySelector('lr-graph-legend')!;
    const requests: unknown[] = [];
    el.addEventListener('lr-hidden-types-change-request', (event) => requests.push({ ...event.detail }));
    legend.shadowRoot!.querySelector('button')!.click();
    expect(requests).to.deep.equal([{ hiddenTypes: ['topic'], previousHiddenTypes: [] }]);
  });
});
