import type { FlowEdge, FlowHandle, FlowNode } from '../components/data/flow-canvas/flow-types.js';
import { normalizeFlowVariant } from '../components/data/flow-canvas/flow-model.js';
import type { SceneDomain, SceneReader } from './graph-scene-controller.js';

const MAX_ENTRIES = 10_000;
const MAX_FIELDS = 50_000;
const MAX_DEPTH = 16;

/** Strict source metadata is detached own data: finite primitives, plain records and arrays.
 * Strings and keys share the scene text budget. Shared and cyclic data retain their identity.
 * JavaScript eagerly enumerates keys; oversized key arrays are rejected before any descriptors
 * are inspected. No opaque leaves or accessors are retained and no over-limit value is trimmed. */
class FlowSceneNormalizer {
  private fields = 0;
  private readonly seen = new WeakMap<object, Record<string, unknown> | unknown[]>();
  constructor(private readonly reader: SceneReader) {}

  private consume(count = 1): void {
    this.fields += count;
    if (this.fields > MAX_FIELDS) throw new RangeError('Flow scene field budget exceeded');
  }
  private identity(value: unknown): string {
    const result = this.reader.text(value, true);
    if (!result.trim()) throw new TypeError('Invalid flow identity');
    return result;
  }
  private plain(value: object): boolean {
    this.reader.check();
    const prototype: unknown = Object.getPrototypeOf(value);
    this.reader.check();
    return prototype === Object.prototype || prototype === null;
  }
  private data(value: unknown, depth = 0): unknown {
    const reader = this.reader;
    reader.check();
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') return reader.text(value);
    if (typeof value === 'number') return reader.number(value);
    if (typeof value !== 'object') throw new TypeError('Invalid flow metadata');
    const previous = this.seen.get(value);
    if (previous) return previous;
    if (depth > MAX_DEPTH) throw new RangeError('Flow scene metadata depth exceeded');
    const isArray = Array.isArray(value);
    if (!isArray && !this.plain(value)) throw new TypeError('Invalid flow metadata object');
    const length = isArray ? reader.array(value, MAX_ENTRIES).length : 0;
    reader.check();
    const keys = Reflect.ownKeys(value);
    reader.check();
    if (keys.length > MAX_ENTRIES + (isArray ? 1 : 0)) throw new RangeError('Flow scene metadata entries exceeded');
    const target: Record<string, unknown> | unknown[] = isArray ? new Array<unknown>(length) : {};
    this.seen.set(value, target);
    for (const key of keys) {
      if (isArray && key === 'length') continue;
      this.consume();
      if (typeof key !== 'string') throw new TypeError('Invalid flow metadata key');
      reader.text(key);
      if (isArray && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) throw new TypeError('Invalid flow array key');
      reader.check();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      reader.check();
      if (!descriptor || !('value' in descriptor)) throw new TypeError('Invalid flow metadata descriptor');
      if (!descriptor.enumerable) continue;
      const item = this.data(descriptor.value, depth + 1);
      Object.defineProperty(target, key, { value: item, enumerable: true, configurable: true, writable: true });
    }
    return Object.freeze(target);
  }
  private handles(value: unknown): readonly FlowHandle[] | undefined {
    if (value === undefined) return undefined;
    const reader = this.reader;
    const entries = reader.array(value, MAX_ENTRIES);
    const seen = new Set<string>();
    const handles: FlowHandle[] = [];
    for (let index = 0; index < entries.length; index++) {
      // The collection entry and two known handle fields are all inspected work.
      this.consume(3);
      const item = entries.at(index);
      const id = this.identity(reader.field(item, 'id'));
      if (seen.has(id)) throw new TypeError('Duplicate flow handle');
      seen.add(id);
      handles.push(Object.freeze({ id, ...reader.texts(item, ['label']) }));
    }
    return Object.freeze(handles);
  }
  node(value: unknown, entryPosition: unknown): FlowNode {
    const reader = this.reader;
    const id = this.identity(reader.field(value, 'id'));
    const placed = reader.position(entryPosition);
    if (!placed) throw new TypeError('Flow scene requires node positions');
    const own = reader.position(reader.field(value, 'position'));
    if (own && (own.x !== placed.x || own.y !== placed.y)) throw new TypeError('Conflicting flow positions');
    const position = Object.freeze({ x: placed.x, y: placed.y });
    const rawData = reader.field(value, 'data');
    let data: Readonly<Record<string, unknown>> | undefined;
    if (rawData !== undefined) {
      if (rawData === null || typeof rawData !== 'object' || !this.plain(rawData)) throw new TypeError('Invalid flow data root');
      // The root was checked above; data preserves only plain record keys.
      data = this.data(rawData) as Readonly<Record<string, unknown>>;
    }
    const inputs = this.handles(reader.field(value, 'inputs'));
    const outputs = this.handles(reader.field(value, 'outputs'));
    const disabled = reader.flag(value, 'disabled');
    return Object.freeze({ id, position, ...reader.texts(value, ['type', 'accessibleLabel']),
      ...(data === undefined ? {} : { data }), ...(inputs === undefined ? {} : { inputs }),
      ...(outputs === undefined ? {} : { outputs }), ...(disabled === undefined ? {} : { disabled }) });
  }
  edge(value: unknown): FlowEdge {
    const reader = this.reader;
    const id = this.identity(reader.field(value, 'id'));
    const source = this.identity(reader.field(value, 'source'));
    const target = this.identity(reader.field(value, 'target'));
    const rawTone = reader.field(value, 'tone');
    const tone = normalizeFlowVariant(rawTone);
    if (rawTone !== undefined && tone === undefined) throw new TypeError('Invalid flow edge tone');
    if (tone !== undefined) reader.text(tone);
    return Object.freeze({ id, source, target, ...reader.texts(value, ['sourceHandle', 'targetHandle', 'label']),
      ...(tone === undefined ? {} : { tone }) });
  }
}

export const flowSceneDomain: SceneDomain<FlowNode, FlowEdge> = {
  positionedViewport: true,
  create: reader => new FlowSceneNormalizer(reader),
};
