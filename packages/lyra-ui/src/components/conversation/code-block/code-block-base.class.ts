import { reportCopyOutcome } from '../../../internal/record-copy-feedback.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import type { LyraHighlight, LyraAnchor, TextSelectRect } from '../../viewers/document-viewer/anchors.js';
import { SHIKI_SOURCE_MAX_CODE_UNITS, type ShikiHighlighter } from './shiki-types.js';
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
import { LYRA_DEFAULT_codeBlockActiveLine, LYRA_DEFAULT_codeBlockHighlightLimit, LYRA_DEFAULT_codeBlockHighlightedLine, LYRA_DEFAULT_codeBlockLineLabel, LYRA_DEFAULT_codeBlockToggle, LYRA_DEFAULT_codeRegion, LYRA_DEFAULT_codeRegionWithLanguage, LYRA_DEFAULT_copiedToClipboard, LYRA_DEFAULT_copyCode } from '../../../internal/default-strings/conversation.generated.js';
import { LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed } from '../../../internal/default-strings/shared.generated.js';
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
    codeBlockActiveLine: LYRA_DEFAULT_codeBlockActiveLine,
    codeBlockHighlightedLine: LYRA_DEFAULT_codeBlockHighlightedLine,
    codeBlockHighlightLimit: LYRA_DEFAULT_codeBlockHighlightLimit,
    codeBlockLineLabel: LYRA_DEFAULT_codeBlockLineLabel,
    codeBlockToggle: LYRA_DEFAULT_codeBlockToggle,
    codeRegion: LYRA_DEFAULT_codeRegion,
    codeRegionWithLanguage: LYRA_DEFAULT_codeRegionWithLanguage,
    copied: LYRA_DEFAULT_copied,
    copiedToClipboard: LYRA_DEFAULT_copiedToClipboard,
    copy: LYRA_DEFAULT_copy,
    copyCode: LYRA_DEFAULT_copyCode,
    copyFailed: LYRA_DEFAULT_copyFailed,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze(['lr-text-select']);

  abstract code: string;
  abstract language: string;
  abstract filename: string;
  abstract accessibleLabel: string | null;
  abstract collapsible: boolean;
  abstract withoutCopyButton: boolean;
  abstract copyAppearance: LyraCodeBlockCopyAppearance;
  abstract maxHeight: string;
  abstract lineNumbers: boolean;
  abstract highlightLines: string;
  abstract activatableLines: boolean;
  abstract get highlights(): readonly LyraHighlight[];
  abstract set highlights(value: readonly LyraHighlight[]);
  abstract activeHighlightId: string | null;

  private readonly collapseWrites = new VetoWriteGuard();
  private collapsedValue = false;

  /** Whether the code region is currently hidden. Only has a visible effect
   *  while `collapsible` is also true.
   *  @default false */
  @property({ type: Boolean, reflect: true })
  get collapsed(): boolean { return this.collapsedValue; }
  set collapsed(value: boolean) {
    this.collapsedValue = value;
    markVetoGuardWrite(this.collapseWrites);
  }

  @state() protected hasHeaderActions = false;
  protected focusedLine = 1;
  @state() protected highlightedHtml: string | null = null;
  @state() protected shikiReady = false;
  @state() protected justCopied = false;
  @state() protected copyFailed = false;
  @state() protected isDarkTheme = false;

  protected restoreFocusedLineAfterUpdate = false;
  protected highlightToken = 0;
  private plainTemplate?: TemplateResult;
  private plainKey: readonly unknown[] = [];
  private countedCode?: string;
  private countedLines = 1;
  private paintedCode?: Element | null;
  private plainDomChanged = false;
  private paintedLines = new Map<number, HTMLElement>();
  private previousHighlighted = new Set<number>();
  private previousActive = new Set<number>();

  protected get highlightLimited(): boolean {
    return (this.code ?? '').length > SHIKI_SOURCE_MAX_CODE_UNITS;
  }
  protected readonly bodyId = nextId('code-block-body');

  protected resumedMove = false;
  private readonly teardown = new DeferredTeardown(() => this.releaseHighlight());
  private readonly announcements = new AnnouncementSinkController(this);

  protected readonly interactions = new CodeBlockInteractionController({
    host: this,
    setFocusedLine: (line) => { this.focusedLine = line; },
    setJustCopied: (value) => { this.justCopied = value; },
    setCopyFailed: (value) => { this.copyFailed = value; },
    setDarkTheme: (value) => { this.isDarkTheme = value; },
    emitLineActivate: (line) => this.emit('lr-line-activate', { line }),
    reportCopy: outcome => reportCopyOutcome({
      emit: (name, detail) => this.emit(name, detail ?? null),
      announce: ok => this.announcements.announcePolite(ok ? this.localize('copiedToClipboard') : this.localize('copyFailed')),
    }, outcome, () => this.isConnected && (this.code ?? '') === outcome.text),
    emitTextSelect: (selection) => this.emit('lr-text-select', selection),
  });

  private readonly headerActions = new CodeBlockHeaderActionsController({
    host: this,
    setHasHeaderActions: (value) => { this.hasHeaderActions = value; },
  });

  constructor() {
    super();
    new ThemeWatcher(this, () => this.refreshTheme());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.refreshTheme();
    this.headerActions.observe();
    this.resumedMove = this.teardown.cancel();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardown.schedule();
    this.headerActions.disconnect();
    this.interactions.disconnect();
  }

  protected releaseHighlight(): void {
    this.highlightToken++;
    this.highlightedHtml = null;
  }

  override adoptedCallback(): void {
    this.teardown.flush();
    super.adoptedCallback();
    this.announcements.adopted();
    this.interactions.disconnect();
  }

  private readonly toggleCollapsed = (): void => {
    if (!this.isConnected || !this.collapsible) return;
    const expanded = this.collapsed;
    requestThenCommit({
      guard: this.collapseWrites,
      requestDetail: { expanded },
      emitRequest: (detail, init: { cancelable: true }) => this.emit('lr-toggle-request', detail, init),
      commit: () => {
        if (!this.isConnected || !this.collapsible) return;
        this.collapsed = !expanded;
        this.emit('lr-toggle', { expanded });
      },
    });
  };

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
    this.announcements.setExclusiveChannel(this.withoutCopyButton ? undefined : 'polite');
    this.seedFirstRenderState(() => this.refreshTheme());
    this.headerActions.sync();
    this.restoreFocusedLineAfterUpdate = codeBlockLineHasFocus(this);
    if (changed.has('code')) {
      this.plainTemplate = undefined;
      this.plainKey = [];
      this.focusedLine = clampCodeBlockFocusedLine(this.focusedLine, this.lineCount());
    }
    this.beforeHighlightUpdate(changed);
    if (!this.interactions.needsHighlightResync(
      changed,
      this.effectiveLocale,
      this.localize('codeBlockLineLabel'),
    )) return;
    if (this.highlightLimited) {
      this.highlightToken++;
      this.highlightedHtml = null;
    } else if (this.shikiReady || this.hasPreSuppliedGrammar()) this.syncHighlight();
    else this.highlightedHtml = null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    applyCodeBlockAriaBusy(this, !this.highlightLimited && this.showsSkeleton());
    this.patchLineState();
    this.interactions.syncLineButtons(this.focusedLine, this.plainDomChanged);
    this.plainDomChanged = false;
    if (this.restoreFocusedLineAfterUpdate) {
      restoreCodeBlockLineFocus(this, this.focusedLine);
      this.restoreFocusedLineAfterUpdate = false;
    }
  }

  protected beforeHighlightUpdate(_changed: PropertyValues): void {}
  protected abstract preSuppliedGrammar(): unknown;
  /** Whether the active language has an explicitly supplied grammar or loader. */
  protected hasPreSuppliedGrammar(): boolean { return Boolean(this.preSuppliedGrammar()); }
  protected abstract syncHighlight(): void;
  protected abstract showsSkeleton(): boolean;

  protected lineHighlightSet(): Set<number> {
    return codeBlockLineHighlightSet(this.highlightLines ?? '', this.highlights, this.lineCount());
  }

  protected activeHighlightLineSet(): Set<number> {
    return codeBlockActiveHighlightLineSet(this.highlights, this.activeHighlightId, this.lineCount());
  }

  protected lineCount(): number {
    const code = this.code ?? '';
    if (code !== this.countedCode) {
      this.countedCode = code;
      this.countedLines = codeBlockLineCount(code);
    }
    return this.countedLines;
  }

  protected tokenize(hl: ShikiHighlighter, lang: string): string | null {
    if (this.highlightLimited) return null;
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

  private patchLineState(): void {
    const code = this.renderRoot.querySelector('code');
    if (code !== this.paintedCode || this.plainDomChanged) {
      this.paintedCode = code;
      this.paintedLines.clear();
      for (const line of code?.querySelectorAll<HTMLElement>('.line[data-line]') ?? []) {
        // A cached plain template can remount attributes from an earlier highlight selection.
        line.removeAttribute('data-highlighted');
        line.removeAttribute('data-active');
        // Test DOMs such as Happy DOM have no `Element.part`; parts only matter where CSS renders.
        line.part?.remove('line-highlight');
        this.paintedLines.set(Number(line.dataset['line']), line);
      }
    }
    const highlighted = this.lineHighlightSet();
    const active = this.activeHighlightLineSet();
    const changed = new Set([...this.previousHighlighted, ...highlighted, ...this.previousActive, ...active]);
    for (const number of changed) {
      const line = this.paintedLines.get(number);
      if (!line) continue;
      line.toggleAttribute('data-highlighted', highlighted.has(number));
      line.toggleAttribute('data-active', active.has(number));
      line.part?.toggle('line-highlight', highlighted.has(number));
      const gutter = line.querySelector('button.line-gutter');
      if (highlighted.has(number)) {
        const description = active.has(number) ? this.localize('codeBlockActiveLine') : this.localize('codeBlockHighlightedLine');
        line.setAttribute('role', 'mark');
        line.setAttribute('aria-roledescription', description);
        gutter?.setAttribute('aria-description', description);
      } else {
        line.removeAttribute('role');
        line.removeAttribute('aria-roledescription');
        gutter?.removeAttribute('aria-description');
      }
    }
    this.previousHighlighted = highlighted;
    this.previousActive = active;
  }

  private cachedPlainCode(): TemplateResult {
    const key = [this.code, this.lineNumbers, this.activatableLines, this.effectiveLocale, this.localize('codeBlockLineLabel')];
    if (!this.plainTemplate || key.some((value, index) => value !== this.plainKey[index])) {
      this.plainDomChanged = true;
      this.plainKey = key;
      this.plainTemplate = this.renderPlainCode();
    }
    return this.plainTemplate;
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
      showSkeleton: !this.highlightLimited && this.showsSkeleton(),
      highlightLimited: this.highlightLimited && !!this.language,
      highlightedHtml: this.highlightedHtml,
      lineNumbers: this.lineNumbers,
      localize: this.localize.bind(this),
      renderPlainCode: () => this.cachedPlainCode(),
      onToggle: this.toggleCollapsed,
      onCopy: () => void this.interactions.copy(),
      onBodyMouseUp: this.interactions.onBodyMouseUp,
      onBodyClick: this.interactions.onBodyClick,
      onBodyKeyDown: this.interactions.onBodyKeyDown,
      onBodyFocusIn: this.interactions.onBodyFocusIn,
    });
  }
}
