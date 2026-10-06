import { expect, fixture, fixtureSync, html, nextFrame } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { render } from 'lit';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

// Hosts rarely await `<lr-tree>`'s `updateComplete`: a framework renders the tree, the user clicks
// or presses keys, and the browser paints. Every case below therefore uses `fixtureSync()` and
// frame waits only, and never reads the tree's `updateComplete`, so nested hierarchy context has to
// arrive through the tree's own update lifecycle.
async function settle(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

function nested(item: LyraTreeItem): LyraTreeItem[] {
  return item.childItems();
}

function indentation(item: LyraTreeItem): number {
  const part = item.shadowRoot!.querySelector<HTMLElement>('[part="indentation"]')!;
  return part.getBoundingClientRect().width;
}

const branch: LyraTreeNodeData[] = [
  {
    id: 'docs',
    label: 'Docs',
    children: [
      { id: 'install', label: 'Install' },
      { id: 'usage', label: 'Usage' },
    ],
  },
  { id: 'readme', label: 'Readme' },
];

describe('tree hierarchy context without awaiting the tree', () => {
  it('gives data-model children their level, set position and indentation after a toggle click', async () => {
    const el = fixtureSync<LyraTree>(html`<lr-tree label="Files" .data=${branch}></lr-tree>`);
    await settle();
    const docs = el.querySelector<LyraTreeItem>('lr-tree-item')!;
    docs.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
    await settle();

    const children = nested(docs);
    expect(children.map((child) => child.getAttribute('aria-level'))).to.deep.equal(['2', '2']);
    expect(children.map((child) => child.getAttribute('aria-setsize'))).to.deep.equal(['2', '2']);
    expect(children.map((child) => child.getAttribute('aria-posinset'))).to.deep.equal(['1', '2']);
    expect(indentation(children[0]!)).to.be.greaterThan(indentation(docs));
  });

  it('renders the multiple-selection checkbox and checked state on expanded data-model children', async () => {
    const el = fixtureSync<LyraTree>(html`<lr-tree label="Files" selection="multiple" .data=${branch}></lr-tree>`);
    await settle();
    const docs = el.querySelector<LyraTreeItem>('lr-tree-item')!;
    docs.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
    await settle();

    const [install] = nested(docs);
    expect(install!.shadowRoot!.querySelector('[part="checkbox"]') !== null).to.equal(true);
    expect(install!.getAttribute('aria-checked')).to.equal('false');
    expect(install!.hasAttribute('aria-selected')).to.equal(false);
  });

  it('steps into an expanded data-model branch and back out with the arrow keys', async () => {
    const el = fixtureSync<LyraTree>(html`<lr-tree label="Files" .data=${branch}></lr-tree>`);
    await settle();
    const docs = el.querySelector<LyraTreeItem>('lr-tree-item')!;
    docs.focus();
    const press = (key: string): void => {
      el.shadowRoot!
        .querySelector('[part~="base"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    };
    press('ArrowRight');
    await settle();
    expect(docs.expanded).to.equal(true);
    press('ArrowRight');
    await settle();
    const [install] = nested(docs);
    expect(install!.tabIndex).to.equal(0);
    expect(docs.tabIndex).to.equal(-1);
    press('ArrowLeft');
    await settle();
    expect(docs.tabIndex).to.equal(0);
    expect(install!.tabIndex).to.equal(-1);
  });

  it('gives declarative nested items their level and derives initial multiple-selection state', async () => {
    const el = fixtureSync<LyraTree>(html`
      <lr-tree label="Docs" selection="multiple">
        <lr-tree-item label="Guides" expanded>
          <lr-tree-item label="Install" selected></lr-tree-item>
          <lr-tree-item label="Usage"></lr-tree-item>
        </lr-tree-item>
        <lr-tree-item label="Reference"></lr-tree-item>
      </lr-tree>
    `);
    await settle();
    const guides = el.querySelector<LyraTreeItem>(':scope > lr-tree-item')!;
    const [install, usage] = nested(guides);
    expect(install!.getAttribute('aria-level')).to.equal('2');
    expect(usage!.getAttribute('aria-posinset')).to.equal('2');
    expect(guides.getAttribute('aria-checked')).to.equal('mixed');
    expect(install!.getAttribute('aria-checked')).to.equal('true');
  });

  it('configures children a host reveals by setting a generated item\'s expanded property directly', async () => {
    const el = fixtureSync<LyraTree>(html`<lr-tree label="Files" .data=${branch}></lr-tree>`);
    await settle();
    const docs = el.querySelector<LyraTreeItem>('lr-tree-item')!;
    docs.expanded = true;
    await settle();
    expect(nested(docs).map((child) => child.getAttribute('aria-level'))).to.deep.equal(['2', '2']);
  });
});

describe('tree roving target', () => {
  const deep: LyraTreeNodeData[] = [
    { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', children: [{ id: 'a1x', label: 'A1x' }] }] },
    { id: 'b', label: 'B', children: [{ id: 'b1', label: 'B1' }] },
  ];

  function stops(el: LyraTree): string[] {
    const result: string[] = [];
    const walk = (items: LyraTreeItem[]): void => {
      for (const item of items) {
        if (item.tabIndex === 0) result.push(item.nodeId);
        walk(item.childItems());
      }
    };
    walk([...el.querySelectorAll<LyraTreeItem>(':scope > lr-tree-item')]);
    return result;
  }

  it('stays where it was after a programmatic expandAll()', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${deep}></lr-tree>`);
    await el.expandAll();
    await el.updateComplete;
    expect(stops(el)).to.deep.equal(['a']);
  });

  it('follows real focus moved by script onto a nested row', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${deep}></lr-tree>`);
    await el.expandAll();
    await el.updateComplete;
    const b = el.querySelectorAll<LyraTreeItem>('lr-tree-item')[1]!;
    const [b1] = b.childItems();
    b1!.focus();
    await el.updateComplete;
    expect(stops(el)).to.deep.equal(['b1']);
  });

  it('moves to a collapsed ancestor when collapsing hides it', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${deep}></lr-tree>`);
    await el.expandAll();
    await el.updateComplete;
    const a = el.querySelector<LyraTreeItem>('lr-tree-item')!;
    const [a1] = a.childItems();
    const [a1x] = a1!.childItems();
    a1x!.focus();
    await el.updateComplete;
    a.collapse();
    await el.updateComplete;
    expect(stops(el)).to.deep.equal(['a']);
  });
});

describe('tree interactive label content', () => {
  it('lets a button inside an item label own Enter and clicks', async () => {
    const el = await fixture<LyraTree>(html`
      <lr-tree label="Docs">
        <lr-tree-item>Guides <button type="button">Rename</button></lr-tree-item>
        <lr-tree-item label="Reference"></lr-tree-item>
      </lr-tree>
    `);
    const button = el.querySelector('button')!;
    let renames = 0;
    button.addEventListener('click', () => {
      renames += 1;
    });
    button.focus();
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(renames).to.equal(1);
    expect(el.selectedItems.length).to.equal(0);
    button.click();
    await el.updateComplete;
    expect(renames).to.equal(2);
    expect(el.selectedItems.length).to.equal(0);
  });
});

describe('tree self-managed selection across data refreshes', () => {
  const files = (): LyraTreeNodeData[] => [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];

  it('keeps user selection when a refresh omits `selected`, and honours an explicit value', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" selection="multiple" .data=${files()}></lr-tree>`);
    const [a, b] = [...el.querySelectorAll<LyraTreeItem>(':scope > lr-tree-item')];
    a!.select();
    b!.select();
    await el.updateComplete;
    expect(el.selectedItems.map((item) => item.nodeId)).to.deep.equal(['a', 'b']);

    el.data = files();
    await el.updateComplete;
    expect(el.selectedItems.map((item) => item.nodeId)).to.deep.equal(['a', 'b']);

    el.data = [{ id: 'a', label: 'A', selected: false }, { id: 'b', label: 'B' }, { id: 'c', label: 'C', selected: true }];
    await el.updateComplete;
    expect(el.selectedItems.map((item) => item.nodeId)).to.deep.equal(['b', 'c']);
  });
});

