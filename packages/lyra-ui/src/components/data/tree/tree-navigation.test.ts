import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

const data = [
  {
    id: '1',
    label: 'Root',
    badges: [{ text: '2' }],
    children: [
      { id: '1.1', label: 'Child A' },
      { id: '1.2', label: 'Child B' },
    ],
  },
  { id: '2', label: 'Leaf' },
];

/** Walks into shadow roots to find the actually-focused element (a focused
 *  element inside a shadow tree only surfaces as its shadow host via the
 *  plain `document.activeElement`). */
function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  const active = root.activeElement;
  return active?.shadowRoot?.activeElement ? deepActiveElement(active.shadowRoot) : active;
}

it('gives the first item a roving tabindex of 0 and every other item -1', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as HTMLElement[];
  expect(root.tabIndex).to.equal(0);
  expect(leaf.tabIndex).to.equal(-1);
});

it('ArrowDown moves the roving tabindex to the next visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((leaf as unknown as HTMLElement).tabIndex).to.equal(0);
  expect((deepActiveElement()) === (leaf)).to.equal(true);
});

it('ArrowRight expands a collapsed node without moving focus, then a 2nd press steps into its first child', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.true;
  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  const firstChild = root.shadowRoot!.querySelector('lr-tree-item');
  expect((deepActiveElement()) === (firstChild)).to.equal(true);
});

it('Home/End jump to the first/last visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((deepActiveElement()) === (leaf as unknown as Element)).to.equal(true);

  leaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);
});

it('Enter fires lr-node-select on the focused item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();
  setTimeout(() =>
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })),
  );
  const ev = await oneEvent(el, 'lr-node-select');
  expect(ev.detail).to.deep.equal({ id: '1' });
});

it('ArrowUp moves the roving tabindex to the previous visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((deepActiveElement()) === (leaf as unknown as Element)).to.equal(true);

  leaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);
  expect((root as unknown as HTMLElement).tabIndex).to.equal(0);
  expect((leaf as unknown as HTMLElement).tabIndex).to.equal(-1);
});

it('ArrowLeft collapses an expanded node without moving focus off it', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(root.expanded).to.be.false;
  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);
});

it('ArrowLeft on a collapsed or leaf node moves focus to its nearest ancestor', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  const childA = root.shadowRoot!.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect((deepActiveElement()) === (childA as unknown as Element)).to.equal(true);

  childA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;

  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);
  expect((root as unknown as HTMLElement).tabIndex).to.equal(0);
});

it('swaps which arrow key expands/collapses under dir="rtl"', async () => {
  const el = (await fixture(html`<lr-tree dir="rtl"></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.true;
  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.false;
});
