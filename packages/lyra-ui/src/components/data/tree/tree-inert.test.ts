import { aTimeout, fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';

/** Walks into shadow roots to find the actually-focused element (a focused
 *  element inside a shadow tree only surfaces as its shadow host via the
 *  plain `document.activeElement`). */
function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  const active = root.activeElement;
  return active?.shadowRoot?.activeElement ? deepActiveElement(active.shadowRoot) : active;
}

describe('lr-tree inert handling', () => {
  const inertFixture = () => html`
    <lr-tree label="Topics">
      <lr-tree-item label="One"></lr-tree-item>
      <lr-tree-item label="Two"></lr-tree-item>
      <lr-tree-item label="Three"></lr-tree-item>
    </lr-tree>
  `;

  it('steps ArrowDown past an inert item, which never holds the roving tabindex', async () => {
    const el = (await fixture(html`
      <lr-tree label="Topics">
        <lr-tree-item label="One"></lr-tree-item>
        <lr-tree-item label="Two" inert></lr-tree-item>
        <lr-tree-item label="Three"></lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const [one, two, three] = [...el.querySelectorAll('lr-tree-item')] as unknown as HTMLElement[];

    expect(one!.tabIndex).to.equal(0);
    expect(two!.tabIndex).to.equal(-1);
    one!.focus();
    one!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;

    expect(deepActiveElement()?.getAttribute('label')).to.equal('Three');
    expect(two!.tabIndex).to.equal(-1);
    expect(three!.tabIndex).to.equal(0);

    three!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(deepActiveElement()?.getAttribute('label')).to.equal('One');
  });

  it('skips an inert branch entirely -- an inert item inerts its own descendants too', async () => {
    const el = (await fixture(html`
      <lr-tree label="Topics">
        <lr-tree-item label="Parent" inert expanded>
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
        <lr-tree-item label="Sibling"></lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const [parent, child, sibling] = [...el.querySelectorAll('lr-tree-item')] as unknown as HTMLElement[];

    expect(parent!.tabIndex).to.equal(-1);
    expect(child!.tabIndex).to.equal(-1);
    expect(sibling!.tabIndex).to.equal(0);

    sibling!.focus();
    sibling!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(deepActiveElement()?.getAttribute('label')).to.equal('Sibling');
  });

  it('moves the roving stop and real focus off the active item when it becomes inert', async () => {
    const el = (await fixture(inertFixture())) as LyraTree;
    await el.updateComplete;
    const [one, two] = [...el.querySelectorAll('lr-tree-item')] as unknown as HTMLElement[];
    one!.focus();
    expect(deepActiveElement()?.getAttribute('label')).to.equal('One');

    one!.inert = true;
    await aTimeout(0);
    await el.updateComplete;

    expect(one!.tabIndex).to.equal(-1);
    expect(two!.tabIndex).to.equal(0);
    // Focus must land somewhere valid: the platform blurs an element the moment it becomes inert,
    // and <body> is outside this tree's delegated keydown handler, so every later arrow press dies.
    expect(deepActiveElement()?.getAttribute('label')).to.equal('Two');
  });

  it('never steals focus into the tree when an item nobody was on becomes inert', async () => {
    const el = (await fixture(inertFixture())) as LyraTree;
    await el.updateComplete;
    const [, , three] = [...el.querySelectorAll('lr-tree-item')] as unknown as HTMLElement[];

    three!.inert = true;
    await aTimeout(0);
    await el.updateComplete;

    expect(document.activeElement?.localName).to.equal('body');
  });

  it('keeps its roving stop and selection when an ancestor inerts the whole tree', async () => {
    const wrapper = (await fixture(html`
      <div>
        <lr-tree label="Topics">
          <lr-tree-item label="One" selected></lr-tree-item>
          <lr-tree-item label="Two"></lr-tree-item>
        </lr-tree>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-tree') as LyraTree;
    await el.updateComplete;
    const [one] = [...el.querySelectorAll('lr-tree-item')] as unknown as HTMLElement[];
    expect(el.selectedItems.length).to.equal(1);

    // A modal inerting the page behind it makes every item inert together. Excluding them all
    // would empty the visible walk, null out the roving target, and drop the tree out of the tab
    // order for good -- nothing observes the ancestor, so nothing would restore it.
    wrapper.inert = true;
    el.requestUpdate();
    await el.updateComplete;

    expect(one!.tabIndex).to.equal(0);
    expect(el.selectedItems.length).to.equal(1);
  });
});
