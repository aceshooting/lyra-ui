import type { LyraOrientation, LyraToolStatus } from '../../../internal/shared-unions.js';
import type { LyraVariant } from '../../../internal/variants.js';

/** A named input/output connection point on a flow node. */
export interface FlowHandle {
  readonly id: string;
  readonly label?: string;
}

/** A controlled node in a flow canvas. `id` must be nonempty and unique within `nodes`; the
 * first valid occurrence wins. Reassign the collection to publish model changes. */
export interface FlowNode {
  readonly id: string;
  /**
   * Consumer taxonomy. Adopted cards receive the exact value as `data-node-type`; declarative
   * fallback cards expose a normalized `node-type-{value}` CSS part that can inherit node tokens.
   */
  readonly type?: string;
  /** Content coordinates. Absent means that the shared layered layout places the node. */
  readonly position?: Readonly<{ x: number; y: number }>;
  /** The fallback card reads string `label`/`description` fields; arbitrary otherwise. */
  readonly data?: Readonly<Record<string, unknown>>;
  /** Spoken-name override; falls back to `data.label`, then `id`. */
  readonly accessibleLabel?: string;
  readonly inputs?: readonly FlowHandle[];
  readonly outputs?: readonly FlowHandle[];
}

/** A directed edge in a flow canvas. `id` must be nonempty and unique within `edges`; the first
 * valid occurrence wins. */
export interface FlowEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string;
  readonly targetHandle?: string;
  /** Drawn at the edge midpoint (unlike `lr-graph`'s spoken-only link label). */
  readonly label?: string;
  /** Semantic edge color. The shared vocabulary uses `brand`, not the removed `accent` value. */
  readonly tone?: LyraVariant;
}

/** Execution decoration for a node or edge. Invalid statuses are omitted at the input boundary. */
export interface FlowRunDecoration {
  readonly status: LyraToolStatus;
  readonly progress?: number;
  readonly durationMs?: number;
  readonly detail?: string;
}

export type FlowRunDecorations = Readonly<Record<string, Readonly<FlowRunDecoration>>>;

export interface FlowStructureNodeSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly status?: LyraToolStatus;
}

export interface FlowStructureEdgeSnapshot {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly status?: LyraToolStatus;
}

export interface FlowViewportSnapshot {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
  /** Finite, positive, sorted bounds actually used by the canvas. */
  readonly minZoom: number;
  readonly maxZoom: number;
}

/** Detached, deeply frozen state delivered to each companion observer. */
export interface FlowStructureSnapshot {
  readonly nodes: readonly FlowStructureNodeSnapshot[];
  readonly edges: readonly FlowStructureEdgeSnapshot[];
  readonly viewport: FlowViewportSnapshot;
  readonly locked: boolean;
  readonly orientation: LyraOrientation;
  readonly layerGap: number;
  readonly nodeGap: number;
}

export interface FlowLayoutChangeDetail {
  readonly positions: Readonly<Record<string, Readonly<{ x: number; y: number }>>>;
  /** True when the configured layered-layout work ceiling omitted virtual ordering waypoints. */
  readonly truncated: boolean;
}

/** The drag/drop MIME type shared by the node palette and flow canvas. */
export const FLOW_PALETTE_MIME_TYPE = 'application/lr-flow-node';
