import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { writeClipboardText, type LyraClipboardWriteOutcome } from './clipboard.js';
import { COPY_FEEDBACK_MS } from './copy-feedback.js';

interface CopyRequest {
  owner: Window;
  source: string | number;
  timer?: number;
}

/** Clipboard feedback owned by a displayed record and its browsing context. */
export class RecordCopyFeedback implements ReactiveController {
  status: 'rest' | 'success' | 'error' = 'rest';
  private current?: CopyRequest;

  constructor(
    private readonly host: HTMLElement & ReactiveControllerHost,
    private readonly source: () => string | number,
    private readonly settled: (outcome: LyraClipboardWriteOutcome) => void,
  ) {
    host.addController(this);
  }

  hostUpdate(): void {
    if (this.current && this.current.source !== this.source()) this.reset();
  }

  hostDisconnected(): void {
    this.reset();
  }

  reset(): void {
    const current = this.current;
    this.current = undefined;
    if (current?.timer !== undefined) current.owner.clearTimeout(current.timer);
    if (this.status !== 'rest') {
      this.status = 'rest';
      this.host.requestUpdate();
    }
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
    this.status = outcome.ok ? 'success' : 'error';
    this.host.requestUpdate();
    request.timer = owner.setTimeout(() => {
      if (this.current === request) this.reset();
    }, COPY_FEEDBACK_MS);
    this.settled(outcome);
  }
}
