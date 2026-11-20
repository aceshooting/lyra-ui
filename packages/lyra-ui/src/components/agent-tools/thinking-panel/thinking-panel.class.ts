import { FollowTailController } from '../../../internal/follow-tail-controller.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
import type { LyraTranscriptMode } from '../../../internal/shared-unions.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { formatShortDuration, safeDurationMs } from '../../../internal/duration.js';
import { literalSetConverter, trueDefaultBooleanConverter, blankNumberConverter } from '../../../internal/converters.js';
import { OwnedMutationObserver } from '../../../internal/owned-observer.js';
import { repairComposedFocus } from '../../../internal/focus-navigation.js';
import { trackScrollRegions } from '../../../internal/scroll-region.js';
import { styles } from './thinking-panel.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_thoughtFor } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_thinking, LYRA_DEFAULT_thinkingPanelLabel } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Whether the panel is streaming a run live or replaying a finished one -- the library's shared
 *  transcript-mode vocabulary, identical to `<lr-activity-feed>`'s `ActivityFeedMode`. */
export type ThinkingPanelMode = LyraTranscriptMode;

const THINKING_PANEL_MODE = literalSetConverter<ThinkingPanelMode>(
  ['live', 'post-hoc'],
  'live',
);

/** Visual chrome for `<lr-thinking-panel>`'s root — the library's shared container-frame vocabulary. */
export type ThinkingPanelAppearance = LyraFrame;

export interface ThinkingPanelToggleDetail {
  expanded: boolean;
}

export interface LyraThinkingPanelEventMap {
  'lr-toggle-request': CustomEvent<ThinkingPanelToggleDetail>;
  'lr-toggle': CustomEvent<ThinkingPanelToggleDetail>;
  'lr-follow-change': CustomEvent<{ following: boolean }>;
}


