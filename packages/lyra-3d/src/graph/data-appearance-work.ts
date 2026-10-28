import type { GraphDecorationData } from './decorations.js';
import { createGraphLabelAdmission, graphDecorationMode, graphDecorationScalar, graphEdgeLabelsVisible, isGraphDirectedValue } from './decoration-admission.js';

export interface GraphDecorationWorkStep {
  readonly done: boolean;
  /** Explicit row/scalar visits, allocations and fixed-size checkpoints. */
  readonly operations: number;
  /** Owned directed-mask backing only, excluding JavaScript arrays and strings. */
  readonly allocatedBytes: number;
  /** Retained UTF-16 code units copied into output rows, not heap bytes. */
  readonly copiedTextUnits: number;
  readonly value?: GraphDecorationData;
}
export interface GraphDecorationWork {
  step(maxOperations: number): GraphDecorationWorkStep;
  dispose(): void;
}
interface WorkState {
  input: unknown;
  guard: (() => boolean) | undefined;
  active: boolean;
  mask: Uint8Array | undefined;
  maskLength: number;
}
interface WorkCost { readonly allocatedBytes: number; readonly copiedTextUnits: number }
type WorkGenerator<Value> = Generator<WorkCost | undefined, Value>;
type Refusal = () => never;
const fields = ['labels', 'edgeLabels', 'nodeLabels', 'withEdgeLabels', 'edgeLabelMinZoom', 'directed', 'particlesPerEdge', 'particleSpeed'] as const;
type CapturedFields = Record<typeof fields[number], unknown>;
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length')!.get!;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer')!.get!;
const typedName = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag)!.get!;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const bufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const typedValues = Uint8Array.prototype.values;

