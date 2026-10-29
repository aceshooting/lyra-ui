import { BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Material, Object3D } from 'three';
import { instantiatePreparedModel, type ModelInstance, type ModelPreparationBudget, type ModelStorageLease, type ModelStorageReceipt, type PreparedModelAsset } from '../model/model-asset.js';
import { ModelAdmissionError } from '../model/model-admission-error.js';
import { MODEL_LIMITS } from '../model/limits.js';
import { aborted } from '../model/model-parser-common.js';
import type { ModelAttributeDescriptor, ModelGeometryDescriptor } from '../model/model-prepared-types.js';
import { createModelGeneratorWork, type ModelWorkGenerator } from '../model/model-work-generator.js';
import { runModelWork } from '../model/model-work-runner.js';
import type { ModelIncrementalWork, ModelWorkBudget, ModelWorkUsed } from '../model/model-work.js';
import { createModelPlacementTransform, normalizeOrientation, ownData } from './model-placement.js';
import type { MapVector3, ModelPlacementOptions } from './types.js';

type Placement = Pick<ModelPlacementOptions, 'metersPerUnit' | 'orientation'>;
type PrimitiveKind = 'mesh' | 'points' | 'line' | 'line-segments' | 'line-loop';
type Attribute = BufferAttribute | InterleavedBufferAttribute;
type AllocationPurpose = 'attribute' | 'index' | 'scratch';
interface ChannelLimits { readonly vertices: number; readonly indices: number }
interface ChannelOptions { readonly budget: ModelPreparationBudget; readonly limits: ChannelLimits; readonly signal?: AbortSignal }
interface ChannelInput extends ChannelOptions { readonly instance: ModelInstance; readonly placement: Placement }
interface PhysicalPrimitive {
  readonly node: number; readonly membership: number; readonly kind: PrimitiveKind;
  readonly material: Material; readonly geometry: ModelGeometryDescriptor;
  readonly normalMode: 'absent' | 'transformed' | 'flat-face'; readonly tangentMode: 'absent' | 'transformed';
}
export interface PreparedMapModelChannels {
  readonly primitives: readonly PhysicalPrimitive[];
  readonly counts: ChannelLimits;
  readonly storage: readonly ModelStorageReceipt[];
  readonly work: Readonly<ModelWorkUsed>;
  dispose(): void;
}
interface Reservation { readonly lease: ModelStorageLease; readonly receipt: ModelStorageReceipt; released: boolean }
interface Drawable extends Object3D { readonly geometry: BufferGeometry; readonly material: Material | Material[] }
interface Membership { readonly index: number; readonly start: number; readonly count: number; readonly material: Material }
const invalid = (): never => { throw new ModelAdmissionError('invalid'); };
const limited = (): never => { throw new ModelAdmissionError('limit'); };
const finite = (value: number): number => Number.isFinite(value) ? value : invalid();
function integer(value: unknown, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid();
  if (value > maximum) return limited();
  return value;
}
function placementSnapshot(input: Placement): Placement {
  const scale = ownData(input, 'metersPerUnit', true);
  if (scale !== undefined && (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0)) return invalid();
  if (ownData(input, 'nodeTransforms', true) !== undefined) return invalid();
  return Object.freeze({ metersPerUnit: scale === undefined ? 1 : scale as number,
    orientation: normalizeOrientation(ownData(input, 'orientation', true)) });
}
function limitSnapshot(input: ChannelLimits): ChannelLimits {
  return Object.freeze({ vertices: integer(ownData(input, 'vertices'), MODEL_LIMITS.vertices),
    indices: integer(ownData(input, 'indices'), MODEL_LIMITS.indices) });
}
function kindOf(node: Object3D): PrimitiveKind {
  const flags = node as Object3D & { isMesh?: boolean; isPoints?: boolean; isLineSegments?: boolean; isLineLoop?: boolean; isLine?: boolean };
  if (flags.isMesh) return 'mesh';
  if (flags.isPoints) return 'points';
  if (flags.isLineSegments) return 'line-segments';
  if (flags.isLineLoop) return 'line-loop';
  if (flags.isLine) return 'line';
  return invalid();
}
function attribute(value: unknown, sizes: readonly number[], count?: number): Attribute {
  if (!(value instanceof BufferAttribute) && !(value instanceof InterleavedBufferAttribute)) return invalid();
  integer(value.count, MODEL_LIMITS.vertices);
  if (!sizes.includes(value.itemSize) || (count !== undefined && value.count !== count)) return invalid();
  return value;
}
function scalar(source: Attribute, row: number, axis: number): number {
  return finite(source.getComponent(row, axis));
}
function descriptor(array: Float32Array, itemSize: 1 | 2 | 3 | 4): ModelAttributeDescriptor {
  return Object.freeze({ array, itemSize, normalized: false, count: array.length / itemSize, stride: itemSize, offset: 0 });
}
let nextOwner = 0;

