import type * as HierarchySourceControllerModule from './hierarchy-source-controller.js';
import type * as HierarchySourceViewModule from './hierarchy-source-view.js';
import type * as HierarchySummarySourceModule from './hierarchy-summary-source.js';
import { DEV_DIAGNOSTICS, devWarn } from './dev-warning.js';

/** The provider controller, virtualized view and summary adapter a source-mode host renders with. */
export interface HierarchySourceRuntime {
  readonly controller: typeof HierarchySourceControllerModule;
  readonly view: typeof HierarchySourceViewModule;
  readonly summary: typeof HierarchySummarySourceModule;
}

let shared: Promise<HierarchySourceRuntime> | undefined;

/**
 * Loads the hierarchy source runtime together with the elements its view renders, once per page.
 * Concurrent callers share one attempt; a rejected attempt is forgotten, so the next call retries.
 * `registerElements` registers the virtualized list from the calling component's own graph.
 */
export function loadHierarchySourceRuntime(registerElements: () => Promise<unknown>): Promise<HierarchySourceRuntime> {
  if (shared) return shared;
  const attempt = Promise.all([
    import('./hierarchy-source-controller.js'),
    import('./hierarchy-source-view.js'),
    import('./hierarchy-summary-source.js'),
    Promise.resolve().then(registerElements),
  ]).then(([controller, view, summary]): HierarchySourceRuntime => Object.freeze({ controller, view, summary }));
  shared = attempt;
  void attempt.catch(() => {
    if (shared === attempt) shared = undefined;
  });
  return attempt;
}

/** @internal Forgets the loaded runtime so a test can observe a first load again. */
export function __resetHierarchySourceRuntimeForTesting(): void {
  shared = undefined;
}

export interface HierarchySourceRuntimeHost {
  readonly isConnected: boolean;
  readonly ownerDocument: Document;
  requestUpdate(): void;
}

/**
 * One host's access to the shared runtime: synchronous through {@link runtime} once loaded, and a
 * guarded load before that. A load that settles after its binding was invalidated, the host
 * disconnected or moved to another document resolves `undefined`, as does a failed load (the next
 * request retries); a live request schedules the render that can now use the runtime.
 */
export class HierarchySourceRuntimeGate {
  private loaded?: HierarchySourceRuntime;

  constructor(
    private readonly host: HierarchySourceRuntimeHost,
    private readonly registerElements: () => Promise<unknown>,
  ) {}

  private loading?: Promise<unknown>;

  /** The runtime once any request has loaded it. */
  get runtime(): HierarchySourceRuntime | undefined {
    return this.loaded;
  }

  /** Starts one load for a host whose source mode needs the runtime; a settled load clears itself. */
  request(bound: () => boolean): void {
    if (this.loaded || this.loading) return;
    const load = this.ensure(bound);
    this.loading = load;
    void load.finally(() => {
      if (this.loading === load) this.loading = undefined;
    });
  }

  /** `complete` (the host's own update completion), repeated until no requested load is pending. */
  async settled(complete: () => Promise<boolean>): Promise<boolean> {
    let done = await complete();
    while (this.loading) {
      await this.loading;
      done = await complete();
    }
    return done;
  }

  /** Resolves the runtime while `bound()` holds, e.g. before a pending reveal or the first source render. */
  async ensure(bound: () => boolean): Promise<HierarchySourceRuntime | undefined> {
    const { host } = this;
    if (this.loaded) return bound() && host.isConnected ? this.loaded : undefined;
    const owner = host.ownerDocument;
    let runtime: HierarchySourceRuntime;
    try {
      runtime = await loadHierarchySourceRuntime(this.registerElements);
    } catch (error) {
      if (DEV_DIAGNOSTICS) devWarn(`Lyra: the source runtime for <${(host as Partial<Element>).localName ?? 'host'}> could not be loaded; the next request retries it. ${String(error)}`);
      return undefined;
    }
    this.loaded = runtime;
    if (!bound() || !host.isConnected || host.ownerDocument !== owner) return undefined;
    host.requestUpdate();
    return runtime;
  }
}
