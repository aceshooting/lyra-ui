import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { normalizeQuoteText, scopeFromElement, buildQuoteAnchor } from './text-quote.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  HighlightActivateDetail,
  TextSelectDetail,
  AnchorResultDetail,
} from '../components/document-viewer/anchors.js';

type Constructor<T> = new (...args: any[]) => T;

export const ANCHOR_RETRY_INTERVAL_MS = 250;
export const ANCHOR_TIMEOUT_MS = 5000;

export interface LyraAnchorTargetEventMap {
  'lyra-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lyra-text-select': CustomEvent<TextSelectDetail>;
  'lyra-anchor-result': CustomEvent<AnchorResultDetail>;
}

/** Public surface a `DocumentAnchorTarget`-mixed viewer exposes -- what hosts type against.
 *  External registry authors who can't extend `LyraElement` implement this interface by hand
 *  instead of adopting the mixin. */
export interface LyraAnchorTarget {
  highlights: LyraHighlight[];
  activeHighlightId: string | null;
  anchor: LyraAnchor | string | null;
  readonly anchorKinds: readonly LyraAnchorKind[];
  scrollToAnchor(target: LyraAnchor | string): Promise<boolean>;
}

function selectionRange(root: LyraElement): Range | null {
  const shadowRoot = root.renderRoot instanceof ShadowRoot ? root.renderRoot : undefined;
  const globalSelection = (typeof window !== 'undefined' ? window.getSelection() : null) as
    | (Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] })
    | null;

  if (globalSelection?.getComposedRanges && shadowRoot) {
    const [composed] = globalSelection.getComposedRanges({ shadowRoots: [shadowRoot] });
    if (!composed) return null;
    if (composed.startContainer === composed.endContainer && composed.startOffset === composed.endOffset) return null;
    const range = document.createRange();
    range.setStart(composed.startContainer, composed.startOffset);
    range.setEnd(composed.endContainer, composed.endOffset);
    return range;
  }

  const shadowSelection = (shadowRoot as unknown as { getSelection?: () => Selection | null } | undefined)?.getSelection?.();
  const selection = shadowSelection ?? globalSelection;
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  return selection.getRangeAt(0);
}

/**
 * Mixin that turns a `LyraElement` subclass into an anchor-target viewer: adds
 * `highlights`/`activeHighlightId`/`anchor`/`anchorKinds`, `scrollToAnchor()` with a generation-
 * guarded retry-until-loaded loop, `lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result`
 * event plumbing, and `bindTextSelection()` for selection->anchor emission. Same `Constructor<T>`
 * mixin shape as `internal/strip-host-title.ts`; bound to `LyraElement` (not plain `LitElement`)
 * because this mixin needs `this.emit()`/`this.localize()`/`this.scheduleAfterUpdate()`.
 *
 * Per-viewer hooks a subclass overrides: `applyAnchor(anchor)` (default declines everything) and
 * `computeSelectionAnchor(range, text)` (default: a `text-quote` anchor built from the whole render
 * root's text via `internal/text-quote.ts` -- a viewer with a narrower/paginated content root, e.g.
 * pdf, overrides this for a page-scoped scope).
 */
