import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './knowledge-base.js';
import type { KnowledgeBaseSource, KnowledgeSource, LyraKnowledgeBase } from './knowledge-base.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';
import type { LyraMenuItem } from '../../layout/menu/menu-item.class.js';

const row = (id = 'current'): KnowledgeSource => ({ id, name: `Source ${id}`, syncStatus: 'synced' });
function provider(value: KnowledgeSource): KnowledgeBaseSource {
  return { revision: 1, lookup: async () => [], locate: async () => null, query: async () => ({
    total: 1, summary: { total: 1, synced: 1, syncing: 0, attention: 0 },
    rows: [{ key: value.id, order: 0, value }],
  }) };
}
async function table(el: LyraKnowledgeBase, id: string) {
  await waitUntil(() => (el.dataSource === undefined || el.sourceTotal === 1) &&
    el.shadowRoot?.querySelector<LyraTable<KnowledgeSource>>('lr-table')?.rows[0]?.id === id);
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<LyraTable<KnowledgeSource>>('lr-table')!;
  await grid.updateComplete;
  return grid;
}
async function activateSync(dropdown: LyraDropdown) {
  const item = dropdown.querySelector<LyraMenuItem>('lr-menu-item[value="sync"]')!;
  await item.updateComplete;
  expect(item.disabled).to.equal(false);
  item.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
}

describe('knowledge base provider and row menu boundaries', () => {
  for (const invalid of ['non-string type', 'invalid Date'] as const) {
    it(`rejects a provider row with ${invalid} and recovers with a replacement provider`, async () => {
      const value = row();
      if (invalid === 'non-string type') Object.defineProperty(value, 'type', { value: 17, enumerable: true });
      else value.lastSyncedAt = new Date(NaN);
      const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .dataSource=${provider(value)}
        .strings=${{ loading: 'Loading sources', tableLoadFailed: 'Sources unavailable' }}></lr-knowledge-base>`);
      await waitUntil(() => !!el.shadowRoot?.querySelector<LyraTable<KnowledgeSource>>('lr-table')?.error);
      const failed = el.shadowRoot!.querySelector<LyraTable<KnowledgeSource>>('lr-table')!;
      await failed.updateComplete;
      expect(failed.rows.length).to.equal(0);
      expect(el.sourceTotal).to.equal(null);
      expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('Sources unavailable');
      el.dataSource = provider({ ...row('replacement'), lastSyncedAt: new Date('2026-01-15T10:30:00Z') });
      const recovered = await table(el, 'replacement');
      expect(recovered.error).to.equal(false);
      expect(recovered.rows.map(entry => entry.id)).to.deep.equal(['replacement']);
      expect(el.sourceTotal).to.equal(1);
    });
  }

  it('abandons a revision read that replaces its provider before querying obsolete data', async () => {
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base></lr-knowledge-base>`);
    const replacement = provider(row('replacement'));
    const previous = provider(row('previous'));
    let armed = false;
    let oldQueries = 0;
    const query = previous.query;
    previous.query = request => { oldQueries++; return query(request); };
    Object.defineProperty(previous, 'revision', { get() {
      if (armed) { armed = false; el.dataSource = replacement; }
      return 1;
    } });
    el.dataSource = previous;
    await table(el, 'previous');
    expect(oldQueries).to.equal(1);
    armed = true;
    el.requestUpdate();
    const grid = await table(el, 'replacement');
    expect(el.dataSource === replacement).to.equal(true);
    expect(oldQueries).to.equal(1);
    expect(grid.rows.map(entry => entry.id)).to.deep.equal(['replacement']);
  });

  it('removes lazily mounted actions when showing is vetoed and restores current actions on the next open', async () => {
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .sources=${[row()]}></lr-knowledge-base>`);
    const grid = await table(el, 'current');
    const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('lr-dropdown')!;
    const actions: string[] = [];
    el.addEventListener('lr-source-sync', event => actions.push(event.detail.sourceId));
    const veto = (event: Event) => event.preventDefault();
    el.addEventListener('lr-show', veto);
    try {
      await dropdown.show();
      await waitUntil(() => !dropdown.open && dropdown.querySelectorAll('lr-menu-item').length === 0);
      expect(actions).to.deep.equal([]);
    } finally {
      el.removeEventListener('lr-show', veto);
    }
    await dropdown.show();
    expect(dropdown.open).to.equal(true);
    expect(dropdown.querySelectorAll('lr-menu-item').length).to.equal(3);
    await activateSync(dropdown);
    expect(actions).to.deep.equal(['current']);
    await dropdown.hide({ focusTrigger: false });
  });

  it('keeps a closing row menu empty through a host presentation update and reopens with fresh labels', async () => {
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .sources=${[row()]}></lr-knowledge-base>`);
    const grid = await table(el, 'current');
    const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('lr-dropdown')!;
    await dropdown.show();
    expect(dropdown.querySelectorAll('lr-menu-item').length).to.equal(3);
    dropdown.open = false;
    el.strings = { knowledgeBaseSyncAction: 'Synchronize source' };
    await el.updateComplete;
    await dropdown.updateComplete;
    await waitUntil(() => dropdown.querySelectorAll('lr-menu-item').length === 0);
    expect(dropdown.open).to.equal(false);
    await dropdown.show();
    expect(dropdown.querySelector('lr-menu-item[value="sync"]')!.textContent).to.include('Synchronize source');
    const actions: string[] = [];
    el.addEventListener('lr-source-sync', event => actions.push(event.detail.sourceId));
    await activateSync(dropdown);
    expect(actions).to.deep.equal(['current']);
    await dropdown.hide({ focusTrigger: false });
  });
});
