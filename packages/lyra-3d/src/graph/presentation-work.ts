import type { Lyra3dState } from '../core/contract.js';
import { parseCssColor, resolveLyra3dStyle, type Lyra3dRgba, type ResolvedLyra3dStyle } from '../core/style.js';

export interface GraphPresentationSnapshotInput {
  readonly presentation?: unknown;
  readonly inheritedStyle: ResolvedLyra3dStyle;
  readonly inheritedState: Lyra3dState;
}
export interface GraphPresentationSnapshot {
  readonly style: ResolvedLyra3dStyle;
  readonly state: Lyra3dState;
  readonly inheritsStyle: boolean;
  readonly inheritsState: boolean;
}
export interface GraphPresentationSnapshotStep {
  readonly done: boolean;
  readonly operations: number;
  readonly visitedPaletteEntries: number;
  readonly copiedStateEntries: number;
  readonly value?: GraphPresentationSnapshot;
}
export interface GraphPresentationSnapshotWork {
  step(maxOperations: number): GraphPresentationSnapshotStep;
  dispose(): void;
}

const STYLE_FIELDS = ['palette', 'fontFamily', 'background', 'foreground', 'muted', 'accent', 'focus',
  'fontSize', 'pointSize', 'lineWidth', 'devicePixelRatio', 'reducedMotion', 'forcedColors'] as const;
const STATE_FIELDS = ['selected', 'dimmed', 'hover', 'focus'] as const;
type SnapshotPhase = 'setup' | 'presentation' | 'style' | 'palette-header' | 'palette' | 'resolve'
  | 'style-finish' | 'state' | 'open' | 'advance' | 'finish';
interface SnapshotState {
  input: GraphPresentationSnapshotInput | undefined;
  guard: (() => boolean) | undefined;
  active: boolean;
  phase: SnapshotPhase;
  row: number;
  presentation: object | undefined;
  rawStyle: unknown;
  rawState: object | undefined;
  inheritsStyle: boolean;
  inheritsState: boolean;
  styleFields: Partial<Record<typeof STYLE_FIELDS[number], unknown>> | undefined;
  stateFields: Partial<Record<typeof STATE_FIELDS[number], unknown>> | undefined;
  paletteSource: unknown[] | undefined;
  paletteLength: number;
  palette: Lyra3dRgba[] | undefined;
  style: ResolvedLyra3dStyle | undefined;
  selected: Set<number> | undefined;
  dimmed: Set<number> | undefined;
  collection: 0 | 1;
  iterator: object | undefined;
  next: ((...args: unknown[]) => unknown) | undefined;
  add: ((...args: unknown[]) => unknown) | undefined;
}

