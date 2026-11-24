import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, dashboardCatalog } from '../catalog.js';
import { validateView } from '../runtime.js';
import { richAnswerRoles } from './answers-rich.js';
import type { LyraGenCatalog, LyraGenNode } from '../types.js';

const overlay = dashboardCatalog();
const catalog: LyraGenCatalog = createCatalog({ ...overlay, id: `${overlay.id}+rich`, components: { ...overlay.components, ...richAnswerRoles } });
const reserved = ['id', 'slot', 'text', 'bindings', 'reads', 'liveReads', 'dataQuery', 'repeat', 'itemReads', 'action'];
const view = (root: LyraGenNode) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'rich-test', revision: 0, root });
const accepts = (root: LyraGenNode): void => { const checked = validateView(view(root), catalog); assert.ok(checked.ok, `${JSON.stringify(root).slice(0, 160)}: ${JSON.stringify(checked.diagnostics)}`); };
const rejects = (root: LyraGenNode): void => assert.equal(validateView(view(root), catalog).ok, false, JSON.stringify(root).slice(0, 200));
const role = (name: string) => richAnswerRoles[name]!;

test('rich answer roles are collision-free, reviewed and validate their examples', () => {
  assert.deepEqual(Object.keys(richAnswerRoles), ['markdown', 'context-meter', 'stream-status', 'generation-metrics', 'graph', 'mind-map', 'segmented', 'toggle-group', 'toggle', 'checkbox-group', 'checkbox-option', 'radio-group', 'radio', 'number-input', 'date-input']);
  for (const [name, component] of Object.entries(richAnswerRoles)) {
    // The dashboard overlay adds these roles unchanged; no built-in role uses the name.
    assert.equal(overlay.components[name], component, name);
    assert.ok(component.useWhen && component.examples?.length === 1, name);
    assert.ok(component.load && component.documentation, name);
    for (const key of Object.keys(component.properties)) assert.equal(reserved.includes(key), false, `${name}.${key}`);
    for (const key of component.hostProperties ?? []) assert.equal(Object.hasOwn(component.properties, key), false, `${name}: host ${key}`);
    accepts(component.examples![0]!);
  }
});

test('markdown is forced into escaped, link-free and image-free rendering', () => {
  const markdown = role('markdown');
  assert.deepEqual([...markdown.hostProperties!].sort(), ['htmlMode', 'linkSchemes', 'linkTarget', 'withoutImages']);
  const prepared = markdown.prepareProperties!({ content: '# Title' });
  assert.equal(prepared['htmlMode'], 'escape');
  assert.equal(prepared['withoutImages'], true);
  assert.equal(prepared['linkSchemes'], '');
  assert.equal(prepared['linkTarget'], null);
  for (const key of ['htmlMode', 'withoutImages', 'linkSchemes', 'linkTarget', 'internalLinkPrefix', 'math', 'headingAnchors', 'streaming']) rejects({ id: 'm', type: 'markdown', props: { content: 'x', [key]: key === 'withoutImages' ? false : 'trusted' } });
  rejects({ id: 'm', type: 'markdown', props: { content: 'x'.repeat(16385) } });
  rejects({ id: 'm', type: 'markdown', props: {} });
});

test('agent metrics stay plain numbers and status, with host-owned controls', () => {
  rejects({ id: 'c', type: 'context-meter', props: { label: 'Context', total: 100, segments: [{ label: 'A', value: 1, color: 'url(x)' }] } });
  rejects({ id: 'c', type: 'context-meter', props: { label: 'Context', total: 100, segments: Array.from({ length: 13 }, (_, i) => ({ label: `s${i}`, value: 1 })) } });
  rejects({ id: 'c', type: 'context-meter', props: { label: 'Context', total: 100, segments: [{ label: 'A', value: 1 }], interactive: true } });
  rejects({ id: 'c', type: 'context-meter', props: { label: 'Context', total: -1, segments: [{ label: 'A', value: 1 }] } });
  rejects({ id: 's', type: 'stream-status', props: { connectionState: 'stalled' } });
  rejects({ id: 's', type: 'stream-status', props: { resumable: true } });
  rejects({ id: 'g', type: 'generation-metrics', props: { status: 'running', withoutStop: false } });
  rejects({ id: 'g', type: 'generation-metrics', props: { status: 'running', tokenCount: 1.5 } });
  assert.equal(role('stream-status').prepareProperties!({ connectionState: 'streaming' })['stallThresholdMs'], 0);
  assert.equal(role('generation-metrics').prepareProperties!({ status: 'running' })['withoutStop'], true);
});

