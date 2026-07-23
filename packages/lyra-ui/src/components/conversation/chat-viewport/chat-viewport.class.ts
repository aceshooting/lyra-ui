import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { LyraVirtualList, type VirtualListRange } from '../../layout/virtual-list/virtual-list.class.js';
import { styles } from './chat-viewport.styles.js';
import { getPluralRules } from '../../../internal/intl-cache.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

export type ChatViewportLive = 'off' | 'polite' | 'assertive';

export interface LyraChatViewportEventMap {
  'lr-follow-change': CustomEvent<{ following: boolean }>;
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
 * that append complete messages at an announcement-safe cadence can opt into `polite` or `assertive`.
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
 * @csspart scroll - The scroll container (`role="log"`, `tabindex="0"`). In virtual mode it stops
 *   scrolling itself (the slotted list scrolls) but keeps the role.
 * @csspart content - The slotted-content wrapper the growth observers watch.
 * @csspart jump-pill - The built-in jump-to-latest button, absent while `follow` is engaged.
 * @csspart unread-divider - The "New messages" separator (slotted mode only).
 */
export class LyraChatViewport extends LyraElement<LyraChatViewportEventMap> {
  static override styles = [LyraElement.styles, styles];

  
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;

  /** Live-region policy forwarded to the internal `role="log"`. Keep `off` for token-by-token
   * streaming; use `polite` or `assertive` only when messages are appended at an announcement-safe
   * cadence. */
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

  private pendingUserIntent = false;
  /** `requestAnimationFrame` id of the in-flight proactive expiry scheduled by `markUserIntent()`
   *  -- see that method and `cancelPendingUserIntentExpiry()`. */
  private pendingUserIntentExpiryId?: number;
  private scrollbarDragActive = false;
  private isMounting = true;
  private pendingScrollBehavior?: 'auto' | 'smooth';
  private contentResizeObserver?: ResizeObserver;
  private contentMutationObserver?: MutationObserver;
  private scrollResizeObserver?: ResizeObserver;
  private growthRafId?: number;
  private listenedVirtualList?: LyraVirtualList;
  /** Which shape `armObservers()` last actually built watchers for -- `null` after a teardown.
   *  Guards against rebuilding on a redundant `armObservers()` call (see its own comment). */
  private armedMode: 'virtual' | 'slotted' | null = null;
  /** Bumped on every real (non-skipped) `armObservers()` call and on teardown -- invalidates a
   *  still-pending deferred initial-measurement microtask from a now-stale arm. */
  private armGeneration = 0;

  private get virtualListEl(): LyraVirtualList | null {
    const children = Array.from(this.children);
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
    if (this.hasUpdated) this.armObservers();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownObservers();
    // Safety net for a drag still in progress (pointerdown fired, no matching pointerup/
    // pointercancel/lostpointercapture yet) when this element is disconnected -- without this the
    // window listeners `onPointerDown` added would leak for the lifetime of the page.
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
    // Safety net for a still-scheduled proactive user-intent expiry (see markUserIntent()).
    this.cancelPendingUserIntentExpiry();
  }

  override firstUpdated(): void {
    this.armObservers();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
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
          : (this.pendingScrollBehavior ?? (prefersReducedMotion() ? 'auto' : 'smooth'));
        this.pendingScrollBehavior = undefined;
        this.performScrollToEnd(behavior);
      }
      if (!wasMounting) {
        this.emit<{ following: boolean }>('lr-follow-change', { following: this.follow });
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
  }

  /** Scrolls to the end and re-engages `follow`. Default `smooth`, forced to `auto` under
   *  `prefers-reduced-motion`. */
  scrollToBottom(options?: { behavior?: 'auto' | 'smooth' }): void {
    const behavior = prefersReducedMotion() ? 'auto' : (options?.behavior ?? 'smooth');
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
    const behavior = prefersReducedMotion() ? 'auto' : (options?.behavior ?? 'smooth');
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
    return list ? list.items.length : this.children.length;
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
    return this.localize(key, undefined, { count });
  }

