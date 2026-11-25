import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dashboardCatalog, createCatalog } from './catalog.js';
import { validateSchema } from './schema.js';
import { validateView } from './runtime.js';
import { createMockQueryProvider, mockLiveData, mockQueryResult } from './mock-data.js';
import type { JsonValue, LyraGenCatalog, LyraGenNode, LyraGenSchema, LyraGenView } from './types.js';

const base = dashboardCatalog();
const catalog: LyraGenCatalog = createCatalog({
  ...base,
  queries: {
    kpis: {
      params: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, additionalProperties: false },
      result: { type: 'object', properties: { label: { type: 'string', minLength: 3, maxLength: 12 }, count: { type: 'integer', minimum: 5, maximum: 9 }, tone: { type: 'string', enum: ['up', 'down'] }, rows: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'object', properties: { n: { type: 'number', minimum: -2.5, maximum: -1 } }, required: ['n'], additionalProperties: false } } }, required: ['label', 'count'], additionalProperties: false },
    },
    shaped: { params: { type: 'object', properties: {}, additionalProperties: false } },
  },
});
const node = (n: Partial<LyraGenNode> & { id: string; type: string }): LyraGenNode => n as LyraGenNode;
const view = (children: LyraGenNode[]): LyraGenView => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'dash', revision: 0, root: { id: 'root', type: 'stack', children } });
const at = (data: JsonValue, pointer: string): JsonValue | undefined => pointer.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], data) as JsonValue | undefined;
const valid = (schema: LyraGenSchema | undefined, value: unknown): boolean => validateSchema(value, schema!).ok;

test('mockQueryResult is deterministic, seeded and satisfies every declared bound', () => {
  const a = mockQueryResult(catalog, 'kpis', {}, { seed: 7 });
  assert.deepEqual(a, mockQueryResult(catalog, 'kpis', {}, { seed: 7 }));
  assert.notDeepEqual(a, mockQueryResult(catalog, 'kpis', {}, { seed: 8 }));
  for (let seed = 0; seed < 50; seed++) {
    const result = mockQueryResult(catalog, 'kpis', { days: 7 }, { seed });
    const check = validateSchema(result, catalog.queries!['kpis']!.result!);
    assert.equal(check.ok, true, JSON.stringify(check));
  }
  assert.equal(mockQueryResult(catalog, 'missing'), undefined);
  assert.deepEqual(mockQueryResult(catalog, 'shaped'), {});
});

test('a query without a result schema takes its shape from the view nodes that display it', () => {
  const v = view([node({ id: 'k', type: 'stat', props: { label: 'Open' }, dataQuery: { name: 'shaped' }, liveReads: { value: '/summary/total' } })]);
  const result = mockQueryResult(catalog, 'shaped', {}, { seed: 3, view: v })!;
  assert.equal(typeof at(result, '/summary/total'), 'string');
});

test('mockLiveData fills liveReads and repeat items for stat, gauge, table and series-chart roles', () => {
  const v = view([
    node({ id: 's', type: 'stat', props: { label: 'Total', value: '0' }, liveReads: { value: '/stats/total', deltaPercent: '/stats/delta', variant: '/stats/tone' } }),
    node({ id: 'g', type: 'gauge', props: { label: 'Load', value: 0 }, liveReads: { value: '/load' } }),
    node({ id: 't', type: 'table', props: { caption: 'Rows', columns: [{ key: 'c0', label: 'A' }], rows: [] }, liveReads: { rows: '/table/rows', columns: '/table/columns' } }),
    node({ id: 'c', type: 'series-chart', props: { label: 'Trend', labels: [], datasets: [{ label: 'A', data: [] }] }, liveReads: { labels: '/chart/labels', datasets: '/chart/datasets' } }),
    node({ id: 'list', type: 'stack', repeat: { items: '/people', key: '/id', max: 3 }, children: [node({ id: 'row', type: 'stat', props: { label: 'x', value: '' }, itemReads: { value: '/name' } })] }),
    node({ id: 'q', type: 'stat', props: { label: 'Q', value: '0' }, dataQuery: { name: 'kpis' }, liveReads: { value: '/ignored' } }),
  ]);
  for (let seed = 0; seed < 25; seed++) {
    const data = mockLiveData(v, catalog, { seed });
    assert.deepEqual(data, mockLiveData(v, catalog, { seed }));
    const stat = catalog.components['stat']!.properties;
    assert.ok(valid(stat['value'], at(data, '/stats/total')));
    assert.ok(valid(stat['deltaPercent'], at(data, '/stats/delta')));
    assert.ok(valid(stat['variant'], at(data, '/stats/tone')));
    assert.ok(valid(catalog.components['gauge']!.properties['value'], at(data, '/load')));
    assert.ok(valid(catalog.components['table']!.properties['rows'], at(data, '/table/rows')));
    assert.ok(valid(catalog.components['table']!.properties['columns'], at(data, '/table/columns')));
    assert.ok(valid(catalog.components['series-chart']!.properties['datasets'], at(data, '/chart/datasets')));
    assert.ok(valid(catalog.components['series-chart']!.properties['labels'], at(data, '/chart/labels')));
    const people = at(data, '/people') as { id: string; name: string }[];
    assert.ok(people.length >= 1 && people.length <= 3);
    assert.equal(new Set(people.map(person => person.id)).size, people.length);
    assert.ok(people.every(person => valid(stat['value'], person.name)));
    assert.equal(at(data, '/ignored'), undefined);
  }
  const checked = validateView(v, catalog);
  assert.equal(checked.ok, true, JSON.stringify(checked.diagnostics));
});

test('the mock query provider answers declared queries and rejects unknown or aborted ones', async () => {
  const provider = createMockQueryProvider(catalog, { seed: 4 });
  const answer = await provider({ name: 'kpis', params: {} });
  assert.deepEqual(answer, mockQueryResult(catalog, 'kpis', {}, { seed: 4 }));
  await assert.rejects(provider({ name: 'nope', params: {} }));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(provider({ name: 'kpis', params: {}, signal: controller.signal }));
  const slow = createMockQueryProvider(catalog, { latencyMs: 5000 });
  const late = new AbortController();
  const pending = slow({ name: 'kpis', params: {}, signal: late.signal });
  late.abort();
  await assert.rejects(pending);
});
