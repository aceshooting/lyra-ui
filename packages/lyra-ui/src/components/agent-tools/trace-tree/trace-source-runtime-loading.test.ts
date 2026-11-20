import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyRow } from '../../../data-sources.js';
import type { LyraTraceTree, TraceTreeSource } from './trace-tree.class.js';
import type { LyraSpan } from './span.js';
import type { LyraSpanWaterfall } from '../span-waterfall/span-waterfall.class.js';
import type { LyraTaskList, TaskItem, TaskListSource } from '../task-list/task-list.class.js';
import { __resetHierarchySourceRuntimeForTesting } from '../../../internal/lazy-hierarchy-source.js';
import './trace-tree.js';
import '../span-waterfall/span-waterfall.js';
import '../task-list/task-list.js';

const span: LyraSpan = { id: 'work', name: 'Generate answer', kind: 'tool', status: 'success', startMs: 100, endMs: 125 };
const spanRow: LyraHierarchyRow<LyraSpan> = { key: 'work', value: span, parentKey: null, level: 1, position: 1, setSize: 1, childCount: 0, expanded: false, selected: false };
const traceSource = (): TraceTreeSource => ({ revision: 1, async project(request) {
  return { state: 'one', total: 1, summary: { startMs: 100, endMs: 200 },
    rows: { count: 1, keyAt: () => 'work', itemAt: () => spanRow, indexOfKey: () => 0 },
    ...(request.action.type === 'reveal' ? { focusIndex: 0 } : {}) };
} });
const task: TaskItem = { id: 'task', label: 'Plan', status: 'success' };
const taskRow: LyraHierarchyRow<TaskItem> = { key: 'task', value: task, parentKey: null, level: 1, position: 1, setSize: 1, childCount: 0, expanded: false, selected: false };
const taskSource = (): TaskListSource => ({ revision: 1, async project(request) {
  return { state: 'one', total: 1, summary: { total: 1, completed: 1 },
    rows: { count: 1, keyAt: () => 'task', itemAt: () => taskRow, indexOfKey: () => 0 },
    ...(request.action.type === 'reveal' ? { focusIndex: 0 } : {}) };
} });

it('array-mode trace and task hosts leave the source runtime and virtualized list unloaded until a source is assigned', async () => {
  const tree = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${[span]}></lr-trace-tree>`);
  const waterfall = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${[span]}></lr-span-waterfall>`);
  const tasks = await fixture<LyraTaskList>(html`<lr-task-list .items=${[task]}></lr-task-list>`);
  expect(Boolean(customElements.get('lr-virtual-list'))).to.equal(false);
  expect(tree.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.be.greaterThan(0);

  tree.treeSource = traceSource();
  await tree.updateComplete;
  await waitUntil(() => tree.shadowRoot!.querySelector('[data-source-key="work"]'), 'trace row mounts');
  const VirtualList = customElements.get('lr-virtual-list');
  expect(Boolean(VirtualList && tree.shadowRoot!.querySelector('lr-virtual-list') instanceof VirtualList)).to.equal(true);

  waterfall.treeSource = traceSource();
  tasks.treeSource = taskSource();
  await Promise.all([waterfall.updateComplete, tasks.updateComplete]);
  await waitUntil(() => waterfall.shadowRoot!.querySelector('[data-source-key="work"]') &&
    tasks.shadowRoot!.querySelector('[data-source-key="task"]'), 'waterfall and task rows mount');
  expect(await tasks.revealSourceKey('task')).to.equal(true);
});

it('settles a reveal requested before the source runtime has loaded and mounts the source afterwards', async () => {
  __resetHierarchySourceRuntimeForTesting();
  const tree = await fixture<LyraTraceTree>(html`<lr-trace-tree></lr-trace-tree>`);
  tree.treeSource = traceSource();
  expect(await tree.revealSourceKey('work')).to.equal(true);
  await tree.updateComplete;
  await waitUntil(() => tree.shadowRoot!.querySelector('[data-source-key="work"]'), 'trace row mounts');
  expect(await tree.revealSourceKey('work')).to.equal(true);
  tree.treeSource = undefined;
  expect(await tree.revealSourceKey('work')).to.equal(false);
});
