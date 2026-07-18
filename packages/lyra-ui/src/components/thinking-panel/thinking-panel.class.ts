import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon } from '../../internal/icons.js';
import { finiteRange } from '../../internal/numbers.js';
import { styles } from './thinking-panel.styles.js';

export type ThinkingPanelMode = 'live' | 'post-hoc';

export interface ThinkingPanelToggleDetail {
  expanded: boolean;
}

export interface LyraThinkingPanelEventMap {
  'lyra-toggle': CustomEvent<ThinkingPanelToggleDetail>;
}

/** "Close enough to the body's own max scroll position to count as anchored
 *  there" -- comfortably larger than one line of streamed text, so a user
 *  who has barely nudged the scrollbar while reading the latest line isn't
 *  mistaken for having deliberately scrolled away to read earlier content. */
const NEAR_BOTTOM_PX = 48;

/** `820` -> `"820ms"`; `1500` -> `"1.5s"`; `2000` -> `"2s"`. Identical
 *  algorithm to lyra-tool-call-chip's and lyra-tool-result-dialog's own
 *  `formatDuration` -- duplicated rather than imported (three independent,
 *  separately-consumable components) but kept in lockstep so the same
 *  elapsed time reads identically everywhere it's shown in this library. */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) {
    return `${Math.round(Math.max(0, ms))}ms`;
  }
  const seconds = ms / 1000;
  const rounded = Math.round(seconds * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
}

/**
 * `<lyra-thinking-panel>` — a collapsible panel for an AI agent's
 * intermediate reasoning/"thinking" transcript, kept visually and
 * semantically distinct from its final response. Same collapsible
 * header-button-plus-region shape as `<lyra-source-list>`; the default slot
 * is entirely free-form (a consumer-composed `<lyra-streaming-text>`,
 * `<lyra-markdown>`, or plain text) — this component has no dependency on
 * either and imposes no structure on what's slotted.
 *
 * `mode` (`'live'` while reasoning is actively streaming in, `'post-hoc'`
 * once it's complete and being reviewed after the fact) drives two concrete
 * behavior differences, not just a styling hook:
 * - **Header hint.** While `duration-ms` is unset, `'live'` shows a pulsing
 *   "Thinking…" placeholder in `[part="duration"]`; `'post-hoc'` shows
 *   nothing there instead (a finished review with no known duration has
 *   nothing useful to say in that slot). Once `duration-ms` is set, both
 *   modes show the same static `"Thought for …"` text — a `'post-hoc'`
 *   consumer that captured a duration is free to supply it too.
 * - **Auto-scroll.** Only `'live'` mode auto-follows new content appended to
 *   the default slot while `expanded` (see below); `'post-hoc'` never
 *   scrolls on its own, since reviewing finished reasoning is expected to
 *   start from the top like reading any other completed document. This
 *   library otherwise defaults to *not* editorializing about a host's data
 *   (see `<lyra-empty>`'s plain-`description` stance), but scroll position
 *   is presentation, not data, so this one behavior difference earns its
 *   keep rather than being left as a bare visual/semantic hint the host
 *   would have to reimplement identically itself.
 *
 * Live-mode auto-scroll ("stick to bottom") is the classic chat-transcript
 * convention: while `mode="live"` and `expanded`, new content keeps the
 * panel scrolled to its latest line — *unless* the user has manually
 * scrolled up to (re-)read earlier content, in which case their position is
 * never yanked away from them. This is tracked continuously via a `scroll`
 * listener on `[part="body"]` (not recomputed from the mutation itself,
 * which necessarily observes the DOM only *after* it has already changed):
 * every user-driven scroll records whether the body was left within
 * `NEAR_BOTTOM_PX` of its own max scroll position, and only a mutation that
 * arrives while that's still true triggers a follow-up scroll-to-bottom.
 * Opening an already-`'live'` panel (or one that later becomes `'live'`)
 * always resets this to "anchored" and jumps to the latest content, the same
 * way a chat app's own transcript does when you re-open it.
 *
 * New content is detected via a `MutationObserver` on this element's own
 * light DOM (`childList`+`subtree`+`characterData`) rather than the default
 * slot's `slotchange` event, because `slotchange` only fires when the set of
 * top-level assigned nodes changes — never for a text node mutating *inside*
 * an already-slotted element, which is the more likely shape for streamed
 * reasoning (a consumer appending chunks to an existing node's `textContent`
 * rather than re-slotting a whole new element per token). The one thing this
 * can't see is a mutation entirely inside a slotted custom element's own
 * shadow root (e.g. a `<lyra-markdown>` re-rendering its shadow tree after a
 * `content` property change) — Shadow DOM encapsulation blocks that by
 * design, and there is no way for this component to reach across that
 * boundary. A slotted element whose *own* internal updates should drive this
 * panel's auto-scroll needs to append/mutate visible light-DOM text itself
 * (as `<lyra-streaming-text>` is expected to), or the host can call this
 * panel's own `scrollToBottom()` directly.
 *
 * `aria-controls` linking the header to the body region uses `nextId()`
 * (`../../internal/a11y.js`) for a collision-safe id, the same convention
 * `<lyra-source-list>` and `<lyra-widget>` already establish for every
 * toggle-controls-region pairing in this library.
 *
 * @customElement lyra-thinking-panel
 * @slot - The reasoning/thinking content.
 * @event lyra-toggle - The header was activated, expanding or collapsing the
 * panel. `detail: { expanded }` — same event name and shape as
 * `<lyra-source-list>`'s own `lyra-toggle`.
 * @csspart base - The outer container.
 * @csspart header - The clickable header (`<button>`) toggling `expanded`.
 * @csspart label - The `label` text.
 * @csspart duration - The formatted duration / "Thinking…" placeholder, when shown.
 * @csspart toggle - The chevron indicator inside the header.
 * @csspart body - The wrapper around the default slot, `hidden` while
 * collapsed. Independently keyboard-focusable (`tabindex="0"`, `role="group"`
 * named from `label`) since it's its own capped-height scrollable region.
 */
