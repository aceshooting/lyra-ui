import { collectionSupport } from './collection-snapshot.js';
import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { acquireAnnouncementSink, type AnnouncementSink } from './announcer.js';
import { isAccessibilityVisible } from './accessibility-visibility.js';
import { LyraElement } from './lyra-element.js';
import { snapshotLyraHighlights } from './highlight-collection.js';
import {
  boundedSelectionRects,
  boundedSelectionText,
  scopeFromElement,
  buildQuoteAnchor,
} from './text-quote.js';
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

/** Protected extension points implemented by the anchor-target mixin. */
declare class DocumentAnchorTargetHooks {
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

function selectionRange(root: LyraElement, shadowRoots: readonly ShadowRoot[]): Range | null {
  const document = root.ownerDocument;
  const view = document.defaultView;
  const globalSelection = (view?.getSelection() ?? null) as
    | (Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] })
    | null;

  if (globalSelection?.getComposedRanges && shadowRoots.length > 0) {
    const [composed] = globalSelection.getComposedRanges({ shadowRoots: [...shadowRoots] });
    if (!composed) return null;
    if (composed.startContainer === composed.endContainer && composed.startOffset === composed.endOffset) return null;
    const range = document.createRange();
    range.setStart(composed.startContainer, composed.startOffset);
    range.setEnd(composed.endContainer, composed.endOffset);
    return range;
  }

  const shadowSelection = (shadowRoots.at(-1) as { getSelection?: () => Selection | null } | undefined)?.getSelection?.();
  const selection = shadowSelection ?? globalSelection;
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  return selection.getRangeAt(0);
}

function containsAcrossShadowBoundaries(ancestor: Node, node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.nodeType === 11 && 'host' in current
      ? (current as ShadowRoot).host
      : current.parentNode;
  }
  return false;
}

/**
 * Mixin that turns a `LyraElement` subclass into an anchor-target viewer: adds
 * `highlights`/`activeHighlightId`/`anchor`/`anchorKinds`, `scrollToAnchor()` with a generation-
 * guarded retry-until-loaded loop, `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`
 * event plumbing, and `bindTextSelection()` for selection->anchor emission. The constructor uses
 * `never[]` because callers never construct through this helper's structural return type; unlike
 * `any[]`, that keeps the implementation detail out of every adopting viewer's public declaration.
 * It is bound to `LyraElement` (not plain `LitElement`)
 * because this mixin needs `this.emit()`/`this.localize()`/`this.scheduleAfterUpdate()`.
 *
 * Per-viewer hooks a subclass overrides: `applyAnchor(anchor)` (default declines everything) and
 * `computeSelectionAnchor(range, text)` (default: a `text-quote` anchor built from the whole render
 * root's text via `internal/text-quote.ts` -- a viewer with a narrower/paginated content root, e.g.
 * pdf, overrides this for a page-scoped scope).
 *
 * Named protected hook declarations keep subclass overrides and super calls visible without
 * exposing the mixin's private state in its constructor return type.
 */
/** @internal Source-only overload preserving subclass statics and protected members. */
export function DocumentAnchorTarget<
  T extends InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap>>,
>(
  Base: T,
): T & InternalMixinConstructor<LyraAnchorTarget & DocumentAnchorTargetHooks & { renderAnchorLiveRegion(): unknown }>;
/** Public, declaration-safe mixin signature. */
export function DocumentAnchorTarget<
  T extends PublicConstructor<LyraElement<LyraAnchorTargetEventMap>>,
