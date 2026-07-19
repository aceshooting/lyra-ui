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
 * One registered renderer. Either `render` is present directly, or `load` is
 * -- a definition registered purely as `{ load }` is expected to resolve (via
 * dynamic `import()`, typically) to the real `render`/`matches` pair on
 * first use, so a host app can code-split a rarely-used or heavy renderer
 * (e.g. one pulling in a charting library) instead of paying for it on every
 * page that merely registers it.
 *
 * `matches` is only ever consulted *before* `load` resolves when it's
 * supplied inline at registration time -- a definition that needs
 * shape-based dispatch and also wants to lazy-load its `render` should
 * register a lightweight synchronous `matches` up front alongside `load`;
 * one that dispatches purely by exact tool-name key doesn't need `matches`
 * at all, loaded or not.
 */
export interface ToolRendererDefinition {
  /**
   * Renders `result` (and the tool-call `args` that produced it, when
   * available) as UI. Typed loosely as `unknown` rather than Lit's
   * `TemplateResult` so any lit-html-renderable value works too (a plain
   * string, a DOM node, an array of templates) -- consumers already own
   * their own Lit import and don't need this module to add one.
   */
  render?: (result: unknown, args: unknown) => unknown;
  /** Facade/shape-based dispatch predicate -- see the module doc's dispatch order. */
  matches?: (payload: unknown) => boolean;
  /**
   * Lazy loader for a code-split renderer. Resolves to either a definition
   * directly, or a `{ default }`-shaped module namespace object (so
   * `load: () => import('./my-renderer.js')` works unmodified when that
   * module's default export is itself a `ToolRendererDefinition`).
   */
  load?: () => Promise<ToolRendererDefinition | { default: ToolRendererDefinition }>;
}

/** A tool-name -> renderer-definition registry, as consulted by `findToolRenderer()`. */
export type ToolRendererRegistry = Map<string, ToolRendererDefinition>;

/** The module-level registry every `<lr-tool-result-view>` dispatches against by default (see its `registry` prop to opt a given instance into a different one instead). */
const defaultRegistry: ToolRendererRegistry = new Map();

/**
 * Resolved-`load()` cache, keyed by *definition object identity* rather than
 * by tool name. Keying by name would let two different registries that
 * happen to reuse the same tool-name string (a default-registry entry and an
 * unrelated custom-registry entry, say) silently share one cached module --
 * identity keying makes that impossible while still giving every distinct
 * definition the "call `load()` at most once" behavior a repeatedly-dispatched
 * lazy renderer needs.
 */
let loadCache = new WeakMap<ToolRendererDefinition, Promise<ToolRendererDefinition>>();

/** Registers (or overwrites) the renderer for `name` in the default registry. */
export function registerToolRenderer(name: string, def: ToolRendererDefinition): void {
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
  if (exact) return exact;
  for (const def of registry.values()) {
    if (def.matches?.(payload)) return def;
  }
  return undefined;
}

function isModuleWrapper(
  mod: ToolRendererDefinition | { default: ToolRendererDefinition },
): mod is { default: ToolRendererDefinition } {
  return 'default' in mod && typeof mod.default === 'object' && mod.default !== null;
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
export function loadToolRenderer(def: ToolRendererDefinition): Promise<ToolRendererDefinition> {
  if (!def.load) return Promise.resolve(def);
  const cached = loadCache.get(def);
  if (cached) return cached;
  const promise = def.load().then((mod) => (isModuleWrapper(mod) ? mod.default : mod));
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
