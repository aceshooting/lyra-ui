import { validateView } from './runtime.js';
import { snapshotJson } from './schema.js';
import { reviewedExamples } from './catalogs/examples.js';
import { catalogPresetNames, catalogPresets, initialCatalog } from './catalog.js';
import type { JsonObject, LyraGenCatalog, LyraGenCatalogReference, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';

export type LyraGenExampleTask = 'summary' | 'form' | 'data' | 'retrieval';
export interface LyraGenExample {
  readonly id: string;
  readonly task: LyraGenExampleTask;
  readonly request: string;
  readonly root: LyraGenNode;
}
export interface LyraGenExampleLibrary {
  readonly format: 'lyra-gen-example-library';
  readonly version: '1';
  readonly catalog: LyraGenCatalogReference;
  readonly examples: readonly LyraGenExample[];
}
export interface LyraGenSelectedExample {
  readonly id: string;
  readonly task: LyraGenExampleTask;
  readonly request: string;
  readonly view: LyraGenView;
}
export interface LyraGenExampleArtifact {
  readonly format: 'lyra-gen-examples';
  readonly version: '1';
  readonly libraryVersion: '1';
  readonly catalog: LyraGenCatalogReference;
  readonly task: LyraGenExampleTask;
  readonly examples: readonly LyraGenSelectedExample[];
}
export interface LyraGenSelectedExamples {
  readonly artifact: LyraGenExampleArtifact;
  /** Deterministic JSON source suitable for a host-owned prompt or portable artifact. */
  readonly source: string;
  readonly bytes: number;
}
export interface LyraGenExampleOptions {
  /** Zero selects a no-example baseline. Positive values are capped at three. */
  readonly maxExamples?: number;
  /** UTF-8 bytes of the complete serialized artifact, capped at 16384. */
  readonly maxBytes?: number;
}

const authored: LyraGenExampleLibrary = {
  format: 'lyra-gen-example-library', version: '1', catalog: { id: 'lyra-reviewed', version: '1' },
  examples: [
    { id: 'summary-brief', task: 'summary', request: 'Give a brief plain-text explanation.',
      root: reviewedExamples['text']!.example },
    { id: 'summary-grouped', task: 'summary', request: 'Group a short report summary.',
      root: reviewedExamples['stack']!.example },
    { id: 'form-preferences', task: 'form', request: 'Show a named preferences form without submitting or sending data.',
      root: reviewedExamples['form']!.example },
    { id: 'data-chart', task: 'data', request: 'Show raw numeric orders and a missing observation in a labelled chart.',
      root: reviewedExamples['chart']!.example },
    { id: 'data-table', task: 'data', request: 'Show inventory names and raw counts, retaining a missing count.',
      root: reviewedExamples['table']!.example },
    { id: 'retrieval-query', task: 'retrieval', request: 'Show a named source-search control without assuming access to a source.',
      root: reviewedExamples['search']!.example },
  ],
};
const admitted = snapshotJson(authored);
if (!admitted.ok) throw new TypeError('The authored example library must contain bounded plain JSON.');
/** Original versioned examples contain no actions, bindings, URLs or data-source permissions. */
export const exampleLibrary = admitted.value as unknown as LyraGenExampleLibrary;

const tasks: readonly LyraGenExampleTask[] = Object.freeze(['summary', 'form', 'data', 'retrieval']);
const failure = <T>(code: string, message: string): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, path: '', message, severity: 'error' }] });
const encoder = new TextEncoder();
// Compatibility is explicit for the built-in reviewed catalog family. Role/schema validation
// below still applies to every candidate; a matching ID never broadens the active catalog.
const reviewedTargets: readonly LyraGenCatalogReference[] = Object.freeze([
  exampleLibrary.catalog,
  ...(initialCatalog.id === exampleLibrary.catalog.id && initialCatalog.version === exampleLibrary.catalog.version
    ? catalogPresetNames.map(name => ({ id: catalogPresets[name].id, version: catalogPresets[name].version })) : []),
]);

