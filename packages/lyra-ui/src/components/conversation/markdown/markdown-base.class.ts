import { type PropertyValues, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger } from '../../../internal/numbers.js';
import {
  DocumentAnchorTarget,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import {
  buildQuoteAnchor,
  createTextQuoteIndex,
  scopeFromElement,
  type TextQuoteIndex,
} from '../../../internal/text-quote.js';
import {
  acquireHighlightHandle,
  supportsCustomHighlights,
  type HighlightHandle,
} from '../../../internal/text-highlights.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
} from '../../viewers/document-viewer/anchors.js';
import type { ShikiLanguageInput } from '../code-block/shiki-types.js';
import type {
  LyraMarkedParser,
  MarkdownDeps,
  MarkedModule,
} from './markdown-loader.js';
import {
  addFailedHighlightKey,
  applyMarkdownAriaBusy,
  applyMarkdownFragmentAnchor,
  applyMarkdownTextQuoteAnchor,
  beginMarkdownDepsLoad,
  getCachedHighlight,
  hitTestHighlightRanges,
  HIGHLIGHT_CACHE_MAX,
  internalLinkHrefFrom,
  markdownHighlightConfigChanged,
  markdownLanguageSetChanged,
  markdownMathPeerError,
  markdownNeedsReparse,
  MarkdownOwnedAnimationFrameController,
  MarkdownParserController,
  normalizeMarkdownHtmlMode,
  normalizeMarkdownLeadingTabs,
  parseMarkdownDocument,
  processPendingHighlights,
  renderMarkdownContent,
  renderMarkdownDocument,
  repaintMarkdownHighlights,
  resolveMarkdownDarkTheme,
  setCachedHighlight,
  type MarkdownHeadingItem,
  type MarkdownHtmlMode,
  type MarkdownKatexState,
  type PendingHighlight,
  type ResolvedHighlightRange,
} from './markdown-shared.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

// Deliberately not tagged internal -- see MarkdownVariantContext's note below. This is the event
// map of LyraMarkdownRuntimeElement, the un-exported base the public MarkdownRuntimeBase extends;
// stripping it would leave that public class's inherited addEventListener overloads naming a type
// absent from the shipped .d.ts, breaking the package's own build (surfaced as
// `error TS2304: Cannot find name 'MarkdownRuntimeEventMap'` in a consumer's declaration check).
export interface MarkdownRuntimeEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-link-click': CustomEvent<{ href: string }>;
}

// The Lyra-prefixed owner is intentional: the default-string slice generator attributes helper
// lookups in this `.class.ts` module to its sole Lyra class, and both concrete Markdown tags inherit
// that generated slice through the runtime base below.
class LyraMarkdownRuntimeElement extends LyraElement<MarkdownRuntimeEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
  };
  // GENERATED DEFAULT-STRING SLICE: END
}

// Deliberately not tagged internal, and this note deliberately never spells that JSDoc tag out
// literally either: this TypeScript toolchain's stripInternal pass matches the tag as bare text
// anywhere in a comment block, not just in tag position, so writing it even to explain its
// absence re-triggers stripping. The public createMarkdownVariantContext() below references this
// type in its own signature; stripping this interface would leave that still-public signature
// naming a type that no longer exists in the shipped .d.ts, breaking the package's own build.
/** Shared per-tag state. The two concrete tags deliberately keep separate parser defaults,
 * connected-instance sets, and KaTeX resolution state while sharing one lifecycle implementation. */
export interface MarkdownVariantContext {
  readonly tag: 'lr-markdown' | 'lr-markdown-core';
  readonly connectedInstances: Set<MarkdownRuntimeBase>;
  readonly sharedParser: MarkdownParserController;
  readonly katexState: MarkdownKatexState;
}

export function createMarkdownVariantContext(
  tag: MarkdownVariantContext['tag'],
  katexState: MarkdownKatexState
): MarkdownVariantContext {
  return {
    tag,
    connectedInstances: new Set(),
    sharedParser: new MarkdownParserController(),
    katexState,
  };
}

