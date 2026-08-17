import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { LyraVirtualList, type LyraVirtualListRange } from '../../layout/virtual-list/virtual-list.class.js';
import { styles } from './chat-viewport.styles.js';
import { getNumberFormat, getPluralRules } from '../../../internal/intl-cache.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  composedAccessibilityText,
} from '../../../internal/accessibility-visibility.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chatViewportLabel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_jumpToLatest, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_newMessageCount, LYRA_DEFAULT_newMessages, LYRA_DEFAULT_newMessagesCount, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ChatViewportLive = 'off' | 'polite' | 'assertive';

export interface LyraChatViewportEventMap {
  'lr-follow-change': CustomEvent<{ following: boolean }>;
}

interface OwnedAnimationFrame {
  owner: Window;
  handle: number;
}

/**
 * `<lr-chat-viewport>` — the transcript scroll container: owns stick-to-bottom behavior while an
 * answer streams, the "jump to latest" pill, and the unread divider.
 *
 * **Two supported content shapes, auto-detected:** ordinary element children (typically
 * `<lr-chat-message>`s -- *slotted mode*), or exactly one `<lr-virtual-list>` (*virtual mode*,
 * detected via `instanceof` against the imported class so custom prefixes keep working). In virtual
 * mode this component defers all scrolling to the slotted list's own `scrollToIndex()`, and sizes
 * that list to its own height -- without which the list would scroll inside `lr-virtual-list`'s
 * 24rem `--lr-virtual-list-height` default no matter how tall this viewport is. That sizing is a
 * percentage, so virtual mode needs a height-bounded parent, the same requirement slotted mode's
 * own scroll container already has; a consumer's own rule or inline style setting
 * `--lr-virtual-list-height` on the list still wins.
 *
 * **Follow/release state machine.** While `follow` is engaged, content growth re-scrolls to the end.
 * Release happens only on a *user-intent* gesture (wheel, touchmove, scrollbar-drag, or
 * PageUp/ArrowUp/Home while the log region has focus) that leaves the view more than
 * `bottomThreshold` from the end -- a scroll caused by this component's own programmatic scrolling,
 * or by a layout shift, never releases it. Reaching the bottom again by any means re-engages `follow`.
 * The internal log defaults to `live="off"`, which avoids announcing every streaming token. Consumers
 * that append complete messages at an announcement-safe cadence can opt into `polite` or `assertive`;
 * each newly appended direct child's accessibility-exposed text is then announced through the
 * document's shared light-DOM sink. Hidden, inert, `aria-hidden`, and CSS-hidden content is omitted.
 * Existing declarative children stay silent on mount, and appending the same text again creates a
 * new announcement. The shadow log itself always remains `aria-live="off"`.
 *
 * **`scrollToUnread()` in virtual mode.** The target row is scrolled with `align: 'start'` so the
 * divider boundary lands at the top of the view with the unread content visible below it -- the
 * only alignment that matches what "scroll to the divider" means here. The underlying virtual list
 * only issues a corrective re-scroll for an initially-unmeasured target when that target's *own*
 * height is what was uncertain (`align: 'end'`/a downward `align: 'auto'`); a `'start'`-aligned
 * target's position is a function of the rows *before* it, so it has no such self-correction. In
 * practice the rows leading up to an unread boundary are usually ones the reader already scrolled
 * past (and so already measured), which keeps this accurate in the common case; a still-unmeasured
 * long-distance jump can land approximately rather than pixel-exact. Fixing that fully would mean
 * changing how the underlying list resolves offsets, which is out of scope here -- `align: 'end'`
 * was considered and rejected because it changes the visible outcome (it would put the *bottom* of
 * the boundary row at the viewport's bottom edge, hiding the unread content the jump is meant to
 * reveal, not just changing how precisely it lands).
 *
 * Renders no messages and computes no unread state itself -- the host supplies `unreadStartIndex`;
 * no virtualization of its own (`<lr-virtual-list>`); not a generic overflow surface
 * (`<lr-scroller>`); no message semantics (`<lr-chat-message>`).
 *
 * @customElement lr-chat-viewport
 * @slot - The transcript: ordinary element children, or exactly one `<lr-virtual-list>`.
 * @event lr-follow-change - `detail: { following }` -- fired whenever `follow` flips (user
 *   scroll-up release, or reaching the bottom again). Never fired for the initial mount state.
 * @csspart base - The positioning root.
 * @csspart scroll - The scroll container (`role="log"` and, in slotted mode, `tabindex="0"`). In
 *   virtual mode it stops scrolling itself and drops its tab stop because the slotted list owns
 *   both scrolling and keyboard focus.
 * @csspart content - The slotted-content wrapper the growth observers watch.
 * @csspart jump-pill - The built-in jump-to-latest button, absent while `follow` is engaged.
 * @csspart unread-divider - The "New messages" separator (slotted mode only).
 * @status stable
 * @since 4.0.0
 */
