/**
 * Validation, patch and streaming-preview results must stay byte-identical across performance work.
 * Every case hashes the JSON of its complete result (values, diagnostics, isolation records and each
 * preview) and compares it with a recorded fixture. Inputs (views and the catalogs' JSON) are hashed
 * too, so an edited benchmark scenario or catalog reports itself instead of masquerading as a
 * behavior change; after such an edit, regenerate the fixture from a build without behavior changes.
 *
 * Regenerate the fixture only for an intentional behavior change:
 *   LYRA_GEN_EQUIVALENCE_WRITE=1 node test/validation-equivalence.test.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { scenarios } from '../../../benchmarks/generative-ui/dashboards/scenarios.mjs';
import { chunkText, encodeMarkup, makeView, syntheticRoot } from '../scripts/bench-validation.mjs';

const fixtureUrl = new URL('./fixtures/validation-equivalence.json', import.meta.url);
const dist = process.env.LYRA_GEN_EQUIVALENCE_DIST ? pathToFileURL(`${process.env.LYRA_GEN_EQUIVALENCE_DIST.replace(/\/$/u, '')}/`) : new URL('../dist/', import.meta.url);
const { answerBlocksCatalog, dashboardCatalog } = await import(new URL('catalog.js', dist).href);
const { applyViewPatch, validateView } = await import(new URL('runtime.js', dist).href);
const { createProgressiveMarkupParser } = await import(new URL('progressive.js', dist).href);
const { createJsonViewStream } = await import(new URL('json-stream.js', dist).href);

/* Corruptions mirror the dashboard benchmark's, kept here so no other build is loaded. */
function* walk(node) { yield node; for (const child of node.children ?? []) yield* walk(child); }
const firstNode = (view, match) => { for (const node of walk(view.root)) if (match(node)) return node; return undefined; };
const lastLeaf = view => [...walk(view.root)].filter(node => !node.children?.length && node.id !== view.root.id).at(-1);
const VIEW_CORRUPTIONS = [
  ['unknown-prop', view => { const node = firstNode(view, n => n.props && n.id !== view.root.id); if (node) node.props.bogusProperty = 1; return node; }],
  ['wrong-type', view => { const node = firstNode(view, n => n.props && Object.values(n.props).some(v => typeof v === 'number')); if (node) node.props[Object.keys(node.props).find(k => typeof node.props[k] === 'number')] = 'not a number'; return node; }],
  ['missing-required', (view, catalog) => { const node = firstNode(view, n => (catalog.components[n.type]?.required ?? []).some(k => n.props?.[k] !== undefined)); if (node) delete node.props[catalog.components[node.type].required.find(k => node.props[k] !== undefined)]; return node; }],
  ['unknown-type', view => { const node = lastLeaf(view); if (node) node.type = 'hologram'; return node; }],
  ['duplicate-id', view => { const node = lastLeaf(view); if (node) node.id = view.root.id; return node; }],
  ['dangling-read', view => { const node = firstNode(view, n => n.props && !n.reads && !n.children?.length && n.id !== view.root.id); if (node) node.reads = { [Object.keys(node.props)[0]]: '/nowhere/owned' }; return node; }],
];
const STREAM_CORRUPTIONS = [
  ['truncate-60', text => text.slice(0, Math.floor(text.length * 0.6))],
  ['garble-middle', text => `${text.slice(0, Math.floor(text.length / 2))}@#%${text.slice(Math.floor(text.length / 2))}`],
];

/** A 96-bit digest written in decimal, so the fixture holds no letter runs for the spelling check. */
const hash = value => BigInt(`0x${createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex').slice(0, 24)}`).toString();
const clone = value => JSON.parse(JSON.stringify(value));

const leaves = node => node.children?.length ? node.children.flatMap(leaves) : [node];

