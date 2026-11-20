import { collectionSupport } from './collection-snapshot.js';
import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AnnouncementSinkController } from './announcer.js';
import { isAccessibilityVisible } from './accessibility-visibility.js';
import { LyraElement } from './lyra-element.js';
import { snapshotLyraHighlights } from './highlight-collection.js';
import { observeTextSelection, textSelectionShadowRoots } from './text-selection-observer.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  HighlightActivateDetail,
  TextSelectDetail,
  AnchorResultDetail,
} from '../components/viewers/document-viewer/anchors.js';

type PublicConstructor<T> = new (...args: never[]) => T;
type InternalMixinConstructor<T> = new (...args: any[]) => T;
type MixedConstructor<Base extends PublicConstructor<object>, Added> = Base & (
  new (...args: ConstructorParameters<Base>) => InstanceType<Base> & Added
);

const ANCHOR_RETRY_INTERVAL_MS = 250;
const ANCHOR_TIMEOUT_MS = 5000;
export {
  HIGHLIGHT_SNAPSHOT_LIMIT,
} from './highlight-collection.js';
/** Maximum records a capped highlight renderer receives from one retained snapshot. */
export const HIGHLIGHT_CANDIDATE_LIMIT = 1_000;

export interface LyraAnchorTargetEventMap {
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
}

/** Public surface a `DocumentAnchorTarget`-mixed viewer exposes -- what hosts type against.
 *  External registry authors who can't extend `LyraElement` implement this interface by hand
 *  instead of adopting the mixin. */
export interface LyraAnchorTarget {
  highlights: readonly LyraHighlight[];
  activeHighlightId: string | null;
  anchor: LyraAnchor | string | null;
  readonly anchorKinds: readonly LyraAnchorKind[];
  scrollToAnchor(target: LyraAnchor | string): Promise<boolean>;
}

/** Protected extension points implemented by the anchor-target mixins. */
declare class DocumentAnchorTargetHooks {
  /** @internal Cancels a retry when the underlying document authority changes. */
  protected cancelPendingAnchor(): void;
  protected anchorRetryIntervalMs: number;
  protected anchorTimeoutMs: number;
  protected applyAnchor(anchor: LyraAnchor): Promise<boolean>;
  protected computeSelectionAnchor(range: Range, text: string): LyraAnchor | null;
  protected performScrollToAnchor(target: LyraAnchor | string, generation?: number): Promise<boolean>;
  protected selectionShadowRoots(contentRoot: Element): ShadowRoot[];
  protected bindTextSelection(contentRoot: Element): void;
  protected unbindTextSelection(): void;
}

export type { DocumentAnchorTargetHooks };

/** Returns at most the candidate ceiling, reserving its first slot for an active entry anywhere
 * in the already-owned, globally bounded immutable snapshot. */
export function prioritizedHighlightCandidates<T extends LyraHighlight>(
  highlights: readonly T[],
  activeHighlightId: string | null,
): T[] {
  const ordinary: T[] = [];
  let active: T | undefined;
  for (let index = 0; index < highlights.length; index++) {
    const highlight = highlights[index]!;
    if (activeHighlightId !== null && highlight.id === activeHighlightId) {
      active ??= highlight;
    } else if (ordinary.length < HIGHLIGHT_CANDIDATE_LIMIT) {
      ordinary.push(highlight);
    }
  }
  if (!active) return ordinary;
  if (ordinary.length >= HIGHLIGHT_CANDIDATE_LIMIT) ordinary.length = HIGHLIGHT_CANDIDATE_LIMIT - 1;
  ordinary.unshift(active);
  return ordinary;
}

/**
 * Mixin that turns a `LyraElement` subclass into an anchor-target viewer without the text-quote
 * resolver: adds `highlights`/`activeHighlightId`/`anchor`/`anchorKinds`, `scrollToAnchor()` with a
 * generation-guarded retry-until-loaded loop, `lr-highlight-activate`/`lr-text-select`/
 * `lr-anchor-result` event plumbing, and `bindTextSelection()` for selection->anchor emission.
 * `computeSelectionAnchor()` declines by default, so region, time-range and cell viewers keep
 * navigation and highlights without loading the quote engine; `DocumentAnchorTarget` (in
 * `anchor-target.ts`) is the text-capable extension whose default builds a `text-quote` anchor.
 * The constructor uses `never[]` because callers never construct through this helper's structural
 * return type; unlike `any[]`, that keeps the implementation detail out of every adopting viewer's
 * public declaration. It is bound to `LyraElement` because the mixin needs `this.emit()`,
 * `this.localize()` and `this.scheduleAfterUpdate()`.
 */