function objectLike(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function invalidStateValue(): TypeError { return new TypeError('Invalid graph presentation state'); }

/**
 * Owns prospective style and numeric row state without publishing either. Inputs stay unchanged
 * while borrowed. Palette positions and iterator advances are individually budgeted; string
 * parsing and native iterator calls remain indivisible. Completion transfers the owned snapshot.
 */
export function createGraphPresentationSnapshotWork(input: GraphPresentationSnapshotInput, isCurrent?: () => boolean): GraphPresentationSnapshotWork {
  const state: SnapshotState = {
    input, guard: isCurrent, active: true, phase: 'setup', row: 0, presentation: undefined,
    rawStyle: undefined, rawState: undefined, inheritsStyle: true, inheritsState: true,
    styleFields: undefined, stateFields: undefined, paletteSource: undefined, paletteLength: 0,
    palette: undefined, style: undefined, selected: undefined, dimmed: undefined, collection: 0,
    iterator: undefined, next: undefined, add: undefined,
  };
  input = undefined as never; isCurrent = undefined;
  let running = false;

  const dropIterator = (): void => { state.iterator = undefined; state.next = undefined; state.add = undefined; };
  const close = (): void => {
    // Detach first: return getters/calls may reenter dispose or step.
    const iterator = state.iterator;
    dropIterator(); state.active = false; state.input = undefined; state.guard = undefined;
    state.presentation = undefined; state.rawStyle = undefined; state.rawState = undefined;
    state.styleFields = undefined; state.stateFields = undefined; state.paletteSource = undefined;
    state.palette = undefined; state.style = undefined; state.selected = undefined; state.dimmed = undefined;
    if (iterator) {
      try {
        const method: unknown = Reflect.get(iterator, 'return');
        if (typeof method === 'function') Reflect.apply(method, iterator, []);
      } catch { /* Cleanup cannot replace the preparation failure. */ }
    }
  };
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) throw new DOMException('Graph presentation preparation was superseded', 'AbortError');
  };
  const boundary = <T>(action: () => T): T => {
    checkpoint(); const value = action(); checkpoint(); return value;
  };
  const own = (source: object | undefined, key: PropertyKey, rejectAccessor: boolean): unknown => {
    const descriptor = source === undefined ? undefined : boundary(() => Object.getOwnPropertyDescriptor(source, key));
    if (descriptor && !('value' in descriptor)) {
      if (rejectAccessor) throw new TypeError('Graph presentation requires own data properties');
      return undefined;
    }
    return descriptor?.value;
  };
  const paletteLength = (raw: unknown): number => {
    // ToPrimitive(number) is explicit so cancellation also fences coercion hooks.
    let primitive = raw;
    if (objectLike(primitive)) {
      const source = primitive;
      const exotic: unknown = boundary(() => Reflect.get(source, Symbol.toPrimitive));
      if (exotic !== undefined && exotic !== null) {
        if (typeof exotic !== 'function') throw new TypeError('Invalid palette length');
        primitive = boundary(() => Reflect.apply(exotic, source, ['number']));
        if (objectLike(primitive)) throw new TypeError('Invalid palette length');
      } else {
        let converted = false;
        for (const key of ['valueOf', 'toString']) {
          const method: unknown = boundary(() => Reflect.get(source, key));
          if (typeof method !== 'function') continue;
          primitive = boundary(() => Reflect.apply(method, source, []));
          if (!objectLike(primitive)) { converted = true; break; }
        }
        if (!converted) throw new TypeError('Invalid palette length');
      }
    }
    // Unary conversion retains native rejection of symbols and bigints.
    const length = +(primitive as number);
    return Number.isNaN(length) || length <= 0 ? 0 : Math.min(256, Math.floor(length));
  };
  const nativeIterator = <T>(action: () => T): T => {
    checkpoint();
    let value: T;
    try { value = action(); }
    catch (error) {
      // Native acquisition/advance failures do not perform IteratorClose.
      dropIterator(); throw error;
    }
    checkpoint(); return value;
  };
  const openIterator = (): void => {
    const source = state.stateFields![state.collection === 0 ? 'selected' : 'dimmed'];
    if (source === undefined || source === null) return;
    const target = state.collection === 0 ? state.selected! : state.dimmed!;
    state.add = boundary(() => target.add) as (...args: unknown[]) => unknown;
    if (typeof state.add !== 'function') throw invalidStateValue();
    const method: unknown = nativeIterator(() => Reflect.get(Object(source) as object, Symbol.iterator));
    if (typeof method !== 'function') throw invalidStateValue();
    // Adopt the returned iterator before the post-call fence, even if the call disposed work.
    nativeIterator(() => {
      const iterator: unknown = Reflect.apply(method, source, []);
      if (!objectLike(iterator)) throw invalidStateValue();
      state.iterator = iterator;
    });
    state.next = nativeIterator(() => {
      const next: unknown = Reflect.get(state.iterator!, 'next');
      if (typeof next !== 'function') throw invalidStateValue();
      return next as (...args: unknown[]) => unknown;
    });
  };
  const advanceIterator = (): boolean => {
    if (!state.iterator) return false;
    const result = nativeIterator(() => {
      const value: unknown = Reflect.apply(state.next!, state.iterator, []);
      if (!objectLike(value)) throw invalidStateValue();
      return value;
    });
    const done = nativeIterator(() => {
      const value: unknown = Reflect.get(result, 'done');
      // A terminal iterator is no longer open at the following currentness fence.
      if (value) dropIterator();
      return Boolean(value);
    });
    if (done) return false;
    const value: unknown = nativeIterator(() => Reflect.get(result, 'value'));
    if (typeof value !== 'number') throw invalidStateValue();
    boundary(() => Reflect.apply(state.add!, state.collection === 0 ? state.selected : state.dimmed, [value]));
    return true;
  };

  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph presentation preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph presentation preparation budget');
      let operations = 0, visitedPaletteEntries = 0, copiedStateEntries = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint();
          if (state.phase === 'palette' && state.row === state.paletteLength) state.phase = 'resolve';
          switch (state.phase) {
            case 'setup': {
              const presentation = boundary(() => state.input!.presentation);
              if (presentation !== undefined && (presentation === null || typeof presentation !== 'object')) {
                throw new TypeError('Invalid graph presentation');
              }
              state.presentation = presentation;
              state.styleFields = {}; state.stateFields = {}; state.palette = [];
              state.selected = boundary(() => new Set<number>()); state.dimmed = boundary(() => new Set<number>());
              state.phase = 'presentation'; break;
            }
            case 'presentation': {
              const key = state.row++ === 0 ? 'style' : 'state';
              const value = own(state.presentation, key, true);
              if (key === 'style') {
                state.inheritsStyle = value === undefined;
                state.rawStyle = state.inheritsStyle ? boundary(() => state.input!.inheritedStyle) : value;
              } else {
                state.inheritsState = value === undefined;
                const source = state.inheritsState ? boundary(() => state.input!.inheritedState) : value;
                if (!objectLike(source)) throw invalidStateValue();
                state.rawState = source; state.presentation = undefined; state.input = undefined;
                state.row = 0; state.phase = 'style';
              }
              break;
            }
            case 'style': {
              const key = STYLE_FIELDS[state.row++]!;
              const source = typeof state.rawStyle === 'object' && state.rawStyle !== null ? state.rawStyle : undefined;
              state.styleFields![key] = own(source, key, false);
              if (state.row === STYLE_FIELDS.length) { state.rawStyle = undefined; state.phase = 'palette-header'; }
              break;
            }
            case 'palette-header': {
              const source = state.styleFields!.palette;
              if (Array.isArray(source)) {
                state.paletteSource = source;
                state.paletteLength = paletteLength(boundary(() => source.length));
              }
              state.styleFields!.palette = undefined; state.row = 0; state.phase = 'palette'; break;
            }
            case 'palette': {
              const source = state.paletteSource!, index = state.row++;
              if (boundary(() => index in source)) {
                const raw: unknown = boundary(() => source[index]);
                const color = state.inheritsStyle ? raw as Lyra3dRgba : parseCssColor(raw);
                if (color) state.palette!.push(color);
              }
              visitedPaletteEntries++; break;
            }
            case 'resolve':
              state.style = state.inheritsStyle ? state.styleFields as unknown as ResolvedLyra3dStyle : resolveLyra3dStyle(state.styleFields);
              state.paletteSource = undefined; state.phase = 'style-finish'; break;
            case 'style-finish':
              state.style = Object.freeze({ ...state.style!, palette: Object.freeze(state.palette!.length ? state.palette! : [...state.style!.palette]) });
              state.palette = undefined; state.styleFields = undefined; state.row = 0; state.phase = 'state'; break;
            case 'state': {
              const key = STATE_FIELDS[state.row++]!;
              const value = own(state.rawState, key, true);
              if ((key === 'hover' || key === 'focus') && typeof value !== 'number') throw invalidStateValue();
              state.stateFields![key] = value;
              if (state.row === STATE_FIELDS.length) { state.rawState = undefined; state.phase = 'open'; }
              break;
            }
            case 'open':
              openIterator(); state.phase = 'advance'; break;
            case 'advance':
              if (advanceIterator()) copiedStateEntries++;
              else {
                dropIterator(); state.stateFields![state.collection === 0 ? 'selected' : 'dimmed'] = undefined;
                if (state.collection === 0) { state.collection = 1; state.phase = 'open'; }
                else state.phase = 'finish';
              }
              break;
            case 'finish': {
              const value: GraphPresentationSnapshot = {
                style: state.style!, state: { selected: state.selected!, dimmed: state.dimmed!,
                  hover: state.stateFields!.hover as number, focus: state.stateFields!.focus as number },
                inheritsStyle: state.inheritsStyle, inheritsState: state.inheritsState,
              };
              operations++; checkpoint(); close();
              return { done: true, operations, visitedPaletteEntries, copiedStateEntries, value };
            }
          }
          operations++; checkpoint();
        }
        return { done: false, operations, visitedPaletteEntries, copiedStateEntries };
      } catch (error) { close(); throw error; }
      finally { running = false; }
    },
    dispose: close,
  };
}
