/**
 * A type-keyed dispatch registry for tool-result renderers -- a tiny plugin
 * system so a host app can teach `<lr-tool-result-view>` how to draw the
 * result of e.g. a `get_weather` or `run_query` tool call without this
 * library knowing anything about either. Dispatch is a two-step lookup: an
 * exact match on the tool's name first, falling back to a facade/shape-based
 * `matches(payload)` scan when no name matches --
 * useful when several tool names share one result shape (e.g. every
 * "*_search" tool returning `{ results: [...] }`) or when the caller doesn't
 * reliably know the tool name at all.
 */

/**
 * `ToolResultStatus` lives on `<lr-tool-result-dialog>` (`tool-result-dialog.class.ts`) and is
 * re-exported here rather than duplicated -- this module's cycle analysis (see
 * `scripts/check-import-cycles.mjs`, run as part of `contract-policy`) confirmed
 * `tool-result-dialog.class.ts` and everything *it* imports (`LyraElement`, `scroll-lock`,
 * `overlay-manager`, `a11y`, `icons`, `numbers`) has zero path back into this `tool-result-view/`
 * directory, so importing the type here creates no circular import; `verbatimModuleSyntax` erases
 * the `import type` at build time regardless, so this costs nothing at runtime either way.
 */
import type { ToolResultStatus } from '../tool-result-dialog/tool-result-dialog.class.js';
export type { ToolResultStatus };

/**
 * Handed to a renderer's `render()` as an optional 3rd positional argument (see
 * `ToolRendererDefinition.render`). A pre-existing 2-arg `render(result, args)` function stays
 * assignable to the widened 3-arg type -- JS/TS function assignability allows an implementation
 * with fewer parameters than its declared type -- so this addition is purely additive; no
 * existing renderer needs to change.
 */
export interface ToolRenderContext {
  /**
   * Reports this render's outcome without throwing. A renderer that understood the result shape
   * well enough to draw *some* UI for it -- e.g. an inline error banner for an application-level
   * failure embedded in an otherwise well-formed payload, or a "denied" state for a tool call the
   * caller refused to run -- calls this instead of throwing, so `<lr-tool-result-view>` reflects
   * the outcome via its `status` property while still keeping the renderer's own template mounted,
   * rather than discarding it for the `<lr-json-viewer>` fallback the way a *thrown* error does.
   * Calling this is entirely optional: a renderer that never calls it leaves `status` at its
   * default, `'success'`. Calls from a renderer that throws, or after a later render has started,
   * are ignored.
   */
  reportStatus: (status: ToolResultStatus) => void;
}

interface ToolRendererDefinitionBase {
  /** Facade/shape-based dispatch predicate -- see the module doc's dispatch order. */
  readonly matches?: (payload: unknown) => boolean;
}

/** A renderer whose implementation is already available synchronously. */
export interface DirectToolRendererDefinition extends ToolRendererDefinitionBase {
  /**
   * Renders `result` (and the tool-call `args` that produced it, when
   * available) as UI. Typed loosely as `unknown` rather than Lit's
   * `TemplateResult` so any lit-html-renderable value works too (a plain
   * string, a DOM node, an array of templates) -- consumers already own
   * their own Lit import and don't need this module to add one.
   *
   * The 3rd `context` argument (see `ToolRenderContext`) is a back-compat-preserving addition --
   * it's the last positional parameter, so every pre-existing 2-arg `render(result, args)`
   * function stays assignable unchanged. Direct callers can omit it; use
   * `context?.reportStatus()` to signal a non-throwing
   * failure (or any other `ToolResultStatus`) while still rendering real content, instead of
   * throwing and losing that content to the `<lr-json-viewer>` fallback.
   */
  readonly render: (result: unknown, args: unknown, context?: ToolRenderContext) => unknown;
  /** Direct definitions cannot also declare a lazy loader. */
  readonly load?: never;
}

/** A code-split renderer definition. Its loader must resolve to a direct renderer. */
export interface LazyToolRendererDefinition extends ToolRendererDefinitionBase {
  /** Lazy definitions cannot ambiguously carry a direct renderer too. */
  readonly render?: never;
  /**
   * Lazy loader for a code-split renderer. Resolves to either a definition
   * directly, or a `{ default }`-shaped module namespace object (so
   * `load: () => import('./my-renderer.js')` works unmodified when that
   * module's default export is itself a `ToolRendererDefinition`).
   */
  readonly load: () => Promise<DirectToolRendererDefinition | { default: DirectToolRendererDefinition }>;
}

/**
 * One registered renderer, expressed as an exclusive direct-or-lazy union. Runtime registry
 * boundaries validate the same contract, including registries assembled from plain JavaScript.
 * A lazy definition supplies its lightweight `matches` predicate before loading and resolves to a
 * direct definition carrying `render`; `{}`, `{ render, load }`, and nested lazy results are invalid.
 */
export type ToolRendererDefinition = DirectToolRendererDefinition | LazyToolRendererDefinition;

/** A tool-name -> renderer-definition registry, as consulted by `findToolRenderer()`. */
export type ToolRendererRegistry = ReadonlyMap<string, ToolRendererDefinition>;

