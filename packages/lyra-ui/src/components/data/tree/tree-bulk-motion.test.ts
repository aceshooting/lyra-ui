import { expect, fixture, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';
import { twoFrames } from '../../../../test/frames.js';

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