/**
 * `<lr-thinking-panel>` — a collapsible panel for an AI agent's
 * intermediate reasoning/"thinking" transcript, kept visually and
 * semantically distinct from its final response. Same collapsible
 * header-button-plus-region shape as `<lr-source-list>`; the default slot
 * is entirely free-form (a consumer-composed `<lr-streaming-text>`,
 * `<lr-markdown>`, or plain text) — this component has no dependency on
 * either and imposes no structure on what's slotted.
 *
 * `size="s"` tightens the header and transcript-body padding for dense
 * transcript rows. `frame="plain"` removes the outside card chrome when a
 * containing message or panel already supplies it; the header/body divider
 * and their layout remain, so the disclosure keeps its internal structure.
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
 *   (see `<lr-empty>`'s plain-`description` stance), but scroll position
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
 * every user-driven scroll updates the public `follow` state to record whether the body was left within
 * 48 CSS pixels of its own max scroll position, and only a mutation that
 * arrives while that's still true triggers a follow-up scroll-to-bottom.
 * Opening an already-`'live'` panel (or one that later becomes `'live'`)
 * always resets this to "anchored" and jumps to the latest content, the same
 * way a chat app's own transcript does when you re-open it.
 *
 * New content is detected two ways, both feeding the same coalesced scroll-to-bottom (a mutation
 * and a settle event landing in the same animation frame never double-scroll):
 * - A `MutationObserver` on this element's own light DOM (`childList`+`subtree`+`characterData`)
 *   rather than the default slot's `slotchange` event, because `slotchange` only fires when the
 *   set of top-level assigned nodes changes — never for a text node mutating *inside* an
 *   already-slotted element, which is the shape a consumer literally appending chunks to a plain
 *   light-DOM node produces. This cannot see a mutation entirely inside a slotted custom
 *   element's own shadow root (e.g. `<lr-markdown>` re-rendering its shadow tree after a
 *   `content` property change) — Shadow DOM encapsulation blocks that by design.
 * - A listener for `lr-content-settled`, a composed, bubbling, signal-only event
 *   (`detail: null`) this library's own streaming renderers — `<lr-streaming-text>`,
 *   `<lr-markdown>`, `<lr-markdown-core>` — emit at their own settle points. Being composed, it
 *   crosses exactly the shadow boundary the `MutationObserver` above cannot, covering every
 *   property- or attribute-driven producer that renders into its own shadow root instead of
 *   mutating visible light-DOM text.
 *
 * A slotted element that is neither a plain light-DOM text producer nor one of this library's own
 * streaming renderers — a bespoke custom element that re-renders its own shadow tree from a
 * property change — needs to append/mutate visible light-DOM text itself, emit its own
 * `lr-content-settled`, or have the host call this panel's own `scrollToBottom()` directly.
 *
 * `aria-controls` linking the header to the body region uses `nextId()`
 * (`../../internal/a11y.js`) for a collision-safe id, the same convention
 * `<lr-source-list>` and `<lr-widget>` already establish for every
 * toggle-controls-region pairing in this library.
 *
 * @customElement lr-thinking-panel
 * @slot - The reasoning/thinking content.
 * @event lr-toggle-request - Cancelable proposal emitted before a header activation changes
 *   `expanded`. `detail: { expanded }` carries the requested next state.
 * @event lr-toggle - The accepted header request committed. `detail: { expanded }` carries the
 *   new state and is never emitted for a vetoed proposal.
 * @event lr-follow-change - `detail: { following }`; emitted only when a user scroll releases or
 *   re-engages tail following. Direct `follow` assignment and `scrollToBottom()` do not echo it.
 * @csspart base - The outer container.
 * @csspart header - The clickable header (`<button>`) toggling `expanded`.
 * @csspart label - The `label` text.
 * @csspart duration - The formatted duration / "Thinking…" placeholder, when shown.
 * @csspart toggle - The chevron indicator inside the header.
 * @csspart body - The wrapper around the default slot, `hidden` while
 * collapsed; a `role="group"` named from `label`. While its content overflows the capped height
 * it is its own tab stop (`tabindex="0"`) so a keyboard user can scroll it; a short body adds none.
 * @cssprop [--lr-thinking-panel-max-block-size=var(--lr-size-16rem)] - Cap on how tall the
 *   expanded reasoning transcript grows before `[part="body"]` scrolls internally.
 * @cssprop [--lr-thinking-panel-pending-color=var(--lr-color-brand)] - Live pending-state color.
 * @cssprop [--lr-thinking-panel-compact-header-padding=var(--lr-space-2xs) var(--lr-space-s)] -
 *   `[part="header"]` padding while `size` is `s` or smaller.
 * @cssprop [--lr-thinking-panel-compact-header-gap=var(--lr-space-2xs)] - Gap between the header
 *   toggle, label, and duration while `size` is `s` or smaller.
 * @cssprop [--lr-thinking-panel-compact-header-font-size=var(--lr-font-size-sm)] - Font size of
 *   `[part="header"]` while `size` is `s` or smaller.
 * @cssprop [--lr-thinking-panel-compact-body-padding=var(--lr-space-s)] - `[part="body"]` padding
 *   while `size` is `s` or smaller.
 * @cssprop [--lr-thinking-panel-compact-body-font-size=var(--lr-font-size-sm)] - Font size of
 *   `[part="body"]` while `size` is `s` or smaller.
 * @cssprop [--lr-thinking-panel-bg=var(--lr-color-surface)] - Fill of the outer card
 *   (`[part="base"]`) while `frame="card"`. `frame="plain"` still removes the fill entirely.
 * @cssprop [--lr-thinking-panel-border-color=var(--lr-color-border)] - Colour of the outer card's
 *   border and of the header/body divider, which `frame="plain"` keeps.
 * @cssprop [--lr-thinking-panel-radius=var(--lr-radius)] - Corner radius of the outer card.
 *   `frame="plain"` still squares the corners.
 * @cssprop [--lr-thinking-panel-body-hover-outline-width=var(--lr-focus-ring-width)] - Outline
 *   width of the mouse-hover preview on `[part="body"]`.
 * @cssprop [--lr-thinking-panel-body-hover-outline-style=solid] - Outline style of the
 *   mouse-hover preview on `[part="body"]`.
 * @cssprop [--lr-thinking-panel-body-hover-outline-color=var(--lr-color-border)] - Outline color
 *   of the mouse-hover preview on `[part="body"]`. Set to `transparent` to opt out of the hover
 *   treatment entirely.
 * @cssprop [--lr-thinking-panel-body-hover-outline-offset=calc(-1 * var(--lr-focus-ring-offset))] -
 *   Inward offset of the mouse-hover preview on `[part="body"]`, keeping the outline inside its
 *   own scrollport so it is not clipped at the edge.
 * @cssprop [--lr-thinking-panel-header-hover-bg=var(--lr-color-brand-quiet)] - Hover background of `[part="header"]`.
 * @cssprop --lr-thinking-panel-header-pressed-bg - Pressed background of the header. Defaults to the hover background mixed by the press step.
 * @status stable
 * @since 4.0.0
 */
