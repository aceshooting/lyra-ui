import type { LyraPageViewerSnapshot } from './page-rail.class.js';

/** Owns the atomic snapshot and identity shared by page-addressed viewers. */
export class PageViewerSnapshotController {
  private identity = 0;
  private current: LyraPageViewerSnapshot = Object.freeze({
    identity: 0,
    status: 'idle',
    page: 1,
    pageCount: 0,
  });

  get value(): LyraPageViewerSnapshot { return this.current; }

  advance(): void { this.identity++; }

  reset(): void {
    this.advance();
    this.current = Object.freeze({ identity: this.identity, status: 'idle', page: 1, pageCount: 0 });
  }

  publish(status: LyraPageViewerSnapshot['status'], page: number, pageCount: number): LyraPageViewerSnapshot | null {
    const snapshot: LyraPageViewerSnapshot = Object.freeze({
      identity: this.identity,
      status,
      page: status === 'ready' ? page : 1,
      pageCount: status === 'ready' ? pageCount : 0,
    });
    const previous = this.current;
    if (
      previous.identity === snapshot.identity
      && previous.status === snapshot.status
      && previous.page === snapshot.page
      && previous.pageCount === snapshot.pageCount
    ) return null;
    this.current = snapshot;
    return snapshot;
  }
}
