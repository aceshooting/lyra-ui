#!/usr/bin/env node
/**
 * Offline dashboard-generation benchmark harness. No model, provider or network is involved:
 * authored scenarios are encoded four ways and replayed through lyra-gen's own parsers.
 *
 *   node benchmarks/generative-ui/dashboards/run.mjs [--output=report.json] [--markdown=summary.md]
 *        [--samples=5] [--chunk=24] [--scenarios=id,id]
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { dashboardCatalog } from '../../../packages/lyra-gen/dist/catalog.js';
import { summarizeMeasurements } from '../../../packages/lyra-gen/dist/evaluation.js';
import { parseMarkup } from '../../../packages/lyra-gen/dist/parser.js';
import { LyraGenRepairSession, createRepairRequest } from '../../../packages/lyra-gen/dist/repair.js';
import { REPAIRABLE_DIAGNOSTIC_CODES, applyViewPatch, findNode, validateView } from '../../../packages/lyra-gen/dist/runtime.js';
import { STREAM_CORRUPTIONS, VIEW_CORRUPTIONS, corruptView } from './corrupt.mjs';
import { FORMATS, FORMAT_LABELS, applyOperation, chunkText, clone, countNodes, createConsumer, encode, encodeMarkup, encodeStatements, flatten, makeView, materializeFlat, materializeStatements, parseStatement, typeMap, walk } from './encoders.mjs';
import { CATALOG_NOTE, scenarios as allScenarios } from './scenarios.mjs';
import { TOKENIZER_NAME, approximateTokens, bytesBaselineTokens } from './tokens.mjs';

export const REPORT_FORMAT = 'lyra-gen-dashboard-benchmark';
export const REPORT_VERSION = '1';
export const LIMITS = Object.freeze([
  'Offline and synthetic: every scenario is authored by hand, so no model is in the loop and nothing here measures how well any model writes these formats.',
  'Token counts come from the heuristic-v1 approximation (documented in tokens.mjs) and a bytes/4 baseline; they are not provider token counts and were not calibrated against any provider tokenizer.',
  'Times are single-process Node wall-clock samples of the consumer only (parse, partial materialization and validation); they exclude generation, network, rendering and browser work, and vary by machine.',
  'Streaming is replayed in fixed-size chunks with no inter-chunk delay. The lyra-gen JSON and Markup parsers commit only at finish, so their first valid render equals completion by design; the patch and statement consumers are harness-local and admit partial trees.',
  'The statement-language and flat patch-stream encoders are minimal originals written for this comparison; they are not implementations of any third-party grammar and say nothing about those projects.',
  'Repair outcomes use an oracle replacement (the original node), which exercises lyra-gen repair plumbing and scope rules, not the ability of a model to produce a correct fix.',
  'Scenarios cover one catalog (dashboard overlay); results do not generalize to other catalogs, larger dashboards or other content.'
]);

const now = () => performance.now();
const median = (samples) => summarizeMeasurements(samples).median;
const round = (value, digits = 3) => Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
const bytesOf = (text) => new TextEncoder().encode(text).length;

function packageVersion() {
  return JSON.parse(readFileSync(new URL('../../../packages/lyra-gen/package.json', import.meta.url), 'utf8')).version;
}

/** One total-cost pass: consumer time over every chunk and finish, excluding lazy partial builds. */
function parsePass(format, chunks, context) {
  const consumer = createConsumer(format, context);
  let elapsed = 0;
  for (const chunk of chunks) { const start = now(); consumer.push(chunk); elapsed += now() - start; }
  const start = now();
  const result = consumer.finish();
  elapsed += now() - start;
  return { elapsed, result };
}

