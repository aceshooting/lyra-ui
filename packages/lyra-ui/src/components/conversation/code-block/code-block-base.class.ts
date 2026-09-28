import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { type PropertyValues, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import type { LyraHighlight, LyraAnchor, TextSelectRect } from '../../viewers/document-viewer/anchors.js';
import type { ShikiHighlighter } from './shiki-types.js';
import {
  CodeBlockHeaderActionsController,
  CodeBlockInteractionController,
  applyCodeBlockAriaBusy,
  clampCodeBlockFocusedLine,
  codeBlockActiveHighlightLineSet,
  codeBlockLineHasFocus,
  codeBlockLineCount,
  codeBlockLineHighlightSet,
  renderCodeBlockPlainCode,
  renderCodeBlockShell,
  restoreCodeBlockLineFocus,
  scrollCodeBlockToAnchor,
  tokenizeCodeBlock,
} from './code-block-shared.js';
import type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../../../internal/clipboard.js';
import type { LyraCodeBlockCopyAppearance, LyraCodeBlockToggleDetail } from './code-block-shared.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_codeBlockLineLabel, LYRA_DEFAULT_codeRegion, LYRA_DEFAULT_codeRegionWithLanguage, LYRA_DEFAULT_collapseCode, LYRA_DEFAULT_copied, LYRA_DEFAULT_copiedToClipboard, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyCode, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_expandCode } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END



/** Shared event contract retained by both public event-map names. */
export interface LyraCodeBlockBaseEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-toggle-request': CustomEvent<LyraCodeBlockToggleDetail>;
  'lr-toggle': CustomEvent<LyraCodeBlockToggleDetail>;
  'lr-line-activate': CustomEvent<{ line: number }>;
  'lr-text-select': CustomEvent<{
    readonly text: string;
    readonly anchor: LyraAnchor;
    readonly rects: readonly TextSelectRect[];
  }>;
}

/** Owns the shared behavior and template for the regular and build-lean code blocks.
 *  Subclasses supply their optional-peer loading policy and retain decorated public properties. */
