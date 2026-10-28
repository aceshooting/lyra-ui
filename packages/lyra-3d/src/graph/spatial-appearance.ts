/** Resolved spatial graph paint. All colors are interleaved sRGB RGBA in [0,1]. */
export interface GraphSpatialAppearance {
  /** Node sizes remain diameters (CSS up to 1024, world up to 20,000,000); world mode preserves perspective scaling. */
  readonly sizeUnits?: 'css' | 'world';
  /** 0 circle, 1 square, 2 diamond. Squares and diamonds have the circle's area. */
  readonly nodeShapes?: Uint8Array;
  readonly nodeColors?: Float32Array;
  readonly expandable?: Uint8Array;
  readonly edgeColors?: Float32Array;
  /** CSS-pixel widths in [0,1000]; zero removes line, label, arrow and pick geometry. */
  readonly edgeWidths?: Float32Array;
  /** Signed world-space quadratic bow per edge, clamped to [-1,1]. Zero is straight; loops and dangling stubs ignore it. */
  readonly edgeCurvatures?: Float32Array;
  /** One CSS-pixel dash sequence per edge, each at most 32 entries; empty means solid. At most 65,534 authored distinct patterns. */
  readonly edgeDashes?: readonly (readonly number[])[];
  /** Dangling rows draw a non-pickable stub; their layout target must equal their source. */
  readonly dangling?: Uint8Array;
  readonly dimmedOpacity?: number;
  /** Painted text rows, 0..20,000. Defaults to the companion's bounded 256-label policy. */
  readonly labelLimit?: number;
}
/** Validates and copies all appearance columns before a live graph revision changes. */
export function admitGraphSpatialAppearance(value: GraphSpatialAppearance, nodes: number, edges: number): GraphSpatialAppearance {
  if (value === null || typeof value !== 'object') throw new TypeError('Invalid graph spatial appearance');
  const bytes = (array: Uint8Array | undefined, count: number, max: number) => {
    if (array === undefined) return undefined;
    if (!(array instanceof Uint8Array) || !(array.buffer instanceof ArrayBuffer) || array.length !== count || !array.every((item) => item <= max)) throw new RangeError('Invalid graph appearance mask');
    return array.slice();
  };
  const floats = (array: Float32Array | undefined, count: number, max: number) => {
    if (array === undefined) return undefined;
    if (!(array instanceof Float32Array) || !(array.buffer instanceof ArrayBuffer) || array.length !== count || !array.every((item) => Number.isFinite(item) && item >= 0 && item <= max)) throw new RangeError('Invalid graph appearance values');
    return array.slice();
  };
  // Signed curvature has its own admission rule; paint widths and colors stay nonnegative.
  const curvatureDescriptor = Object.getOwnPropertyDescriptor(value, 'edgeCurvatures');
  if (curvatureDescriptor && !('value' in curvatureDescriptor)) throw new TypeError('Invalid graph curvature column');
  const rawCurvatures: unknown = curvatureDescriptor?.value;
  let edgeCurvatures: Float32Array | undefined;
  if (rawCurvatures !== undefined) {
    if (!(rawCurvatures instanceof Float32Array) || !(rawCurvatures.buffer instanceof ArrayBuffer) || rawCurvatures.length !== edges || !rawCurvatures.every(Number.isFinite)) throw new RangeError('Invalid graph curvature values');
    edgeCurvatures = rawCurvatures.map((curvature) => Math.max(-1, Math.min(1, curvature)));
  }
  const sizeUnits = value.sizeUnits ?? 'css', dimmedOpacity = value.dimmedOpacity ?? 0.35;
  if (sizeUnits !== 'css' && sizeUnits !== 'world') throw new TypeError('Invalid graph size units');
  const labelLimit = value.labelLimit ?? 256;
  if (!Number.isInteger(labelLimit) || labelLimit < 0 || labelLimit > 20000) throw new RangeError('Invalid graph label limit');
  if (!Number.isFinite(dimmedOpacity) || dimmedOpacity < 0 || dimmedOpacity > 1) throw new RangeError('Invalid graph dimmed opacity');
  let edgeDashes: readonly (readonly number[])[] | undefined;
  if (value.edgeDashes !== undefined) {
    if (!Array.isArray(value.edgeDashes) || value.edgeDashes.length !== edges) throw new RangeError('Invalid graph dash rows');
    const patterns = new Set(['', '4,4']);
    edgeDashes = Array.from(value.edgeDashes, (dash) => {
      if (!Array.isArray(dash) || dash.length > 32 || !Array.from(dash).every((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0 && item <= 1e7)) throw new RangeError('Invalid graph dash pattern');
      patterns.add(dash.join(',')); if (patterns.size > 65536) throw new RangeError('Too many graph dash patterns');
      return Object.freeze([...dash]);
    });
  }
  return { sizeUnits, dimmedOpacity, labelLimit, nodeShapes: bytes(value.nodeShapes, nodes, 2), nodeColors: floats(value.nodeColors, nodes * 4, 1), expandable: bytes(value.expandable, nodes, 1), edgeColors: floats(value.edgeColors, edges * 4, 1), edgeWidths: floats(value.edgeWidths, edges, 1000), edgeCurvatures, dangling: bytes(value.dangling, edges, 1), edgeDashes };
}

/** Explicit spatial glyph bounds keep derived loop coordinates finite in GPU attributes. */
export function validateGraphSpatialSizes(sizes: Float32Array | undefined, count: number, appearance: GraphSpatialAppearance): void {
  if (sizes === undefined) return;
  const limit = appearance.sizeUnits === 'world' ? 20_000_000 : 1024;
  if (!(sizes instanceof Float32Array) || !(sizes.buffer instanceof ArrayBuffer) || sizes.length !== count || !sizes.every((size) => Number.isFinite(size) && size >= 0 && size <= limit)) throw new RangeError('Graph spatial diameters exceed the supported range');
}
