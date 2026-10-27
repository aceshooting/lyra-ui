import { DashboardError } from './persistence.js';
import type { DashboardContext, DashboardResolved, DashboardStore, DashboardUpdatePolicy } from './persistence.js';

export interface DashboardRoute {
  readonly documentId: string;
  readonly policy?: DashboardUpdatePolicy;
}
export interface DashboardMountContext {
  readonly dashboard: DashboardResolved;
  readonly context: DashboardContext;
  readonly signal: AbortSignal;
}
export interface DashboardApplicationOptions {
  readonly store: DashboardStore;
  /** Resolve a fresh authenticated viewer for every navigation and refresh. */
  readonly context: () => DashboardContext | Promise<DashboardContext>;
  /** Host code owns DOM, route mapping and renderer construction. Return its cleanup hook. */
  readonly mount: (context: DashboardMountContext) => (() => void) | Promise<() => void>;
  /** Share tokens resolve through host policy; they never bypass store authorization. */
  readonly resolveLink?: (link: string, context: DashboardContext) => DashboardRoute | undefined | Promise<DashboardRoute | undefined>;
  readonly beforeLeave?: () => boolean | Promise<boolean>;
  readonly onChange?: (dashboard: DashboardResolved | undefined) => void;
}
export type DashboardNavigationResult = 'mounted' | 'cancelled' | 'superseded';

/** Lifecycle controller for host-owned routes; persisted content cannot choose application URLs. */
export class DashboardApplication {
  readonly #options: DashboardApplicationOptions;
  #generation = 0;
  #controller: AbortController | undefined;
  #cleanup: (() => void) | undefined;
  #route: DashboardRoute | undefined;
  #current: DashboardResolved | undefined;
  #disposed = false;
  constructor(options: DashboardApplicationOptions) { this.#options = options; }
  get current(): DashboardResolved | undefined { return this.#current; }

  async navigate(route: DashboardRoute): Promise<DashboardNavigationResult> {
    if (this.#disposed) throw new DashboardError('invalid', 'The dashboard application has been disposed.');
    return this.#navigate(route, ++this.#generation);
  }
  async #navigate(route: DashboardRoute, generation: number, confirmed = false): Promise<DashboardNavigationResult> {
    const selected = { documentId: route.documentId, ...(route.policy ? { policy: { ...route.policy } } : {}) };
    const isCurrent = (): boolean => generation === this.#generation && !this.#disposed;
    try {
      if (!isCurrent()) return 'superseded';
      if (!confirmed && this.#options.beforeLeave && !await this.#options.beforeLeave()) return isCurrent() ? 'cancelled' : 'superseded';
      if (!isCurrent()) return 'superseded';
      this.#clear();
      if (!isCurrent()) return 'superseded';
      const controller = new AbortController();
      this.#controller = controller;
      const context = await this.#options.context();
      if (!isCurrent()) return 'superseded';
      const dashboard = await this.#options.store.resolve(context, selected.documentId, selected.policy);
      if (!isCurrent()) return 'superseded';
      const cleanup = await this.#options.mount({ dashboard, context, signal: controller.signal });
      if (!isCurrent()) { cleanup(); return 'superseded'; }
      this.#cleanup = cleanup;
      this.#route = selected;
      this.#current = dashboard;
      this.#options.onChange?.(dashboard);
      return isCurrent() ? 'mounted' : 'superseded';
    } catch (error) {
      if (!isCurrent()) return 'superseded';
      this.#clear();
      throw error;
    }
  }
  /** Gallery metadata is filtered by the same current-viewer permissions as direct reads. */
  async gallery(cursor?: string): ReturnType<DashboardStore['list']> {
    if (this.#disposed) throw new DashboardError('invalid', 'The dashboard application has been disposed.');
    return this.#options.store.list(await this.#options.context(), cursor);
  }
  async openLink(link: string): Promise<DashboardNavigationResult> {
    if (this.#disposed) throw new DashboardError('invalid', 'The dashboard application has been disposed.');
    if (!this.#options.resolveLink) throw new DashboardError('invalid', 'The host has not configured share-link resolution.');
    const generation = ++this.#generation;
    const isCurrent = (): boolean => generation === this.#generation && !this.#disposed;
    try {
      const context = await this.#options.context();
      if (!isCurrent()) return 'superseded';
      const route = await this.#options.resolveLink(link, context);
      if (!isCurrent()) return 'superseded';
      if (!route) throw new DashboardError('missing', 'The dashboard link is unavailable.');
      return this.#navigate(route, generation);
    } catch (error) {
      if (!isCurrent()) return 'superseded';
      throw error;
    }
  }
  /** Reauthorizes and resolves the current follow/pin policy, including revoked access. */
  async refresh(): Promise<DashboardNavigationResult> {
    if (!this.#route) return 'cancelled';
    const route = this.#route;
    // Leaving is confirmed before anything is revoked, so a "stay" answer keeps the screen and route intact.
    const before = this.#generation;
    if (this.#options.beforeLeave && !await this.#options.beforeLeave()) return before === this.#generation && !this.#disposed ? 'cancelled' : 'superseded';
    if (before !== this.#generation || this.#disposed) return 'superseded';
    this.revoke();
    const generation = ++this.#generation;
    const restore = (): void => { if (generation === this.#generation && !this.#disposed && !this.#route) this.#route = route; };
    try {
      const result = await this.#navigate(route, generation, true);
      if (result === 'cancelled') restore();
      return result;
    } catch (error) {
      restore();
      throw error;
    }
  }
  /** Invoke on session, tenant, or grant changes to remove already-mounted private content. */
  revoke(): void { ++this.#generation; this.#route = undefined; this.#clear(); }
  dispose(): void { this.#disposed = true; this.revoke(); }
  #clear(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    const cleanup = this.#cleanup;
    this.#cleanup = undefined;
    this.#current = undefined;
    try { cleanup?.(); } finally { this.#options.onChange?.(undefined); }
  }
}