describe('tree data rebinding', () => {
  it('ignores a parent re-render that rebinds the same data array', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const template = () => html`<lr-tree label="Files" .data=${branch}></lr-tree>`;
    render(template(), container);
    const el = container.querySelector('lr-tree') as LyraTree;
    await el.updateComplete;
    render(template(), container);
    expect(el.isUpdatePending).to.equal(false);
    container.remove();
  });
});

describe('tree modified keys', () => {
  it('leaves Alt+Arrow to the browser', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${branch}></lr-tree>`);
    const docs = el.querySelector<LyraTreeItem>('lr-tree-item')!;
    docs.expand();
    await el.updateComplete;
    docs.focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, composed: true, cancelable: true });
    docs.dispatchEvent(event);
    await el.updateComplete;
    expect(event.defaultPrevented).to.equal(false);
    expect(docs.expanded).to.equal(true);
  });
});

describe('tree bulk expansion cost', () => {
  it('expands a wide tree with work linear in its size', async () => {
    const wide: LyraTreeNodeData[] = Array.from({ length: 100 }, (_, branch) => ({
      id: `b${branch}`,
      label: `Branch ${branch}`,
      children: Array.from({ length: 5 }, (_, leaf) => ({ id: `b${branch}-${leaf}`, label: `Leaf ${leaf}` })),
    }));
    const el = await fixture<LyraTree>(html`<lr-tree label="Wide" .data=${wide}></lr-tree>`);
    const proto = customElements.get('lr-tree-item')!.prototype as { childItems(): unknown[] };
    const original = proto.childItems;
    let walks = 0;
    proto.childItems = function (this: unknown) {
      walks += 1;
      return original.call(this);
    };
    try {
      await el.expandAll();
      await el.updateComplete;
    } finally {
      proto.childItems = original;
    }
    const nodes = 600;
    expect(walks, `${walks} child walks for ${nodes} nodes`).to.be.lessThan(nodes * 15);
    const last = el.querySelectorAll<LyraTreeItem>(':scope > lr-tree-item')[99]!;
    expect(last.childItems()[4]!.getAttribute('aria-level')).to.equal('2');
  });
});

describe('tree selection-change on data refresh', () => {
  it('reports a refresh that removes a selected row, and stays quiet when selection is unchanged', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" selection="multiple" .data=${[
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]}></lr-tree>`);
    const [, b] = [...el.querySelectorAll<LyraTreeItem>(':scope > lr-tree-item')];
    b!.select();
    await el.updateComplete;
    const events: string[][] = [];
    el.addEventListener('lr-selection-change', (event) => {
      events.push(event.detail.selection.map((item) => item.nodeId));
    });

    el.data = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B (renamed)' }];
    await el.updateComplete;
    expect(events).to.deep.equal([]);

    el.data = [{ id: 'a', label: 'A' }];
    await el.updateComplete;
    expect(events).to.deep.equal([[]]);
  });
});
