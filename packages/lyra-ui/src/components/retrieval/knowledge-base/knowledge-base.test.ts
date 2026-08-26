import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './knowledge-base.js';
import type { LyraKnowledgeBase, KnowledgeSource } from './knowledge-base.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraMenu } from '../../layout/menu/menu.class.js';
import type { LyraMenuItem } from '../../layout/menu/menu-item.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';
import type { LyraStat } from '../../data/stat/stat.class.js';

const sources: KnowledgeSource[] = [
  {
    id: 's1',
    name: 'Product Drive',
    type: 'drive',
    syncStatus: 'synced',
    indexingHealth: 'healthy',
    permission: 'owner',
    documentCount: 128,
    lastSyncedAt: new Date('2026-01-15T10:30:00Z'),
  },
  {
    id: 's2',
    name: 'Support Notion',
    type: 'notion',
    syncStatus: 'syncing',
    indexingHealth: 'degraded',
    permission: 'editor',
    documentCount: 42,
  },
  {
    id: 's3',
    name: 'Broken Feed',
    syncStatus: 'error',
    indexingHealth: 'failed',
    errorMessage: 'Connector token expired',
  },
];

function tableEl(el: LyraKnowledgeBase): LyraTable<KnowledgeSource> {
  return el.shadowRoot!.querySelector('lr-table') as LyraTable<KnowledgeSource>;
}

function rowCells(el: LyraKnowledgeBase, part: string): HTMLElement[] {
  return [
    ...tableEl(el).shadowRoot!.querySelectorAll(
      `[part="cell"] [part="${part}"]`
    ),
  ] as HTMLElement[];
}

function menuFor(el: LyraKnowledgeBase, rowIndex: number): LyraMenu {
  return [...tableEl(el).shadowRoot!.querySelectorAll('lr-menu')][
    rowIndex
  ] as LyraMenu;
}

function dropdownFor(el: LyraKnowledgeBase, rowIndex: number): LyraDropdown {
  return [...tableEl(el).shadowRoot!.querySelectorAll('lr-dropdown')][
    rowIndex
  ] as LyraDropdown;
}

function menuItems(menu: LyraMenu): LyraMenuItem[] {
  return [...menu.querySelectorAll('lr-menu-item')] as LyraMenuItem[];
}

function activate(item: LyraMenuItem): void {
  item
    .shadowRoot!.querySelector('[part="base"]')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
}