export function DocumentAnchorTarget<T extends Constructor<LyraElement<any>>>(
  Base: T,
): T & Constructor<LyraAnchorTarget> {
  class DocumentAnchorTargetElement extends Base implements LyraAnchorTarget {
    @property({ attribute: false }) highlights: LyraHighlight[] = [];
    @property({ attribute: 'active-highlight-id' }) activeHighlightId: string | null = null;
    // `hasChanged: () => true` -- re-assigning the SAME anchor (e.g. re-clicking the same citation
    // badge twice) must still re-run scrollToAnchor/re-flash; Lit's default reference-equality
    // `hasChanged` would otherwise silently swallow the second, identical assignment.
    @property({ attribute: false, hasChanged: () => true }) anchor: LyraAnchor | string | null = null;

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
    private anchorRetryHandle?: ReturnType<typeof setTimeout>;
    private anchorRetryResolve?: () => void;
    private selectionCleanup?: () => void;

    protected willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);
      if (changed.has('anchor') && this.anchor !== null) {
        void this.scrollToAnchor(this.anchor);
      }
    }

    disconnectedCallback(): void {
      // Bump the generation first so an in-flight retry loop's post-cancel generation check (see
      // `resolveWithRetry`) reliably observes staleness and stops instead of scheduling another
      // retry against a detached element.
      this.anchorGeneration++;
      this.cancelAnchorRetry();
      this.selectionCleanup?.();
      this.selectionCleanup = undefined;
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
        clearTimeout(this.anchorRetryHandle);
        this.anchorRetryHandle = undefined;
      }
      const resolveWait = this.anchorRetryResolve;
      if (resolveWait) {
        this.anchorRetryResolve = undefined;
        resolveWait();
      }
    }

    async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
      // Bump the generation *before* cancelling the previous retry wait -- cancellation
      // synchronously wakes up a suspended `resolveWithRetry()` loop from a superseded call, and
      // that loop's very next step re-checks the generation. Bumping first guarantees that check
      // always sees the new value, regardless of microtask ordering between this call's remaining
      // synchronous setup and the woken-up loop's continuation.
      const generation = ++this.anchorGeneration;
      this.cancelAnchorRetry();
      await this.updateComplete;
      if (generation !== this.anchorGeneration) return false;

      const highlightId = typeof target === 'string' ? target : undefined;
      const anchor = typeof target === 'string' ? this.highlights.find((h) => h.id === target)?.anchor : target;

      if (!anchor) {
        // An unresolvable highlight id still reports a definite (negative) result instead of
        // leaving a caller's `lyra-anchor-result` listener waiting indefinitely.
        this.announceAnchorResult(undefined, false);
        this.emit<AnchorResultDetail>('lyra-anchor-result', { found: false });
        return false;
      }

      const ok = await this.resolveWithRetry(anchor, generation);
      if (generation !== this.anchorGeneration) return false;
      if (ok && highlightId) this.activeHighlightId = highlightId;
      this.announceAnchorResult(anchor, ok);
      this.emit<AnchorResultDetail>('lyra-anchor-result', { found: ok });
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
        await new Promise<void>((resolve) => {
          this.anchorRetryResolve = resolve;
          this.anchorRetryHandle = setTimeout(() => {
            this.anchorRetryHandle = undefined;
            this.anchorRetryResolve = undefined;
            resolve();
          }, this.anchorRetryIntervalMs);
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
      // Force a DOM text change even for an identical back-to-back announcement (e.g. re-activating
      // the same citation) -- a live region only announces on text *change*.
      this.anchorAnnouncementText = this.anchorAnnouncementText === text ? `${text}​` : text;
    }

    /** Renders the visually-hidden live region carrying anchor-jump announcements. Adopting viewers
     *  include this once in their own `render()` output -- the mixin doesn't own `render()` itself,
     *  matching how `components/graph/graph.class.ts` hand-rolls its own equivalent
     *  `[part="live-region"]` without a mixin. */
    protected renderAnchorLiveRegion(): unknown {
      return html`<div
        part="anchor-live-region"
        class="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >${this.anchorAnnouncementText}</div>`;
    }

    /** Attaches selection-end listeners to `contentRoot` and emits `lyra-text-select` on a
     *  non-collapsed selection ending inside it. Reads the selection shadow-aware: composed ranges
     *  where `Selection.getComposedRanges()` exists, `ShadowRoot.getSelection()` next, else
     *  `document.getSelection()`. Collapsed selections never fire. */
    protected bindTextSelection(contentRoot: Element): void {
      this.selectionCleanup?.();

      const onSelectionEnd = (): void => {
        const range = selectionRange(this);
        if (!range) return;
        if (!contentRoot.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== contentRoot) return;
        const text = normalizeQuoteText(range.toString());
        if (!text) return;
        const anchor = this.computeSelectionAnchor(range, text);
        const rects = Array.from(range.getClientRects());
        this.emit<TextSelectDetail>('lyra-text-select', { text, anchor, rects });
      };

      let debounceHandle: ReturnType<typeof requestAnimationFrame> | undefined;
      const onSelectionChange = (): void => {
        if (debounceHandle !== undefined) cancelAnimationFrame(debounceHandle);
        debounceHandle = requestAnimationFrame(() => {
          debounceHandle = undefined;
          onSelectionEnd();
        });
      };

      contentRoot.addEventListener('pointerup', onSelectionEnd);
      contentRoot.addEventListener('keyup', onSelectionEnd);
      document.addEventListener('selectionchange', onSelectionChange);

      this.selectionCleanup = () => {
        contentRoot.removeEventListener('pointerup', onSelectionEnd);
        contentRoot.removeEventListener('keyup', onSelectionEnd);
        document.removeEventListener('selectionchange', onSelectionChange);
        if (debounceHandle !== undefined) cancelAnimationFrame(debounceHandle);
      };
    }
  }
  return DocumentAnchorTargetElement;
}
