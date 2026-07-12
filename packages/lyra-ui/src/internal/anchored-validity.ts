import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** @internal */
export const VALIDITY_ANCHOR = Symbol('lyra-validity-anchor');

/** @internal */
export const SET_ANCHORED_VALIDITY = Symbol('lyra-set-anchored-validity');

/** @internal */
export interface ValidityAnchorProvider {
  [VALIDITY_ANCHOR](): HTMLElement | null | undefined;
}

/** @internal */
export function resolveValidityAnchor(provider: unknown): HTMLElement | undefined {
  if (!provider || (typeof provider !== 'object' && typeof provider !== 'function')) return undefined;
  const resolver = (provider as Partial<ValidityAnchorProvider>)[VALIDITY_ANCHOR];
  if (typeof resolver !== 'function') return undefined;
  return resolver.call(provider) ?? undefined;
}

/**
 * Keeps ElementInternals validity synchronous while refreshing its focus
 * anchor after every render. The refresh is required because validity can be
 * computed before the first shadow render and because conditional templates
 * can replace a previously registered anchor.
 *
 * @internal
 */
export class AnchoredValidityController implements ReactiveController {
  private flags: ValidityStateFlags = {};
  private message = '';
  private revision = 0;
  private refreshToken = 0;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly internals: ElementInternals,
    private readonly getAnchor: () => HTMLElement | null | undefined,
  ) {
    host.addController(this);
  }

  setValidity(flags: ValidityStateFlags = {}, message = ''): void {
    this.flags = { ...flags };
    this.message = message;
    this.revision += 1;
    this.apply();
  }

  refreshAnchor(): void {
    if (this.isInvalid()) this.apply();
  }

  hostUpdated(): void {
    if (!this.isInvalid()) return;
    const revision = this.revision;
    const token = ++this.refreshToken;
    // Rebind just after the host's update so focus side effects from an
    // already-visible validation UI cannot schedule a new Lit update from
    // inside hostUpdated(). This microtask runs before updateComplete settles.
    queueMicrotask(() => {
      if (token !== this.refreshToken || revision !== this.revision) return;
      if (this.apply()) return;
      // Nested custom controls may render one microtask after their parent.
      // Retry once so an outer form can anchor inside that nested shadow tree.
      queueMicrotask(() => {
        if (token === this.refreshToken && revision === this.revision) this.apply();
      });
    });
  }

  private isInvalid(): boolean {
    return Object.values(this.flags).some(Boolean);
  }

  /** Returns true when an invalid state was installed with a real anchor. */
  private apply(): boolean {
    const anchor = this.isInvalid() ? this.getAnchor() : undefined;
    if (anchor?.isConnected) {
      try {
        this.internals.setValidity(this.flags, this.message, anchor);
        return true;
      } catch (error) {
        // A stale or incorrectly provided non-descendant anchor must not
        // break the host's update. Preserve validity and fall back to the
        // host until the next fresh render resolves a legal descendant.
        if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
      }
    }
    this.internals.setValidity(this.flags, this.message);
    return false;
  }
}
