import { aborted } from './model-parser-common.js';
import type { ModelIncrementalWork } from './model-work.js';

const budget = Object.freeze({ bytes: 4096, scalars: 4096, records: 64 });
const taskMilliseconds = 8;

/** Primitive caps bound each step; the clock decides when to yield between steps. */
export function runModelWork<T>(work: ModelIncrementalWork<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let terminal = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => { if (timer !== undefined) clearTimeout(timer); timer = undefined; signal?.removeEventListener('abort', cancel); };
    const fail = (error: unknown): void => { if (terminal) return; terminal = true; cleanup(); try { work.dispose(); } catch { /* Preserve the operation's failure. */ } reject(error); };
    const cancel = (): void => fail(new DOMException('Model preparation was aborted', 'AbortError'));
    const slice = (): void => {
      timer = undefined; if (terminal) return;
      const deadline = performance.now() + taskMilliseconds;
      try {
        do {
          aborted(signal); const step = work.step(budget);
          if (step.done) { terminal = true; cleanup(); resolve(step.value); return; }
          if (step.used.bytes + step.used.scalars + step.used.records === 0) throw new Error('Model work made no progress');
        } while (performance.now() < deadline);
      } catch (error) { fail(error); return; }
      timer = setTimeout(slice, 0);
    };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel(); else timer = setTimeout(slice, 0);
  });
}
