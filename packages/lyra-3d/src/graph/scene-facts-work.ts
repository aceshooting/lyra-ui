import type { Lyra3dBounds } from '../core/orbit.js';
import type { GraphPreparedDataColumns } from './data-preparation.js';
import type { GraphNodeMeshStorage } from './node-mesh-storage.js';
import { graphSpatialNodeMeshData } from './spatial-appearance.js';
import { preflightGraphSpatialMeshes } from './spatial-composite.js';
import { GRAPH_MAX_SPATIAL_PRIMITIVES, spatialCurveExtrema, spatialEdgeSegments, type GraphSpatialData } from './spatial-paths.js';

export interface GraphSceneFacts {
  readonly bounds: Lyra3dBounds | null;
  readonly preserveDerivedBounds: boolean;
  readonly spatialEdgePrimitiveCount?: number;
  readonly customStorage?: GraphNodeMeshStorage;
}
export interface GraphSceneFactsStep {
  readonly done: boolean;
  readonly operations: number;
  readonly visitedNodes: number;
  readonly visitedEdges: number;
  readonly value?: GraphSceneFacts;
}
export interface GraphSceneFactsWork {
  step(maxOperations: number): GraphSceneFactsStep;
  dispose(): void;
}
type FactsPhase = 'setup' | 'nodes' | 'edges' | 'preflight' | 'finish';
interface FactsState {
  data: GraphPreparedDataColumns | undefined;
  guard: (() => boolean) | undefined;
  active: boolean;
  phase: FactsPhase;
  pointSize: number;
  row: number;
  spatial: boolean;
  worldSizes: boolean;
  primitiveCount: number;
  preserveDerivedBounds: boolean;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  customStorage: GraphNodeMeshStorage | undefined;
}

/**
 * Derives scene facts from exclusively owned, admitted columns. The owner keeps them unchanged
 * until completion/disposal. Each node/edge visit has fixed work; no renderer or backing buffers
 * are created. The transferred scalar facts retain no column references.
 */
export function createGraphSceneFactsWork(data: GraphPreparedDataColumns, pointSize: number, isCurrent?: () => boolean): GraphSceneFactsWork {
  const state: FactsState = {
    data, guard: isCurrent, active: true, phase: 'setup', pointSize, row: 0, spatial: false, worldSizes: false,
    primitiveCount: 0, preserveDerivedBounds: false,
    minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
    customStorage: undefined,
  };
  data = undefined as never; isCurrent = undefined;
  let running = false;
  const close = (): void => { state.active = false; state.data = undefined; state.guard = undefined; state.customStorage = undefined; };
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) {
      const error = new Error('Graph scene preparation was superseded'); error.name = 'AbortError'; throw error;
    }
  };
  const include = (x: number, y: number, z: number, radius = 0): void => {
    state.minX = Math.min(state.minX, x - radius); state.maxX = Math.max(state.maxX, x + radius);
    state.minY = Math.min(state.minY, y - radius); state.maxY = Math.max(state.maxY, y + radius);
    state.minZ = Math.min(state.minZ, z - radius); state.maxZ = Math.max(state.maxZ, z + radius);
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph scene preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph scene preparation budget');
      let operations = 0, visitedNodes = 0, visitedEdges = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint();
          const input = state.data!;
          // Empty phases advance without charging a visit to a nonexistent row.
          if (state.phase === 'nodes' && state.row === input.nodeCount) { state.phase = 'edges'; state.row = 0; }
          if (state.phase === 'edges' && (!state.spatial || state.row === input.source.length)) state.phase = 'preflight';
          switch (state.phase) {
            case 'setup':
              if (typeof state.pointSize !== 'number' || !Number.isFinite(state.pointSize) || state.pointSize < 0 || state.pointSize > 1024) {
                throw new RangeError('Invalid graph scene point size');
              }
              state.spatial = input.spatialAppearance !== undefined;
              state.worldSizes = input.spatialAppearance?.sizeUnits === 'world';
              state.phase = 'nodes';
              break;
            case 'nodes': {
              const row = state.row++, offset = row * 3;
              // Match the positive-zero radius normalization used by boundsOfPositions.
              const radius = state.worldSizes ? Math.max(0, ((input.sizes?.[row] ?? state.pointSize) / 2) || 0) : 0;
              include(input.positions[offset]!, input.positions[offset + 1]!, input.positions[offset + 2]!, radius);
              visitedNodes++;
              break;
            }
            case 'edges': {
              const edge = state.row++, appearance = input.spatialAppearance!;
              state.primitiveCount += spatialEdgeSegments(input as GraphSpatialData, edge) + (input.directed?.[edge] ? 1 : 0);
              if (state.primitiveCount > GRAPH_MAX_SPATIAL_PRIMITIVES) throw new RangeError('Graph spatial geometry exceeds its primitive limit');
              const curvature = appearance.edgeCurvatures?.[edge] ?? 0;
              if (state.minX <= state.maxX && curvature && !appearance.dangling?.[edge] && input.source[edge] !== input.target[edge]) {
                const source = input.source[edge]! * 3, target = input.target[edge]! * 3;
                const a = { x: input.positions[source]!, y: input.positions[source + 1]!, z: input.positions[source + 2]! };
                const b = { x: input.positions[target]!, y: input.positions[target + 1]!, z: input.positions[target + 2]! };
                state.preserveDerivedBounds = true;
                for (const point of spatialCurveExtrema(a, b, curvature)) {
                  // Curve extrema are merged directly; adding a zero radius could change -0.
                  state.minX = Math.min(state.minX, point.x); state.maxX = Math.max(state.maxX, point.x);
                  state.minY = Math.min(state.minY, point.y); state.maxY = Math.max(state.maxY, point.y);
                  state.minZ = Math.min(state.minZ, point.z); state.maxZ = Math.max(state.maxZ, point.z);
                }
              }
              visitedEdges++;
              break;
            }
            case 'preflight': {
              const custom = input.spatialAppearance && graphSpatialNodeMeshData(input.spatialAppearance);
              if (custom) state.customStorage = preflightGraphSpatialMeshes(input.nodeCount, state.primitiveCount, custom);
              state.phase = 'finish';
              break;
            }
            case 'finish': {
              const value: GraphSceneFacts = {
                bounds: state.minX > state.maxX ? null : {
                  min: { x: state.minX, y: state.minY, z: state.minZ }, max: { x: state.maxX, y: state.maxY, z: state.maxZ },
                },
                preserveDerivedBounds: state.preserveDerivedBounds,
                ...(state.spatial ? { spatialEdgePrimitiveCount: state.primitiveCount } : {}),
                ...(state.customStorage === undefined ? {} : { customStorage: state.customStorage }),
              };
              operations++;
              checkpoint(); close();
              return { done: true, operations, visitedNodes, visitedEdges, value };
            }
          }
          operations++;
          checkpoint();
        }
        return { done: false, operations, visitedNodes, visitedEdges };
      } catch (error) { close(); throw error; }
      finally { running = false; }
    },
    dispose: close,
  };
}
