import type { GraphNodeLabelsMode } from './decorations.js';

const MAX_LABEL_LENGTH = 256;
const MAX_LABEL_TEXT = 4 * 1024 * 1024;
export type GraphDecorationScalarName = 'edgeLabelMinZoom' | 'particlesPerEdge' | 'particleSpeed';
const scalarOptions: Readonly<Record<GraphDecorationScalarName, readonly [number, number, number, boolean]>> = {
  edgeLabelMinZoom: [.6, .001, 1000, false],
  particlesPerEdge: [0, 0, 8, true],
  particleSpeed: [.25, 0, 10, false],
};

/** One combined raw UTF-16 text budget for node and edge labels. */
export function createGraphLabelAdmission(): (value: unknown) => string {
  let total = 0;
  return value => {
    if (typeof value !== 'string') throw new TypeError('Graph labels must be plain strings');
    total += value.length;
    if (total > MAX_LABEL_TEXT) throw new RangeError('Graph label text exceeds its limit');
    return value.slice(0, MAX_LABEL_LENGTH);
  };
}
export function graphDecorationMode(value: unknown): GraphNodeLabelsMode {
  const mode = value ?? 'zoom';
  if (mode !== 'always' && mode !== 'zoom' && mode !== 'none') throw new RangeError('Invalid graph label mode');
  return mode;
}
/** Undefined defaults at the caller boundary; a supplied value must be boolean. */
export function graphEdgeLabelsVisible(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Invalid graph edge label visibility');
  return value;
}
export function graphDecorationScalar(name: GraphDecorationScalarName, value: unknown): number {
  const [fallback, min, max, integer] = scalarOptions[name];
  const result = value ?? fallback;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
    throw new RangeError('Invalid graph decoration option');
  }
  return result;
}
export function isGraphDirectedValue(value: unknown): boolean { return value === 0 || value === 1; }