export class LyraThinkingPanel extends LyraElement<LyraThinkingPanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    thinking: LYRA_DEFAULT_thinking,
    thinkingPanelLabel: LYRA_DEFAULT_thinkingPanelLabel,
    thoughtFor: LYRA_DEFAULT_thoughtFor,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Optional header-text override. Omission localizes `thinkingPanelLabel`; any supplied string,
   *  including `'Thinking'` or `''`, is rendered verbatim. */
  @property() label?: string;

  /**
   * Density on the shared size scale. `s` (and the smaller `xs`/`2xs`) tightens the header/body
   * padding, header gap, and header/body font size for dense transcript contexts; `m` (the default)
   * and larger keep the regular density. This changes density only; the outer border and surface
   * remain, so use `frame="plain"` to remove card chrome.
   */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled outer container. `'plain'` removes that outer border, background,
   *  and corner radius so a thinking panel nested inside existing message chrome does not double
   *  it. Plain preserves the header/body divider and whichever regular or dense padding applies. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** Whether the reasoning transcript is currently shown. Starts collapsed,
   *  matching `<lr-source-list>`'s default -- a consumer running `'live'`
   *  reasoning sets this `true` itself to stream it in view as it arrives. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  private _mode: ThinkingPanelMode = 'live';

  /** `'live'` while reasoning is actively streaming in right now; `'post-hoc'`
   *  once it's complete and being reviewed after the fact. See the class doc
   *  for the concrete behavior differences this drives. */
  @property({ reflect: true, converter: THINKING_PANEL_MODE })
  get mode(): ThinkingPanelMode {
    return this._mode;
  }
  set mode(next: ThinkingPanelMode) {
    const normalized = THINKING_PANEL_MODE.normalizeReflected(this, 'mode', next);
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
  }

  /** Whether live, expanded content follows the transcript tail. User scrolling updates this
   *  property and emits `lr-follow-change`; direct assignments are controlled input and do not
   *  echo an event. Opening a live panel or calling `scrollToBottom()` re-engages it silently. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;

  /** How long the reasoning took, in milliseconds, once known. Omitted
   *  entirely (nothing rendered in `'post-hoc'`, a pulsing placeholder in
   *  `'live'`) while unset. */
  // numeric-guard-exempt: safeDurationMs() in internal/duration.ts rejects non-finite values and clamps negatives.
  @property({ converter: blankNumberConverter(undefined), attribute: 'duration-ms' }) durationMs?: number;

  private readonly bodyId = nextId('thinking-panel-body');

  private readonly contentObserver = new OwnedMutationObserver(this, () => this.onContentMutated());
  private readonly tail = new FollowTailController(this, {
    scroller: () => this.shadowRoot?.querySelector<HTMLElement>('[part="body"]') ?? null,
    shouldFollow: () => this.mode === 'live' && this.expanded && this.follow,
  });
  private realmGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncContentObserver();
    this.addEventListener('lr-content-settled', this.onContentMutated);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('lr-content-settled', this.onContentMutated);
    this.resetOwnerRealmWork();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Do not re-arm while detached. The next connectedCallback binds all work to the new owner.
    this.resetOwnerRealmWork();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.get('expanded') === true && !this.expanded) {
      const body = this.renderRoot.querySelector('[part="body"]');
      if (body) repairComposedFocus(body, () => [
        this.renderRoot.querySelector<HTMLElement>('[part="header"]'),
      ]);
    }
    if ((changed.has('expanded') || changed.has('mode')) && this.expanded && this.mode === 'live') {
      // Re-engagement is part of the update being prepared. Doing it here keeps the reflected
      // property and the rendered scroll behavior in one update instead of scheduling a second
      // reactive update from updated().
      this.follow = true;
    }
  }

  private syncContentObserver(): void {
    if (this.expanded && this.mode === 'live' && this.follow) {
      if (!this.contentObserver.active) this.contentObserver.observe(this, { childList: true, subtree: true, characterData: true });
    } else {
      this.contentObserver.clear();
    }
  }

  private resetOwnerRealmWork(): void {
    this.realmGeneration += 1;
    this.contentObserver.clear();
    this.tail.cancel();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('expanded') || changed.has('mode') || changed.has('follow')) this.syncContentObserver();
    if ((changed.has('expanded') || changed.has('mode')) && this.expanded && this.mode === 'live') {
      // Opening a live panel -- or a still-expanded panel later becoming
      // `'live'` -- always jumps straight to the newest content and resets
      // the sticky-bottom flag, so it starts following again regardless of
      // wherever the body happened to be scrolled beforehand. `'post-hoc'`
      // deliberately skips this -- see the class doc's Auto-scroll section.
      this.scrollToBottom();
    }
  }

  /** Scrolls the body to its current bottom immediately (no smooth-scroll
   *  animation, deliberately -- see onContentMutated()'s rAF-coalescing
   *  comment for why an instant jump reads better than a stack of competing
   *  smooth scrolls under a fast token stream). Safe to call directly, e.g.
   *  from a host that wants to force a jump-to-latest action of its own. */
  scrollToBottom(): void {
    this.follow = true;
    this.tail.scrollToTail();
  }

  private onScroll = (): void => {
    const following = this.tail.atTail;
    if (following === this.follow) return;
    this.follow = following;
    this.emit('lr-follow-change', { following });
  };

  private onContentMutated = (): void => {
    if (this.mode !== 'live' || !this.expanded || !this.follow) return;
    this.tail.scheduleScrollToTail();
  };

  private toggle = (): void => {
    if (!this.isConnected) return;
    const expanded = !this.expanded;
    const generation = this.realmGeneration;
    if (this.emit('lr-toggle-request', { expanded }, { cancelable: true }).defaultPrevented) return;
    if (this.realmGeneration !== generation || this.expanded === expanded) return;
    this.expanded = expanded;
    this.emit('lr-toggle', { expanded: this.expanded });
  };

  /** `durationMs` normalized to a finite, non-negative value, or `null` -- `null`/`undefined`
   *  and a non-finite raw value (e.g. a stray `NaN` assignment) both mean "no duration known yet,"
   *  matching this property's own "omitted entirely while unset" contract, rather than rendering
   *  a literal "NaN ms". A finite negative value clamps to `0` instead of rendering a nonsensical
   *  negative duration. */
  private get safeDurationMs(): number | null {
    return safeDurationMs(this.durationMs);
  }

  private get durationDisplay(): { text: string; pending: boolean } | null {
    const durationMs = this.safeDurationMs;
    if (durationMs != null) {
      return {
        text: this.localize('thoughtFor', undefined, {
          duration: formatShortDuration(this.localize.bind(this), this.effectiveLocale, durationMs),
        }),
        pending: false,
      };
    }
    return this.mode === 'live' ? { text: this.localize('thinking'), pending: true } : null;
  }

  // `[part="body"]` is a capped-height, independently-scrollable region. With no other focusable
  // content of its own (plain text, or a non-interactive `<lr-streaming-text>`) an overflowing
  // transcript would be unreachable by keyboard, so it takes `tabindex="0"` while -- and only
  // while -- it overflows. `role="group"` (rather than a page landmark role) plus `aria-label`
  // gives it an accessible name without claiming navigation significance for what is,
  // structurally, just one part of a larger message, so the region keeps that role.
  constructor() {
    super();
    trackScrollRegions(this, () => {
      const el = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
      return [el && { el, role: false }];
    });
  }

  override render(): TemplateResult {
    const duration = this.durationDisplay;
    // Explicit property overrides outrank catalogs, including when they equal the built-in English
    // text or are empty; only omission enters localization.
    const label = this.label == null ? this.localize('thinkingPanelLabel') : this.label;

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
          aria-label=${hostAriaLabel(this) ?? label}
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
    'lr-thinking-panel': LyraThinkingPanel;
  }
}
