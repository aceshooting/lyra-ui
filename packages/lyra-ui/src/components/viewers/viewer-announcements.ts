import {
  acquireAnnouncementSink,
  type AnnouncementPoliteness,
  type AnnouncementSink,
} from '../../internal/announcer.js';

/**
 * Owns the shared document-level live-region handles used by document viewers.
 *
 * Visible loading and error chrome stays in each viewer's shadow tree as ordinary content. The
 * spoken transition is appended here instead, because a live region inside that shadow tree is
 * not reliable across browser/screen-reader combinations. State is tracked per channel so a
 * render cannot replay an announcement, while a later transition back into loading/error still
 * produces a fresh addition in the shared sink.
 *
 * @internal
 */
export class ViewerAnnouncementController {
  private politeSink?: AnnouncementSink;
  private assertiveSink?: AnnouncementSink;
  private readonly states = new Map<string, string>();

  constructor(private readonly host: HTMLElement) {}

  /** Mount both regions before any async viewer work can settle. */
  connect(): void {
    this.states.clear();
    this.syncSinks();
  }

  /** Release every ref and forget held state so reconnect establishes a silent baseline. */
  disconnect(): void {
    this.releaseSinks();
    this.states.clear();
  }

  /** Retarget an already-connected host without replaying its current state. */
  adopted(): void {
    this.syncSinks();
  }

  /**
   * Record one channel's current state. The first observation is mount-time history and remains
   * silent; later distinct transitions into loading/error are announced exactly once.
   */
  transition(
    channel: string,
    state: string,
    message = '',
    politeness?: AnnouncementPoliteness,
  ): void {
    const fingerprint = `${state}\0${message}`;
    const previous = this.states.get(channel);
    this.states.set(channel, fingerprint);
    if (previous === undefined || previous === fingerprint) return;
    const resolvedPoliteness = politeness ??
      (state === 'loading' ? 'polite' : state === 'error' ? 'assertive' : undefined);
    if (resolvedPoliteness === 'polite') this.politeSink?.announce(message);
    else if (resolvedPoliteness === 'assertive') this.assertiveSink?.announce(message);
  }

  /** Announce an explicit user-driven polite event such as search navigation. */
  announcePolite(message: string): void {
    this.politeSink?.announce(message);
  }

  /** Announce an explicit user-driven assertive event. */
  announceAssertive(message: string): void {
    this.assertiveSink?.announce(message);
  }

  private syncSinks(): void {
    if (!this.host.isConnected) {
      this.releaseSinks();
      return;
    }
    const ownerDocument = this.host.ownerDocument;
    const current =
      this.politeSink?.element?.ownerDocument === ownerDocument &&
      this.assertiveSink?.element?.ownerDocument === ownerDocument;
    if (current) return;
    this.releaseSinks();
    this.politeSink = acquireAnnouncementSink('polite', {
      document: ownerDocument,
      source: this.host,
    });
    this.assertiveSink = acquireAnnouncementSink('assertive', {
      document: ownerDocument,
      source: this.host,
    });
  }

  private releaseSinks(): void {
    this.politeSink?.release();
    this.politeSink = undefined;
    this.assertiveSink?.release();
    this.assertiveSink = undefined;
  }
}
