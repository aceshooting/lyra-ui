import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './task-list.js';
import type { LyraTaskList, TaskItem } from './task-list.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-task-list', 'appearance');

const items: TaskItem[] = [
  { id: 'step-1', label: 'Read repository', status: 'success' },
  {
    id: 'step-2',
    label: 'Search the web',
    status: 'running',
    detail: 'Searching for recent changelog entries',
  },
  { id: 'step-3', label: 'Write summary', status: 'pending' },
];

it('defaults to items=[], a localized Tasks label, expanded=true, collapsible=true', async () => {
  const el = (await fixture(html`<lr-task-list></lr-task-list>`)) as LyraTaskList;
  expect(el.items).to.deep.equal([]);
  expect(el.label).to.be.undefined;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Tasks');
  expect(el.expanded).to.be.true;
  expect(el.hasAttribute('expanded')).to.be.true;
  expect(el.collapsible).to.be.true;
  const heading = el.shadowRoot!.querySelector<HTMLElement>('[role="heading"]')!;
  expect(heading.getAttribute('aria-level')).to.equal('3');
});

it('renders one [part="item"] row per top-level item, carrying data-status/data-id/data-depth', async () => {
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(rows.length).to.equal(3);
  expect(rows[1]!.dataset['status']).to.equal('running');
  expect(rows[1]!.dataset['id']).to.equal('step-2');
  expect(rows[1]!.dataset['depth']).to.equal('0');
});

it('renders each item label and optional detail text', async () => {
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(rows[1]!.querySelector('[part="item-label"]')!.textContent!.trim()).to.equal('Search the web');
  expect(rows[1]!.querySelector('[part="item-detail"]')!.textContent!.trim()).to.equal(
    'Searching for recent changelog entries',
  );
  expect((rows[0]!.querySelector('[part="item-detail"]')) == null).to.be.true;
});

it('renders one nested [part="item"] row per child, at depth 1, inside [part="item-children"]', async () => {
  const withChildren: TaskItem[] = [
    {
      id: 'parent',
      label: 'Refactor module',
      status: 'running',
      children: [
        { id: 'child-1', label: 'Update imports', status: 'success' },
        { id: 'child-2', label: 'Fix tests', status: 'pending' },
      ],
    },
  ];
  const el = (await fixture(html`<lr-task-list .items=${withChildren}></lr-task-list>`)) as LyraTaskList;
  const parentRow = el.shadowRoot!.querySelector('[part="item"][data-id="parent"]') as HTMLElement;
  const childWrapper = parentRow.querySelector('[part="item-children"]') as HTMLElement;
  expect(childWrapper.getAttribute('role')).to.equal('list');
  const childRows = [...childWrapper.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(childRows.length).to.equal(2);
  expect(childRows[0]!.dataset['depth']).to.equal('1');
  expect(childRows[0]!.dataset['id']).to.equal('child-1');
});

it('drops malformed top-level and child identities while retaining valid neighboring tasks', async () => {
  const malformed = [
    null,
    { label: 'Missing id', status: 'pending' },
    { id: 42, label: 'Numeric id', status: 'pending' },
    {
      id: 'parent',
      label: 'Parent',
      status: 'running',
      children: [
        null,
        { label: 'Missing child id', status: 'pending' },
        { id: 'child', label: 'Child', status: 'success' },
      ],
    },
  ] as unknown as TaskItem[];
  const el = await fixture<LyraTaskList>(html`
    <lr-task-list .items=${malformed}></lr-task-list>
  `);

  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')];
  expect(rows.map((row) => row.dataset['id'])).to.deep.equal(['parent', 'child']);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('0 of 1 completed');
});

it('ignores grandchildren (nesting beyond one level) and warns once', async () => {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const deep: TaskItem[] = [
      {
        id: 'parent',
        label: 'Parent',
        status: 'running',
        children: [
          {
            id: 'child',
            label: 'Child',
            status: 'running',
            children: [{ id: 'grandchild', label: 'Grandchild', status: 'pending' }],
          },
        ],
      },
    ];
    const el = (await fixture(html`<lr-task-list .items=${deep}></lr-task-list>`)) as LyraTaskList;
    expect((el.shadowRoot!.querySelector('[part="item"][data-id="grandchild"]')) == null).to.be.true;
    expect(calls.some((args) => String(args[0]).includes('grandchild'))).to.be.true;
  } finally {
    console.warn = originalWarn;
  }
});

