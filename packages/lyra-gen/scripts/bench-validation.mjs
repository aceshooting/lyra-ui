#!/usr/bin/env node
/**
 * Validation, patch and streaming-preview timings over the built package.
 *
 *   node scripts/bench-validation.mjs [--dist <directory>] [--runs <count>]
 *
 * Prints one median (milliseconds) per workload: the 13 dashboard benchmark views, synthetic views
 * of 500 and 2000 nodes (first validation, re-validation of the validated value, one replace and 100
 * inserts through `applyViewPatch`), and progressive JSON and Markup streams of a 500-node view in
 * 64-code-unit chunks (total and slowest single push).
 */
import { realpathSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const makeView = (catalog, root) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'bench', revision: 1, root });

/** Rows of four mixed panels (stat, gauge with a live read, chart, table, text). */
export function syntheticRoot(nodes) {
  const rows = [];
  let index = 0;
  const panel = () => {
    const k = index++;
    switch (k % 5) {
      case 0: return { id: `s${k}`, type: 'stat', props: { label: `Metric ${k}`, value: String(k * 17), unit: 'EUR', deltaPercent: 1.5, goodDirection: 'up', variant: 'success' } };
      case 1: return { id: `g${k}`, type: 'gauge', props: { label: `Gauge ${k}`, value: k % 100, min: 0, max: 100, valueText: `${k % 100}%`, thresholds: [{ at: 0, variant: 'success' }, { at: 70, variant: 'warning' }, { at: 90, variant: 'danger' }] }, liveReads: { value: `/m/${k}` } };
      case 2: return { id: `c${k}`, type: 'chart', props: { label: `Chart ${k}`, type: 'line', labels: ['a', 'b', 'c', 'd', 'e', 'f'], datasets: [{ label: 'x', data: [1, 2, 3, 4, 5, 6] }, { label: 'y', data: [6, 5, 4, 3, 2, 1] }] } };
      case 3: return { id: `t${k}`, type: 'table', props: { caption: `Table ${k}`, columns: [{ key: 'c0', label: 'A', sortable: false }, { key: 'c1', label: 'B', sortable: true }], rows: Array.from({ length: 6 }, (_, row) => ({ c0: `row ${row}`, c1: row * k })) } };
      default: return { id: `x${k}`, type: 'text', text: `Paragraph ${k} with some explanatory prose about the panel above.` };
    }
  };
  while (index < nodes - 1) {
    const row = { id: `r${rows.length}`, type: 'row', children: [] };
    index++;
    for (let column = 0; column < 4 && index < nodes; column++) row.children.push(panel());
    rows.push(row);
  }
  return { id: 'root', type: 'stack', children: rows };
}