/** First-valid pass: cumulative consumer time, including partial build and validation, to the first valid tree. */
function firstValidPass(format, chunks, context, totalLength, standaloneValidateMs) {
  const consumer = createConsumer(format, context);
  let elapsed = 0;
  let consumed = 0;
  if (!consumer.partialSupport) {
    const total = parsePass(format, chunks, context);
    const result = total.result;
    const valid = result.status === 'complete';
    return { found: valid, ms: total.elapsed + (result.validatedInside ? 0 : standaloneValidateMs), chunkIndex: chunks.length, byteFraction: 1, nodes: valid ? countNodes(result.view.root) : 0 };
  }
  for (const [index, chunk] of chunks.entries()) {
    const start = now();
    const step = consumer.push(chunk);
    consumed += chunk.length;
    if (step.materialize) {
      const tree = step.materialize();
      if (tree && validateView(tree, context.catalog).ok) {
        elapsed += now() - start;
        return { found: true, ms: elapsed, chunkIndex: index + 1, byteFraction: consumed / totalLength, nodes: countNodes(tree.root) };
      }
    }
    elapsed += now() - start;
    if (step.failed) break;
  }
  return { found: false, ms: null, chunkIndex: null, byteFraction: null, nodes: 0 };
}

function measureFormat(format, view, catalog, options) {
  const text = encode(format, view, catalog);
  const chunks = chunkText(text, options.chunk);
  const context = { catalog, view };
  const total = [];
  const first = [];
  const validate = [];
  let last;
  let firstResult;
  for (let sample = 0; sample < options.samples; sample++) {
    const pass = parsePass(format, chunks, context);
    last = pass.result;
    total.push(pass.elapsed);
    const checkedStart = now();
    if (last.view) validateView(last.view, catalog);
    validate.push(now() - checkedStart);
    firstResult = firstValidPass(format, chunks, context, text.length, median(validate));
    first.push(firstResult.ms ?? 0);
  }
  const final = last.view ? validateView(last.view, catalog) : undefined;
  const parseMs = median(total);
  const validateMs = median(validate);
  return {
    format,
    utf8Bytes: bytesOf(text),
    utf16CodeUnits: text.length,
    approxTokens: approximateTokens(text),
    approxTokensBytesBaseline: bytesBaselineTokens(text),
    chunks: chunks.length,
    stream: {
      finalStatus: last.status,
      diagnosticCodes: last.codes,
      valid: Boolean(final?.ok),
      roundTripEqual: Boolean(last.view) && isDeepStrictEqual(clone(last.view.root), clone(view.root)),
      partialRenderSupported: createConsumer(format, context).partialSupport
    },
    timing: {
      samples: options.samples,
      parseMs: round(parseMs),
      validateMs: round(validateMs),
      endToEndMs: round(parseMs + (last.validatedInside ? 0 : validateMs)),
      validationIncludedInParse: Boolean(last.validatedInside),
      firstValidRenderMs: firstResult.found ? round(median(first)) : null,
      firstValidChunk: firstResult.chunkIndex,
      firstValidByteFraction: firstResult.found ? round(firstResult.byteFraction, 4) : null,
      nodesAtFirstValid: firstResult.nodes,
      totalNodes: countNodes(view.root)
    }
  };
}

/* -------------------------------------------------------------- corrupted variants */
function topmostIds(view, diagnostics) {
  const ids = new Set();
  for (const diagnostic of diagnostics) {
    let node;
    const segments = diagnostic.path.split('/').slice(1);
    if (segments[0] === 'root') node = view.root; else continue;
    let deepest = node?.id;
    for (let index = 1; index < segments.length && node; index++) {
      if (segments[index] === 'children') { node = node.children?.[Number(segments[index + 1])]; index++; if (node?.id) deepest = node.id; }
      else break;
    }
    if (deepest) ids.add(deepest);
  }
  const all = [...ids];
  const covered = (id) => all.some(other => other !== id && findNode(view, other) && [...walk(findNode(view, other))].some(node => node.id === id));
  return all.filter(id => !covered(id));
}

