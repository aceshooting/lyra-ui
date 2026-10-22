/** Pure force-layout parameters. Distances use the graph's world-coordinate units. */
export interface GraphLayoutOptions {
  readonly seed?: number;
  /** Non-negative inverse-square repulsion strength. */
  readonly charge?: number;
  readonly linkStrength?: number;
  readonly linkDistance?: number;
  readonly centerStrength?: number;
  /** Barnes-Hut opening ratio; zero traverses individual bodies except bounded terminal buckets. */
  readonly theta?: number;
  readonly softening?: number;
  /** Velocity retained each step, in [0, 1). */
  readonly damping?: number;
  readonly maxSpeed?: number;
  readonly maxSteps?: number;
  readonly cooling?: number;
  readonly minAlpha?: number;
  readonly tolerance?: number;
  readonly stableSteps?: number;
}

export interface GraphLayoutInput {
  readonly nodeCount: number;
  /** Interleaved xyz. Omitted positions are initialized deterministically from the seed. */
  readonly positions?: Float32Array;
  /** One 0/1 per node. Explicit positions default to pinned; generated positions default free. */
  readonly pinned?: Uint8Array;
  readonly source: Uint32Array;
  readonly target: Uint32Array;
  readonly options?: GraphLayoutOptions;
}

/** Atomic drag/pin transaction. Duplicate indices are rejected; arrays are copied on admission. */
export interface GraphLayoutPinUpdate {
  readonly indices: Uint32Array;
  readonly positions: Float32Array;
  readonly pinned: Uint8Array;
}

export interface GraphLayoutOutput {
  /** Fresh, transferable xyz buffer; never aliases the kernel's live state. */
  readonly positions: Float32Array;
  readonly iteration: number;
  readonly alpha: number;
  readonly maxSpeed: number;
}

export interface GraphLayoutKernel {
  step(): { readonly done: boolean; readonly output: GraphLayoutOutput };
  update(input: GraphLayoutPinUpdate): void;
}
