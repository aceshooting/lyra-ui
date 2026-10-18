import type {
  ShikiLanguageInput,
  ShikiLanguageLoader,
  ShikiLanguageSource,
} from '../components/conversation/code-block/shiki-types.js';

const emptyLanguages: Readonly<Record<string, ShikiLanguageInput>> = Object.freeze({});
const combinedMaps = new WeakMap<object, WeakMap<object, Readonly<Record<string, ShikiLanguageSource>>>>();

/** Keeps concrete grammar readback separate from lazy loaders while sharing one stable map with
 * the highlighter. Concrete own data entries win; accessors are never invoked during merging. */
export function combineShikiLanguageSources(
  languages: Readonly<Record<string, ShikiLanguageInput>> | undefined,
  loaders: Readonly<Record<string, ShikiLanguageLoader>> | undefined,
): Readonly<Record<string, ShikiLanguageSource>> | undefined {
  if (loaders === null || typeof loaders !== 'object') return languages;
  const concrete = languages !== null && typeof languages === 'object' ? languages : emptyLanguages;
  let byConcrete = combinedMaps.get(loaders);
  if (!byConcrete) {
    byConcrete = new WeakMap();
    combinedMaps.set(loaders, byConcrete);
  }
  const cached = byConcrete.get(concrete);
  if (cached) return cached;
  const combined = Object.create(null) as Record<string, ShikiLanguageSource>;
  for (const source of [concrete, loaders]) {
    let keys: string[];
    try { keys = Object.getOwnPropertyNames(source); } catch { continue; }
    for (const key of keys) {
      if (Object.hasOwn(combined, key)) continue;
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(source, key); } catch { continue; }
      if (descriptor?.enumerable && 'value' in descriptor) {
        Object.defineProperty(combined, key, {
          value: descriptor.value, enumerable: true, configurable: true, writable: true,
        });
      }
    }
  }
  Object.freeze(combined);
  byConcrete.set(concrete, combined);
  return combined;
}