/** @internal Source-only overload preserving subclass statics and protected members. */
export function DocumentAnchorTargetBase<
  T extends InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap>>,
>(
  Base: T,
): T & InternalMixinConstructor<LyraAnchorTarget & DocumentAnchorTargetHooks & { renderAnchorLiveRegion(): unknown }>;
/** Public, declaration-safe mixin signature. */
export function DocumentAnchorTargetBase<
  T extends PublicConstructor<LyraElement<LyraAnchorTargetEventMap>>,
>(
  Base: T,
): MixedConstructor<T, LyraAnchorTarget & DocumentAnchorTargetHooks & { renderAnchorLiveRegion(): unknown }>;
export function DocumentAnchorTargetBase(
  Base: InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap>>,
): InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap> & LyraAnchorTarget & {
  renderAnchorLiveRegion(): unknown;
}> {
  class DocumentAnchorTargetBaseElement extends Base implements LyraAnchorTarget {
    protected static collectionSupport = collectionSupport;
    protected static readonly ownedCollectionProperties = Object.freeze([
      'anchor',
    ]);

    protected static readonly immutableEventDetails = Object.freeze([
      'lr-text-select',
    ]);

    private _highlights: readonly LyraHighlight[] = snapshotLyraHighlights([]);
    private _highlightsSource?: readonly LyraHighlight[];
    @property({ attribute: false })
    get highlights(): readonly LyraHighlight[] { return this._highlights; }
    set highlights(value: readonly LyraHighlight[]) {
      // A parent template re-commits an object binding on every render. Re-assigning the same
      // source, or the retained snapshot itself, is not a change and must not repaint highlights.
      if (value === this._highlightsSource || value === this._highlights) return;
      const previous = this._highlights;
      this._highlightsSource = value;
      this._highlights = snapshotLyraHighlights(value);
      this.requestUpdate('highlights', previous);
    }
    @property({ attribute: 'active-highlight-id' }) activeHighlightId: string | null = null;
    /** Declarative jump target (a `LyraAnchor`, or the `id` of a `highlights` entry): assigning a new
     *  one scrolls to it, announces the result and fires `lr-anchor-result`. Re-assigning the
     *  identical object or id -- which a parent template does on every render -- is not a new
     *  request; call `scrollToAnchor()` to jump to the same anchor again (the same citation
     *  activated twice). */
    @property({ attribute: false }) anchor: LyraAnchor | string | null = null;

    /** Instance capability mirror; overridden per adopting viewer (e.g. pdf-viewer sets `['page',
     *  'text-quote', 'region']`) so a standalone element is feature-detectable without the
     *  document-viewer registry. */
    readonly anchorKinds: readonly LyraAnchorKind[] = [];

    /** Real-timer thresholds for the retry loop, exposed as overridable instance fields (not module
     *  constants) so tests can shrink them instead of waiting out the real 5s timeout. */
    protected anchorRetryIntervalMs = ANCHOR_RETRY_INTERVAL_MS;
    protected anchorTimeoutMs = ANCHOR_TIMEOUT_MS;

    @state() private anchorAnnouncementText = '';

    private anchorGeneration = 0;
    private anchorRetryHandle?: number;
    private anchorRetryOwner?: Window;
    private anchorRetryResolve?: () => void;
    private selectionCleanup?: () => void;
    // Mounted at connect: the live region must already exist before the first anchor result arrives.
    private readonly anchorAnnouncementSink = new AnnouncementSinkController(this, { eager: ['polite'] });

    protected override willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);
      if (changed.has('anchor') && this.anchor !== null) {
        // A per-viewer applyAnchor() may reject (a superseded page-text read, a rendition
        // failure). A caller of the public method can observe that, but this declarative path
        // has nobody to hand it to, so an unhandled rejection would escape to the page. Swallow
        // it HERE only, never inside scrollToAnchor() itself -- a subclass that overrides
        // scrollToAnchor() to surface its own localized error (lr-ebook-viewer) still needs the
        // throw to reach its own catch.
        void this.scrollToAnchor(this.anchor).catch(() => undefined);
      }
    }

    override disconnectedCallback(): void {
      // Bump the generation first so an in-flight retry loop's post-cancel generation check (see
      // `resolveWithRetry`) reliably observes staleness and stops instead of scheduling another
      // retry against a detached element.
      this.cancelPendingAnchor();
      this.unbindTextSelection();
      super.disconnectedCallback();
    }

    /** @internal Cancels pending document navigation before a source replacement or refresh. */
    protected cancelPendingAnchor(): void {
      this.anchorGeneration++;
      this.cancelAnchorRetry();
    }

    /** Per-viewer hook: attempts to resolve+scroll to one raw anchor, returning whether it
     *  succeeded. Default declines everything -- every real adopting viewer overrides this. */
    protected async applyAnchor(_anchor: LyraAnchor): Promise<boolean> {
      return false;
    }

    /** Per-viewer hook building a `LyraAnchor` from an ended selection. Default: no anchor. */
    protected computeSelectionAnchor(_range: Range, _text: string): LyraAnchor | null {
      return null;
    }

    /** Clears any outstanding retry wait, both the underlying timer and (crucially) the `Promise`
     *  a `resolveWithRetry()` loop is currently suspended on -- `clearTimeout()` alone would stop
     *  the timer from firing without ever settling that `Promise`, leaving the suspended loop
     *  (and the `scrollToAnchor()` call awaiting it) hung forever instead of observing the
     *  generation guard and unwinding. */
    private cancelAnchorRetry(): void {
      if (this.anchorRetryHandle !== undefined) {
        this.anchorRetryOwner?.clearTimeout(this.anchorRetryHandle);
        this.anchorRetryHandle = undefined;
      }
      this.anchorRetryOwner = undefined;
      const resolveWait = this.anchorRetryResolve;
      if (resolveWait) {
        this.anchorRetryResolve = undefined;
        resolveWait();
      }
    }

    /**
     * Public entry point. Delegates to `performScrollToAnchor()` and adds ONE thing on top: a
     * throwing `applyAnchor()` (a per-viewer bug, a synchronous DOM exception, an unhandled peer-
     * library rejection, ...) still degrades to a resolved `false` and still emits
     * `lr-anchor-result:{found:false}`, instead of leaving this method's documented "always
     * reports a definite result" contract broken by an unhandled rejection.
     *
     * This safety net deliberately lives HERE and not inside `performScrollToAnchor()` (or deeper,
     * around the `applyAnchor()` call site itself): `lr-ebook-viewer` overrides this method and
     * calls `super.performScrollToAnchor()` -- not `super.scrollToAnchor()` -- specifically so its
     * own override's own catch (which reports a localized rendition-failure alert) keeps first and
     * only refusal of its own `applyAnchor()`'s throw. A catch anywhere inside
     * `performScrollToAnchor()` would run before that override's `super` call ever returns,
     * making its own catch unreachable. See `performScrollToAnchor()`'s own doc comment.
     */
    async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
      const generation = ++this.anchorGeneration;
      try {
        return await this.performScrollToAnchor(target, generation);
      } catch {
        if (generation !== this.anchorGeneration) return false;
        this.announceAnchorResult(undefined, false);
        this.emit('lr-anchor-result', { found: false });
        return false;
      }
    }

    /**
     * The real `scrollToAnchor()` body, split out so a subclass that overrides the public method
     * (currently only `lr-ebook-viewer`) can invoke this directly via
     * `super.performScrollToAnchor()` and keep its OWN catch in full control of a throwing
     * `applyAnchor()` -- entirely bypassing `scrollToAnchor()`'s safety-net catch above. Only
     * `scrollToAnchor()` calls this with an explicit `generation` (already bumped there, before any
     * `await`); an overriding subclass's call omits it and gets a freshly bumped one here instead,
     * matching this method's pre-split behavior exactly -- `lr-ebook-viewer`'s own override is
     * therefore unaffected in every other respect (retry timing, generation-guard semantics,
     * announcements, event emission all still happen exactly as before).
     */
    protected async performScrollToAnchor(
      target: LyraAnchor | string,
      generation: number = ++this.anchorGeneration,
    ): Promise<boolean> {
      // Bump the generation *before* cancelling the previous retry wait -- cancellation resolves
      // a suspended `resolveWithRetry()` loop's pending Promise from a superseded call, scheduling
      // that loop's continuation (a microtask) to re-check the generation next. Bumping first
      // guarantees that check always sees the new value: it can only run after this call's own
      // synchronous statements finish, by which point the bump has already happened either way.
      this.cancelAnchorRetry();
      await this.updateComplete;
      if (generation !== this.anchorGeneration) return false;

      const highlightId = typeof target === 'string' ? target : undefined;
      const anchor = typeof target === 'string' ? this.highlights.find((h) => h.id === target)?.anchor : target;

      if (!anchor) {
        // An unresolvable highlight id still reports a definite (negative) result instead of
        // leaving a caller's `lr-anchor-result` listener waiting indefinitely.
        this.announceAnchorResult(undefined, false);
        this.emit('lr-anchor-result', { found: false });
        return false;
      }

      const ok = await this.resolveWithRetry(anchor, generation);
      if (generation !== this.anchorGeneration) return false;
      if (ok && highlightId) this.activeHighlightId = highlightId;
      this.announceAnchorResult(anchor, ok);
      this.emit('lr-anchor-result', { found: ok });
      return ok;
    }

    private async resolveWithRetry(anchor: LyraAnchor, generation: number): Promise<boolean> {
      const deadline = Date.now() + this.anchorTimeoutMs;
      for (;;) {
        if (generation !== this.anchorGeneration) return false;
        const ok = await this.applyAnchor(anchor);
        if (generation !== this.anchorGeneration) return false;
        if (ok) return true;
        if (Date.now() >= deadline) return false;
        const view = this.ownerDocument.defaultView;
        if (!view) return false;
        await new Promise<void>((resolve) => {
          this.anchorRetryResolve = resolve;
          this.anchorRetryOwner = view;
          let handle: number;
          handle = view.setTimeout(() => {
            if (this.anchorRetryHandle === handle && this.anchorRetryOwner === view) {
              this.anchorRetryHandle = undefined;
              this.anchorRetryOwner = undefined;
            }
            if (this.anchorRetryResolve === resolve) this.anchorRetryResolve = undefined;
            resolve();
          }, this.anchorRetryIntervalMs);
          this.anchorRetryHandle = handle;
        });
      }
    }

    private announceAnchorResult(anchor: LyraAnchor | undefined, found: boolean): void {
      if (!found || !anchor) {
        this.announce(this.localize('anchorNotFound'));
        return;
      }
      const page = 'page' in anchor ? anchor.page : undefined;
      this.announce(
        page != null ? this.localize('anchorJumpedToPage', undefined, { page }) : this.localize('anchorJumped'),
      );
    }

    private announce(text: string): void {
      // Each sink write appends a fresh light-DOM child, so an identical back-to-back result is a
      // distinct accessible-tree addition without mutating the user-visible/localized text. The
      // document-level sink does not inherit this component's visibility, so block the write when
      // the host or one of its composed ancestors is excluded from the accessibility tree.
      if (isAccessibilityVisible(this)) this.anchorAnnouncementSink.announcePolite(text);
      this.anchorAnnouncementText = text;
    }

    /** Renders the visually-hidden, aria-hidden mirror of the latest anchor-jump announcement.
     *  The spoken copy is appended to the shared light-DOM sink acquired on connection while this
     *  host and its composed ancestors remain exposed to the accessibility tree. Adopting
     *  viewers include this once in their own `render()` output -- the mixin doesn't own `render()` itself,
     *  matching how `components/graph/graph.class.ts` hand-rolls its own equivalent
     *  `[part="live-region"]` without a mixin. Deliberately not `protected`: unlike the other mixin
     *  hooks, a real adopting viewer's own `render()` *calls* this directly rather than overriding it,
     *  and the mixin's exported return-type annotation needs it visible for that call to type-check. */
    renderAnchorLiveRegion(): unknown {
      return html`<div
        part="anchor-live-region"
        class="sr-only"
        aria-hidden="true"
      >${this.anchorAnnouncementText}</div>`;
    }

    /** Attaches selection-end listeners to `contentRoot` and emits `lr-text-select` once for each
     *  non-collapsed selection that ends inside it: after the pointer that drags it is released,
     *  or after a keyboard/touch change settles. Reads the selection shadow-aware: composed ranges
     *  where `Selection.getComposedRanges()` exists, `ShadowRoot.getSelection()` next, else
     *  `document.getSelection()`. Collapsed selections never fire. */
    protected selectionShadowRoots(contentRoot: Element): ShadowRoot[] {
      return textSelectionShadowRoots(this, contentRoot);
    }

    protected bindTextSelection(contentRoot: Element): void {
      this.unbindTextSelection();
      this.selectionCleanup = observeTextSelection(
        this,
        contentRoot,
        (range, text, rects) => {
          const anchor = this.computeSelectionAnchor(range, text);
          this.emit('lr-text-select', { text, anchor, rects });
        },
        () => this.selectionShadowRoots(contentRoot),
      );
    }

    /** Removes the current selection-root listeners without requiring the host to disconnect. */
    protected unbindTextSelection(): void {
      this.selectionCleanup?.();
      this.selectionCleanup = undefined;
    }
  }
  return DocumentAnchorTargetBaseElement;
}
