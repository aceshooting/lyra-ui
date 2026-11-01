import { expect, fixture, html } from '@open-wc/testing';
import type { LyraGraph } from '../graph/graph.class.js';
import type { LyraGraphNodeRenderer } from '../graph/graph-node-renderer.js';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.class.js';
import './knowledge-graph-explorer.js';

describe('knowledge graph custom nodes and glow forwarding', () => {
  it('leaves custom nodes and glow unset by default', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="list"></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    await graph.updateComplete;
    expect(el.nodeRenderer).to.equal(undefined);
    expect(graph.nodeRenderer).to.equal(undefined);
    expect(el.glow).to.equal(false);
    expect(graph.glow).to.equal(false);
    expect(el.hasAttribute('glow')).to.equal(false);
  });

  it('forwards renderer identity, replacement and reset without calling it in list view', async () => {
    let calls = 0;
    const renderer: LyraGraphNodeRenderer = () => { calls++; return null; };
    const replacement: LyraGraphNodeRenderer = () => { calls++; return null; };
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="list" .nodeRenderer=${renderer} .nodes=${[{ id: 'a', label: 'Alpha' }]}></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    await graph.updateComplete;
    expect(graph.nodeRenderer === renderer).to.equal(true);
    el.nodeRenderer = replacement;
    await el.updateComplete; await graph.updateComplete;
    expect(graph.nodeRenderer === replacement).to.equal(true);
    el.nodeRenderer = null;
    await el.updateComplete; await graph.updateComplete;
    expect(graph.nodeRenderer).to.equal(null);
    el.nodeRenderer = undefined;
    await el.updateComplete; await graph.updateComplete;
    expect(graph.nodeRenderer).to.equal(undefined);
    el.setAttribute('node-renderer', 'untrusted');
    await el.updateComplete; await graph.updateComplete;
    expect(el.nodeRenderer).to.equal(undefined);
    expect(graph.nodeRenderer).to.equal(undefined);
    expect(calls).to.equal(0);
  });

  it('forwards boolean glow attributes and reflects property reset', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer view="list" glow></lr-knowledge-graph-explorer>`);
    const graph = el.shadowRoot!.querySelector<LyraGraph>('[part="graph"]')!;
    await graph.updateComplete;
    expect(el.glow).to.equal(true);
    expect(graph.glow).to.equal(true);
    el.glow = false;
    await el.updateComplete; await graph.updateComplete;
    expect(graph.glow).to.equal(false);
    expect(el.hasAttribute('glow')).to.equal(false);
    el.glow = true;
    await el.updateComplete; await graph.updateComplete;
    expect(graph.glow).to.equal(true);
    expect(el.hasAttribute('glow')).to.equal(true);
    el.removeAttribute('glow');
    await el.updateComplete; await graph.updateComplete;
    expect(el.glow).to.equal(false);
    expect(graph.glow).to.equal(false);
  });
});