// Deliberately not tagged internal -- see MarkdownVariantContext's note above. MarkdownRuntimeBase's
// own tokenizePendingHighlight abstract method returns Promise<MarkdownHighlightAttempt>.
/** `undefined` means an async attempt became stale; `null` means the current attempt cannot be
 * highlighted; a string is cacheable highlighted HTML. */
export type MarkdownHighlightAttempt = string | null | undefined;

// Deliberately not tagged internal -- see MarkdownVariantContext's note above. lr-markdown and
// lr-markdown-core publicly extend this class, so stripping it would leave both concrete classes'
// extends clauses naming a type absent from the shipped .d.ts, breaking the package's own build.
/**
 * Peer-neutral implementation shared by the full and core Markdown tags. Public reactive fields
 * remain declared on each concrete class so their CEM/JSDoc surfaces stay explicit; all state,
 * parsing, streaming, highlighting, theme, anchor, selection, and render orchestration lives here.
 * The only injected axis is how a fenced block obtains a Shiki highlighter, keeping the full
 * language-table imports unreachable from the core route.
 */
export abstract class MarkdownRuntimeBase extends DocumentAnchorTarget(
  LyraMarkdownRuntimeElement
) {
  abstract content: string;
  abstract tabSize: number;
  abstract htmlMode: MarkdownHtmlMode;
  abstract gfm: boolean;
  abstract linkTarget: string | null;
  abstract internalLinkPrefix: string;
  abstract headingOffset: number;
  abstract streaming: boolean;
  abstract highlightCode: boolean;
  abstract languages?: Readonly<Record<string, ShikiLanguageInput>>;
  abstract headingAnchors: boolean;
  abstract math: boolean;

  /** Anchor kinds resolved by both concrete Markdown tags. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = [
    'fragment',
    'text-quote',
  ];

  protected abstract get markdownVariant(): MarkdownVariantContext;

  /** Performs only the variant-specific Shiki loading/tokenization step. */
  protected abstract tokenizePendingHighlight(
    pending: PendingHighlight,
    languages: Readonly<Record<string, ShikiLanguageInput>> | undefined,
    isCurrent: () => boolean
  ): Promise<MarkdownHighlightAttempt>;

  @state() private renderedHtml: string | null = null;
  @state() private isDarkTheme = false;

  private deps?: MarkdownDeps;
  private readonly parser = new MarkdownParserController();
  private headingTree: MarkdownHeadingItem[] = [];
  private highlightHandle?: HighlightHandle;
  private textQuoteIndexCache?: {
    root: Element;
    locale: string;
    index: TextQuoteIndex;
    mappingDirty: boolean;
  };
  private textQuoteLocale?: string;
  private markdownTextScopeBuilds = 0;
  private resolvedHighlightRanges: ResolvedHighlightRange[] = [];
  private mathFailureReported = false;
  private highlightCache = new Map<string, string>();
  private highlightToken = 0;
  private streamingRenderRaf?: number;
  private readonly streamingRenderFrames =
    new MarkdownOwnedAnimationFrameController();
  private failedHighlightKeys = new Set<string>();
  private inFlightHighlightKeys = new Set<string>();

  private readonly handleKatexResolved = (): void => {
    if (this.isConnected) this.renderMarkdown();
  };

  constructor() {
    super();
    new ThemeWatcher(this, () => this.refreshTheme());
  }

  /** This instance's configurable parser, once the optional parser peer is available. */
  get marked(): LyraMarkedParser | undefined {
    return this.parser.get(this.deps?.marked);
  }

  /** Recomputes Shiki palette selection after an imperative theme change. */
  refreshTheme(): void {
    this.isDarkTheme = resolveMarkdownDarkTheme(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.markdownVariant.connectedInstances.add(this);
    this.refreshTheme();
    beginMarkdownDepsLoad(this, (resolved) => {
      this.deps = resolved;
      this.renderMarkdown();
    });
  }

  override disconnectedCallback(): void {
    this.markdownVariant.connectedInstances.delete(this);
    super.disconnectedCallback();
    this.highlightToken++;
    this.cancelStreamingRender();
    this.highlightHandle?.release();
    this.highlightHandle = undefined;
    this.textQuoteIndexCache = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.cancelStreamingRender();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    const contentRoot = this.renderRoot.querySelector('[part="content"]');
    if (contentRoot) {
      (
        this as unknown as { bindTextSelection(root: Element): void }
      ).bindTextSelection(contentRoot);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('math')) this.mathFailureReported = false;
    if (!this.deps || !markdownNeedsReparse(changed)) return;
    const highlightGenerationChanged =
      changed.has('content') ||
      changed.has('streaming') ||
      markdownHighlightConfigChanged(changed);
    if (highlightGenerationChanged) this.highlightToken++;
    if (markdownHighlightConfigChanged(changed)) {
      this.failedHighlightKeys.clear();
      if (markdownLanguageSetChanged(changed)) this.highlightCache.clear();
    }
    if (this.streaming) {
      this.scheduleStreamingRender();
      return;
    }
    this.cancelStreamingRender();
    this.renderMarkdown();
  }

  private cancelStreamingRender(): void {
    const handle = this.streamingRenderRaf;
    this.streamingRenderRaf = undefined;
    if (!this.streamingRenderFrames.cancel() && handle !== undefined) {
      this.ownerDocument.defaultView?.cancelAnimationFrame(handle);
    }
  }

  private scheduleStreamingRender(): void {
    if (this.streamingRenderRaf !== undefined) return;
    const view = this.ownerDocument.defaultView;
    if (!view) {
      if (this.isConnected) this.renderMarkdown();
      return;
    }
    const handle = this.streamingRenderFrames.request(view, () => {
      this.streamingRenderRaf = undefined;
      if (this.isConnected && this.ownerDocument.defaultView === view)
        this.renderMarkdown();
    });
    if (handle === undefined) {
      if (this.isConnected) this.renderMarkdown();
    } else if (this.streamingRenderFrames.handle === handle) {
      this.streamingRenderRaf = handle;
    }
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    const settled = this.streamingRenderFrames.settled;
    if (!settled) return complete;
    await settled;
    return super.getUpdateComplete();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    applyMarkdownAriaBusy(this, !this.deps || this.streaming);
    const locale = this.effectiveLocale;
    const localeChanged = this.textQuoteLocale !== undefined && this.textQuoteLocale !== locale;
    this.textQuoteLocale = locale;
    if (localeChanged) this.textQuoteIndexCache = undefined;
    if (changed.has('renderedHtml')) this.textQuoteIndexCache = undefined;
    if (
      changed.has('renderedHtml') ||
      changed.has('highlights') ||
      changed.has('activeHighlightId') ||
      (localeChanged && this.highlights.length > 0)
    ) {
      this.repaintHighlights();
    }
  }

  /** Immediately refreshes the current source after parser configuration changes. */
  renderMarkdown(): void {
    if (this.streaming) {
      this.renderedHtml = null;
      this.headingTree = [];
      return;
    }
    const deps = this.deps;
    if (!deps) return;
    const variant = this.markdownVariant;
    const outcome = renderMarkdownDocument({
      tag: variant.tag,
      deps,
      htmlMode: normalizeMarkdownHtmlMode(this.htmlMode),
      math: this.math,
      parse: (marked, pendingKeys, headingTreeOut) =>
        this.parseMarkdown(marked, pendingKeys, headingTreeOut),
      onParsed: () => this.maybeLoadKatex(),
      isKatexConfirmedMissing: () => variant.katexState.isConfirmedMissing(),
    });
    if (outcome.headingTree) this.headingTree = outcome.headingTree;
    if (outcome.status === 'fallback') {
      this.renderedHtml = null;
      this.emit('lr-render-error', { error: outcome.error });
      return;
    }
    this.renderedHtml = outcome.html;
    if (outcome.mathFailed) this.reportMathFailure();
    if (
      outcome.pendingKeys.length > 0 &&
      this.highlightCode &&
      !this.streaming
    ) {
      void this.highlightPending(outcome.pendingKeys);
    }
  }

  private maybeLoadKatex(): void {
    if (this.math)
      this.markdownVariant.katexState.startLoad(this.handleKatexResolved);
  }

  private reportMathFailure(): void {
    if (this.mathFailureReported) return;
    this.mathFailureReported = true;
    this.emit('lr-render-error', {
      error: markdownMathPeerError(this.markdownVariant.tag),
    });
  }

  private getCachedHighlight(key: string): string | undefined {
    return getCachedHighlight(this.highlightCache, key);
  }

  private setCachedHighlight(key: string, html: string): boolean {
    return setCachedHighlight(
      this.highlightCache,
      key,
      html,
      HIGHLIGHT_CACHE_MAX
    );
  }

  private async highlightPending(
    pendingKeys: PendingHighlight[]
  ): Promise<void> {
    const work = pendingKeys.filter(
      ({ key }) => !this.inFlightHighlightKeys.has(key)
    );
    if (work.length === 0) return;
    for (const { key } of work) this.inFlightHighlightKeys.add(key);
    const token = this.highlightToken;
    const languages = this.languages;
    const isCurrent = (): boolean =>
      token === this.highlightToken && this.isConnected;

    const tokenizeOne = async (pending: PendingHighlight): Promise<void> => {
      const html = await this.tokenizePendingHighlight(
        pending,
        languages,
        isCurrent
      );
      if (!isCurrent() || html === undefined) return;
      if (html === null || !this.setCachedHighlight(pending.key, html)) {
        addFailedHighlightKey(this.failedHighlightKeys, pending.key);
      }
    };

    try {
      await processPendingHighlights(work, tokenizeOne);
    } finally {
      for (const { key } of work) this.inFlightHighlightKeys.delete(key);
    }
    if (this.isConnected) this.renderMarkdown();
  }

  private parseMarkdown(
    marked: MarkedModule,
    pendingKeys: PendingHighlight[],
    headingTreeOut: MarkdownHeadingItem[]
  ): { html: string; hadMathFallback: boolean } {
    const variant = this.markdownVariant;
    return parseMarkdownDocument({
      marked,
      content: normalizeMarkdownLeadingTabs(
        this.content,
        finiteInteger(this.tabSize, 4, 1, 32)
      ),
      markedConfigurations: [
        variant.sharedParser.get(marked)?.defaults,
        this.marked?.defaults,
      ],
      gfm: this.gfm,
      linkTarget: this.linkTarget,
      headingOffset: finiteInteger(this.headingOffset, 0, 0, 6),
      escapeHtmlOption: normalizeMarkdownHtmlMode(this.htmlMode) === 'escape',
      highlightCodeOption: this.highlightCode && !this.streaming,
      getCachedHighlight: (key) => this.getCachedHighlight(key),
      failedHighlightKeys: this.failedHighlightKeys,
      headingAnchorsOption: this.headingAnchors,
      mathOption: this.math,
      cachedKatex: this.math ? variant.katexState.getIfLoaded() : null,
      pendingKeys,
      headingTreeOut,
    });
  }

  /** Returns a defensive copy of the latest document-ordered heading outline. */
  getHeadingTree(): MarkdownHeadingItem[] {
    return [...this.headingTree];
  }

  private contentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="content"]');
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    const root = this.contentRoot();
    if (!root) return false;
    if (anchor.kind === 'fragment') {
      return applyMarkdownFragmentAnchor(root, anchor, this.headingTree);
    }
    if (anchor.kind === 'text-quote') {
      const index = this.markdownTextIndex(root);
      const found = applyMarkdownTextQuoteAnchor(root, anchor, this.effectiveLocale, index);
      if (!supportsCustomHighlights(this.ownerDocument) && this.highlights.length > 0) {
        this.repaintHighlights();
      }
      return found;
    }
    return false;
  }

  protected computeSelectionAnchor(range: Range): LyraAnchor | null {
    const root = this.contentRoot();
    if (!root) return null;
    const anchor = buildQuoteAnchor(range, this.markdownTextIndex(root).scope);
    if (!supportsCustomHighlights(this.ownerDocument) && this.highlights.length > 0) {
      this.scheduleAfterUpdate(() => this.repaintHighlights());
    }
    return anchor;
  }

  private ensureHighlightHandle(): HighlightHandle {
    this.highlightHandle ??= acquireHighlightHandle(this, this.ownerDocument);
    return this.highlightHandle;
  }

  private markdownTextIndex(root: Element): TextQuoteIndex {
    const locale = this.effectiveLocale;
    const cached = this.textQuoteIndexCache;
    if (cached?.root === root && cached.locale === locale && !cached.mappingDirty) {
      return cached.index;
    }
    if (cached?.mappingDirty) {
      const handle = this.ensureHighlightHandle();
      for (const tone of ['accent', 'success', 'warning', 'danger', 'neutral'] as const) {
        handle.setRanges(tone, []);
      }
      handle.setActive(null);
    }
    const scope = scopeFromElement(root);
    this.markdownTextScopeBuilds++;
    if (
      cached?.root === root
      && cached.locale === locale
      && cached.index.rebindScope(scope)
    ) {
      cached.mappingDirty = false;
      return cached.index;
    }
    const index = createTextQuoteIndex(scope, locale);
    this.textQuoteIndexCache = { root, locale, index, mappingDirty: false };
    return index;
  }

  /** @internal Focused-test seam for one scope per rendered-content generation. */
  protected markdownTextScopeBuildCount(): number {
    return this.markdownTextScopeBuilds;
  }

  /** @internal Focused-test seam for occurrence reuse across quote highlights. */
  protected markdownTextQuoteScanCount(): number {
    return this.textQuoteIndexCache?.index.scanCount ?? 0;
  }

  private repaintHighlights(): void {
    this.resolvedHighlightRanges = [];
    const root = this.contentRoot();
    if (!root) return;
    const index = this.markdownTextIndex(root);
    this.resolvedHighlightRanges = repaintMarkdownHighlights({
      locale: this.effectiveLocale,
      root,
      handle: this.ensureHighlightHandle(),
      highlights: this.highlights,
      activeHighlightId: this.activeHighlightId,
      index,
    });
    if (!supportsCustomHighlights(this.ownerDocument) && this.textQuoteIndexCache) {
      this.textQuoteIndexCache.mappingDirty = true;
    }
  }

  private readonly onContentClick = (event: MouseEvent): void => {
    const highlightId = hitTestHighlightRanges(
      this.resolvedHighlightRanges,
      event.clientX,
      event.clientY
    );
    if (highlightId) {
      this.emit('lr-highlight-activate', { highlightId });
      return;
    }
    const href = internalLinkHrefFrom(event, this.internalLinkPrefix);
    if (href === null) return;
    event.preventDefault();
    this.emit('lr-link-click', { href });
  };

  override render(): TemplateResult {
    return renderMarkdownContent({
      content: this.content,
      sanitized: normalizeMarkdownHtmlMode(this.htmlMode) === 'sanitize',
      renderedHtml: this.renderedHtml,
      hostAriaLabel: this.getAttribute('aria-label'),
      isDarkTheme: this.isDarkTheme,
      onClick: this.onContentClick,
      liveRegion: this.renderAnchorLiveRegion(),
    });
  }
}
