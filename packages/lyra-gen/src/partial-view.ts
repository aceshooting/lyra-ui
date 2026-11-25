import { validateView } from './runtime.js';
import { validateCanonicalView, ViewValidationCache } from './isolation.js';
import type { LyraGenCatalog, LyraGenLimits, LyraGenNode, LyraGenView } from './types.js';

/**
 * A validated preview of a view that is still streaming. It carries the surface and revision the
 * final commit will carry: a preview is not a separate revision, so a host never patches it and
 * replaces it with the committed view (or discards it when the stream fails or is cancelled).
 */
export interface LyraGenPartialView {
  readonly view: LyraGenView;
  /** Ids of shown nodes whose subtree is still open: more children can still arrive under them. */
  readonly partialNodes: readonly string[];
  /** Starts at 1 and increases by one with every preview of the same stream. */
  readonly sequence: number;
  /** UTF-16 code units consumed when the preview was assembled. */
  readonly receivedCodeUnits: number;
}
export interface LyraGenProgressiveOptions {
  /**
   * Minimum code units between two preview attempts (default 128). Attempts also wait for a
   * quarter of the input already consumed, so validation work stays linear in the stream length.
   */
  readonly minCodeUnits?: number;
}
export const DEFAULT_PARTIAL_INTERVAL = 128;

/** Pointer of the node that owns a diagnostic path. */
const ownerPattern = /^\/root(?:\/children\/\d+)*/u;

/** Removes the nodes at the given pointers; returns undefined when a removal would hide a shown node. */
function prune(root: LyraGenNode, paths: ReadonlySet<string>, shown: ReadonlyMap<string, string>): LyraGenNode | undefined {
  let blocked = false;
  const walk = (node: LyraGenNode, path: string): LyraGenNode | undefined => {
    if (paths.has(path)) { if (shown.has(node.id)) blocked = true; return undefined; }
    if (!node.children) return node;
    const kept = node.children.map((child, index) => walk(child, `${path}/children/${index}`)).filter((child): child is LyraGenNode => child !== undefined);
    if (kept.length === node.children.length && kept.every((child, index) => child === node.children![index])) return node;
    const { children: _removed, ...rest } = node;
    return kept.length ? { ...rest, children: kept } : rest;
  };
  const result = walk(root, '/root');
  return blocked ? undefined : result;
}

/**
 * Admits best-effort previews: each candidate passes strict `validateView`; nodes that fail are
 * dropped when they were never shown, and a candidate that would hide or retype a shown node is
 * skipped, so successive previews only grow. Completed subtrees keep their object identity between
 * offers, so each attempt admits and validates only the nodes that are new or still open.
 */
export class PartialViewTracker {
  readonly #shown = new Map<string, string>();
  readonly #catalog: LyraGenCatalog;
  readonly #limits: Partial<LyraGenLimits> | undefined;
  readonly #normalize: boolean;
  readonly #interval: number;
  readonly #cache = new ViewValidationCache();
  #sequence = 0;
  #attempted = 0;

  constructor(catalog: LyraGenCatalog, options: LyraGenProgressiveOptions, limits?: Partial<LyraGenLimits>, normalize = false) {
    this.#catalog = catalog;
    this.#limits = limits;
    this.#normalize = normalize;
    const interval = options.minCodeUnits;
    this.#interval = typeof interval === 'number' && Number.isSafeInteger(interval) && interval >= 0 ? interval : DEFAULT_PARTIAL_INTERVAL;
  }

  /** True when enough input has arrived since the previous attempt. */
  due(received: number): boolean {
    return received - this.#attempted >= Math.max(this.#interval, Math.floor(this.#attempted / 4));
  }

  offer(view: Omit<LyraGenView, 'root'> & { readonly root: LyraGenNode }, open: ReadonlySet<string>, received: number): LyraGenPartialView | undefined {
    this.#attempted = received;
    let root: LyraGenNode | undefined = view.root;
    for (let attempt = 0; attempt < 4 && root; attempt++) {
      const candidate = { ...view, root };
      const checked = this.#normalize
        ? validateView(candidate, this.#catalog, { limits: this.#limits, normalize: true })
        : validateCanonicalView(candidate, this.#catalog, { limits: this.#limits }, candidate, this.#cache);
      if (checked.ok) return this.#accept(checked.value, open, received);
      const owners = new Set<string>();
      for (const diagnostic of checked.diagnostics) {
        if (diagnostic.severity !== 'error') continue;
        const owner = ownerPattern.exec(diagnostic.path)?.[0];
        if (!owner || owner === '/root') return undefined;
        owners.add(owner);
      }
      if (!owners.size) return undefined;
      root = prune(root, owners, this.#shown);
    }
    return undefined;
  }

  #accept(view: LyraGenView, open: ReadonlySet<string>, received: number): LyraGenPartialView | undefined {
    const types = new Map<string, string>();
    const partialNodes: string[] = [];
    const pending: LyraGenNode[] = [view.root];
    for (let index = 0; index < pending.length; index++) {
      const node = pending[index]!;
      types.set(node.id, node.type);
      if (open.has(node.id)) partialNodes.push(node.id);
      if (node.children) pending.push(...node.children);
    }
    for (const [id, type] of this.#shown) if (types.get(id) !== type) return undefined;
    for (const [id, type] of types) this.#shown.set(id, type);
    return Object.freeze({ view, partialNodes: Object.freeze(partialNodes), sequence: ++this.#sequence, receivedCodeUnits: received });
  }
}