function repairViewCorruption(original, corrupted, catalog) {
  const strict = validateView(corrupted, catalog);
  const errors = strict.diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  const isolateResult = validateView(corrupted, catalog, { recovery: 'isolate' });
  const outcome = { strict: { accepted: strict.ok, errorCodes: [...new Set(errors.map(d => d.code))] }, isolate: { accepted: isolateResult.ok, isolatedSubtrees: isolateResult.ok ? (isolateResult.isolated?.length ?? 0) : null }, repair: { outcome: 'not-needed', attempts: 0 } };
  if (strict.ok) { outcome.repair.outcome = 'corruption-not-detected'; return outcome; }
  if (errors.some(diagnostic => !REPAIRABLE_DIAGNOSTIC_CODES.includes(diagnostic.code))) { outcome.repair.outcome = 'refused-nonrepairable-diagnostic'; return outcome; }
  const ids = topmostIds(corrupted, errors);
  if (!ids.length) { outcome.repair.outcome = 'no-node-scope'; return outcome; }
  const request = createRepairRequest(corrupted, ids, errors);
  if (!request.ok) { outcome.repair.outcome = `refused-${request.diagnostics[0].code}`; return outcome; }
  const originals = ids.map(id => findNode(original, id));
  if (originals.some(node => !node)) { outcome.repair.outcome = 'no-oracle-node'; return outcome; }
  const session = new LyraGenRepairSession(request.value);
  const patch = { surfaceId: corrupted.surfaceId, expectedRevision: corrupted.revision, operations: ids.map((id, index) => ({ op: 'replace', nodeId: id, node: originals[index] })) };
  const tokens = approximateTokens(JSON.stringify(patch));
  const applied = session.apply(corrupted, patch, catalog, tokens);
  outcome.repair = { outcome: applied.ok ? 'repaired' : `failed-${applied.diagnostics[0]?.code ?? 'unknown'}`, attempts: session.attempts, scopedNodes: ids.length, patchApproxTokens: tokens };
  return outcome;
}

function streamCorruption(format, view, catalog, corruption, options) {
  const text = corruption.apply(encode(format, view, catalog));
  const consumer = createConsumer(format, { catalog, view });
  let lastValidNodes = 0;
  let failureCode = null;
  for (const chunk of chunkText(text, options.chunk)) {
    const step = consumer.push(chunk);
    if (step.failed) { failureCode = step.failed; break; }
    if (step.materialize) { const tree = step.materialize(); if (tree && validateView(tree, catalog).ok) lastValidNodes = countNodes(tree.root); }
  }
  const result = failureCode ? { status: 'error', codes: [failureCode] } : consumer.finish();
  const checked = result.view ? validateView(result.view, catalog) : undefined;
  return { finalStatus: result.status, diagnosticCodes: result.codes, acceptedAsValid: Boolean(checked?.ok), lastValidPartialNodes: lastValidNodes, totalNodes: countNodes(view.root) };
}