const escapeText = value => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const escapeAttribute = value => escapeText(value).replace(/"/gu, '&quot;');
function markupNode(node, depth) {
  const pad = '  '.repeat(depth);
  const attributes = [`id="${escapeAttribute(node.id)}"`];
  for (const [key, value] of Object.entries(node.props ?? {})) attributes.push(typeof value === 'string' ? `${key}="${escapeAttribute(value)}"` : `${key}={${JSON.stringify(value)}}`);
  if (typeof node.slot === 'string') attributes.push(`slot="${escapeAttribute(node.slot)}"`);
  for (const key of ['bindings', 'reads', 'liveReads', 'action']) if (node[key] !== undefined) attributes.push(`${key}={${JSON.stringify(node[key])}}`);
  const open = `<${node.type} ${attributes.join(' ')}`;
  if (node.children?.length) return `${pad}${open}>\n${node.children.map(child => markupNode(child, depth + 1)).join('\n')}\n${pad}</${node.type}>`;
  if (typeof node.text === 'string' && node.text.length) return `${pad}${open}>${escapeText(node.text)}</${node.type}>`;
  return `${pad}${open} />`;
}
/** The dashboard benchmark's Markup encoding of a view. */
export const encodeMarkup = view => markupNode(view.root, 0);

/** Fixed-size chunks of UTF-16 code units that never split a surrogate pair. */
export function chunkText(text, size) {
  const chunks = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + size);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end++;
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

const median = (run, runs, warmup = 3) => {
  for (let index = 0; index < warmup; index++) run();
  const samples = [];
  for (let index = 0; index < runs; index++) { const start = performance.now(); run(); samples.push(performance.now() - start); }
  samples.sort((left, right) => left - right);
  return samples[runs >> 1];
};

async function runBench({ dist = new URL('../dist/', import.meta.url), runs = 15 } = {}) {
  const load = name => import(new URL(name, dist).href);
  const { dashboardCatalog } = await load('catalog.js');
  const { validateView, applyViewPatch } = await load('runtime.js');
  const { createProgressiveMarkupParser } = await load('progressive.js');
  const { createJsonViewStream } = await load('json-stream.js');
  const { scenarios } = await import('../../../benchmarks/generative-ui/dashboards/scenarios.mjs');
  const catalog = dashboardCatalog();
  const limits = { limits: { maxNodes: 100_000, maxBytes: 4_194_304 } };
  const out = {};
  const views = scenarios.map(scenario => makeView(catalog, scenario.root));
  out['13 dashboards: validate all'] = median(() => views.forEach(view => validateView(view, catalog)), runs * 2);
  for (const nodes of [500, 2000]) {
    const input = makeView(catalog, syntheticRoot(nodes));
    const checked = validateView(input, catalog, limits);
    if (!checked.ok) throw new Error(`synthetic ${nodes} is invalid: ${JSON.stringify(checked.diagnostics)}`);
    const base = checked.value;
    const patch = operations => ({ surfaceId: base.surfaceId, expectedRevision: base.revision, operations });
    const replace = patch([{ op: 'replace', nodeId: 'x4', node: { id: 'x4', type: 'text', text: 'changed' } }]);
    const inserts = patch(Array.from({ length: 100 }, (_, index) => ({ op: 'insert', parentId: `r${index}`, node: { id: `new${index}`, type: 'text', text: 'x' } })));
    out[`${nodes} nodes: validate`] = median(() => validateView(input, catalog, limits), runs);
    out[`${nodes} nodes: re-validate validated value`] = median(() => validateView(base, catalog, limits), runs);
    out[`${nodes} nodes: patch 1 replace`] = median(() => applyViewPatch(base, replace, catalog, limits), runs);
    out[`${nodes} nodes: patch 100 inserts`] = median(() => applyViewPatch(base, inserts, catalog, limits), runs);
  }
  const view = makeView(catalog, syntheticRoot(500));
  const json = chunkText(JSON.stringify(view), 64);
  const markup = chunkText(encodeMarkup(view), 64);
  const stream = (open, chunks, label) => {
    let slowest = 0;
    out[`500 nodes: progressive ${label} total`] = median(() => {
      const parser = open();
      slowest = 0;
      for (const chunk of chunks) { const start = performance.now(); parser.push(chunk); slowest = Math.max(slowest, performance.now() - start); }
      parser.finish();
    }, Math.max(5, runs >> 1));
    out[`500 nodes: progressive ${label} slowest push`] = slowest;
  };
  stream(() => createJsonViewStream({ catalog, progressive: true, ...limits }), json, 'JSON');
  stream(() => createProgressiveMarkupParser({ catalog, surfaceId: view.surfaceId, revision: view.revision, allowedTags: Object.keys(catalog.components), progressive: {} }), markup, 'Markup');
  return out;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const argument = name => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };
  const directory = argument('--dist');
  const results = await runBench({ ...(directory ? { dist: pathToFileURL(`${directory.replace(/\/$/u, '')}/`) } : {}), runs: Number(argument('--runs') ?? 15) });
  const width = Math.max(...Object.keys(results).map(key => key.length));
  for (const [name, value] of Object.entries(results)) console.log(`${name.padEnd(width)}  ${value.toFixed(2).padStart(9)} ms`);
}