export class LyraChatViewport extends LyraElement<LyraChatViewportEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chatViewportLabel: LYRA_DEFAULT_chatViewportLabel,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    jumpToLatest: LYRA_DEFAULT_jumpToLatest,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    newMessageCount: LYRA_DEFAULT_newMessageCount,
    newMessages: LYRA_DEFAULT_newMessages,
    newMessagesCount: LYRA_DEFAULT_newMessagesCount,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;

  /** Live-region policy for newly appended direct children. Keep `off` for token-by-token
   * streaming; use `polite` or `assertive` only when messages are appended at an announcement-safe
   * cadence. Only accessibility-exposed text is copied. The shadow `role="log"` remains non-live;
   * announcements use a shared light-DOM sink. */
  @property({ reflect: true }) live: ChatViewportLive = 'off';

  /** Px distance from the end still counted as "at bottom." */
  @property({ type: Number, attribute: 'bottom-threshold' }) bottomThreshold = 24;

  /** Index of the first unread item -- element-child index in slotted mode, `items` index in virtual
   *  mode. Host-owned unread bookkeeping in, divider/pill count out. `null` disables both. */
  @property({ type: Number, attribute: 'unread-start-index' }) unreadStartIndex: number | null = null;

  /** Accessible name for the log region. Defaults to the localized `chatViewportLabel`;
   *  a host `aria-label` (see `accessibleLabel`) wins over both. */
  @property() label = '';

  /** Host `aria-label`, forwarded to the internal `role="log"` element -- an `aria-label` left
   *  on the custom-element host itself names nothing, because the log role lives inside the
   *  shadow root. Wins over `label` and the localized default. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private unreadDividerTop: number | null = null;

  @query('[part="scroll"]') private scrollEl?: HTMLElement;
  @query('[part="content"]') private contentEl?: HTMLElement;
  @query('[part="content"] > slot') private contentSlot?: HTMLSlotElement;

  private pendingUserIntent = false;
  /** Owner-bound in-flight proactive expiry scheduled by `markUserIntent()` -- see that method and
   *  `cancelPendingUserIntentExpiry()`. */
  private pendingUserIntentExpiryFrame: OwnedAnimationFrame | null = null;
  private scrollbarDragActive = false;
  private scrollbarDragWindow?: Window;
  private isMounting = true;
  private pendingScrollBehavior?: 'auto' | 'smooth';
  private contentResizeObserver?: ResizeObserver;
  private contentMutationObserver?: MutationObserver;
  private announcementSink?: AnnouncementSink;
  private scrollResizeObserver?: ResizeObserver;
  private growthFrame: OwnedAnimationFrame | null = null;
  private listenedVirtualList?: LyraVirtualList;
  private observerWindow?: Window;
  /** Which shape `armObservers()` last actually built watchers for -- `null` after a teardown.
   *  Guards against rebuilding on a redundant `armObservers()` call (see its own comment). */
  private armedMode: 'virtual' | 'slotted' | null = null;
  /** Bumped on every real (non-skipped) `armObservers()` call and on teardown -- invalidates a
   *  still-pending deferred initial-measurement microtask from a now-stale arm. */
  private armGeneration = 0;
  private followFocusRepair: ComposedFocusRepairSnapshot | null = null;
  private readonly knownProjectedNodes = new WeakSet<Node>();
  private unreadBoundaryEl?: HTMLElement;

  private get messageElements(): HTMLElement[] {
    let elements = this.contentSlot?.assignedElements({ flatten: true }) ?? Array.from(this.children);
    // A composing shadow host can forward its own named slot as this
    // viewport's default content (agent-workspace does this). Native
    // `flatten:true` does not expand a slot that is itself an assigned node,
    // so expand those forwarding slots explicitly with a small depth cap.
    for (let depth = 0; depth < 4 && elements.some((element) => element.localName === 'slot'); depth++) {
      elements = elements.flatMap((element) =>
        element.localName === 'slot'
          ? (element as HTMLSlotElement).assignedElements({ flatten: true })
          : [element],
      );
    }
    return elements.filter(
      (element) => !element.hasAttribute('data-lr-chat-viewport-unread-boundary'),
    ) as HTMLElement[];
  }

  private get virtualListEl(): LyraVirtualList | null {
    const children = this.messageElements;
    return children.length === 1 && children[0] instanceof LyraVirtualList
      ? (children[0] as LyraVirtualList)
      : null;
  }

  /** `bottomThreshold` normalized to a finite, non-negative pixel distance -- a non-finite value
   *  would otherwise make the `distanceFromEnd <= bottomThreshold` comparison in `onScroll()`
   *  always false (a `NaN` comparison never succeeds), permanently preventing `follow` from
   *  re-engaging once released. */
  private get effectiveBottomThreshold(): number {
    return finiteRange(this.bottomThreshold, 24, 0);
  }

  /** `unreadStartIndex` normalized to a finite, non-negative integer -- `null` (the documented
   *  "disabled" sentinel) is passed through as-is, never coerced into a number. */
  private get effectiveUnreadStartIndex(): number | null {
    return this.unreadStartIndex == null ? null : finiteCount(this.unreadStartIndex);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    if (this.hasUpdated) this.armObservers();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
    this.teardownObservers();
    // Safety net for a drag still in progress (pointerdown fired, no matching pointerup/
    // pointercancel/lostpointercapture yet) when this element is disconnected -- without this the
    // window listeners `onPointerDown` added would leak for the lifetime of the page.
    this.releaseScrollbarDragListeners();
    // Safety net for a still-scheduled proactive user-intent expiry (see markUserIntent()).
    this.clearUserIntent();
    this.scrollbarDragActive = false;
    this.followFocusRepair = null;
    this.unreadBoundaryEl?.remove();
    this.unreadBoundaryEl = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!this.hasUpdated || !changed.has('follow') || !this.follow || changed.get('follow') !== false) {
      return;
    }
    const pill = this.renderRoot.querySelector<HTMLElement>('[part="jump-pill"]');
    this.followFocusRepair = pill
      ? captureComposedFocusRepair(pill, this.transcriptFocusOwner())
      : null;
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.armObservers();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('live')) this.syncAnnouncementSink();
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('follow')) {
      if (this.follow) {
        // The very first paint always lands at the end instantly -- there's no prior on-screen
        // position for an animated scroll to connect to, so animating it would just be motion for
        // its own sake (and, as a bonus, is more reliable than relying on a 'smooth' scroll's
        // variable-length animation to have actually finished by the time anything else inspects
        // scroll position). `pendingScrollBehavior`/reduced-motion only matter for a later, real
        // scroll (`scrollToBottom()` re-engaging a released `follow`), not this initial one.
        const behavior = wasMounting
          ? 'auto'
          : (this.pendingScrollBehavior ??
            (prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth'));
        this.pendingScrollBehavior = undefined;
        this.performScrollToEnd(behavior);
      }
      if (!wasMounting) {
        this.emit('lr-follow-change', { following: this.follow });
      }
    }
    // On the very first update, firstUpdated() -> armObservers() already computed this moments
    // earlier in the same synchronous pass; recomputing it again here would be redundant (and,
    // since @state property writes still schedule a follow-up update even when the recomputed
    // value doesn't actually change layout between those two calls, needlessly trips Lit's
    // "scheduled an update after an update completed" dev-mode notice).
    if (changed.has('unreadStartIndex') && !wasMounting) {
      this.updateUnreadDividerPosition();
    }
    const focusRepair = this.followFocusRepair;
    this.followFocusRepair = null;
    if (focusRepair) applyComposedFocusRepair(focusRepair);
  }

  private transcriptFocusOwner(): HTMLElement | null {
    const list = this.virtualListEl;
    if (!list) return this.scrollEl ?? null;
    return collectComposedFocusTargets(list, {
      includeRoot: false,
      mode: 'programmatic',
    }).elements[0] ?? null;
  }

  /** Scrolls to the end and re-engages `follow`. Default `smooth`, forced to `auto` under
   *  `prefers-reduced-motion`. */
  scrollToBottom(options?: { behavior?: 'auto' | 'smooth' }): void {
    const behavior = prefersReducedMotion(this.ownerDocument.defaultView)
      ? 'auto'
      : (options?.behavior ?? 'smooth');
    if (this.follow) {
      this.performScrollToEnd(behavior);
    } else {
      this.pendingScrollBehavior = behavior;
      this.follow = true;
    }
  }

  /** Scrolls the unread divider to the top of the view; `false` when `unreadStartIndex` is
   *  `null`/out of range. Does not re-engage `follow`. See the class doc for why virtual mode uses
   *  `align: 'start'` and what that trades off. */
  scrollToUnread(options?: { behavior?: 'auto' | 'smooth' }): boolean {
    const unreadStartIndex = this.effectiveUnreadStartIndex;
    if (unreadStartIndex == null) return false;
    const behavior = prefersReducedMotion(this.ownerDocument.defaultView)
      ? 'auto'
      : (options?.behavior ?? 'smooth');
    const list = this.virtualListEl;
    if (list) {
      if (unreadStartIndex >= list.items.length) return false;
      list.scrollToIndex(unreadStartIndex, { align: 'start', behavior });
      return true;
    }
    const scrollEl = this.scrollEl;
    if (!scrollEl || this.unreadDividerTop == null) return false;
    scrollEl.scrollTo({ top: this.unreadDividerTop, behavior });
    return true;
  }

  private performScrollToEnd(behavior: 'auto' | 'smooth'): void {
    const list = this.virtualListEl;
    if (list) {
      if (list.items.length > 0) list.scrollToIndex(list.items.length - 1, { align: 'end', behavior });
      return;
    }
    const el = this.scrollEl;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  private get totalCount(): number {
    const list = this.virtualListEl;
    return list ? list.items.length : this.messageElements.length;
  }

  private get unreadCount(): number {
    const unreadStartIndex = this.effectiveUnreadStartIndex;
    if (unreadStartIndex == null) return 0;
    return Math.max(0, this.totalCount - unreadStartIndex);
  }

  private pillLabel(): string {
    const count = this.unreadCount;
    if (count <= 0) return this.localize('jumpToLatest');
    const key =
      getPluralRules(this.effectiveLocale).select(count) === 'one' ? 'newMessageCount' : 'newMessagesCount';
    return this.localize(key, undefined, { count: getNumberFormat(this.effectiveLocale).format(count) });
  }

  private updateUnreadDividerPosition(): void {
    const unreadStartIndex = this.effectiveUnreadStartIndex;
    if (this.virtualListEl || unreadStartIndex == null) {
      this.unreadDividerTop = null;
      this.syncSemanticUnreadBoundary();
      return;
    }
    const content = this.contentEl;
    const children = this.messageElements;
    const target = children[unreadStartIndex];
    if (!target || !content) {
      this.unreadDividerTop = null;
      this.syncSemanticUnreadBoundary();
      return;
    }
    this.syncSemanticUnreadBoundary(target);
    // `offsetTop`/`offsetParent` don't cross the shadow boundary the way this needs: a slotted
    // (light-DOM) row's offsetParent search only walks its light-DOM ancestors, which stops at
    // this host element itself -- it never reaches the shadow-side [part="content"] this divider
    // is actually positioned against, so it can land pixels off depending on the host's own box.
    // A getBoundingClientRect() delta is well-defined regardless of that boundary and, since both
    // rects move together by the same amount when the scroll container scrolls, is unaffected by
    // the current scroll position.
    this.unreadDividerTop = target.getBoundingClientRect().top - content.getBoundingClientRect().top;
  }

  private syncSemanticUnreadBoundary(target?: HTMLElement): void {
    if (!target || this.virtualListEl) {
      this.unreadBoundaryEl?.remove();
      this.unreadBoundaryEl = undefined;
      return;
    }
    const parent = target.parentNode;
    if (!parent) return;
    const boundary = this.unreadBoundaryEl ?? this.ownerDocument.createElement('div');
    boundary.setAttribute('data-lr-chat-viewport-unread-boundary', '');
    boundary.setAttribute('role', 'separator');
    boundary.setAttribute('aria-label', this.localize('newMessages'));
    const targetSlot = target.getAttribute('slot');
    if (targetSlot === null) boundary.removeAttribute('slot');
    else boundary.setAttribute('slot', targetSlot);
    if (boundary.parentNode !== parent || boundary.nextSibling !== target) parent.insertBefore(boundary, target);
    this.unreadBoundaryEl = boundary;
    this.knownProjectedNodes.add(boundary);
  }

  private markUserIntent = (): void => {
    this.pendingUserIntent = true;
    this.cancelPendingUserIntentExpiry();
    // A gesture that actually produced a scroll is consumed by onScroll()/onVirtualRangeChanged()
    // well within two animation frames -- slotted mode's own [part="scroll"] fires 'scroll'
    // directly off the native scroll; virtual mode's longest chain is one requestAnimationFrame
    // (the slotted list's own scroll-coalescing) plus a Lit microtask update, both of which land
    // inside the *first* of these two frames with room to spare. A gesture that changed nothing
    // (e.g. wheel-down while already at the bottom, in virtual mode) never fires either handler,
    // so nothing else would ever clear the flag -- proactively dropping it here, rather than
    // waiting out a generous wall-clock timeout, closes the window during which an unrelated
    // event arriving soon after (e.g. the next streamed-token append, which can land far sooner
    // than any timeout long enough to be safe for a genuine gesture) would misattribute itself as
    // user-caused and release `follow`.
    const owner = this.ownerDocument.defaultView;
    if (!owner) {
      this.pendingUserIntent = false;
      return;
    }
    const firstFrame: OwnedAnimationFrame = { owner, handle: 0 };
    firstFrame.handle = owner.requestAnimationFrame(() => {
      if (this.pendingUserIntentExpiryFrame !== firstFrame) return;
      if (!this.isConnected || this.ownerDocument.defaultView !== owner) {
        this.pendingUserIntentExpiryFrame = null;
        this.pendingUserIntent = false;
        return;
      }
      const secondFrame: OwnedAnimationFrame = { owner, handle: 0 };
      secondFrame.handle = owner.requestAnimationFrame(() => {
        if (this.pendingUserIntentExpiryFrame !== secondFrame) return;
        this.pendingUserIntentExpiryFrame = null;
        this.pendingUserIntent = false;
      });
      this.pendingUserIntentExpiryFrame = secondFrame;
    });
    this.pendingUserIntentExpiryFrame = firstFrame;
  };

  private cancelPendingUserIntentExpiry(): void {
    const frame = this.pendingUserIntentExpiryFrame;
    if (frame) frame.owner.cancelAnimationFrame(frame.handle);
    this.pendingUserIntentExpiryFrame = null;
  }

  /** Clears the pending user-intent flag and cancels its proactive expiry, if one is still
   *  scheduled. */
  private clearUserIntent(): void {
    this.pendingUserIntent = false;
    this.cancelPendingUserIntentExpiry();
  }

  /** Consumes the pending user-intent flag, returning whatever it held. Always clears it (and its
   *  proactive expiry, if still pending). */
  private consumeUserIntent(): boolean {
    const wasPending = this.pendingUserIntent;
    this.clearUserIntent();
    return wasPending;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const scroll = this.scrollEl;
    if (!scroll || event.button !== 0 || event.target !== scroll) return;
    const computed = getComputedStyle(scroll);
    const borderLeft = Number.parseFloat(computed.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(computed.borderRightWidth) || 0;
    const gutter = scroll.offsetWidth - scroll.clientWidth - borderLeft - borderRight;
    if (gutter <= 0) return;
    const rect = scroll.getBoundingClientRect();
    const inGutter =
      computed.direction === 'rtl'
        ? event.clientX <= rect.left + borderLeft + gutter
        : event.clientX >= rect.right - borderRight - gutter;
    if (!inGutter) return;
    this.scrollbarDragActive = true;
    // Dragging a native scrollbar thumb (or just holding the mouse button) can end with the
    // pointer well outside `[part="scroll"]` -- the release target is wherever the cursor
    // happens to be, not necessarily this element or one of its descendants. A listener bound
    // only here would never see that pointerup, leaving this flag stuck `true` and letting a
    // later, unrelated layout-shift scroll spuriously release `follow`.
    const owner = this.ownerDocument.defaultView;
    if (!owner || this.scrollbarDragWindow === owner) return;
    this.releaseScrollbarDragListeners();
    this.scrollbarDragWindow = owner;
    owner.addEventListener('pointerup', this.onPointerUp);
    // A drag can also end without a pointerup ever firing: a system gesture / palm rejection can
    // fire `pointercancel` instead, and losing implicit pointer capture (e.g. the dragged element
    // is removed) fires `lostpointercapture` -- both need the same teardown as pointerup, or this
    // flag is stuck true just as surely as the pointerup-outside-the-element case above.
    owner.addEventListener('pointercancel', this.onPointerUp);
    owner.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerUp = (): void => {
    this.scrollbarDragActive = false;
    this.releaseScrollbarDragListeners();
  };

  private releaseScrollbarDragListeners(): void {
    const owner = this.scrollbarDragWindow;
    if (!owner) return;
    owner.removeEventListener('pointerup', this.onPointerUp);
    owner.removeEventListener('pointercancel', this.onPointerUp);
    owner.removeEventListener('lostpointercapture', this.onPointerUp);
    this.scrollbarDragWindow = undefined;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'Home') this.markUserIntent();
  };

  private onScroll = (): void => {
    const el = this.scrollEl;
    if (!el) return;
    const distanceFromEnd = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromEnd <= this.effectiveBottomThreshold;
    if (atBottom) {
      this.clearUserIntent();
      if (!this.follow) this.follow = true;
      return;
    }
    const userCaused = this.consumeUserIntent() || this.scrollbarDragActive;
    if (userCaused && this.follow) this.follow = false;
  };

  private onVirtualRangeChanged = (e: Event): void => {
    const list = this.virtualListEl;
    if (!list) return;
    if (e.composedPath()[0] !== list) return;
    const detail = (e as CustomEvent<LyraVirtualListRange>).detail;
    if (
      !detail ||
      !Number.isFinite(detail.start) ||
      !Number.isFinite(detail.end) ||
      detail.start < 0 ||
      detail.end < detail.start
    ) {
      return;
    }
    const atBottom = list.items.length > 0 && detail.end >= list.items.length - 1;
    if (atBottom) {
      this.clearUserIntent();
      if (!this.follow) this.follow = true;
      return;
    }
    const userCaused = this.consumeUserIntent() || this.scrollbarDragActive;
    if (userCaused) {
      if (this.follow) this.follow = false;
      return;
    }
    // Not user-caused and not at the bottom -- new items were appended (or the viewport itself
    // resized). While follow is engaged, catch back up.
    if (this.follow) this.performScrollToEnd('auto');
  };

  private onSlotChange = (): void => {
    this.announceNewProjectedNodes();
    const wasVirtual = this.armedMode === 'virtual';
    this.armObservers();
    // `[part="base"]`'s `data-virtual` marker is computed in render() from the light-DOM children,
    // and a slot assignment change alone schedules no Lit update -- re-render only when the mode
    // actually flipped, so an ordinary slotchange stays as cheap as before.
    if ((this.armedMode === 'virtual') !== wasVirtual) this.requestUpdate();
  };

  private scheduleGrowthTick(): void {
    if (this.growthFrame) return;
    const owner = this.ownerDocument.defaultView;
    if (!owner) return;
    const frame: OwnedAnimationFrame = { owner, handle: 0 };
    frame.handle = owner.requestAnimationFrame(() => {
      if (this.growthFrame !== frame) return;
      this.growthFrame = null;
      if (!this.isConnected || this.ownerDocument.defaultView !== owner) return;
      this.updateUnreadDividerPosition();
      if (this.follow) this.performScrollToEnd('auto');
    });
    this.growthFrame = frame;
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private syncAnnouncementSink(): void {
    const politeness = this.live === 'polite' || this.live === 'assertive' ? this.live : undefined;
    if (!this.isConnected || politeness === undefined) {
      this.releaseAnnouncementSink();
      return;
    }
    if (
      this.announcementSink?.politeness === politeness &&
      this.announcementSink.element.ownerDocument === this.ownerDocument
    ) {
      return;
    }
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink(politeness, {
      document: this.ownerDocument,
      source: this,
    });
  }

  /**
   * A projected node's announcement text. `composedAccessibilityText()` computes an accessible
   * *name*: a subtree rooted at an element that names itself via `aria-label` (e.g.
   * `<lr-chat-message>`'s internal `role="article"` bubble, named after the message author)
   * correctly stops there per ARIA accname semantics and never descends into its own content --
   * exactly right for naming that landmark, but wrong for announcing a new chat message, where the
   * actual composed (slotted) content is what a listener needs to hear alongside the author label.
   * For a node with its own shadow root, also walk its light-DOM content directly -- bypassing the
   * shadow tree's name-bearing landmark entirely -- and append whatever text that surfaces which
   * the name-only pass didn't already include. Plain elements (no shadow root, e.g. the `<details>`
   * and `<img>` cases this same sink announces) are unaffected: `composedAccessibilityText(node)`
   * already walks their own light DOM directly, so there is nothing separate to add.
   */
  private announcementTextFor(node: Node): string {
    const primary = composedAccessibilityText(node);
    if (!(node instanceof Element) || !node.shadowRoot) return primary;
    const content = composedAccessibilityText(node.childNodes);
    const normalizedPrimary = primary.replace(/\s+/g, ' ').trim();
    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    if (!normalizedContent || normalizedPrimary.includes(normalizedContent)) return primary;
    return primary ? `${primary} ${content}` : content;
  }

  private onContentMutations = (records: MutationRecord[]): void => {
    this.scheduleGrowthTick();
    const sink = this.announcementSink;
    if (!sink) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          this.knownProjectedNodes.has(node) ||
          (node instanceof Element && node.hasAttribute('data-lr-chat-viewport-unread-boundary'))
        ) {
          continue;
        }
        this.knownProjectedNodes.add(node);
        const text = this.announcementTextFor(node).replace(/\s+/g, ' ').trim();
        if (text) sink.announce(text);
      }
    }
  };

  private announceNewProjectedNodes(): void {
    const sink = this.announcementSink;
    for (const node of this.messageElements) {
      if (this.knownProjectedNodes.has(node)) continue;
      this.knownProjectedNodes.add(node);
      if (!sink || !this.hasUpdated) continue;
      const text = this.announcementTextFor(node).replace(/\s+/g, ' ').trim();
      if (text) sink.announce(text);
    }
  }

  private armObservers(): void {
    const owner = this.ownerDocument.defaultView;
    const list = this.virtualListEl;
    const mode: 'virtual' | 'slotted' = list ? 'virtual' : 'slotted';
    for (const node of this.messageElements) this.knownProjectedNodes.add(node);
    // `onSlotChange` calls this on *every* `slotchange`, including the very first one, which
    // always fires once during initial mount even though `firstUpdated()` already armed things a
    // moment earlier. A naive unconditional rebuild here would tear down and recreate the
    // ResizeObserver(s) below on that redundant call -- and ResizeObserver guarantees an
    // immediate callback on `observe()` reporting the target's *current* size, not just future
    // changes, so a redundant rebuild re-triggers a follow-driven scroll-to-bottom purely from
    // being re-observed. That's a real, observed bug: it can land asynchronously after this
    // rebuild, undoing an unrelated scroll a host performs in between (e.g. `scrollToUnread()`
    // right after mount). Skip the rebuild when neither the mode nor, in virtual mode, the
    // specific list instance actually changed since the last arm.
    if (
      this.observerWindow === owner &&
      this.armedMode === mode &&
      (mode === 'slotted' || this.listenedVirtualList === list)
    ) {
      return;
    }
    this.teardownObservers();
    this.observerWindow = owner ?? undefined;
    this.armedMode = mode;
    if (list) {
      this.listenedVirtualList = list;
      list.addEventListener('lr-visible-range-changed', this.onVirtualRangeChanged as EventListener);
    } else {
      const content = this.contentEl;
      if (content) {
        // `ResizeObserver.observe()` guarantees one callback reporting the target's *current* size
        // before any real change happens -- useful for measuring, but wrong to treat as "content
        // grew," since acting on it re-triggers a scroll purely from having just started watching
        // (this was the same asynchronous-baseline case caught below for the scroll container's
        // own observer -- see that comment for why it matters). Ignore exactly that first delivery.
        let baselineSeen = false;
        const ResizeObserverCtor = owner?.ResizeObserver;
        if (ResizeObserverCtor) {
          let observer: ResizeObserver;
          observer = new ResizeObserverCtor(() => {
            if (
              !this.isConnected ||
              this.ownerDocument.defaultView !== owner ||
              this.contentResizeObserver !== observer
            ) {
              return;
            }
            if (!baselineSeen) {
              baselineSeen = true;
              return;
            }
            this.scheduleGrowthTick();
          });
          this.contentResizeObserver = observer;
          this.contentResizeObserver.observe(content);
        }
      }
      // Slotted rows live in the light DOM; slot assignment doesn't reparent them into the shadow
      // tree, so a MutationObserver watching the shadow-side content wrapper would never see one
      // added, removed, or reordered -- it has to watch `this` (the host) directly instead. This
      // also catches a childList change that doesn't happen to alter the transcript's overall
      // height (e.g. same-height rows reordered around the unread boundary), which the size-only
      // ResizeObserver above can't. `MutationObserver.observe()` has no equivalent guaranteed-first-
      // callback behavior, so it needs no baseline guard.
      const MutationObserverCtor = owner?.MutationObserver;
      if (MutationObserverCtor) {
        let observer: MutationObserver;
        observer = new MutationObserverCtor((records) => {
          if (
            !this.isConnected ||
            this.ownerDocument.defaultView !== owner ||
            this.contentMutationObserver !== observer
          ) {
            return;
          }
          this.onContentMutations(records);
        });
        this.contentMutationObserver = observer;
        this.contentMutationObserver.observe(this, { childList: true });
      }
    }
    const scrollEl = this.scrollEl;
    if (scrollEl) {
      // Same guaranteed-first-callback behavior as above, and it matters more here: this one calls
      // `performScrollToEnd()` directly, with no rAF hop of its own, so its baseline delivery can be
      // scheduled for a later animation frame than the content observer's (which detours through
      // `scheduleGrowthTick()`'s own rAF) and land after a scroll performed shortly after mount --
      // e.g. `scrollToUnread()` while `follow` is still engaged -- silently overwriting it back to
      // the end. Without this guard that race is real, not hypothetical: the baseline callback fires
      // unconditionally on every fresh `observe()` regardless of whether the size actually changed.
      let baselineSeen = false;
      const ResizeObserverCtor = owner?.ResizeObserver;
      if (ResizeObserverCtor) {
        let observer: ResizeObserver;
        observer = new ResizeObserverCtor(() => {
          if (
            !this.isConnected ||
            this.ownerDocument.defaultView !== owner ||
            this.scrollResizeObserver !== observer
          ) {
            return;
          }
          if (!baselineSeen) {
            baselineSeen = true;
            return;
          }
          if (this.follow) this.performScrollToEnd('auto');
        });
        this.scrollResizeObserver = observer;
        this.scrollResizeObserver.observe(scrollEl);
      }
    }
    // Deferred rather than called synchronously here: this is a real DOM-layout measurement that
    // necessarily writes reactive state (`unreadDividerTop`) reflecting it, and this method runs
    // from inside a Lit lifecycle callback (firstUpdated()/connectedCallback()) on the initial arm
    // -- a synchronous write there still needs a follow-up render to reflect it, which is
    // unavoidable, but doing it inside the lifecycle callback itself needlessly trips Lit's
    // "scheduled an update after an update completed" dev-mode notice. A microtask hop clears that
    // callback first. Mirrors the identical pattern (and reasoning) in
    // LyraVirtualList.attachContainerListeners()'s own initial measurement.
    const generation = ++this.armGeneration;
    queueMicrotask(() => {
      if (!this.isConnected || generation !== this.armGeneration) return;
      this.updateUnreadDividerPosition();
    });
  }

  private teardownObservers(): void {
    this.scrollResizeObserver?.disconnect();
    this.scrollResizeObserver = undefined;
    this.contentResizeObserver?.disconnect();
    this.contentResizeObserver = undefined;
    this.contentMutationObserver?.disconnect();
    this.contentMutationObserver = undefined;
    this.listenedVirtualList?.removeEventListener(
      'lr-visible-range-changed',
      this.onVirtualRangeChanged as EventListener,
    );
    this.listenedVirtualList = undefined;
    this.observerWindow = undefined;
    this.armedMode = null;
    this.armGeneration++;
    const frame = this.growthFrame;
    if (frame) frame.owner.cancelAnimationFrame(frame.handle);
    this.growthFrame = null;
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel ?? (this.label || this.localize('chatViewportLabel'));
    // Virtual mode's own layout rules key off this marker rather than `:host(:has(> lr-virtual-list))`:
    // `:has()` is not supported inside `:host()` (Chromium reports
    // `CSS.supports('selector(:host(:has(> em)))')` as false and drops the whole rule), so every
    // such rule was silently dead -- virtual mode kept `[part="scroll"]`'s own padding/overflow and
    // never gave `[part="content"]` a resolvable height.
    const virtual = this.virtualListEl !== null;
    return html`
      <div part="base" ?data-virtual=${virtual}>
        <div
          part="scroll"
          role="log"
          aria-live="off"
          aria-label=${label}
          tabindex=${virtual ? nothing : '0'}
          @scroll=${this.onScroll}
          @wheel=${this.markUserIntent}
          @touchmove=${this.markUserIntent}
          @pointerdown=${this.onPointerDown}
          @keydown=${this.onKeyDown}
        >
          <div part="content">
            <slot @slotchange=${this.onSlotChange}></slot>
            ${this.unreadDividerTop != null
              ? html`<div
                  part="unread-divider"
                  aria-hidden="true"
                  style=${styleMap({ top: `${this.unreadDividerTop}px` })}
                >
                  ${this.localize('newMessages')}
                </div>`
              : nothing}
          </div>
        </div>
        ${!this.follow
          ? html`<button part="jump-pill" type="button" @click=${() => this.scrollToBottom()}>
              ${this.pillLabel()}
            </button>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chat-viewport': LyraChatViewport;
  }
}
