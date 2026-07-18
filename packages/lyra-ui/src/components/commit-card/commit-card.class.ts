import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteRange } from '../../internal/numbers.js';
import { styles } from './commit-card.styles.js';
import type { GitStatus } from '../file-tree/file-tree.class.js';

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

export interface LyraCommitCardEventMap {
  'lyra-file-select': CustomEvent<{ path: string }>;
  'lyra-toggle': CustomEvent<{ collapsed: boolean }>;
  'lyra-copy': CustomEvent<{ text: string }>;
}

/**
 * `<lyra-commit-card>` — compact commit summary (subject, author/time, diffstat, per-file changes)
 * that links file rows out to a diff view.
 *
 * @customElement lyra-commit-card
 * @event lyra-file-select - `detail: { path }` — a file row was activated.
 * @event lyra-toggle - `detail: { collapsed }` — the file-list fold changed.
 * @event lyra-copy - `detail: { text }` — the full hash was copied.
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
 * @csspart file-additions - A file row's additions count.
 * @csspart file-deletions - A file row's deletions count.
 * @csspart copy-button - The hash copy button.
 * @csspart actions - The `actions` slot wrapper.
 */
export class LyraCommitCard extends LyraElement<LyraCommitCardEventMap> {
  static styles = [LyraElement.styles, styles];

  @property() hash = '';
  @property() message = '';
  @property() author = '';
  @property({ type: Number, attribute: false }) timestamp?: number;
  @property({ attribute: false }) files: CommitFileChange[] = [];
  @property({ type: Boolean, attribute: 'files-collapsed', reflect: true }) filesCollapsed = true;
  @property({ type: Boolean, reflect: true }) copyable = true;

  @state() private justCopied = false;
  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
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
    if (this.timestamp == null || !Number.isFinite(this.timestamp)) return undefined;
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
      // throw synchronously rather than rejecting -- either way this is best-effort; lyra-copy
      // still fires with the intended text regardless.
      void navigator.clipboard?.writeText(this.hash)?.catch(() => {});
    } catch {
      // see above
    }
    this.emit('lyra-copy', { text: this.hash });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, 1500);
  };

  private toggleFiles = (): void => {
    this.filesCollapsed = !this.filesCollapsed;
    this.emit('lyra-toggle', { collapsed: this.filesCollapsed });
  };

  render(): TemplateResult {
    const { additions, deletions } = this.totals;
    const timestamp = this.validTimestamp;
    return html`
      <div part="base" role="group" aria-label=${this.localize('commitCardLabel')}>
        <div part="subject">${this.subject}</div>
        ${this.body ? html`<div part="body">${this.body}</div>` : nothing}
        <div part="meta">
          ${this.hash ? html`<span part="hash" dir="ltr">${this.hash.slice(0, 7)}</span>` : nothing}
          ${this.author ? html`<span part="author">${this.author}</span>` : nothing}
          ${timestamp !== undefined
            ? html`<span part="time"
                ><time datetime=${new Date(timestamp).toISOString()}
                  >${new Intl.DateTimeFormat(this.effectiveLocale, {
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
                  files: this.files.length,
                })}
              >
                <span part="additions">+${additions}</span> <span part="deletions">-${deletions}</span>
              </span>`
            : nothing}
          ${this.copyable && this.hash
            ? html`<button
                part="copy-button"
                type="button"
                aria-label=${this.localize('commitCardCopyHash')}
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
                  ? this.localize('commitCardShowFiles', undefined, { count: this.files.length })
                  : this.localize('commitCardHideFiles', undefined, { count: this.files.length })}
              </button>
              ${!this.filesCollapsed
                ? this.files.map(
                    (f) => html`
                      <button
                        part="file"
                        type="button"
                        data-status=${f.status ?? nothing}
                        @click=${() => this.emit('lyra-file-select', { path: f.path })}
                      >
                        <span part="file-path" dir="ltr"
                          >${f.status ? `${GIT_STATUS_LETTER[f.status]} ` : ''}${f.path}</span
                        >
                        <span>
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
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-commit-card': LyraCommitCard;
  }
}
