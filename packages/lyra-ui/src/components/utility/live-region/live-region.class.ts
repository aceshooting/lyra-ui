import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteDuration } from '../../../internal/numbers.js';
import {
  Announcer,
  acquireAnnouncementSink,
  type AnnounceOptions,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { styles } from './live-region.styles.js';

export type LiveRegionMode = 'polite' | 'assertive';

/**
 * `<lr-live-region>` — a visually-hidden ARIA live region that throttles
 * and coalesces announcements instead of relaying every call verbatim.
 *
 * The announced copy does **not** live in this element's shadow root: a live
 * region inside a shadow root is not reliably announced (JAWS with Firefox
 * ignores one outright), so `announce()` appends to a shared, ref-counted,
 * visually-hidden region in the host document — see
 * `acquireAnnouncementSink()` in `../../../internal/announcer.js`. Every
 * `<lr-live-region>` of the same `mode` in a document shares one such region,
 * and it is unmounted when the last one disconnects. The shadow
 * `part="region"` element remains as an `aria-hidden` mirror of the latest
 * text — a styling/inspection surface, never a second announcement.
 *
 * Naive live regions plus token-by-token streaming text (a chat response, a
 * progress readout, ...) equals screen-reader spam: every incremental chunk
 * gets announced. This component wraps `Announcer`
 * (`../../internal/announcer.js`) so callers can fire `announce()` as often
 * as they like — only the latest text within each `throttle-ms` window
 * actually reaches assistive tech, and a `{ force: true }` call (e.g. once a
 * stream ends) always lands immediately regardless of any window in
 * progress.
 *
 * A consumer typically mounts one `<lr-live-region>` per page/surface
 * (much like `<lr-toast>` is one region per placement — see
 * `../toast/toaster.ts`) and keeps a reference to call `announce()` from
 * application code or a parent component:
 *
 * @example
 * ```html
 * <!-- once, near the root of a chat surface's shell -->
 * <lr-live-region id="chat-live" mode="polite"></lr-live-region>
 * ```
 * ```ts
 * const live = document.getElementById('chat-live') as LyraLiveRegion;
 *
 * // streaming tokens: fine to call on every chunk, only the trailing state lands
 * live.announce(`${partialText} …`);
 *
 * // stream finished: always announced, even mid-throttle-window
 * live.announce('Response complete', { force: true });
 * ```
 *
 * A parent Lit component would instead hold the reference via `@query`:
 * ```ts
 * @query('lr-live-region') private liveRegion!: LyraLiveRegion;
 * ```
 * and is exactly what later components in this family (a stream-status
 * indicator, a tool-call chip's status transitions, a chat message's
 * streaming state) are expected to do rather than hand-rolling their own
 * `aria-live` element.
 *
 * @customElement lr-live-region
 * @csspart region - The visually-hidden, `aria-hidden` mirror of the latest announced text. The
 * announcement itself lands in the shared light-DOM region, not here.
 * @status stable
 * @since 4.0.0
 */
export class LyraLiveRegion extends LyraElement {
  static override styles = [LyraElement.styles, styles, srOnly];

  /** `polite` (role="status") waits for the user to be idle; `assertive`
   *  (role="alert") interrupts. Mirrors native `aria-live` semantics.
   *
   *  Selects which shared light-DOM region announcements land in. `write()`
   *  re-resolves that region at announce time (not only from this property's
   *  own update cycle) so a caller that sets `mode` and immediately
   *  force-announces in the same synchronous turn -- e.g. a stream-status
   *  transition -- gets the new urgency and the new text landing together,
   *  rather than the text beating Lit's re-render to the DOM. */
  @property({ reflect: true }) mode: LiveRegionMode = 'polite';

  /** Throttle window in ms — see `Announcer` in `internal/announcer.ts`. */
  @property({ type: Number, attribute: 'throttle-ms' }) throttleMs = 500;

  private readonly announcer: Announcer;

  private regionEl?: HTMLElement;
  // The shared light-DOM region this element currently holds a reference on,
  // and the politeness it was acquired for.
  private sink?: AnnouncementSink;
  private sinkPoliteness?: LiveRegionMode;
  // A flush can land before `firstUpdated()` has ever run -- e.g. a
  // consumer that creates+appends the element and calls `announce()`
  // synchronously right after, mirroring how `toaster.ts` mounts a region
  // and uses it immediately (see the class doc's singleton-mounting note).
  // The announcement itself never waits on a render (it goes straight to the
  // shared light-DOM region); this only buffers the shadow mirror's text so
  // the very next `firstUpdated()` can catch it up.
  private pendingWrite?: string;

  /** `throttleMs` normalized to a finite timer duration before it reaches `Announcer`'s own
   *  `setTimeout(..., throttleMs)` call -- an invalid attribute value would otherwise schedule a
   *  same-tick flush (NaN/negative both clamp to 0 per the `setTimeout` spec) or hit browsers'
   *  32-bit `setTimeout` ceiling unpredictably (`Infinity`/an absurdly large value). */
  private get safeThrottleMs(): number {
    return finiteDuration(this.throttleMs, 500);
  }

  constructor() {
    super();
    // Built in the constructor (not a class-field initializer) so it reads
    // `this.throttleMs` only after that property's own field initializer
    // has already run and set the declared default.
    this.announcer = new Announcer({
      throttleMs: this.safeThrottleMs,
      onFlush: (text) => this.write(text),
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const timerHost = this.ownerDocument.defaultView;
    if (timerHost) this.announcer.setTimerHost(timerHost);
    // Acquired on connect, not on first announcement: assistive tech has to have been observing a
    // live region *before* text arrives for the change to be announced reliably, so the shared
    // region is mounted ahead of any text this element ever writes.
    this.syncSink();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('throttleMs')) {
      this.announcer.throttleMs = this.safeThrottleMs;
    }
    if (changed.has('mode')) this.syncSink();
  }

  override firstUpdated(): void {
    this.regionEl = this.renderRoot.querySelector<HTMLElement>('[part="region"]') ?? undefined;
    if (this.pendingWrite !== undefined && this.regionEl) {
      // Only the mirror is caught up here. The announcement itself already happened, back when
      // `write()` ran -- routing this back through `write()` would announce that text a second
      // time.
      this.regionEl.textContent = this.pendingWrite;
    }
    this.pendingWrite = undefined;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.announcer.cancel();
    this.pendingWrite = undefined;
    this.releaseSink();
  }

  /** Point `this.sink` at the shared region for the current `mode` in the current owner document,
   *  releasing whichever one it held before. Cheap and idempotent when nothing changed. */
  private syncSink(): void {
    if (!this.isConnected) return;
    const politeness = this.mode === 'assertive' ? 'assertive' : 'polite';
    const held =
      this.sink !== undefined &&
      this.sinkPoliteness === politeness &&
      // Adoption into another document (an iframe) has to re-target: the region the user's
      // assistive tech is watching is the one in the document the element now lives in.
      this.sink.element.ownerDocument === this.ownerDocument;
    if (held) return;
    this.releaseSink();
    this.sinkPoliteness = politeness;
    this.sink = acquireAnnouncementSink(politeness, {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseSink(): void {
    this.sink?.release();
    this.sink = undefined;
    this.sinkPoliteness = undefined;
  }

  /**
   * Queue `text` for announcement. Calls arriving within `throttle-ms` of
   * the first call in a burst collapse to a single announcement of the
   * latest text; pass `{ force: true }` to bypass the window and flush
   * immediately (e.g. for a final/terminal message that must not be
   * dropped).
   */
  announce(text: string, options?: AnnounceOptions): void {
    this.announcer.announce(text, options);
  }

  private write(text: string): void {
    // Re-resolved here rather than left to Lit's async update cycle, so a caller that sets `mode`
    // and force-announces in the same synchronous turn gets the new urgency and the new text
    // together.
    this.syncSink();
    // The announcement is an *addition* to the shared region: an identical repeat is a second
    // child node, which assistive tech reads again -- no clear-then-restore dance, and no stale
    // text left sitting in a region for focus to return to.
    this.sink?.announce(text);
    // The shadow mirror is a styling/inspection surface only (`aria-hidden`), and it is the one
    // piece that has to wait for a render.
    if (!this.regionEl) {
      this.pendingWrite = text;
      return;
    }
    this.regionEl.textContent = text;
  }

  override render(): TemplateResult {
    // aria-hidden: the announced copy lives in the shared light-DOM region, and a second live
    // region carrying the same text would make browsers that *do* announce shadow live regions
    // read every message twice.
    return html`<div part="region" class="sr-only" aria-hidden="true"></div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-live-region': LyraLiveRegion;
  }
}
