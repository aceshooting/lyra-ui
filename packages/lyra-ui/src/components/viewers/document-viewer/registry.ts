import type { AnchorTargetCapabilities, LyraAnchor, LyraHighlight } from './anchors.js';
import {
  snapshotLyraAvCues,
  snapshotLyraAvTracks,
  type LyraAvCue,
  type LyraAvTrack,
} from '../../media/av-player/av-metadata.js';

/** A file supplied to a document renderer. */
export interface DocumentFile {
  name: string;
  mimeType: string;
  src: string;
  /** A string is a highlight id in `highlights`. */
  anchor?: LyraAnchor | string;
  highlights?: LyraHighlight[];
  /** Media alt text for image-like renderers. */
  alt?: string;
}

/** Immutable file data wrapped by a `LyraDocumentRendererPayload`. */
export interface LyraDocumentFile {
  readonly name: string;
  readonly mimeType: string;
  readonly src: string;
  /** A string is a highlight id in `highlights`. */
  readonly anchor?: LyraAnchor | string;
  readonly highlights?: readonly LyraHighlight[];
  /** Media alt text for image-like renderers. */
  readonly alt?: string;
}

/** Generic payload used when no renderer-specific authoring data is supplied. */
export interface LyraGenericDocumentRendererPayload {
  readonly kind: 'document';
  readonly file: LyraDocumentFile;
}

/** Audio/video payload carrying the metadata needed for transcript search and native tracks. */
export interface LyraAvDocumentRendererPayload {
  readonly kind: 'av';
  readonly file: LyraDocumentFile;
  readonly cues: readonly LyraAvCue[];
  readonly tracks: readonly LyraAvTrack[];
}

/** Built-in renderer payloads. `kind` is the renderer-family discriminator. */
export type LyraDocumentRendererPayload =
  | LyraGenericDocumentRendererPayload
  | LyraAvDocumentRendererPayload;

export type LyraDocumentRendererPayloadKind = LyraDocumentRendererPayload['kind'];
export type LyraDocumentRendererPayloadFor<K extends LyraDocumentRendererPayloadKind> = Extract<
  LyraDocumentRendererPayload,
  { kind: K }
>;

function snapshotDocumentFile(value: unknown): LyraDocumentFile {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('A document renderer payload must provide a file object.');
  }
  const file = value as Record<string, unknown>;
  if (
    typeof file['name'] !== 'string'
    || typeof file['mimeType'] !== 'string'
    || typeof file['src'] !== 'string'
  ) {
    throw new TypeError('A document renderer payload file must provide string name, mimeType, and src fields.');
  }
  const highlights = Array.isArray(file['highlights'])
    ? Object.freeze([...file['highlights']]) as readonly LyraHighlight[]
    : undefined;
  return Object.freeze({
    name: file['name'],
    mimeType: file['mimeType'],
    src: file['src'],
    ...(file['anchor'] !== undefined ? { anchor: file['anchor'] as LyraAnchor | string } : {}),
    ...(highlights ? { highlights } : {}),
    ...(typeof file['alt'] === 'string' ? { alt: file['alt'] } : {}),
  });
}

/** Clones, validates, hard-bounds, and freezes a renderer payload at an assignment boundary. */
export function snapshotLyraDocumentRendererPayload(
  value: LyraDocumentRendererPayload,
): LyraDocumentRendererPayload {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('A document renderer payload must be an object.');
  }
  const candidate = value as LyraDocumentRendererPayload;
  const file = snapshotDocumentFile(candidate.file);
  if (candidate.kind === 'document') return Object.freeze({ kind: 'document', file });
  if (candidate.kind === 'av') {
    return Object.freeze({
      kind: 'av',
      file,
      cues: snapshotLyraAvCues(candidate.cues),
      tracks: snapshotLyraAvTracks(candidate.tracks),
    });
  }
  throw new TypeError('A document renderer payload has an unsupported kind.');
}

const DOCUMENT_RENDERER_ADAPTER = Symbol('document-renderer-adapter');

/** Type-erased adapter created by `createDocumentRendererAdapter()`. */
export interface LyraDocumentRendererAdapter {
  readonly kind: LyraDocumentRendererPayloadKind;
  readonly [DOCUMENT_RENDERER_ADAPTER]: true;
  adapt(file: DocumentFile, supplied?: LyraDocumentRendererPayload): LyraDocumentRendererPayload;
  capabilities(payload: LyraDocumentRendererPayload): AnchorTargetCapabilities | undefined;
  render(payload: LyraDocumentRendererPayload): unknown;
}

/** Strongly typed authoring contract for one discriminator-specific renderer adapter. */
export interface LyraDocumentRendererAdapterDefinition<
  K extends LyraDocumentRendererPayloadKind,
