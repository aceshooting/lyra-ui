import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './tree.js';
import type { LyraTree } from './tree.class.js';
import type { LyraTreeItem } from './tree-item.class.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { twoFrames } from '../../../../test/frames.js';

it('retains outside focus when the previously focused tree row becomes inert', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-tree label="Topics">
      <lr-tree-item id="first" label="One"></lr-tree-item>
      <lr-tree-item id="second" label="Two"></lr-tree-item>
    </lr-tree>
    <button type="button">Outside action</button>
  </div>`);
  const tree = wrapper.querySelector<LyraTree>('lr-tree')!;
  const first = tree.querySelector<LyraTreeItem>('#first')!;
  const second = tree.querySelector<LyraTreeItem>('#second')!;
  const outside = wrapper.querySelector<HTMLButtonElement>('button')!;
  await tree.updateComplete;
  await focusByKeyboard(first);
  expect(deepActiveElementIn(document) === first).to.equal(true);
  expect(first.tabIndex).to.equal(0);

  let activations = 0;
  outside.addEventListener('click', () => activations++);
  await focusByKeyboard(outside);
  expect(document.activeElement === outside).to.equal(true);
  expect(first.tabIndex, 'Leaving the tree retains its previous roving stop').to.equal(0);

  first.inert = true;
  await waitUntil(() => first.tabIndex === -1 && second.tabIndex === 0,
    'The roving stop leaves the inert row');
  await tree.updateComplete;
  await twoFrames();
  expect(document.activeElement === outside, 'An outside focus owner must not be displaced').to.equal(true);
  expect([...tree.querySelectorAll<LyraTreeItem>('lr-tree-item')]
    .filter(item => item.tabIndex === 0).map(item => item.id)).to.deep.equal(['second']);
  await sendKeys({ press: 'Enter' });
  expect(activations).to.equal(1);

  first.inert = false;
  await twoFrames();
  await tree.updateComplete;
  expect([...tree.querySelectorAll<LyraTreeItem>('lr-tree-item')]
    .filter(item => item.tabIndex === 0).map(item => item.id)).to.deep.equal(['second']);
  expect(document.activeElement === outside).to.equal(true);
  expect(activations).to.equal(1);
});
