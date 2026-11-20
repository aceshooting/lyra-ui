import {
  isResourceLimitError,
  readResponseText,
  type OwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { discardBody } from '../../../internal/viewer-source-controller.js';
import {
  BoundedResourceCache,
  type ResourceCacheLease,
} from '../../../internal/safe-resource-cache.js';
import { loadDompurify } from '../../../internal/dompurify-loader.js';
import { sanitizePassiveMarkup } from '../../../internal/passive-markup.js';

export type LyraIncludeMode = 'cors' | 'no-cors' | 'same-origin';
type IncludeResourceErrorReason =
  | 'network'
  | 'http'
  | 'missing-sanitizer'
  | 'resource-too-large';

/** Included partials are deliberately smaller than general document-viewer resources. */
export const MAX_INCLUDE_BYTES = 2 * 1024 * 1024;

const INCLUDE_CACHE_ENTRIES = 32;
const SANITIZE_PROFILE = 'transclusion-v3';
type IncludeOwner = OwnerFetchTarget['view'];
let resourcesByOwner = new WeakMap<IncludeOwner, BoundedResourceCache<string>>();

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

function resourcesFor(owner: IncludeOwner): BoundedResourceCache<string> {
  let resources = resourcesByOwner.get(owner);
  if (!resources) {
    resources = new BoundedResourceCache<string>(
      INCLUDE_CACHE_ENTRIES,
      typeof owner.AbortController === 'function' ? owner.AbortController : null,
    );
    resourcesByOwner.set(owner, resources);
  }
  return resources;
}

export function acquireSanitizedIncludeResource(
  url: string,
  mode: LyraIncludeMode,
  cache: boolean,
  owner: IncludeOwner,
): ResourceCacheLease<string> {
  return resourcesFor(owner).acquire(
    resourceKey(url, mode),
    async (signal) => {
      let response: Response;
      try {
        response = await owner.fetch(url, signal ? { mode, signal } : { mode });
      } catch (error) {
        throw new IncludeResourceError('network', 0, error);
      }
      if (signal?.aborted || !response.ok) discardBody(response);
      signal?.throwIfAborted();
      if (!response.ok) throw new IncludeResourceError('http', response.status);

      let raw: string;
      try {
        raw = await readResponseText(response, MAX_INCLUDE_BYTES);
      } catch (error) {
        if (isResourceLimitError(error)) {
          throw new IncludeResourceError('resource-too-large', 0, error);
        }
        throw new IncludeResourceError('network', 0, error);
      }

      signal?.throwIfAborted();
      const sanitizer = await loadDompurify();
      signal?.throwIfAborted();
      if (!sanitizer) throw new IncludeResourceError('missing-sanitizer', 0);
      return sanitizePassiveMarkup(sanitizer, raw, owner.document, 'transclusion');
    },
    { cache },
  );
}

export function invalidateIncludeResource(
  url: string,
  mode: LyraIncludeMode,
  owner: IncludeOwner,
): void {
  resourcesByOwner.get(owner)?.invalidate(resourceKey(url, mode));
}

/** @internal Test isolation for the per-owner resource caches. */
export function __clearIncludeResourceCacheForTesting(): void {
  resourcesByOwner = new WeakMap();
}
