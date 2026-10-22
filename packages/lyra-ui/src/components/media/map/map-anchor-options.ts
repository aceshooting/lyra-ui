import { getInheritedPropertyDescriptor, getOwnDataDescriptor, isObjectValue, isPlainDataRecord,
  MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { finiteNumber } from '../../../internal/numbers.js';

/** Nonnegative finite CSS-pixel insets. Omitted logical edges default to zero. */
export interface LyraMapAnchorSafeArea {
  readonly blockStart?: number;
  readonly inlineEnd?: number;
  readonly blockEnd?: number;
  readonly inlineStart?: number;
}
export type LyraMapAnchorBoundary = Element | readonly Element[];
type MapAnchorSafeArea = Readonly<Required<LyraMapAnchorSafeArea>>;
export interface MapAnchorOptionsContext { readonly current?: () => boolean; }
export type MapAnchorOptionsResult = {
  readonly ok: true;
  readonly safeArea: MapAnchorSafeArea;
  /** Detached mutable copy, suitable for the shared positioner's Element[] boundary input. */
  readonly boundaries: Element[];
} | { readonly ok: false; readonly code: 'invalid-safe-area' | 'invalid-boundary' | 'stale' };
const EDGES = ['blockStart', 'inlineEnd', 'blockEnd', 'inlineStart'] as const;
class StaleAnchorOptions extends Error {}

/**
 * Snapshots own placement data without evaluating caller getters. Explicitly undefined edge
 * values are invalid; an undefined safe-area object uses all-zero defaults. Valid large finite
 * edges stay intact so the placement owner can collapse/clamp them against actual allocation.
 * Boundaries must be real connected Elements in the supplied owner document; no DOM globals are
 * read until a nonempty boundary needs validation, preserving SSR-safe module imports.
 */
export function admitMapAnchorOptions(input: unknown, ownerDocument: Document,
  context: MapAnchorOptionsContext = {}): MapAnchorOptionsResult {
  let code: 'invalid-safe-area' | 'invalid-boundary' = 'invalid-safe-area';
  const guard = (): void => {
    let current = false;
    try { current = context.current?.() ?? true; } catch { /* A failing ownership check is stale. */ }
    if (!current) throw new StaleAnchorOptions();
  };
  const descriptor = (value: object, key: string): ReturnType<typeof getOwnDataDescriptor> => {
    guard(); const result = getOwnDataDescriptor(value, key); guard(); return result;
  };
  const own = (value: object, key: string, optional = false): unknown => {
    const result = descriptor(value, key);
    if (result === UNSAFE_OWN_DATA_DESCRIPTOR || result === MISSING_OWN_DATA_DESCRIPTOR && !optional) throw new Error('Invalid anchor data.');
    return result === MISSING_OWN_DATA_DESCRIPTOR ? undefined : result.value;
  };
  const keys = (value: unknown, allowed: readonly string[]): readonly string[] => {
    guard(); if (!isPlainDataRecord(value)) throw new Error('Invalid anchor options.'); guard();
    const result = Reflect.ownKeys(value); guard();
    if (result.length > allowed.length || result.some(key => typeof key !== 'string' || !allowed.includes(key))) throw new Error('Invalid anchor fields.');
    return result as string[];
  };
  const inherited = (value: object, key: string): PropertyDescriptor => {
    guard(); const result = getInheritedPropertyDescriptor(value, key); guard();
    if (!result) throw new Error('Unavailable DOM capability.'); return result;
  };
  const data = (value: object, key: string): unknown => {
    const result = inherited(value, key);
    if (!Object.hasOwn(result, 'value')) throw new Error('Invalid DOM capability.'); return result.value;
  };
  const getter = (value: object, key: string): (() => unknown) => {
    const result = inherited(value, key);
    if (typeof result.get !== 'function') throw new Error('Unavailable DOM capability.'); return result.get;
  };
  const invoke = (read: () => unknown, receiver: unknown): unknown => {
    guard(); const result: unknown = Reflect.apply(read, receiver, []); guard(); return result;
  };
  try {
    guard(); const top = keys(input, ['safeArea', 'boundary']);
    const rawSafeArea = top.includes('safeArea') ? own(input as object, 'safeArea') : undefined;
    const safeKeys = rawSafeArea === undefined ? [] : keys(rawSafeArea, EDGES);
    const safeArea = {} as Record<(typeof EDGES)[number], number>;
    for (const edge of EDGES) {
      const value = safeKeys.includes(edge) ? own(rawSafeArea as object, edge) : 0;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid anchor safe area.');
      safeArea[edge] = finiteNumber(value, 0);
    }
    code = 'invalid-boundary';
    const rawBoundary = top.includes('boundary') ? own(input as object, 'boundary') : undefined;
    let values: readonly unknown[] = [];
    guard(); const isArray = Array.isArray(rawBoundary); guard();
    if (isArray) {
      guard(); const count = readOwnArrayLength(rawBoundary); guard();
      if (count === undefined || count > 32) throw new Error('Invalid anchor boundary count.');
      const arrayKeys = Reflect.ownKeys(rawBoundary as object); guard();
      if (arrayKeys.length !== count + 1) throw new Error('Invalid anchor boundary array.');
      values = Array.from({ length: count }, (_entry, index) => own(rawBoundary as object, String(index)));
    } else if (rawBoundary !== undefined) values = [rawBoundary];
    const boundaries: Element[] = [];
    if (values.length) {
      // Read native getters lazily and use the supplied document's realm when it has a view.
      if (typeof Document === 'undefined' || typeof Element === 'undefined' || typeof Node === 'undefined') throw new Error('DOM boundaries unavailable.');
      const view = invoke(getter(Document.prototype, 'defaultView'), ownerDocument);
      const elementConstructor = view && isObjectValue(view) ? data(view, 'Element') : Element;
      const nodeConstructor = view && isObjectValue(view) ? data(view, 'Node') : Node;
      if (!isObjectValue(elementConstructor) || !isObjectValue(nodeConstructor)) throw new Error('DOM constructors unavailable.');
      const elementPrototype = data(elementConstructor, 'prototype'), nodePrototype = data(nodeConstructor, 'prototype');
      if (!isObjectValue(elementPrototype) || !isObjectValue(nodePrototype)) throw new Error('DOM prototypes unavailable.');
      const localName = getter(elementPrototype, 'localName'), documentOf = getter(nodePrototype, 'ownerDocument'), connected = getter(nodePrototype, 'isConnected');
      for (const value of values) {
        if (!isObjectValue(value) || typeof invoke(localName, value) !== 'string' || invoke(documentOf, value) !== ownerDocument || invoke(connected, value) !== true) throw new Error('Invalid anchor boundary.');
        boundaries.push(value as Element);
      }
    }
    guard(); return Object.freeze({ ok: true, safeArea: Object.freeze(safeArea), boundaries });
  } catch (error) { return Object.freeze({ ok: false, code: error instanceof StaleAnchorOptions ? 'stale' : code }); }
}
