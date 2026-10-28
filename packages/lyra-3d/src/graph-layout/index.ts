import { admitGraphDag, SYNC_LIMITS } from './admission.js';
import { createGraphDagKernel } from './kernel.js';
import type { GraphDagLayoutInput, GraphDagLayoutOptions, GraphDagLayoutResult } from './types.js';
export { GraphDagLayoutError } from './types.js';
export type { GraphDagDirection, GraphDagLayoutErrorCode, GraphDagLayoutExecution, GraphDagLayoutInput, GraphDagLayoutOptions, GraphDagLayoutPhase, GraphDagLayoutProgress, GraphDagLayoutResult } from './types.js';
export { layoutGraphDagAsync } from './async.js';

/** Deterministic longest-path layering for small directed acyclic graphs. */
export function layoutGraphDag(input: GraphDagLayoutInput, options?: GraphDagLayoutOptions): GraphDagLayoutResult {
  const kernel = createGraphDagKernel(admitGraphDag(input, options, SYNC_LIMITS));
  let step = kernel.next();
  while (!step.done) step = kernel.next();
  return step.value;
}
