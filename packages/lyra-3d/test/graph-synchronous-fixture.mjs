import { validateGraphLayoutInputProgress } from '../dist/graph/layout-admission.js';
import { createGraphLayoutProgress } from '../dist/graph/layout-progress.js';
import * as octree from '../dist/graph/octree.js';

export * from '../dist/graph/layout-task.js';

/** Synchronous snapshot-on-call solver; each step drains one complete iteration. */
export function createGraphLayoutKernel(input) {
  const options = octree.drainGraphProgress(validateGraphLayoutInputProgress(input, { remaining: Infinity }));
  const snapshot = { nodeCount: input.nodeCount, options, source: input.source.slice(), target: input.target.slice(),
    ...(input.positions ? { positions: input.positions.slice() } : {}),
    ...(input.pinned ? { pinned: input.pinned.slice() } : {}) };
  const kernel = createGraphLayoutProgress(snapshot);
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

/** Synchronous task adapter retaining complete-iteration snapshots and pin epochs. */
export function createGraphTaskKernel(input) {
  if (input.type !== 'start') throw new TypeError('Graph task requires initial data');
  const kernel = createGraphLayoutKernel(input.data);
  let epoch = 0;
  return {
    step() {
      const result = kernel.step();
      return { done: result.done, output: { ...result.output, epoch } };
    },
    update(input) {
      if (input.type !== 'pins') throw new TypeError('Replace a graph by starting a new task');
      kernel.update(input.update);
      epoch += 1;
    },
  };
}

/** Drain production traversal without introducing a second numerical implementation. */
export function buildGraphOctree(input) {
  return octree.drainGraphProgress(octree.buildGraphOctreeProgress(input, { remaining: Infinity }));
}

export function graphChargeForces(tree, strength, theta, softening) {
  return octree.drainGraphProgress(octree.graphChargeForcesProgress(tree, strength, theta, softening, { remaining: Infinity }));
}