function invalidInput(): never { throw new TypeError('Invalid graph decoration input'); }
function invalidRows(): never { throw new RangeError('Invalid graph label rows'); }
function invalidLabel(): never { throw new TypeError('Graph labels must be plain strings'); }
function invalidMask(): never { throw new RangeError('Invalid graph directed mask'); }
function checkpoint(state: WorkState): void {
  const guard = state.guard;
  if (!state.active || (guard && !guard()) || !state.active) {
    const error = new Error('Graph decoration admission was superseded'); error.name = 'AbortError'; throw error;
  }
}
function read<Value>(state: WorkState, operation: () => Value, refuse: Refusal): Value {
  checkpoint(state);
  let result: Value;
  try { result = operation(); } catch { checkpoint(state); return refuse(); }
  checkpoint(state); return result;
}
function field(state: WorkState, input: object, key: string, refuse: Refusal, required = false): unknown {
  const descriptor = read(state, () => Object.getOwnPropertyDescriptor(input, key), refuse);
  if (!descriptor) return required ? refuse() : undefined;
  if (!('value' in descriptor)) return refuse();
  return descriptor.value as unknown;
}
function maskLength(state: WorkState, value: unknown): number {
  return read(state, () => {
    if (typedName.call(value) !== 'Uint8Array') return invalidMask();
    const buffer: unknown = typedBuffer.call(value);
    bufferLength.call(buffer);
    if (bufferResizable?.call(buffer)) return invalidMask();
    // Native iterator creation checks attachment without reading user methods or iterating.
    typedValues.call(value as Uint8Array);
    return typedLength.call(value) as number;
  }, invalidMask);
}
function checkMask(state: WorkState): void {
  if (state.mask && maskLength(state, state.mask) !== state.maskLength) return invalidMask();
}
function* capture(state: WorkState): WorkGenerator<CapturedFields> {
  const input = state.input;
  if (input === null || typeof input !== 'object' || read(state, () => Array.isArray(input), invalidInput)) return invalidInput();
  const captured = {} as CapturedFields;
  for (const name of fields) {
    captured[name] = field(state, input, name, invalidInput);
    yield;
  }
  return captured;
}
function* copyLabels(state: WorkState, value: unknown, count: number, admitLabel: (value: unknown) => string): WorkGenerator<string[] | undefined> {
  if (value === undefined) return undefined;
  if (!read(state, () => Array.isArray(value), invalidRows)) return invalidRows();
  const source = value as unknown[];
  if (field(state, source, 'length', invalidRows, true) !== count) return invalidRows();
  const labels = new Array<string>(count);
  yield;
  for (let row = 0; row < count; row++) {
    const text = admitLabel(field(state, source, String(row), invalidLabel, true));
    labels[row] = text;
    yield { allocatedBytes: 0, copiedTextUnits: text.length };
  }
  return labels;
}
function* prepare(state: WorkState, nodes: number, edges: number): WorkGenerator<GraphDecorationData> {
  checkpoint(state);
  if (!Number.isSafeInteger(nodes) || nodes < 0 || nodes > 200_000 || !Number.isSafeInteger(edges) || edges < 0 || edges > 1_000_000) {
    throw new RangeError('Invalid graph decoration counts');
  }
  const input = yield* capture(state);
  state.input = undefined;
  const nodeLabels = graphDecorationMode(input.nodeLabels);
  const withEdgeLabels = input.withEdgeLabels === undefined ? false : graphEdgeLabelsVisible(input.withEdgeLabels);
  yield;
  if (input.directed !== undefined) {
    if (maskLength(state, input.directed) !== edges) return invalidMask();
    state.mask = input.directed as Uint8Array; state.maskLength = edges;
    yield;
    // Keep mask-value preflight ahead of the combined label budget, as in synchronous admission.
    for (let row = 0; row < edges; row++) {
      if (!isGraphDirectedValue(state.mask[row])) return invalidMask();
      yield;
    }
  }
  const admitLabel = createGraphLabelAdmission();
  const labels = yield* copyLabels(state, input.labels, nodes, admitLabel);
  const edgeLabels = yield* copyLabels(state, input.edgeLabels, edges, admitLabel);
  const edgeLabelMinZoom = graphDecorationScalar('edgeLabelMinZoom', input.edgeLabelMinZoom);
  yield;
  let directed: Uint8Array | undefined;
  if (state.mask) {
    directed = new Uint8Array(edges);
    yield { allocatedBytes: directed.byteLength, copiedTextUnits: 0 };
    for (let row = 0; row < edges; row++) {
      const value = state.mask[row];
      // Validate before assignment so an undefined detached read cannot become an owned zero.
      if (!isGraphDirectedValue(value)) return invalidMask();
      directed[row] = value!;
      yield;
    }
    state.mask = undefined; state.maskLength = 0;
  }
  const particlesPerEdge = graphDecorationScalar('particlesPerEdge', input.particlesPerEdge);
  const particleSpeed = graphDecorationScalar('particleSpeed', input.particleSpeed);
  checkpoint(state);
  return { labels, edgeLabels, nodeLabels, withEdgeLabels, edgeLabelMinZoom, directed, particlesPerEdge, particleSpeed };
}

/**
 * Captures known own data fields, borrowing unchanged input until ownership transfers.
 * Explicit work is chunked; native allocations and reflective caller traps are indivisible.
 */
export function createGraphDecorationWork(input: unknown, nodeCount: number, edgeCount: number, isCurrent?: () => boolean): GraphDecorationWork {
  const state: WorkState = { input, guard: isCurrent, active: true, mask: undefined, maskLength: 0 };
  input = undefined; isCurrent = undefined;
  let iterator: WorkGenerator<GraphDecorationData> | undefined = prepare(state, nodeCount, edgeCount);
  let running = false;
  const close = (): void => {
    state.active = false; state.input = undefined; state.guard = undefined; state.mask = undefined; state.maskLength = 0;
    if (!running) { iterator?.return(undefined as never); iterator = undefined; }
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph decoration work is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph decoration work budget');
      let operations = 0, allocatedBytes = 0, copiedTextUnits = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint(state); checkMask(state);
          const step = iterator!.next(); operations++;
          if (step.done) {
            const value = step.value; close();
            return { done: true, operations, allocatedBytes, copiedTextUnits, value };
          }
          allocatedBytes += step.value?.allocatedBytes ?? 0;
          copiedTextUnits += step.value?.copiedTextUnits ?? 0;
        }
        return { done: false, operations, allocatedBytes, copiedTextUnits };
      } catch (error) { close(); throw error; }
      finally { running = false; if (!state.active) close(); }
    },
    dispose: close,
  };
}