describe('lr-knowledge-base', () => {
  it('defaults to hideSummary=false, hideCreate=false, and an empty sources list', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    expect(el.sources).to.deep.equal([]);
    expect(el.hideSummary).to.be.false;
    expect(el.hideCreate).to.be.false;
  });

  it('keeps an explicitly empty label distinct from an omitted one', async () => {
    const omitted = (await fixture(
      html`<lr-knowledge-base></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    expect(omitted.label).to.be.undefined;
    expect(
      omitted.shadowRoot!.querySelector('[part="heading"]')!.textContent
    ).to.equal('Knowledge base');

    const explicitEmpty = (await fixture(
      html`<lr-knowledge-base label=""></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    expect(explicitEmpty.label).to.equal('');
    expect(
      explicitEmpty.shadowRoot!.querySelector('[part="heading"]')!.textContent
    ).to.equal('');
  });

  it('renders the default localized heading, and `label` overrides it', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    expect(
      el.shadowRoot!.querySelector('[part="heading"]')!.textContent
    ).to.equal('Knowledge base');

    el.label = 'Research library';
    await el.updateComplete;
    await tableEl(el).updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="heading"]')!.textContent
    ).to.equal('Research library');
    expect(tableEl(el).getAttribute('aria-label')).to.equal(null);
    expect(tableEl(el).accessibleLabel).to.equal('Research library');
  });

  it('keeps a host name distinct from the table name and visible heading', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base
        aria-label="Team A sources"
        label="Research library"
      ></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    const table = tableEl(el);
    await table.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Team A sources');
    expect(table.getAttribute('aria-label')).to.equal(null);
    expect(table.accessibleLabel).to.equal('Research library');
    expect(
      el.shadowRoot!.querySelector('[part="heading"]')!.textContent
    ).to.equal('Research library');
  });

  it('keeps explicit-empty and dynamic host naming distinct from the nested grid', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base
        aria-label="Team A sources"
        label="Research library"
        .sources=${[sources[0]!]}
      ></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    const table = tableEl(el);
    await table.updateComplete;
    const grid =
      table.shadowRoot!.querySelector<HTMLElement>('[part="table"]')!;
    expect(el.getAttribute('aria-label')).to.equal('Team A sources');
    expect(table.getAttribute('aria-label')).to.equal(null);
    expect(table.accessibleLabel).to.equal('Research library');
    expect(grid.getAttribute('aria-label')).to.equal('Research library');

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    await table.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('');
    expect(table.getAttribute('aria-label')).to.equal(null);
    expect(grid.getAttribute('aria-label')).to.equal('Research library');

    el.setAttribute('aria-label', 'Revised sources');
    await el.updateComplete;
    await table.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Revised sources');
    expect(table.getAttribute('aria-label')).to.equal(null);
    expect(grid.getAttribute('aria-label')).to.equal('Research library');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    await table.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal(null);
    expect(table.getAttribute('aria-label')).to.equal(null);
    expect(grid.getAttribute('aria-label')).to.equal('Research library');
  });

  it('renders one table row per source with the source name and type', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const names = rowCells(el, 'source-name').map((n) => n.textContent!.trim());
    expect(names).to.deep.equal([
      'Product Drive',
      'Support Notion',
      'Broken Feed',
    ]);
    const types = rowCells(el, 'source-type').map((n) => n.textContent!.trim());
    expect(types).to.deep.equal(['drive', 'notion']);
  });

  it('uses the localized untitled fallback for a missing source name and its row actions', async () => {
    const el = await fixture<LyraKnowledgeBase>(html`
      <lr-knowledge-base
        .sources=${[
          {
            id: 'nameless',
            syncStatus: 'idle',
          },
        ] as unknown as KnowledgeSource[]}
        .strings=${{ untitledSource: 'Unnamed connector' }}
      ></lr-knowledge-base>
    `);

    expect(rowCells(el, 'source-name')[0]?.textContent?.trim()).to.equal(
      'Unnamed connector'
    );
    const trigger = tableEl(el).shadowRoot!.querySelector(
      '[part="actions-trigger"]'
    ) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).to.contain('Unnamed connector');
    await expect(el).shadowDom.to.be.accessible();
  });

  it('renders sync-status badges with the matching variant and label per status', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const badges = rowCells(el, 'sync-badge');
    expect(badges.map((b) => b.textContent!.trim())).to.deep.equal([
      'Synced',
      'Syncing',
      'Error',
    ]);
    expect(badges.map((b) => b.getAttribute('variant'))).to.deep.equal([
      'success',
      'brand',
      'danger',
    ]);
  });

  it('formats lastSyncedAt and falls back to "Never synced" when unset', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const timestamps = rowCells(el, 'sync-timestamp').map((n) =>
      n.textContent!.trim()
    );
    expect(timestamps[0]).to.not.equal('');
    expect(timestamps[0]).to.not.equal('Never synced');
    expect(timestamps[1]).to.equal('Never synced');
  });

  it('shows the sync-error text only for an error-status row with errorMessage set', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const errors = rowCells(el, 'sync-error');
    expect(errors.length).to.equal(1);
    expect(errors[0]!.textContent!.trim()).to.equal('Connector token expired');
  });

  it('renders indexing-health badges and the formatted document count, omitted when unset', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const healthBadges = rowCells(el, 'health-badge');
    expect(healthBadges.map((b) => b.textContent!.trim())).to.deep.equal([
      'Healthy',
      'Degraded',
      'Failed',
    ]);
    const counts = rowCells(el, 'document-count').map((n) =>
      n.textContent!.trim()
    );
    expect(counts).to.deep.equal(['128 indexed', '42 indexed']);
  });

  it('renders a permission badge only when permission is set', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const permissionBadges = rowCells(el, 'permission-badge');
    expect(permissionBadges.map((b) => b.textContent!.trim())).to.deep.equal([
      'Owner',
      'Editor',
    ]);
  });

  it('clicking "Add source" emits lr-source-create with no detail; hide-create removes the button', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    const button = el.shadowRoot!.querySelector(
      '[part="create-button"]'
    ) as HTMLElement;
    expect(button != null).to.equal(true);
    const listener = oneEvent(el, 'lr-source-create');
    button.click();
    const event = (await listener) as CustomEvent<null>;
    // CustomEventInit's `detail` member defaults to `null` when omitted/undefined -- WebIDL
    // dictionary conversion substitutes the default for an explicitly-`undefined` value too, so
    // this.emit('lr-source-create') (no 2nd argument) still reads back as `null`, not `undefined`.
    expect(event.detail).to.equal(null);

    el.hideCreate = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="create-button"]') == null).to.be
      .true;
  });

  it('renders the aggregate summary with correct counts, and omits it via hideSummary or an empty sources list', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const stats = [
      ...el.shadowRoot!.querySelectorAll('[part="summary-stat"]'),
    ] as LyraStat[];
    // total=3, synced=1 (s1), syncing=1 (s2), needs-attention=2 (s2 via degraded health, s3 via
    // error status).
    expect(stats.map((s) => s.value)).to.deep.equal(['3', '1', '1', '2']);

    el.hideSummary = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="summary"]') == null).to.be.true;

    el.hideSummary = false;
    el.sources = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="summary"]') == null).to.be.true;
  });

  it('activating "Sync now" on a row emits lr-source-sync with that row\'s sourceId', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 2);
    const items = menuItems(menu);
    const listener = oneEvent(el, 'lr-source-sync');
    activate(items.find((i) => i.value === 'sync')!);
    const event = (await listener) as CustomEvent<{ sourceId: string }>;
    expect(event.detail).to.deep.equal({ sourceId: 's3' });
  });

  it('activating "Pause sync" emits lr-source-pause with that row\'s sourceId', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 1);
    const items = menuItems(menu);
    const listener = oneEvent(el, 'lr-source-pause');
    activate(items.find((i) => i.value === 'pause')!);
    const event = (await listener) as CustomEvent<{ sourceId: string }>;
    expect(event.detail).to.deep.equal({ sourceId: 's2' });
  });

  it('activating "Delete source" emits lr-source-delete with that row\'s sourceId', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 0);
    const items = menuItems(menu);
    const listener = oneEvent(el, 'lr-source-delete');
    activate(items.find((i) => i.value === 'delete')!);
    const event = (await listener) as CustomEvent<{ sourceId: string }>;
    expect(event.detail).to.deep.equal({ sourceId: 's1' });
  });

  it('disables "Sync now" only while syncing, and "Pause sync" only while syncing', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;

    const syncedRowItems = menuItems(menuFor(el, 0)); // syncStatus: 'synced'
    expect(syncedRowItems.find((i) => i.value === 'sync')!.disabled).to.be
      .false;
    expect(syncedRowItems.find((i) => i.value === 'pause')!.disabled).to.be
      .true;

    const syncingRowItems = menuItems(menuFor(el, 1)); // syncStatus: 'syncing'
    expect(syncingRowItems.find((i) => i.value === 'sync')!.disabled).to.be
      .true;
    expect(syncingRowItems.find((i) => i.value === 'pause')!.disabled).to.be
      .false;

    const errorRowItems = menuItems(menuFor(el, 2)); // syncStatus: 'error' -- re-sync must stay available
    expect(errorRowItems.find((i) => i.value === 'sync')!.disabled).to.be.false;
  });

  it('does not leak the internal lr-table lr-row-click event through the host', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    let leaked = false;
    el.addEventListener('lr-row-click', () => (leaked = true));
    const nameCell = rowCells(el, 'source-name')[0]!;
    nameCell.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(leaked).to.be.false;
  });

  it('renders within a 320px allocation without the host overflowing it', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`,
      {
        parentNode: container,
      }
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    expect(
      (el as unknown as HTMLElement).getBoundingClientRect().width
    ).to.be.at.most(320);
  });

  it('renders and functions correctly under dir="rtl"', async () => {
    const el = document.createElement('lr-knowledge-base') as LyraKnowledgeBase;
    el.setAttribute('dir', 'rtl');
    el.sources = sources;
    document.body.append(el);
    await el.updateComplete;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="heading"]')).to.exist;
    const menu = menuFor(el, 0);
    await menu.updateComplete;
    const listener = oneEvent(el, 'lr-source-delete');
    activate(menuItems(menu).find((i) => i.value === 'delete')!);
    const event = (await listener) as CustomEvent<{ sourceId: string }>;
    expect(event.detail).to.deep.equal({ sourceId: 's1' });
    el.remove();
  });

  it('is accessible (empty default state)', async () => {
    const el = await fixture(html`<lr-knowledge-base></lr-knowledge-base>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible with populated sources and an open row action menu', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 0);
    const dropdown = dropdownFor(el, 0);
    const trigger = tableEl(el).shadowRoot!.querySelectorAll(
      '[part="actions-trigger"]'
    )[0] as HTMLButtonElement;
    trigger.click();
    await menu.updateComplete;
    expect(dropdown.open).to.be.true;
    await expect(el).to.be.accessible();
  });

  it('.strings overrides reach the rendered heading and create-button text', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base
        .strings=${{
          knowledgeBaseHeading: 'Base de connaissances',
          knowledgeBaseCreateSource: 'Ajouter une source',
        }}
      ></lr-knowledge-base>`
    )) as LyraKnowledgeBase;
    expect(
      el.shadowRoot!.querySelector('[part="heading"]')!.textContent
    ).to.equal('Base de connaissances');
    expect(
      el
        .shadowRoot!.querySelector('[part="create-button"]')!
        .textContent!.trim()
    ).to.equal('Ajouter une source');
  });
});

it('formats document and summary counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-knowledge-base lang="ar-u-nu-arab"></lr-knowledge-base>`
  )) as LyraKnowledgeBase;
  el.sources = [{ ...sources[0]!, documentCount: 1234 }];
  await el.updateComplete;
  expect(rowCells(el, 'document-count')[0]!.textContent).to.include('١٬٢٣٤');
  const summary = [
    ...el.shadowRoot!.querySelectorAll('[part="summary-stat"]'),
  ] as LyraStat[];
  expect(summary.map((stat) => stat.value)).to.deep.equal(['١', '١', '٠', '٠']);
});

