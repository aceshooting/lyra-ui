interface ControlsGeneration {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  run: number;
  stop?: () => void;
  error?: Error;
}

function aborted(): DOMException {
  return new DOMException('Map controls readiness was cancelled.', 'AbortError');
}

/** A connection/configuration barrier independent of style replacement and native idle events. */
export class MapControlsReadiness {
  private generation?: ControlsGeneration;

  reset(): void {
    this.cancel();
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    void promise.catch(() => undefined);
    this.generation = { promise, resolve, reject, run: 0 };
  }

  whenReady(): Promise<void> {
    const generation = this.generation;
    return generation?.error ? Promise.reject(generation.error) : generation?.promise ?? Promise.reject(aborted());
  }

  /** Repeated synchronization supersedes pending imports without cancelling the configuration. */
  begin(): { isCurrent: () => boolean; cancelled: Promise<void>; resolve: () => void; fail: () => void } {
    const generation = this.generation;
    generation?.stop?.();
    const cancelled = new Promise<void>(resolve => { if (generation) generation.stop = resolve; else resolve(); });
    const run = generation ? ++generation.run : 0;
    const isCurrent = (): boolean => generation !== undefined && this.generation === generation && generation.run === run;
    return { isCurrent, cancelled,
      resolve: () => { if (isCurrent() && !generation!.error) generation!.resolve(); },
      fail: () => { if (isCurrent()) this.fail(); },
    };
  }

  fail(): void {
    const generation = this.generation;
    if (!generation || generation.error) return;
    const error = new Error('Map controls readiness failed.');
    error.name = 'MapReadinessError';
    generation.error = error;
    generation.reject(error);
  }

  cancel(): void {
    const previous = this.generation;
    this.generation = undefined;
    previous?.stop?.();
    previous?.reject(aborted());
  }
}
