export type GraphSpatialColumnName = 'nodeShapes' | 'nodeColors' | 'expandable' | 'edgeColors' | 'edgeWidths' | 'dangling';
const columnLimits: Readonly<Record<GraphSpatialColumnName, number>> = {
  nodeShapes: 2, nodeColors: 1, expandable: 1, edgeColors: 1, edgeWidths: 1000, dangling: 1,
};
export function graphSpatialColumnLimit(name: GraphSpatialColumnName): number { return columnLimits[name]; }
export function isGraphSpatialMaskValue(name: GraphSpatialColumnName, value: number): boolean { return value <= graphSpatialColumnLimit(name); }
export function isGraphSpatialFloatValue(name: GraphSpatialColumnName, value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= graphSpatialColumnLimit(name);
}
export function graphSpatialSizeUnits(value: unknown): 'css' | 'world' {
  const result = value ?? 'css';
  if (result !== 'css' && result !== 'world') throw new TypeError('Invalid graph size units');
  return result;
}
export function graphSpatialDimmedOpacity(value: unknown): number {
  const result = value ?? .35;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < 0 || result > 1) throw new RangeError('Invalid graph dimmed opacity');
  return result;
}
export function graphSpatialLabelLimit(value: unknown): number {
  const result = value ?? 256;
  if (typeof result !== 'number' || !Number.isInteger(result) || result < 0 || result > 20000) throw new RangeError('Invalid graph label limit');
  return result;
}
export function isGraphCurvatureValue(value: unknown): boolean { return Number.isFinite(value); }
export function graphCurvatureValue(value: number): number { return Math.max(-1, Math.min(1, value)); }
export const GRAPH_DASH_LENGTH_LIMIT = 32;
export function isGraphDashValue(value: unknown): boolean { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e7; }
export function createGraphDashAdmission(): (pattern: readonly number[]) => void {
  const patterns = new Set(['', '4,4']);
  return pattern => {
    patterns.add(pattern.join(','));
    if (patterns.size > 65536) throw new RangeError('Too many graph dash patterns');
  };
}
export function graphSpatialSizeLimit(units: unknown): number { return units === 'world' ? 20_000_000 : 1024; }
export function isGraphSpatialSizeValue(value: number, limit: number): boolean { return Number.isFinite(value) && value >= 0 && value <= limit; }
