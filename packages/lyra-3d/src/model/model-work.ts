export interface ModelWorkBudget { readonly bytes: number; readonly scalars: number; readonly records: number }
export interface ModelWorkUsed { readonly bytes: number; readonly scalars: number; readonly records: number }
export type ModelWorkStep<T> = { readonly done: false; readonly used: ModelWorkUsed } | { readonly done: true; readonly used: ModelWorkUsed; readonly value: T };
export interface ModelIncrementalWork<T> { step(budget: ModelWorkBudget): ModelWorkStep<T>; dispose(): void }
export type ModelWorkUnit = keyof ModelWorkBudget;

export class ModelWorkMeter {
  private readonly limits: ModelWorkBudget;
  private readonly spent = { bytes: 0, scalars: 0, records: 0 };
  constructor(budget: ModelWorkBudget) {
    for (const value of [budget.bytes, budget.scalars, budget.records]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError('Model work budgets must be positive safe integers');
    }
    this.limits = { ...budget };
  }
  take(unit: ModelWorkUnit, count = 1): boolean {
    if (!Number.isSafeInteger(count) || count <= 0) throw new RangeError('Model work units must be positive safe integers');
    if (count > this.remaining(unit)) return false;
    this.spent[unit] += count; return true;
  }
  remaining(unit: ModelWorkUnit): number { return this.limits[unit] - this.spent[unit]; }
  get used(): ModelWorkUsed { return { ...this.spent }; }
}

export function drainModelWork<T>(work: ModelIncrementalWork<T>, budget: ModelWorkBudget = { bytes: 65536, scalars: 4096, records: 64 }): T {
  try {
    for (;;) {
      const step = work.step(budget);
      if (step.done) return step.value;
      if (step.used.bytes + step.used.scalars + step.used.records === 0) throw new Error('Model work made no progress');
    }
  } catch (error) {
    try { work.dispose(); } catch { /* Cleanup cannot replace the original admission failure. */ }
    throw error;
  }
}
