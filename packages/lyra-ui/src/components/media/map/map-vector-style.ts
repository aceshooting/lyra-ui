import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { safeValue, MAX_NODES, MAX_TEXT } from './map-style-value.js';
import type { LyraMapStyleValue } from './map-style-override-admission.js';

/** Finite vector paint vocabulary; row opacity remains owned by the data layer. */
export type LyraMapVectorPaintProperty = 'line-color' | 'line-width' | 'circle-color' | 'circle-radius' | 'circle-stroke-color' | 'circle-stroke-width' | 'fill-color' | 'fill-outline-color' | 'icon-color' | 'icon-halo-color' | 'icon-halo-width' | 'text-color' | 'text-halo-color' | 'text-halo-width';
export type LyraMapVectorLayoutProperty = 'line-cap' | 'line-join' | 'icon-image' | 'icon-size' | 'icon-allow-overlap' | 'icon-ignore-placement' | 'text-size' | 'text-allow-overlap' | 'text-ignore-placement' | 'symbol-placement';
/** Bounded case/match/step/linear-interpolate expressions; arbitrary native operators reject. */
export type LyraMapVectorStyleExpression = readonly LyraMapStyleValue[];
export type LyraMapVectorNumericValue = number | LyraMapVectorStyleExpression;
export type LyraMapVectorColorValue = string | LyraMapVectorStyleExpression;
export interface LyraMapVectorPaint {
  readonly 'line-color'?: LyraMapVectorColorValue;
  readonly 'line-width'?: LyraMapVectorNumericValue;
  readonly 'circle-color'?: LyraMapVectorColorValue;
  readonly 'circle-radius'?: LyraMapVectorNumericValue;
  readonly 'circle-stroke-color'?: LyraMapVectorColorValue;
  readonly 'circle-stroke-width'?: LyraMapVectorNumericValue;
  readonly 'fill-color'?: LyraMapVectorColorValue;
  readonly 'fill-outline-color'?: LyraMapVectorColorValue;
  readonly 'icon-color'?: LyraMapVectorColorValue;
  readonly 'icon-halo-color'?: LyraMapVectorColorValue;
  readonly 'icon-halo-width'?: LyraMapVectorNumericValue;
  readonly 'text-color'?: LyraMapVectorColorValue;
  readonly 'text-halo-color'?: LyraMapVectorColorValue;
  readonly 'text-halo-width'?: LyraMapVectorNumericValue;
}
export interface LyraMapVectorLayout {
  readonly 'line-cap'?: 'butt' | 'round' | 'square';
  readonly 'line-join'?: 'bevel' | 'round' | 'miter';
  readonly 'icon-image'?: string | LyraMapVectorStyleExpression;
  readonly 'icon-size'?: LyraMapVectorNumericValue;
  readonly 'icon-allow-overlap'?: boolean;
  readonly 'icon-ignore-placement'?: boolean;
  readonly 'text-size'?: LyraMapVectorNumericValue;
  readonly 'text-allow-overlap'?: boolean;
  readonly 'text-ignore-placement'?: boolean;
  readonly 'symbol-placement'?: 'point' | 'line';
}
type Paint = Readonly<Partial<Record<LyraMapVectorPaintProperty, LyraMapStyleValue>>>;
type Layout = Readonly<Partial<Record<LyraMapVectorLayoutProperty, LyraMapStyleValue>>>;
export interface CanonicalMapVectorStyle {
  readonly paint: Paint;
  readonly layout: Layout;
  readonly filter?: LyraMapVectorStyleExpression;
  readonly iconIds: readonly string[];
  readonly key: string;
}
export interface ResolvedMapVectorStyle { readonly paint: Paint; readonly layout: Layout; readonly filter?: LyraMapVectorStyleExpression; }
type Render = 'line' | 'circle' | 'fill' | 'symbol';
type Output = 'color' | 'icon' | readonly [number, number];
const paints: Record<Render, readonly string[]> = {
  line: ['line-color', 'line-width'], circle: ['circle-color', 'circle-radius', 'circle-stroke-color', 'circle-stroke-width'],
  fill: ['fill-color', 'fill-outline-color'], symbol: ['icon-color', 'icon-halo-color', 'icon-halo-width', 'text-color', 'text-halo-color', 'text-halo-width'],
};
const layouts: Record<Render, readonly string[]> = {
  line: ['line-cap', 'line-join'], circle: [], fill: [],
  symbol: ['icon-image', 'icon-size', 'icon-allow-overlap', 'icon-ignore-placement', 'text-size', 'text-allow-overlap', 'text-ignore-placement', 'symbol-placement'],
};
const bounds: Record<string, readonly [number, number]> = {
  'line-width': [0, 100], 'circle-stroke-width': [0, 100], 'circle-radius': [0, 200],
  'text-size': [1, 128], 'icon-size': [0, 16], 'icon-halo-width': [0, 32], 'text-halo-width': [0, 32],
};
const invalid = (): never => { throw new Error('Invalid vector style'); };
function own(value: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
/** Reject data that a generic collection snapshot would otherwise omit or normalize. */
function inspect(value: unknown, limitNodes: number, limitDepth: number, limitText: number): void {
  let nodes = 0; let text = 0;
  const active = new WeakSet<object>();
  const visit = (entry: unknown, depth: number): void => {
    if (++nodes > limitNodes || depth > limitDepth) return invalid();
    if (typeof entry === 'string') { text += entry.length; if (text > limitText) invalid(); return; }
    if (entry === null || typeof entry === 'boolean' || typeof entry === 'number' && Number.isFinite(entry)) return;
    if (typeof entry !== 'object' || active.has(entry)) return invalid();
    active.add(entry);
    const array = Array.isArray(entry);
    if (!array && !isPlainDataRecord(entry)) return invalid();
    if (array) {
      const prototype = Object.getPrototypeOf(entry) as unknown;
      if (!Array.isArray(prototype)) return invalid();
      const constructor = getOwnDataDescriptor(prototype, 'constructor');
      if (constructor === MISSING_OWN_DATA_DESCRIPTOR || constructor === UNSAFE_OWN_DATA_DESCRIPTOR || typeof constructor.value !== 'function' ||
        Function.prototype.toString.call(constructor.value) !== Function.prototype.toString.call(Array) || own(constructor.value, 'prototype') !== prototype) return invalid();
    }
    const keys = Reflect.ownKeys(entry);
    const length = array ? own(entry, 'length') : undefined;
    if (array && (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1)) return invalid();
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) return invalid();
      if (array && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= (length as number))) return invalid();
      const descriptor = getOwnDataDescriptor(entry, key);
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || !descriptor.enumerable) return invalid();
      if (!array) text += key.length;
      if (text > limitText) return invalid();
      visit(descriptor.value, depth + 1);
    }
    active.delete(entry);
  };
  visit(value, 0);
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const field = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
type VectorFieldExpression = readonly ['get', string];
type VectorNumericExpression = readonly ['number', VectorFieldExpression, number];
const get = (value: unknown): value is VectorFieldExpression => Array.isArray(value) && value.length === 2 && value[0] === 'get' && field(value[1]);
const numeric = (value: unknown): value is VectorNumericExpression => Array.isArray(value) && value.length === 3 && value[0] === 'number' && get(value[1]) && finite(value[2]);
const scalar = (value: unknown): boolean => get(value) || numeric(value) || typeof value === 'string' || finite(value) || typeof value === 'boolean';
const scalarKind = (value: unknown): string | undefined => get(value) ? undefined : numeric(value) ? 'number' : value === null ? 'null' : typeof value;
function list(value: unknown, nullable = false): boolean {
  return Array.isArray(value) && value.length >= 1 && value.length <= 64 &&
    value.every(entry => typeof entry === typeof value[0] && (typeof entry === 'string' || finite(entry) || nullable && typeof entry === 'boolean'));
}
function predicate(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const [op, input, literal] = value;
  if (op === 'has') return value.length === 2 && field(input);
  if (op === '!') return value.length === 2 && predicate(input);
  if (op === 'all' || op === 'any') return value.length >= 2 && value.length <= 33 && value.slice(1).every(predicate);
  if (op === '==' || op === '!=') return value.length === 3 && scalar(input) && (literal === null || typeof literal === 'string' || typeof literal === 'boolean' || finite(literal));
  if (['<', '<=', '>', '>='].includes(op as string)) return value.length === 3 && (numeric(input) || finite(input)) && finite(literal);
  return op === 'in' && value.length === 3 && scalar(input) && Array.isArray(literal) && literal.length === 2 && literal[0] === 'literal' && list(literal[1], true);
}
function output(value: LyraMapStyleValue, type: Output, zoom: boolean, ids: Set<string>): boolean {
  if (!Array.isArray(value)) {
    if (type === 'color') return typeof value === 'string' && value.trim().length > 0;
    if (type === 'icon') {
      if (typeof value !== 'string' || !value.trim() || value.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(value.trim())) return false;
      ids.add(value); return true;
    }
    return finite(value) && value >= type[0] && value <= type[1];
  }
  if (numeric(value)) return Array.isArray(type);
  const op = value[0];
  const child = (entry: LyraMapStyleValue) => output(entry, type, false, ids);
  if (op === 'case') {
    const branches = (value.length - 2) / 2;
    if (!Number.isInteger(branches) || branches < 1 || branches > 32 || !child(value[value.length - 1]!)) return false;
    for (let i = 1; i < value.length - 1; i += 2) if (!predicate(value[i]) || !child(value[i + 1]!)) return false;
    return true;
  }
  if (op === 'match') {
    const branches = (value.length - 3) / 2;
    if (!Number.isInteger(branches) || branches < 1 || branches > 32 || !get(value[1])) return false;
    const labels = new Set<string | number>(); let kind: string | undefined;
    for (let i = 2; i < value.length - 1; i += 2) {
      const label = value[i]; const items = Array.isArray(label) ? label : [label];
      if (!list(items)) return false;
      for (const item of items) {
        if (kind !== undefined && kind !== typeof item || labels.has(item as string | number)) return false;
        kind = typeof item; labels.add(item as string | number);
      }
      if (!child(value[i + 1]!)) return false;
    }
    return child(value[value.length - 1]!);
  }
  if (op !== 'step' && op !== 'interpolate') return false;
  const interpolated = op === 'interpolate';
  if (interpolated && (type === 'icon' || !Array.isArray(value[1]) || value[1].length !== 1 || value[1][0] !== 'linear')) return false;
  const input = value[interpolated ? 2 : 1];
  if (!(numeric(input) || finite(input) || zoom && Array.isArray(input) && input.length === 1 && input[0] === 'zoom')) return false;
  const start = 3; const stops = (value.length - start) / 2;
  if (!Number.isInteger(stops) || stops < (interpolated ? 2 : 1) || stops > 32 || !interpolated && !child(value[2]!)) return false;
  let previous: number | undefined;
  for (let i = start; i < value.length; i += 2) {
    const stop = value[i];
    if (!finite(stop) || previous !== undefined && (stop <= previous || interpolated && !Number.isFinite(stop - previous)) || !child(value[i + 1]!)) return false;
    previous = stop;
  }
  return true;
}