>(
  Base: T,
): MixedConstructor<T, LyraAnchorTarget & DocumentAnchorTargetHooks & { renderAnchorLiveRegion(): unknown }>;
export function DocumentAnchorTarget(
  Base: InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap>>,
): InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap> & LyraAnchorTarget & {
  renderAnchorLiveRegion(): unknown;
}> {
  class DocumentAnchorTargetElement extends Base implements LyraAnchorTarget {
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
    private anchorAnnouncementSink?: AnnouncementSink;

    override connectedCallback(): void {
      super.connectedCallback();
      // The live region must already exist before the first anchor result arrives; acquire against
      // the current owner document so adoption into an iframe retargets the announcement too.
      this.anchorAnnouncementSink ??= acquireAnnouncementSink('polite', {
        document: this.ownerDocument,
        source: this,
      });
    }

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
      this.anchorGeneration++;
      this.cancelAnchorRetry();
      this.unbindTextSelection();
      this.anchorAnnouncementSink?.release();
      this.anchorAnnouncementSink = undefined;
      super.disconnectedCallback();
    }

    /** Per-viewer hook: attempts to resolve+scroll to one raw anchor, returning whether it
     *  succeeded. Default declines everything -- every real adopting viewer overrides this. */
    protected async applyAnchor(_anchor: LyraAnchor): Promise<boolean> {
      return false;
    }

    /** Per-viewer hook building a `LyraAnchor` from an ended selection. Default: a `text-quote`
     *  anchor from the whole render root's rendered text. */
    protected computeSelectionAnchor(range: Range, _text: string): LyraAnchor | null {
      const scope = scopeFromElement(this.renderRoot as unknown as Element);
      return buildQuoteAnchor(range, scope);
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
      if (isAccessibilityVisible(this)) this.anchorAnnouncementSink?.announce(text);
      this.anchorAnnouncementText = text;
    }

    /** Renders the visually-hidden, aria-hidden mirror of the latest anchor-jump announcement.
     *  The spoken copy is appended to the shared light-DOM sink acquired on connection while this
     *  host and its composed ancestors remain exposed to the accessibility tree. Adopting
     *  viewers include this once in their own `render()` output -- the mixin doesn't own `render()` itself,
     *  matching how `components/graph/graph.class.ts` hand-rolls its own equivalent
     *  `[part="live-region"]` without a mixin. Deliberately not `protected`: unlike the other mixin
     *  hooks, a real adopting viewer's own `render()` *calls* this directly rather than overriding it,
     *  and the mixin's exported return-type annotation needs it visible for that call to type-check
     *  (see this file's `DocumentAnchorTarget` doc comment). */
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
      const view = contentRoot.ownerDocument.defaultView;
      const ShadowRootCtor = view?.ShadowRoot;
      if (!ShadowRootCtor) return [];
      const roots = [this.shadowRoot, contentRoot.getRootNode()];
      return roots.filter((root, index): root is ShadowRoot =>
        root instanceof ShadowRootCtor && roots.indexOf(root) === index);
    }

    protected bindTextSelection(contentRoot: Element): void {
      this.unbindTextSelection();
      const document = contentRoot.ownerDocument;
      const view = document.defaultView;
      // A drag fires `selectionchange` continuously, and its release is followed by a pointerup and
      // possibly a trailing `selectionchange`; a keyup such as Ctrl+C changes nothing. Ignore changes
      // while the primary pointer is down, and report a range only when it differs from the last one.
      let pointerSelecting = false;
      let reported: readonly [Node, number, Node, number] | undefined;

      const onSelectionEnd = (): void => {
        const range = selectionRange(this, this.selectionShadowRoots(contentRoot));
        if (!range || !containsAcrossShadowBoundaries(contentRoot, range.commonAncestorContainer)) {
          reported = undefined;
          return;
        }
        if (
          reported &&
          reported[0] === range.startContainer && reported[1] === range.startOffset &&
          reported[2] === range.endContainer && reported[3] === range.endOffset
        ) return;
        const text = boundedSelectionText(range);
        if (!text) return;
        reported = [range.startContainer, range.startOffset, range.endContainer, range.endOffset];
        const anchor = this.computeSelectionAnchor(range, text);
        const rects = boundedSelectionRects(range);
        this.emit('lr-text-select', { text, anchor, rects });
      };

      let debounceHandle: number | undefined;
      const onSelectionChange = (): void => {
        if (pointerSelecting) return;
        if (!view) {
          onSelectionEnd();
          return;
        }
        if (debounceHandle !== undefined) view.cancelAnimationFrame(debounceHandle);
        debounceHandle = view.requestAnimationFrame(() => {
          debounceHandle = undefined;
          onSelectionEnd();
        });
      };
      const onPointerDown = (event: PointerEvent): void => {
        if (event.isPrimary && event.button === 0) pointerSelecting = true;
      };
      // Document-level, so a drag released outside the content root still ends its selection.
      const onPointerRelease = (): void => {
        if (!pointerSelecting) return;
        pointerSelecting = false;
        onSelectionEnd();
      };

      contentRoot.addEventListener('pointerup', onSelectionEnd);
      contentRoot.addEventListener('keyup', onSelectionEnd);
      document.addEventListener('selectionchange', onSelectionChange);
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('pointerup', onPointerRelease, true);
      document.addEventListener('pointercancel', onPointerRelease, true);

      this.selectionCleanup = () => {
        contentRoot.removeEventListener('pointerup', onSelectionEnd);
        contentRoot.removeEventListener('keyup', onSelectionEnd);
        document.removeEventListener('selectionchange', onSelectionChange);
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointerup', onPointerRelease, true);
        document.removeEventListener('pointercancel', onPointerRelease, true);
        if (debounceHandle !== undefined) view?.cancelAnimationFrame(debounceHandle);
      };
    }

    /** Removes the current selection-root listeners without requiring the host to disconnect. */
    protected unbindTextSelection(): void {
      this.selectionCleanup?.();
      this.selectionCleanup = undefined;
    }
  }
  return DocumentAnchorTargetElement;
}
