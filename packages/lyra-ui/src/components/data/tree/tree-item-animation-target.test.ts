import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './tree-item.js';
import type { LyraTreeItem } from './tree-item.js';

it('ignores bubbled animationend from a nested child and settles on its own children animation', async () => {
  const el = await fixture<LyraTreeItem>(html`
    <lr-tree-item label="Parent" data-lr-theme-scope style="--show-duration: 30s">
      <lr-tree-item label="Child"></lr-tree-item>
    </lr-tree-item>
  `);
  const ownerWindow = el.ownerDocument.defaultView!;
  const originalMatchMedia = ownerWindow.matchMedia;
  ownerWindow.matchMedia = ((query: string) => query === '(prefers-reduced-motion: reduce)'
    ? { matches: false, media: query } as MediaQueryList
    : originalMatchMedia.call(ownerWindow, query)) as typeof ownerWindow.matchMedia;

  try {
    let afterExpandCount = 0;
    el.addEventListener('lr-after-expand', () => { afterExpandCount += 1; });
    const afterExpand = oneEvent(el, 'lr-after-expand');
    el.expand();
    await el.updateComplete;
    await Promise.resolve();

    const children = el.shadowRoot!.querySelector<HTMLElement>('[part="children"]')!;
    const slot = children.querySelector('slot')!;
    expect(getComputedStyle(children).animationName).to.equal('lr-tree-show');

    slot.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
    expect(el.expanded).to.equal(true);
    expect(afterExpandCount).to.equal(0);

    children.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
    await afterExpand;
    expect(afterExpandCount).to.equal(1);
    expect(el.expanded).to.equal(true);
  } finally {
    ownerWindow.matchMedia = originalMatchMedia;
  }
});
