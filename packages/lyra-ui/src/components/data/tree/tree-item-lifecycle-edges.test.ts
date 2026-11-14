import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

function required<T>(value: T | null | undefined, context: string): T {
  if (value == null) throw new Error(`Missing ${context}`);
  return value;
}

describe('lr-tree-item lifecycle edges', () => {
  it('suppresses lr-after-expand when a collapse lands before the expansion renders', async () => {
    const el = await fixture<LyraTree>(html`
      <lr-tree label="Topics" style="--show-duration:0ms; --hide-duration:0ms">
        <lr-tree-item label="Parent"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
      </lr-tree>
    `);
    await el.updateComplete;
    const parent = required(el.querySelector('lr-tree-item'), 'parent') as LyraTreeItem;
    const events: string[] = [];
    for (const name of ['lr-expand', 'lr-after-expand', 'lr-collapse', 'lr-after-collapse']) {
      parent.addEventListener(name, () => events.push(name));
    }

    parent.expand();
    parent.collapse();
    await parent.updateComplete;
    // wait-reason: give both lifecycle timers (0ms durations) time to fire or be cancelled
    await aTimeout(30);

    expect(events).to.deep.equal(['lr-expand', 'lr-collapse', 'lr-after-collapse']);
    expect(parent.expanded).to.equal(false);
  });

  it('settles a pending lazy load without expanding when refreshed data drops laziness', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files"></lr-tree>`);
    el.data = [{ id: 'remote', label: 'Remote', lazy: true }];
    await el.updateComplete;
    const item = required(el.querySelector('lr-tree-item'), 'lazy row') as LyraTreeItem;
    const loading: boolean[] = [];
    item.addEventListener('lr-lazy-change', (event) => loading.push((event as CustomEvent<{ loading: boolean }>).detail.loading));
    let expands = 0;
    item.addEventListener('lr-expand', () => expands++);

    item.expand();
    await item.updateComplete;
    expect(item.getAttribute('aria-busy')).to.equal('true');

    item.item = { id: 'remote', label: 'Remote' };
    await item.updateComplete;

    expect(loading).to.deep.equal([true, false]);
    expect(expands).to.equal(0);
    expect(item.expanded).to.equal(false);
    expect(item.hasAttribute('aria-busy')).to.equal(false);
  });

  it('reports no rendered children for a data row that has never connected', () => {
    const item = document.createElement('lr-tree-item') as LyraTreeItem;
    item.item = { id: 'detached', label: 'Detached', children: [{ id: 'kid', label: 'Kid' }] } as LyraTreeNodeData;

    expect(item.childItems()).to.deep.equal([]);
    expect(item.getChildrenItems({ includeDisabled: false })).to.deep.equal([]);
  });

  it('uses a forwarded slot fallback as the label when nothing is assigned to it', async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <lr-tree label="Forwarded">
        <lr-tree-item label="Attribute label"><span><slot name="label">Fallback text</slot></span></lr-tree-item>
        <lr-tree-item label="Plain"><slot name="empty"></slot></lr-tree-item>
      </lr-tree>`;
    const tree = required(root.querySelector('lr-tree'), 'tree') as LyraTree;
    await tree.updateComplete;
    const [forwarded, plain] = [...root.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
    await forwarded!.updateComplete;
    await plain!.updateComplete;

    expect(forwarded!.nodeLabel).to.equal('Fallback text');
    const forwardedLabel = required(forwarded!.shadowRoot!.querySelector('[part~="label"]'), 'forwarded label part');
    expect(forwardedLabel.textContent!.includes('Attribute label')).to.equal(false);
    expect(plain!.nodeLabel).to.equal('Plain');
  });
});