> {
  readonly kind: K;
  readonly adapt: (
    file: DocumentFile,
    supplied?: LyraDocumentRendererPayload,
  ) => LyraDocumentRendererPayloadFor<K>;
  readonly capabilities: (
    payload: LyraDocumentRendererPayloadFor<K>,
  ) => AnchorTargetCapabilities | undefined;
  readonly render: (payload: LyraDocumentRendererPayloadFor<K>) => unknown;
}

interface DocumentRendererDefinitionBase {
  /** Matches files that do not have an exact normalized MIME-type registration. */
  matches?: (file: DocumentFile) => boolean;
}

/** A renderer whose implementation is already available. */
export interface DirectDocumentRendererDefinition extends DocumentRendererDefinitionBase {
  /** Renders the file as Lit-compatible content, a DOM node, or plain text. */
  render: (file: DocumentFile) => unknown;
  /** Static legacy capability declaration. Payload adapters derive capabilities instead. */
  capabilities?: AnchorTargetCapabilities;
  adapter?: never;
  load?: never;
}

/** A direct renderer driven by a typed, discriminator-specific payload adapter. */
export interface LyraAdaptedDocumentRendererDefinition extends DocumentRendererDefinitionBase {
  adapter: LyraDocumentRendererAdapter;
  render?: never;
  capabilities?: never;
  load?: never;
}

/** A resolved definition that can render immediately. */
export type LyraResolvedDocumentRendererDefinition =
  | DirectDocumentRendererDefinition
  | LyraAdaptedDocumentRendererDefinition;

/** A renderer whose implementation is loaded only after a matching file is opened. */
export interface LazyDocumentRendererDefinition extends DocumentRendererDefinitionBase {
  render?: never;
  adapter?: never;
  /** Capability declaration available before the legacy direct renderer is loaded. */
  capabilities?: AnchorTargetCapabilities;
  load: () => Promise<
    DirectDocumentRendererDefinition | { default: DirectDocumentRendererDefinition }
  >;
}

/** A validated renderer definition. Exactly one of `render`, `adapter`, and `load` is present. */
export type DocumentRendererDefinition =
  | DirectDocumentRendererDefinition
  | LyraAdaptedDocumentRendererDefinition
  | LazyDocumentRendererDefinition;

/** Canonically prefixed alias for authored renderer definitions. */
export type LyraDocumentRendererDefinition = DocumentRendererDefinition;

/** One payload-bound renderer invocation and its truthful, immutable capabilities. */
export interface LyraAdaptedDocumentRenderer {
  readonly payload: LyraDocumentRendererPayload;
  readonly capabilities?: AnchorTargetCapabilities;
  readonly render: () => unknown;
}

/** Immutable MIME/key-to-renderer registry accepted by `<lr-document-viewer>`. */
export type DocumentRendererRegistry = ReadonlyMap<string, DocumentRendererDefinition>;

const builtInDefinitions = new Map<string, DocumentRendererDefinition>();
let loadCache = new WeakMap<DocumentRendererDefinition, Promise<LyraResolvedDocumentRendererDefinition>>();
let validatedDefinitionCache = new WeakMap<object, DocumentRendererDefinition>();

function normalizeRegistryKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  if (!normalized) throw new TypeError('A document renderer key must not be empty.');
  return normalized.includes('/') ? normalized.split(';', 1)[0]!.trim() : normalized;
}

function freezeCapabilities(
  capabilities: AnchorTargetCapabilities | undefined,
): AnchorTargetCapabilities | undefined {
  if (!capabilities) return undefined;
  if (
    (capabilities.anchors !== undefined && (
      !Array.isArray(capabilities.anchors)
      || capabilities.anchors.some((kind) => typeof kind !== 'string')
    ))
    || (capabilities.search !== undefined && typeof capabilities.search !== 'boolean')
    || (capabilities.textSelect !== undefined && typeof capabilities.textSelect !== 'boolean')
  ) {
    throw new TypeError('A document renderer has an invalid capabilities declaration.');
  }
  return Object.freeze({
    ...capabilities,
    ...(capabilities.anchors
      ? { anchors: Object.freeze([...capabilities.anchors]) as unknown as AnchorTargetCapabilities['anchors'] }
      : {}),
  });
}

/**
 * Creates a type-safe payload adapter, then erases its discriminator-specific callback types behind
 * runtime kind checks. Legacy `render(file)` definitions remain a separate branch.
 */
