import { ModelWorkMeter, type ModelIncrementalWork, type ModelWorkUnit } from './model-work.js';

export interface ModelWorkBatch {
  readonly unit: ModelWorkUnit;
  /** Consume at most limit units; unfinished batches must consume at least one. */
  run(limit: number): { readonly used: number; readonly done: boolean };
}
export type ModelWorkRequest = ModelWorkUnit | ModelWorkBatch;
export type ModelWorkGenerator<T> = Generator<ModelWorkRequest, T, void>;

const MAX_BATCH_UNITS = 4096;

/** Generators request a unit before performing its bounded operation. */
export function createModelGeneratorWork<T>(factory: () => ModelWorkGenerator<T>): ModelIncrementalWork<T> {
  let initialize: (() => ModelWorkGenerator<T>) | undefined = factory;
  let generator: ModelWorkGenerator<T> | undefined;
  let request: IteratorResult<ModelWorkRequest, T> | undefined;
  let terminal = false;
  return {
    step(budget) {
      if (terminal) throw new Error('Model work is no longer active');
      const meter = new ModelWorkMeter(budget);
      try {
        if (!generator) { generator = initialize!(); initialize = undefined; }
        request ??= generator.next();
        while (!request.done) {
          if (typeof request.value === 'string') {
            if (!meter.take(request.value)) return { done: false, used: meter.used };
            request = generator.next();
          } else {
            const batch = request.value;
            const limit = Math.min(MAX_BATCH_UNITS, meter.remaining(batch.unit));
            if (limit === 0) return { done: false, used: meter.used };
            const result = batch.run(limit);
            if (!Number.isSafeInteger(result.used) || result.used < 0 || result.used > limit || (!result.done && result.used === 0)) throw new Error('Invalid model batch progress');
            if (result.used > 0) meter.take(batch.unit, result.used);
            if (result.done) request = generator.next();
          }
        }
        terminal = true;
        const value = request.value;
        generator = undefined; request = undefined;
        return { done: true, used: meter.used, value };
      } catch (error) {
        terminal = true;
        const active = generator; generator = undefined; request = undefined; initialize = undefined;
        try { active?.return(undefined as T); } catch { /* Preserve the original failure. */ }
        throw error;
      }
    },
    dispose() {
      terminal = true;
      const active = generator; generator = undefined; request = undefined; initialize = undefined;
      active?.return(undefined as T);
    },
  };
}