test('graphs bound nodes, edges and depth and carry no callbacks or URLs', () => {
  const node = (i: number) => ({ id: `n${i}`, label: `Node ${i}` });
  accepts({ id: 'g', type: 'graph', props: { label: 'Big', nodes: Array.from({ length: 200 }, (_, i) => node(i)), edges: Array.from({ length: 400 }, (_, i) => ({ source: `n${i % 200}`, target: `n${(i + 1) % 200}` })) } });
  rejects({ id: 'g', type: 'graph', props: { label: 'Too many', nodes: Array.from({ length: 201 }, (_, i) => node(i)) } });
  rejects({ id: 'g', type: 'graph', props: { label: 'Too many', nodes: [node(0)], edges: Array.from({ length: 401 }, () => ({ source: 'n0', target: 'n0' })) } });
  rejects({ id: 'g', type: 'graph', props: { label: 'Colour', nodes: [{ ...node(0), color: 'red' }] } });
  rejects({ id: 'g', type: 'graph', props: { label: 'Source', nodes: [node(0)], graphSource: {} } });
  rejects({ id: 'g', type: 'graph', props: { label: 'Fit', nodes: [node(0)], fitTo: 'none' } });
  rejects({ id: 'g', type: 'graph', props: { label: '3D', nodes: [node(0)], view: '3d' } });
  assert.equal(role('graph').prepareProperties!({ label: 'x' })['fitTo'], 'container');
  const leaf = (i: number) => ({ id: `t${i}`, label: `Topic ${i}` });
  rejects({ id: 'm', type: 'mind-map', props: { label: 'Two roots', topics: [leaf(0), leaf(1)] } });
  rejects({ id: 'm', type: 'mind-map', props: { label: 'Deep', topics: [{ ...leaf(0), children: [{ ...leaf(1), children: [{ ...leaf(2), children: [leaf(3)] }] }] }] } });
  rejects({ id: 'm', type: 'mind-map', props: { label: 'Wide', topics: [{ ...leaf(0), children: Array.from({ length: 13 }, (_, i) => leaf(i + 1)) }] } });
  rejects({ id: 'm', type: 'mind-map', props: { label: 'Source', topics: [leaf(0)], treeSource: {} } });
});

test('driving controls declare their value bindings, a general field purpose and bounded options', () => {
  const expected: Readonly<Record<string, readonly [string, string, string]>> = {
    segmented: ['value', 'lr-change', 'value'],
    'toggle-group': ['value', 'lr-change', 'value'],
    'checkbox-group': ['value', 'lr-change', 'value'],
    'radio-group': ['value', 'lr-change', 'value'],
    'number-input': ['valueAsNumber', 'lr-input', 'valueAsNumber'],
    'date-input': ['value', 'lr-change', 'value'],
  };
  for (const [name, [key, event, property]] of Object.entries(expected)) {
    const component = role(name);
    assert.deepEqual(component.bindings, { [key]: { event, property } }, name);
    assert.equal(component.fieldPurpose, 'general', name);
    assert.equal(component.interactive, true, name);
    assert.deepEqual(component.accessibleName, { required: true, properties: ['label'] }, name);
  }
  for (const name of ['toggle', 'checkbox-option', 'radio']) assert.equal(role(name).bindings, undefined, name);
  assert.deepEqual(role('toggle-group').children, ['toggle']);
  assert.deepEqual(role('checkbox-group').children, ['checkbox-option']);
  assert.deepEqual(role('radio-group').children, ['radio']);
  rejects({ id: 's', type: 'segmented', props: { label: 'Range', items: Array.from({ length: 13 }, (_, i) => ({ value: `v${i}`, label: `V${i}` })) } });
  rejects({ id: 's', type: 'segmented', props: { label: 'Range', items: [{ value: 'a', label: 'A', icon: 'x' }] } });
  rejects({ id: 's', type: 'segmented', props: { items: [{ value: 'a', label: 'A' }] } });
  rejects({ id: 't', type: 'toggle-group', props: { label: 'Series' }, children: [{ id: 'r', type: 'radio', props: { value: 'a' }, text: 'A' }] });
  rejects({ id: 't', type: 'toggle-group', props: { label: 'Series' }, children: [{ id: 'o', type: 'toggle', props: {} , text: 'A' }] });
  rejects({ id: 'c', type: 'checkbox-group', props: { label: 'Regions', value: Array.from({ length: 25 }, (_, i) => `v${i}`) } });
  rejects({ id: 'n', type: 'number-input', props: { label: 'Limit', value: '42' } });
  rejects({ id: 'n', type: 'number-input', props: { label: 'Limit', type: 'password' } });
  rejects({ id: 'd', type: 'date-input', props: { label: 'From', value: '2026-11-24T00:00:00Z' } });
  rejects({ id: 'd', type: 'date-input', props: { label: 'From', mode: 'range' } });
  rejects({ id: 'd', type: 'date-input', props: { label: 'From', isDateDisabled: 'x' } });
  accepts({ id: 'root', type: 'stack', children: [
    { id: 'period', type: 'segmented', props: { label: 'Period', items: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }], value: 'day' }, bindings: { value: '/period' } },
    { id: 'limit', type: 'number-input', props: { label: 'Limit', valueAsNumber: 10, min: 0, max: 100 }, bindings: { valueAsNumber: '/limit' } },
    { id: 'gauge', type: 'gauge', props: { label: 'Limit preview', value: 0, max: 100 }, reads: { value: '/limit' } },
  ] });
});

test('number input turns its generated number into the component string value', () => {
  const prepare = role('number-input').prepareProperties!;
  assert.deepEqual(prepare({ label: 'Limit', valueAsNumber: 42, min: 0 }), { label: 'Limit', min: 0, value: '42' });
  assert.deepEqual(prepare({ label: 'Limit' }), { label: 'Limit' });
  assert.deepEqual(role('number-input').hostProperties, ['value']);
});
