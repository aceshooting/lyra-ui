import { createGraphDataColumnWork, type GraphDataColumnInput, type GraphDataColumns, type GraphDataColumnWork } from './data-columns-work.js';
import { createGraphDecorationWork, type GraphDecorationWork } from './data-appearance-work.js';
import type { GraphDecorationData } from './decorations.js';
import { createGraphSpatialAppearanceWork, type GraphSpatialAppearance, type GraphSpatialAppearanceWork } from './spatial-appearance.js';
import { graphSpatialSizeLimit, isGraphSpatialSizeValue } from './spatial-appearance-admission.js';
import type { GraphLayoutInput } from './types.js';

export interface GraphDataPreparationInput extends GraphDataColumnInput, GraphDecorationData {
  readonly spatialAppearance?: GraphSpatialAppearance;
}
export interface GraphPreparedDataColumns extends GraphDataColumns, GraphDecorationData {
  readonly positions: Float32Array;
  readonly pinned: Uint8Array;
  readonly spatialAppearance?: GraphSpatialAppearance;
}
export interface GraphPreparedStartData extends GraphLayoutInput {
  readonly positions: Float32Array;
  readonly pinned: Uint8Array;
}
/** Owned pre-scene data; presentation admission and actual solver submission are separate. */
export interface GraphPreparedData {
  readonly data: GraphPreparedDataColumns;
  readonly start: { readonly type: 'start'; readonly data: GraphPreparedStartData };
}
export interface GraphDataPreparationStep {
  readonly done: boolean;
  readonly operations: number;
  readonly allocatedBytes: number;
  readonly copiedTextUnits: number;
  readonly reflectedKeys: number;
  readonly copiedDashValues: number;
  readonly value?: GraphPreparedData;
}
export interface GraphDataPreparationWork {
  step(maxOperations: number): GraphDataPreparationStep;
  dispose(): void;
}
type PreparationPhase = 'numerical-setup' | 'numerical' | 'numerical-adopt'
  | 'decoration-setup' | 'decoration' | 'decoration-adopt'
  | 'appearance-capture' | 'appearance-setup' | 'appearance' | 'appearance-adopt'
  | 'sizes-setup' | 'sizes' | 'dangling-setup' | 'dangling'
  | 'positions-setup' | 'positions' | 'pins-setup' | 'pins'
  | 'start-positions-setup' | 'start-positions' | 'start-pins-setup' | 'start-pins' | 'finalize';
type PreparationChild = GraphDataColumnWork | GraphDecorationWork | GraphSpatialAppearanceWork;
type ChildValue = GraphDataColumns | GraphDecorationData | GraphSpatialAppearance;
interface ChildStep {
  readonly done: boolean;
  readonly operations: number;
  readonly allocatedBytes: number;
  readonly copiedTextUnits?: number;
  readonly reflectedKeys?: number;
  readonly copiedDashValues?: number;
  readonly value?: ChildValue;
}
interface PreparationState {
  raw: GraphDataPreparationInput | undefined;
  rawAppearance: unknown;
  guard: (() => boolean) | undefined;
  active: boolean;
  phase: PreparationPhase;
  child: PreparationChild | undefined;
  completed: ChildValue | undefined;
  columns: GraphDataColumns | undefined;
  decoration: GraphDecorationData | undefined;
  appearance: GraphSpatialAppearance | undefined;
  positions: Float32Array | undefined;
  pins: Uint8Array | undefined;
  startPositions: Float32Array | undefined;
  startPins: Uint8Array | undefined;
  offset: number;
  seed: number;
  radius: number;
  sizeLimit: number;
  explicitPositions: boolean;
}

/**
 * Composes owned admission without creating a scene or solver. Raw input is borrowed unchanged
 * until completion/disposal. Native allocation and child enumeration remain indivisible.
 */
