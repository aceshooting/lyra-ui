import {
  isAbortError,
  isResourceLimitError,
  readResponseText,
  type OwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import {
  BoundedResourceCache,
  type ResourceCacheLease,
} from '../../../internal/safe-resource-cache.js';
import { loadIconSanitizer } from './dompurify-loader.js';

export type IconResourceErrorReason = 'load' | 'too-large' | 'sanitizer';

/** Icons are small documents; this cap is applied before parsing or sanitizing the response. */
export const MAX_ICON_BYTES = 1024 * 1024;

const ICON_CACHE_ENTRIES = 128;
const SANITIZE_PROFILE = 'svg-filters-v1';
const SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  RETURN_DOM_FRAGMENT: true,
} as const;
const resources = new BoundedResourceCache<SVGSVGElement | null>(ICON_CACHE_ENTRIES);
const ownerDocumentIds = new WeakMap<Document, number>();
let nextOwnerId = 1;

export class IconResourceError extends Error {
  constructor(
    readonly reason: IconResourceErrorReason,
    override readonly cause?: unknown,
  ) {
    super(`Icon resource failed: ${reason}`);
    this.name = 'IconResourceError';
  }
}

function resourceKey(target: OwnerFetchTarget): string {
  const ownerDocument = target.view.document;
  let ownerId = ownerDocumentIds.get(ownerDocument);
  if (ownerId === undefined) {
    ownerId = nextOwnerId++;
    ownerDocumentIds.set(ownerDocument, ownerId);
  }
  return JSON.stringify([ownerId, target.url, MAX_ICON_BYTES, SANITIZE_PROFILE]);
}

/**
 * Acquires a canonical sanitized SVG. Callers must clone the returned node before changing it;
 * the retained node is shared by all matching requests and is never inserted into a document.
 */
export function acquireSanitizedIconResource(
  target: OwnerFetchTarget,
): ResourceCacheLease<SVGSVGElement | null> {
  return resources.acquire(resourceKey(target), async (signal) => {
    let response: Response;
    try {
      response = await target.view.fetch(target.url, signal ? { signal } : undefined);
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new IconResourceError('load', error);
    }
    if (!response.ok) {
      throw new IconResourceError('load', new Error(`${response.status} ${response.statusText}`));
    }

    let raw: string;
    try {
      raw = await readResponseText(response, MAX_ICON_BYTES);
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new IconResourceError(isResourceLimitError(error) ? 'too-large' : 'load', error);
    }
    if (raw.trim() === '') return null;

    const sanitizer = await loadIconSanitizer();
    if (!sanitizer) throw new IconResourceError('sanitizer');
    const fragment = sanitizer.sanitize(raw, SANITIZE_CONFIG) as DocumentFragment;
    const node = fragment.firstElementChild;
    if (!(node instanceof SVGSVGElement)) {
      throw new IconResourceError('load', new Error('response is not an SVG document'));
    }
    return node;
  });
}

/** @internal Test isolation for the process-wide canonical SVG cache. */
export function __clearIconResourceCacheForTesting(): void {
  resources.clear();
}
