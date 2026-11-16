import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraTaskSourceSummary } from '../../../data-sources.js';
import type { LyraTaskList, TaskItem } from './task-list.class.js';
import './task-list.js';

type TaskListSource = LyraHierarchySource<TaskItem, LyraHierarchyQuery, LyraTaskSourceSummary>;
type TaskList = LyraTaskList & { treeSource: TaskListSource | undefined };

const task = (key: string, id = key): LyraHierarchyRow<TaskItem> => ({ key, value: { id, label: `Label ${id}`, status: 'success' },
  parentKey: null, level: 1, position: 1, setSize: 2, childCount: 0, expanded: false, selected: false });
const sourceError = (el: TaskList) => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]'));

it('fails a provider task whose id disagrees with its row key', async () => {
  const rows = [task('good'), task('claimed', 'other')];
  const source: TaskListSource = { revision: 1, async project() {
    return { state: 'mismatch', total: 2, summary: { total: 2, completed: 2 },
      rows: { count: 2, keyAt: (index) => rows[index]!.key, itemAt: (index) => rows[index]!,
        indexOfKey: (key: string | number) => rows.findIndex((candidate) => candidate.key === key) } };
  } };
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${source}></lr-task-list>`);
  await waitUntil(() => sourceError(el), 'the mismatched task fails closed');
  expect(el.shadowRoot!.textContent).not.to.include('Label other');
});

it('fails a ranged page that is not an array of the requested rows', async () => {
  const source: TaskListSource = { revision: 1, async project() {
    return { state: 'oversized', total: 2, summary: { total: 2, completed: 2 },
      rows: { count: 2, async indexOfKey(key: string) { return key === 'a' ? 0 : key === 'b' ? 1 : null; },
        async read(request) { return { length: request.limit, 0: task('a'), 1: task('b') } as unknown as LyraHierarchyRow<TaskItem>[]; } } };
  } };
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${source}></lr-task-list>`);
  await waitUntil(() => sourceError(el), 'the malformed page fails closed');
  expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
});
