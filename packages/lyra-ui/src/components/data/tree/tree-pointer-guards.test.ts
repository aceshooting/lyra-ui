import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import './tree-item.js';
import type { LyraTreeItem } from './tree-item.js';

describe('lr-tree-item toggle pointer capture', () => {
  it('survives a pointer id that cannot be captured and releases the pressed state', async () => {
    const el = await fixture<HTMLElement>(html`
      <lr-tree label="Files">
        <lr-tree-item id="a">A<lr-tree-item id="b">B</lr-tree-item></lr-tree-item>
      </lr-tree>
    `);
    const item = el.querySelector('lr-tree-item') as LyraTreeItem;
    await item.updateComplete;
    const toggle = item.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    toggle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 987654, bubbles: true }));
    expect(toggle.hasAttribute('data-pressed')).to.equal(true);
    toggle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 987654, bubbles: true }));
    expect(toggle.hasAttribute('data-pressed')).to.equal(false);
  });
});
