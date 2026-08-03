import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, TreeItem } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

describe('tree-item badges', () => {
  const dataWithBadges: TreeItem[] = [
    {
      id: 'a',
      label: 'src/app.ts',
      badge: 3,
      badges: [
        { text: 'M', tone: 'brand', label: 'Modified' },
        { text: '+2', tone: 'success' },
      ],
    },
  ];

  it('renders no badge parts when neither badge nor badges is set', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'no badges here' }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = node.shadowRoot!.querySelectorAll('[part="badge"]');
    expect(badgeParts.length).to.equal(0);
  });

  it('renders badges chips with data-tone after the legacy badge', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = [...node.shadowRoot!.querySelectorAll('[part="badge"]')] as HTMLElement[];
    // legacy badge (3) first, then the two badges chips, in array order
    expect(badgeParts.length).to.equal(3);
    expect(badgeParts[0].textContent!.trim()).to.equal('3');
    expect(badgeParts[1].textContent!.trim()).to.equal('M');
    expect(badgeParts[1].dataset.tone).to.equal('brand');
    expect(badgeParts[2].textContent!.trim()).to.equal('+2');
    expect(badgeParts[2].dataset.tone).to.equal('success');
  });

  it('uses label as the accessible name when set, else falls back to text', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = [...node.shadowRoot!.querySelectorAll('[part="badge"]')] as HTMLElement[];
    expect(badgeParts[1].getAttribute('aria-label')).to.equal('Modified'); // label wins
    expect(badgeParts[2].getAttribute('aria-label')).to.equal('+2'); // falls back to text
  });

  it('defaults an unset tone to neutral', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'x', badges: [{ text: 'U' }] }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    expect((node.shadowRoot!.querySelector('[part="badge"]') as HTMLElement).dataset.tone).to.equal('neutral');
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
      const colors = expected.get(badge.dataset.tone ?? '');
      expect(getComputedStyle(badge).color).to.equal(colors?.[0]);
      expect(getComputedStyle(badge).backgroundColor).to.equal(colors?.[1]);
    }
  });

  it('is accessible with badges and the legacy badge both present', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
