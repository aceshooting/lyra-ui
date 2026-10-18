import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph } from './graph.js';
import { registerLyraLocale } from '../../../internal/localization-runtime.js';
void LyraGraph;

interface CursorWork { focusGraphItem(index: number): void; nodeAccessibleText(node: { id: string }): string; }
async function mounted(): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`<lr-graph .nodes=${[{ id: 'a' }, { id: 'b' }]}></lr-graph>`);
  await waitUntil(() => graph.shadowRoot!.querySelectorAll('[part="node"]').length === 2, 'nodes ready', { timeout: 10000 });
  return graph;
}

describe('graph cursor render refresh', () => {
  it('refreshes callback closure output for keyless requests coalesced with cursor changes', async () => {
    const graph = await mounted();
    const work = graph as unknown as CursorWork;
    let prefix = 'First';
    work.nodeAccessibleText = node => `${prefix} ${node.id}`;
    graph.requestUpdate(); await graph.updateComplete;
    prefix = 'Second';
    work.focusGraphItem(1); graph.requestUpdate(); await graph.updateComplete;
    expect(graph.shadowRoot!.querySelector('[part="node"]')?.getAttribute('aria-label')).to.equal('Second a');
    graph.selectedNodeIds = ['a']; await graph.updateComplete;
    const nodes = graph.shadowRoot!.querySelectorAll('[part="node"]');
    expect(nodes[0]!.getAttribute('tabindex')).to.equal('-1');
    expect(nodes[1]!.getAttribute('tabindex')).to.equal('0');
  });

  it('refreshes rendered content when the same locale catalog is replaced', async () => {
    registerLyraLocale('en-XG', { graphDataList: 'First graph list' });
    const graph = await mounted(); graph.locale = 'en-XG'; await graph.updateComplete;
    expect(graph.shadowRoot!.querySelector('[part="data-list"]')?.getAttribute('aria-label')).to.equal('First graph list');
    registerLyraLocale('en-XG', { graphDataList: 'Second graph list' });
    (graph as unknown as CursorWork).focusGraphItem(1); await graph.updateComplete;
    expect(graph.shadowRoot!.querySelector('[part="data-list"]')?.getAttribute('aria-label')).to.equal('Second graph list');
  });

  it('reconciles focus and refreshes a new outer binding after structural replacement', async () => {
    const graph = await mounted();
    const nodes = [{ id: 'a', label: 'Before' }, { id: 'b', label: 'B' }];
    graph.nodes = nodes; await graph.updateComplete;
    (graph as unknown as CursorWork).focusGraphItem(1); await graph.updateComplete;
    nodes[0]!.label = 'After'; nodes.pop(); graph.nodes = [...nodes]; await graph.updateComplete;
    const item = graph.shadowRoot!.querySelector('[part="node"]');
    expect(item?.getAttribute('aria-label')).to.equal('After');
    expect(item?.getAttribute('tabindex')).to.equal('0');
  });
});
