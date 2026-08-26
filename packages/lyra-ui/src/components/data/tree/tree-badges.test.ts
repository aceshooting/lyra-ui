import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

function required<T>(value: T | undefined, context: string): T {
  if (value === undefined) throw new Error(`Missing ${context}`);
  return value;
}

describe('tree-item badges', () => {
  const dataWithBadges: LyraTreeNodeData[] = [
    {
      id: 'a',
      label: 'src/app.ts',
      badges: [
        { text: '3' },
        { text: 'M', tone: 'brand', label: 'Modified' },
        { text: '+2', tone: 'success' },
      ],
    },
  ];

  it('renders no badge parts when badges is unset', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'no badges here' }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = node.shadowRoot!.querySelectorAll('[part="badge"]');
    expect(badgeParts.length).to.equal(0);
  });

  it('does not retain the removed singular badge shortcut', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'Legacy input', badge: 3 } as unknown as LyraTreeNodeData];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    expect(node.shadowRoot!.querySelectorAll('[part="badge"]')).to.have.length(0);
    expect('badge' in el.data[0]!).to.be.false;
  });

  it('drops malformed badge records and badges without string text', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [
      {
        id: 'a',
        label: 'Mixed badges',
        badges: [null, ['nested'], { text: 7 }, { text: 'Valid' }],
      } as unknown as LyraTreeNodeData,
    ];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badges = [...node.shadowRoot!.querySelectorAll<HTMLElement>('[part="badge"]')];
    expect(badges.map((badge) => badge.textContent!.trim())).to.deep.equal(['Valid']);
    expect(el.data[0]!.badges).to.deep.equal([{ text: 'Valid', tone: 'neutral' }]);
  });

  it('renders badge chips in array order with a normalized tone', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = [...node.shadowRoot!.querySelectorAll('[part="badge"]')] as HTMLElement[];
    expect(badgeParts.length).to.equal(3);
    expect(required(badgeParts[0], 'first badge').textContent!.trim()).to.equal('3');
    expect(required(badgeParts[1], 'second badge').textContent!.trim()).to.equal('M');
    expect(required(badgeParts[1], 'second badge').dataset['tone']).to.equal('brand');
    expect(required(badgeParts[2], 'third badge').textContent!.trim()).to.equal('+2');
    expect(required(badgeParts[2], 'third badge').dataset['tone']).to.equal('success');
  });

  it('uses label as the accessible name when set, else falls back to text', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = [...node.shadowRoot!.querySelectorAll('[part="badge"]')] as HTMLElement[];
    expect(required(badgeParts[1], 'labeled badge').getAttribute('role')).to.equal('img');
    expect(required(badgeParts[1], 'labeled badge').getAttribute('aria-label')).to.equal('Modified'); // label wins
    expect(required(badgeParts[2], 'text-named badge').hasAttribute('role')).to.equal(false);
    expect(required(badgeParts[2], 'text-named badge').hasAttribute('aria-label')).to.equal(false); // its text names it naturally
  });

  it('defaults an unset tone to neutral', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'x', badges: [{ text: 'U' }] }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    expect((node.shadowRoot!.querySelector('[part="badge"]') as HTMLElement).dataset['tone']).to.equal('neutral');
  });

  it('lets each badge tone foreground and background be rethemed independently', async () => {
    const el = (await fixture(html`
      <lr-tree
        style="
          --lr-tree-badge-neutral-color: rgb(1, 2, 3);
          --lr-tree-badge-neutral-bg: rgb(4, 5, 6);
          --lr-tree-badge-brand-color: rgb(7, 8, 9);
          --lr-tree-badge-brand-bg: rgb(10, 11, 12);
          --lr-tree-badge-success-color: rgb(13, 14, 15);
          --lr-tree-badge-success-bg: rgb(16, 17, 18);
          --lr-tree-badge-warning-color: rgb(19, 20, 21);
          --lr-tree-badge-warning-bg: rgb(22, 23, 24);
          --lr-tree-badge-danger-color: rgb(25, 26, 27);
          --lr-tree-badge-danger-bg: rgb(28, 29, 30);
        "
      ></lr-tree>
    `)) as LyraTree;
    el.data = [{
      id: 'a',
      label: 'x',
      badges: [
        { text: 'N', tone: 'neutral' },
        { text: 'B', tone: 'brand' },
        { text: 'S', tone: 'success' },
        { text: 'W', tone: 'warning' },
        { text: 'D', tone: 'danger' },
      ],
    }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const expected = new Map([
      ['neutral', ['rgb(1, 2, 3)', 'rgb(4, 5, 6)']],
      ['brand', ['rgb(7, 8, 9)', 'rgb(10, 11, 12)']],
      ['success', ['rgb(13, 14, 15)', 'rgb(16, 17, 18)']],
      ['warning', ['rgb(19, 20, 21)', 'rgb(22, 23, 24)']],
      ['danger', ['rgb(25, 26, 27)', 'rgb(28, 29, 30)']],
    ]);
    for (const badge of node.shadowRoot!.querySelectorAll<HTMLElement>('[part="badge"]')) {
      const colors = expected.get(badge.dataset['tone'] ?? '');
      expect(getComputedStyle(badge).color).to.equal(colors?.[0]);
      expect(getComputedStyle(badge).backgroundColor).to.equal(colors?.[1]);
    }
  });

  it('is accessible with multiple badges present', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