/* -------------------------------------------------------------- refinement deltas */
function insertAfter(view, refinement) {
  const next = clone(view);
  const parent = findNode(next, refinement.parentId);
  const index = parent.children.findIndex(child => child.id === refinement.afterId) + 1;
  parent.children.splice(index, 0, clone(refinement.node));
  return { next: { ...next, revision: view.revision }, index };
}
function measureRefinement(scenario, base, catalog) {
  const { refinement } = scenario;
  const { next: refined, index } = insertAfter(base, refinement);
  const entry = (text, ok, extra = {}) => ({ utf8Bytes: bytesOf(text), approxTokens: approximateTokens(text), reproducesRefinedView: ok, ...extra });
  const full = Object.fromEntries(FORMATS.map(format => { const text = encode(format, refined, catalog); return [format, { utf8Bytes: bytesOf(text), approxTokens: approximateTokens(text) }]; }));
  const delta = {};
  // json: a lyra-gen insert patch applied with applyViewPatch.
  const patch = { surfaceId: base.surfaceId, expectedRevision: base.revision, operations: [{ op: 'insert', parentId: refinement.parentId, node: refinement.node, after: refinement.afterId }] };
  const patched = applyViewPatch(base, patch, catalog);
  delta.json = entry(JSON.stringify(patch), patched.ok && isDeepStrictEqual(clone(patched.value.root), clone(refined.root)), { shape: 'lyra-gen insert patch' });
  // markup: no patch syntax exists; the delta is the new fragment plus a host-side placement instruction.
  const fragment = encodeMarkup({ root: refinement.node });
  const parsedFragment = parseMarkup(fragment, { catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'fragment', revision: 0, allowedTags: Object.keys(catalog.components) });
  const spliced = parsedFragment.view ? applyViewPatch(base, { surfaceId: base.surfaceId, expectedRevision: base.revision, operations: [{ op: 'insert', parentId: refinement.parentId, node: parsedFragment.view.root, after: refinement.afterId }] }, catalog) : undefined;
  delta.markup = entry(fragment, Boolean(spliced?.ok) && isDeepStrictEqual(clone(spliced.value.root), clone(refined.root)), { shape: 'fragment only; placement is a host-side instruction outside the format' });
  // json-patch: add the element entries, then add the id into the parent child list.
  const flatState = flatten(base);
  const state = { root: flatState.root, elements: clone(flatState.elements) };
  const added = flatten({ root: refinement.node });
  const operations = [...added.order.map(id => ({ op: 'add', path: `/elements/${id}`, value: added.elements[id] })), { op: 'add', path: `/elements/${refinement.parentId}/children/${index}`, value: refinement.node.id }];
  for (const operation of operations) applyOperation(state, operation);
  const patchText = `${operations.map(operation => JSON.stringify(operation)).join('\n')}\n`;
  delta['json-patch'] = entry(patchText, isDeepStrictEqual(clone(materializeFlat(state)), clone(refined.root)), { shape: 'RFC 6902 operations' });
  // statements: new statements plus the re-emitted parent statement (positional child list).
  const names = typeMap(catalog);
  const definitions = new Map();
  for (const line of encodeStatements(base, catalog).trim().split('\n')) { const { node, children } = parseStatement(line, catalog, names); definitions.set(node.id, { node, children }); }
  const parent = findNode(refined, refinement.parentId);
  const newText = encodeStatements({ root: refinement.node }, catalog);
  const parentText = encodeStatements({ root: { ...parent, children: parent.children.map(child => ({ ...child, children: undefined })) } }, catalog).split('\n')[0];
  const patchedDefinitions = new Map(definitions);
  for (const line of [parentText, ...newText.trim().split('\n')]) { const { node, children } = parseStatement(line, catalog, names); patchedDefinitions.set(node.id, { node, children }); }
  const rebuilt = materializeStatements(patchedDefinitions);
  delta.statements = entry(`${parentText}\n${newText}`, isDeepStrictEqual(clone(rebuilt), clone(refined.root)), { shape: 'new statements plus the re-emitted parent statement' });
  return { insertion: { parentId: refinement.parentId, afterId: refinement.afterId, newNodes: countNodes(refinement.node) }, fullRegeneration: full, delta };
}