export function createGraphDataPreparationWork(input: GraphDataPreparationInput, isCurrent?: () => boolean): GraphDataPreparationWork {
  const state: PreparationState = {
    raw: input, rawAppearance: undefined, guard: isCurrent, active: true, phase: 'numerical-setup',
    child: undefined, completed: undefined, columns: undefined, decoration: undefined, appearance: undefined,
    positions: undefined, pins: undefined, startPositions: undefined, startPins: undefined,
    offset: 0, seed: 1, radius: 10, sizeLimit: 1024, explicitPositions: false,
  };
  input = undefined as never; isCurrent = undefined;
  let running = false;
  // Distinguish a guard exception from a child failure so another guard call cannot replace it.
  let guardFailure: { readonly value: unknown } | undefined;
  const checkpoint = (): void => {
    const guard = state.guard;
    let current = state.active;
    if (current && guard) {
      try { current = guard(); }
      catch (error) { guardFailure = { value: error }; throw error; }
    }
    if (!current || !state.active) {
      const error = new Error('Graph data preparation was superseded'); error.name = 'AbortError';
      guardFailure = { value: error }; throw error;
    }
  };
  const parentGuard = (): boolean => { checkpoint(); return true; };
  const fenced = <Value>(operation: () => Value): Value => {
    checkpoint();
    let result: Value;
    try { result = operation(); }
    catch (error) {
      if (guardFailure && Object.is(guardFailure.value, error)) throw error;
      checkpoint(); throw error;
    }
    checkpoint(); return result;
  };
  const close = (): void => {
    state.active = false; state.raw = undefined; state.rawAppearance = undefined; state.guard = undefined;
    if (running) return;
    try { state.child?.dispose(); }
    finally {
      state.child = undefined; state.completed = undefined; state.columns = undefined;
      state.decoration = undefined; state.appearance = undefined; state.positions = undefined;
      state.pins = undefined; state.startPositions = undefined; state.startPins = undefined; guardFailure = undefined;
    }
  };
  const assemble = (): GraphPreparedData => {
    const columns = state.columns!, decoration = state.decoration!;
    const options = columns.options === undefined ? {} : { options: columns.options };
    const data: GraphPreparedDataColumns = {
      nodeCount: columns.nodeCount, source: columns.source, target: columns.target, ...options,
      positions: state.positions!, pinned: state.pins!,
      ...(columns.sizes === undefined ? {} : { sizes: columns.sizes }),
      ...(columns.categories === undefined ? {} : { categories: columns.categories }),
      labels: decoration.labels, edgeLabels: decoration.edgeLabels, nodeLabels: decoration.nodeLabels,
      withEdgeLabels: decoration.withEdgeLabels, edgeLabelMinZoom: decoration.edgeLabelMinZoom,
      directed: decoration.directed, particlesPerEdge: decoration.particlesPerEdge, particleSpeed: decoration.particleSpeed,
      ...(state.appearance === undefined ? {} : { spatialAppearance: state.appearance }),
    };
    // Topology/options share this owned candidate; later submission must not transfer them away.
    const start: GraphPreparedData['start'] = { type: 'start', data: {
      nodeCount: columns.nodeCount, source: columns.source, target: columns.target, ...options,
      positions: state.startPositions!, pinned: state.startPins!,
    } };
    return { data, start };
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph data preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph data preparation budget');
      let operations = 0, allocatedBytes = 0, copiedTextUnits = 0, reflectedKeys = 0, copiedDashValues = 0;
      guardFailure = undefined; running = true;
      try {
        while (operations < maxOperations) {
          checkpoint();
          if (state.phase === 'numerical' || state.phase === 'decoration' || state.phase === 'appearance') {
            // Passing the remaining budget avoids repeating fixed native attachment checks per scalar.
            const step: ChildStep = fenced(() => state.child!.step(maxOperations - operations));
            operations += step.operations; allocatedBytes += step.allocatedBytes;
            copiedTextUnits += step.copiedTextUnits ?? 0; reflectedKeys += step.reflectedKeys ?? 0;
            copiedDashValues += step.copiedDashValues ?? 0;
            if (step.done) {
              state.completed = step.value;
              state.child!.dispose(); state.child = undefined;
              state.phase = state.phase === 'numerical' ? 'numerical-adopt' : state.phase === 'decoration' ? 'decoration-adopt' : 'appearance-adopt';
            }
            continue;
          }
          switch (state.phase) {
            case 'numerical-setup':
              fenced(() => { state.child = createGraphDataColumnWork(state.raw!); });
              state.phase = 'numerical'; operations++; break;
            case 'numerical-adopt':
              state.columns = state.completed as GraphDataColumns; state.completed = undefined;
              state.phase = 'decoration-setup'; operations++; break;
            case 'decoration-setup':
              fenced(() => { state.child = createGraphDecorationWork(state.raw, state.columns!.nodeCount, state.columns!.source.length, parentGuard); });
              state.phase = 'decoration'; operations++; break;
            case 'decoration-adopt':
              state.decoration = state.completed as GraphDecorationData; state.completed = undefined;
              state.phase = 'appearance-capture'; operations++; break;
            case 'appearance-capture': {
              state.rawAppearance = fenced(() => {
                let descriptor: PropertyDescriptor | undefined;
                try { descriptor = Object.getOwnPropertyDescriptor(state.raw!, 'spatialAppearance'); }
                catch { throw new TypeError('Invalid graph spatial appearance'); }
                if (descriptor && !('value' in descriptor)) throw new TypeError('Invalid graph spatial appearance');
                return descriptor?.value as unknown;
              });
              state.raw = undefined;
              state.phase = state.rawAppearance === undefined ? 'sizes-setup' : 'appearance-setup'; operations++; break;
            }
            case 'appearance-setup':
              fenced(() => { state.child = createGraphSpatialAppearanceWork(state.rawAppearance, state.columns!.nodeCount, state.columns!.source.length, parentGuard); });
              state.rawAppearance = undefined; state.phase = 'appearance'; operations++; break;
            case 'appearance-adopt':
              state.appearance = state.completed as GraphSpatialAppearance; state.completed = undefined;
              state.phase = 'sizes-setup'; operations++; break;
            case 'sizes-setup':
              state.offset = 0; state.sizeLimit = graphSpatialSizeLimit(state.appearance?.sizeUnits);
              state.phase = state.appearance && state.columns!.sizes ? 'sizes' : 'dangling-setup'; operations++; break;
            case 'sizes': {
              const sizes = state.columns!.sizes!;
              if (state.offset === sizes.length) { state.phase = 'dangling-setup'; break; }
              if (!isGraphSpatialSizeValue(sizes[state.offset]!, state.sizeLimit)) throw new RangeError('Graph spatial diameters exceed the supported range');
              state.offset++; operations++; break;
            }
            case 'dangling-setup':
              state.offset = 0; state.phase = state.appearance?.dangling ? 'dangling' : 'positions-setup'; operations++; break;
            case 'dangling': {
              const columns = state.columns!;
              if (state.offset === columns.source.length) { state.phase = 'positions-setup'; break; }
              if (state.appearance!.dangling![state.offset] && columns.source[state.offset] !== columns.target[state.offset]) {
                throw new RangeError('Dangling layout endpoints must share the source row');
              }
              state.offset++; operations++; break;
            }
            case 'positions-setup': {
              const columns = state.columns!;
              state.explicitPositions = columns.positions !== undefined;
              state.positions = columns.positions;
              if (state.positions === undefined) {
                state.positions = new Float32Array(columns.nodeCount * 3); allocatedBytes += state.positions.byteLength;
                state.seed = columns.options?.seed ?? 1; state.radius = Math.max(10, Math.cbrt(columns.nodeCount) * 10);
                state.offset = 0; state.phase = 'positions';
              } else state.phase = 'pins-setup';
              operations++; break;
            }
            case 'positions':
              if (state.offset === state.positions!.length) { state.phase = 'pins-setup'; break; }
              state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
              state.positions![state.offset++] = (state.seed / 4294967296 - .5) * state.radius;
              operations++; break;
            case 'pins-setup':
              state.pins = state.columns!.pinned;
              if (state.pins === undefined) {
                state.pins = new Uint8Array(state.columns!.nodeCount); allocatedBytes += state.pins.byteLength;
                state.offset = 0; state.phase = 'pins';
              } else state.phase = 'start-positions-setup';
              operations++; break;
            case 'pins':
              if (state.offset === state.pins!.length) { state.phase = 'start-positions-setup'; break; }
              state.pins![state.offset++] = state.explicitPositions ? 1 : 0; operations++; break;
            case 'start-positions-setup':
              state.startPositions = new Float32Array(state.positions!.length); allocatedBytes += state.startPositions.byteLength;
              state.offset = 0; state.phase = 'start-positions'; operations++; break;
            case 'start-positions':
              if (state.offset === state.startPositions!.length) { state.phase = 'start-pins-setup'; break; }
              state.startPositions![state.offset] = state.positions![state.offset]!; state.offset++; operations++; break;
            case 'start-pins-setup':
              state.startPins = new Uint8Array(state.pins!.length); allocatedBytes += state.startPins.byteLength;
              state.offset = 0; state.phase = 'start-pins'; operations++; break;
            case 'start-pins':
              if (state.offset === state.startPins!.length) { state.phase = 'finalize'; break; }
              state.startPins![state.offset] = state.pins![state.offset]!; state.offset++; operations++; break;
            case 'finalize': {
              const value = assemble(); checkpoint(); operations++; close();
              return { done: true, operations, allocatedBytes, copiedTextUnits, reflectedKeys, copiedDashValues, value };
            }
          }
        }
        return { done: false, operations, allocatedBytes, copiedTextUnits, reflectedKeys, copiedDashValues };
      } catch (error) { close(); throw error; }
      finally { running = false; if (!state.active) close(); }
    },
    dispose: close,
  };
}
