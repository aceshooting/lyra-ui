import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, initialCatalog } from '../catalog.js';
import { buildCatalogPrompt } from '../prompts.js';
import { createAction, validateView } from '../runtime.js';
import { mcpAppActions, mcpAppComponents, mcpToolCallAction, type LyraGenMcpAppOptions } from './mcp.js';
import type { LyraGenCatalog, LyraGenNode } from '../types.js';

const options: LyraGenMcpAppOptions = {
  resources: { chart: { uri: 'ui://reports/chart', html: '<p>chart</p>', description: 'Sales chart' }, remote: { uri: 'ui://reports/remote', src: 'https://apps.example.com/a' } },
  tools: ['refresh', 'export'],
};
const build = (o: LyraGenMcpAppOptions = options): LyraGenCatalog => createCatalog({ ...initialCatalog, id: `${initialCatalog.id}+mcp`, components: { ...initialCatalog.components, ...mcpAppComponents(initialCatalog, o) }, actions: { ...initialCatalog.actions, ...mcpAppActions(o) } });
const view = (catalog: LyraGenCatalog, root: LyraGenNode) => ({ version: '1' as const, catalog: { id: catalog.id, version: catalog.version }, surfaceId: 's', revision: 0, root });

test('generated content can only choose an allowlisted app and bounded input', () => {
  const catalog = build();
  const ok = (root: LyraGenNode) => validateView(view(catalog, root), catalog).ok;
  assert.ok(ok({ id: 'a', type: 'mcp-app', props: { app: 'chart', label: 'Sales', input: { quarter: 'Q3', limit: 5 } } }));
  assert.equal(ok({ id: 'a', type: 'mcp-app', props: { app: 'evil', label: 'x' } }), false);
  assert.equal(ok({ id: 'a', type: 'mcp-app', props: { app: 'chart', label: 'x', resource: { uri: 'ui://x', html: '<script>' } } }), false);
  assert.equal(ok({ id: 'a', type: 'mcp-app', props: { app: 'chart', label: 'x', protocol: 'mcp-apps' } }), false);
  assert.equal(ok({ id: 'a', type: 'mcp-app', props: { app: 'chart', label: 'x', hostCapabilities: { serverTools: {} } } }), false);
  assert.equal(ok({ id: 'a', type: 'mcp-app', props: { app: 'chart', label: 'x', input: { nested: { deep: 1 } } } }), false);
  assert.equal(ok({ id: 'a', type: 'mcp-app', props: { app: 'chart', label: 'x', input: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`k${i}`, i])) } }), false);
  assert.equal(ok({ id: 'a', type: 'mcp-app', props: { app: 'chart' } }), false);
});

test('host properties are assigned by the adapter and absent from the prompt', () => {
  const catalog = build({ ...options, protocol: 'mcp-apps', hostCapabilities: { serverTools: {} } });
  const component = catalog.components['mcp-app']!;
  const prepared = component.prepareProperties!({ app: 'chart', label: 'Sales', input: { q: 'Q3' } }) as Record<string, unknown>;
  assert.equal(prepared['protocol'], 'mcp-apps');
  assert.deepEqual(prepared['hostCapabilities'], { serverTools: {} });
  assert.equal((prepared['resource'] as Record<string, unknown>)['uri'], 'ui://reports/chart');
  assert.deepEqual((prepared['resource'] as { metadata: unknown }).metadata, { toolInput: { q: 'Q3' } });
  assert.equal('description' in (prepared['resource'] as object), false);
  const prompt = buildCatalogPrompt(catalog);
  for (const secret of ['<p>chart</p>', 'apps.example.com', 'hostCapabilities', 'ui://reports']) assert.equal(prompt.includes(secret), false, secret);
  assert.ok(prompt.includes('chart') && prompt.includes('Sales chart'));
});

test('tool calls become confirmed actions limited to allowlisted tools', () => {
  const catalog = build();
  assert.equal(catalog.actions?.[mcpToolCallAction]?.confirm, true);
  assert.deepEqual(catalog.components['mcp-app']!.events, ['lr-mcp-tool-call']);
  const node = (tool: string): LyraGenNode => ({ id: 'a', type: 'mcp-app', props: { app: 'chart', label: 'Sales' }, action: { name: mcpToolCallAction, payload: { tool, input: { range: 'week' } } } });
  const made = createAction(view(catalog, node('refresh')), 'a', catalog);
  assert.ok(made.ok && made.value.name === mcpToolCallAction);
  assert.equal(validateView(view(catalog, node('refresh')), catalog).ok, true);
  assert.equal(createAction(view(catalog, node('drop-database')), 'a', catalog).ok, false);
  assert.equal(build({ ...options, confirmToolCalls: false }).actions?.[mcpToolCallAction]?.confirm, false);
});

test('no tools means no events and no action', () => {
  const catalog = build({ resources: options.resources });
  assert.equal(catalog.components['mcp-app']!.events, undefined);
  assert.equal(catalog.actions?.[mcpToolCallAction], undefined);
});

test('invalid host configuration fails closed', () => {
  assert.throws(() => mcpAppComponents(initialCatalog, { resources: {} }), TypeError);
  assert.throws(() => mcpAppComponents(initialCatalog, { resources: { a: { uri: 'https://x', html: 'x' } } }), TypeError);
  assert.throws(() => mcpAppComponents(initialCatalog, { resources: { a: { uri: 'ui://x' } } }), TypeError);
  assert.throws(() => mcpAppComponents(initialCatalog, { resources: { a: { uri: 'ui://x', html: 'x', src: '/y' } } }), TypeError);
  assert.throws(() => mcpAppComponents(initialCatalog, { resources: { A: { uri: 'ui://x', html: 'x' } } }), TypeError);
  assert.throws(() => mcpAppComponents(initialCatalog, { resources: options.resources, tools: ['a', 'a'] }), TypeError);
  assert.throws(() => mcpAppComponents(build(), options), /already defines mcp-app/u);
});
