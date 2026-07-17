import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { LyraVirtualList, type VirtualListRange } from '../virtual-list/virtual-list.class.js';
import { styles } from './chat-viewport.styles.js';

export interface LyraChatViewportEventMap {
  'lyra-follow-change': CustomEvent<{ following: boolean }>;
}

/**
 * `<lyra-chat-viewport>` — the transcript scroll container: owns stick-to-bottom behavior while an
 * answer streams, the "jump to latest" pill, and the unread divider.
 *
 * **Two supported content shapes, auto-detected:** ordinary element children (typically
 * `<lyra-chat-message>`s -- *slotted mode*), or exactly one `<lyra-virtual-list>` (*virtual mode*,
 * detected via `instanceof` against the imported class so custom prefixes keep working). In virtual
 * mode this component defers all scrolling to the slotted list's own `scrollToIndex()`.
 *
 * **Follow/release state machine.** While `follow` is engaged, content growth re-scrolls to the end.
 * Release happens only on a *user-intent* gesture (wheel, touchmove, scrollbar-drag, or
 * PageUp/ArrowUp/Home while the log region has focus) that leaves the view more than
 * `bottomThreshold` from the end -- a scroll caused by this component's own programmatic scrolling,
 * or by a layout shift, never releases it. Reaching the bottom again by any means re-engages `follow`.
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
 * no virtualization of its own (`<lyra-virtual-list>`); not a generic overflow surface
 * (`<lyra-scroller>`); no message semantics (`<lyra-chat-message>`).
 *
 * @customElement lyra-chat-viewport
 * @slot - The transcript: ordinary element children, or exactly one `<lyra-virtual-list>`.
 * @event lyra-follow-change - `detail: { following }` -- fired whenever `follow` flips (user
 *   scroll-up release, or reaching the bottom again). Never fired for the initial mount state.
 * @csspart base - The positioning root.
 * @csspart scroll - The scroll container (`role="log"`, `tabindex="0"`). In virtual mode it stops
 *   scrolling itself (the slotted list scrolls) but keeps the role.
 * @csspart content - The slotted-content wrapper the growth observers watch.
 * @csspart jump-pill - The built-in jump-to-latest button, absent while `follow` is engaged.
 * @csspart unread-divider - The "New messages" separator (slotted mode only).
 */
export class LyraChatViewport extends LyraElement<LyraChatViewportEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Component-managed stick-to-bottom state, host-writable. Setting `true` scrolls to the end and
   *  re-engages following; setting `false` releases it. */
  @property({ type: Boolean, reflect: true }) follow = true;

  /** Px distance from the end still counted as "at bottom." */
  @property({ type: Number, attribute: 'bottom-threshold' }) bottomThreshold = 24;

  /** Index of the first unread item -- element-child index in slotted mode, `items` index in virtual
   *  mode. Host-owned unread bookkeeping in, divider/pill count out. `null` disables both. */
  @property({ type: Number, attribute: 'unread-start-index' }) unreadStartIndex: number | null = null;

  /** Accessible name for the log region. Defaults to the localized `chatViewportLabel`. */
  @property() label = '';

  @state() private unreadDividerTop: number | null = null;

  @query('[part="scroll"]') private scrollEl?: HTMLElement;
  @query('[part="content"]') private contentEl?: HTMLElement;

  private pendingUserIntent = false;
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

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.armObservers();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownObservers();
  }

  firstUpdated(): void {
    this.armObservers();
  }

  protected updated(changed: PropertyValues): void {
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
        this.emit<{ following: boolean }>('lyra-follow-change', { following: this.follow });
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
    if (this.unreadStartIndex == null) return false;
    const behavior = prefersReducedMotion() ? 'auto' : (options?.behavior ?? 'smooth');
    const list = this.virtualListEl;
    if (list) {
      if (this.unreadStartIndex < 0 || this.unreadStartIndex >= list.items.length) return false;
      list.scrollToIndex(this.unreadStartIndex, { align: 'start', behavior });
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
    if (this.unreadStartIndex == null) return 0;
    return Math.max(0, this.totalCount - this.unreadStartIndex);
  }

  private pillLabel(): string {
    const count = this.unreadCount;
    if (count <= 0) return this.localize('jumpToLatest');
    const key =
      new Intl.PluralRules(this.effectiveLocale).select(count) === 'one' ? 'newMessageCount' : 'newMessagesCount';
    return this.localize(key, undefined, { count });
  }

  private updateUnreadDividerPosition(): void {
    if (this.virtualListEl || this.unreadStartIndex == null) {
      this.unreadDividerTop = null;
      return;
    }
    const content = this.contentEl;
    const children = Array.from(this.children) as HTMLElement[];
    const target = children[this.unreadStartIndex];
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
  };

  private onPointerDown = (): void => {
    this.scrollbarDragActive = true;
  };

  private onPointerUp = (): void => {
    this.scrollbarDragActive = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'Home') this.markUserIntent();
  };

  private onScroll = (): void => {
    const el = this.scrollEl;
    if (!el) return;
    const distanceFromEnd = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromEnd <= this.bottomThreshold;
    if (atBottom) {
      this.pendingUserIntent = false;
      if (!this.follow) this.follow = true;
      return;
    }
    const userCaused = this.pendingUserIntent || this.scrollbarDragActive;
    this.pendingUserIntent = false;
    if (userCaused && this.follow) this.follow = false;
  };

  private onVirtualRangeChanged = (e: Event): void => {
    const list = this.virtualListEl;
    if (!list) return;
    const detail = (e as CustomEvent<VirtualListRange>).detail;
    const atBottom = list.items.length > 0 && detail.end >= list.items.length - 1;
    if (atBottom) {
      this.pendingUserIntent = false;
      if (!this.follow) this.follow = true;
      return;
    }
    const userCaused = this.pendingUserIntent || this.scrollbarDragActive;
    this.pendingUserIntent = false;
    if (userCaused) {
      if (this.follow) this.follow = false;
      return;
    }
    // Not user-caused and not at the bottom -- new items were appended (or the viewport itself
    // resized). While follow is engaged, catch back up.
    if (this.follow) this.performScrollToEnd('auto');
  };

  private onSlotChange = (): void => {
    this.armObservers();
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
      list.addEventListener('lyra-visible-range-changed', this.onVirtualRangeChanged as EventListener);
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
      'lyra-visible-range-changed',
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

  render(): TemplateResult {
    const label = this.label || this.localize('chatViewportLabel');
    return html`
      <div part="base">
        <div
          part="scroll"
          role="log"
          aria-live="off"
          aria-label=${label}
          tabindex="0"
          @scroll=${this.onScroll}
          @wheel=${this.markUserIntent}
          @touchmove=${this.markUserIntent}
          @pointerdown=${this.onPointerDown}
          @pointerup=${this.onPointerUp}
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
    'lyra-chat-viewport': LyraChatViewport;
  }
}
