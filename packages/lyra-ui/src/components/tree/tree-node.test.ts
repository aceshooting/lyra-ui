import { fixture, expect, html } from '@open-wc/testing';
import './tree-node.js';
import type { LyraTreeNode } from './tree-node.js';

const item = { id: '1', label: 'Root' };

// Regression tests for `depth`/`setSize`/`posInSet`: these feed `aria-level`/`aria-setsize`/
// `aria-posinset` directly in `willUpdate()`. Per the ARIA spec those attributes must be positive
// integers (aria-setsize additionally permits the `-1` "unknown" sentinel) -- a NaN/negative value
// here would produce invalid ARIA output. All three are now sanitized via `finiteInteger` at
// assignment time, so the rendered attributes are always sane regardless of what's assigned.
it('clamps a NaN/negative depth to a finite integer >= 0, keeping aria-level a positive integer', async () => {
  const el = (await fixture(html`<lyra-tree-node .item=${item}></lyra-tree-node>`)) as LyraTreeNode;

  el.depth = NaN;
  expect(el.depth).to.equal(0);
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('1');

  el.depth = -5;
  expect(el.depth).to.equal(0);
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('1');

  el.depth = 2.7;
  expect(el.depth).to.equal(2); // truncated, not rounded
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('3');
});

it('clamps a NaN/negative setSize to a finite integer >= 1, but preserves the -1 "unknown" ARIA sentinel', async () => {
  const el = (await fixture(html`<lyra-tree-node .item=${item}></lyra-tree-node>`)) as LyraTreeNode;

  el.setSize = NaN;
  expect(el.setSize).to.equal(1);
  await el.updateComplete;
  expect(el.getAttribute('aria-setsize')).to.equal('1');

  el.setSize = -5;
  expect(el.setSize).to.equal(1);

  el.setSize = -1;
  expect(el.setSize).to.equal(-1); // the ARIA-legal "unknown" sentinel, not clamped away
  await el.updateComplete;
  expect(el.getAttribute('aria-setsize')).to.equal('-1');
});

it('clamps a NaN/negative posInSet to a finite integer >= 1', async () => {
  const el = (await fixture(html`<lyra-tree-node .item=${item}></lyra-tree-node>`)) as LyraTreeNode;

  el.posInSet = NaN;
  expect(el.posInSet).to.equal(1);
  await el.updateComplete;
  expect(el.getAttribute('aria-posinset')).to.equal('1');

  el.posInSet = -3;
  expect(el.posInSet).to.equal(1);
  await el.updateComplete;
  expect(el.getAttribute('aria-posinset')).to.equal('1');
});

it('gives the expand/collapse toggle the shared minimum tappable size', async () => {
  const withChildren = { ...item, children: [{ id: '1.1', label: 'Child' }] };
  const el = (await fixture(html`<lyra-tree-node .item=${withChildren}></lyra-tree-node>`)) as LyraTreeNode;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
  expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
});
