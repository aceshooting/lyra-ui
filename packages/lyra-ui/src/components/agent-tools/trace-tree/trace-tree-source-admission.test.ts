import { expect, fixture, html } from '@open-wc/testing';
import { HierarchySourceController } from '../../../internal/hierarchy-source-controller.js';
import '../../lr-task-list.js';
import '../../lr-span-waterfall.js';
import '../../lr-trace-tree.js';

it('keeps array-mode task and span updates out of the provider controller', async () => {
  const original = HierarchySourceController.prototype.update;
  let calls = 0;
  HierarchySourceController.prototype.update = function (...args) {
    calls++;
    original.apply(this, args);
  };
  try {
    const wrap = await fixture(html`<div><lr-task-list></lr-task-list><lr-span-waterfall></lr-span-waterfall><lr-trace-tree></lr-trace-tree></div>`);
    const tasks = wrap.querySelector('lr-task-list')!;
    const waterfall = wrap.querySelector('lr-span-waterfall')!;
    const tree = wrap.querySelector('lr-trace-tree')!;
    tasks.items = [{ id: 'a', label: 'Task', status: 'running' }];
    tree.spans = waterfall.spans = [{ id: 'r', name: 'Run', kind: 'tool', status: 'running', startMs: 0 }];
    await Promise.all([tasks.updateComplete, tree.updateComplete, waterfall.updateComplete]);
    expect(calls).to.equal(0);
    expect(tasks.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(1);
    expect(tree.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
    expect(waterfall.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(1);
  } finally {
    HierarchySourceController.prototype.update = original;
  }
});
