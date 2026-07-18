import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './mind-map.js';
import type { LyraMindMap, LyraTopic } from './mind-map.js';

const topics: LyraTopic[] = [
  {
    id: 'root',
    label: 'Knowledge Graph RAG',
    children: [
      { id: 'kg', label: 'Knowledge graphs' },
      { id: 'rag', label: 'Retrieval', children: [{ id: 'chunking', label: 'Chunking' }] },
    ],
  },
];

it('defaults to empty topics, empty label, expandDepth=1', async () => {
  const el = (await fixture(html`<lyra-mind-map></lyra-mind-map>`)) as LyraMindMap;
  expect(el.topics).to.deep.equal([]);
  expect(el.label).to.equal('');
  expect(el.expandDepth).to.equal(1);
});

it('renders one [part="node"] per visible topic -- root plus its expandDepth-1 children', async () => {
  const el = (await fixture(html`<lyra-mind-map></lyra-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3); // root + kg + rag; chunking stays collapsed
});

it('emits lyra-topic-select when a leaf node is clicked', async () => {
  const el = (await fixture(html`<lyra-mind-map></lyra-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const kgNode = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find((n) => n.textContent?.includes('Knowledge graphs'))!;
  const listener = oneEvent(el, 'lyra-topic-select');
  kgNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'kg' });
});

it('emits lyra-topic-toggle when a parent node is clicked, and reveals its children', async () => {
  const el = (await fixture(html`<lyra-mind-map></lyra-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const ragNode = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find((n) => n.textContent?.includes('Retrieval'))!;
  const listener = oneEvent(el, 'lyra-topic-toggle');
  ragNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'rag', expanded: true });
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(4); // chunking now visible
});

it('wraps multiple root topics in an implicit hub labeled from the label property', async () => {
  const el = (await fixture(html`<lyra-mind-map label="My Topics"></lyra-mind-map>`)) as LyraMindMap;
  el.topics = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
  await el.updateComplete;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="node-label"]')].map((n) => n.textContent);
  expect(labels).to.include('My Topics');
});

it('keyboard: ArrowDown descends into children, auto-expanding a collapsed parent', async () => {
  const el = (await fixture(html`<lyra-mind-map></lyra-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;

  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); // focus root
  await el.updateComplete;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); // descend to root's first child (kg)
  await el.updateComplete;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); // move to next sibling (rag)
  await el.updateComplete;

  const listener = oneEvent(el, 'lyra-topic-toggle');
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); // rag is collapsed -- auto-expands
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'rag', expanded: true });
});

it('has a single [part="svg"] tab stop, not per-node tabbing', async () => {
  const el = (await fixture(html`<lyra-mind-map></lyra-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('tabindex')).to.equal('0');
  el.shadowRoot!.querySelectorAll('[part="node"]').forEach((n) => expect(n.hasAttribute('tabindex')).to.be.false);
});

it('reads --lyra-transition-base for node-position transitions (collapses to near-zero under reduced motion globally)', async () => {
  const el = (await fixture(html`<lyra-mind-map style="--lyra-transition-base: 42ms linear"></lyra-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const g = el.shadowRoot!.querySelector('[part="node"]') as SVGGElement;
  expect(getComputedStyle(g).transitionDuration).to.equal('0.042s');
});

it('shows the noData empty state when topics is empty', async () => {
  const el = (await fixture(html`<lyra-mind-map></lyra-mind-map>`)) as LyraMindMap;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No data');
});

it('is accessible with an expanded, multi-level tree', async () => {
  const el = (await fixture(html`<lyra-mind-map expand-depth="2"></lyra-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
