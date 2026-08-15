import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { styles } from './commit-card.styles.js';
import type { GitStatus } from '../../data/file-tree/file-tree.class.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { overallSemanticLabel, overallSemanticRole } from '../semantic-owner.js';
import { firstByIdentity } from '../collection-identity.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_commitCardCopyHash, LYRA_DEFAULT_commitCardDiffSummary, LYRA_DEFAULT_commitCardHideFiles, LYRA_DEFAULT_commitCardLabel, LYRA_DEFAULT_commitCardShowFiles, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_details, LYRA_DEFAULT_gitStatusAdded, LYRA_DEFAULT_gitStatusConflicted, LYRA_DEFAULT_gitStatusDeleted, LYRA_DEFAULT_gitStatusIgnored, LYRA_DEFAULT_gitStatusModified, LYRA_DEFAULT_gitStatusRenamed, LYRA_DEFAULT_gitStatusUntracked, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Visual chrome for `<lr-commit-card>`'s root — the library's shared container-frame vocabulary. */
export type CommitCardAppearance = LyraFrame;

export interface CommitFileChange {
  path: string;
  /** Normalized to a finite non-negative integer before display and aggregate arithmetic. */
  additions: number;
  /** Normalized to a finite non-negative integer before display and aggregate arithmetic. */
  deletions: number;
  status?: GitStatus;
}

const GIT_STATUS_LETTER: Partial<Record<GitStatus, string>> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
  conflicted: 'C',
  ignored: '!',
};

const MAX_DATE_EPOCH_MS = 8_640_000_000_000_000;

/** The letters above are terse visual shorthand with no meaning to a screen reader, so each one
 *  also carries a localized expansion as its accessible name. Reuses `<lr-file-tree>`'s shared
 *  `gitStatus*` keys (the same `GitStatus` vocabulary) rather than minting commit-card-specific
 *  ones, so one `registerLyraLocale()` registration covers both components. */
const GIT_STATUS_KEY: Record<GitStatus, string> = {
  added: 'gitStatusAdded',
  modified: 'gitStatusModified',
  deleted: 'gitStatusDeleted',
  renamed: 'gitStatusRenamed',
  untracked: 'gitStatusUntracked',
  conflicted: 'gitStatusConflicted',
  ignored: 'gitStatusIgnored',
};

export interface LyraCommitCardEventMap {
  'lr-file-select': CustomEvent<{ filePath: string }>;
  'lr-toggle': CustomEvent<{ collapsed: boolean }>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
}

/**
 * `<lr-commit-card>` — compact commit summary (subject, author/time, diffstat, per-file changes)
 * that links file rows out to a diff view. Set `compact` (tighter padding) and/or
 * `frame="plain"` (no border/padding at all) when embedding one as a row in a commit list or
 * PR timeline, so the built-in card chrome doesn't double up against the list's own — same
 * convention as `<lr-agent-run>`'s own `compact`/`frame`.
 * Duplicate file paths normalize before totals, counts, rendering, and selection events; the
 * first occurrence wins. File addition/deletion counts are normalized to finite non-negative integers before totals,
 * localized display, and accessible summaries are derived.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-commit-card
 * @event lr-file-select - `detail: { filePath }` — a file row was activated.
 * @event lr-toggle - `detail: { collapsed }` — the file-list fold changed.
 * @event lr-copy - `detail: { ok: true, text }` — the full-hash clipboard write completed.
 * @event lr-error - The clipboard write failed; generic no-detail notification.
 * @event lr-copy-error - `detail: { ok: false, text, reason, error }` — typed clipboard failure.
 * @slot actions - Trailing header controls (e.g. an "open PR" button).
 * @csspart base - The root wrapper.
 * @csspart subject - The commit message's first line.
 * @csspart body - The commit message's remaining lines.
 * @csspart hash - The abbreviated hash text.
 * @csspart meta - The author/time/diffstat row.
 * @csspart author - The author text.
 * @csspart time - The `<time>` wrapper.
 * @csspart diffstat - The aggregate `+N -M` summary.
 * @csspart additions - The additions count.
 * @csspart deletions - The deletions count.
 * @csspart files-toggle - The file-list fold toggle.
 * @csspart file - A file row; carries `data-status`.
 * @csspart file-path - A file row's path text.
 * @csspart file-status - The one-letter git-status badge inside `[part="file-path"]`, present only
 *   when that file has a `status`. Carries the localized expansion (`Modified`, `Added`, ...) as its
 *   accessible name, so the bare letter never reaches assistive tech on its own.
 * @csspart file-additions - A file row's additions count.
 * @csspart file-deletions - A file row's deletions count.
 * @csspart copy-button - The hash copy button.
 * @csspart actions - The `actions` slot wrapper.
 * @cssprop [--lr-commit-card-compact-padding=var(--lr-space-s)] - `[part="base"]` padding while
 *   `compact`.
 * @status stable
 * @since 4.0.0
 */