/* -------------------------------------------------------------- orchestration */
export function runBenchmark(options = {}) {
  const settings = { samples: options.samples ?? 5, chunk: options.chunk ?? 24, scenarios: options.scenarios };
  assert.ok(Number.isInteger(settings.samples) && settings.samples >= 1, 'samples must be a positive integer');
  assert.ok(Number.isInteger(settings.chunk) && settings.chunk >= 1, 'chunk must be a positive integer');
  const catalog = dashboardCatalog();
  const chosen = settings.scenarios ? allScenarios.filter(scenario => settings.scenarios.includes(scenario.id)) : allScenarios;
  assert.ok(chosen.length > 0, 'no scenarios selected');
  const results = chosen.map(scenario => {
    const view = makeView(catalog, scenario.root);
    const baseline = validateView(view, catalog);
    assert.ok(baseline.ok, `scenario ${scenario.id} is not valid: ${JSON.stringify(baseline.diagnostics.slice(0, 3))}`);
    const formats = Object.fromEntries(FORMATS.map(format => [format, measureFormat(format, view, catalog, settings)]));
    const viewCorruptions = VIEW_CORRUPTIONS.map(corruption => {
      const corrupted = corruptView(view, corruption, catalog);
      return corrupted ? { id: corruption.id, applicable: true, targetNodeId: corrupted.target, ...repairViewCorruption(view, corrupted.view, catalog) } : { id: corruption.id, applicable: false };
    });
    const streamCorruptions = STREAM_CORRUPTIONS.map(corruption => ({ id: corruption.id, formats: Object.fromEntries(FORMATS.map(format => [format, streamCorruption(format, view, catalog, corruption, settings)])) }));
    return { id: scenario.id, title: scenario.title, nodes: countNodes(view.root), formats, viewCorruptions, streamCorruptions, ...(scenario.refinement ? { refinement: measureRefinement(scenario, view, catalog) } : {}) };
  });
  const totals = Object.fromEntries(FORMATS.map(format => {
    const rows = results.map(result => result.formats[format]);
    const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
    return [format, { utf8Bytes: sum('utf8Bytes'), approxTokens: sum('approxTokens'), approxTokensBytesBaseline: sum('approxTokensBytesBaseline'), allStreamsValid: rows.every(row => row.stream.valid), allRoundTripsEqual: rows.every(row => row.stream.roundTripEqual), medianEndToEndMs: round(median(rows.map(row => row.timing.endToEndMs))), medianFirstValidRenderMs: round(median(rows.map(row => row.timing.firstValidRenderMs ?? row.timing.endToEndMs))), medianFirstValidByteFraction: round(median(rows.map(row => row.timing.firstValidByteFraction ?? 1)), 4) }];
  }));
  const repairCounts = {};
  for (const result of results) for (const corruption of result.viewCorruptions) if (corruption.applicable) repairCounts[corruption.repair.outcome] = (repairCounts[corruption.repair.outcome] ?? 0) + 1;
  return {
    format: REPORT_FORMAT, version: REPORT_VERSION,
    boundary: 'offline, synthetic, no model in the loop',
    limits: LIMITS,
    environment: { node: process.version, platform: process.platform, arch: process.arch, lyraGenVersion: packageVersion() },
    settings: { samples: settings.samples, chunkCodeUnits: settings.chunk, catalog: { id: catalog.id, version: catalog.version, note: CATALOG_NOTE }, tokenizer: { name: TOKENIZER_NAME, kind: 'approximation, not a provider tokenizer' }, formats: FORMATS.map(id => ({ id, label: FORMAT_LABELS[id] })) },
    scenarios: results,
    totals,
    repairOutcomeCounts: repairCounts
  };
}

