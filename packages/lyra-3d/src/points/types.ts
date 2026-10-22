import type { Lyra3dEngine } from '../core/contract.js';
import type { Lyra3dOrbitCamera } from '../core/orbit.js';

export type PointsMode = '2d' | '3d';
export type PointsAxisName = 'x' | 'y' | 'z';
export interface PointsAxisTick { readonly value: number; readonly label: string }
/** All labels, including units and tick formatting, are supplied as plain text by the component. */
export interface PointsAxis {
  readonly axis: PointsAxisName;
  readonly min: number;
  readonly max: number;
  readonly label?: string;
  readonly ticks: readonly PointsAxisTick[];
  readonly grid?: boolean;
}
export interface PointsEngineData {
  /** Interleaved xyz, at most one million rows, each coordinate within ±10,000,000. */
  readonly positions: Float32Array;
  /** CSS-pixel diameters, from zero to 1024. Missing values use the resolved point size. */
  readonly sizes?: Float32Array;
  readonly categories?: Uint16Array;
  /** Interleaved linear-sRGB channels, exactly three per row, each finite in [0, 1]. Matches
   * default Three loader vertex-color attributes after source sRGB conversion. Overrides category
   * colors; focus, selection/hover and forced colors still take precedence. */
  readonly colors?: Float32Array;
  /** Plain-text labels, capped to 256 characters each and a bounded visible subset. */
  readonly labels?: readonly string[];
  /** Endpoint row-index pairs, at most one million segments. Lines do not add pick identities.
   * Segments with either endpoint behind the camera near plane are hidden. */
  readonly segments?: Uint32Array;
  /** 2D flattens z and locks yaw/pitch; core pan gestures remain available. */
  readonly mode?: PointsMode;
  /** At most three unique axes, with at most 128 component-formatted ticks each. */
  readonly axes?: readonly PointsAxis[];
}
export type PointsEngine = Lyra3dEngine<PointsEngineData, Lyra3dOrbitCamera>;
