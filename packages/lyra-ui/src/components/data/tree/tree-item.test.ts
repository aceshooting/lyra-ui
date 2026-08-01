import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree-item.js';
import type { LyraTreeItem } from './tree-item.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const item = { id: '1', label: 'Root' };

/** The text a declarative item actually projects into `[part="label"]` -- its own fallback text plus
 *  whatever the default slot renders. Reads the *rendered* projection, not the light DOM. */
const renderedLabel = (el: LyraTreeItem): string => {
  const label = el.shadowRoot!.querySelector('[part="label"]')!;
  const slot = label.querySelector('slot') as HTMLSlotElement | null;
  const visible = (nodes: Node[]): string[] =>
    // Lit's own marker comments live in here too, and a comment's textContent is that marker.
    nodes
      .filter((n) => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE)
      .map((n) => n.textContent ?? '');
  const slotted = slot ? visible(slot.assignedNodes({ flatten: true })) : [];
  const own = visible([...label.childNodes].filter((n) => n.nodeName !== 'SLOT'));
  return [...own, ...slotted].join('').trim();
};

// `item` is assigned by `<lr-tree>` in the data-driven model, but the tag is registered publicly, so
// a bare `document.createElement('lr-tree-item')` must complete its first update cycle (and later
// ones) without dereferencing the missing item -- it renders as an empty declarative leaf until
// either a `label`/slotted content or an `item` arrives.
it('completes its lifecycle without an item, then renders once one is assigned', async () => {
  const el = document.createElement('lr-tree-item') as LyraTreeItem;
  document.body.appendChild(el);
  try {
    await el.updateComplete;
    expect(renderedLabel(el)).to.equal('');
    expect(el.getAttribute('role')).to.equal('treeitem');
    expect(el.hasChildren).to.be.false;

    el.item = item;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Root');
  } finally {
    el.remove();
  }
});

// The declarative child model. `<lr-tree-item>` mirrors `wa-tree-item`/`sl-tree-item`, whose whole
// child model is markup: the default slot carries the label and nested `<lr-tree-item>` elements
// carry the hierarchy. A migration codemod only renames the tag, so markup that arrives with no
// `.item` object assigned has to render on its own -- these lock that contract.
describe('tree-item declarative child model', () => {
  it('renders the label attribute when no item object is assigned', async () => {
    const el = (await fixture(html`<lr-tree-item label="Docs"></lr-tree-item>`)) as LyraTreeItem;
    expect(renderedLabel(el)).to.equal('Docs');
    expect(el.hasChildren).to.be.false;
  });

  it('renders slotted label content, so mechanically renamed markup is never blank', async () => {
    const el = (await fixture(html`<lr-tree-item>Docs</lr-tree-item>`)) as LyraTreeItem;
    expect(renderedLabel(el)).to.equal('Docs');
  });

  it('projects nested items into the group slot rather than the label, and offers a toggle', async () => {
    const el = (await fixture(html`
      <lr-tree-item label="Parent">
        <lr-tree-item label="Child"></lr-tree-item>
      </lr-tree-item>
    `)) as LyraTreeItem;

    expect(renderedLabel(el), 'a nested item must not leak into the label').to.equal('Parent');
    expect(el.hasChildren).to.be.true;
    expect(el.getAttribute('aria-expanded')).to.equal('false');
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;
    expect(toggle.hidden).to.be.false;
    // Never hand chai a DOM node as actual/expected -- compare a boolean instead.
    expect(el.shadowRoot!.querySelector('[part="group"]') === null, 'collapsed: no group').to.be.true;

    el.expand();
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="group"]')!;
    expect(group.getAttribute('role')).to.equal('group');
    const groupSlot = group.querySelector('slot') as HTMLSlotElement;
    expect(groupSlot.assignedElements().map((child) => child.getAttribute('label'))).to.eql(['Child']);
    expect(el.getAttribute('aria-expanded')).to.equal('true');
  });

  it('emits lr-node-toggle and lr-node-select with a generated id for a declarative item', async () => {
    const el = (await fixture(html`
      <lr-tree-item label="Parent"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
    `)) as LyraTreeItem;
    expect(el.nodeId).to.be.a('string').and.to.have.length.greaterThan(0);

    const toggled = oneEvent(el, 'lr-node-toggle');
    el.expand();
    expect((await toggled).detail).to.eql({ id: el.nodeId, expanded: true });

    const selected = oneEvent(el, 'lr-node-select');
    el.select();
    expect((await selected).detail).to.eql({ id: el.nodeId });
  });

  it('reflects declarative disabled/selected state into ARIA and keeps a disabled item inert', async () => {
    const el = (await fixture(html`
      <lr-tree-item label="Parent" disabled selected><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
    `)) as LyraTreeItem;

    expect(el.getAttribute('aria-disabled')).to.equal('true');
    expect(el.getAttribute('aria-selected')).to.equal('true');
    expect(el.isDisabled).to.be.true;

    let selections = 0;
    el.addEventListener('lr-node-select', () => selections++);
    el.select();
    el.expand();
    await el.updateComplete;
    expect(selections).to.equal(0);
    expect(el.expanded).to.be.false;
  });

  it('renders both aria-selected states, never dropping the attribute for an unselected item', async () => {
    const el = (await fixture(html`<lr-tree-item label="Parent"></lr-tree-item>`)) as LyraTreeItem;
    expect(el.getAttribute('aria-selected')).to.equal('false');
    el.selected = true;
    await el.updateComplete;
    expect(el.getAttribute('aria-selected')).to.equal('true');
  });

  it('leaves a host-authored aria-label alone in the declarative model', async () => {
    const el = (await fixture(
      html`<lr-tree-item label="Docs" aria-label="Documentation folder"></lr-tree-item>`,
    )) as LyraTreeItem;
    expect(el.getAttribute('aria-label')).to.equal('Documentation folder');
  });

  it('lets an assigned item object win over the declarative attributes', async () => {
    const el = (await fixture(html`<lr-tree-item label="Declarative"></lr-tree-item>`)) as LyraTreeItem;
    el.item = { id: 'data', label: 'From data' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('From data');
    expect(el.nodeId).to.equal('data');
  });

  it('picks up a nested item appended after the first render', async () => {
    const el = (await fixture(html`<lr-tree-item label="Parent"></lr-tree-item>`)) as LyraTreeItem;
    expect(el.hasChildren).to.be.false;

    const child = document.createElement('lr-tree-item') as LyraTreeItem;
    child.label = 'Late child';
    el.appendChild(child);
    await el.updateComplete;
    expect(el.hasChildren).to.be.true;
    expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.hidden).to.be.false;
  });

  it('is accessible as a declarative branch inside a tree', async () => {
    const wrapper = await fixture(html`
      <div role="tree" aria-label="Docs">
        <lr-tree-item label="Parent" expanded>
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
      </div>
    `);
    const node = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
    await node.updateComplete;
    expect(node.getAttribute('role')).to.equal('treeitem');
    await expect(node).to.be.accessible();
  });
});

