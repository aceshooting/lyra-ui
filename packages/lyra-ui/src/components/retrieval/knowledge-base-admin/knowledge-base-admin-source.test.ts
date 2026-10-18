import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './knowledge-base-admin.js';
import type { LyraKnowledgeBaseAdmin } from './knowledge-base-admin.class.js';
import type { KnowledgeBaseSource, LyraKnowledgeBase } from '../knowledge-base/knowledge-base.class.js';
import type { IngestionQueueSource, LyraIngestionQueue } from '../ingestion-queue/ingestion-queue.class.js';

function knowledge() {
  const pages: number[] = [];
  const source: KnowledgeBaseSource = { revision: 1, lookup: async () => [], locate: async () => null, query: async ({ page, pageSize }) => {
    pages.push(page); return { total: 201, summary: { total: 201, synced: 201, syncing: 0, attention: 0 }, rows: Array.from({ length: Math.min(pageSize, Math.max(0, 201 - page * pageSize)) }, (_, i) => { const index = page * pageSize + i; return { key: `s${index}`, order: index, value: { id: `s${index}`, name: `Source ${index}`, syncStatus: 'synced' as const } }; }) };
  } };
  return { source, pages };
}
function ingestion() {
  const pages: number[] = [];
  const source: IngestionQueueSource = { revision: 1, lookup: async () => [], locate: async () => null, query: async ({ page, pageSize }) => {
    pages.push(page); return { total: 201, rows: Array.from({ length: Math.min(pageSize, Math.max(0, 201 - page * pageSize)) }, (_, i) => { const index = page * pageSize + i; return { key: `i${index}`, order: index, value: { id: `i${index}`, document: { id: `d${index}`, name: `Document ${index}` }, stage: 'failed' as const, attempts: 2 } }; }) };
  } };
  return { source, pages };
}
async function inventory(host: LyraKnowledgeBaseAdmin) {
  await waitUntil(() => host.shadowRoot?.querySelector<LyraKnowledgeBase>('lr-knowledge-base')?.sourceTotal === 201);
  const child = host.shadowRoot!.querySelector<LyraKnowledgeBase>('lr-knowledge-base')!; await child.updateComplete; return child;
}
async function queue(host: LyraKnowledgeBaseAdmin) {
  await waitUntil(() => host.shadowRoot?.querySelector<LyraIngestionQueue>('lr-ingestion-queue')?.sourceTotal === 201);
  const child = host.shadowRoot!.querySelector<LyraIngestionQueue>('lr-ingestion-queue')!; await child.updateComplete; return child;
}

