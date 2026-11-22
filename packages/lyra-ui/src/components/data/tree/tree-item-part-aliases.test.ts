import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-tree.js';
import type { LyraTree } from '../../lr-tree.js';
import type { LyraTreeItem } from '../../lr-tree-item.js';

async function tree(): Promise<LyraTree> {
  const host = await fixture<HTMLElement>(html`
    <div>
      <style>
        lr-tree-item::part(checkbox__checkbox) {
          padding-inline-start: 9px;
        }
        lr-tree-item::part(spinner__spinner) {
          border-style: dotted;
        }
      </style>
      <lr-tree label="Outline" selection="multiple" data-lr-motion="reduce"></lr-tree>
    </div>
  `);
  return host.querySelector('lr-tree') as LyraTree;
}

it('exposes the upstream checkbox__checkbox part alongside checkbox__base and styles it through ::part', async () => {
  const el = await tree();
  el.data = [{ id: 'a', label: 'A' }];
  await el.updateComplete;
  const item = el.querySelector('lr-tree-item') as LyraTreeItem;
  await item.updateComplete;
  const box = item.shadowRoot!.querySelector<HTMLElement>('[part~="checkbox__checkbox"]')!;
  expect(box.part.contains('checkbox__base')).to.equal(true);
  expect(getComputedStyle(box).display).to.match(/flex/);
  expect(getComputedStyle(box).paddingInlineStart).to.equal('9px');
});

it('exposes the upstream spinner__spinner part alongside spinner__base while a lazy row loads', async () => {
  const el = await tree();
  el.data = [{ id: 'lazy', label: 'Lazy', lazy: true, expanded: true }];
  await el.updateComplete;
  const item = el.querySelector('lr-tree-item') as LyraTreeItem;
  await item.updateComplete;
  const spinner = item.shadowRoot!.querySelector<HTMLElement>('[part~="spinner__spinner"]')!;
  expect(spinner.part.contains('spinner__base')).to.equal(true);
  expect(getComputedStyle(spinner).borderTopStyle).to.equal('dotted');
});
