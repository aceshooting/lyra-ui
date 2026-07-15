/** A file supplied to a document renderer. */
export interface DocumentFile {
  name: string;
  mimeType: string;
  src: string;
}

/** A renderer for one document format or a family of related formats. */
export interface DocumentRendererDefinition {
  /** Renders the file as Lit-compatible content, a DOM node, or plain text. */
  render?: (file: DocumentFile) => unknown;
  /** Matches files that do not have an exact MIME-type registration. */
  matches?: (file: DocumentFile) => boolean;
  /** Lazily loads the renderer definition when a matching file is opened. */
  load?: () => Promise<DocumentRendererDefinition | { default: DocumentRendererDefinition }>;
}

/** MIME-type to renderer-definition registry. */
export type DocumentRendererRegistry = Map<string, DocumentRendererDefinition>;

const defaultRegistry: DocumentRendererRegistry = new Map();
let loadCache = new WeakMap<DocumentRendererDefinition, Promise<DocumentRendererDefinition>>();

/** Registers or replaces a renderer in the module-level default registry. */
export function registerDocumentRenderer(key: string, def: DocumentRendererDefinition): void {
  defaultRegistry.set(key, def);
}

/** Returns the module-level registry used by default by `<lyra-document-viewer>`. */
export function getDefaultDocumentRendererRegistry(): DocumentRendererRegistry {
  return defaultRegistry;
}

/** Finds an exact MIME-type renderer, then the first matching shape-based renderer. */
export function findDocumentRenderer(
  file: DocumentFile,
  registry: DocumentRendererRegistry = defaultRegistry,
): DocumentRendererDefinition | undefined {
  const exact = registry.get(file.mimeType);
  if (exact) return exact;
  for (const def of registry.values()) {
    if (def.matches?.(file)) return def;
  }
  return undefined;
}

function isModuleWrapper(
  value: DocumentRendererDefinition | { default: DocumentRendererDefinition },
): value is { default: DocumentRendererDefinition } {
  return 'default' in value && typeof value.default === 'object' && value.default !== null;
}

/** Resolves and identity-caches a lazy renderer. Rejected loads are retried. */
export function loadDocumentRenderer(def: DocumentRendererDefinition): Promise<DocumentRendererDefinition> {
  if (!def.load) return Promise.resolve(def);
  const cached = loadCache.get(def);
  if (cached) return cached;

  const promise = def.load().then((value) => (isModuleWrapper(value) ? value.default : value));
  loadCache.set(def, promise);
  promise.catch(() => loadCache.delete(def));
  return promise;
}

/** Clears the default registry and lazy-load cache for isolated tests. */
export function clearDocumentRenderers(): void {
  defaultRegistry.clear();
  loadCache = new WeakMap();
}