/** Select only complete examples that validate against this request's existing catalog subset. */
export function selectExamples(catalog: LyraGenCatalog, task: LyraGenExampleTask, options: LyraGenExampleOptions = {}): LyraGenResult<LyraGenSelectedExamples> {
  if (!tasks.includes(task)) return failure('examples.task', 'The requested example task is not supported.');
  if (!reviewedTargets.some(target => target.id === catalog.id && target.version === catalog.version)) return failure('examples.catalog', 'This example library does not target the active catalog version.');
  const count = options.maxExamples ?? 2;
  const bytes = options.maxBytes ?? 8_192;
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(bytes) || bytes < 1) return failure('examples.budget', 'Example limits must be finite safe integers.');
  const maxExamples = Math.min(count, 3);
  const maxBytes = Math.min(bytes, 16_384);
  const selected: LyraGenSelectedExample[] = [];
  const artifact = (): LyraGenExampleArtifact => ({ format: 'lyra-gen-examples', version: '1', libraryVersion: exampleLibrary.version,
    catalog: { id: catalog.id, version: catalog.version }, task, examples: selected });
  if (encoder.encode(JSON.stringify(artifact())).byteLength > maxBytes) return failure('examples.budget', 'The example envelope exceeds its byte budget.');
  for (const example of [...exampleLibrary.examples].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)) {
    if (selected.length >= maxExamples) break;
    if (example.task !== task) continue;
    const checked = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version },
      surfaceId: `example:${example.id}`, revision: 0, root: example.root }, catalog);
    if (!checked.ok) continue;
    selected.push({ id: example.id, task: example.task, request: example.request, view: checked.value });
    if (encoder.encode(JSON.stringify(artifact())).byteLength > maxBytes) selected.pop();
  }
  const owned = snapshotJson(artifact(), { maxBytes });
  if (!owned.ok) return owned;
  const source = JSON.stringify(owned.value);
  return { ok: true, value: Object.freeze({ artifact: owned.value as unknown as LyraGenExampleArtifact,
    source, bytes: encoder.encode(source).byteLength }), diagnostics: [] };
}

export interface LyraGenExampleAblation {
  readonly format: 'lyra-gen-example-ablation';
  readonly version: '1';
  readonly measured: false;
  readonly catalog: LyraGenCatalogReference;
  readonly metrics: readonly ['semantic-validity', 'input-tokens', 'output-tokens', 'latency-ms'];
  readonly cases: readonly { readonly task: LyraGenExampleTask; readonly withoutExamples: LyraGenExampleArtifact; readonly withExamples: LyraGenExampleArtifact }[];
}

/** A paired offline campaign configuration. The host must approve/configure any later model calls. */
export function createExampleAblation(catalog: LyraGenCatalog, selectedTasks: readonly LyraGenExampleTask[], options: LyraGenExampleOptions = {}): LyraGenResult<LyraGenExampleAblation> {
  const input = snapshotJson(selectedTasks, { maxArrayLength: 16, maxStringLength: 16 });
  if (!input.ok) return input;
  if (!Array.isArray(input.value) || input.value.length === 0 || input.value.some(task => typeof task !== 'string' || !tasks.includes(task as LyraGenExampleTask))) return failure('examples.task', 'Ablation tasks must name at least one supported scenario type.');
  const cases: { task: LyraGenExampleTask; withoutExamples: LyraGenExampleArtifact; withExamples: LyraGenExampleArtifact }[] = [];
  for (const task of [...new Set(input.value as LyraGenExampleTask[])].sort()) {
    const without = selectExamples(catalog, task, { ...options, maxExamples: 0 });
    if (!without.ok) return without;
    const withExamples = selectExamples(catalog, task, options);
    if (!withExamples.ok) return withExamples;
    cases.push({ task, withoutExamples: without.value.artifact, withExamples: withExamples.value.artifact });
  }
  const config: LyraGenExampleAblation = { format: 'lyra-gen-example-ablation', version: '1', measured: false,
    catalog: { id: catalog.id, version: catalog.version }, metrics: ['semantic-validity', 'input-tokens', 'output-tokens', 'latency-ms'], cases };
  const owned = snapshotJson(config, { maxBytes: 65_536 });
  return owned.ok ? { ok: true, value: owned.value as unknown as LyraGenExampleAblation, diagnostics: [] } : owned;
}

/** Portable library source contains only authored JSON; it never serializes trusted catalog loaders. */
export function exportExampleLibrary(): JsonObject { return exampleLibrary as unknown as JsonObject; }
