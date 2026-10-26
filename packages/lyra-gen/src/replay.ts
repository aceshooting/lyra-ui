import { parseJson, snapshotJson } from './schema.js';
import { parseMarkup } from './parser.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenCatalogReference, LyraGenDiagnostic, LyraGenResult, LyraGenView } from './types.js';

export type GeneratedFormat = 'json' | 'markup';
export interface ReplayTimings {
  readonly firstChunkMs: number | null;
  readonly completedMs: number | null;
  readonly parseMs: number | null;
  readonly validateMs: number | null;
  readonly renderMs: number | null;
}
export interface ReplayRecord {
  readonly version: '1';
  readonly source: { readonly kind: 'fixture' | 'provider' | 'file'; readonly id: string };
  readonly model: { readonly provider: string; readonly id: string } | null;
  readonly package: { readonly name: string; readonly version: string };
  readonly catalog: LyraGenCatalogReference;
  readonly format: GeneratedFormat;
  readonly text: string;
  readonly surfaceId: string;
  readonly revision: number;
  readonly timings: ReplayTimings;
}
export interface CreateReplayOptions extends Omit<ReplayRecord, 'version' | 'timings'> {
  readonly timings?: Partial<ReplayTimings>;
}
export interface ReplayChunk {
  /** Original offset from recording start, in milliseconds; never a provider latency claim. */
  readonly atMs: number;
  readonly text: string;
}
/** Authored text and its frozen synthetic cadence. No provider recording is implied. */
export interface ReplayRecording {
  readonly version: '1';
  readonly recordingKind: 'authored-synthetic';
  readonly source: { readonly kind: 'fixture'; readonly id: string };
  readonly model: null;
  readonly package: { readonly name: string; readonly version: string };
  readonly catalog: LyraGenCatalogReference;
  readonly format: GeneratedFormat | 'chat';
  readonly text: string;
  readonly chunks: readonly ReplayChunk[];
}
const MAX_SOURCE_BYTES = 262144;
const unknownTimings: ReplayTimings = { firstChunkMs: null, completedMs: null, parseMs: null, validateMs: null, renderMs: null };
function diagnostic(code: string, message: string): LyraGenDiagnostic {
  return { code, message, path: '', severity: 'error' };
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function pair(value: unknown, keys: readonly [string, string]): boolean {
  return object(value) && exact(value, keys) && keys.every(key => typeof value[key] === 'string' && (value[key] as string).length > 0 && (value[key] as string).length <= 1024);
}

/** Admit only bounded plain JSON; accessors and undeclared metadata are never persisted. */
export function parseReplayRecording(input: unknown): LyraGenResult<ReplayRecording> {
  const admitted = snapshotJson(input, { maxBytes: 4194304, maxDepth: 5, maxNodes: 4096, maxArrayLength: 1024, maxObjectKeys: 12, maxStringLength: MAX_SOURCE_BYTES });
  if (!admitted.ok) return admitted;
  input = admitted.value;
  const fail = (): LyraGenResult<ReplayRecording> => ({ ok: false, diagnostics: [diagnostic('replay.recording', 'Invalid or unsupported chunk recording.')] });
  if (!object(input) || !exact(input, ['version', 'recordingKind', 'source', 'model', 'package', 'catalog', 'format', 'text', 'chunks'])
    || input['version'] !== '1' || input['recordingKind'] !== 'authored-synthetic' || input['model'] !== null
    || !object(input['source']) || !exact(input['source'], ['kind', 'id']) || input['source']['kind'] !== 'fixture'
    || typeof input['source']['id'] !== 'string' || !input['source']['id'] || input['source']['id'].length > 1024
    || !pair(input['package'], ['name', 'version']) || !pair(input['catalog'], ['id', 'version'])
    || typeof input['format'] !== 'string' || !['chat', 'json', 'markup'].includes(input['format'])
    || typeof input['text'] !== 'string' || new TextEncoder().encode(input['text']).byteLength > MAX_SOURCE_BYTES
    || !Array.isArray(input['chunks']) || input['chunks'].length < 1) return fail();
  let previous = 0;
  let length = 0;
  const pieces: string[] = [];
  for (const chunk of input['chunks']) {
    if (!object(chunk) || !exact(chunk, ['atMs', 'text']) || typeof chunk['atMs'] !== 'number'
      || !Number.isFinite(chunk['atMs']) || chunk['atMs'] < previous || chunk['atMs'] > 60000
      || typeof chunk['text'] !== 'string') return fail();
    previous = chunk['atMs'];
    length += chunk['text'].length;
    if (length > input['text'].length) return fail();
    pieces.push(chunk['text']);
  }
  // Join code units before comparing: a transport may split a UTF-16 surrogate pair.
  if (pieces.join('') !== input['text']) return fail();
  return { ok: true, value: input as unknown as ReplayRecording, diagnostics: [] };
}

function waitForRecordedChunk(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
  });
}