export class LyraCommitCard extends LyraElement<LyraCommitCardEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    commitCardCopyHash: LYRA_DEFAULT_commitCardCopyHash,
    commitCardDiffSummary: LYRA_DEFAULT_commitCardDiffSummary,
    commitCardHideFiles: LYRA_DEFAULT_commitCardHideFiles,
    commitCardLabel: LYRA_DEFAULT_commitCardLabel,
    commitCardShowFiles: LYRA_DEFAULT_commitCardShowFiles,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    details: LYRA_DEFAULT_details,
    gitStatusAdded: LYRA_DEFAULT_gitStatusAdded,
    gitStatusConflicted: LYRA_DEFAULT_gitStatusConflicted,
    gitStatusDeleted: LYRA_DEFAULT_gitStatusDeleted,
    gitStatusIgnored: LYRA_DEFAULT_gitStatusIgnored,
    gitStatusModified: LYRA_DEFAULT_gitStatusModified,
    gitStatusRenamed: LYRA_DEFAULT_gitStatusRenamed,
    gitStatusUntracked: LYRA_DEFAULT_gitStatusUntracked,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['files']);

  static override styles = [LyraElement.styles, styles];

  @property() hash = '';
  @property() message = '';
  @property() author = '';
  @property({ type: Number, attribute: false }) timestamp?: number;
  /** File changes keyed by path. Empty/blank paths are omitted and duplicates normalize
   *  first-wins before diffstat and events. */
  @property({ attribute: false }) files: readonly CommitFileChange[] = [];
  /** Whether the per-file list is shown. Defaults to `false` (collapsed), matching the
   *  positive-polarity `expanded` convention every sibling component uses. */
  @property({ type: Boolean, attribute: 'files-expanded', reflect: true }) filesExpanded = false;
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) copyable = true;

  /** Tighter root padding for dense contexts (a commit rendered as a row in a list or PR
   *  timeline) -- same convention as `<lr-agent-run>`'s own `compact`. Defaults to `false`, i.e.
   *  the full card padding. Purely a density knob: the border stays, so use `frame="plain"`
   *  instead to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Visual chrome, in the library's shared container-frame vocabulary (the same `frame` property
   *  `<lr-agent-run>` carries). `'card'` (the default) keeps the bordered, padded box. `'plain'`
   *  removes the border, padding and corner radius, so a commit nested inside a host list that
   *  already draws its own row chrome doesn't double it. `plain` wins over `compact` when both are
   *  set (nothing left to tighten). */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  @state() private copyStatus: 'rest' | 'success' | 'error' = 'rest';
  private copyTimer?: { owner: Window; handle: number; generation: number };
  private copyGeneration = 0;

  private get normalizedFiles(): CommitFileChange[] {
    return firstByIdentity(Array.isArray(this.files) ? this.files : [], (file) => file.path);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetCopyFeedback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Adoption can occur while already disconnected, so retire the exact window that owns the
    // timer even when no further disconnected callback is delivered.
    this.resetCopyFeedback();
  }

  private cancelCopyTimer(): void {
    const timer = this.copyTimer;
    this.copyTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  private resetCopyFeedback(): void {
    this.copyGeneration += 1;
    this.cancelCopyTimer();
    this.copyStatus = 'rest';
  }

  private get subject(): string {
    return this.message.split('\n')[0] ?? '';
  }

  private get body(): string {
    return this.message.split('\n').slice(1).join('\n').trim();
  }

  /** `timestamp` normalized to a finite, non-negative epoch-ms value -- `undefined` while unset or
   *  non-finite. Commit times are never before the epoch, so unlike a general-purpose timestamp,
   *  a negative value is clamped to 0 rather than accepted as-is; more importantly, guarding
   *  non-finite here matters because `new Date(NaN).toISOString()` *throws* (not just an "Invalid
   *  Date" render) inside the `<time datetime>` binding below. */
  private get validTimestamp(): number | undefined {
    if (
      this.timestamp == null ||
      !Number.isFinite(this.timestamp) ||
      this.timestamp > MAX_DATE_EPOCH_MS
    ) {
      return undefined;
    }
    return finiteRange(this.timestamp, this.timestamp, 0);
  }

  private get totals(): { additions: number; deletions: number } {
    return this.normalizedFiles.reduce(
      (acc, file) => ({
        additions: finiteCount(acc.additions + finiteCount(file.additions)),
        deletions: finiteCount(acc.deletions + finiteCount(file.deletions)),
      }),
      { additions: 0, deletions: 0 },
    );
  }

  private onCopy = (): void => {
    void this.copyHash();
  };

  private async copyHash(): Promise<void> {
    const text = this.hash;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const generation = ++this.copyGeneration;
    this.cancelCopyTimer();
    this.copyStatus = 'rest';
    const outcome = await writeClipboardText(owner, text);
    if (!owner || !this.isCurrentCopy(generation, owner)) return;
    if (!outcome.ok) {
      this.showCopyStatus('error', generation, owner);
      this.emit('lr-error');
      this.emit('lr-copy-error', outcome);
      return;
    }
    this.showCopyStatus('success', generation, owner);
    this.emit('lr-copy', outcome);
  }

  private isCurrentCopy(generation: number, owner: Window): boolean {
    return this.isConnected
      && generation === this.copyGeneration
      && this.ownerDocument.defaultView === owner;
  }

  private showCopyStatus(status: 'success' | 'error', generation: number, owner: Window): void {
    this.copyStatus = status;
    this.cancelCopyTimer();
    let handle = 0;
    handle = owner.setTimeout(() => {
      if (
        this.copyTimer?.owner !== owner
        || this.copyTimer.handle !== handle
        || this.copyTimer.generation !== generation
        || generation !== this.copyGeneration
        || !this.isConnected
        || this.ownerDocument.defaultView !== owner
      ) return;
      this.copyTimer = undefined;
      this.copyStatus = 'rest';
    }, 1500);
    this.copyTimer = { owner, handle, generation };
  }

  private toggleFiles = (): void => {
    this.filesExpanded = !this.filesExpanded;
    this.emit('lr-toggle', { collapsed: !this.filesExpanded });
  };

  override render(): TemplateResult {
    const files = this.normalizedFiles;
    const { additions, deletions } = this.totals;
    const timestamp = this.validTimestamp;
    return html`
      <div
        part="base"
        role=${overallSemanticRole(this, 'group') ?? nothing}
        aria-label=${overallSemanticLabel(this, this.localize('commitCardLabel')) ?? nothing}
      >
        <div part="subject">${this.subject}</div>
        ${this.body ? html`<div part="body">${this.body}</div>` : nothing}
        <div part="meta">
          ${this.hash ? html`<span part="hash" dir="ltr">${this.hash.slice(0, 7)}</span>` : nothing}
          ${this.author ? html`<span part="author">${this.author}</span>` : nothing}
          ${timestamp !== undefined
            ? html`<span part="time"
                ><time datetime=${new Date(timestamp).toISOString()}
                  >${getDateTimeFormat(this.effectiveLocale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(timestamp))}</time
                ></span
              >`
            : nothing}
          ${files.length > 0
            ? html`<span
                part="diffstat"
                aria-label=${this.localize('commitCardDiffSummary', undefined, {
                  additions: this.formatCount(additions),
                  deletions: this.formatCount(deletions),
                  files: this.formatCount(files.length),
                })}
              >
                <span part="additions">+${this.formatCount(additions)}</span> <span part="deletions">-${this.formatCount(deletions)}</span>
              </span>`
            : nothing}
          ${this.copyable && this.hash
            ? html`<button
                part="copy-button"
                type="button"
                data-copy-status=${this.copyStatus}
                aria-label=${this.copyStatus === 'success'
                  ? this.localize('copied')
                  : this.copyStatus === 'error'
                    ? this.localize('copyFailed')
                    : this.localize('commitCardCopyHash')}
                @click=${this.onCopy}
              >
                ${this.copyStatus === 'success'
                  ? this.localize('copied')
                  : this.copyStatus === 'error'
                    ? this.localize('copyFailed')
                    : this.localize('copy')}
              </button>`
            : nothing}
          <slot name="actions" part="actions"></slot>
        </div>
        ${files.length > 0
          ? html`
              <button
                part="files-toggle"
                type="button"
                aria-expanded=${this.filesExpanded ? 'true' : 'false'}
                @click=${this.toggleFiles}
              >
                ${this.filesExpanded
                  ? this.localize('commitCardHideFiles', undefined, { count: this.formatCount(files.length) })
                  : this.localize('commitCardShowFiles', undefined, { count: this.formatCount(files.length) })}
              </button>
              ${this.filesExpanded
                ? files.map((f) => {
                    const additions = finiteCount(f.additions);
                    const deletions = finiteCount(f.deletions);
                    return html`
                      <button
                        part="file"
                        type="button"
                        data-status=${f.status ?? nothing}
                        @click=${() => this.emit('lr-file-select', { filePath: f.path })}
                      >
                        <span part="file-path" dir="ltr"
                          >${f.status
                            ? html`<span part="file-status" aria-label=${this.localize(GIT_STATUS_KEY[f.status])}
                                  >${GIT_STATUS_LETTER[f.status]}</span
                                > `
                            : ''}${f.path}</span
                        >
                        <span class="file-stats">
                          <span part="file-additions">+${this.formatCount(additions)}</span>
                          <span part="file-deletions">-${this.formatCount(deletions)}</span>
                        </span>
                      </button>
                    `;
                  })
                : nothing}
            `
          : nothing}
      </div>
    `;
  }
  /** `localize()` interpolates with a bare `String(value)`, so a number handed to it renders in
   *  ASCII digits no matter the locale -- mixing two numbering systems inside one translated
   *  sentence. Route every user-facing number through the effective locale instead. */
  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-commit-card': LyraCommitCard;
  }

}
