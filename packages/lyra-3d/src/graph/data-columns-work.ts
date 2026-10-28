import { LYRA_3D_WORLD_LIMIT } from '../core/orbit.js';
import { validateGraphLayoutInputProgress } from './layout-admission.js';
import type { GraphLayoutInput, GraphLayoutOptions } from './types.js';

/** Numerical admission only; appearance and scene preparation have separate ownership. */
export interface GraphDataColumnInput extends GraphLayoutInput {
  readonly sizes?: Float32Array;
  readonly categories?: Uint16Array;
}
export interface GraphDataColumns extends GraphDataColumnInput {}
export interface GraphDataColumnStep {
  readonly done: boolean;
  /** Scalar visits, allocations and fixed-size setup/completion checkpoints in this step. */
  readonly operations: number;
  /** Backing-store bytes allocated in this step; an individual allocation is indivisible. */
  readonly allocatedBytes: number;
  readonly value?: GraphDataColumns;
}
export interface GraphDataColumnWork {
  step(maxOperations: number): GraphDataColumnStep;
  dispose(): void;
}

type Column = Uint32Array | Float32Array | Uint8Array | Uint16Array;
type ColumnName = 'source' | 'target' | 'positions' | 'pinned' | 'sizes' | 'categories';
type ColumnKind = 'Uint32Array' | 'Float32Array' | 'Uint8Array' | 'Uint16Array';
interface BorrowedColumn { readonly name: ColumnName; readonly kind: ColumnKind; readonly value: Column; readonly length: number }
interface CapturedColumns { readonly nodeCount: number; readonly columns: BorrowedColumn[]; options?: GraphLayoutOptions }
type OwnedColumns = { -readonly [Key in keyof GraphDataColumns]: GraphDataColumns[Key] };

const typedPrototype = Object.getPrototypeOf(Uint32Array.prototype) as object;
const lengthGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'length')!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer')!.get!;
const tagGetter = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag)!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const typedValues = Uint32Array.prototype.values;
const optionNames: readonly (keyof GraphLayoutOptions)[] = [
  'seed', 'charge', 'linkStrength', 'linkDistance', 'centerStrength', 'theta', 'softening',
  'damping', 'maxSpeed', 'maxSteps', 'cooling', 'minAlpha', 'tolerance', 'stableSteps',
];

function invalidType(): never { throw new TypeError('Invalid graph numerical columns'); }
function invalidValue(): never { throw new RangeError('Invalid graph numerical column value'); }
function record(value: unknown): object {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalidType();
    return value;
  } catch { return invalidType(); }
}
function field(value: object, name: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor && !Object.hasOwn(descriptor, 'value')) return invalidType();
    return descriptor?.value as unknown;
  } catch { return invalidType(); }
}
function columnLength(value: unknown, kind: ColumnKind): number {
  try {
    if (tagGetter.call(value) !== kind) return invalidType();
    const buffer: unknown = bufferGetter.call(value);
    bufferLengthGetter.call(buffer);
    if (resizableGetter?.call(buffer)) return invalidType();
    // Native iterator creation rejects even an empty detached view without reading user methods.
    typedValues.call(value as Uint32Array);
    return lengthGetter.call(value) as number;
  } catch { return invalidType(); }
}

function capture(input: GraphDataColumnInput): CapturedColumns {
  const dto = record(input), nodeCount = field(dto, 'nodeCount');
  if (typeof nodeCount !== 'number' || !Number.isSafeInteger(nodeCount) || nodeCount < 0 || nodeCount > 200_000) return invalidValue();
  const source = field(dto, 'source'), target = field(dto, 'target');
  const edges = columnLength(source, 'Uint32Array');
  if (edges > 1_000_000 || columnLength(target, 'Uint32Array') !== edges) return invalidValue();
  const columns: BorrowedColumn[] = [
    { name: 'source', kind: 'Uint32Array', value: source as Uint32Array, length: edges },
    { name: 'target', kind: 'Uint32Array', value: target as Uint32Array, length: edges },
  ];
  const optional: readonly [ColumnName, ColumnKind, number][] = [
    ['positions', 'Float32Array', nodeCount * 3], ['pinned', 'Uint8Array', nodeCount],
    ['sizes', 'Float32Array', nodeCount], ['categories', 'Uint16Array', nodeCount],
  ];
  for (const [name, kind, length] of optional) {
    const value = field(dto, name);
    if (value === undefined) continue;
    if (columnLength(value, kind) !== length) return invalidValue();
    columns.push({ name, kind, value: value as Column, length });
  }
  const rawOptions = field(dto, 'options');
  let options: GraphLayoutOptions | undefined;
  if (rawOptions !== undefined) {
    const sourceOptions = record(rawOptions), ownedOptions: Partial<Record<keyof GraphLayoutOptions, number>> = {};
    for (const name of optionNames) {
      const value = field(sourceOptions, name);
      if (value === undefined) continue;
      if (typeof value !== 'number') return invalidType();
      ownedOptions[name] = value;
    }
    options = ownedOptions;
  }
  return { nodeCount, columns, options };
}