/** Omitted keys preserve defaults; explicitly undefined keys reject. Never reads authored accessors. */
export function projectMapVectorStyle(input: { readonly render: Render; readonly hasLabel: boolean; readonly paint?: unknown; readonly layout?: unknown; readonly filter?: unknown }): CanonicalMapVectorStyle | undefined {
  try {
    if (!isPlainDataRecord(input)) return undefined;
    const render = own(input, 'render'); const hasLabel = own(input, 'hasLabel');
    if (typeof render !== 'string' || !Object.hasOwn(paints, render) || typeof hasLabel !== 'boolean') return undefined;
    const wrapper: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(input)) {
      if (key === 'render' || key === 'hasLabel') continue;
      if (typeof key !== 'string' || !['paint', 'layout', 'filter'].includes(key)) return undefined;
      wrapper[key] = own(input, key);
    }
    inspect(wrapper, MAX_NODES, 12, MAX_TEXT);
    const safe = safeValue(wrapper);
    if (!safe || !isPlainDataRecord(safe.value)) return undefined;
    const paint = safe.value['paint'] ?? {}; const layout = safe.value['layout'] ?? {};
    if (!isPlainDataRecord(paint) || !isPlainDataRecord(layout) || Object.hasOwn(wrapper, 'paint') && wrapper['paint'] === null || Object.hasOwn(wrapper, 'layout') && wrapper['layout'] === null) return undefined;
    const ids = new Set<string>();
    for (const [kind, properties, allowed] of [['paint', paint, paints[render as Render]], ['layout', layout, layouts[render as Render]]] as const) {
      for (const [key, value] of Object.entries(properties)) {
        if (!allowed.includes(key) || key.startsWith('text-') && !hasLabel || key.startsWith('icon-') && key !== 'icon-image' && !Object.hasOwn(layout, 'icon-image')) return undefined;
        if (key.endsWith('color') || bounds[key] || key === 'icon-image') {
          const type: Output = key.endsWith('color') ? 'color' : key === 'icon-image' ? 'icon' : bounds[key]!;
          if (!output(value as LyraMapStyleValue, type, kind === 'paint' || key === 'text-size' || key === 'icon-size', ids)) return undefined;
        } else if (key.endsWith('overlap') || key.endsWith('placement') && key !== 'symbol-placement') {
          if (typeof value !== 'boolean') return undefined;
        } else {
          const tokens = key === 'line-cap' ? ['butt', 'round', 'square'] : key === 'line-join' ? ['bevel', 'round', 'miter'] : ['point', 'line'];
          if (typeof value !== 'string' || !tokens.includes(value)) return undefined;
        }
      }
    }
    if (render === 'symbol' && !hasLabel && !Object.hasOwn(layout, 'icon-image')) return undefined;
    const filter = safe.value['filter'];
    if (Object.hasOwn(wrapper, 'filter') && !predicate(filter)) return undefined;
    return Object.freeze({ paint: Object.freeze(paint) as Paint, layout: Object.freeze(layout) as Layout,
      ...(filter === undefined ? {} : { filter: filter as LyraMapVectorStyleExpression }), iconIds: Object.freeze([...ids]), key: safe.key });
  } catch { return undefined; }
}