it('suppresses the canonical child menu selection after translating it', async () => {
  const el = (await fixture(
    html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`
  )) as LyraKnowledgeBase;
  let leaked = 0;
  el.addEventListener('lr-select', () => leaked++);
  const sourceEvent = oneEvent(el, 'lr-source-sync');
  activate(menuItems(menuFor(el, 0)).find((item) => item.value === 'sync')!);
  await sourceEvent;
  expect(leaked).to.equal(0);
});

it('omits blank and later duplicate source ids before summary, table rows, and actions', async () => {
  const first = sources[0]!;
  const el = (await fixture(
    html`<lr-knowledge-base
      .sources=${[
        { ...first, id: '' },
        first,
        { ...first, name: 'Later duplicate', syncStatus: 'error' as const },
        { ...first, id: ' ' },
      ]}
    ></lr-knowledge-base>`
  )) as LyraKnowledgeBase;
  await tableEl(el).updateComplete;

  expect(tableEl(el).rows).to.deep.equal([first]);
  expect(
    rowCells(el, 'source-name').map((cell) => cell.textContent)
  ).to.deep.equal([first.name]);
  const summary = [
    ...el.shadowRoot!.querySelectorAll('[part="summary-stat"]'),
  ] as LyraStat[];
  expect(summary.map((stat) => stat.value)).to.deep.equal(['1', '1', '0', '0']);

  const selected = oneEvent(el, 'lr-source-sync');
  activate(menuItems(menuFor(el, 0)).find((entry) => entry.value === 'sync')!);
  expect((await selected).detail).to.deep.equal({ sourceId: first.id });
});

it('renders every remaining status vocabulary and safely normalizes timestamps and collections', async () => {
  const variants: KnowledgeSource[] = [
    {
      id: 'idle',
      name: 'Idle source',
      syncStatus: 'idle',
      permission: 'viewer',
      lastSyncedAt: '2026-02-03T04:05:00Z',
    },
    {
      id: 'paused',
      name: 'Paused source',
      syncStatus: 'paused',
      indexingHealth: 'unknown',
      permission: 'restricted',
      lastSyncedAt: 'not-a-date',
    },
  ];
  const el = (await fixture(html`
    <lr-knowledge-base .sources=${variants}></lr-knowledge-base>
  `)) as LyraKnowledgeBase;
  await tableEl(el).updateComplete;

  expect(
    rowCells(el, 'sync-badge').map((badge) => badge.textContent!.trim())
  ).to.deep.equal(['Idle', 'Paused']);
  expect(
    rowCells(el, 'health-badge').map((badge) => badge.textContent!.trim())
  ).to.deep.equal(['Unknown', 'Unknown']);
  expect(
    rowCells(el, 'permission-badge').map((badge) => badge.textContent!.trim())
  ).to.deep.equal(['Viewer', 'Restricted']);
  expect(
    rowCells(el, 'sync-timestamp').map((timestamp) =>
      timestamp.textContent!.trim()
    )
  ).to.satisfy(
    (timestamps: string[]) =>
      timestamps[0] !== 'Never synced' && timestamps[1] === 'Never synced'
  );

  el.sources = null as unknown as readonly KnowledgeSource[];
  await el.updateComplete;
  expect(tableEl(el).rows).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="summary"]') === null).to.equal(
    true
  );
});
