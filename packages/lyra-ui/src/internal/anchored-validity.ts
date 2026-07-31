import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** @internal */
export const VALIDITY_ANCHOR = Symbol('lr-validity-anchor');

/** @internal */
export const SET_ANCHORED_VALIDITY = Symbol('lr-set-anchored-validity');

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
 * It also owns the two-layer validity model every control needs to support
 * `setCustomValidity()`: the *intrinsic* state a control recomputes from its
 * own constraints on every change (`setValidity()`), and the *custom* error a
 * consumer sets out of band (`setCustomValidity()`, typically a server-side
 * rejection). Keeping both layers here is what makes the custom error survive
 * the constant `setValidity()` traffic — a control calls `setValidity()` many
 * times per interaction, and every one of those calls would otherwise wipe the
 * consumer's error out.
 *
 * @internal
 */
export class AnchoredValidityController implements ReactiveController {
  /** Effective state actually handed to `internals.setValidity()`: intrinsic + custom overlay. */
  private flags: ValidityStateFlags = {};
  private message = '';
  /** Last state the control computed from its own constraints. */
  private intrinsicFlags: ValidityStateFlags = {};
  private intrinsicMessage = '';
  /** Consumer-supplied error; empty means "no custom error". */
  private customMessage = '';
  private revision = 0;
  private refreshToken = 0;

  constructor(
    host: ReactiveControllerHost,
    private readonly internals: ElementInternals,
    private readonly getAnchor: () => HTMLElement | null | undefined,
  ) {
    host.addController(this);
  }

  /** The control's own constraint state. Never clears a custom error — see `commit()`. */
  setValidity(flags: ValidityStateFlags = {}, message = ''): void {
    this.intrinsicFlags = { ...flags };
    this.intrinsicMessage = message;
    this.commit();
  }

  /**
   * Consumer-supplied validation error, layered on top of the intrinsic state. A non-empty
   * `message` raises `customError` and takes over `validationMessage` (native precedence);
   * `''` clears it and republishes whatever the control's own constraints last computed — a
   * cleared custom error must never be able to mark an intrinsically invalid control valid.
   */
  setCustomValidity(message: string): void {
    this.customMessage = message ?? '';
    this.commit();
  }

  /** The current custom error message, or `''` when none is set. */
  get customValidityMessage(): string {
    return this.customMessage;
  }

  /** Recomputes the effective state from both layers and pushes it to `ElementInternals`. */
  private commit(): void {
    // Spread the intrinsic flags through untouched when there is no custom error, so behavior is
    // byte-for-byte what it was before custom validity existed.
    this.flags = this.customMessage
      ? { ...this.intrinsicFlags, customError: true }
      : { ...this.intrinsicFlags };
    this.message = this.customMessage || this.intrinsicMessage;
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