// Regression tests for `depth`/`setSize`/`posInSet`: these feed `aria-level`/`aria-setsize`/
// `aria-posinset` directly in `willUpdate()`. Per the ARIA spec those attributes must be positive
// integers (aria-setsize additionally permits the `-1` "unknown" sentinel) -- a NaN/negative value
// here would produce invalid ARIA output. All three are now sanitized via `finiteInteger` at
// assignment time, so the rendered attributes are always sane regardless of what's assigned.
it('clamps a NaN/negative depth to a finite integer >= 0, keeping aria-level a positive integer', async () => {
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

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
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

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
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

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
  const el = (await fixture(html`<lr-tree-item .item=${withChildren}></lr-tree-item>`)) as LyraTreeItem;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
  expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
});

it('keeps a disabled branch toggle inert and does not move focus to the disabled treeitem', async () => {
  const disabledBranch = {
    ...item,
    disabled: true,
    children: [{ id: '1.1', label: 'Child' }],
  };
  const wrapper = await fixture(html`
    <div role="tree">
      <button id="before">Before</button>
      <lr-tree-item .item=${disabledBranch}></lr-tree-item>
    </div>
  `);
  const before = wrapper.querySelector<HTMLButtonElement>('#before')!;
  const el = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;

  expect(toggle.disabled).to.be.true;
  expect(getComputedStyle(toggle).cursor).to.equal('default');
  before.focus();
  toggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
  expect(document.activeElement).to.equal(before);
});

// A `role="treeitem"` host is only ARIA-valid nested inside a `role="tree"`/`role="group"`
// ancestor (the WAI-ARIA required-parent rule) -- <lr-tree-item> is never used standalone in
// practice (see the class doc), so this wraps it the same way <lr-tree> itself always does,
// while still asserting accessibility on the node's own instance, expanded/badged/described so
// every own-ARIA code path (role/aria-level/aria-setsize/aria-posinset, the badge/icon/
// description markup) is exercised.
it('is accessible with a realistic, expanded, badged item', async () => {
  const populated = {
    id: '1',
    label: 'Root',
    description: 'A helpful secondary line',
    badge: 3,
    badges: [{ text: 'New', tone: 'brand' as const }],
    children: [{ id: '1.1', label: 'Child A' }],
  };
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${populated} expanded .setSize=${1} .posInSet=${1}></lr-tree-item>
    </div>`,
  );
  const node = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
  await node.updateComplete;
  expect(node.getAttribute('role')).to.equal('treeitem');
  await expect(node).to.be.accessible();
});

// `:host([aria-selected='true']) [part='row']` is (0,3,0), which a bare `[part='row']:active`
// ((0,2,0)) cannot reach -- hence the second, :host()-matched arm on the pressed rule. A selected
// item is the one a user presses next, so it must not be the single row with no press feedback.
// Rendered assertion only: the selector is exactly the kind of thing that reads correct and matches
// nothing.
it('shows a pressed fill on a selected row, and none on a disabled one', async () => {
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${{ id: 's', label: 'Selected', selected: true }} .setSize=${2} .posInSet=${1}></lr-tree-item>
      <lr-tree-item .item=${{ id: 'd', label: 'Disabled', disabled: true }} .setSize=${2} .posInSet=${2}></lr-tree-item>
    </div>`,
  );
  const [selectedItem, disabledItem] = [...wrapper.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  await selectedItem!.updateComplete;
  await disabledItem!.updateComplete;

  const press = async (host: LyraTreeItem): Promise<{ resting: string; pressed: string }> => {
    const row = host.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    row.scrollIntoView();
    const resting = getComputedStyle(row).backgroundColor;
    const rect = row.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await sendMouse({ type: 'down' });
      return { resting, pressed: getComputedStyle(row).backgroundColor };
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  };

  const selected = await press(selectedItem!);
  expect(selected.pressed, 'a selected row must still acknowledge the press').to.not.equal(selected.resting);

  const disabled = await press(disabledItem!);
  expect(disabled.pressed, 'a disabled row must stay inert under the pointer').to.equal(disabled.resting);
});
