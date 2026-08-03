import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { composedAccessibilityText } from '../../../internal/announcement-text.js';
import { pauseIcon, playIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteDuration, finiteInteger } from '../../../internal/numbers.js';
import { composedContains, deepActiveElement } from '../../../internal/overlay-manager.js';
import { styles } from './random-content.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_items, LYRA_DEFAULT_open, LYRA_DEFAULT_randomContentPause, LYRA_DEFAULT_randomContentResume } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraRandomContentAnimation = 'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right';
export type LyraRandomContentMode = 'unique' | 'random' | 'sequence';

export interface LyraRandomContentEventMap {
  'lr-content-change': CustomEvent<{ items: HTMLElement[] }>;
}

/**
 * `<lr-random-content>` — displays a randomly (or sequentially) chosen
 * subset of its slotted children and hides the rest, for A/B copy testing,
 * testimonial/quote rotation, or varying marketing copy on each render or
 * interval without any custom JS beyond slotting the candidates.
 *
 * Not a form-associated control: it is a content-rotation primitive over
 * caller-supplied children, so the label/hint/error frame doesn't apply.
 * Its only built-in action is the autoplay pause/resume control.
 *
 * The host renders `display: block` by default, like the rest of this
 * family. A consumer needing an inline text-fragment swap inside a sentence
 * can override `lr-random-content { display: inline; }` from outside —
 * that isn't baked in here, since `display: contents` on the host risks
 * accessibility-tree inconsistencies across engines.
 *
 * Selection is driven by `autoplay`/`autoplayInterval` and the public
 * `randomize()` method. When autoplay is enabled, a built-in localized
 * pause/resume action exposes the reflected `paused` state. Rotation also
 * suspends while focus is anywhere inside the component and never hides a
 * subtree that currently owns focus.
 * Selection changes after mount are announced through a pre-mounted light-DOM live region,
 * except for timer-driven autoplay ticks. In particular, an explicit `randomize()` call is
 * announced even while autoplay is enabled. Announcement text omits subtree-pruned content; a
 * visibility-hidden wrapper omits its own text but can contain a visible override descendant.
 * A nested forwarding slot contributes flattened assigned text rather than fallback content;
 * later assigned-content and assignment changes are announced when they change the exposed
 * selection, while initial distribution stays silent.
 * Changes while the host or a composed ancestor is accessibility-hidden, as well as initial
 * connection and reconnection, stay silent.
 * Reactive selection changes written while detached and rendered during reconnection are part of
 * that silent baseline; a later explicit `randomize()` is still announced.
 *
 * `fade-left`/`fade-right` are physical-direction transforms (matching the
 * upstream naming this component mirrors), not "previous/next" navigational
 * semantics like a carousel chevron, so they are deliberately **not**
 * mirrored under `:host(:dir(rtl))`.
 *
 * @customElement lr-random-content
 * @slot - The pool of candidate children. Direct element children are eligible; a direct
 * forwarding slot is flattened to its projected element candidates.
 * @event lr-content-change - The displayed selection changed (first render, `randomize()`,
 * a slot-change-triggered reselection, or an autoplay tick). `detail: { items }` is the exact
 * array of elements now shown, in display order. Not emitted when the eligible pool is empty.
 * @csspart base - The wrapping element around the default slot.
 * @csspart pause-button - The autoplay pause/resume action.
 * @cssprop [--lr-animation-duration=300ms] - Mapped duration of the entrance animation.
 * @cssprop [--lr-animation-easing=ease] - Mapped easing function for the entrance animation.
 * @cssprop [--lr-animation-translate=var(--lr-size-0-5em)] - Mapped travel distance for directional animations.
 * @cssprop [--animation-duration=300ms] - Web Awesome duration alias.
 * @cssprop [--animation-easing=ease] - Web Awesome easing alias.
 * @cssprop [--animation-translate=var(--lr-size-0-5em)] - Web Awesome travel-distance alias.
 * @cssprop [--lr-random-content-animation-duration=300ms] - Duration of the entrance animation.
 * @cssprop [--lr-random-content-animation-easing=ease] - Easing function for the entrance animation.
 * @cssprop [--lr-random-content-animation-translate=var(--lr-size-0-5em)] - Translation distance for directional animations.
 * @status stable
 * @since 4.0.0
 */
