import assert from 'node:assert/strict';
import test from 'node:test';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { initialCatalog, createCatalog } from '../dist/catalog.js';
import { createSnapshot, createSurfaceState } from '../dist/runtime.js';
import { renderGenSnapshot } from '../dist/ssr.js';
import { fixtureCatalog, fixtureSnapshot } from './ssr-fixtures.mjs';

const snapshotFor = root => {
  const view = { version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'server-test', revision: 0, root };
  return createSnapshot(view, createSurfaceState(view));
};

test('SSR renders actual table cells and named disabled fields, with safe literal text and payload', async () => {
  const before = globalThis.customElements?.get('lr-gen-view');
  const result = renderGenSnapshot(fixtureSnapshot(), fixtureCatalog, { locale: 'en', direction: 'rtl' });
  assert.equal(result.ok, true);
  const markup = await collectResult(render(result.value.template));
  assert.match(markup, /<table/);
  assert.match(markup, /<caption[^>]*>.*Order totals/s);
  assert.match(markup, /<th[^>]*scope="col"[^>]*>.*Month/s);
  assert.match(markup, /<td[^>]*>.*January/s);
  assert.match(markup, /<input[^>]*disabled[^>]*value="Saved user edit"/);
  assert.match(markup, /aria-label="Review note"/);
  assert.match(markup, /<fieldset[^>]*disabled/);
  assert.match(markup, /dir="rtl"/);
  assert.ok(!markup.includes('<script>globalThis.snapshotExecuted'));
  assert.ok(markup.includes('&lt;/template&gt;&lt;script&gt;'));
  assert.ok(!result.value.serialized.includes('<'));
  assert.ok(!result.value.serialized.includes('&'));
  assert.deepEqual(JSON.parse(result.value.serialized).snapshot.state.dirty, ['/note']);
  assert.equal(globalThis.customElements?.get('lr-gen-view'), before);
});

test('SSR rejects unsupported or modified roles, and rows beyond the visible first page', () => {
  assert.equal(renderGenSnapshot(snapshotFor({ id: 'unsupported', type: 'card' }), initialCatalog).ok, false);
  const altered = createCatalog({ ...initialCatalog, components: { ...initialCatalog.components, text: { ...initialCatalog.components.text, tag: 'article' } } });
  assert.equal(renderGenSnapshot(snapshotFor({ id: 'text', type: 'text', text: 'Hello' }), altered).ok, false);
  assert.equal(renderGenSnapshot(snapshotFor({ id: 'table', type: 'table', props: { caption: 'Paged', pageSize: 1, columns: [{ key: 'c0', label: 'Item' }], rows: [{ c0: 'One' }, { c0: 'Two' }] } }), initialCatalog).ok, false);
});

test('SSR refuses forged snapshot state, mismatched catalog versions, and lower byte ceilings', () => {
  const forged = structuredClone(fixtureSnapshot());
  forged.state.values.undeclared = 'must not render';
  assert.equal(renderGenSnapshot(forged, fixtureCatalog).ok, false);
  assert.equal(renderGenSnapshot(fixtureSnapshot(), { ...fixtureCatalog, version: 'other' }).ok, false);
  assert.equal(renderGenSnapshot(fixtureSnapshot(), fixtureCatalog, { limits: { maxBytes: 64 } }).ok, false);
  assert.equal(renderGenSnapshot(fixtureSnapshot(), fixtureCatalog, { locale: 'not a locale' }).ok, false);
});

test('SSR renders every advertised native field role with escaped values', async () => {
  const snapshot = snapshotFor({ id: 'group', type: 'row', children: [
    { id: 'area', type: 'textarea', props: { label: 'Notes', value: '</textarea><script>bad()</script>' } },
    { id: 'select', type: 'select', props: { label: 'Choice', value: 'b' }, children: [{ id: 'a', type: 'option', props: { value: 'a' }, text: 'Alpha' }, { id: 'b', type: 'option', props: { value: 'b' }, text: 'Beta' }] },
    { id: 'switch', type: 'switch', text: 'Enabled', props: { checked: true } },
  ] });
  const result = renderGenSnapshot(snapshot, initialCatalog);
  assert.equal(result.ok, true);
  const markup = await collectResult(render(result.value.template));
  assert.ok(markup.includes('&lt;/textarea&gt;&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(!markup.includes('<script>bad()'));
  assert.match(markup, /<option[^>]*value="b"[^>]*selected/);
  assert.match(markup, /role="switch"[^>]*disabled[^>]*checked/);
});


test('SSR typed columns use explicit host locale and preserve raw serialized values', async () => {
  const rows = [{ c0: -123456.125, c1: '2026-01-01T00:30:00+02:00' }];
  const snapshot = snapshotFor({ id: 'table', type: 'table', props: { caption: 'Formatted', columns: [{ key: 'c0', label: 'Number', format: { kind: 'number' } }, { key: 'c1', label: 'Instant', format: { kind: 'datetime', timeZone: 'UTC' } }], rows } });
  assert.equal(renderGenSnapshot(snapshot, initialCatalog).ok, false);
  for (const locale of ['en', 'fr', 'ar']) {
    const result = renderGenSnapshot(snapshot, initialCatalog, { locale });
    assert.equal(result.ok, true);
    const markup = await collectResult(render(result.value.template));
    assert.ok(markup.includes(new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(rows[0].c0)));
    assert.ok(markup.includes(new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date('2025-12-31T22:30:00Z'))));
    assert.deepEqual(JSON.parse(result.value.serialized).snapshot.view.root.props.rows, rows);
  }
});
