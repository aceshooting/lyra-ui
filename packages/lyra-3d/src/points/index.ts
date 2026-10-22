import { createPointsEngine } from './engine.js';

export type { PointsEngine, PointsEngineData, PointsMode, PointsAxis, PointsAxisTick, PointsAxisName } from './types.js';
export function createEngine() { return createPointsEngine(); }