/** Replay original offsets against one clock; late callbacks never retimestamp the recording. */
export async function replayRecordedChunks(input: unknown, onChunk: (chunk: ReplayChunk, index: number) => void, options: {
  readonly signal?: AbortSignal;
} = {}): Promise<LyraGenResult<{ readonly status: 'completed' | 'interrupted'; readonly deliveredChunks: number }>> {
  const recording = parseReplayRecording(input);
  if (!recording.ok) return recording;
  const started = performance.now();
  let deliveredChunks = 0;
  for (const [index, chunk] of recording.value.chunks.entries()) {
    if (options.signal?.aborted) break;
    const remaining = started + chunk.atMs - performance.now();
    if (remaining > 0) await waitForRecordedChunk(remaining, options.signal);
    if (options.signal?.aborted) break;
    onChunk(chunk, index);
    deliveredChunks++;
  }
  return { ok: true, value: { status: options.signal?.aborted ? 'interrupted' : 'completed', deliveredChunks }, diagnostics: [] };
}
/** Strict envelope validation prevents accidentally persisting arbitrary provider metadata or credentials. */
export function parseReplayRecord(input: unknown): LyraGenResult<ReplayRecord> {
  const admitted = snapshotJson(input, { maxBytes: 1048576, maxDepth: 8, maxNodes: 100, maxObjectKeys: 16, maxStringLength: MAX_SOURCE_BYTES });
  if (!admitted.ok) return admitted;
  input = admitted.value;
  const fail = (): LyraGenResult<ReplayRecord> => ({ ok: false, diagnostics: [diagnostic('replay.envelope', 'Invalid or unsupported replay envelope.')] });
  if (!object(input) || !exact(input, ['version', 'source', 'model', 'package', 'catalog', 'format', 'text', 'surfaceId', 'revision', 'timings'])) return fail();
  if (input['version'] !== '1' || !object(input['source']) || !exact(input['source'], ['kind', 'id'])
    || !['fixture', 'provider', 'file'].includes(String(input['source']['kind']))
    || typeof input['source']['id'] !== 'string' || !input['source']['id'] || input['source']['id'].length > 1024
    || (input['model'] !== null && !pair(input['model'], ['provider', 'id']))
    || !pair(input['package'], ['name', 'version']) || !pair(input['catalog'], ['id', 'version'])
    || (input['format'] !== 'json' && input['format'] !== 'markup')
    || typeof input['text'] !== 'string' || new TextEncoder().encode(input['text']).byteLength > MAX_SOURCE_BYTES
    || typeof input['surfaceId'] !== 'string' || !input['surfaceId'] || input['surfaceId'].length > 256
    || typeof input['revision'] !== 'number' || !Number.isSafeInteger(input['revision']) || input['revision'] < 0
    || !object(input['timings']) || !exact(input['timings'], Object.keys(unknownTimings))
    || Object.values(input['timings']).some(value => value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))) return fail();
  return { ok: true, value: input as unknown as ReplayRecord, diagnostics: [] };
}

/** Persist only declared provenance. Unknown measurements are null, never invented zeroes. */
export function createReplayRecord(options: CreateReplayOptions): ReplayRecord {
  const record: ReplayRecord = {
    version: '1', source: { kind: options.source.kind, id: options.source.id },
    model: options.model ? { provider: options.model.provider, id: options.model.id } : null,
    package: { name: options.package.name, version: options.package.version },
    catalog: { id: options.catalog.id, version: options.catalog.version },
    format: options.format, text: options.text, surfaceId: options.surfaceId, revision: options.revision,
    timings: { ...unknownTimings, ...options.timings }
  };
  const result = parseReplayRecord(record);
  if (!result.ok) throw new TypeError('Invalid replay record.');
  return result.value;
}

/** Parse a bounded source without evaluating markup or loading browser components. */
export function parseGeneratedSource(text: string, format: GeneratedFormat, catalog: LyraGenCatalog, options: {
  readonly surfaceId?: string; readonly revision?: number;
} = {}): LyraGenResult<unknown> {
  if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_BYTES) {
    return { ok: false, diagnostics: [diagnostic('source.bytes', 'Generated source exceeds the byte limit.')] };
  }
  if (format === 'markup') {
    const parsed = parseMarkup(text, { catalog, surfaceId: options.surfaceId ?? 'generated-view', revision: options.revision ?? 0, allowedTags: Object.keys(catalog.components) });
    return parsed.status === 'complete' && parsed.view
      ? { ok: true, value: parsed.view, diagnostics: parsed.diagnostics }
      : { ok: false, diagnostics: parsed.diagnostics.length ? parsed.diagnostics : [diagnostic('source.incomplete', 'Generated source is incomplete.')] };
  }
  return parseJson(text, { maxBytes: MAX_SOURCE_BYTES });
}

/** Replay re-runs current validation; a successful past recording never bypasses the active catalog. */
export function replayRecord(input: unknown, catalog: LyraGenCatalog): LyraGenResult<LyraGenView> {
  const envelope = parseReplayRecord(input);
  if (!envelope.ok) return envelope;
  const record = envelope.value;
  if (record.catalog.id !== catalog.id || record.catalog.version !== catalog.version) {
    return { ok: false, diagnostics: [diagnostic('replay.catalog', 'Replay catalog provenance does not match the active catalog.')] };
  }
  const parsed = parseGeneratedSource(record.text, record.format, catalog, record);
  if (!parsed.ok) return parsed;
  const validated = validateView(parsed.value, catalog);
  if (validated.ok && (validated.value.surfaceId !== record.surfaceId || validated.value.revision !== record.revision)) {
    return { ok: false, diagnostics: [diagnostic('replay.identity', 'Replay surface identity does not match the recorded source.')] };
  }
  return validated;
}