export abstract class LyraCodeBlockBase extends LyraElement<LyraCodeBlockBaseEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    codeBlockLineLabel: LYRA_DEFAULT_codeBlockLineLabel,
    codeRegion: LYRA_DEFAULT_codeRegion,
    codeRegionWithLanguage: LYRA_DEFAULT_codeRegionWithLanguage,
    collapseCode: LYRA_DEFAULT_collapseCode,
    copied: LYRA_DEFAULT_copied,
    copiedToClipboard: LYRA_DEFAULT_copiedToClipboard,
    copy: LYRA_DEFAULT_copy,
    copyCode: LYRA_DEFAULT_copyCode,
    copyFailed: LYRA_DEFAULT_copyFailed,
    expandCode: LYRA_DEFAULT_expandCode,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze(['lr-text-select']);

  abstract code: string;
  abstract language: string;
  abstract filename: string;
  abstract accessibleLabel: string | null;
  abstract collapsible: boolean;
  abstract collapsed: boolean;
  abstract withoutCopyButton: boolean;
  abstract copyAppearance: LyraCodeBlockCopyAppearance;
  abstract maxHeight: string;
  abstract lineNumbers: boolean;
  abstract highlightLines: string;
  abstract activatableLines: boolean;
  abstract get highlights(): readonly LyraHighlight[];
  abstract set highlights(value: readonly LyraHighlight[]);
  abstract activeHighlightId: string | null;

  @state() protected hasHeaderActions = false;
  @state() protected focusedLine = 1;
  @state() protected highlightedHtml: string | null = null;
  @state() protected shikiReady = false;
  @state() protected justCopied = false;
  @state() protected copyFailed = false;
  @state() protected isDarkTheme = false;

  protected restoreFocusedLineAfterUpdate = false;
  protected highlightToken = 0;
  protected readonly bodyId = nextId('code-block-body');

  protected readonly interactions = new CodeBlockInteractionController({
    host: this,
    setFocusedLine: (line) => { this.focusedLine = line; },
    setJustCopied: (value) => { this.justCopied = value; },
    setCopyFailed: (value) => { this.copyFailed = value; },
    setDarkTheme: (value) => { this.isDarkTheme = value; },
    emitLineActivate: (line) => this.emit('lr-line-activate', { line }),
    emitCopy: (outcome) => this.emit('lr-copy', outcome),
    emitError: () => this.emit('lr-error', null),
    emitCopyError: (outcome) => this.emit('lr-copy-error', outcome),
    requestToggle: (collapsed) =>
      !this.emit('lr-toggle-request', { expanded: !collapsed, collapsed }, { cancelable: true })
        .defaultPrevented,
    emitToggle: (collapsed) => this.emit('lr-toggle', { expanded: !collapsed, collapsed }),
    emitTextSelect: (selection) => this.emit('lr-text-select', selection),
  });

  protected readonly headerActions = new CodeBlockHeaderActionsController({
    host: this,
    setHasHeaderActions: (value) => { this.hasHeaderActions = value; },
  });

  constructor() {
    super();
    new ThemeWatcher(this, () => this.refreshTheme());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.refreshTheme();
    this.headerActions.observe();
  }

  override disconnectedCallback(): void {
    this.highlightToken += 1;
    super.disconnectedCallback();
    this.headerActions.disconnect();
    this.interactions.disconnect();
    this.highlightedHtml = null;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.interactions.disconnect();
  }

  /** Resolves a `line-range` anchor (or a highlights id resolving to one) by scrolling the code
   *  body. */
  async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    return scrollCodeBlockToAnchor(this, target);
  }

  /** Recomputes Shiki palette selection after an imperative CSSOM theme change. */
  refreshTheme(): void {
    this.interactions.refreshTheme();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.headerActions.sync();
    this.restoreFocusedLineAfterUpdate = codeBlockLineHasFocus(this);
    if (changed.has('code')) {
      this.focusedLine = clampCodeBlockFocusedLine(this.focusedLine, this.lineCount());
    }
    this.beforeHighlightUpdate(changed);
    if (!this.interactions.needsHighlightResync(
      changed,
      this.effectiveLocale,
      this.localize('codeBlockLineLabel'),
    )) return;
    if (this.shikiReady || this.preSuppliedGrammar()) this.syncHighlight();
    else this.highlightedHtml = null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    applyCodeBlockAriaBusy(this, this.showsSkeleton());
    if (this.restoreFocusedLineAfterUpdate) {
      restoreCodeBlockLineFocus(this, this.focusedLine);
      this.restoreFocusedLineAfterUpdate = false;
    }
  }

  protected beforeHighlightUpdate(_changed: PropertyValues): void {}
  protected abstract preSuppliedGrammar(): unknown;
  protected abstract syncHighlight(): void;
  protected abstract showsSkeleton(): boolean;

  protected lineHighlightSet(): Set<number> {
    return codeBlockLineHighlightSet(this.highlightLines ?? '', this.highlights, this.lineCount());
  }

  protected activeHighlightLineSet(): Set<number> {
    return codeBlockActiveHighlightLineSet(this.highlights, this.activeHighlightId, this.lineCount());
  }

  protected lineCount(): number {
    return codeBlockLineCount(this.code ?? '');
  }

  protected tokenize(hl: ShikiHighlighter, lang: string): string | null {
    return tokenizeCodeBlock(hl, {
      code: this.code ?? '',
      lang,
      lineNumbers: this.lineNumbers,
      activatableLines: this.activatableLines,
      focusedLine: this.focusedLine,
      highlightedLines: this.lineHighlightSet(),
      activeLines: this.activeHighlightLineSet(),
      lineLabel: (line) => this.localize('codeBlockLineLabel', undefined, {
        line: getNumberFormat(this.effectiveLocale).format(line),
      }),
      lineNumberText: (line) => getNumberFormat(this.effectiveLocale).format(line),
    });
  }

  protected renderPlainCode(): TemplateResult {
    return renderCodeBlockPlainCode({
      code: this.code ?? '',
      lineNumbers: this.lineNumbers,
      activatableLines: this.activatableLines,
      focusedLine: this.focusedLine,
      highlightedLines: this.lineHighlightSet(),
      activeLines: this.activeHighlightLineSet(),
      localize: this.localize.bind(this),
      lineLabel: (line) => this.localize('codeBlockLineLabel', undefined, {
        line: getNumberFormat(this.effectiveLocale).format(line),
      }),
      lineNumberText: (line) => getNumberFormat(this.effectiveLocale).format(line),
      onLineActivate: (line) => this.interactions.onLineActivate(line),
      onLineKeyDown: (event, line) => this.interactions.onLineKeyDown(event, line),
    });
  }

  override render(): TemplateResult {
    return renderCodeBlockShell({
      filename: this.filename,
      language: this.language,
      copyable: !this.withoutCopyButton,
      copyAppearance: this.copyAppearance,
      hasHeaderActions: this.hasHeaderActions,
      collapsible: this.collapsible,
      collapsed: this.collapsed,
      justCopied: this.justCopied,
      copyFailed: this.copyFailed,
      bodyId: this.bodyId,
      accessibleLabel: this.accessibleLabel,
      maxHeight: this.maxHeight,
      isDarkTheme: this.isDarkTheme,
      showSkeleton: this.showsSkeleton(),
      highlightedHtml: this.highlightedHtml,
      lineNumbers: this.lineNumbers,
      localize: this.localize.bind(this),
      renderPlainCode: () => this.renderPlainCode(),
      onToggle: this.interactions.toggleCollapsed,
      onCopy: this.interactions.copy,
      onBodyMouseUp: this.interactions.onBodyMouseUp,
      onBodyClick: this.interactions.onBodyClick,
      onBodyKeyDown: this.interactions.onBodyKeyDown,
      onBodyFocusIn: this.interactions.onBodyFocusIn,
    });
  }
}
