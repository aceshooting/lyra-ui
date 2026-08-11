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
  const el = (await fixture(html`<lr-task-list></lr-task-list>`)) as LyraTaskList;
  expect(el.items).to.deep.equal([]);
  expect(el.label).to.equal('Tasks');
  expect(el.expanded).to.be.true;
  expect(el.hasAttribute('expanded')).to.be.true;
  expect(el.collapsible).to.be.true;
});

it('renders one [part="item"] row per top-level item, carrying data-status/data-id/data-depth', async () => {
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')] as HTMLElement[];
  expect(rows.length).to.equal(3);
  expect(rows[1]!.dataset.status).to.equal('running');
  expect(rows[1]!.dataset.id).to.equal('step-2');
  expect(rows[1]!.dataset.depth).to.equal('0');
});

it('renders each item label and optional detail text', async () => {
  const el = (await fixture(html`<lr-task-list .items=${items}></lr-task-list>`)) as LyraTaskList;
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
  const el = (await fixture(html`<lr-task-list .items=${withChildren}></lr-task-list>`)) as LyraTaskList;
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
    const el = (await fixture(html`<lr-task-list .items=${deep}></lr-task-list>`)) as LyraTaskList;
    expect(el.shadowRoot!.querySelector('[part="item"][data-id="grandchild"]')).to.not.exist;
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
  expect(events[0]!.detail).to.deep.equal({ id: 'step-1', parentId: null, fromIndex: 0, toIndex: 1 });
  expect(el.items.map((item) => item.id)).to.deep.equal(['step-1', 'step-2', 'step-3']);
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

describe('header hover specificity', () => {
  it('wraps the internal button[part="header"]:hover rule in :where() so a consumer ::part(header):hover override can win', async () => {
    // Mirrors lr-attachment-trigger/lr-copy-button's own test for the identical fix -- jsdom/wtr
    // don't synthesize a real :hover pseudo-class from a dispatched event, so this asserts the
    // internal rule's own specificity-lowering wrapper directly via the adopted stylesheet text.
    const el = (await fixture(html`<lr-task-list></lr-task-list>`)) as LyraTaskList;
    const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .find((text) => text.includes(':hover') && text.toLowerCase().includes('part="header"'));
    expect(internalRule).to.contain(':where(');
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