export function createDocumentRendererAdapter<K extends LyraDocumentRendererPayloadKind>(
  definition: LyraDocumentRendererAdapterDefinition<K>,
): LyraDocumentRendererAdapter {
  const kind = definition.kind;
  const adapt = definition.adapt;
  const capabilities = definition.capabilities;
  const render = definition.render;
  if (
    (kind !== 'document' && kind !== 'av')
    || typeof adapt !== 'function'
    || typeof capabilities !== 'function'
    || typeof render !== 'function'
  ) {
    throw new TypeError('A document renderer adapter definition is invalid.');
  }
  const assertKind = (
    payload: LyraDocumentRendererPayload,
  ): LyraDocumentRendererPayloadFor<K> => {
    if (payload.kind !== kind) {
      throw new TypeError('A document renderer adapter returned or received the wrong payload kind.');
    }
    return payload as LyraDocumentRendererPayloadFor<K>;
  };
  return Object.freeze({
    [DOCUMENT_RENDERER_ADAPTER]: true as const,
    kind,
    adapt(file: DocumentFile, supplied?: LyraDocumentRendererPayload): LyraDocumentRendererPayload {
      return assertKind(snapshotLyraDocumentRendererPayload(adapt(file, supplied)));
    },
    capabilities(payload: LyraDocumentRendererPayload): AnchorTargetCapabilities | undefined {
      return freezeCapabilities(capabilities(assertKind(payload)));
    },
    render(payload: LyraDocumentRendererPayload): unknown {
      return render(assertKind(payload));
    },
  });
}

function isDocumentRendererAdapter(value: unknown): value is LyraDocumentRendererAdapter {
  if (value === null || typeof value !== 'object') return false;
  const adapter = value as Partial<LyraDocumentRendererAdapter>;
  return adapter[DOCUMENT_RENDERER_ADAPTER] === true
    && (adapter.kind === 'document' || adapter.kind === 'av')
    && typeof adapter.adapt === 'function'
    && typeof adapter.capabilities === 'function'
    && typeof adapter.render === 'function';
}

function validateDefinition(value: unknown): DocumentRendererDefinition {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('A document renderer definition must be an object.');
  }
  const cached = validatedDefinitionCache.get(value);
  if (cached) return cached;
  const candidate = value as Partial<DocumentRendererDefinition> & {
    render?: unknown;
    load?: unknown;
    adapter?: unknown;
    matches?: unknown;
    capabilities?: AnchorTargetCapabilities;
  };
  const hasRender = typeof candidate.render === 'function';
  const hasLoad = typeof candidate.load === 'function';
  const hasAdapter = candidate.adapter !== undefined;
  if (Number(hasRender) + Number(hasLoad) + Number(hasAdapter) !== 1) {
    throw new TypeError('A document renderer definition must provide exactly one of render, adapter, or load.');
  }
  if (candidate.matches !== undefined && typeof candidate.matches !== 'function') {
    throw new TypeError('A document renderer matcher must be a function.');
  }
  if (hasAdapter && !isDocumentRendererAdapter(candidate.adapter)) {
    throw new TypeError('A document renderer adapter must be created with createDocumentRendererAdapter().');
  }
  if (hasAdapter && candidate.capabilities !== undefined) {
    throw new TypeError('A payload adapter must derive its capabilities instead of declaring static capabilities.');
  }
  const capabilities = freezeCapabilities(candidate.capabilities);
  const base = {
    ...(candidate.matches ? { matches: candidate.matches as (file: DocumentFile) => boolean } : {}),
  };
  const validated = hasAdapter
    ? Object.freeze({
        ...base,
        adapter: candidate.adapter as LyraDocumentRendererAdapter,
      })
    : hasRender
      ? Object.freeze({
        ...base,
        ...(capabilities ? { capabilities } : {}),
        render: candidate.render as (file: DocumentFile) => unknown,
      })
      : Object.freeze({
        ...base,
        ...(capabilities ? { capabilities } : {}),
        load: candidate.load as LazyDocumentRendererDefinition['load'],
      });
  validatedDefinitionCache.set(value, validated);
  validatedDefinitionCache.set(validated, validated);
  return validated;
}

/**
 * Binds one resolved definition to a legacy file plus optional immutable payload. The returned
 * invocation is the sole capability-derivation path and renders without widening legacy callbacks.
 */
export function adaptDocumentRenderer(
  candidate: LyraResolvedDocumentRendererDefinition,
  file: DocumentFile,
  supplied?: LyraDocumentRendererPayload,
): LyraAdaptedDocumentRenderer {
  const definition = validateDefinition(candidate);
  if ('load' in definition && definition.load) {
    throw new TypeError('A lazy document renderer must be loaded before it can be adapted.');
  }
  const immutableSupplied = supplied
    ? snapshotLyraDocumentRendererPayload(supplied)
    : undefined;
  if ('adapter' in definition && definition.adapter) {
    const payload = definition.adapter.adapt(file, immutableSupplied);
    const capabilities = definition.adapter.capabilities(payload);
    return Object.freeze({
      payload,
      ...(capabilities ? { capabilities } : {}),
      render: () => definition.adapter.render(payload),
    });
  }
  const payload = immutableSupplied ?? snapshotLyraDocumentRendererPayload({
    kind: 'document',
    file,
  });
  return Object.freeze({
    payload,
    ...(definition.capabilities ? { capabilities: definition.capabilities } : {}),
    render: () => definition.render(file),
  });
}

