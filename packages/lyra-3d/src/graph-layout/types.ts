/** Directed edges refer to original node rows. */
export interface GraphDagLayoutInput {
  readonly nodeCount: number;
  readonly source: Uint32Array;
  readonly target: Uint32Array;
}
export type GraphDagDirection = 'x' | '-x' | 'y' | '-y' | 'z' | '-z';
export interface GraphDagLayoutOptions {
  readonly direction?: GraphDagDirection;
  readonly layerGap?: number;
  readonly nodeGap?: number;
}
export interface GraphDagLayoutResult {
  readonly positions: Float32Array;
  readonly ranks: Uint32Array;
  readonly layerCount: number;
}
export type GraphDagLayoutPhase = 'snapshot' | 'adjacency' | 'rank' | 'place' | 'complete';
export interface GraphDagLayoutProgress {
  readonly phase: GraphDagLayoutPhase;
  readonly operations: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
}
export interface GraphDagLayoutExecution {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: GraphDagLayoutProgress) => void;
}
export type GraphDagLayoutErrorCode = 'invalid-input' | 'invalid-options' | 'limit-exceeded' | 'cyclic-graph' | 'coordinate-range';
const messages: Record<GraphDagLayoutErrorCode, string> = {
  'invalid-input': 'Invalid directed graph input.',
  'invalid-options': 'Invalid directed graph layout options.',
  'limit-exceeded': 'Directed graph layout limits exceeded.',
  'cyclic-graph': 'Directed graph contains a cycle.',
  'coordinate-range': 'Directed graph layout exceeds the coordinate range.'
};
export class GraphDagLayoutError extends Error {
  readonly code: GraphDagLayoutErrorCode;
  constructor(code: GraphDagLayoutErrorCode) {
    if (typeof code !== 'string' || !Object.hasOwn(messages, code)) throw new TypeError('Invalid directed graph layout error code.');
    super(messages[code]);
    this.name = 'GraphDagLayoutError';
    this.code = code;
  }
}
