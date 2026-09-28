import { canonicalizeLocaleTag } from './locale-tag.js';

/** Shared loader signature for opt-in catalog loading. Loading does not select the active locale. */
export type LyraLocaleLoader = (locale: string) => Promise<void>;

/** Builds the optional loader from its fixed generated catalog inventory. @internal */
export function createLocaleLoader(
  loaders: Readonly<Record<string, () => Promise<unknown>>>
): LyraLocaleLoader {
  const pending = new Map<string, Promise<void>>();
  const english = Promise.resolve();
  return (locale) => {
    let canonical: string;
    try {
      if (typeof locale !== 'string' || locale.length === 0 || locale.length > 255)
        throw new TypeError('A supported locale tag is required.');
      canonical = canonicalizeLocaleTag(locale.replaceAll('_', '-'));
      if (canonical === 'en') return english;
      if (!Object.prototype.hasOwnProperty.call(loaders, canonical))
        throw new RangeError(`No built-in catalog is available for ${canonical}.`);
    } catch (error) {
      return Promise.reject(error);
    }
    const existing = pending.get(canonical);
    if (existing) return existing;
    const promise = Promise.resolve()
      .then(() => loaders[canonical]!())
      .then(() => undefined)
      .catch((error: unknown) => {
        pending.delete(canonical);
        throw error;
      });
    pending.set(canonical, promise);
    return promise;
  };
}