/* -------------------------------------------------------------- markdown */
const cell = (value) => value === null || value === undefined ? 'n/a' : String(value);
export function renderMarkdown(report) {
  const out = [];
  const formats = report.settings.formats;
  out.push('# Dashboard generation benchmark (offline)', '', `Boundary: **${report.boundary}**. Catalog \`${report.settings.catalog.id}\`, lyra-gen ${report.environment.lyraGenVersion}, Node ${report.environment.node}, ${report.settings.samples} sample(s), ${report.settings.chunkCodeUnits}-code-unit chunks, tokenizer \`${report.settings.tokenizer.name}\` (approximation).`, '');
  out.push('## Limits', '', ...report.limits.map(limit => `- ${limit}`), '');
  out.push('## Totals across scenarios', '', '| Format | UTF-8 bytes | Approx tokens | Tokens vs JSON | Median first valid render ms | Median first valid byte fraction | End-to-end ms (median) | All valid | Round-trip equal |', '|---|---:|---:|---:|---:|---:|---:|:-:|:-:|');
  const jsonTokens = report.totals.json.approxTokens;
  for (const format of formats) { const t = report.totals[format.id]; out.push(`| ${format.label} | ${t.utf8Bytes} | ${t.approxTokens} | ${(t.approxTokens / jsonTokens).toFixed(2)}x | ${t.medianFirstValidRenderMs} | ${t.medianFirstValidByteFraction} | ${t.medianEndToEndMs} | ${t.allStreamsValid ? 'yes' : 'no'} | ${t.allRoundTripsEqual ? 'yes' : 'no'} |`); }
  out.push('', '## Per scenario: bytes / approx tokens / first valid render ms (byte fraction)', '', `| Scenario | Nodes | ${formats.map(f => f.id).join(' | ')} |`, `|---|---:|${formats.map(() => '---').join('|')}|`);
  for (const scenario of report.scenarios) out.push(`| ${scenario.id} | ${scenario.nodes} | ${formats.map(f => { const r = scenario.formats[f.id]; return `${r.utf8Bytes} B / ${r.approxTokens} t / ${cell(r.timing.firstValidRenderMs)} ms (${cell(r.timing.firstValidByteFraction)})`; }).join(' | ')} |`);
  out.push('', '## Corrupted views: strict validation, isolation and oracle repair', '', '| Scenario | Corruption | Strict error codes | Isolate | Repair outcome |', '|---|---|---|---|---|');
  for (const scenario of report.scenarios) for (const c of scenario.viewCorruptions) if (c.applicable) out.push(`| ${scenario.id} | ${c.id} | ${c.strict.errorCodes.join(', ') || 'none'} | ${c.isolate.accepted ? `accepted, ${c.isolate.isolatedSubtrees} isolated` : 'rejected'} | ${c.repair.outcome} |`);
  out.push('', `Repair outcome counts: ${Object.entries(report.repairOutcomeCounts).map(([key, count]) => `${key}=${count}`).join(', ')}.`, '');
  out.push('## Damaged streams: result per format', '', `| Scenario | Damage | ${formats.map(f => f.id).join(' | ')} |`, `|---|---|${formats.map(() => '---').join('|')}|`);
  for (const scenario of report.scenarios) for (const damage of scenario.streamCorruptions) out.push(`| ${scenario.id} | ${damage.id} | ${formats.map(f => { const r = damage.formats[f.id]; return `${r.finalStatus}${r.acceptedAsValid ? ' (valid)' : ''}, ${r.lastValidPartialNodes}/${r.totalNodes} nodes valid early`; }).join(' | ')} |`);
  const refined = report.scenarios.filter(scenario => scenario.refinement);
  if (refined.length) {
    out.push('', '## Refinement: delta versus full regeneration', '');
    for (const scenario of refined) {
      out.push(`Scenario \`${scenario.id}\` inserts ${scenario.refinement.insertion.newNodes} node(s).`, '', '| Format | Full bytes | Delta bytes | Delta approx tokens | Reproduces refined view | Delta shape |', '|---|---:|---:|---:|:-:|---|');
      for (const format of formats) { const d = scenario.refinement.delta[format.id]; out.push(`| ${format.label} | ${scenario.refinement.fullRegeneration[format.id].utf8Bytes} | ${d.utf8Bytes} | ${d.approxTokens} | ${d.reproducesRefinedView ? 'yes' : 'no'} | ${d.shape} |`); }
    }
  }
  return `${out.join('\n')}\n`;
}

/* -------------------------------------------------------------- CLI */
function parseArguments(argv) {
  const parsed = { samples: 5, chunk: 24 };
  for (const argument of argv) {
    const [key, value] = argument.startsWith('--') ? argument.slice(2).split(/=(.*)/su) : [];
    if (key === 'output' || key === 'markdown') parsed[key] = value;
    else if (key === 'samples' || key === 'chunk') parsed[key] = Number(value);
    else if (key === 'scenarios') parsed.scenarios = value.split(',').filter(Boolean);
    else throw new Error(`Unknown argument ${argument}`);
  }
  return parsed;
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const cli = parseArguments(process.argv.slice(2));
  for (const path of [cli.output, cli.markdown]) if (path && existsSync(path)) throw new Error(`Refusing to overwrite ${path}`);
  const report = runBenchmark(cli);
  const markdown = renderMarkdown(report);
  if (cli.output) writeFileSync(cli.output, `${JSON.stringify(report, null, 2)}\n`);
  if (cli.markdown) writeFileSync(cli.markdown, markdown);
  if (!cli.output && !cli.markdown) process.stdout.write(markdown);
  else console.log(`Wrote ${[cli.output, cli.markdown].filter(Boolean).join(' and ')}`);
}
