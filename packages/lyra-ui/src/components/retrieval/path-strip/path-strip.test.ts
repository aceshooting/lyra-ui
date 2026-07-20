import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './path-strip.js';
import type { LyraPathStrip, LyraPathElement } from './path-strip.js';
import { styles } from './path-strip.styles.js';

const path: LyraPathElement[] = [
  { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
  { kind: 'edge', relation: 'discovered', directed: true },
  { kind: 'node', node: { id: 'e2', label: 'Polonium' } },
];

it('defaults to an empty path and empty label', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  expect(el.path).to.deep.equal([]);
  expect(el.label).to.equal('');
});

it('renders one control per path element, in order', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const nodes = el.shadowRoot!.querySelectorAll('[part="node"]');
  const relations = el.shadowRoot!.querySelectorAll('[part="relation"]');
  expect(nodes.length).to.equal(2);
  expect(relations.length).to.equal(1);
  expect(nodes[0]!.textContent).to.include('Marie Curie');
  expect(relations[0]!.textContent).to.include('discovered');
  expect(nodes[1]!.textContent).to.include('Polonium');
});

it('emits lr-entity-activate when a node element is activated', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-entity-activate');
  (el.shadowRoot!.querySelectorAll('[part="node"]')[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e1' });
});

it('emits lr-relation-activate with source/target resolved from adjacent node elements', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-relation-activate');
  (el.shadowRoot!.querySelectorAll('[part="relation"]')[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ relation: 'discovered', sourceId: 'e1', targetId: 'e2' });
});

it('has one roving tab stop across every element, moving forward with ArrowRight in LTR', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const controls = () => [...el.shadowRoot!.querySelectorAll('[part="node"], [part="relation"]')] as HTMLElement[];
  expect(controls().map((c) => c.tabIndex)).to.deep.equal([0, -1, -1]);

  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
  await el.updateComplete;
  expect(controls().map((c) => c.tabIndex)).to.deep.equal([-1, 0, -1]);
});

it('draws directed-edge arrows as aria-hidden, logical (inline-end unless reverse)', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const arrow = el.shadowRoot!.querySelector('[part="arrow"]')!;
  expect(arrow.getAttribute('aria-hidden')).to.equal('true');
  expect(arrow.textContent).to.equal('→');
});

it('shows an empty message when path is empty', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('announces node focus through a .strings override for pathNodeStatus, interpolating its placeholders', async () => {
  const el = (await fixture(
    html`<lr-path-strip .strings=${{ pathNodeStatus: '{label}, nœud {position} sur {total}' }}></lr-path-strip>`,
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;

  (el.shadowRoot!.querySelectorAll('[part="node"]')[0] as HTMLButtonElement).focus();
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).to.equal('Marie Curie, nœud 1 sur 3');
});

it('gives both node and relation pills the shared minimum hit area', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="node"]') as HTMLElement;
  const relation = el.shadowRoot!.querySelector('[part="relation"]') as HTMLElement;

  expect(getComputedStyle(node).minInlineSize).to.equal('40px');
  expect(getComputedStyle(node).minBlockSize).to.equal('40px');
  expect(getComputedStyle(relation).minInlineSize).to.equal('40px');
  expect(getComputedStyle(relation).minBlockSize).to.equal('40px');
});

it('is accessible with a full path', async () => {
  const el = (await fixture(html`<lr-path-strip></lr-path-strip>`)) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('gives node and relation a hover state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='node'\]:hover/);
  expect(css).to.match(/\[part='relation'\]:hover/);
});
