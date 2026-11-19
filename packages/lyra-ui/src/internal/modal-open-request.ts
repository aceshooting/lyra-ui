/**
 * Re-entrancy guard for a modal's cancelable open/close preflight (`lr-show`, `lr-hide`, ...).
 * While a preflight runs, every `open` write or `show()`/`hide()` call is captured instead of
 * starting a nested transition: a same-direction request coalesces into the running one, and the
 * last opposite request supersedes it once its events return.
 */
export class ModalOpenRequest {
  private target: boolean | undefined;
  private duringPreflight: boolean | undefined;

  /** True while a preflight is running. */
  get active(): boolean {
    return this.target !== undefined;
  }

  /** Captures a request made during a running preflight; `true` means the caller must return. */
  coalesce(next: boolean): boolean {
    if (this.target === undefined) return false;
    this.duringPreflight = next;
    return true;
  }

  /** Starts the preflight for a transition towards `next`. */
  begin(next: boolean): void {
    this.target = next;
    this.duringPreflight = undefined;
  }

  /** Whether the latest request captured during the preflight points the other way. */
  superseded(next: boolean): boolean {
    return this.duringPreflight !== undefined && this.duringPreflight !== next;
  }

  /** Ends the preflight; call on every exit path before committing or bailing out. */
  finish(): void {
    this.target = undefined;
    this.duringPreflight = undefined;
  }
}