/** The module-level registry every `<lr-tool-result-view>` dispatches against by default (see its `registry` prop to opt a given instance into a different one instead). */
const defaultRegistry = new Map<string, ToolRendererDefinition>();

/**
 * Resolved-`load()` cache, keyed by *definition object identity* rather than
 * by tool name. Keying by name would let two different registries that
 * happen to reuse the same tool-name string (a default-registry entry and an
 * unrelated custom-registry entry, say) silently share one cached module --
 * identity keying makes that impossible while still giving every distinct
 * definition the "call `load()` at most once" behavior a repeatedly-dispatched
 * lazy renderer needs.
 */
let loadCache = new WeakMap<LazyToolRendererDefinition, Promise<DirectToolRendererDefinition>>();

function rendererShape(def: unknown): 'direct' | 'lazy' | undefined {
  if (def === null || typeof def !== 'object' || Array.isArray(def)) return undefined;
  const candidate = def as { render?: unknown; load?: unknown; matches?: unknown };
  if (candidate.matches !== undefined && typeof candidate.matches !== 'function') return undefined;
  const hasRender = typeof candidate.render === 'function';
  const hasLoad = typeof candidate.load === 'function';
  if (hasRender === hasLoad) return undefined;
  return hasRender ? 'direct' : 'lazy';
}

function assertRendererDefinition(def: unknown): asserts def is ToolRendererDefinition {
  const shape = rendererShape(def);
  if (!shape) {
    throw new TypeError('<lr-tool-result-view>: renderer must provide exactly one of render() or load()');
  }
}

function assertDirectRendererDefinition(def: unknown): asserts def is DirectToolRendererDefinition {
  if (rendererShape(def) !== 'direct') {
    throw new TypeError('<lr-tool-result-view>: a loaded renderer must provide render() and no load()');
  }
}

/** Registers (or overwrites) the renderer for `name` in the default registry. */
export function registerToolRenderer(name: string, def: ToolRendererDefinition): void {
  assertRendererDefinition(def);
  defaultRegistry.set(name, def);
}

/** The module-level default registry `registerToolRenderer()` writes to and `<lr-tool-result-view>` reads from when no `registry` prop is set. */
export function getDefaultToolRendererRegistry(): ToolRendererRegistry {
  return defaultRegistry;
}

/**
 * Finds the renderer definition for `toolName`/`payload` in `registry`
 * (the default registry when omitted), in dispatch order:
 *   1. An exact `toolName` key match.
 *   2. Failing that, the first entry (in registration order -- a `Map`
 *      already iterates that way) whose `matches(payload)` returns `true`.
 *   3. `undefined` -- the caller falls back to `<lr-json-viewer>`.
 */
export function findToolRenderer(
  toolName: string,
  payload: unknown,
  registry: ToolRendererRegistry = defaultRegistry,
): ToolRendererDefinition | undefined {
  const exact = registry.get(toolName);
  if (exact) {
    assertRendererDefinition(exact);
    return exact;
  }
  for (const def of registry.values()) {
    assertRendererDefinition(def);
    if (def.matches?.(payload)) return def;
  }
  return undefined;
}

function unwrapLoadedRenderer(mod: unknown): unknown {
  if (mod !== null && typeof mod === 'object' && !Array.isArray(mod) && 'default' in mod) {
    return (mod as { default?: unknown }).default;
  }
  return mod;
}

/**
 * Resolves `def` to a definition guaranteed to carry a real `render` --
 * awaiting and unwrapping `def.load()` (caching the result so a lazy
 * definition's `load()` runs at most once no matter how many times it's
 * dispatched to) when `def.load` is present, or returning `def` as-is
 * otherwise. A rejected `load()` is *not* cached -- the definition stays
 * registered, so a later resolution attempt (e.g. after a transient network
 * failure) gets a fresh `load()` call rather than being stuck replaying one
 * failed promise forever.
 */
export function loadToolRenderer(def: ToolRendererDefinition): Promise<DirectToolRendererDefinition> {
  assertRendererDefinition(def);
  if (!def.load) return Promise.resolve(def);
  const cached = loadCache.get(def);
  if (cached) return cached;
  const promise = def.load().then((mod): DirectToolRendererDefinition => {
    const resolved = unwrapLoadedRenderer(mod);
    assertDirectRendererDefinition(resolved);
    return resolved;
  });
  loadCache.set(def, promise);
  promise.catch(() => loadCache.delete(def));
  return promise;
}

/**
 * @internal Test-only utility: empties the default registry and its `load()` cache so
 * one test's `registerToolRenderer()` calls can't leak into the next. Mirrors
 * the fact that this module (like `toaster.ts`'s per-placement region map) is
 * deliberately singleton, module-level state -- there is no per-instance
 * registry to construct fresh in a test's own `fixture()` call instead. Not
 * part of the public API; not re-exported from the root barrel -- a
 * consuming app has no legitimate reason to wipe this page's entire
 * registered-renderer registry at runtime, only a test suite resetting
 * state between cases (import directly from this module, as the test suite
 * already does).
 */
export function clearToolRenderers(): void {
  defaultRegistry.clear();
  loadCache = new WeakMap();
}
