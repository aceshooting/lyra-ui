/**
 * Monotonic generation tokens for async work whose older results must be ignored after a newer
 * invocation begins. Connectivity and abort checks remain the caller's responsibility.
 */
export class LatestTask {
  #generation = 0;

  next(): number {
    return ++this.#generation;
  }

  isCurrent(token: number): boolean {
    return token === this.#generation;
  }

  invalidate(): void {
    this.#generation++;
  }
}

