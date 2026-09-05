import { expect, fixture, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

function inspectedArray(
  values: LyraTreeNodeData[],
  inspect: (index: number) => void,
): LyraTreeNodeData[] {
  return new Proxy(values, {
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) inspect(Number(key));
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}

describe('tree object projection limits and names', () => {
  it('shares one inspected-position budget across roots and child collections in depth-first order', () => {
    const inspected: string[] = [];
    const first = new Array<LyraTreeNodeData>(6_000);
    first[0] = { id: 'first', label: 'First' };
    const second = new Array<LyraTreeNodeData>(6_000);
    second[3_997] = { id: 'last-admitted', label: 'Last admitted' };
    second[3_998] = { id: 'beyond-budget', label: 'Beyond budget' };
    const input = inspectedArray([
      { id: 'parent-a', label: 'A', children: inspectedArray(first, (i) => inspected.push(`a/${i}`)) },
      { id: 'parent-b', label: 'B', children: inspectedArray(second, (i) => inspected.push(`b/${i}`)) },
      { id: 'later-root', label: 'Later root' },
    ], (i) => inspected.push(`root/${i}`));
    const el = document.createElement('lr-tree') as LyraTree;

    el.data = input;

    expect(inspected.length).to.equal(10_000);
    expect(inspected.slice(0, 3)).to.deep.equal(['root/0', 'a/0', 'a/1']);
    expect(inspected.at(-1)).to.equal('b/3997');
    expect(el.data.map((node) => node.id)).to.deep.equal(['parent-a', 'parent-b']);
    expect(el.data[0]!.children!.map((node) => node.id)).to.deep.equal(['first']);
    expect(el.data[1]!.children!.map((node) => node.id)).to.deep.equal(['last-admitted']);
    expect(el.dataTruncated).to.equal(true);
  });

  it('admits valid roots beyond the first 1,000 inspected positions', () => {
    const input = new Array<LyraTreeNodeData>(1_202);
    input[1_200] = { id: 'valid', label: 'Valid' };
    input[1_201] = { id: 'sibling', label: 'Sibling' };
    const el = document.createElement('lr-tree') as LyraTree;
    el.data = input;
    expect(el.data.map((node) => node.id)).to.deep.equal(['valid', 'sibling']);
    expect(el.dataTruncated).to.equal(true);
  });

  it('stops inspecting lazily when the retained-node cap is reached', () => {
    let inspected = 0;
    const children = inspectedArray(Array.from({ length: 12_000 }, (_, index) => ({
      id: `child-${index}`, label: `Child ${index}`,
    })), () => inspected++);
    const el = document.createElement('lr-tree') as LyraTree;
    el.data = inspectedArray([{ id: 'root', label: 'Root', children }], () => inspected++);
    expect(inspected).to.equal(1_000);
    expect(el.data[0]!.children!.length).to.equal(999);
    expect(el.dataTruncated).to.equal(true);
  });

  for (const label of ['', '   ', '\n\t']) {
    it(`names an otherwise unnamed data row by ID with visible label ${JSON.stringify(label)}`, async () => {
      const el = await fixture<LyraTree>(html`<lr-tree label="Documents"></lr-tree>`);
      el.data = [{ id: 'document-42', label, children: [{ id: 'child', label: 'Child' }] }];
      await el.updateComplete;
      const row = el.querySelector<LyraTreeItem>('lr-tree-item')!;
      expect(row.getAttribute('aria-label')).to.equal('document-42');
      expect(row.nodeLabel).to.equal('document-42');
      expect(row.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal(label);
      expect(el.data[0]!.label).to.equal(label);
      expect(el.data[0]!.accessibleLabel).to.equal(undefined);
      row.select();
      await el.updateComplete;
      expect(el.selectedItems.map((item) => item.nodeId)).to.deep.equal(['document-42']);
      row.expand();
      await el.updateComplete;
      expect(row.childItems().map((item) => item.nodeId)).to.deep.equal(['child']);
      await expect(el).to.be.accessible();
    });
  }

  it('preserves usable data names and name-from-content, including description and badge-only rows', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Documents"></lr-tree>`);
    el.data = [
      { id: 'spoken', label: '', accessibleLabel: 'Spoken name' },
      { id: 'visible', label: 'Visible name', accessibleLabel: '   ' },
      { id: 'description', label: '', description: 'Description name' },
      { id: 'badge', label: '', badges: [{ text: 'Badge name' }] },
      { id: 'badge-label', label: '', badges: [{ text: '', label: 'Badge spoken name' }] },
    ];
    await el.updateComplete;
    const rows = Array.from(el.querySelectorAll<LyraTreeItem>('lr-tree-item'));
    expect(rows.map((row) => row.getAttribute('aria-label'))).to.deep.equal(['Spoken name', '   ', null, null, null]);
    await expect(el).to.be.accessible();
  });

  it('refreshes only component-owned fallback names and preserves explicit host naming', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Documents"></lr-tree>`);
    el.data = [{ id: 'stable', label: '' }];
    await el.updateComplete;
    const row = el.querySelector<LyraTreeItem>('lr-tree-item')!;
    expect(row.getAttribute('aria-label')).to.equal('stable');
    el.data = [{ id: 'stable', label: 'Visible name' }];
    await el.updateComplete;
    expect(row.getAttribute('aria-label')).to.equal(null);
    row.setAttribute('aria-label', '');
    el.data = [{ id: 'stable', label: '' }];
    await el.updateComplete;
    expect(row.getAttribute('aria-label')).to.equal('');
    row.setAttribute('aria-label', 'Author name');
    el.data = [{ id: 'stable', label: '', accessibleLabel: 'Data name' }];
    await el.updateComplete;
    expect(row.getAttribute('aria-label')).to.equal('Author name');
    row.removeAttribute('aria-label');
    el.data = [{ id: 'stable', label: '', description: 'Description' }];
    await el.updateComplete;
    expect(row.getAttribute('aria-label')).to.equal(null);
  });

  it('does not supply ID names to rich declarative items', async () => {
    const row = await fixture<LyraTreeItem>(html`<lr-tree-item><strong>Rich name</strong></lr-tree-item>`);
    expect(row.getAttribute('aria-label')).to.equal(null);
    expect(row.nodeLabel).to.equal('Rich name');
  });
});
