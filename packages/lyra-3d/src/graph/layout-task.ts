import { createGraphLayoutKernel } from './layout-kernel.js';
import type { GraphLayoutInput, GraphLayoutOutput, GraphLayoutPinUpdate } from './types.js';

export type GraphTaskInput = { type: 'start'; data: GraphLayoutInput } | { type: 'pins'; update: GraphLayoutPinUpdate };
export interface GraphTaskOutput extends GraphLayoutOutput { epoch: number }

/** Shared by the worker and the time-sliced fallback. Epochs invalidate queued pre-pin frames. */
export function createGraphTaskKernel(input: GraphTaskInput) {
  if (input.type !== 'start') throw new TypeError('Graph task requires initial data');
  const kernel = createGraphLayoutKernel(input.data);
  let epoch = 0;
  return {
    step() {
      const result = kernel.step();
      return { done: result.done, output: { ...result.output, epoch } };
    },
    update(input: GraphTaskInput) {
      if (input.type !== 'pins') throw new TypeError('Replace a graph by starting a new task');
      kernel.update(input.update);
      epoch += 1;
    },
  };
}
