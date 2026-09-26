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
  TEXT_QUOTE_LIMITS,
  type TextQuoteIndex,
} from '../../../internal/text-quote.js';
import {
  acquireHighlightHandle,
  supportsCustomHighlights,
  type HighlightHandle,
} from '../../../internal/text-highlights.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import type { Slugger } from '../../../internal/slugger.js';
import type { LyraClipboardWriteSuccess, LyraClipboardWriteFailure } from '../../../internal/clipboard.js';
import { MarkdownCodeHeaderController, renderMarkdownCodeHeader, type MarkdownCodeBlockRecord } from './markdown-code-header.js';
import { MarkdownFallbackCodeScanner } from './markdown-fallback-code.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
} from '../../viewers/document-viewer/anchors.js';
import type { ShikiLanguageSource } from '../code-block/shiki-types.js';
import type {
  LyraMarkedParser,
  MarkdownDeps,
  MarkedModule,
} from './markdown-loader.js';
import { MarkdownProgressiveSession, markdownProgressiveEligible, type MarkdownProgressiveStats } from './markdown-progressive.js';
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
  markdownAnchorFromTarget,
  markdownTableRegionLabel,
  labelMarkdownTableWrappers,
  markdownHighlightConfigChanged,
  markdownLanguageSetChanged,
  markdownMathPeerError,
  markdownNeedsReparse,
  MarkdownOwnedAnimationFrameController,
  MarkdownParserController,
  normalizeMarkdownHtmlMode,
  normalizeMarkdownStreamingRender,
  createMarkdownRenderContext,
  finishMarkdownHtml,
  markdownSanitizerPolicy,
  type ParseMarkdownOptions,
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
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_codeRegion, LYRA_DEFAULT_codeRegionWithLanguage, LYRA_DEFAULT_copiedToClipboard, LYRA_DEFAULT_copyCode, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_markdownTableRegion } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const HIGHLIGHT_FAILURE_WARNING_KEY = 'lyra-markdown-highlight-failed';
const HIGHLIGHT_FAILURE_WARNING =
  '<lr-markdown>/<lr-markdown-core>: Syntax highlighting could not complete. Code is rendered as plain text.';

function keyboardHighlightIdFrom(
  ranges: readonly ResolvedHighlightRange[],
  event: MouseEvent
): string | null {
  const coordinateLess =
    event.clientX === 0 &&
    event.clientY === 0 &&
    event.screenX === 0 &&
    event.screenY === 0;
  // A keyboard-originated activation carries no pointing-device coordinates. Some engines retain
  // a nonzero click count for it, so recognize both the conventional detail=0 and coordinate-less
  // forms rather than treating keyboard activation as an ordinary off-highlight click.
  if (event.detail !== 0 && !coordinateLess) return null;
  const anchor = event.composedPath().find(
    (target): target is HTMLAnchorElement => markdownAnchorFromTarget(target) !== undefined,
  );
  if (!anchor) return null;
  for (let index = ranges.length - 1; index >= 0; index--) {
    const range = ranges[index];
    if (!range) continue;
    try {
      if (range.range.intersectsNode(anchor)) return range.id;
    } catch {
      // A stale range can be detached after content changes between a keyboard event's target
      // resolution and its handler. It cannot activate a highlight in that state.
    }
  }
  return null;
}

// Deliberately not tagged internal -- see MarkdownVariantContext's note below. This is the event
// map of LyraMarkdownRuntimeElement, the un-exported base the public MarkdownRuntimeBase extends;
// stripping it would leave that public class's inherited addEventListener overloads naming a type
// absent from the shipped .d.ts, breaking the package's own build (surfaced as
// `error TS2304: Cannot find name 'MarkdownRuntimeEventMap'` in a consumer's declaration check).
export interface MarkdownRuntimeEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-link-click': CustomEvent<{ href: string }>;
  'lr-content-settled': CustomEvent<null>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
}

