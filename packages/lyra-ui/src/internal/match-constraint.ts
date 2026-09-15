import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * A declarative `match` constraint target: a sibling field's id (looked up in the host's own root
 * node — an idref never crosses a shadow boundary, mirroring every other idref this library
 * resolves, `internal/aria-controls.ts` included) or a direct element reference (works across
 * shadow trees, since resolving one requires no lookup at all).
 */
export type LyraMatchTarget = string | HTMLElement | null;

/**
 * Resolves a `match` target to a live element. Never throws: a dangling id, a root with no
 * `getElementById` (an exotic root), or any other unresolved reference all answer `null`, so a
 * `match` constraint that cannot be resolved is silently inert rather than permanently blocking
 * submission.
 */
export function resolveMatchConstraintTarget(
  host: Element,
  match: LyraMatchTarget,
): HTMLElement | null {
  if (!match) return null;
  if (typeof match !== 'string') return match instanceof HTMLElement ? match : null;
  const root = host.getRootNode() as Document | ShadowRoot;
  if (!('getElementById' in root)) return null;
  const resolved = root.getElementById(match);
  return resolved instanceof HTMLElement ? resolved : null;
}

/**
 * Reads the comparable string value off a resolved match target — any element exposing a plain
 * string `.value` (a native `<input>`/`<textarea>`, or a lyra form control). `null` when the
 * target has none, so a constraint pointed at a value-less element never runs.
 */
export function readMatchConstraintValue(target: HTMLElement | null): string | null {
  if (!target) return null;
  const value = (target as Partial<{ value: unknown }>).value;
  return typeof value === 'string' ? value : null;
}

/**
 * Keeps a `match` constraint's referenced field resolved and re-runs the host's own validity
 * whenever that referenced field's value changes — so a confirm-password-shaped pair revalidates
 * as the user edits either field, not only the one carrying the constraint.
 *
 * Rebinds its `input`/`change` listeners whenever the resolved target changes (a different id, an
 * element reference swapped out, or the reference newly resolving/ceasing to resolve), checked on
 * every host connect and after every host update — cheap, since resolution is one
 * `getElementById()` call.
 */
export class MatchConstraintController implements ReactiveController {
  private target: HTMLElement | null = null;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly getMatch: () => LyraMatchTarget,
    private readonly onTargetValueChange: () => void,
  ) {
    host.addController(this);
  }

  private readonly handleTargetChange = (): void => {
    this.onTargetValueChange();
  };

  hostConnected(): void {
    this.sync();
  }

  hostUpdated(): void {
    this.sync();
  }

  hostDisconnected(): void {
    this.unbind();
  }

  private sync(): void {
    const resolved = resolveMatchConstraintTarget(this.host, this.getMatch());
    if (resolved === this.target) return;
    this.unbind();
    this.target = resolved;
    if (resolved) {
      resolved.addEventListener('input', this.handleTargetChange);
      resolved.addEventListener('change', this.handleTargetChange);
    }
    this.onTargetValueChange();
  }

  private unbind(): void {
    if (!this.target) return;
    this.target.removeEventListener('input', this.handleTargetChange);
    this.target.removeEventListener('change', this.handleTargetChange);
    this.target = null;
  }

  /** Whether `match` currently resolves to a live element — `false` for an unset constraint or a
   *  dangling reference, so a caller can tell "no constraint" apart from "constraint satisfied". */
  get hasTarget(): boolean {
    return this.target !== null;
  }

  /** The resolved target's current comparable value, or `null` when unresolved or non-comparable. */
  get targetValue(): string | null {
    return readMatchConstraintValue(this.target);
  }
}
