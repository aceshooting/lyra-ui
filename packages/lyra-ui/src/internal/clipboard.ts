/** Why an attempted clipboard write failed. */
export type LyraCopyErrorReason = 'unsupported' | 'denied' | 'failed';

/** A clipboard write that reached the owning browsing context and fulfilled. */
export interface LyraClipboardWriteSuccess {
  readonly ok: true;
  readonly text: string;
}

/** A clipboard write that could not be completed. */
export interface LyraClipboardWriteFailure {
  readonly ok: false;
  readonly text: string;
  readonly reason: LyraCopyErrorReason;
  readonly error: unknown;
}

/** The settled, immutable outcome of one clipboard write. */
export type LyraClipboardWriteOutcome = LyraClipboardWriteSuccess | LyraClipboardWriteFailure;

class ClipboardUnavailableError extends Error {
  constructor() {
    super('The Clipboard API is unavailable in this context.');
    this.name = 'ClipboardUnavailableError';
  }
}

function errorName(error: unknown): string | undefined {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) return undefined;
  try {
    const name = (error as { readonly name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

/** Classifies a platform clipboard failure without relying on an ambient-realm constructor. */
export function clipboardFailureReason(error: unknown): LyraCopyErrorReason {
  if (error instanceof ClipboardUnavailableError) return 'unsupported';
  const name = errorName(error);
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed';
}

/** A frozen failure outcome; `reason` defaults to the classification of `error`. */
export function clipboardWriteFailure(
  text: string,
  error: unknown,
  reason = clipboardFailureReason(error),
): LyraClipboardWriteFailure {
  return Object.freeze({ ok: false, text, reason, error });
}

/** A frozen success outcome. */
export function clipboardWriteSuccess(text: string): LyraClipboardWriteSuccess {
  return Object.freeze({ ok: true, text });
}

/**
 * Writes through the exact window that owns a component and returns one settled outcome instead
 * of mixing activation intent with clipboard success. Missing APIs, synchronous throws, and
 * rejected promises all take the same failure path; no ambient global is consulted.
 */
export async function writeClipboardText(
  owner: Window | null | undefined,
  text: string,
): Promise<LyraClipboardWriteOutcome> {
  return (await writeAcceptedClipboardText(owner, text, () => true))!;
}

/**
 * {@link writeClipboardText}, re-checking `accepted()` after the clipboard capability is read and
 * before the write starts. Resolves `undefined`, without writing, when the request was superseded
 * (for example by a capability getter that replaced the owning source).
 */
export async function writeAcceptedClipboardText(
  owner: Window | null | undefined,
  text: string,
  accepted: () => boolean,
): Promise<LyraClipboardWriteOutcome | undefined> {
  if (!owner) return clipboardWriteFailure(text, new ClipboardUnavailableError(), 'unsupported');
  try {
    const clipboard = owner.navigator.clipboard;
    const write = clipboard?.writeText;
    if (!accepted()) return undefined;
    if (typeof write !== 'function') return clipboardWriteFailure(text, new ClipboardUnavailableError(), 'unsupported');
    await write.call(clipboard, text);
    return clipboardWriteSuccess(text);
  } catch (error) {
    return clipboardWriteFailure(text, error);
  }
}
