import {
  isAbortError,
  isResourceLimitError,
  readResponseText,
} from '../../../internal/resource-loader.js';
import {
  BoundedResourceCache,
  type ResourceCacheLease,
} from '../../../internal/safe-resource-cache.js';
import { loadHtmlSanitizer } from '../html-viewer/dompurify-loader.js';

export type LyraIncludeMode = 'cors' | 'no-cors' | 'same-origin';
export type IncludeResourceErrorReason =
  | 'network'
  | 'http'
  | 'missing-sanitizer'
  | 'resource-too-large';

/** Included partials are deliberately smaller than general document-viewer resources. */
export const MAX_INCLUDE_BYTES = 2 * 1024 * 1024;

const INCLUDE_CACHE_ENTRIES = 32;
const SANITIZE_PROFILE = 'html-v1';
const resources = new BoundedResourceCache<string>(INCLUDE_CACHE_ENTRIES);

export class IncludeResourceError extends Error {
  constructor(
    readonly reason: IncludeResourceErrorReason,
    readonly status: number,
    override readonly cause?: unknown,
  ) {
    super(`Include resource failed: ${reason}`);
    this.name = 'IncludeResourceError';
  }
}

function resourceKey(url: string, mode: LyraIncludeMode): string {
  return JSON.stringify([url, mode, MAX_INCLUDE_BYTES, SANITIZE_PROFILE]);
}

export function acquireSanitizedIncludeResource(
  url: string,
  mode: LyraIncludeMode,
  cache: boolean,
): ResourceCacheLease<string> {
  return resources.acquire(
    resourceKey(url, mode),
    async (signal) => {
      let response: Response;
      try {
        response = await fetch(url, signal ? { mode, signal } : { mode });
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new IncludeResourceError('network', 0, error);
      }
      if (!response.ok) throw new IncludeResourceError('http', response.status);

      let raw: string;
      try {
        raw = await readResponseText(response, MAX_INCLUDE_BYTES);
      } catch (error) {
        if (isAbortError(error)) throw error;
        if (isResourceLimitError(error)) {
          throw new IncludeResourceError('resource-too-large', 0, error);
        }
        throw new IncludeResourceError('network', 0, error);
      }

      const sanitizer = await loadHtmlSanitizer();
      if (!sanitizer) throw new IncludeResourceError('missing-sanitizer', 0);
      return String(sanitizer.sanitize(raw));
    },
    { cache },
  );
}

export function invalidateIncludeResource(url: string, mode: LyraIncludeMode): void {
  resources.invalidate(resourceKey(url, mode));
}

/** @internal Test isolation for the process-wide resource cache. */
export function __clearIncludeResourceCacheForTesting(): void {
  resources.clear();
}