/** Every case returns `[inputHash, outputHash]`. */
function collect() {
  const catalog = dashboardCatalog();
  const blocks = answerBlocksCatalog(catalog);
  const cases = {};
  const views = scenarios.map(scenario => ({ id: scenario.id, view: makeView(catalog, scenario.root) }));
  views.push({ id: 'synthetic-300', view: makeView(catalog, syntheticRoot(300)) });
  const blockRoot = { id: 'root', type: 'stack', children: [
    { id: 'title', type: 'heading', text: 'Blocks' },
    { id: 'kpis', type: 'kpi-row', props: { items: [{ label: 'Revenue', value: '1.2M', deltaPercent: 4.5 }, { label: 'Churn', value: '2.1%', deltaPercent: -0.4, goodDirection: 'down', caption: 'Monthly' }] } },
    { id: 'body', type: 'card', children: [{ id: 'plans', type: 'comparison', props: { caption: 'Plan comparison', columns: ['Basic', 'Pro'], rows: [{ label: 'Seats', values: [1, 10] }, { label: 'Support', values: ['Email', 'Priority'] }] } }, { id: 'note', type: 'text', text: 'Compared monthly.' }] },
    { id: 'badblock', type: 'kpi-row', props: { items: [] } }
  ] };
  const blockViews = [{ id: 'blocks', view: makeView(blocks, blockRoot) }, { id: 'blocks-valid', view: makeView(blocks, { ...blockRoot, children: blockRoot.children.slice(0, 3) }) }];
  const variantsOf = (entry, owner) => {
    const list = [{ id: entry.id, view: entry.view }];
    for (const [id, apply] of VIEW_CORRUPTIONS) {
      const copy = clone(entry.view);
      if (apply(copy, owner)) list.push({ id: `${entry.id}/${id}`, view: copy });
    }
    return list;
  };
  const record = (key, input, output) => { cases[key] = [hash(input), hash(output)]; };
  // Catalog edits change expected outputs without being a validation change; report them as inputs.
  record('catalogs', [catalog, blocks], null);

  for (const [owner, entries] of [[catalog, views], [blocks, blockViews]]) for (const entry of entries) for (const variant of variantsOf(entry, owner)) {
    for (const recovery of ['strict', 'isolate']) {
      const first = validateView(variant.view, owner, { recovery });
      record(`validate/${variant.id}/${recovery}`, variant.view, first);
      if (first.ok) record(`revalidate/${variant.id}/${recovery}`, variant.view, validateView(first.value, owner, { recovery }));
    }
    record(`normalize/${variant.id}`, variant.view, validateView(variant.view, owner, { normalize: true }));
    record(`limits/${variant.id}`, variant.view, validateView(variant.view, owner, { limits: { maxNodes: 120, maxDiagnostics: 3 }, recovery: 'isolate' }));
  }

  for (const [owner, entries] of [[catalog, views], [blocks, blockViews]]) for (const entry of entries) for (const recovery of ['strict', 'isolate']) {
    const base = validateView(entry.view, owner, { recovery });
    if (!base.ok) { record(`patch/${entry.id}/${recovery}/base`, entry.view, base); continue; }
    const view = base.value;
    const all = leaves(view.root).filter(node => node.id !== view.root.id);
    const last = all.at(-1);
    const first = all[0];
    const patch = operations => ({ surfaceId: view.surfaceId, expectedRevision: view.revision, operations });
    const patches = {
      'replace-text': [{ op: 'replace', nodeId: last.id, node: { id: last.id, type: 'text', text: 'Changed' } }],
      'replace-invalid': [{ op: 'replace', nodeId: last.id, node: { id: last.id, type: 'stat', props: { label: 'x', value: 3 } } }],
      remove: [{ op: 'remove', nodeId: last.id }],
      'remove-root': [{ op: 'remove', nodeId: view.root.id }],
      insert: [{ op: 'insert', parentId: view.root.id, node: { id: 'patch-new', type: 'text', text: 'New' } }, { op: 'insert', parentId: view.root.id, node: { id: 'patch-new-2', type: 'heading', text: 'Top' }, before: view.root.children[0].id }],
      'insert-duplicate': [{ op: 'insert', parentId: view.root.id, node: { id: first.id, type: 'text', text: 'Dup' } }],
      'insert-anchor-removed': [{ op: 'remove', nodeId: view.root.children.at(-1).id }, { op: 'insert', parentId: view.root.id, node: { id: 'n1', type: 'text', text: 'x' }, after: view.root.children.at(-1).id }],
      overlap: [{ op: 'remove', nodeId: view.root.children[0].id }, { op: 'replace', nodeId: leaves(view.root.children[0])[0].id, node: { id: leaves(view.root.children[0])[0].id, type: 'text', text: 'x' } }],
      missing: [{ op: 'replace', nodeId: 'absent', node: { id: 'absent', type: 'text', text: 'x' } }],
      reserved: [{ op: 'insert', parentId: view.root.id, node: { id: 'iso', type: 'lyra-gen:isolated' } }],
      malformed: [{ op: 'rename', nodeId: last.id }],
    };
    for (const [name, operations] of Object.entries(patches)) record(`patch/${entry.id}/${recovery}/${name}`, [view, operations], applyViewPatch(view, patch(operations), owner, { recovery }));
    record(`patch/${entry.id}/${recovery}/stale`, view, applyViewPatch(view, { ...patch(patches.remove), expectedRevision: view.revision + 1 }, owner, { recovery }));
  }

  const previews = (stream, chunks) => {
    const shown = [];
    for (const chunk of chunks) { const step = stream.push(chunk); if (step.partial) shown.push(step.partial); }
    return { shown, final: stream.finish() };
  };
  for (const [owner, entries] of [[catalog, views], [blocks, blockViews]]) for (const entry of entries) for (const variant of variantsOf(entry, owner)) {
    const json = JSON.stringify(variant.view);
    const markup = encodeMarkup(variant.view);
    const texts = [['clean', json, markup], ...STREAM_CORRUPTIONS.map(([id, apply]) => [id, apply(json), apply(markup)])];
    for (const [label, jsonText, markupText] of texts) {
      const markupOptions = minCodeUnits => ({ catalog: owner, surfaceId: 'bench', revision: 1, allowedTags: Object.keys(owner.components), progressive: { minCodeUnits } });
      record(`json-stream/${variant.id}/${label}`, jsonText, [
        previews(createJsonViewStream({ catalog: owner, progressive: { minCodeUnits: 0 } }), chunkText(jsonText, 23)),
        previews(createJsonViewStream({ catalog: owner, progressive: true }), chunkText(jsonText, 61)),
        previews(createJsonViewStream({ catalog: owner, progressive: { minCodeUnits: 0 }, normalize: true }), chunkText(jsonText, 41)),
        previews(createJsonViewStream({ catalog: owner, progressive: { minCodeUnits: 0 }, limits: { maxNodes: 150, maxDiagnostics: 2 } }), chunkText(jsonText, 41)),
      ]);
      record(`markup-stream/${variant.id}/${label}`, markupText, [
        previews(createProgressiveMarkupParser(markupOptions(0)), chunkText(markupText, 23)),
        previews(createProgressiveMarkupParser(markupOptions(128)), chunkText(markupText, 61)),
      ]);
    }
  }
  return cases;
}

if (process.env.LYRA_GEN_EQUIVALENCE_WRITE === '1') {
  const cases = collect();
  writeFileSync(fixtureUrl, `${JSON.stringify(cases, null, 0).replace(/\],"/gu, '],\n"')}\n`);
  console.log(`wrote ${Object.keys(cases).length} cases`);
} else {
  test('validation, patch and streaming results match the recorded fixture', () => {
    const expected = JSON.parse(readFileSync(fixtureUrl, 'utf8'));
    const actual = collect();
    const inputs = [], outputs = [];
    for (const [key, [input, output]] of Object.entries(expected)) {
      if (!actual[key]) { inputs.push(`${key}: case no longer produced`); continue; }
      if (actual[key][0] !== input) inputs.push(`${key}: input changed`);
      else if (actual[key][1] !== output) outputs.push(key);
    }
    for (const key of Object.keys(actual)) if (!expected[key]) inputs.push(`${key}: new case`);
    assert.deepEqual(inputs, [], 'Benchmark inputs changed; regenerate the fixture only after confirming outputs with the previous build.');
    assert.deepEqual(outputs, []);
    assert.ok(Object.keys(expected).length > 500);
  });
}