export class LyraThinkingPanel extends LyraElement<LyraThinkingPanelEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Header text. Localized (`thinkingPanelLabel`) when left at its default
   *  `'Thinking'`; any other value is shown as-is. */
  @property() label = 'Thinking';

  /** Whether the reasoning transcript is currently shown. Starts collapsed,
   *  matching `<lyra-source-list>`'s default -- a consumer running `'live'`
   *  reasoning sets this `true` itself to stream it in view as it arrives. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** `'live'` while reasoning is actively streaming in right now; `'post-hoc'`
   *  once it's complete and being reviewed after the fact. See the class doc
   *  for the concrete behavior differences this drives. */
  @property({ reflect: true }) mode: ThinkingPanelMode = 'live';

  /** How long the reasoning took, in milliseconds, once known. Omitted
   *  entirely (nothing rendered in `'post-hoc'`, a pulsing placeholder in
   *  `'live'`) while unset. */
  @property({ type: Number, attribute: 'duration-ms' }) durationMs?: number;

  private readonly bodyId = nextId('thinking-panel-body');

  private contentObserver?: MutationObserver;
  private scrollRafId?: number;

  // Whether the body was left within NEAR_BOTTOM_PX of its own max scroll
  // position the last time a real (user-driven) scroll was recorded -- see
  // onScroll(). Starts `true` so a panel that mounts already `expanded` and
  // `mode="live"` follows its very first streamed content by default,
  // before any scroll event has ever fired.
  private stickToBottom = true;

  connectedCallback(): void {
    super.connectedCallback();
    // Watches this element's own light-DOM subtree, not the shadow-DOM
    // [part="body"] wrapper -- the slotted reasoning content actually lives
    // here, as this element's children. See the class doc for why this
    // (rather than `slotchange`) is what detects streamed-in content.
    this.contentObserver = new MutationObserver(this.onContentMutated);
    this.contentObserver.observe(this, { childList: true, subtree: true, characterData: true });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    if (this.scrollRafId !== undefined) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = undefined;
    }
  }

  protected updated(changed: PropertyValues): void {
    if ((changed.has('expanded') || changed.has('mode')) && this.expanded && this.mode === 'live') {
      // Opening a live panel -- or a still-expanded panel later becoming
      // `'live'` -- always jumps straight to the newest content and resets
      // the sticky-bottom flag, so it starts following again regardless of
      // wherever the body happened to be scrolled beforehand. `'post-hoc'`
      // deliberately skips this -- see the class doc's Auto-scroll section.
      this.stickToBottom = true;
      this.scrollToBottom();
    }
  }

  /** Scrolls the body to its current bottom immediately (no smooth-scroll
   *  animation, deliberately -- see onContentMutated()'s rAF-coalescing
   *  comment for why an instant jump reads better than a stack of competing
   *  smooth scrolls under a fast token stream). Safe to call directly, e.g.
   *  from a host that wants to force a jump-to-latest action of its own. */
  scrollToBottom(): void {
    const body = this.renderRoot.querySelector('[part="body"]') as HTMLElement | null;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }

  private onScroll = (e: Event): void => {
    const body = e.currentTarget as HTMLElement;
    this.stickToBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= NEAR_BOTTOM_PX;
  };

  private onContentMutated = (): void => {
    if (this.mode !== 'live' || !this.expanded || !this.stickToBottom) return;
    // Coalesce to at most one scroll-to-bottom per animation frame -- a fast
    // token stream can otherwise fire many mutation records in quick
    // succession, each individually cheap to react to but wasteful (and
    // visually janky) to lay out for separately.
    if (this.scrollRafId !== undefined) return;
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = undefined;
      // Re-check the same guard here, not just in the caller: mode/expanded/
      // stickToBottom can all change in the ~1-frame window between this
      // mutation being observed and this callback actually firing (e.g. the
      // reader scrolling away mid-frame), and this is the only place that
      // reflects state as of the moment the scroll would actually happen.
      if (this.mode === 'live' && this.expanded && this.stickToBottom) this.scrollToBottom();
    });
  };

  private toggle = (): void => {
    this.expanded = !this.expanded;
    this.emit<ThinkingPanelToggleDetail>('lyra-toggle', { expanded: this.expanded });
  };

  /** `durationMs` normalized to a finite, non-negative value, or `null` -- `null`/`undefined`
   *  and a non-finite raw value (e.g. a stray `NaN` assignment) both mean "no duration known yet,"
   *  matching this property's own "omitted entirely while unset" contract, rather than rendering
   *  a literal "NaN ms". A finite negative value clamps to `0` instead of rendering a nonsensical
   *  negative duration. */
  private get safeDurationMs(): number | null {
    return this.durationMs != null && Number.isFinite(this.durationMs) ? finiteRange(this.durationMs, 0, 0) : null;
  }

  private get durationDisplay(): { text: string; pending: boolean } | null {
    const durationMs = this.safeDurationMs;
    if (durationMs != null) {
      return {
        text: this.localize('thoughtFor', undefined, { duration: formatDuration(durationMs) }),
        pending: false,
      };
    }
    return this.mode === 'live' ? { text: this.localize('thinking'), pending: true } : null;
  }

  // `[part="body"]` is `tabindex="0"` because it's a capped-height,
  // independently-scrollable region -- with no other focusable content of
  // its own (e.g. plain text, or a non-interactive `<lyra-streaming-text>`),
  // it would otherwise be unreachable by keyboard, same reasoning
  // code-block.ts's and virtual-list.ts's own identical `[part="body"]`/
  // `[part="base"]` tabindex document. `role="group"` (rather than a page
  // landmark role) plus `aria-label` gives it an accessible name without
  // claiming navigation significance for what is, structurally, just one
  // part of a larger message.
  render(): TemplateResult {
    const duration = this.durationDisplay;
    // `this.localize()` checks `.strings` overrides before any fallback, so
    // passing `this.label` as a fallback wouldn't stop a `.strings.thinkingPanelLabel`
    // override from winning over an explicitly-customized `label` -- bypass
    // localize() entirely once `label` has been changed from its built-in default.
    const label = this.label === 'Thinking' ? this.localize('thinkingPanelLabel') : this.label;

    return html`
      <div part="base">
        <button
          part="header"
          type="button"
          aria-expanded=${this.expanded ? 'true' : 'false'}
          aria-controls=${this.bodyId}
          @click=${this.toggle}
        >
          <span part="toggle" aria-hidden="true">${chevronIcon()}</span>
          <span part="label">${label}</span>
          ${duration
            ? html`<span part="duration" ?data-pending=${duration.pending}
                >${duration.pending ? html`<span class="pending-dot" aria-hidden="true"></span>` : nothing}${duration.text}</span
              >`
            : nothing}
        </button>
        <div
          part="body"
          id=${this.bodyId}
          role="group"
          aria-label=${label}
          tabindex="0"
          ?hidden=${!this.expanded}
          @scroll=${this.onScroll}
        >
          <slot></slot>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-thinking-panel': LyraThinkingPanel;
  }
}

