import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { OwnedFrame } from './owned-timer.js';

/** Distance from the end, in CSS px, within which a scroller still counts as following. */
const DEFAULT_NEAR_TAIL_PX = 48;

/**
 * Stick-to-bottom support for a streaming scroller: an owner-window animation-frame coalescer
 * (at most one tail jump per frame, stale after disconnect, move or realm change) and the
 * near-bottom test that decides whether a user scroll released or re-engaged following.
 */
export class FollowTailController implements ReactiveController {
  private readonly frame: OwnedFrame;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    private readonly options: {
      scroller(): HTMLElement | null;
      /** Re-checked inside the frame, since state can change between scheduling and firing. */
      shouldFollow?(): boolean;
      nearPx?: number;
    }
  ) {
    this.frame = new OwnedFrame(host);
    host.addController(this);
  }

  /** Whether the scroller currently sits within `nearPx` of its end (true when absent). */
  get atTail(): boolean {
    const scroller = this.options.scroller();
    if (!scroller) return true;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    return !Number.isFinite(distance) || distance <= (this.options.nearPx ?? DEFAULT_NEAR_TAIL_PX);
  }

  /** Whether a coalesced jump is waiting for its frame. */
  get pending(): boolean {
    return this.frame.pending;
  }

  /** Jumps the scroller to its end immediately (no smooth scroll). */
  scrollToTail(): void {
    const scroller = this.options.scroller();
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  /** Schedules at most one tail jump for the next frame; later calls in the frame are no-ops. */
  scheduleScrollToTail(): void {
    if (this.frame.pending) return;
    this.frame.schedule(() => {
      if (this.options.shouldFollow && !this.options.shouldFollow()) return;
      this.scrollToTail();
    });
  }

  cancel(): void {
    this.frame.cancel();
  }

  hostDisconnected(): void {
    this.frame.cancel();
  }
}