function allocate(kind: ColumnKind, length: number): Column {
  switch (kind) {
    case 'Uint32Array': return new Uint32Array(length);
    case 'Float32Array': return new Float32Array(length);
    case 'Uint8Array': return new Uint8Array(length);
    case 'Uint16Array': return new Uint16Array(length);
  }
}
function validateScalar(name: ColumnName, value: number | undefined, nodes: number): asserts value is number {
  // Validate the source before assignment: detached integer reads must never coerce to zero.
  if (value === undefined || !Number.isFinite(value)) return invalidValue();
  if ((name === 'source' || name === 'target') && (!Number.isInteger(value) || value < 0 || value >= nodes)) return invalidValue();
  if (name === 'positions' && Math.abs(value) > LYRA_3D_WORLD_LIMIT) return invalidValue();
  if (name === 'pinned' && value !== 0 && value !== 1) return invalidValue();
  if (name === 'sizes' && value < 0) return invalidValue();
}

function createWork(captured: CapturedColumns): GraphDataColumnWork {
  let active = true;
  function* copy(): Generator<number, GraphDataColumns> {
    const owned = { nodeCount: captured.nodeCount } as OwnedColumns;
    if (captured.options !== undefined) owned.options = captured.options;
    yield 0;
    for (const column of captured.columns) {
      const target = allocate(column.kind, column.length);
      // The descriptor's fixed name and native brand determine the matching target type.
      Object.defineProperty(owned, column.name, { value: target, enumerable: true, writable: true, configurable: true });
      yield target.byteLength;
      for (let index = 0; index < column.length; index++) {
        const value = column.value[index];
        validateScalar(column.name, value, captured.nodeCount);
        target[index] = value;
        yield 0;
      }
    }
    // The existing validator owns option defaults/ranges. Without a shared budget it yields
    // once per scalar; fixed-size header/option checks occur at its first counted checkpoint.
    const validation = validateGraphLayoutInputProgress(owned);
    let step = validation.next();
    while (!step.done) { yield 0; step = validation.next(); }
    return owned;
  }
  let iterator: Generator<number, GraphDataColumns> | undefined = copy();
  const dispose = (): void => {
    if (!active) return;
    active = false;
    iterator?.return(undefined as never);
    iterator = undefined;
    captured.columns.length = 0;
    captured.options = undefined;
  };
  return {
    step(maxOperations) {
      if (!active) throw new DOMException('Graph numerical work is closed', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph numerical work budget');
      let operations = 0, allocatedBytes = 0;
      try {
        // This fixed set has at most six columns. Recheck attachment at every resumable boundary.
        for (const column of captured.columns) if (columnLength(column.value, column.kind) !== column.length) return invalidType();
        while (operations < maxOperations) {
          const step = iterator!.next();
          operations++;
          if (step.done) {
            const value = step.value;
            dispose();
            return { done: true, operations, allocatedBytes, value };
          }
          allocatedBytes += step.value;
        }
        return { done: false, operations, allocatedBytes };
      } catch (error) { dispose(); throw error; }
    },
    dispose,
  };
}

/** Captures headers without scanning columns; callers keep borrowed views unchanged until done. */
export function createGraphDataColumnWork(input: GraphDataColumnInput): GraphDataColumnWork {
  return createWork(capture(input));
}
