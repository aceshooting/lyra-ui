import { fixture, expect, html } from '@open-wc/testing';
import './task-list.js';
import type { LyraTaskList, TaskItem } from './task-list.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const reorderItems: TaskItem[] = [
  {
    id: 'prepare',
    label: 'Prepare sources',
    status: 'success',
    children: [
      { id: 'prepare-a', label: 'Collect links', status: 'success' },
      { id: 'prepare-b', label: 'Read documents', status: 'running' },
      { id: 'prepare-c', label: 'Extract notes', status: 'pending' },
    ],
  },
  { id: 'write', label: 'Write response', status: 'pending' },
  { id: 'review', label: 'Review response', status: 'pending' },
];

const clone = (): TaskItem[] => JSON.parse(JSON.stringify(reorderItems)) as TaskItem[];

type MutableTaskItem = Omit<TaskItem, 'children'> & { children?: MutableTaskItem[] };

function itemRow(el: LyraTaskList, id: string): HTMLElement {
  const row = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')].find(
    (candidate) => candidate.dataset['id'] === id,
  );
  if (!row) throw new Error(`Could not find task row ${id}`);
  return row;
}

function focusedItemId(el: LyraTaskList): string | undefined {
  return (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id'];
}

function modifiedArrow(
  row: HTMLElement,
  key: 'ArrowUp' | 'ArrowDown',
  modifier: 'ctrlKey' | 'metaKey' = 'ctrlKey',
): void {
  row.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
      [modifier]: true,
    }),
  );
}

function applyItemsReorder(el: LyraTaskList, event: CustomEvent): void {
  const { parentTaskId, fromIndex, toIndex } = event.detail as {
    taskId: string;
    parentTaskId: string | null;
    fromIndex: number;
    toIndex: number;
  };
  const next = JSON.parse(JSON.stringify(el.items)) as MutableTaskItem[];
  const siblings = parentTaskId === null ? next : next.find((item) => item.id === parentTaskId)?.children;
  if (!siblings) return;
  const [moved] = siblings.splice(fromIndex, 1);
  if (!moved) return;
  siblings.splice(toIndex, 0, moved);
  el.items = next;
}

async function liveRegionText(el: LyraTaskList): Promise<string> {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!
    .textContent!;
}

