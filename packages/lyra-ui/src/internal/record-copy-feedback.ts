import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  clipboardWriteFailure,
  clipboardWriteSuccess,
  writeClipboardText,
  type LyraClipboardWriteOutcome,
  type LyraCopyErrorReason,
} from './clipboard.js';
import { COPY_FEEDBACK_MS } from './copy-feedback.js';

type CopyStatus = 'rest' | 'success' | 'error';

interface CopyRequest {
  owner: Window;
  source: string | number;
  timer?: number;
}

/** Clipboard feedback owned by a displayed record and its browsing context. */
export class RecordCopyFeedback implements ReactiveController {
  status: CopyStatus = 'rest';
  private current?: CopyRequest;

  constructor(
    private readonly host: HTMLElement & Partial<ReactiveControllerHost>,
    private readonly source: () => string | number,
    private readonly settled: (outcome: LyraClipboardWriteOutcome) => void,
    private readonly statusChanged?: (status: CopyStatus) => void,
    private readonly durationMs: number = COPY_FEEDBACK_MS,
  ) {
    host.addController?.(this);
  }

  hostUpdate(): void {
    if (this.current && this.current.source !== this.source()) this.reset();
  }

  hostDisconnected(): void {
    this.reset();
  }

  cancelTimer(): void {
    const current = this.current;
    if (current?.timer !== undefined) {
      current.owner.clearTimeout(current.timer);
      delete current.timer;
    }
  }

  reset(): void {
    this.cancelTimer();
    this.current = undefined;
    this.setStatus('rest');
  }

  private setStatus(status: CopyStatus): void {
    this.statusChanged?.(status);
    if (this.status === status) return;
    this.status = status;
    this.host.requestUpdate?.();
  }

  async write(text: string): Promise<void> {
    this.reset();
    const owner = this.host.ownerDocument.defaultView;
    if (!owner || !this.host.isConnected) return;
    const request: CopyRequest = { owner, source: this.source() };
    this.current = request;
    const outcome = await writeClipboardText(owner, text);
    if (this.current !== request || !this.host.isConnected || this.host.ownerDocument.defaultView !== owner ||
      this.source() !== request.source) return;
    this.setStatus(outcome.ok ? 'success' : 'error');
    request.timer = owner.setTimeout(() => {
      if (this.current === request) this.reset();
    }, this.durationMs);
    this.settled(outcome);
  }
}

/** The settled outcome of one clipboard write, as emitted in `lr-copy` / `lr-copy-error`. */
export type CopyOutcome = LyraClipboardWriteOutcome;

/** Builds a frozen copy outcome for a write a component performed itself (for example a lazily built payload). */
export function copyOutcome(kind: 'success', detail: { text: string }): CopyOutcome;
export function copyOutcome(
  kind: 'failure',
  detail: { text: string; reason?: LyraCopyErrorReason; error?: unknown },
): CopyOutcome;
export function copyOutcome(
  kind: 'success' | 'failure',
  detail: { text: string; reason?: LyraCopyErrorReason; error?: unknown },
): CopyOutcome {
  if (kind === 'success') return clipboardWriteSuccess(detail.text);
  return clipboardWriteFailure(detail.text, detail.error ?? new Error('The text could not be copied.'), detail.reason ?? 'failed');
}

/**
 * Announces and emits one copy outcome: `lr-copy` with the outcome on success, otherwise a
 * detail-less `lr-error` followed by `lr-copy-error` with the outcome. Every step re-checks
 * `current()` because a listener may disconnect or retarget the host between steps.
 */
export function reportCopyOutcome(
  host: {
    emit: (name: 'lr-copy' | 'lr-error' | 'lr-copy-error', detail?: CopyOutcome) => unknown;
    announce: (ok: boolean) => void;
  },
  outcome: CopyOutcome,
  current: () => boolean = () => true,
): void {
  if (!current()) return;
  host.announce(outcome.ok);
  if (!current()) return;
  if (outcome.ok) {
    host.emit('lr-copy', outcome);
    return;
  }
  host.emit('lr-error');
  if (current()) host.emit('lr-copy-error', outcome);
}

/** Per-key copy feedback (one control per row/node); showing a key replaces any earlier one. */
export class KeyedCopyFeedback implements ReactiveController {
  /** The key currently showing feedback, and whether its copy succeeded. */
  state: { readonly key: string; readonly ok: boolean } | null = null;
  private timer?: { owner: Window; handle: number };

  constructor(
    private readonly host: HTMLElement & Partial<ReactiveControllerHost>,
    private readonly durationMs: number = COPY_FEEDBACK_MS,
  ) {
    host.addController?.(this);
  }

  hostDisconnected(): void {
    this.clear();
  }

  /** The feedback for `key`, or null when another key (or none) is showing. */
  for(key: string): { readonly ok: boolean } | null {
    return this.state?.key === key ? this.state : null;
  }

  clear(): void {
    const timer = this.timer;
    if (timer) timer.owner.clearTimeout(timer.handle);
    this.timer = undefined;
    if (this.state === null) return;
    this.state = null;
    this.host.requestUpdate?.();
  }

  show(key: string, ok: boolean): void {
    const owner = this.host.ownerDocument.defaultView;
    if (!owner || !this.host.isConnected) return;
    this.clear();
    const state = { key, ok };
    this.state = state;
    this.timer = {
      owner,
      handle: owner.setTimeout(() => {
        if (this.state === state) this.clear();
      }, this.durationMs),
    };
    this.host.requestUpdate?.();
  }
}
