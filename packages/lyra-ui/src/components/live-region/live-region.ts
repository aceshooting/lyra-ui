import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { srOnly } from '../../internal/a11y.js';
import { Announcer, type AnnounceOptions } from '../../internal/announcer.js';
import { styles } from './live-region.styles.js';

export type LiveRegionMode = 'polite' | 'assertive';

/**
 * `<lyra-live-region>` — a visually-hidden ARIA live region that throttles
 * and coalesces announcements instead of relaying every call verbatim.
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
 * A consumer typically mounts one `<lyra-live-region>` per page/surface
 * (much like `<lyra-toast>` is one region per placement — see
 * `../toast/toaster.ts`) and keeps a reference to call `announce()` from
 * application code or a parent component:
 *
 * @example
 * ```html
 * <!-- once, near the root of a chat surface's shell -->
 * <lyra-live-region id="chat-live" mode="polite"></lyra-live-region>
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
 * @query('lyra-live-region') private liveRegion!: LyraLiveRegion;
 * ```
 * and is exactly what later components in this family (a stream-status
 * indicator, a tool-call chip's status transitions, a chat message's
 * streaming state) are expected to do rather than hand-rolling their own
 * `aria-live` element.
 *
 * @customElement lyra-live-region
 * @csspart region - The visually-hidden element carrying `role`/`aria-live`.
 */
export class LyraLiveRegion extends LyraElement {
  static styles = [LyraElement.styles, styles, srOnly];

  /** `polite` (role="status") waits for the user to be idle; `assertive`
   *  (role="alert") interrupts. Mirrors native `aria-live` semantics. */
  @property({ reflect: true }) mode: LiveRegionMode = 'polite';

  /** Throttle window in ms — see `Announcer` in `internal/announcer.ts`. */
  @property({ type: Number, attribute: 'throttle-ms' }) throttleMs = 500;

  private readonly announcer: Announcer;

  // The live region's own last-written text. Tracked separately from
  // whatever Lit thinks the DOM looks like because `write()` mutates
  // `regionEl.textContent` directly (outside Lit's template bindings) --
  // see `write()` for why.
  private lastWritten = '';
  private regionEl?: HTMLElement;
  private reannounceHandle?: ReturnType<typeof requestAnimationFrame>;
  // A flush can land before `firstUpdated()` has ever run -- e.g. a
  // consumer that creates+appends the element and calls `announce()`
  // synchronously right after, mirroring how `toaster.ts` mounts a region
  // and uses it immediately (see the class doc's singleton-mounting note).
  // The very next `firstUpdated()` applies whatever text was last buffered
  // here instead of silently dropping it.
  private pendingWrite?: string;

  constructor() {
    super();
    // Built in the constructor (not a class-field initializer) so it reads
    // `this.throttleMs` only after that property's own field initializer
    // has already run and set the declared default.
    this.announcer = new Announcer({
      throttleMs: this.throttleMs,
      onFlush: (text) => this.write(text),
    });
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('throttleMs')) {
      this.announcer.throttleMs = this.throttleMs;
    }
  }

  firstUpdated(): void {
    this.regionEl = this.renderRoot.querySelector<HTMLElement>('[part="region"]') ?? undefined;
    if (this.pendingWrite !== undefined) {
      const text = this.pendingWrite;
      this.pendingWrite = undefined;
      this.write(text);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.announcer.cancel();
    if (this.reannounceHandle !== undefined) {
      cancelAnimationFrame(this.reannounceHandle);
      this.reannounceHandle = undefined;
    }
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
    const region = this.regionEl;
    if (!region) {
      this.pendingWrite = text;
      return;
    }
    if (text === this.lastWritten) {
      // Screen readers announce a live region on text-content *change* --
      // re-writing the identical string is otherwise a silent no-op to
      // assistive tech. Clearing first and re-setting on the next frame
      // (rather than in the same task) gives the DOM an actual empty ->
      // populated transition to observe instead of a same-tick clear+set
      // that can coalesce into nothing ever appearing to change.
      region.textContent = '';
      this.reannounceHandle = requestAnimationFrame(() => {
        this.reannounceHandle = undefined;
        region.textContent = text;
      });
    } else {
      region.textContent = text;
    }
    this.lastWritten = text;
  }

  render(): TemplateResult {
    const assertive = this.mode === 'assertive';
    return html`<div
      part="region"
      class="sr-only"
      role=${assertive ? 'alert' : 'status'}
      aria-live=${assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    ></div>`;
  }
}

defineElement('live-region', LyraLiveRegion);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-live-region': LyraLiveRegion;
  }
}
