import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';
import { twoFrames } from '../../../../test/frames.js';

it('reads computed animation style once per expanded branch', async () => {
  const tree = await fixture<LyraTree>(html`
    <lr-tree label="Motion" data-lr-motion="system" style="--show-duration: 20ms">
      <lr-tree-item label="First"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
      <lr-tree-item label="Second"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
    </lr-tree>
  `);
  const branches = [...tree.children] as LyraTreeItem[];
  await Promise.all(branches.map(branch => branch.updateComplete));
  const reads = [0, 0];
  const original = window.getComputedStyle;
  window.getComputedStyle = (target, pseudo) => {
    const index = branches.findIndex(branch =>
      target === branch || target === branch.shadowRoot!.querySelector('[part="children"]'));
    const computed = original.call(window, target, pseudo);
    if (index < 0) return computed;
    let counted = false;
    const countMotionRead = () => {
      if (counted) return;
      counted = true;
      reads[index] = reads[index]! + 1;
    };
    return new Proxy(computed, {
      get(style, key) {
        if (key === 'animationName') countMotionRead();
        if (key === 'getPropertyValue') return (property: string) => {
          if (property === '--show-duration') countMotionRead();
          return style.getPropertyValue(property);
        };
        return Reflect.get(style, key, style);
      },
    });
  };
  try {
    const after = Promise.all(branches.map(branch => oneEvent(branch, 'lr-after-expand')));
    await tree.expandAll();
    await after;
    expect(reads).to.deep.equal([1, 1]);
  } finally {
    window.getComputedStyle = original;
  }
});

it('preserves separately styled sibling completion deadlines during bulk expansion', async () => {
  const tree = await fixture<LyraTree>(html`<lr-tree label="Motion" data-lr-motion="system">
    <lr-tree-item label="Fast" style="--show-duration:19ms"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
    <lr-tree-item label="Slow" style="--show-duration:73ms"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
  </lr-tree>`);
  await twoFrames();
  const roots = [...tree.children] as LyraTreeItem[];
  const originalTimeout = window.setTimeout;
  const originalClear = window.clearTimeout;
  const originalMedia = window.matchMedia;
  const callbacks: Array<{delay:number;finish:VoidFunction}> = [];
  const completed: string[] = [];
  roots.forEach(node => node.addEventListener('lr-after-expand',event=>{
    if (event.target === node) completed.push(node.label);
  }));
  window.matchMedia = ((query:string) => query === '(prefers-reduced-motion: reduce)'
    ? {matches:false,media:query} as MediaQueryList : originalMedia.call(window,query)) as typeof window.matchMedia;
  window.setTimeout = ((handler:TimerHandler,delay?:number,...args:unknown[])=>{
    if (typeof handler === 'function' && (delay === 19 || delay === 73)) {
      callbacks.push({delay,finish:handler as VoidFunction});return -callbacks.length;
    }
    return Reflect.apply(originalTimeout, window, [handler,delay,...args]) as number;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((handle?:number)=>{if (handle === undefined || handle >= 0) originalClear.call(window,handle);}) as typeof window.clearTimeout;
  try {
    await tree.expandAll();
    await Promise.resolve();
    expect(callbacks.map(entry=>entry.delay)).to.deep.equal([19,73]);
    callbacks[0]!.finish(); expect(completed).to.deep.equal(['Fast']);
    callbacks[1]!.finish(); expect(completed).to.deep.equal(['Fast','Slow']);
  } finally {
    tree.remove();
    window.setTimeout = originalTimeout;window.clearTimeout=originalClear;window.matchMedia=originalMedia;
  }
});
