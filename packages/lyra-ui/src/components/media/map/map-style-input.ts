import { snapshotPublicCollection } from '../../../internal/collection-snapshot.js';
import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

function invalid(): never { throw new Error('Invalid map font source.'); }
function own(value: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function range(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^u\+(?:([0-9a-f]{1,6})(?:-([0-9a-f]{1,6}))?|([0-9a-f]{0,5}\?{1,6}))$/i.exec(value);
  if (!match) return false;
  if (match[3] !== undefined) return match[3].length <= 6;
  const start = Number.parseInt(match[1]!, 16), end = Number.parseInt(match[2] ?? match[1]!, 16);
  return start <= end && end <= 0x10ffff;
}

/** Detach bounded native font declarations before the general style snapshot can traverse them. */
function fontFaces(value: unknown): Readonly<Record<string, unknown>> {
  if (!isPlainDataRecord(value)) return invalid();
  const families = Reflect.ownKeys(value);
  if (families.length === 0 || families.length > 64) return invalid();
  let remaining = 50_000;
  const spend = (): void => { if (--remaining < 0) invalid(); };
  const array = (input: unknown, limit: number): readonly unknown[] => {
    if (!Array.isArray(input)) return invalid();
    const length = readOwnArrayLength(input);
    if (length === undefined || length > limit) return invalid();
    const entries: unknown[] = [];
    for (let index = 0; index < length; index++) {
      spend();
      const descriptor = getOwnDataDescriptor(input, String(index));
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
      entries.push(descriptor.value);
    }
    return entries;
  };
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const family of families) {
    if (typeof family !== 'string') continue;
    spend();
    const descriptor = getOwnDataDescriptor(value, family);
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
    if (!descriptor.enumerable) continue;
    if (!family.trim()) return invalid();
    if (typeof descriptor.value === 'string') {
      if (!descriptor.value.trim()) return invalid();
      output[family] = descriptor.value; continue;
    }
    const entries = array(descriptor.value, 256);
    if (entries.length === 0) return invalid();
    output[family] = Object.freeze(entries.map(face => {
      if (!isPlainDataRecord(face)) return invalid();
      const keys = Reflect.ownKeys(face);
      if (keys.length > 2 || keys.some(key => key !== 'url' && key !== 'unicode-range')) return invalid();
      spend(); const url = own(face, 'url');
      if (typeof url !== 'string' || !url.trim()) return invalid();
      const rangesDescriptor = getOwnDataDescriptor(face, 'unicode-range');
      if (rangesDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
      if (rangesDescriptor === MISSING_OWN_DATA_DESCRIPTOR) return Object.freeze({ url });
      const ranges = array(rangesDescriptor.value, 64);
      if (!ranges.every(range)) return invalid();
      return Object.freeze({ url, 'unicode-range': Object.freeze(ranges) });
    }));
  }
  return Object.keys(output).length > 0 ? Object.freeze(output) : invalid();
}

/** Preserve the general immutable style boundary while admitting font providers by their schema. */
export function snapshotMapStyle(value: unknown, view?: Window | null): unknown {
  if (!isPlainDataRecord(value)) return snapshotPublicCollection(value, view);
  let providers: Readonly<Record<string, unknown>> = Object.freeze({});
  try {
    const glyphs = own(value, 'glyphs');
    const faces = own(value, 'font-faces');
    const glyphProvider = typeof glyphs === 'string' && glyphs.trim().length > 0;
    let admittedFaces: Readonly<Record<string, unknown>> | undefined;
    if (faces !== undefined) {
      try { admittedFaces = fontFaces(faces); }
      catch { if (!glyphProvider) throw new Error('Invalid map font source.'); }
    }
    providers = Object.freeze({ ...(glyphProvider ? { glyphs } : {}), ...(admittedFaces ? { 'font-faces': admittedFaces } : {}) });
  } catch {
    // Missing providers make requested labels fail closed through normal map admission.
  }
  const style = snapshotPublicCollection(value, view, {
    recordKey: (key, _entry, depth) => depth === 0 && (key === 'glyphs' || key === 'font-faces') ? 'omit' : 'copy',
  });
  if (!isPlainDataRecord(style)) return style;
  // The final snapshot retains the existing whole-style node/entry limits as well.
  return snapshotPublicCollection({ ...style, ...providers }, view);
}
