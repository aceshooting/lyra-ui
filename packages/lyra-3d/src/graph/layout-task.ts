import { createGraphLayoutProgress } from './layout-progress.js';
import type { GraphLayoutProgress } from './layout-progress.js';
import type { GraphLayoutInput, GraphLayoutOutput, GraphLayoutPinUpdate } from './types.js';

export type GraphTaskInput = { type: 'start'; data: GraphLayoutInput } | { type: 'pins'; update: GraphLayoutPinUpdate };
export interface GraphTaskOutput extends GraphLayoutOutput { epoch: number }

/** Internal adapter for an exclusively owned start snapshot, with bounded numerical steps. */
export function createGraphIncrementalTaskKernel(input: GraphTaskInput, options: { operationsPerStep?: number } = {}) {
  if (input.type !== 'start') throw new TypeError('Graph task requires initial data');
  const operationsPerStep = options.operationsPerStep ?? 256;
  if (!Number.isSafeInteger(operationsPerStep) || operationsPerStep < 1) throw new RangeError('Invalid graph operation budget');
  const kernel = createGraphLayoutProgress(input.data);
  let epoch = 0;
  return {
    get progress(): GraphLayoutProgress & { readonly epoch: number } { return { ...kernel.progress, epoch }; },
    step() {
      const result = kernel.advance(operationsPerStep);
      return result.output ? { done: result.done, output: { ...result.output, epoch } } : { done: false };
    },
    update(input: GraphTaskInput) {
      if (input.type !== 'pins') throw new TypeError('Replace a graph by starting a new task');
      kernel.update(input.update);
      epoch += 1;
    },
  };
}
