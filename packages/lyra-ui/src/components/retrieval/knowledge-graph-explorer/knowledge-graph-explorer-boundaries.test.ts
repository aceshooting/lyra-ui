import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.class.js';
import './knowledge-graph-explorer.js';

const people = [
  { id: 'marie', label: 'Marie Curie' },
  { id: 'pierre', label: 'Pierre Curie' },
  { id: 'irene', label: 'Irene Curie' },
];

describe('lr-knowledge-graph-explorer API boundaries', () => {
  it('resolves revealSourceKey() to false without a graph source', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer .nodes=${people}></lr-knowledge-graph-explorer>`);
    el.query = 'curie';
    expect(await el.revealSourceKey('node:marie')).to.equal(false);
    // The no-source early return leaves the toolbar filter untouched.
    expect(el.query).to.equal('curie');
  });

  it('resolves focusNode() to false before the composed graph has rendered', async () => {
    const el = document.createElement('lr-knowledge-graph-explorer') as LyraKnowledgeGraphExplorer;
    el.graphSource = { revision: 1, project: () => new Promise(() => {}) } as unknown as LyraKnowledgeGraphExplorer['graphSource'];
    expect(await el.focusNode('marie')).to.equal(false);
  });

  it('normalizes a whitespace-only selectedNodeId to null', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer .nodes=${people}></lr-knowledge-graph-explorer>`);
    el.selectedNodeId = '   ';
    await el.updateComplete;
    await waitUntil(() => el.selectedNodeId === null, 'blank selection cleared');
    await el.updateComplete;
    expect(el.selectedNodeId).to.equal(null);
  });

  it('ignores a search input that repeats the current query', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer .nodes=${people}></lr-knowledge-graph-explorer>`);
    const search = el.shadowRoot!.querySelector('[part="search"]')!;
    const changes: unknown[] = [];
    el.addEventListener('lr-search-change', (event) => changes.push((event as CustomEvent).detail));
    search.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'curie' }, bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.query).to.equal('curie');
    const afterFirst = changes.length;
    search.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'curie' }, bubbles: true, composed: true }));
    await el.updateComplete;
    expect(changes.length).to.equal(afterFirst);
    expect(el.query).to.equal('curie');
  });

  it('leaves search-result focus and default handling alone for a non-navigation key', async () => {
    const el = await fixture<LyraKnowledgeGraphExplorer>(html`<lr-knowledge-graph-explorer .nodes=${people} query="curie"></lr-knowledge-graph-explorer>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="search-result"] button').length === 3, 'search results');
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="search-result"] button')];
    buttons[1]!.focus();
    const ignored = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    buttons[1]!.dispatchEvent(ignored);
    expect(ignored.defaultPrevented).to.equal(false);
    expect(el.shadowRoot!.activeElement === buttons[1]).to.equal(true);
    const end = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    buttons[1]!.dispatchEvent(end);
    expect(end.defaultPrevented).to.equal(true);
    expect(el.shadowRoot!.activeElement === buttons[2]).to.equal(true);
  });
});