export class LyraRandomContent extends LyraElement<LyraRandomContentEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    items: LYRA_DEFAULT_items,
    open: LYRA_DEFAULT_open,
    randomContentPause: LYRA_DEFAULT_randomContentPause,
    randomContentResume: LYRA_DEFAULT_randomContentResume,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Entrance effect applied to a child the instant it becomes shown. */
  @property({ reflect: true }) animation: LyraRandomContentAnimation = 'none';

  /** Whether the displayed selection automatically re-rolls on an interval. */
  @property({ type: Boolean, reflect: true }) autoplay = false;

  /** Whether autoplay is user-paused. Reflected for external state styling. */
  @property({ type: Boolean, reflect: true }) paused = false;

  /** Milliseconds between autoplay ticks. Clamped to a 1000ms floor. */
  @property({ type: Number, attribute: 'autoplay-interval' }) autoplayInterval = 3000;

  /** How many children are shown simultaneously -- a count, not the pool itself. NaN/negative/
   *  fractional/oversized all normalize through `finiteInteger`, clamped to at least 1 and at
   *  most the pool size -- see `clampedCount()`. */
  @property({ type: Number }) items = 1;

  /** Selection algorithm — see `randomize()`. */
  @property({ reflect: true }) mode: LyraRandomContentMode = 'unique';

  @query('slot') private slotEl?: HTMLSlotElement;

  private timer?: number;
  private timerWindow?: Window;
  private reduceMotion = false;
  private mediaQuery?: MediaQueryList;
  private sequenceCursor = 0;
  private previousSelection?: HTMLElement[];
  private lastPool: HTMLElement[] = [];
  private managedPool = new Set<HTMLElement>();
  private readonly authorState = new WeakMap<
    HTMLElement,
    { hiddenAttribute: string | null; ariaHidden: string | null }
  >();
  private authorStateObserver?: MutationObserver;
  private announcementContentObserver?: MutationObserver;
  private authorStateObserverPauseDepth = 0;
  private focusWithin = false;
  private announcementSink?: AnnouncementSink;
  private connectionGeneration = 0;
  private selectionAnnouncementsArmed = false;
  private lastAnnouncementText = '';
  // Distinguishes a genuine later `updated()` pass from the very first one.
  // Lit reports every declared reactive property as "changed" on the first
  // update (including `items`, which otherwise would make `updated()` run a
  // redundant second selection right after `firstUpdated()` already ran one
  // -- doubling the emitted `lr-content-change` event and, for
  // mode="sequence", double-advancing the cursor).
  private hasUpdatedOnce = false;

  override connectedCallback(): void {
    this.connectionGeneration += 1;
    const connectionGeneration = this.connectionGeneration;
    super.connectedCallback();
    this.addEventListener('slotchange', this.onForwardedSlotChange);
    this.selectionAnnouncementsArmed = false;
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.startAuthorStateObserver();
    this.startAnnouncementContentObserver();
    const ownerWindow = this.ownerDocument.defaultView;
    this.mediaQuery = ownerWindow?.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reduceMotion = this.mediaQuery?.matches ?? false;
    this.mediaQuery?.addEventListener('change', this.onMotionPreferenceChange);
    // `firstUpdated()` only ever runs once per element lifetime, but
    // `disconnectedCallback()` unconditionally stops the timer on every
    // disconnect -- without restarting here too, a disconnect/reconnect
    // cycle (e.g. a virtualized list reordering this element) would leave
    // autoplay permanently stopped. Harmless no-op before the shadow tree's
    // slot exists yet (`eligible()` returns `[]`, gated off below).
    if (this.hasUpdated) {
      this.reselect({ announce: false });
    }
    this.restartAutoplay();
    // A reactive `items` write made while detached can leave its Lit update pending until this
    // connection. Let that update settle into the reconnect baseline before lifecycle-driven
    // reselections become live; explicit randomize() remains an announced operation.
    void this.updateComplete.then(() => {
      if (this.isConnected && connectionGeneration === this.connectionGeneration) {
        this.lastAnnouncementText = this.selectionAnnouncement(this.previousSelection ?? []);
        this.selectionAnnouncementsArmed = true;
      }
    });
  }

  override disconnectedCallback(): void {
    this.connectionGeneration += 1;
    this.selectionAnnouncementsArmed = false;
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.stopAutoplay();
    this.stopAuthorStateObserver();
    this.stopAnnouncementContentObserver();
    this.removeEventListener('slotchange', this.onForwardedSlotChange);
    this.focusWithin = false;
    this.restoreManagedPool();
    this.mediaQuery?.removeEventListener('change', this.onMotionPreferenceChange);
    this.mediaQuery = undefined;
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    // Handles slotted content present at parse time: the slot's assigned
    // elements are already resolved synchronously once the shadow tree
    // renders, so this doesn't need to wait on the (async, and not
    // guaranteed-timed across engines) `slotchange` event just to read the
    // initial pool. `onSlotChange` below still exists for genuinely later
    // pool changes and as a fallback if `slotchange` is the only signal a
    // given engine ever fires for this content.
    this.reselect({ announce: false });
    this.restartAutoplay();
  }

  protected override updated(changed: PropertyValues): void {
    if (this.hasUpdatedOnce) {
      if (changed.has('items')) {
        this.reselect({ announce: this.selectionAnnouncementsArmed });
      }
      if (changed.has('autoplay') || changed.has('autoplayInterval') || changed.has('paused')) {
        this.restartAutoplay();
      }
    }
    this.hasUpdatedOnce = true;
  }

  private onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reduceMotion = event.matches;
    this.restartAutoplay();
  };

  private eligible(): HTMLElement[] {
    return (this.slotEl?.assignedElements({ flatten: true }) ?? []).filter(
      (el): el is HTMLElement => el.namespaceURI === 'http://www.w3.org/1999/xhtml',
    );
  }

  private clampedCount(poolSize: number): number {
    // Only called with poolSize >= 1 (reselect() returns early for an empty pool), so a [1,
    // poolSize] clamp is always well-formed here.
    return finiteInteger(this.items, 1, 1, poolSize);
  }

  private poolsEqual(a: HTMLElement[], b: HTMLElement[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((el, index) => el === b[index]);
  }

  private shuffledPick(pool: HTMLElement[], count: number): HTMLElement[] {
    const arr = pool.slice();
    const n = Math.min(count, arr.length);
    for (let i = 0; i < n; i += 1) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      const swap = arr[i]!; // safe: i < n <= arr.length
      arr[i] = arr[j]!; // safe: j in [i, arr.length-1]
      arr[j] = swap;
    }
    return arr.slice(0, n);
  }

  private sameAsPrevious(selection: HTMLElement[]): boolean {
    const previous = this.previousSelection;
    if (!previous || previous.length !== selection.length) return false;
    const previousSet = new Set(previous);
    return selection.every((el) => previousSet.has(el));
  }

  private selectUnique(pool: HTMLElement[], count: number): HTMLElement[] {
    let picked = this.shuffledPick(pool, count);
    if (pool.length > count) {
      let attempts = 0;
      while (attempts < 10 && this.sameAsPrevious(picked)) {
        picked = this.shuffledPick(pool, count);
        attempts += 1;
      }
    }
    return picked;
  }

  private selectSequence(pool: HTMLElement[], count: number): HTMLElement[] {
    const total = pool.length;
    const start = this.sequenceCursor % total;
    const picked: HTMLElement[] = [];
    for (let k = 0; k < count; k += 1) {
      // safe: pool is non-empty (reselect() returns early for an empty pool), so total >= 1 and (start + k) % total is in [0, total-1]
      picked.push(pool[(start + k) % total]!);
    }
    this.sequenceCursor = (start + count) % total;
    return picked;
  }

  private computeSelectionForMode(pool: HTMLElement[], count: number): HTMLElement[] {
    switch (this.mode) {
      case 'sequence':
        return this.selectSequence(pool, count);
      case 'random':
        return this.shuffledPick(pool, count);
      case 'unique':
      default:
        return this.selectUnique(pool, count);
    }
  }

  private preserveFocusedSubtree(pool: HTMLElement[], selected: HTMLElement[]): HTMLElement[] {
    const active = deepActiveElement(this.ownerDocument);
    const focusedItem = pool.find((item) => composedContains(item, active));
    if (!focusedItem || selected.includes(focusedItem)) return selected;
    return [...selected.slice(0, -1), focusedItem];
  }

  private reconcileManagedPool(pool: HTMLElement[]): void {
    const nextPool = new Set(pool);
    for (const item of this.managedPool) {
      if (!nextPool.has(item)) this.restoreAuthorState(item);
    }
    for (const item of pool) {
      if (!this.authorState.has(item)) {
        this.authorState.set(item, {
          hiddenAttribute: item.getAttribute('hidden'),
          ariaHidden: item.getAttribute('aria-hidden'),
        });
      }
    }
    this.managedPool = nextPool;
  }

  private restoreAuthorState(item: HTMLElement): void {
    const original = this.authorState.get(item);
    if (!original) return;
    if (original.hiddenAttribute === null) item.removeAttribute('hidden');
    else item.setAttribute('hidden', original.hiddenAttribute);
    if (original.ariaHidden === null) item.removeAttribute('aria-hidden');
    else item.setAttribute('aria-hidden', original.ariaHidden);
    this.authorState.delete(item);
  }

  private restoreManagedPool(): void {
    for (const item of this.managedPool) this.restoreAuthorState(item);
    this.managedPool.clear();
    this.lastPool = [];
    this.previousSelection = undefined;
    this.lastAnnouncementText = '';
  }

  private applyManagedSelection(pool: HTMLElement[], selected: HTMLElement[]): void {
    const selectedSet = new Set(selected);
    for (const el of pool) {
      const shown = selectedSet.has(el);
      el.toggleAttribute('hidden', !shown);
      el.setAttribute('aria-hidden', shown ? 'false' : 'true');
    }
  }

  private applySelection(pool: HTMLElement[], selected: HTMLElement[]): void {
    this.withAuthorStateObserverPaused(() => {
      this.reconcileManagedPool(pool);
      this.applyManagedSelection(pool, selected);
    });
  }

  private captureAuthorStateMutations(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type !== 'attributes') continue;
      const item = record.target as HTMLElement;
      if (!this.managedPool.has(item)) continue;
      const state = this.authorState.get(item);
      if (!state) continue;
      if (record.attributeName === 'hidden') state.hiddenAttribute = item.getAttribute('hidden');
      if (record.attributeName === 'aria-hidden') state.ariaHidden = item.getAttribute('aria-hidden');
    }
  }

  private observeAuthorState(): void {
    const observer = this.authorStateObserver;
    if (!observer) return;
    const options: MutationObserverInit = {
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden'],
      subtree: true,
    };
    observer.observe(this, options);
    for (const item of this.eligible()) {
      if (!this.contains(item)) observer.observe(item, options);
    }
  }

  private startAuthorStateObserver(): void {
    if (this.authorStateObserver) return;
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.authorStateObserver = new MutationObserverCtor((records) => {
      this.captureAuthorStateMutations(records);
      // Keep the current component-owned selection applied while retaining the author's latest
      // values for exact restoration when an item leaves the pool or the host disconnects.
      this.withAuthorStateObserverPaused(() => {
        const selected = this.preserveFocusedSubtree(this.lastPool, this.previousSelection ?? []);
        this.applyManagedSelection(this.lastPool, selected);
        this.previousSelection = selected;
      });
    });
    this.observeAuthorState();
  }

  private stopAuthorStateObserver(): void {
    const observer = this.authorStateObserver;
    if (!observer) return;
    this.captureAuthorStateMutations(observer.takeRecords());
    observer.disconnect();
    this.authorStateObserver = undefined;
    this.authorStateObserverPauseDepth = 0;
  }

  private withAuthorStateObserverPaused<T>(operation: () => T): T {
    const observer = this.authorStateObserver;
    const outermost = this.authorStateObserverPauseDepth === 0;
    if (outermost && observer) {
      this.captureAuthorStateMutations(observer.takeRecords());
      observer.disconnect();
    }
    this.authorStateObserverPauseDepth += 1;
    try {
      return operation();
    } finally {
      this.authorStateObserverPauseDepth -= 1;
      if (outermost && observer && this.isConnected) this.observeAuthorState();
    }
  }

  private selectionAnnouncement(selected: HTMLElement[]): string {
    const content = selected
      .map((item) => composedAccessibilityText(item).replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
    const context = this.getAttribute('aria-label')?.trim() ?? '';
    if (!context || context === content) return content;
    return content ? `${context}: ${content}` : context;
  }

  private announcementObservationOptions(): MutationObserverInit {
    return {
      attributes: true,
      attributeFilter: ['alt', 'aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'open', 'slot', 'style'],
      characterData: true,
      childList: true,
      subtree: true,
    };
  }

  private observeAnnouncementContent(): void {
    const observer = this.announcementContentObserver;
    if (!observer) return;
    observer.disconnect();
    const options = this.announcementObservationOptions();
    observer.observe(this, options);
    for (const slot of this.querySelectorAll<HTMLSlotElement>('slot')) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) {
        observer.observe(assigned, options);
      }
    }
  }

  private startAnnouncementContentObserver(): void {
    if (this.announcementContentObserver) return;
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.announcementContentObserver = new MutationObserverCtor(() => {
      this.observeAnnouncementContent();
      this.announceCurrentSelectionIfChanged();
    });
    this.observeAnnouncementContent();
  }

  private stopAnnouncementContentObserver(): void {
    this.announcementContentObserver?.disconnect();
    this.announcementContentObserver = undefined;
  }

  private announceCurrentSelectionIfChanged(): void {
    const text = this.selectionAnnouncement(this.previousSelection ?? []);
    if (!this.selectionAnnouncementsArmed) {
      this.lastAnnouncementText = text;
      return;
    }
    if (text === this.lastAnnouncementText) return;
    this.lastAnnouncementText = text;
    if (text) this.announcementSink?.announce(text);
  }

  private onForwardedSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    if (!this.contains(slot)) return;
    this.observeAnnouncementContent();
    if (!this.poolsEqual(this.eligible(), this.lastPool)) {
      this.onSlotChange();
      return;
    }
    this.announceCurrentSelectionIfChanged();
  };

  private reselect(options: { resetPrevious?: boolean; announce?: boolean } = {}): HTMLElement[] {
    const pool = this.eligible();
    this.lastPool = pool;
    if (pool.length === 0) {
      this.withAuthorStateObserverPaused(() => this.reconcileManagedPool(pool));
      this.previousSelection = undefined;
      this.lastAnnouncementText = '';
      return [];
    }
    if (options.resetPrevious) this.previousSelection = undefined;
    const count = this.clampedCount(pool.length);
    const selected = this.preserveFocusedSubtree(pool, this.computeSelectionForMode(pool, count));
    this.applySelection(pool, selected);
    this.previousSelection = selected;
    const announcement = this.selectionAnnouncement(selected);
    this.lastAnnouncementText = announcement;
    if (options.announce !== false) {
      this.announcementSink?.announce(announcement);
    }
    this.emit('lr-content-change', { items: selected });
    return selected;
  }

  private onSlotChange = (): void => {
    if (!this.isConnected) return;
    const pool = this.eligible();
    // A slot's first assignment of already-present light-DOM children can
    // itself dispatch an async `slotchange` shortly after `firstUpdated()`
    // already handled that same content synchronously above -- skip when
    // nothing about the pool actually changed to avoid double-emitting
    // `lr-content-change` (and, for mode="sequence", double-advancing the
    // cursor) for a single real content change.
    if (this.poolsEqual(pool, this.lastPool)) return;
    this.reselect({
      resetPrevious: true,
      announce: this.selectionAnnouncementsArmed,
    });
    this.restartAutoplay();
  };

  /**
   * Selects a new set of children using the current mode. Applies
   * `hidden`/`aria-hidden`, emits `lr-content-change`, and returns the
   * elements now shown. The selection is announced even when `autoplay` is enabled; only the
   * timer's own selections stay silent. Does not reset or restart the autoplay timer.
   */
  randomize(): Element[] {
    return this.reselect();
  }

  private stopAutoplay(): void {
    if (this.timer !== undefined) this.timerWindow?.clearInterval(this.timer);
    this.timer = undefined;
    this.timerWindow = undefined;
  }

  private restartAutoplay(): void {
    this.stopAutoplay();
    if (
      !this.isConnected ||
      !this.autoplay ||
      this.paused ||
      this.focusWithin ||
      this.reduceMotion ||
      this.eligible().length < 2
    ) {
      return;
    }
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const interval = finiteDuration(this.autoplayInterval, 3000, 1000);
    const connectionGeneration = this.connectionGeneration;
    this.timerWindow = ownerWindow;
    this.timer = ownerWindow.setInterval(() => {
      if (
        connectionGeneration !== this.connectionGeneration ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== ownerWindow
      ) {
        this.stopAutoplay();
        return;
      }
      this.reselect({ announce: false });
    }, interval);
  }

  private onFocusIn = (): void => {
    this.focusWithin = true;
    this.stopAutoplay();
  };

  private onFocusOut = (): void => {
    const ownerWindow = this.ownerDocument.defaultView;
    const connectionGeneration = this.connectionGeneration;
    const finishFocusOut = (): void => {
      if (connectionGeneration !== this.connectionGeneration || !this.isConnected) return;
      this.focusWithin = composedContains(this, deepActiveElement(this.ownerDocument));
      if (!this.focusWithin) this.restartAutoplay();
    };
    if (ownerWindow) ownerWindow.queueMicrotask(finishFocusOut);
    else queueMicrotask(finishFocusOut);
  };

  private togglePaused = (): void => {
    this.paused = !this.paused;
  };

  override render(): TemplateResult {
    const hostLabel = this.getAttribute('aria-label');
    return html`
      <div
        part="base"
        role=${hostLabel === null ? nothing : 'group'}
        aria-label=${hostLabel === null ? nothing : hostLabel}
        @focusin=${this.onFocusIn}
        @focusout=${this.onFocusOut}
      >
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      ${this.autoplay
        ? html`<button
            part="pause-button"
            type="button"
            aria-pressed=${this.paused ? 'true' : 'false'}
            aria-label=${this.localize(this.paused ? 'randomContentResume' : 'randomContentPause')}
            @focusin=${this.onFocusIn}
            @focusout=${this.onFocusOut}
            @click=${this.togglePaused}
          >
            ${this.paused ? playIcon() : pauseIcon()}
          </button>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-random-content': LyraRandomContent;
  }
}
