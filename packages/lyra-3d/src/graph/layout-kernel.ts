import { snapshotGraphLayoutInput } from './layout-admission.js';
import { createGraphLayoutProgress } from './layout-progress.js';
import type { GraphLayoutInput, GraphLayoutKernel } from './types.js';

/** Synchronous snapshot-on-call solver; each step drains one complete iteration. */
export function createGraphLayoutKernel(input: GraphLayoutInput): GraphLayoutKernel {
  const kernel = createGraphLayoutProgress(snapshotGraphLayoutInput(input));
  kernel.initialize();
  return {
    update: kernel.update,
    step() {
      for (;;) {
        const result = kernel.advance(65536);
        if (result.output) return { done: result.done, output: result.output };
      }
    },
  };
}
