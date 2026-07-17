import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './task-list.js';
import type { LyraTaskList, TaskItem } from './task-list.js';

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

it('defaults to items=[], label="Tasks", expanded=true, collapsible=true', async () => {
  const el = (await fixture(html`<lyra-task-list></lyra-task-list>`)) as LyraTaskList;
  expect(el.items).to.deep.equal([]);
  expect(el.label).to.equal('Tasks');
  expect(el.expanded).to.be.true;
  expect(el.hasAttribute('expanded')).to.be.true;
  expect(el.collapsible).to.be.true;
});

it('renders one [part="item"] row per top-level item, carrying data-status/data-id/data-depth', async () => {
  const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(rows.length).to.equal(3);
  expect(rows[1]!.dataset.status).to.equal('running');
  expect(rows[1]!.dataset.id).to.equal('step-2');
  expect(rows[1]!.dataset.depth).to.equal('0');
});

it('renders each item label and optional detail text', async () => {
  const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(rows[1]!.querySelector('[part="item-label"]')!.textContent!.trim()).to.equal('Search the web');
  expect(rows[1]!.querySelector('[part="item-detail"]')!.textContent!.trim()).to.equal(
    'Searching for recent changelog entries',
  );
  expect(rows[0]!.querySelector('[part="item-detail"]')).to.not.exist;
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
  const el = (await fixture(html`<lyra-task-list .items=${withChildren}></lyra-task-list>`)) as LyraTaskList;
  const parentRow = el.shadowRoot!.querySelector('[part="item"][data-id="parent"]') as HTMLElement;
  const childWrapper = parentRow.querySelector('[part="item-children"]') as HTMLElement;
  expect(childWrapper.getAttribute('role')).to.equal('list');
  const childRows = [...childWrapper.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(childRows.length).to.equal(2);
  expect(childRows[0]!.dataset.depth).to.equal('1');
  expect(childRows[0]!.dataset.id).to.equal('child-1');
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
    const el = (await fixture(html`<lyra-task-list .items=${deep}></lyra-task-list>`)) as LyraTaskList;
    expect(el.shadowRoot!.querySelector('[part="item"][data-id="grandchild"]')).to.not.exist;
    expect(calls.some((args) => String(args[0]).includes('grandchild'))).to.be.true;
  } finally {
    console.warn = originalWarn;
  }
});

it('shows a visible completed-of-total summary counting only top-level success items', async () => {
  const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('1 of 3 completed');
});

it('toggles expanded and fires lyra-toggle on header click when collapsible', async () => {
  const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  expect(header.tagName).to.equal('BUTTON');

  let firing = oneEvent(el, 'lyra-toggle');
  header.click();
  let event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.false;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: false });
  expect(header.getAttribute('aria-expanded')).to.equal('false');
  expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hidden).to.be.true;

  firing = oneEvent(el, 'lyra-toggle');
  header.click();
  event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.true;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: true });
});

it('renders a static, non-interactive heading (no button, no toggle) when collapsible=false', async () => {
  const el = (await fixture(
    html`<lyra-task-list .items=${items} .collapsible=${false}></lyra-task-list>`,
  )) as LyraTaskList;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.tagName).to.not.equal('BUTTON');
  expect(header.hasAttribute('aria-expanded')).to.be.false;
});

it('accepts collapsible="false" as a plain-HTML attribute string', async () => {
  const el = (await fixture(html`<lyra-task-list collapsible="false"></lyra-task-list>`)) as LyraTaskList;
  expect(el.collapsible).to.be.false;
});

it('accepts expanded="false" as a plain-HTML attribute string', async () => {
  const el = (await fixture(html`<lyra-task-list expanded="false"></lyra-task-list>`)) as LyraTaskList;
  expect(el.expanded).to.be.false;
});

it('renders a dynamic detail-<id> slot per item for rich detail content', async () => {
  const el = (await fixture(html`
    <lyra-task-list .items=${items}>
      <span slot="detail-step-2">extra chip content</span>
    </lyra-task-list>
  `)) as LyraTaskList;
  const row = el.shadowRoot!.querySelector('[part="item"][data-id="step-2"]') as HTMLElement;
  const slot = row.querySelector('slot[name="detail-step-2"]') as HTMLSlotElement;
  expect(slot.assignedElements()[0]!.textContent).to.equal('extra chip content');
});

it('shows a shape-distinct status icon plus visually-hidden status text per item', async () => {
  const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="status-icon"]')).to.exist;
  expect(rows[0]!.querySelector('.sr-only')!.textContent!.trim()).to.equal('Success');
  expect(rows[1]!.querySelector('.sr-only')!.textContent!.trim()).to.equal('Running');
});

describe('status-change announcements', () => {
  async function getLiveRegionText(el: LyraTaskList): Promise<string> {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return el.shadowRoot!.querySelector('lyra-live-region')!.shadowRoot!.querySelector('[part="region"]')!
      .textContent!;
  }

  it('never announces on first sight (mount)', async () => {
    const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
    expect(await getLiveRegionText(el)).to.equal('');
  });

  it('announces a step starting (pending -> running)', async () => {
    const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
    el.items = items.map((it) => (it.id === 'step-3' ? { ...it, status: 'running' } : it));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Step started: Write summary');
  });

  it('announces a step completing (running -> success)', async () => {
    const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
    el.items = items.map((it) => (it.id === 'step-2' ? { ...it, status: 'success' } : it));
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Step completed: Search the web');
  });

  it('announces a step failing (running -> error), assertively', async () => {
    const el = (await fixture(html`<lyra-task-list .items=${items}></lyra-task-list>`)) as LyraTaskList;
    el.items = items.map((it) => (it.id === 'step-2' ? { ...it, status: 'error' } : it));
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lyra-live-region')!;
    expect(region.mode).to.equal('assertive');
    expect(await getLiveRegionText(el)).to.equal('Step failed: Search the web');
  });

  it('announces one-level-deep child status changes too', async () => {
    const withChildren: TaskItem[] = [
      { id: 'parent', label: 'Parent', status: 'running', children: [{ id: 'child', label: 'Child', status: 'pending' }] },
    ];
    const el = (await fixture(html`<lyra-task-list .items=${withChildren}></lyra-task-list>`)) as LyraTaskList;
    el.items = [
      { id: 'parent', label: 'Parent', status: 'running', children: [{ id: 'child', label: 'Child', status: 'success' }] },
    ];
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Step completed: Child');
  });
});

it('localizes the default "Tasks" label via .strings while a customized label renders as-is', async () => {
  const localized = (await fixture(
    html`<lyra-task-list .strings=${{ taskListLabel: 'Étapes' }}></lyra-task-list>`,
  )) as LyraTaskList;
  expect(localized.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Étapes');

  const custom = (await fixture(
    html`<lyra-task-list
      label="Plan"
      .strings=${{ taskListLabel: 'Étapes' }}
    ></lyra-task-list>`,
  )) as LyraTaskList;
  expect(custom.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Plan');
});

it('is accessible collapsed, with no items', async () => {
  const el = (await fixture(html`<lyra-task-list></lyra-task-list>`)) as LyraTaskList;
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
  const el = (await fixture(html`<lyra-task-list .items=${withChildren} expanded></lyra-task-list>`)) as LyraTaskList;
  await expect(el).to.be.accessible();
});