/** Markdown behavior while a Markdown source is still arriving. */
export type MarkdownStreamingRenderMode = import('./markdown-shared.js').MarkdownStreamingRender;

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
    codeRegion: LYRA_DEFAULT_codeRegion,
    codeRegionWithLanguage: LYRA_DEFAULT_codeRegionWithLanguage,
    copiedToClipboard: LYRA_DEFAULT_copiedToClipboard,
    copyCode: LYRA_DEFAULT_copyCode,
    copyFailed: LYRA_DEFAULT_copyFailed,
    markdownTableRegion: LYRA_DEFAULT_markdownTableRegion,
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
  abstract streamingRender: MarkdownStreamingRenderMode;
  abstract codeBlockChrome: boolean;
  abstract codeBlockHeader: boolean;
  abstract highlightCode: boolean;
  abstract languages?: Readonly<Record<string, ShikiLanguageSource>>;
  abstract headingAnchors: boolean;
  abstract math: boolean;
  abstract maxHeight: string;

  /** Anchor kinds resolved by both concrete Markdown tags. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = [
    'fragment',
    'text-quote',
  ];

  protected abstract get markdownVariant(): MarkdownVariantContext;

  /** Performs only the variant-specific Shiki loading/tokenization step. */
  protected abstract tokenizePendingHighlight(
    pending: PendingHighlight,
    languages: Readonly<Record<string, ShikiLanguageSource>> | undefined,
    isCurrent: () => boolean
  ): Promise<MarkdownHighlightAttempt>;

  @state() private renderedHtml: string | null = null;
  @state() private renderedBlocks: Array<{ id: string; html: string }> = [];
  @state() private streamingTail: { kind: 'text' | 'open-fence'; text: string } | null = null;
  @state() private progressiveRevision = 0;
  @state() private isDarkTheme = false;

  private readonly boundLocalize = this.localize.bind(this);
  private tableRegionLabel: string | undefined;
  private readonly fallbackCode = new MarkdownFallbackCodeScanner();
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
  private inFlightHighlightKeys = new Map<string, number>();
  private progressiveSession?: MarkdownProgressiveSession;
  private progressiveAdopted = false;
  private progressiveRebuild = false;
  private progressiveInputGeneration = 0;
  private rememberedFocus?: { node: HTMLElement; index: number; selector: string };
  private readonly codeHeader: MarkdownCodeHeaderController;
  private codeBlocks: MarkdownCodeBlockRecord[] = [];


  private readonly handleKatexResolved = (): void => {
    if (!this.isConnected) return;
    if (this.progressiveSession && this.streaming) {
      this.progressiveSession.invalidateMath();
      this.scheduleStreamingRender();
    } else this.renderMarkdown();
  };

  constructor() {
    super();
    new ThemeWatcher(this, () => this.refreshTheme());
    this.codeHeader = new MarkdownCodeHeaderController(this, {
      isEnabled: () => this.codeBlockHeader || this.codeBlockChrome,
      contentVersion: () => this.progressiveSession ? this.renderedBlocks : this.renderedHtml,
      getContentRoot: () => this.contentRoot(),
      localize: this.boundLocalize,
      buildHeader: (frame, language) => renderMarkdownCodeHeader(frame, language),
      emitCopy: (outcome) => this.emit('lr-copy', outcome),
      emitCopyError: (outcome) => this.emit('lr-copy-error', outcome),
    });
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
      // A failed/missing peer can leave renderedHtml at the same fallback value. The dependency
      // settlement still changes aria-busy, so it must independently schedule an update.
      this.requestUpdate();
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
    this.fallbackCode.reset();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.codeHeader.hostAdopted();
    this.cancelStreamingRender();
    if (this.streaming && this.progressiveSession) this.scheduleStreamingRender();
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
    const active = this.shadowRoot?.activeElement as HTMLElement | null;
    const selector = '[part~="code-block"], [part~="code-block-copy"], [part~="table-wrapper"]';
    if (active?.matches(selector)) {
      this.rememberedFocus = { node: active, index: [...this.renderRoot.querySelectorAll(selector)].indexOf(active), selector };
    }
    if (changed.has('math')) this.mathFailureReported = false;
    if (!this.deps || !markdownNeedsReparse(changed)) return;
    const progressive = normalizeMarkdownStreamingRender(this.streamingRender) === 'progressive';
    const configurationChanged = [...changed.keys()].some((key) =>
      key !== 'content' && key !== 'streaming' && markdownNeedsReparse(new Map([[key, undefined]])));
    if (markdownHighlightConfigChanged(changed) || (!progressive && (changed.has('content') || changed.has('streaming')))) this.highlightToken++;
    if (markdownHighlightConfigChanged(changed)) {
      this.failedHighlightKeys.clear();
      if (markdownLanguageSetChanged(changed)) this.highlightCache.clear();
    }
    if (!progressive) this.resetProgressiveMarkdown();
    else if (configurationChanged) this.progressiveRebuild = true;
    if (changed.has('content')) this.progressiveInputGeneration++;
    if (this.streaming) {
      if (this.progressiveAdopted) { this.progressiveSession?.resume(); this.progressiveAdopted = false; }
      this.progressiveSession?.update(this.content ?? '');
      if (this.progressiveSession) this.syncProgressiveMarkdown();
      this.scheduleStreamingRender();
    } else {
      this.cancelStreamingRender();
      if (changed.has('content') && !changed.has('streaming') || configurationChanged) this.resetProgressiveMarkdown();
      this.renderMarkdown();
    }
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
      if (this.isConnected) this.runStreamingFrame();
      return;
    }
    const handle = this.streamingRenderFrames.request(view, () => {
      this.streamingRenderRaf = undefined;
      if (this.isConnected && this.ownerDocument.defaultView === view)
        this.runStreamingFrame();
    });
    if (handle === undefined) {
      if (this.isConnected) this.runStreamingFrame();
    } else if (this.streamingRenderFrames.handle === handle) {
      this.streamingRenderRaf = handle;
    }
  }

  private runStreamingFrame(): void {
    if (normalizeMarkdownStreamingRender(this.streamingRender) === 'progressive') this.renderProgressiveMarkdown();
    else this.renderMarkdown();
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    await super.getUpdateComplete();
    const generation = this.progressiveInputGeneration;
    const remaining = (this.content?.length ?? 0) - (this.progressiveSession?.end ?? 0);
    const cap = Math.ceil(Math.max(0, remaining) / 65_536) + 2;
    for (let frames = 0; frames < cap && this.streamingRenderRaf !== undefined; frames++) {
      await this.streamingRenderFrames.settled;
      await super.getUpdateComplete();
      if (generation !== this.progressiveInputGeneration) break;
    }
    return super.getUpdateComplete();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    applyMarkdownAriaBusy(this, !this.deps || this.streaming);
    const tableLabel = markdownTableRegionLabel(this.boundLocalize);
    if (changed.has('renderedHtml') || changed.has('renderedBlocks') || tableLabel !== this.tableRegionLabel) {
      this.tableRegionLabel = tableLabel;
      labelMarkdownTableWrappers(this.contentRoot(), tableLabel);
    }
    const remembered = this.rememberedFocus;
    this.rememberedFocus = undefined;
    if (remembered && !remembered.node.isConnected) {
      let active = this.ownerDocument.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      if (!active || active === this.ownerDocument.body || active === this.ownerDocument.documentElement) {
        this.renderRoot.querySelectorAll<HTMLElement>(remembered.selector)[remembered.index]?.focus({ preventScroll: true });
      }
    }
    const locale = this.effectiveLocale;
    const localeChanged = this.textQuoteLocale !== undefined && this.textQuoteLocale !== locale;
    this.textQuoteLocale = locale;
    const renderedContentChanged =
      changed.has('renderedHtml') || changed.has('renderedBlocks') || changed.has('streamingTail') || changed.has('progressiveRevision');
    if (localeChanged || renderedContentChanged || changed.has('content')) {
      this.textQuoteIndexCache = undefined;
    }
    if (
      renderedContentChanged ||
      changed.has('highlights') ||
      changed.has('activeHighlightId') ||
      (localeChanged && this.highlights.length > 0)
    ) {
      this.repaintHighlights();
    }
    // Signals a settle point -- new content (including the transient plain-text fallback shown
    // while `streaming` or before the optional parser peer resolves, and a later async highlight
    // upgrade) actually reached the rendered DOM. `content` covers every render this component's
    // own shadow-DOM-scoped `[part="content"]` produces, including the streaming/plain-fallback
    // path where `renderedHtml` itself never changes value (it stays `null` across an entire
    // stream); `renderedHtml` additionally covers the async highlight-upgrade re-render, which
    // changes rendered content without `content` itself changing. Composed and bubbling (see
    // `emit()`), so it crosses this element's own shadow boundary -- a host composing this element
    // inside a free-form container (e.g. `<lr-thinking-panel>`'s default slot) can listen for it to
    // drive auto-scroll, since a light-DOM `MutationObserver` on that container can never see a
    // property-driven update rendered entirely inside this element's own shadow root.
    const sourceRenderedImmediately = changed.has('content') &&
      !(this.streaming && this.streamingRender === 'progressive' && this.renderedHtml !== null);
    if ((sourceRenderedImmediately || renderedContentChanged) && this.isConnected) {
      this.emit('lr-content-settled', null);
    }
  }

  /** Immediately refreshes source, preserving unchanged settled groups during progressive rendering. */
  renderMarkdown(): void {
    if (this.streaming) {
      if (normalizeMarkdownStreamingRender(this.streamingRender) === 'progressive') {
        this.progressiveRebuild = Boolean(this.progressiveSession);
        this.scheduleStreamingRender();
        return;
      }
      this.renderedHtml = null;
      this.resetProgressiveMarkdown();
      this.headingTree = [];
      this.codeHeader.setBlocks([]);
      return;
    }
    const deps = this.deps;
    if (!deps) return;
    const session = this.progressiveSession;
    session?.update(this.content ?? '');
    session?.step(true, true);
    this.codeBlocks = [];
    const outcome = renderMarkdownDocument({
      tag: this.markdownVariant.tag, deps, htmlMode: normalizeMarkdownHtmlMode(this.htmlMode), math: this.math,
      codeBlockHeader: this.codeBlockHeader || this.codeBlockChrome,
      parse: (marked, pendingKeys, headingTreeOut) => this.parseMarkdown(marked, pendingKeys, headingTreeOut),
      onParsed: () => this.maybeLoadKatex(),
      isKatexConfirmedMissing: () => this.markdownVariant.katexState.isConfirmedMissing(),
    });
    if (outcome.headingTree) this.headingTree = outcome.headingTree;
    if (outcome.status === 'fallback') {
      this.renderedHtml = null;
      this.resetProgressiveMarkdown();
      this.codeHeader.setBlocks([]);
      this.emit('lr-render-error', { error: outcome.error });
      return;
    }
    const mode = normalizeMarkdownHtmlMode(this.htmlMode);
    const adopt = session && !session.failed && session.blocks.map((block) => block.html).join('') === outcome.html &&
      (mode !== 'trusted' || !session.blocks.some((block) => block.hasRawHtml)) &&
      (mode === 'sanitize' || session.blocks.slice(0, -1).every((block) => block.balanced));
    if (adopt) { this.progressiveAdopted = true; this.syncProgressiveMarkdown(); }
    else this.resetProgressiveMarkdown();
    this.renderedHtml = outcome.html;
    this.codeHeader.setBlocks(this.codeBlocks);
    if (outcome.mathFailed) this.reportMathFailure();
    if (outcome.pendingKeys.length > 0 && this.highlightCode) void this.highlightPending(outcome.pendingKeys);
  }

  private resetProgressiveMarkdown(): void {
    this.progressiveSession = undefined;
    this.progressiveAdopted = false;
    this.progressiveRebuild = false;
    if (this.renderedBlocks.length) this.renderedBlocks = [];
    this.streamingTail = null;
  }

  private createProgressiveSession(previous?: MarkdownProgressiveSession): MarkdownProgressiveSession | undefined {
    const deps = this.deps;
    const mode = normalizeMarkdownHtmlMode(this.htmlMode);
    if (!deps?.marked || mode === 'sanitize' && !deps.DOMPurify) return undefined;
    const context = createMarkdownRenderContext(this.markdownParseOptions(deps.marked, '', [], [], undefined, []));
    if (!markdownProgressiveEligible(context.instance, this.gfm)) {
      devWarnOnce('lyra-markdown-progressive-unavailable', '<lr-markdown>: this parser configuration uses plain streaming.');
      return undefined;
    }
    const policy = markdownSanitizerPolicy({ htmlMode: mode, math: this.math, codeBlockHeader: this.codeBlockHeader || this.codeBlockChrome });
    const activeHighlightKeys = new Set<string>();
    const session = new MarkdownProgressiveSession({
      parser: context.instance, gfm: this.gfm, tabSize: finiteInteger(this.tabSize, 4, 1, 32),
      render: (source, rawSource, links, state, slugger, prefix) => {
        const pendingKeys: PendingHighlight[] = [], headings: MarkdownHeadingItem[] = [];
        const records: MarkdownCodeBlockRecord[] = [];
        const options = this.markdownParseOptions(deps.marked!, source, pendingKeys, headings, slugger, records, rawSource);
        options.codeBlockIndexOffset = prefix.length;
        options.activeHighlightKeys = activeHighlightKeys;
        options.highlightCodeOption = this.highlightCode;
        const result = createMarkdownRenderContext(options).render(source, { links, state });
        this.maybeLoadKatex();
        return { ...result, rawHtml: result.html, html: finishMarkdownHtml(deps, policy, result.html), headings, codeBlocks: records, pendingKeys };
      },
    }, previous?.blocks);
    session.update(this.content ?? '');
    if (previous) session.step(false, true, previous.end);
    return session;
  }

  private renderProgressiveMarkdown(): void {
    const previous = this.progressiveSession;
    if (!previous || this.progressiveRebuild) {
      this.progressiveSession = this.createProgressiveSession(previous);
      this.progressiveRebuild = false;
    }
    const session = this.progressiveSession;
    if (!session) {
      this.renderedHtml = null;
      this.renderedBlocks = [];
      this.streamingTail = null;
      this.headingTree = [];
      this.codeHeader.setBlocks([]);
      return;
    }
    session.update(this.content ?? '');
    session.step();
    this.renderedHtml = '';
    this.syncProgressiveMarkdown();
    const pending = session.nextHighlight();
    if (pending && this.highlightCode) void this.highlightPending([pending]);
    if (session.pending) this.scheduleStreamingRender();
  }

  private syncProgressiveMarkdown(): void {
    const session = this.progressiveSession;
    if (!session) return;
    if (session.blocks.length !== this.renderedBlocks.length || session.blocks.some((block, index) => block.html !== this.renderedBlocks[index]?.html)) {
      this.renderedBlocks = session.blocks.map((block, index) => ({ id: `stream-${index}`, html: block.html }));
      this.progressiveRevision++;
    }
    const tail = session.tail;
    if (tail?.kind !== this.streamingTail?.kind || tail?.text !== this.streamingTail?.text) this.streamingTail = tail;
    this.headingTree = session.headings;
    this.codeHeader.setBlocks(session.records);
  }

  /** @internal Deterministic counters for bounded progressive work. */
  protected progressiveStats(): MarkdownProgressiveStats | undefined { return this.progressiveSession?.stats; }

  private maybeLoadKatex(): void {
    if (this.math)
      this.markdownVariant.katexState.startLoad(this.handleKatexResolved);
  }

  private reportMathFailure(): void {
    if (this.mathFailureReported) return;
    this.mathFailureReported = true;
    this.emit('lr-render-error', { error: markdownMathPeerError(this.markdownVariant.tag) });
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
      ({ key }) => this.inFlightHighlightKeys.get(key) !== this.highlightToken
    );
    if (work.length === 0) return;
    const token = this.highlightToken;
    for (const { key } of work) this.inFlightHighlightKeys.set(key, token);
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
    } catch {
      // tokenizePendingHighlight()'s own layers (loadShikiHighlighter()/loadShikiHighlighterCore()'s
      // load-time capability validation, shikiHasLoadedLanguage()'s tolerant check,
      // tokenizeMarkdownHighlight()'s own try/catch) already absorb every failure mode they know
      // about into a `null`/`false` result, not a throw -- this is the last-resort backstop for
      // anything unexpected that still escapes that pipeline. Swallowed here rather than surfaced
      // as an `lr-render-error` because a single pending block's tokenization failure isn't a
      // document-level render failure; the block simply keeps (or falls through to) its plain-text
      // fallback. Without this catch, `void this.highlightPending(...)`'s fire-and-forget call in
      // `renderMarkdown()` would leave an unhandled rejection AND skip the `renderMarkdown()` call
      // below, silently withholding every other already-tokenized block's highlighted output too.
      //
      // The batch's keys are recorded as failed here as well. `tokenizeOne` only records a failure
      // it observed as a `null`/`false` result, so a rejection that escapes it leaves its key
      // neither cached nor failed -- and the `renderMarkdown()` below would then re-queue that key
      // into the very same rejection on every render. With a memoized loader failure
      // (ensureShikiLanguageLoaded() caches each key's settled promise) that re-queue never waits
      // on anything, so the component spun in a microtask-tight loop that never yielded to the
      // page. A key that did tokenize before the batch rejected keeps its cached HTML: the cache
      // is consulted before the failed set.
      for (const { key } of work) addFailedHighlightKey(this.failedHighlightKeys, key);
      devWarnOnce(HIGHLIGHT_FAILURE_WARNING_KEY, HIGHLIGHT_FAILURE_WARNING);
    } finally {
      for (const { key } of work) if (this.inFlightHighlightKeys.get(key) === token) this.inFlightHighlightKeys.delete(key);
    }
    if (!this.isConnected) return;
    if (this.progressiveSession) {
      this.progressiveSession.invalidateHighlights(work.map(({ key }) => key));
      if (this.streaming) this.scheduleStreamingRender();
      else this.renderMarkdown();
    } else this.renderMarkdown();
  }

  private parseMarkdown(marked: MarkedModule, pendingKeys: PendingHighlight[], headingTreeOut: MarkdownHeadingItem[]): { html: string; hadMathFallback: boolean } {
    const source = this.content ?? '';
    return parseMarkdownDocument(this.markdownParseOptions(marked,
      normalizeMarkdownLeadingTabs(source, finiteInteger(this.tabSize, 4, 1, 32)), pendingKeys, headingTreeOut, undefined, this.codeBlocks, source));
  }

  private markdownParseOptions(marked: MarkedModule, content: string, pendingKeys: PendingHighlight[], headingTreeOut: MarkdownHeadingItem[],
    slugger?: Slugger, codeBlocksOut: MarkdownCodeBlockRecord[] = [], rawContent = content): ParseMarkdownOptions {
    const variant = this.markdownVariant;
    return {
      marked, slugger, content, pendingKeys, headingTreeOut, codeBlocksOut, rawContent,
      markedConfigurations: [variant.sharedParser.get(marked)?.defaults, this.marked?.defaults],
      gfm: this.gfm, linkTarget: this.linkTarget, headingOffset: finiteInteger(this.headingOffset, 0, 0, 6),
      escapeHtmlOption: normalizeMarkdownHtmlMode(this.htmlMode) === 'escape',
      trustedHtmlOption: normalizeMarkdownHtmlMode(this.htmlMode) === 'trusted',
      codeBlockHeaderOption: this.codeBlockHeader || this.codeBlockChrome,
      codeFrameNonce: this.codeBlockHeader || this.codeBlockChrome ? this.codeHeader.nonce : undefined, tabSize: finiteInteger(this.tabSize, 4, 1, 32),
      highlightCodeOption: this.highlightCode && !this.streaming,
      getCachedHighlight: (key) => this.getCachedHighlight(key), failedHighlightKeys: this.failedHighlightKeys,
      headingAnchorsOption: this.headingAnchors, mathOption: this.math,
      cachedKatex: this.math ? variant.katexState.getIfLoaded() : null,
    };
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
    const markers = this.progressiveSession ? this.renderedBlocks.length * 2 + 8 : 0;
    const scope = scopeFromElement(root, { maxTraversalNodes: TEXT_QUOTE_LIMITS.maxTraversalNodes + markers });
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
    if (this.highlights.length === 0) {
      this.highlightHandle?.release();
      this.highlightHandle = undefined;
      return;
    }
    if (this.streaming && this.progressiveSession && !supportsCustomHighlights(this.ownerDocument)) {
      this.highlightHandle?.release();
      this.highlightHandle = undefined;
      return;
    }
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
    if (this.codeHeader.handleClick(event)) return;
    const href = internalLinkHrefFrom(event, this.internalLinkPrefix);
    if (href !== null) event.preventDefault();
    const highlightId = hitTestHighlightRanges(
      this.resolvedHighlightRanges,
      event.clientX,
      event.clientY
    ) ?? keyboardHighlightIdFrom(this.resolvedHighlightRanges, event);
    if (highlightId) this.emit('lr-highlight-activate', { highlightId });
    if (href !== null) this.emit('lr-link-click', { href });
  };

  override render(): TemplateResult {
    const progressiveRendering =
      Boolean(this.progressiveSession && (this.streaming || this.progressiveAdopted));
    return renderMarkdownContent({
      content: this.content ?? '',
      sanitized: normalizeMarkdownHtmlMode(this.htmlMode) === 'sanitize',
      renderedHtml: this.renderedHtml,
      fallbackSegments: !progressiveRendering && this.renderedHtml === null
        ? this.fallbackCode.segments(this.content ?? '') : null,
      progressive: progressiveRendering ? { blocks: this.renderedBlocks, tail: this.streamingTail } : null,
      hostAriaLabel: this.getAttribute('aria-label'),
      isDarkTheme: this.isDarkTheme,
      onClick: this.onContentClick,
      liveRegion: this.renderAnchorLiveRegion(),
      maxHeight: this.maxHeight,
    });
  }
}