it('shows a visible completed-of-total summary counting only top-level success items', async () => {
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('1 of 3 completed');
});

it('formats the completed-of-total summary with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-task-list lang="ar-EG" .items=${items}></lr-task-list>`,
  )) as LyraTaskList;
  const summary = el.shadowRoot!.querySelector('[part="summary"]')!.textContent!;
  const number = new Intl.NumberFormat('ar-EG');
  expect(summary).to.include(number.format(1));
  expect(summary).to.include(number.format(3));
});

it('toggles expanded and fires lr-toggle on header click when collapsible', async () => {
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  expect(header.tagName).to.equal('BUTTON');

  let firing = oneEvent(el, 'lr-toggle');
  header.click();
  let event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.false;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: false });
  expect(header.getAttribute('aria-expanded')).to.equal('false');
  expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hidden).to.be.true;

  firing = oneEvent(el, 'lr-toggle');
  header.click();
  event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.true;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: true });
});

it('renders a static, non-interactive heading (no button, no toggle) when collapsible=false', async () => {
  const el = (await fixture(
    html`<lr-task-list .items=${items} .collapsible=${false}></lr-task-list>`,
  )) as LyraTaskList;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.tagName).to.not.equal('BUTTON');
  expect(header.hasAttribute('aria-expanded')).to.be.false;
});

it('wraps either header shape in the configured heading level and supports the explicit none opt-out', async () => {
  const defaultList = (await fixture(
    html`<lr-task-list .items=${items}></lr-task-list>`,
  )) as LyraTaskList;
  expect(defaultList.shadowRoot!.querySelector('[role="heading"]')!.getAttribute('aria-level')).to.equal('3');

  const collapsible = (await fixture(
    html`<lr-task-list heading-level="2" .items=${items}></lr-task-list>`,
  )) as LyraTaskList;
  const collapsibleHeading = collapsible.shadowRoot!.querySelector<HTMLElement>('[role="heading"]')!;
  expect(collapsibleHeading.getAttribute('aria-level')).to.equal('2');
  expect(collapsibleHeading.querySelectorAll('button[part="header"]')).to.have.lengthOf(1);

  const staticList = (await fixture(
    html`<lr-task-list heading-level="5" .collapsible=${false} .items=${items}></lr-task-list>`,
  )) as LyraTaskList;
  const staticHeading = staticList.shadowRoot!.querySelector<HTMLElement>('[role="heading"]')!;
  expect(staticHeading.getAttribute('aria-level')).to.equal('5');
  expect(staticHeading.querySelectorAll('[part="header"]')).to.have.lengthOf(1);

  const unheaded = (await fixture(
    html`<lr-task-list heading-level="none" .items=${items}></lr-task-list>`,
  )) as LyraTaskList;
  expect(unheaded.shadowRoot!.querySelectorAll('[role="heading"]')).to.have.lengthOf(0);

  const invalid = (await fixture(
    html`<lr-task-list heading-level="outside-range" .items=${items}></lr-task-list>`,
  )) as LyraTaskList;
  expect(invalid.shadowRoot!.querySelector('[role="heading"]')!.getAttribute('aria-level')).to.equal('3');
});

it('accepts collapsible="false" as a plain-HTML attribute string', async () => {
  const el = (await fixture(html`<lr-task-list collapsible="false"></lr-task-list>`)) as LyraTaskList;
  expect(el.collapsible).to.be.false;
});

it('accepts expanded="false" as a plain-HTML attribute string', async () => {
  const el = (await fixture(html`<lr-task-list expanded="false"></lr-task-list>`)) as LyraTaskList;
  expect(el.expanded).to.be.false;
});

it('requests an opt-in controlled sibling reorder with Ctrl+ArrowDown', async () => {
  const el = (await fixture(html`<lr-task-list reorderable .items=${items}></lr-task-list>`)) as LyraTaskList;
  const row = el.shadowRoot!.querySelector('[part="item"][data-id="step-1"]') as HTMLElement;
  const events: CustomEvent[] = [];
  el.addEventListener('lr-reorder', (event) => events.push(event as CustomEvent));
  row.focus();

  row.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      composed: true,
      cancelable: true,
      ctrlKey: true,
    }),
  );
  await el.updateComplete;

  expect(events.length).to.equal(1);
  expect(events[0]!.detail).to.deep.equal({
    taskId: 'step-1',
    parentTaskId: null,
    fromIndex: 0,
    toIndex: 1,
  });
  expect(el.items.map((item) => item.id)).to.deep.equal(['step-1', 'step-2', 'step-3']);
});