it('forwards provider identity to only the active child and remounts at page zero', async () => {
  const sources = knowledge(); const items = ingestion();
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${sources.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  let child = await inventory(host); expect(child.dataSource === sources.source).to.equal(true); expect(sources.pages).to.deep.equal([0]); expect(items.pages).to.deep.equal([]);
  child.sourcePage = 2; await waitUntil(() => child.sourceTotal === 201 && child.sourcePage === 2); expect(sources.pages).to.deep.equal([0, 2]);
  host.activeTab = 'ingestion'; const ingestionChild = await queue(host); expect(ingestionChild.dataSource === items.source).to.equal(true); expect(items.pages).to.deep.equal([0]);
  expect(host.shadowRoot!.querySelector('lr-knowledge-base')).to.equal(null);
  host.activeTab = 'sources'; child = await inventory(host); expect(child.sourcePage).to.equal(0); expect(sources.pages).to.deep.equal([0, 2, 0]);
});
it('keeps inactive providers opaque and stores same-reference assignments silently', async () => {
  const sources = knowledge(); let reads = 0;
  const hidden = new Proxy({} as IngestionQueueSource, { get() { reads++; throw new Error('Inactive provider read'); }, ownKeys() { reads++; throw new Error('Provider enumerated'); } });
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${sources.source}></lr-knowledge-base-admin>`);
  host.ingestionSource = hidden; await inventory(host); host.ingestionSource = hidden; host.label = 'Changed'; await host.updateComplete;
  expect(host.ingestionSource === hidden).to.equal(true); expect(reads).to.equal(0); expect(sources.pages.length).to.equal(1);
});
it('refreshes the active child once for same identity and keyless updates in either paint order', async () => {
  const data = knowledge(); const items = ingestion();
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  await inventory(host); host.dataSource = data.source; await inventory(host); await host.updateComplete; expect(data.pages.length).to.equal(2);
  host.requestUpdate(); host.label = 'One'; await inventory(host); await host.updateComplete; expect(data.pages.length).to.equal(3);
  host.label = 'Two'; host.requestUpdate(); await inventory(host); await host.updateComplete; expect(data.pages.length).to.equal(4); expect(items.pages.length).to.equal(0);
  host.headingLevel = '3'; await host.updateComplete; expect(data.pages.length).to.equal(4);
});
it('rejects old-child actions immediately after tab or provider replacement', async () => {
  const data = knowledge(); const next = knowledge(); const items = ingestion();
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  const child = await inventory(host); const seen: string[] = []; host.addEventListener('lr-source-sync', event => seen.push(event.detail.sourceId));
  child.dispatchEvent(new CustomEvent('lr-source-sync', { detail: { sourceId: 'current' }, bubbles: true, composed: true }));
  host.dataSource = next.source; child.dispatchEvent(new CustomEvent('lr-source-sync', { detail: { sourceId: 'replaced' }, bubbles: true, composed: true }));
  await inventory(host); host.activeTab = 'ingestion'; child.dispatchEvent(new CustomEvent('lr-source-sync', { detail: { sourceId: 'switched' }, bubbles: true, composed: true }));
  await queue(host); child.dispatchEvent(new CustomEvent('lr-source-sync', { detail: { sourceId: 'detached' }, bubbles: true, composed: true }));
  expect(seen).to.deep.equal(['current']);
});
it('keeps the inactive inventory provider and both provider-covered legacy arrays unread', async () => {
  const items = ingestion(); let reads = 0;
  const hidden = new Proxy({} as KnowledgeBaseSource, { get() { reads++; throw new Error('Inactive provider read'); }, ownKeys() { reads++; throw new Error('Provider walked'); } });
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin active-tab="ingestion" .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  host.dataSource = hidden;
  Object.defineProperty(host, 'sources', { configurable: true, get() { throw new Error('Inactive collection read'); } });
  Object.defineProperty(host, 'ingestionItems', { configurable: true, get() { throw new Error('Covered collection read'); } });
  try { await queue(host); host.requestUpdate(); await queue(host); expect(reads).to.equal(0); expect(items.pages.length).to.equal(2); }
  finally { delete (host as unknown as { sources?: unknown }).sources; delete (host as unknown as { ingestionItems?: unknown }).ingestionItems; }
});
it('refreshes active ingestion once and keeps its namespaced immutable event details', async () => {
  const data = knowledge(); const items = ingestion();
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin active-tab="ingestion" .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  let child = await queue(host); host.ingestionSource = items.source; child = await queue(host); await host.updateComplete; expect(items.pages.length).to.equal(2);
  host.label = 'One'; host.requestUpdate(); child = await queue(host); expect(items.pages.length).to.equal(3); expect(data.pages.length).to.equal(0);
  const seen: { type: string; detail: unknown; cancelable: boolean }[] = [];
  for (const type of ['lr-ingestion-retry', 'lr-ingestion-cancel']) host.addEventListener(type, event => seen.push({ type, detail: (event as CustomEvent).detail, cancelable: event.cancelable }));
  const detail = { itemId: 'i0', attempt: 3 }; child.dispatchEvent(new CustomEvent('lr-retry', { detail, bubbles: true, composed: true }));
  child.dispatchEvent(new CustomEvent('lr-cancel', { detail: { itemId: 'i0', reason: 'user' }, bubbles: true, composed: true }));
  detail.attempt = 9;
  expect(seen).to.deep.equal([{ type: 'lr-ingestion-retry', detail: { itemId: 'i0', attempt: 3 }, cancelable: false }, { type: 'lr-ingestion-cancel', detail: { itemId: 'i0', reason: 'user' }, cancelable: false }]);
  expect(Object.isFrozen(seen[0]!.detail)).to.equal(true);
  host.activeTab = 'sources'; child.dispatchEvent(new CustomEvent('lr-retry', { detail, bubbles: true, composed: true })); await inventory(host); expect(seen.length).to.equal(2);
});
it('does not forward an action whose payload snapshot changes active ownership', async () => {
  const data = knowledge(); const items = ingestion(); const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  const child = await inventory(host); let forwarded = 0; host.addEventListener('lr-source-delete', () => forwarded++);
  const detail = new Proxy({ sourceId: 's0' }, { getOwnPropertyDescriptor(target, key) { host.activeTab = 'ingestion'; return Reflect.getOwnPropertyDescriptor(target, key); } });
  child.dispatchEvent(new CustomEvent('lr-source-delete', { detail, bubbles: true, composed: true })); await queue(host); expect(forwarded).to.equal(0);
});
it('honors replacement from a child abort listener without duplicate provider assignment', async () => {
  const old = knowledge(); const replacement = knowledge(); const final = knowledge(); let host: LyraKnowledgeBaseAdmin; let settle!: () => void;
  const query = old.source.query;
  old.source.query = request => new Promise(resolve => {
    request.signal.addEventListener('abort', () => { host.dataSource = final.source; }, { once: true });
    settle = () => { void Promise.resolve(query(request)).then(resolve); };
  });
  host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${old.source}></lr-knowledge-base-admin>`); await waitUntil(() => !!settle);
  host.dataSource = replacement.source; settle(); const child = await inventory(host); await host.updateComplete;
  expect(host.dataSource === final.source).to.equal(true); expect(child.dataSource === final.source).to.equal(true); expect(replacement.pages.length).to.equal(0); expect(final.pages.length).to.equal(1);
});
it('defers a remounted query until an abort-ignoring physical request settles', async () => {
  const data = knowledge(); const items = ingestion(); const query = data.source.query; let started = 0; let active = 0; let peak = 0; let settle!: () => void;
  data.source.query = async request => {
    started++; active++; peak = Math.max(peak, active);
    if (started === 1) await new Promise<void>(resolve => { settle = resolve; });
    const result = await query(request); active--; return result;
  };
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`); await waitUntil(() => !!settle);
  host.activeTab = 'ingestion'; await queue(host); host.activeTab = 'sources'; await host.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 20));
  try { expect(started).to.equal(1); } finally { settle(); }
  await inventory(host); expect(started).to.equal(2); expect(peak).to.equal(1);
});
it('restores provider-unset legacy inputs and leaves no page or total protocol on the shell', async () => {
  const data = knowledge(); const items = ingestion(); const legacySources = [{ id: 'legacy', name: 'Legacy', syncStatus: 'synced' as const }];
  const legacyItems = [{ id: 'old', document: { id: 'old', name: 'Old' }, stage: 'queued' as const }];
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .sources=${legacySources} .ingestionItems=${legacyItems} .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  const child = await inventory(host); host.dataSource = undefined; await host.updateComplete; await child.updateComplete; expect(child.sources[0]!.id).to.equal('legacy'); expect(child.sourceTotal).to.equal(null);
  host.activeTab = 'ingestion'; const ingestionChild = await queue(host); host.ingestionSource = undefined; await host.updateComplete; await ingestionChild.updateComplete;
  expect(ingestionChild.items[0]!.id).to.equal('old'); expect(ingestionChild.sourceTotal).to.equal(null); expect(host.sources[0]!.id).to.equal('legacy');
  expect('sourcePage' in host).to.equal(false); expect('sourcePageSize' in host).to.equal(false); expect('sourceTotal' in host).to.equal(false);
});
it('reconnects and adopts without duplicating child refreshes or reviving captured old events', async () => {
  const data = knowledge(); const wrapper = await fixture<HTMLDivElement>(html`<div><iframe title="New document"></iframe><lr-knowledge-base-admin .dataSource=${data.source}></lr-knowledge-base-admin></div>`);
  const host = wrapper.querySelector<LyraKnowledgeBaseAdmin>('lr-knowledge-base-admin')!; await inventory(host);
  host.remove(); wrapper.append(host); await inventory(host); expect(data.pages.length).to.equal(2);
  const doc = wrapper.querySelector('iframe')!.contentDocument!; doc.body.appendChild(doc.adoptNode(host)); await inventory(host); expect(data.pages.length).to.equal(3);
});
it('keeps focused tab normalization and only queries the newly active provider', async () => {
  const data = knowledge(); const items = ingestion(); const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin dir="rtl" .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  await inventory(host); const tabs = [...host.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const { focusByKeyboard } = await import('../../../../test/wtr-focus.js'); const { sendKeys } = await import('@web/test-runner-commands');
  await focusByKeyboard(tabs[0]!); await sendKeys({ press: 'ArrowLeft' }); await queue(host); expect(host.shadowRoot!.activeElement === tabs[1]).to.equal(true);
  host.withoutIngestion = true; await inventory(host); expect(host.activeTab).to.equal('sources'); expect(host.shadowRoot!.activeElement === tabs[0]).to.equal(true);
  expect(data.pages).to.deep.equal([0, 0]); expect(items.pages).to.deep.equal([0]);
});
it('keeps presentation paints and tab re-picks query-silent while inherited locale refreshes once', async () => {
  const data = knowledge(); const items = ingestion(); const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${data.source} .ingestionSource=${items.source}></lr-knowledge-base-admin>`);
  await inventory(host); const tabs = [...host.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  host.label = 'Changed'; host.headingLevel = '4'; host.append(document.createElement('span')); tabs[0]!.click(); await host.updateComplete;
  expect(data.pages.length).to.equal(1); expect(items.pages.length).to.equal(0);
  host.lang = 'en-GB'; await waitUntil(() => data.pages.length > 1); await inventory(host); await host.updateComplete;
  expect(data.pages.length).to.equal(2); expect(items.pages.length).to.equal(0);
});
it('keeps inactive assignments silent for current child action authority', async () => {
  const data = knowledge(); const items = ingestion(); const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${data.source}></lr-knowledge-base-admin>`);
  const child = await inventory(host); let actions = 0; host.addEventListener('lr-source-create', () => actions++);
  host.ingestionSource = items.source; child.dispatchEvent(new CustomEvent('lr-source-create', { bubbles: true, composed: true }));
  await host.updateComplete; expect(actions).to.equal(1); expect(data.pages.length).to.equal(1); expect(items.pages.length).to.equal(0);
});
it('forwards current native ingestion retries while revoking retained row buttons on replacement', async () => {
  const old = ingestion(); const next = ingestion();
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin active-tab="ingestion" .ingestionSource=${old.source}></lr-knowledge-base-admin>`);
  let child = await queue(host); const oldButton = child.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;
  const seen: unknown[] = []; host.addEventListener('lr-ingestion-retry', event => seen.push(event.detail));
  oldButton.click(); expect(seen).to.deep.equal([{ itemId: 'i0', attempt: 3 }]);
  host.ingestionSource = next.source; oldButton.click(); child = await queue(host); await host.updateComplete;
  child.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!.click();
  expect(seen).to.deep.equal([{ itemId: 'i0', attempt: 3 }, { itemId: 'i0', attempt: 3 }]); expect(next.pages.length).to.equal(1);
});
