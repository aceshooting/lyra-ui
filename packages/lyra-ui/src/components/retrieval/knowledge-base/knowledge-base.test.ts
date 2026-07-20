import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './knowledge-base.js';
import type { LyraKnowledgeBase, KnowledgeSource } from './knowledge-base.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraMenu } from '../../layout/menu/menu.class.js';
import type { LyraMenuItem } from '../../layout/menu/menu-item.class.js';
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
  return [...tableEl(el).shadowRoot!.querySelectorAll(`[part="cell"] [part="${part}"]`)] as HTMLElement[];
}

function menuFor(el: LyraKnowledgeBase, rowIndex: number): LyraMenu {
  return [...tableEl(el).shadowRoot!.querySelectorAll('lr-menu')][rowIndex] as LyraMenu;
}

function menuItems(menu: LyraMenu): LyraMenuItem[] {
  return [...menu.querySelectorAll('lr-menu-item')] as LyraMenuItem[];
}

function activate(item: LyraMenuItem): void {
  item.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
}

describe('lr-knowledge-base', () => {
  it('defaults to hideSummary=false, hideCreate=false, and an empty sources list', async () => {
    const el = (await fixture(html`<lr-knowledge-base></lr-knowledge-base>`)) as LyraKnowledgeBase;
    expect(el.sources).to.deep.equal([]);
    expect(el.hideSummary).to.be.false;
    expect(el.hideCreate).to.be.false;
  });

  it('renders the default localized heading, and `label` overrides it', async () => {
    const el = (await fixture(html`<lr-knowledge-base></lr-knowledge-base>`)) as LyraKnowledgeBase;
    expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Knowledge base');

    el.label = 'Research library';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Research library');
    expect(tableEl(el).getAttribute('aria-label')).to.equal('Research library');
  });

  it('a host aria-label wins over label/localized default for the table accessible name, without changing the visible heading text', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base aria-label="Team A sources" label="Research library"></lr-knowledge-base>`,
    )) as LyraKnowledgeBase;
    expect(tableEl(el).getAttribute('aria-label')).to.equal('Team A sources');
    expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Research library');
  });

  it('renders one table row per source with the source name and type', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const names = rowCells(el, 'source-name').map((n) => n.textContent!.trim());
    expect(names).to.deep.equal(['Product Drive', 'Support Notion', 'Broken Feed']);
    const types = rowCells(el, 'source-type').map((n) => n.textContent!.trim());
    expect(types).to.deep.equal(['drive', 'notion']);
  });

  it('renders sync-status badges with the matching variant and label per status', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const badges = rowCells(el, 'sync-badge');
    expect(badges.map((b) => b.textContent!.trim())).to.deep.equal(['Synced', 'Syncing', 'Error']);
    expect(badges.map((b) => b.getAttribute('variant'))).to.deep.equal(['success', 'brand', 'danger']);
  });

  it('formats lastSyncedAt and falls back to "Never synced" when unset', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const timestamps = rowCells(el, 'sync-timestamp').map((n) => n.textContent!.trim());
    expect(timestamps[0]).to.not.equal('');
    expect(timestamps[0]).to.not.equal('Never synced');
    expect(timestamps[1]).to.equal('Never synced');
  });

  it('shows the sync-error text only for an error-status row with errorMessage set', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const errors = rowCells(el, 'sync-error');
    expect(errors.length).to.equal(1);
    expect(errors[0]!.textContent!.trim()).to.equal('Connector token expired');
  });

  it('renders indexing-health badges and the formatted document count, omitted when unset', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const healthBadges = rowCells(el, 'health-badge');
    expect(healthBadges.map((b) => b.textContent!.trim())).to.deep.equal(['Healthy', 'Degraded', 'Failed']);
    const counts = rowCells(el, 'document-count').map((n) => n.textContent!.trim());
    expect(counts).to.deep.equal(['128 indexed', '42 indexed']);
  });

  it('renders a permission badge only when permission is set', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const permissionBadges = rowCells(el, 'permission-badge');
    expect(permissionBadges.map((b) => b.textContent!.trim())).to.deep.equal(['Owner', 'Editor']);
  });

  it('clicking "Add source" emits lr-kb-create with no detail; hide-create removes the button', async () => {
    const el = (await fixture(html`<lr-knowledge-base></lr-knowledge-base>`)) as LyraKnowledgeBase;
    const button = el.shadowRoot!.querySelector('[part="create-button"]') as HTMLElement;
    expect(button).to.exist;
    const listener = oneEvent(el, 'lr-kb-create');
    button.click();
    const event = (await listener) as CustomEvent<undefined>;
    // CustomEventInit's `detail` member defaults to `null` when omitted/undefined -- WebIDL
    // dictionary conversion substitutes the default for an explicitly-`undefined` value too, so
    // this.emit('lr-kb-create') (no 2nd argument) still reads back as `null`, not `undefined`.
    expect(event.detail).to.equal(null);

    el.hideCreate = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="create-button"]')).to.not.exist;
  });

  it('renders the aggregate summary with correct counts, and omits it via hideSummary or an empty sources list', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const stats = [...el.shadowRoot!.querySelectorAll('[part="summary-stat"]')] as LyraStat[];
    // total=3, synced=1 (s1), syncing=1 (s2), needs-attention=2 (s2 via degraded health, s3 via
    // error status).
    expect(stats.map((s) => s.value)).to.deep.equal(['3', '1', '1', '2']);

    el.hideSummary = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="summary"]')).to.not.exist;

    el.hideSummary = false;
    el.sources = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="summary"]')).to.not.exist;
  });

  it('activating "Sync now" on a row emits lr-kb-sync with that row\'s sourceId', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 2);
    const items = menuItems(menu);
    const listener = oneEvent(el, 'lr-kb-sync');
    activate(items.find((i) => i.value === 'sync')!);
    const event = (await listener) as CustomEvent<{ sourceId: string }>;
    expect(event.detail).to.deep.equal({ sourceId: 's3' });
  });

  it('activating "Pause sync" emits lr-kb-pause with that row\'s sourceId', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 1);
    const items = menuItems(menu);
    const listener = oneEvent(el, 'lr-kb-pause');
    activate(items.find((i) => i.value === 'pause')!);
    const event = (await listener) as CustomEvent<{ sourceId: string }>;
    expect(event.detail).to.deep.equal({ sourceId: 's2' });
  });

  it('activating "Delete source" emits lr-kb-delete with that row\'s sourceId', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 0);
    const items = menuItems(menu);
    const listener = oneEvent(el, 'lr-kb-delete');
    activate(items.find((i) => i.value === 'delete')!);
    const event = (await listener) as CustomEvent<{ sourceId: string }>;
    expect(event.detail).to.deep.equal({ sourceId: 's1' });
  });

  it('disables "Sync now" only while syncing, and "Pause sync" only while syncing', async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;

    const syncedRowItems = menuItems(menuFor(el, 0)); // syncStatus: 'synced'
    expect(syncedRowItems.find((i) => i.value === 'sync')!.disabled).to.be.false;
    expect(syncedRowItems.find((i) => i.value === 'pause')!.disabled).to.be.true;

    const syncingRowItems = menuItems(menuFor(el, 1)); // syncStatus: 'syncing'
    expect(syncingRowItems.find((i) => i.value === 'sync')!.disabled).to.be.true;
    expect(syncingRowItems.find((i) => i.value === 'pause')!.disabled).to.be.false;

    const errorRowItems = menuItems(menuFor(el, 2)); // syncStatus: 'error' -- re-sync must stay available
    expect(errorRowItems.find((i) => i.value === 'sync')!.disabled).to.be.false;
  });

  it("does not leak the internal lr-table lr-row-click event through the host", async () => {
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    let leaked = false;
    el.addEventListener('lr-row-click', () => (leaked = true));
    const nameCell = rowCells(el, 'source-name')[0]!;
    nameCell.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(leaked).to.be.false;
  });

  it('renders within a 320px allocation without the host overflowing it', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`, {
      parentNode: container,
    })) as LyraKnowledgeBase;
    await el.updateComplete;
    expect((el as unknown as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
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
    const listener = oneEvent(el, 'lr-kb-delete');
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
    const el = (await fixture(html`<lr-knowledge-base .sources=${sources}></lr-knowledge-base>`)) as LyraKnowledgeBase;
    await el.updateComplete;
    const menu = menuFor(el, 0);
    const trigger = tableEl(el).shadowRoot!.querySelectorAll('[part="actions-trigger"]')[0] as HTMLButtonElement;
    trigger.click();
    await menu.updateComplete;
    expect(menu.open).to.be.true;
    await expect(el).to.be.accessible();
  });

  it('.strings overrides reach the rendered heading and create-button text', async () => {
    const el = (await fixture(
      html`<lr-knowledge-base
        .strings=${{ knowledgeBaseHeading: 'Base de connaissances', knowledgeBaseCreateSource: 'Ajouter une source' }}
      ></lr-knowledge-base>`,
    )) as LyraKnowledgeBase;
    expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Base de connaissances');
    expect(el.shadowRoot!.querySelector('[part="create-button"]')!.textContent!.trim()).to.equal('Ajouter une source');
  });
});