function finiteInput(value: readonly LyraMapStyleValue[]): LyraMapStyleValue {
  return ['case', ['all', ['>=', value, -Number.MAX_VALUE], ['<=', value, Number.MAX_VALUE]], value, value[2]!];
}
function compileInputs(value: LyraMapStyleValue): LyraMapStyleValue {
  if (Array.isArray(value) && value[0] === 'has' && (value[1] === '$id' || value[1] === '$type')) return ['has', ['literal', value[1]!]];
  if (Array.isArray(value) && (value[0] === 'literal' || value[0] === 'get' || value[0] === 'has')) return value;
  if (Array.isArray(value) && (value[0] === '==' || value[0] === '!=') && scalarKind(value[1]) !== undefined && scalarKind(value[1]) !== scalarKind(value[2])) {
    // A static type mismatch is unequal without coercion; native comparisons require matching types.
    return [value[0], ['literal', true], false];
  }
  if (numeric(value)) return finiteInput(value);
  // Native filters otherwise interpret scalar comparisons as deprecated property-name filters.
  if (Array.isArray(value) && ['==', '!=', '<', '<=', '>', '>='].includes(value[0] as string) && !Array.isArray(value[1])) {
    return [value[0]!, ['literal', value[1]!], value[2]!];
  }
  return Array.isArray(value) ? value.map(compileInputs) : value;
}
function compileOutput(value: LyraMapStyleValue, type: Output, color: (authored: string) => string): LyraMapStyleValue {
  if (!Array.isArray(value)) {
    if (type !== 'color') return value;
    const resolved = color(value as string);
    if (typeof resolved !== 'string' || !resolved.trim()) return invalid();
    return resolved;
  }
  if (numeric(value)) return ['min', (type as readonly number[])[1]!, ['max', (type as readonly number[])[0]!, finiteInput(value)]];
  const result = [...value]; const op = value[0];
  if (op === 'case') {
    for (let i = 1; i < value.length - 1; i += 2) { result[i] = compileInputs(value[i]!); result[i + 1] = compileOutput(value[i + 1]!, type, color); }
    result[result.length - 1] = compileOutput(value[value.length - 1]!, type, color);
  } else if (op === 'match') {
    // Native match tables cannot represent every finite number or inherited object key.
    // Preserve those authored labels through typed equality predicates instead.
    const labels = value.filter((_, index) => index >= 2 && index < value.length - 1 && index % 2 === 0).flat();
    if (labels.some(label => typeof label === 'number' ? !Number.isSafeInteger(label) : typeof label === 'string' && label in {})) {
      const lowered: LyraMapStyleValue[] = ['case'];
      for (let i = 2; i < value.length - 1; i += 2) {
        const label = value[i]!; const items = Array.isArray(label) ? label : [label];
        const tests: LyraMapStyleValue[] = items.map(item => ['==', value[1]!, item]);
        lowered.push(tests.length === 1 ? tests[0]! : ['any', ...tests], compileOutput(value[i + 1]!, type, color));
      }
      lowered.push(compileOutput(value[value.length - 1]!, type, color));
      return lowered;
    }
    for (let i = 3; i < value.length - 1; i += 2) result[i] = compileOutput(value[i]!, type, color);
    result[result.length - 1] = compileOutput(value[value.length - 1]!, type, color);
  } else {
    const inputIndex = op === 'step' ? 1 : 2;
    result[inputIndex] = compileInputs(value[inputIndex]!);
    if (op === 'step') result[2] = compileOutput(value[2]!, type, color);
    for (let i = 4; i < value.length; i += 2) result[i] = compileOutput(value[i]!, type, color);
  }
  return result;
}
function freeze(value: LyraMapStyleValue): LyraMapStyleValue {
  if (Array.isArray(value)) { for (const child of value) freeze(child); Object.freeze(value); }
  else if (isPlainDataRecord(value)) { for (const child of Object.values(value)) freeze(child as LyraMapStyleValue); Object.freeze(value); }
  return value;
}
/** The color callback must reject unresolved/invalid native colors by throwing. Generated caps
 * supplement, never replace, final aggregate overlay admission before any native mutation. */
export function resolveMapVectorStyle(style: CanonicalMapVectorStyle, color: (authored: string) => string): ResolvedMapVectorStyle {
  const compile = (properties: Paint | Layout): Record<string, LyraMapStyleValue> => Object.fromEntries(Object.entries(properties).map(([key, value]) => {
    const type: Output | undefined = key.endsWith('color') ? 'color' : key === 'icon-image' ? 'icon' : bounds[key];
    return [key, type ? compileOutput(value, type, color) : value];
  }));
  const result = { paint: compile(style.paint), layout: compile(style.layout), ...(style.filter === undefined ? {} : { filter: compileInputs(style.filter) as LyraMapVectorStyleExpression }) };
  inspect(result, 65_536, 20, 8 * 1024 * 1024);
  return freeze(result) as unknown as ResolvedMapVectorStyle;
}
