import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './commit-card.styles.js';
import type { GitStatus } from '../../data/file-tree/file-tree.class.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

/** Visual chrome for `<lr-commit-card>`'s root — the library's shared container-frame vocabulary. */
export type CommitCardAppearance = LyraFrame;

export interface CommitFileChange {
  path: string;
  additions: number;
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
  'lr-file-select': CustomEvent<{ path: string }>;
  'lr-toggle': CustomEvent<{ collapsed: boolean }>;
  'lr-copy': CustomEvent<{ text: string }>;
}

/**
 * `<lr-commit-card>` — compact commit summary (subject, author/time, diffstat, per-file changes)
 * that links file rows out to a diff view. Set `compact` (tighter padding) and/or
 * `frame="plain"` (no border/padding at all) when embedding one as a row in a commit list or
 * PR timeline, so the built-in card chrome doesn't double up against the list's own — same
 * convention as `<lr-agent-run>`'s own `compact`/`frame`.
 *
 * @customElement lr-commit-card
 * @event lr-file-select - `detail: { path }` — a file row was activated.
 * @event lr-toggle - `detail: { collapsed }` — the file-list fold changed.
 * @event lr-copy - `detail: { text }` — the full hash was copied.
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
 */
export class LyraCommitCard extends LyraElement<LyraCommitCardEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property() hash = '';
  @property() message = '';
  @property() author = '';
  @property({ type: Number, attribute: false }) timestamp?: number;
  @property({ attribute: false }) files: CommitFileChange[] = [];
  @property({ type: Boolean, attribute: 'files-collapsed', reflect: true, converter: trueDefaultBooleanConverter })
  filesCollapsed = true;
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

  @state() private justCopied = false;
  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = undefined;
    this.justCopied = false;
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
    return this.files.reduce(
      (acc, f) => ({ additions: acc.additions + f.additions, deletions: acc.deletions + f.deletions }),
      { additions: 0, deletions: 0 },
    );
  }

  private onCopy = (): void => {
    try {
      // navigator.clipboard is absent in insecure contexts / older browsers, and some engines
      // throw synchronously rather than rejecting -- either way this is best-effort; lr-copy
      // still fires with the intended text regardless.
      void navigator.clipboard?.writeText(this.hash)?.catch(() => {});
    } catch {
      // see above
    }
    this.emit('lr-copy', { text: this.hash });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, 1500);
  };

  private toggleFiles = (): void => {
    this.filesCollapsed = !this.filesCollapsed;
    this.emit('lr-toggle', { collapsed: this.filesCollapsed });
  };

  override render(): TemplateResult {
    const { additions, deletions } = this.totals;
    const timestamp = this.validTimestamp;
    return html`
      <div part="base" role="group" aria-label=${this.getAttribute('aria-label') || this.localize('commitCardLabel')}>
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
          ${this.files.length > 0
            ? html`<span
                part="diffstat"
                aria-label=${this.localize('commitCardDiffSummary', undefined, {
                  additions,
                  deletions,
                  files: this.formatCount(this.files.length),
                })}
              >
                <span part="additions">+${additions}</span> <span part="deletions">-${deletions}</span>
              </span>`
            : nothing}
          ${this.copyable && this.hash
            ? html`<button
                part="copy-button"
                type="button"
                aria-label=${this.justCopied ? this.localize('copied') : this.localize('commitCardCopyHash')}
                @click=${this.onCopy}
              >
                ${this.justCopied ? this.localize('copied') : this.localize('copy')}
              </button>`
            : nothing}
          <slot name="actions" part="actions"></slot>
        </div>
        ${this.files.length > 0
          ? html`
              <button
                part="files-toggle"
                type="button"
                aria-expanded=${this.filesCollapsed ? 'false' : 'true'}
                @click=${this.toggleFiles}
              >
                ${this.filesCollapsed
                  ? this.localize('commitCardShowFiles', undefined, { count: this.formatCount(this.files.length) })
                  : this.localize('commitCardHideFiles', undefined, { count: this.formatCount(this.files.length) })}
              </button>
              ${!this.filesCollapsed
                ? this.files.map(
                    (f) => html`
                      <button
                        part="file"
                        type="button"
                        data-status=${f.status ?? nothing}
                        @click=${() => this.emit('lr-file-select', { path: f.path })}
                      >
                        <span part="file-path" dir="ltr"
                          >${f.status
                            ? html`<span part="file-status" aria-label=${this.localize(GIT_STATUS_KEY[f.status])}
                                  >${GIT_STATUS_LETTER[f.status]}</span
                                > `
                            : ''}${f.path}</span
                        >
                        <span class="file-stats">
                          <span part="file-additions">+${f.additions}</span>
                          <span part="file-deletions">-${f.deletions}</span>
                        </span>
                      </button>
                    `,
                  )
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
