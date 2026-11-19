import { isResourceLimitError, LyraUserFacingError } from './resource-loader.js';

/** Defers translation until display, preserving explicit messages supplied by callers. */
export function viewerFailureMessage(
  error: unknown,
  localize: (key: string) => string,
  fallback?: () => string,
): () => string {
  if (error instanceof LyraUserFacingError) {
    const { message, resolveMessage } = error;
    return resolveMessage ? () => resolveMessage(localize) : () => message;
  }
  if (isResourceLimitError(error)) return () => localize('documentPreviewResourceTooLarge');
  return fallback ?? (() => localize('documentPreviewFailedToLoad'));
}