it('fails reorder closed when any task identity is empty or blank', async () => {
  const el = await fixture<LyraTaskList>(html`
    <lr-task-list reorderable .items=${[
      { id: '', label: 'Empty', status: 'pending' },
      { id: 'valid', label: 'Valid', status: 'pending' },
    ]}></lr-task-list>
  `);
  let reorders = 0;
  el.addEventListener('lr-reorder', () => reorders++);
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="item"][data-id="valid"]')!;
  row.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowUp',
    bubbles: true,
    composed: true,
    cancelable: true,
    ctrlKey: true,
  }));
  expect(reorders).to.equal(0);
});

it('renders a dynamic detail-<id> slot per item for rich detail content', async () => {
  const el = (await fixture(html`
    <lr-task-list .items=${items}>
      <span slot="detail-step-2">extra chip content</span>
    </lr-task-list>
  `)) as LyraTaskList;
  const row = el.shadowRoot!.querySelector('[part="item"][data-id="step-2"]') as HTMLElement;
  const slot = row.querySelector('slot[name="detail-step-2"]') as HTMLSlotElement;
  expect(slot.assignedElements()[0]!.textContent).to.equal('extra chip content');
});

it('shows a shape-distinct status icon plus visually-hidden status text per item', async () => {
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="status-icon"]')).to.exist;
  expect(rows[0]!.querySelector('.sr-only')!.textContent!.trim()).to.equal('Success');
  expect(rows[1]!.querySelector('.sr-only')!.textContent!.trim()).to.equal('Running');
});

it('normalizes foreign runtime task statuses to pending instead of throwing', async () => {
  const el = await fixture<LyraTaskList>(html`
    <lr-task-list .items=${[
      { id: 'foreign', label: 'Foreign', status: 42 },
      { id: 'null', label: 'Null', status: null },
    ] as unknown as TaskItem[]}></lr-task-list>
  `);
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')];
  expect(rows.map((row) => row.dataset['status'])).to.deep.equal(['pending', 'pending']);
  expect(rows.map((row) => row.querySelector('.sr-only')!.textContent!.trim()))
    .to.deep.equal(['Pending', 'Pending']);
});

it('drops a malformed (null) item instead of throwing (regression)', async () => {
  const el = await fixture<LyraTaskList>(html`
    <lr-task-list .items=${[null, { id: 'ok', label: 'Good', status: 'pending' }] as never}></lr-task-list>
  `);
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')];
  expect(rows).to.have.length(1);
  expect(rows[0]!.dataset['id']).to.equal('ok');
});

it('drops rows with a missing or non-string id instead of rendering an invalid id (regression)', async () => {
  const el = await fixture<LyraTaskList>(html`
    <lr-task-list .items=${[
      { label: 'no-id', status: 'pending' },
      { id: 42, label: 'numeric-id', status: 'pending' },
      { id: 'ok', label: 'Good', status: 'pending' },
    ] as never}></lr-task-list>
  `);
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')];
  expect(rows).to.have.length(1);
  expect(rows[0]!.dataset['id']).to.equal('ok');
});

it('does not throw with reorderable set and a malformed item present (regression)', async () => {
  const el = await fixture<LyraTaskList>(html`
    <lr-task-list reorderable .items=${[
      { label: 'no-id', status: 'pending' },
      { id: 'ok', label: 'Good', status: 'pending' },
    ] as never}></lr-task-list>
  `);
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')];
  expect(rows).to.have.length(1);
  expect(rows[0]!.dataset['id']).to.equal('ok');

  const numericId = await fixture<LyraTaskList>(html`
    <lr-task-list reorderable .items=${[{ id: 42, label: 'numeric-id', status: 'pending' }] as never}></lr-task-list>
  `);
  expect(numericId.shadowRoot!.querySelectorAll('[part="item"]')).to.have.length(0);
});