/** Owns an exclusive materialized source until its physical channels are retired. */
export function createMapModelChannelWork(input: ChannelInput): ModelIncrementalWork<PreparedMapModelChannels> {
  const instance = input.instance;
  let retired = false, transferred = false, stepping = false;
  const reservations = new Set<Reservation>();
  const storage: ModelStorageReceipt[] = [];
  const primitives: PhysicalPrimitive[] = [];
  const counts = { vertices: 0, indices: 0 };
  const totals = { bytes: 0, scalars: 0, records: 0 };
  const release = (entry: Reservation): void => {
    if (entry.released) return;
    entry.released = true; reservations.delete(entry);
    try { entry.lease.release(); } catch { /* Continue retiring the other owned reservations. */ }
  };
  const retire = (): void => {
    if (retired) return;
    retired = true;
    for (const entry of reservations) release(entry);
    if (!transferred) { primitives.length = 0; storage.length = 0; }
    try { instance.dispose(); } catch { /* The source owns cleanup of its individual resources. */ }
  };
  let placement: Placement, limits: ChannelLimits, budget: ModelPreparationBudget, signal: AbortSignal | undefined, owner: number;
  const current = (): void => {
    aborted(signal);
    if (retired) throw new DOMException('Model channel work was retired', 'AbortError');
  };
  try {
    if (!instance || !(instance.object instanceof Object3D) || typeof instance.dispose !== 'function') return invalid();
    budget = input.budget; signal = input.signal;
    if (!budget || typeof budget.reserve !== 'function') return invalid();
    current();
    placement = placementSnapshot(input.placement);
    limits = limitSnapshot(input.limits);
    if (nextOwner === Number.MAX_SAFE_INTEGER) return limited();
    owner = ++nextOwner;
  } catch (error) { retire(); throw error; }
  let allocation = 0;
  const allocate = (kind: 'float' | 'index' | 'remap', length: number, purpose: AllocationPurpose): {
    readonly array: Float32Array | Uint32Array | Int32Array; readonly reservation: Reservation;
  } => {
    current();
    const byteLength = length * 4;
    if (!Number.isSafeInteger(length) || length < 0 || !Number.isSafeInteger(byteLength)) return limited();
    const lease = budget.reserve(Object.freeze({ token: `map-channel-${owner}-${allocation++}`, purpose, byteLength }));
    const entry: Reservation = { lease, receipt: Object.freeze({ key: lease.key, byteLength, purpose }), released: false };
    // A reserve callback can retire the work before returning its new lease.
    if (retired) { release(entry); current(); }
    reservations.add(entry);
    if (typeof lease.key !== 'string' || !lease.key || typeof lease.release !== 'function') return invalid();
    current();
    const array = kind === 'float' ? new Float32Array(length) : kind === 'index' ? new Uint32Array(length) : new Int32Array(length);
    current();
    if (purpose !== 'scratch') storage.push(entry.receipt);
    return { array, reservation: entry };
  };
  function* tick(unit: 'records' | 'scalars' = 'records'): ModelWorkGenerator<void> { yield unit; current(); }
  function* readPoint(source: Attribute, row: number): ModelWorkGenerator<MapVector3> {
    const result: number[] = [];
    for (let axis = 0; axis < 3; axis++) { yield* tick('scalars'); result.push(scalar(source, row, axis)); }
    return result as unknown as MapVector3;
  }
  function* write(array: Float32Array, offset: number, data: readonly number[]): ModelWorkGenerator<void> {
    for (let index = 0; index < data.length; index++) {
      yield* tick('scalars'); array[offset + index] = finite(data[index]!); finite(array[offset + index]!);
    }
  }
  function* members(node: Drawable, total: number): ModelWorkGenerator<Membership[]> {
    const range = node.geometry.drawRange;
    const start = integer(range.start, total);
    const count = range.count === Infinity ? total - start : integer(range.count, MODEL_LIMITS.indices);
    const end = Math.min(total, start + count), result: Membership[] = [];
    if (!Array.isArray(node.material)) {
      if (!(node.material instanceof Material)) return invalid();
      if (end > start) result.push({ index: 0, start, count: end - start, material: node.material });
      return result;
    }
    integer(node.material.length, MODEL_LIMITS.entries);
    integer(node.geometry.groups.length, MODEL_LIMITS.entries);
    for (let index = 0; index < node.geometry.groups.length; index++) {
      yield* tick();
      const group = node.geometry.groups[index]!;
      const a = integer(group.start, total), size = integer(group.count, MODEL_LIMITS.indices);
      const material = node.material[integer(group.materialIndex, Math.max(0, node.material.length - 1))];
      if (!(material instanceof Material)) return invalid();
      const from = Math.max(start, a), to = Math.min(end, a + size);
      if (to > from) result.push({ index, start: from, count: to - from, material });
    }
    return result;
  }
  const work = createModelGeneratorWork(function* (): ModelWorkGenerator<void> {
    const pending = [instance.object];
    const seen = new Set<Object3D>();
    let nodeCount = 0, drawableCount = 0, sourceVertices = 0;
    let minEast = Infinity, maxEast = -Infinity, minNorth = Infinity, maxNorth = -Infinity;
    while (pending.length) {
      yield* tick();
      const object = pending.pop()!;
      if (seen.has(object)) return invalid();
      seen.add(object);
      if (nodeCount >= MODEL_LIMITS.entries * 3) return limited();
      const nodeId = nodeCount++;
      integer(object.children.length, MODEL_LIMITS.entries);
      for (let index = object.children.length - 1; index >= 0; index--) { yield* tick(); pending.push(object.children[index]!); }
      if (!('geometry' in object)) continue;
      if (++drawableCount > MODEL_LIMITS.entries) return limited();
      const node = object as Drawable;
      if (!(node.geometry instanceof BufferGeometry)) return invalid();
      const kind = kindOf(node);
      const position = attribute(node.geometry.getAttribute('position'), [3]);
      sourceVertices += position.count;
      if (sourceVertices > MODEL_LIMITS.vertices) return limited();
      const transform = createModelPlacementTransform({ ...placement, nodeTransforms: [[...node.matrixWorld.elements]] });
      const channels: Record<string, Attribute> = { position };
      for (const name of Object.keys(node.geometry.attributes)) {
        yield* tick();
        const sizes = name === 'position' || name === 'normal' ? [3] : name === 'tangent' ? [4] :
          name === 'color' ? [3, 4] : name === 'uv' || name === 'uv1' ? [2] : undefined;
        if (!sizes) return invalid();
        channels[name] = attribute(node.geometry.getAttribute(name), sizes, position.count);
      }
      for (let row = 0; row < position.count; row++) {
        yield* tick();
        const point = transform.point(yield* readPoint(position, row));
        if (Math.hypot(point[0], point[1]) > 100000) return limited();
        minEast = Math.min(minEast, point[0]); maxEast = Math.max(maxEast, point[0]);
        minNorth = Math.min(minNorth, point[1]); maxNorth = Math.max(maxNorth, point[1]);
        if (maxEast - minEast > 100000 || maxNorth - minNorth > 100000) return limited();
      }
      const sourceIndex = node.geometry.getIndex();
      if (sourceIndex && (sourceIndex.itemSize !== 1 || sourceIndex.normalized)) return invalid();
      const total = integer(sourceIndex?.count ?? position.count, MODEL_LIMITS.indices);
      const sourceRow = (index: number): number => sourceIndex ? integer(sourceIndex.getComponent(index, 0), position.count - 1) : index;
      for (const membership of yield* members(node, total)) {
        yield* tick();
        const length = membership.count;
        if ((kind === 'mesh' && length % 3 !== 0) || (kind === 'line-segments' && length % 2 !== 0) ||
            ((kind === 'line' || kind === 'line-loop') && length < 2)) return invalid();
        if (length > limits.indices - counts.indices) return limited();
        const flat = kind === 'mesh' && (membership.material as Material & { flatShading?: boolean }).flatShading === true;
        const normal = channels['normal'], tangent = channels['tangent'];
        if (tangent && !normal && !flat) return invalid();
        let remap: Int32Array | undefined, scratch: Reservation | undefined;
        try {
          let rows = flat ? length : 0;
          if (!flat) {
            yield* tick(); const temporary = allocate('remap', position.count, 'scratch');
            remap = temporary.array as Int32Array; scratch = temporary.reservation;
            for (let index = 0; index < length; index++) {
              yield* tick(); const source = sourceRow(membership.start + index);
              if (remap[source] === 0) { remap[source] = ++rows; if (rows > limits.vertices - counts.vertices) return limited(); }
            }
          }
          if (rows > limits.vertices - counts.vertices) return limited();
          const attributes: Record<string, ModelAttributeDescriptor> = {};
          const names = Object.keys(channels);
          if (flat && !normal) names.push('normal');
          for (const name of names) {
            yield* tick();
            const size = name === 'normal' ? 3 : channels[name]!.itemSize as 1 | 2 | 3 | 4;
            const output = allocate('float', rows * size, 'attribute').array as Float32Array;
            attributes[name] = descriptor(output, size);
          }
          yield* tick();
          const indices = allocate('index', length, 'index').array as Uint32Array;
          let faceNormal: MapVector3 | undefined;
          for (let index = 0; index < length; index++) {
            yield* tick();
            const source = sourceRow(membership.start + index);
            const destination = flat ? index : Math.abs(remap![source]!) - 1;
            if (flat && index % 3 === 0) {
              const points: MapVector3[] = [];
              for (let corner = 0; corner < 3; corner++) points.push(transform.point(yield* readPoint(position, sourceRow(membership.start + index + corner))));
              const a = points[0]!, b = points[1]!, c = points[2]!;
              const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
              const cross = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
              const magnitude = Math.hypot(...cross);
              if (!Number.isFinite(magnitude) || magnitude === 0) return invalid();
              const sign = transform.determinantSign < 0 ? -1 : 1;
              faceNormal = cross.map(value => value / magnitude * sign) as unknown as MapVector3;
            }
            if (flat || remap![source]! > 0) {
              if (remap) remap[source] = -remap[source]!;
              const point = transform.point(yield* readPoint(position, source));
              yield* write(attributes['position']!.array as Float32Array, destination * 3, point);
              const transformedNormal = flat ? faceNormal : normal ? transform.normal(yield* readPoint(normal, source)) : undefined;
              if (transformedNormal) yield* write(attributes['normal']!.array as Float32Array, destination * 3, transformedNormal);
              if (tangent) {
                const components: number[] = [];
                for (let axis = 0; axis < 4; axis++) { yield* tick('scalars'); components.push(scalar(tangent, source, axis)); }
                const value = transform.tangent(components as unknown as readonly [number, number, number, number], transformedNormal!);
                yield* write(attributes['tangent']!.array as Float32Array, destination * 4, value);
              }
              for (const name of names) {
                if (name === 'position' || name === 'normal' || name === 'tangent') continue;
                const channel = channels[name]!, output = attributes[name]!.array as Float32Array;
                for (let axis = 0; axis < channel.itemSize; axis++) {
                  yield* tick('scalars'); output[destination * channel.itemSize + axis] = scalar(channel, source, axis);
                  finite(output[destination * channel.itemSize + axis]!);
                }
              }
            }
            yield* tick('scalars'); indices[index] = destination;
          }
          if (kind === 'mesh' && transform.determinantSign < 0) {
            for (let index = 0; index < length; index += 3) {
              yield* tick(); const second = indices[index + 1]!; indices[index + 1] = indices[index + 2]!; indices[index + 2] = second;
            }
          }
          yield* tick();
          const geometry: ModelGeometryDescriptor = Object.freeze({ attributes: Object.freeze(attributes), index: indices,
            groups: Object.freeze([Object.freeze({ start: 0, count: length, materialIndex: 0 })]), drawRange: Object.freeze({ start: 0, count: length }) });
          primitives.push(Object.freeze({ node: nodeId, membership: membership.index, kind, material: membership.material, geometry,
            normalMode: flat ? 'flat-face' : normal ? 'transformed' : 'absent', tangentMode: tangent ? 'transformed' : 'absent' }));
          counts.vertices += rows; counts.indices += length;
        } finally { if (scratch) release(scratch); }
      }
    }
    yield* tick();
  });
  return Object.freeze({
    step(quota: ModelWorkBudget) {
      if (stepping || transferred) throw new Error('Model channel work is no longer active');
      stepping = true;
      try {
        current();
        const result = work.step(quota);
        for (const key of ['bytes', 'scalars', 'records'] as const) totals[key] += result.used[key];
        current();
        if (!result.done) return { done: false as const, used: result.used };
        const value: PreparedMapModelChannels = Object.freeze({ primitives: Object.freeze(primitives), counts: Object.freeze({ ...counts }),
          storage: Object.freeze(storage), work: Object.freeze({ ...totals }), dispose: retire });
        transferred = true;
        return { done: true as const, used: result.used, value };
      } catch (error) { retire(); throw error; }
      finally { stepping = false; }
    },
    dispose() {
      if (transferred) return;
      retire();
      if (!stepping) work.dispose();
    }
  });
}

/** Reuses retained asset materialization; no source bytes are copied or decoded here. */
export async function prepareMapModelChannels(asset: PreparedModelAsset, placement: Placement, options: ChannelOptions): Promise<PreparedMapModelChannels> {
  const budget = options.budget, signal = options.signal;
  const snapshot = placementSnapshot(placement), limits = limitSnapshot(options.limits);
  aborted(signal);
  const instance = await instantiatePreparedModel(asset, { budget, signal });
  // The factory takes the exclusive instance even when its own validation fails.
  const work = createMapModelChannelWork({ instance, placement: snapshot, budget, limits, signal });
  return runModelWork(work, signal);
}