/** Read-only wrapper rather than a frozen `Map` (whose mutator methods remain callable). */
class ImmutableDocumentRendererRegistry implements ReadonlyMap<string, DocumentRendererDefinition> {
  readonly #entries: Map<string, DocumentRendererDefinition>;

  constructor(entries: Iterable<readonly [string, DocumentRendererDefinition]>) {
    this.#entries = new Map(entries);
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: string): DocumentRendererDefinition | undefined {
    return this.#entries.get(normalizeRegistryKey(key));
  }

  has(key: string): boolean {
    return this.#entries.has(normalizeRegistryKey(key));
  }

  entries(): MapIterator<[string, DocumentRendererDefinition]> {
    return this.#entries.entries();
  }

  keys(): MapIterator<string> {
    return this.#entries.keys();
  }

  values(): MapIterator<DocumentRendererDefinition> {
    return this.#entries.values();
  }

  forEach(
    callbackfn: (
      value: DocumentRendererDefinition,
      key: string,
      map: ReadonlyMap<string, DocumentRendererDefinition>,
    ) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.#entries) callbackfn.call(thisArg, value, key, this);
  }

  [Symbol.iterator](): MapIterator<[string, DocumentRendererDefinition]> {
    return this.entries();
  }
}

/**
 * Creates an immutable registry snapshot from the built-ins registered so far plus optional
 * per-instance overrides. Later module registrations cannot mutate an existing snapshot.
 */
export function createDocumentRendererRegistry(
  overrides: Iterable<readonly [string, DocumentRendererDefinition]> = [],
): DocumentRendererRegistry {
  const entries = new Map(builtInDefinitions);
  for (const [key, definition] of overrides) {
    entries.set(normalizeRegistryKey(key), validateDefinition(definition));
  }
  return new ImmutableDocumentRendererRegistry(entries);
}

/**
 * Adds or replaces a built-in definition for registries created after this call. Registration
 * modules use this during module evaluation; existing viewer instances remain isolated snapshots.
 */
export function registerDocumentRenderer(key: string, definition: DocumentRendererDefinition): void {
  builtInDefinitions.set(normalizeRegistryKey(key), validateDefinition(definition));
}

/** Returns a fresh immutable snapshot of the built-ins registered so far. */
export function getDefaultDocumentRendererRegistry(): DocumentRendererRegistry {
  return createDocumentRendererRegistry();
}

/** Finds an exact normalized MIME essence, then the first matching shape-based renderer. */
export function findDocumentRenderer(
  file: DocumentFile,
  registry: DocumentRendererRegistry = createDocumentRendererRegistry(),
): DocumentRendererDefinition | undefined {
  const exact = registry.get(normalizeRegistryKey(file.mimeType));
  if (exact) return validateDefinition(exact);
  for (const candidate of registry.values()) {
    const definition = validateDefinition(candidate);
    if (definition.matches?.(file)) return definition;
  }
  return undefined;
}

function unwrapLoadedDefinition(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && 'default' in value) {
    return (value as { default: unknown }).default;
  }
  return value;
}

/** Resolves, validates and identity-caches a lazy renderer. Rejected loads are retried. */
export function loadDocumentRenderer(
  candidate: DirectDocumentRendererDefinition | LazyDocumentRendererDefinition,
): Promise<DirectDocumentRendererDefinition>;
export function loadDocumentRenderer(
  candidate: LyraAdaptedDocumentRendererDefinition,
): Promise<LyraAdaptedDocumentRendererDefinition>;
export function loadDocumentRenderer(
  candidate: DocumentRendererDefinition,
): Promise<LyraResolvedDocumentRendererDefinition>;
export function loadDocumentRenderer(
  candidate: DocumentRendererDefinition,
): Promise<LyraResolvedDocumentRendererDefinition> {
  const definition = validateDefinition(candidate);
  if (!('load' in definition) || !definition.load) return Promise.resolve(definition);
  const cached = loadCache.get(definition);
  if (cached) return cached;

  const promise = definition.load().then((value) => {
    const resolved = validateDefinition(unwrapLoadedDefinition(value));
    if (!('render' in resolved) || typeof resolved.render !== 'function') {
      throw new TypeError('A lazy document renderer must resolve to a direct renderer.');
    }
    return resolved;
  });
  loadCache.set(definition, promise);
  promise.catch(() => loadCache.delete(definition));
  return promise;
}

/** Clears built-in registrations and the lazy-load cache for isolated tests. */
export function clearDocumentRenderers(): void {
  builtInDefinitions.clear();
  loadCache = new WeakMap();
  validatedDefinitionCache = new WeakMap();
}