  private updateUnreadDividerPosition(): void {
    const unreadStartIndex = this.effectiveUnreadStartIndex;
    if (this.virtualListEl || unreadStartIndex == null) {
      this.unreadDividerTop = null;
      return;
    }
    const content = this.contentEl;
    const children = Array.from(this.children) as HTMLElement[];
    const target = children[unreadStartIndex];
    if (!target || !content) {
      this.unreadDividerTop = null;
      return;
    }
    // `offsetTop`/`offsetParent` don't cross the shadow boundary the way this needs: a slotted
    // (light-DOM) row's offsetParent search only walks its light-DOM ancestors, which stops at
    // this host element itself -- it never reaches the shadow-side [part="content"] this divider
    // is actually positioned against, so it can land pixels off depending on the host's own box.
    // A getBoundingClientRect() delta is well-defined regardless of that boundary and, since both
    // rects move together by the same amount when the scroll container scrolls, is unaffected by
    // the current scroll position.
    this.unreadDividerTop = target.getBoundingClientRect().top - content.getBoundingClientRect().top;
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
    this.pendingUserIntentExpiryId = requestAnimationFrame(() => {
      this.pendingUserIntentExpiryId = requestAnimationFrame(() => {
        this.pendingUserIntentExpiryId = undefined;
        this.pendingUserIntent = false;
      });
    });
  };

  private cancelPendingUserIntentExpiry(): void {
    if (this.pendingUserIntentExpiryId !== undefined) {
      cancelAnimationFrame(this.pendingUserIntentExpiryId);
      this.pendingUserIntentExpiryId = undefined;
    }
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

  private onPointerDown = (): void => {
    this.scrollbarDragActive = true;
    // Dragging a native scrollbar thumb (or just holding the mouse button) can end with the
    // pointer well outside `[part="scroll"]` -- the release target is wherever the cursor
    // happens to be, not necessarily this element or one of its descendants. A listener bound
    // only here would never see that pointerup, leaving this flag stuck `true` and letting a
    // later, unrelated layout-shift scroll spuriously release `follow`.
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can also end without a pointerup ever firing: a system gesture / palm rejection can
    // fire `pointercancel` instead, and losing implicit pointer capture (e.g. the dragged element
    // is removed) fires `lostpointercapture` -- both need the same teardown as pointerup, or this
    // flag is stuck true just as surely as the pointerup-outside-the-element case above.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerUp = (): void => {
    this.scrollbarDragActive = false;
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
  };

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
    const detail = (e as CustomEvent<VirtualListRange>).detail;
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
    const wasVirtual = this.armedMode === 'virtual';
    this.armObservers();
    // `[part="base"]`'s `data-virtual` marker is computed in render() from the light-DOM children,
    // and a slot assignment change alone schedules no Lit update -- re-render only when the mode
    // actually flipped, so an ordinary slotchange stays as cheap as before.
    if ((this.armedMode === 'virtual') !== wasVirtual) this.requestUpdate();
  };

  private scheduleGrowthTick(): void {
    if (this.growthRafId !== undefined) return;
    this.growthRafId = requestAnimationFrame(() => {
      this.growthRafId = undefined;
      this.updateUnreadDividerPosition();
      if (this.follow) this.performScrollToEnd('auto');
    });
  }

  private armObservers(): void {
    const list = this.virtualListEl;
    const mode: 'virtual' | 'slotted' = list ? 'virtual' : 'slotted';
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
    if (this.armedMode === mode && (mode === 'slotted' || this.listenedVirtualList === list)) return;
    this.teardownObservers();
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
        this.contentResizeObserver = new ResizeObserver(() => {
          if (!baselineSeen) {
            baselineSeen = true;
            return;
          }
          this.scheduleGrowthTick();
        });
        this.contentResizeObserver.observe(content);
      }
      // Slotted rows live in the light DOM; slot assignment doesn't reparent them into the shadow
      // tree, so a MutationObserver watching the shadow-side content wrapper would never see one
      // added, removed, or reordered -- it has to watch `this` (the host) directly instead. This
      // also catches a childList change that doesn't happen to alter the transcript's overall
      // height (e.g. same-height rows reordered around the unread boundary), which the size-only
      // ResizeObserver above can't. `MutationObserver.observe()` has no equivalent guaranteed-first-
      // callback behavior, so it needs no baseline guard.
      this.contentMutationObserver = new MutationObserver(() => this.scheduleGrowthTick());
      this.contentMutationObserver.observe(this, { childList: true });
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
      this.scrollResizeObserver = new ResizeObserver(() => {
        if (!baselineSeen) {
          baselineSeen = true;
          return;
        }
        if (this.follow) this.performScrollToEnd('auto');
      });
      this.scrollResizeObserver.observe(scrollEl);
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
    this.armedMode = null;
    this.armGeneration++;
    if (this.growthRafId !== undefined) {
      cancelAnimationFrame(this.growthRafId);
      this.growthRafId = undefined;
    }
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('chatViewportLabel');
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
          aria-live=${this.live}
          aria-label=${label}
          tabindex="0"
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
                  role="separator"
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