it('drops a malformed direct child instead of throwing, with or without reorderable (regression)', async () => {
  const malformedChildItems = [
    {
      id: 'parent',
      label: 'Parent',
      status: 'pending',
      children: [null, { label: 'no-id' }, { id: 'child', label: 'Child', status: 'pending' }],
    },
  ] as never;

  const plain = await fixture<LyraTaskList>(html`<lr-task-list .items=${malformedChildItems}></lr-task-list>`);
  const plainChildRows = plain.shadowRoot!.querySelectorAll('[part="item-children"] [part="item"]');
  expect(plainChildRows).to.have.length(1);
  expect((plainChildRows[0] as HTMLElement).dataset['id']).to.equal('child');

  const reorderable = await fixture<LyraTaskList>(html`
    <lr-task-list reorderable .items=${malformedChildItems}></lr-task-list>
  `);
  const reorderableChildRows = reorderable.shadowRoot!.querySelectorAll('[part="item-children"] [part="item"]');
  expect(reorderableChildRows).to.have.length(1);
  expect((reorderableChildRows[0] as HTMLElement).dataset['id']).to.equal('child');
});

describe('status-change announcements', () => {
  async function getLiveRegionText(el: LyraTaskList): Promise<string> {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!
      .textContent!;
  }

  it('never announces on first sight (mount)', async () => {
    const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    expect(await getLiveRegionText(el)).to.equal('');
  });

  it('treats reconnect data as a new baseline and does not expose detached status history', async () => {
    const el = document.createElement('lr-task-list') as LyraTaskList;
    el.items = [{ id: 'step', label: 'Fetch data', status: 'pending' }];
    document.body.append(el);
    await el.updateComplete;
    el.remove();

    el.items = [{ id: 'step', label: 'Fetch data', status: 'running' }];
    await el.updateComplete;
    el.items = [{ id: 'step', label: 'Fetch data', status: 'success' }];
    await el.updateComplete;
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(await getLiveRegionText(el)).to.equal('');

      el.items = [{ id: 'step', label: 'Fetch data', status: 'error' }];
      await el.updateComplete;
      expect(await getLiveRegionText(el)).to.equal('Step failed: Fetch data');
    } finally {
      el.remove();
    }
  });

  it('announces a step starting (pending -> running)', async () => {
    const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    el.items = items.map((it) => (it.id === 'step-3' ? { ...it, status: 'running' } : it));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Step started: Write summary');
  });

  it('announces a step completing (running -> success)', async () => {
    const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    el.items = items.map((it) => (it.id === 'step-2' ? { ...it, status: 'success' } : it));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Step completed: Search the web');
  });

  it('announces a step failing (running -> error), assertively', async () => {
    const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    el.items = items.map((it) => (it.id === 'step-2' ? { ...it, status: 'error' } : it));
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region')!;
    expect(region.mode).to.equal('assertive');
    expect(await getLiveRegionText(el)).to.equal('Step failed: Search the web');
  });

  it('announces one-level-deep child status changes too', async () => {
    const withChildren: TaskItem[] = [
      { id: 'parent', label: 'Parent', status: 'running', children: [{ id: 'child', label: 'Child', status: 'pending' }] },
    ];
    const el = (await fixture(html`<lr-task-list .items=${withChildren}></lr-task-list>`)) as LyraTaskList;
    el.items = [
      { id: 'parent', label: 'Parent', status: 'running', children: [{ id: 'child', label: 'Child', status: 'success' }] },
    ];
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Step completed: Child');
  });
});

it('honors a programmatic accessibleLabel binding on the owned task list', async () => {
  const el = await fixture<LyraTaskList>(html`
    <lr-task-list .accessibleLabel=${'Deployment tasks'}></lr-task-list>
  `);
  expect(el.shadowRoot!.querySelector('[role="list"]')!.getAttribute('aria-label')).to.equal('Deployment tasks');
});