describe('reorderable', () => {
  it('is opt-in: unset task rows remain non-focusable and Ctrl+Arrow never emits lr-reorder', async () => {
    const el = (await fixture(html`<lr-task-list .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    expect(el.reorderable).to.be.false;
    expect(el.hasAttribute('reorderable')).to.be.false;
    expect(row.hasAttribute('tabindex')).to.be.false;
    expect(events.length).to.equal(0);
  });

  it('reflects reorderable and gives only valid reorderable data keyboard stops', async () => {
    const el = (await fixture(html`<lr-task-list .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    el.reorderable = true;
    await el.updateComplete;

    expect(el.hasAttribute('reorderable')).to.be.true;
    expect(itemRow(el, 'prepare').getAttribute('tabindex')).to.equal('0');
    expect(itemRow(el, 'prepare-b').getAttribute('tabindex')).to.equal('0');
  });

  it('Ctrl+ArrowDown requests a top-level sibling swap without mutating items', async () => {
    const source = clone();
    const el = (await fixture(html`<lr-task-list reorderable .items=${source}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.focus();
    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0]!.detail).to.deep.equal({
      taskId: 'prepare',
      parentTaskId: null,
      fromIndex: 0,
      toIndex: 1,
    });
    expect(events[0]!.bubbles).to.be.true;
    expect(events[0]!.composed).to.be.true;
    expect(source.map((item) => item.id)).to.deep.equal(['prepare', 'write', 'review']);
    expect(el.items).to.deep.equal(source);
  });

  it('Cmd+ArrowUp on a child reports its parent and sibling-scoped indices', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare-b');
    row.focus();
    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));

    modifiedArrow(row, 'ArrowUp', 'metaKey');
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0]!.detail).to.deep.equal({
      taskId: 'prepare-b',
      parentTaskId: 'prepare',
      fromIndex: 1,
      toIndex: 0,
    });
  });

  it('does not steal a modified arrow from focusable detail content', async () => {
    const el = (await fixture(html`
      <lr-task-list reorderable .items=${clone()}>
        <button slot="detail-prepare" type="button">Open source</button>
      </lr-task-list>
    `)) as LyraTaskList;
    const detailButton = el.querySelector('button') as HTMLButtonElement;
    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));
    detailButton.focus();

    detailButton.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        composed: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    await el.updateComplete;

    expect(events.length).to.equal(0);
  });

  it('never reparents past either sibling boundary and leaves focus on the attempted row', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const first = itemRow(el, 'prepare-a');
    const last = itemRow(el, 'prepare-c');
    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));

    first.focus();
    modifiedArrow(first, 'ArrowUp');
    await el.updateComplete;
    expect(focusedItemId(el)).to.equal('prepare-a');

    last.focus();
    modifiedArrow(last, 'ArrowDown');
    await el.updateComplete;
    expect(focusedItemId(el)).to.equal('prepare-c');
    expect(events.length).to.equal(0);
  });

  it('fails closed for duplicate ids: data remains visible but does not expose ambiguous reorder actions', async () => {
    const duplicate: TaskItem[] = [
      { id: 'shared', label: 'First shared task', status: 'pending' },
      { id: 'shared', label: 'Second shared task', status: 'pending' },
    ];
    const el = (await fixture(html`<lr-task-list reorderable .items=${duplicate}></lr-task-list>`)) as LyraTaskList;
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')];
    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));

    rows[0]!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        composed: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    await el.updateComplete;

    expect(rows.map((row) => row.dataset['id'])).to.deep.equal(['shared', 'shared']);
    expect(rows.every((row) => !row.hasAttribute('tabindex'))).to.be.true;
    expect(events.length).to.equal(0);
  });

  it('keeps focus on the moved top-level row after a controlled host update', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.focus();
    el.addEventListener('lr-reorder', (event) => applyItemsReorder(el, event as CustomEvent));

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    expect(
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"][data-depth="0"]')].map(
        (candidate) => candidate.dataset['id'],
      ),
    ).to.deep.equal(['write', 'prepare', 'review']);
    expect(focusedItemId(el)).to.equal('prepare');
  });

  it('keeps focus on the moved child row after a controlled host update', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare-a');
    row.focus();
    el.addEventListener('lr-reorder', (event) => applyItemsReorder(el, event as CustomEvent));

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    expect(
      [...itemRow(el, 'prepare').querySelectorAll<HTMLElement>('[part="item"]')].map(
        (candidate) => candidate.dataset['id'],
      ),
    ).to.deep.equal(['prepare-b', 'prepare-a', 'prepare-c']);
    expect(focusedItemId(el)).to.equal('prepare-a');
  });

  it('does not announce a move when the host ignores a reorder request', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.focus();

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    expect((await liveRegionText(el)).trim()).to.equal('');
  });

  it('announces only after the host confirms the exact requested sibling swap', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.focus();
    el.addEventListener('lr-reorder', (event) => applyItemsReorder(el, event as CustomEvent));

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    const announcement = await liveRegionText(el);
    expect(announcement).to.contain('Prepare sources');
    expect(announcement).to.contain('2');
    expect(announcement).to.contain('3');
  });

  it('returns the shared live region to polite for a confirmed move after an assertive failure', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    el.items = el.items.map((item) => (item.id === 'prepare' ? { ...item, status: 'error' } : item));
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region')!;
    expect(region.mode).to.equal('assertive');

    const row = itemRow(el, 'prepare');
    row.focus();
    el.addEventListener('lr-reorder', (event) => applyItemsReorder(el, event as CustomEvent));
    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    expect(region.mode).to.equal('polite');
    expect(await liveRegionText(el)).to.contain('Prepare sources');
  });

  it('keeps an asynchronous request through unrelated updates without announcing early', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.focus();
    let request: CustomEvent | undefined;
    el.addEventListener('lr-reorder', (event) => {
      request = event as CustomEvent;
    });

    modifiedArrow(row, 'ArrowDown');
    el.label = 'Updated while persistence is pending';
    await el.updateComplete;
    expect((await liveRegionText(el)).trim()).to.equal('');

    applyItemsReorder(el, request!);
    await el.updateComplete;
    expect(await liveRegionText(el)).to.contain('Prepare sources');
  });

  it('rejects a divergent host order and never misattributes a later update as the requested move', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.focus();
    el.addEventListener(
      'lr-reorder',
      () => {
        el.items = [clone()[0]!, clone()[2]!, clone()[1]!];
      },
      { once: true },
    );

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;
    expect((await liveRegionText(el)).trim()).to.equal('');

    el.items = [clone()[1]!, clone()[0]!, clone()[2]!];
    await el.updateComplete;
    expect((await liveRegionText(el)).trim()).to.equal('');
  });

  it('clears a child reorder request when its parent disappears before the host responds', async () => {
    const el = await fixture<LyraTaskList>(html`
      <lr-task-list reorderable .items=${clone()}></lr-task-list>
    `);
    modifiedArrow(itemRow(el, 'prepare-a'), 'ArrowDown');

    el.items = clone().slice(1);
    await el.updateComplete;
    expect((await liveRegionText(el)).trim()).to.equal('');

    const restored = clone();
    const children = restored[0]!.children!;
    restored[0] = {
      ...restored[0]!,
      children: [children[1]!, children[0]!, ...children.slice(2)],
    };
    el.items = restored;
    await el.updateComplete;
    expect((await liveRegionText(el)).trim()).to.equal('');
  });

  it('does not swap the vertical reorder keys under dir="rtl"', async () => {
    const el = (await fixture(html`<lr-task-list dir="rtl" reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.focus();
    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));

    modifiedArrow(row, 'ArrowDown');
    await el.updateComplete;

    expect(events[0]!.detail).to.deep.equal({
      taskId: 'prepare',
      parentTaskId: null,
      fromIndex: 0,
      toIndex: 1,
    });
  });

  it('localizes the move announcement and formats its numbers through the effective locale', async () => {
    const el = (await fixture(
      html`<lr-task-list reorderable lang="ar-u-nu-arab" .items=${clone()}></lr-task-list>`,
    )) as LyraTaskList;
    el.strings = { treeNodeMoved: 'نُقل {label} إلى الموضع {index} من {total}' };
    await el.updateComplete;
    const row = itemRow(el, 'prepare');
    row.focus();
    el.addEventListener('lr-reorder', (event) => applyItemsReorder(el, event as CustomEvent));

    modifiedArrow(row, 'ArrowDown', 'metaKey');
    await el.updateComplete;

    const announcement = await liveRegionText(el);
    expect(announcement).to.contain('نُقل Prepare sources');
    expect(announcement).to.match(/[\u0660-\u0669]/);
  });

  it('shows a rendered hover affordance and focus ring on a keyboard-reorderable row', async () => {
    const el = (await fixture(
      html`<lr-task-list reorderable style="--lr-transition-fast:0s" .items=${clone()}></lr-task-list>`,
    )) as LyraTaskList;
    const row = itemRow(el, 'prepare');
    row.scrollIntoView();
    const resting = getComputedStyle(row).backgroundColor;
    const rect = row.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    try {
      await sendMouse({ type: 'move', position });
      expect(getComputedStyle(row).backgroundColor).to.not.equal(resting);
    } finally {
      await resetMouse();
    }

    row.focus();
    expect(getComputedStyle(row).outlineStyle).to.equal('solid');
  });

  it('is accessible with populated keyboard-reorderable tasks', async () => {
    const el = (await fixture(html`<lr-task-list reorderable .items=${clone()}></lr-task-list>`)) as LyraTaskList;
    await expect(el).to.be.accessible();
  });
});
