import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraTaskSourceSummary } from '../../../data-sources.js';
import type { LyraTaskList, TaskItem } from './task-list.class.js';
import './task-list.js';

type TaskListSource = LyraHierarchySource<TaskItem, LyraHierarchyQuery, LyraTaskSourceSummary>;
type TaskList = LyraTaskList & { treeSource: TaskListSource | undefined };

const TOP_LEVEL = 3;

function topRow(index: number, expanded: boolean): LyraHierarchyRow<TaskItem> {
  const key = `task${index}`;
  return {
    key, value: { id: key, label: `Task ${index}`, status: 'success' },
    parentKey: null, level: 1, position: index + 1, setSize: TOP_LEVEL, childCount: index === 0 ? 1 : 0, expanded: index === 0 && expanded, selected: false,
  };
}

const childRow: LyraHierarchyRow<TaskItem> = {
  key: 'task0-step', value: { id: 'task0-step', label: 'Step', status: 'success' },
  parentKey: 'task0', level: 2, position: 1, setSize: 1, childCount: 0, expanded: false, selected: false,
};

/** A range-read provider (no random access): focus recovery resolves keys through `indexOfKey`. */
function rangedSource(lookups: string[]): TaskListSource {
  let expanded = false;
  return {
    revision: 1,
    async project(request) {
      if (request.action.type === 'toggle' && request.action.key === 'task0') expanded = request.action.expanded;
      const visible = [topRow(0, expanded), ...(expanded ? [childRow] : []), topRow(1, false), topRow(2, false)];
      return {
        state: expanded ? 'open' : 'closed', total: TOP_LEVEL + 1, summary: { total: TOP_LEVEL, completed: TOP_LEVEL },
        rows: {
          count: visible.length,
          async indexOfKey(key: string) {
            lookups.push(key);
            const index = visible.findIndex(candidate => candidate.key === key);
            return index < 0 ? null : index;
          },
          async read(range) { return visible.slice(range.offset, range.offset + range.limit); },
        },
      };
    },
  };
}

describe('lr-task-list focus recovery over a range-read source', () => {
  it('resolves the focused task through the source after expanding it', async () => {
    const lookups: string[] = [];
    const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${rangedSource(lookups)}></lr-task-list>`);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="task0"]')), 'rows mount');
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!);
    await sendKeys({ press: 'End' });
    await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-source-key') === 'task2', 'last task has focus');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="task0"] [part="source-toggle"]')!.click();
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="task0-step"]')), 'child row appears');
    await waitUntil(() => lookups.includes('task2'), 'focused task is resolved through the source');
    expect(el.shadowRoot!.querySelector('[data-source-key="task0"]')?.getAttribute('aria-expanded')).to.equal('true');
  });
});