it('localizes the default "Tasks" label via .strings while a customized label renders as-is', async () => {
  const localized = (await fixture(
    html`<lr-task-list .strings=${{ taskListLabel: 'Étapes' }}></lr-task-list>`,
  )) as LyraTaskList;
  expect(localized.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Étapes');

  const custom = (await fixture(
    html`<lr-task-list
      label="Plan"
      .strings=${{ taskListLabel: 'Étapes' }}
    ></lr-task-list>`,
  )) as LyraTaskList;
  expect(custom.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Plan');

  const explicitEnglish = (await fixture(
    html`<lr-task-list label="Tasks" .strings=${{ taskListLabel: 'Étapes' }}></lr-task-list>`,
  )) as LyraTaskList;
  expect(explicitEnglish.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Tasks');

  const empty = (await fixture(
    html`<lr-task-list label="" .strings=${{ taskListLabel: 'Étapes' }}></lr-task-list>`,
  )) as LyraTaskList;
  expect(empty.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('');
});

describe('compact / frame escape hatches', () => {
  it('defaults to compact=false, frame="card"', async () => {
    const el = (await fixture(html`<lr-task-list></lr-task-list>`)) as LyraTaskList;
    expect(el.compact).to.be.false;
    expect(el.frame).to.equal('card');
    expect(el.hasAttribute('compact')).to.be.false;
  });

  it('compact tightens header/body padding and body gap via dedicated cssprops, falling back to tuned defaults', async () => {
    const nonCompact = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    const defaultHeaderPadding = getComputedStyle(nonCompact.shadowRoot!.querySelector('[part="header"]')!).padding;
    const defaultBodyPadding = getComputedStyle(nonCompact.shadowRoot!.querySelector('[part="body"]')!).padding;
    const defaultGap = getComputedStyle(nonCompact.shadowRoot!.querySelector('[part="body"]')!).gap;

    const el = (await fixture(html`<lr-task-list .items=${items} compact></lr-task-list>`)) as LyraTaskList;
    expect(el.hasAttribute('compact')).to.be.true;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    // Falls back to the tuned compact defaults, which are tighter than the non-compact padding/gap
    // read above.
    expect(getComputedStyle(header).padding).to.not.equal(defaultHeaderPadding);
    expect(getComputedStyle(body).padding).to.not.equal(defaultBodyPadding);
    expect(getComputedStyle(body).gap).to.not.equal(defaultGap);

    el.style.setProperty('--lr-task-list-compact-header-padding', '1px 2px');
    el.style.setProperty('--lr-task-list-compact-body-padding', '3px 4px 5px');
    el.style.setProperty('--lr-task-list-compact-gap', '6px');
    expect(getComputedStyle(header).padding).to.equal('1px 2px');
    expect(getComputedStyle(body).padding).to.equal('3px 4px 5px');
    expect(getComputedStyle(body).gap).to.equal('6px');
  });

  it('tightens the header gap under compact too, not just its padding, via its own retunable cssprop', async () => {
    const nonCompact = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    const defaultHeaderGap = getComputedStyle(nonCompact.shadowRoot!.querySelector('[part="header"]')!).gap;

    const el = (await fixture(html`<lr-task-list .items=${items} compact></lr-task-list>`)) as LyraTaskList;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    expect(getComputedStyle(header).gap).to.not.equal(defaultHeaderGap);

    el.style.setProperty('--lr-task-list-compact-header-gap', '7px');
    expect(getComputedStyle(header).gap).to.equal('7px');
  });

  it('reduces compact header typography through a dedicated retunable cssprop', async () => {
    const regular = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    const regularHeader = regular.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const compact = (await fixture(html`<lr-task-list compact .items=${items}></lr-task-list>`)) as LyraTaskList;
    const compactHeader = compact.shadowRoot!.querySelector('[part="header"]') as HTMLElement;

    expect(Number.parseFloat(getComputedStyle(compactHeader).fontSize)).to.be.lessThan(
      Number.parseFloat(getComputedStyle(regularHeader).fontSize),
    );

    compact.style.setProperty('--lr-task-list-compact-header-font-size', '11px');
    expect(getComputedStyle(compactHeader).fontSize).to.equal('11px');
  });

  it('frame="plain" removes [part="base"]\'s border and background', async () => {
    const cardEl = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
    const cardBase = cardEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(cardBase).borderTopStyle).to.equal('solid');

    const plainEl = (await fixture(
      html`<lr-task-list .items=${items} frame="plain"></lr-task-list>`,
    )) as LyraTaskList;
    const plainBase = plainEl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(plainBase).borderTopStyle).to.equal('none');
    expect(getComputedStyle(plainBase).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('frame="card" keeps the border and background, and reassigning frame re-renders the chrome', async () => {
    const el = (await fixture(html`<lr-task-list .items=${items} frame="card"></lr-task-list>`)) as LyraTaskList;
    const baseEl = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(baseEl).borderTopStyle).to.equal('solid');
    expect(getComputedStyle(baseEl).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

    el.frame = 'plain';
    await el.updateComplete;
    expect(el.getAttribute('frame')).to.equal('plain');
    expect(getComputedStyle(baseEl).borderTopStyle).to.equal('none');

    el.frame = 'card';
    await el.updateComplete;
    expect(getComputedStyle(baseEl).borderTopStyle).to.equal('solid');
  });

  it('gives the superseded `appearance` attribute no effect at all -- the rename left no alias', async () => {
    const el = (await fixture(
      html`<lr-task-list .items=${items} appearance="plain"></lr-task-list>`,
    )) as LyraTaskList;
    expect(el.frame).to.equal('card');
    const baseEl = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(baseEl).borderTopStyle).to.equal('solid');
    expect(getComputedStyle(baseEl).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });
});

describe('header hover cascade', () => {
  it('applies a consumer ::part(header):hover override under a real pointer', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <style>
          lr-task-list.consumer-hover::part(header):hover { background: rgb(1, 2, 3); }
        </style>
        <lr-task-list class="consumer-hover"></lr-task-list>
      </div>
    `);
    const el = wrapper.querySelector('lr-task-list') as LyraTaskList;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
    const rect = header.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => getComputedStyle(header).backgroundColor === 'rgb(1, 2, 3)');
      expect(getComputedStyle(header).backgroundColor).to.equal('rgb(1, 2, 3)');
    } finally {
      await resetMouse();
    }
  });
});

it('is accessible collapsed, with no items', async () => {
  const el = (await fixture(html`<lr-task-list></lr-task-list>`)) as LyraTaskList;
  await expect(el).to.be.accessible();
});

it('is accessible expanded, with items, children, and detail text', async () => {
  const withChildren: TaskItem[] = [
    ...items,
    {
      id: 'parent',
      label: 'Refactor module',
      status: 'error',
      detail: 'Failed on the last file',
      children: [{ id: 'child-1', label: 'Update imports', status: 'success' }],
    },
  ];
  const el = (await fixture(html`<lr-task-list .items=${withChildren} expanded></lr-task-list>`)) as LyraTaskList;
  await expect(el).to.be.accessible();
});

it('contains unbroken public item labels/details in a 256px allocation', async () => {
  const long = `task-${'identifier'.repeat(180)}`;
  const el = (await fixture(html`
    <div style="inline-size:256px">
      <lr-task-list
        expanded
        .items=${[{ id: 'long', label: long, detail: long, status: 'running' }]}
      ></lr-task-list>
    </div>
  `)).querySelector('lr-task-list') as LyraTaskList;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector<HTMLElement>('[part="item-label"]')!;
  const detail = el.shadowRoot!.querySelector<HTMLElement>('[part="item-detail"]')!;
  expect(Math.ceil(el.getBoundingClientRect().width)).to.be.at.most(256);
  expect(label.scrollWidth).to.be.at.most(Math.ceil(label.getBoundingClientRect().width) + 1);
  expect(detail.scrollWidth).to.be.at.most(Math.ceil(detail.getBoundingClientRect().width) + 1);
});

it('exposes component-scoped status icon colors', async () => {
  const el = (await fixture(html`
    <lr-task-list
      expanded
      style="
        --lr-task-list-running-color: rgb(1, 2, 3);
        --lr-task-list-success-color: rgb(4, 5, 6);
        --lr-task-list-error-color: rgb(7, 8, 9);
      "
      .items=${[
        { id: 'run', label: 'Run', status: 'running' },
        { id: 'ok', label: 'Ok', status: 'success' },
        { id: 'bad', label: 'Bad', status: 'error' },
      ]}
    ></lr-task-list>
  `)) as LyraTaskList;
  const color = (id: string) =>
    getComputedStyle(el.shadowRoot!.querySelector(`[data-id="${id}"] [part="status-icon"]`)!).color;
  expect(color('run')).to.equal('rgb(1, 2, 3)');
  expect(color('ok')).to.equal('rgb(4, 5, 6)');
  expect(color('bad')).to.equal('rgb(7, 8, 9)');
});

it('renders each status label visually hidden, not duplicated as visible text', async () => {
  // The status is conveyed visually by `[part="status-icon"]` and to assistive tech by an
  // `.sr-only` sibling. Without the shared `srOnly` sheet in this shadow root that sibling painted
  // too, so every row showed its status word next to the icon.
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
  await el.updateComplete;

  const marker = el.shadowRoot!.querySelector('.sr-only') as HTMLElement;
  const rect = marker.getBoundingClientRect();
  expect(rect.width, 'sr-only marker width').to.be.at.most(1);
  expect(rect.height, 'sr-only marker height').to.be.at.most(1);
});
