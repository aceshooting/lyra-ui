import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { bdi } from '../../../internal/bidi.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { normalizeLabel, resolveAccessibleName } from '../../../internal/accessible-name.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { firstByIdentityMemo } from '../../../internal/collection-identity.js';
import { styles } from './change-review.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_changeReviewDiscard, LYRA_DEFAULT_changeReviewDiscardHunk, LYRA_DEFAULT_changeReviewDiscarded, LYRA_DEFAULT_changeReviewEmpty, LYRA_DEFAULT_changeReviewHunk, LYRA_DEFAULT_changeReviewHunkInFile, LYRA_DEFAULT_changeReviewKeep, LYRA_DEFAULT_changeReviewKeepHunk, LYRA_DEFAULT_changeReviewKept, LYRA_DEFAULT_changeReviewLabel, LYRA_DEFAULT_changeReviewLimit, LYRA_DEFAULT_changeReviewPending } from '../../../internal/default-strings/agent-tools.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ChangeReviewDecision = 'pending' | 'keep' | 'discard';
export interface ChangeReviewHunk {
  id: string;
  label?: string;
  before: string;
  after: string;
  decision?: ChangeReviewDecision;
}
export interface ChangeReviewFile {
  id: string;
  path: string;
  previousPath?: string;
  hunks: readonly ChangeReviewHunk[];
}

const fileIdentity = (file: ChangeReviewFile): string => file.id;
const hunkIdentity = (hunk: ChangeReviewHunk): string => hunk.id;
export interface LyraChangeReviewEventMap {
  'lr-change-decision-request': CustomEvent<{ fileId: string; hunkId: string; decision: Exclude<ChangeReviewDecision, 'pending'> }>;
}
const MAX_CHANGES = 200;

/**
 * Multi-file change review with host-owned per-hunk keep/discard decisions. Inputs contain
 * already-separated hunks; this component does not parse patches or write files. Decisions are
 * requests: the host must replace `files` to acknowledge them. Selecting the current decision
 * emits nothing. Nonblank file and per-file hunk identities normalize first-wins.
 * Collections are clone-owned snapshots; replace arrays to update. At most 200 files and 200
 * hunks total are rendered, with a visible notice when more exist. Each diff also applies
 * `<lr-diff-view>`'s input ceiling. Readonly retains file disclosure and diff reading.
 *
 * @customElement lr-change-review
 * @event lr-change-decision-request - A keep/discard request. `detail: { fileId, hunkId, decision }`.
 * @csspart base - The named review group.
 * @csspart heading - The review heading.
 * @csspart file - A file disclosure.
 * @csspart file-header - The file disclosure summary.
 * @csspart previous-path - Previous file path for renames.
 * @csspart hunk - One change region. An unlabeled hunk is named `Change {index}`, or
 *   `Change {index} in {file}` while several files render.
 * @csspart hunk-header - Change label and decision state.
 * @csspart status - The localized current decision.
 * @csspart actions - Hunk decision actions.
 * @csspart decision - A keep/discard button.
 * @cssprop [--lr-change-review-file-border-color=var(--lr-color-border)] - Border of each file disclosure.
 * @cssprop [--lr-change-review-file-radius=var(--lr-radius-container)] - Corner radius of each file disclosure.
 * @cssprop [--lr-change-review-header-hover-bg=var(--lr-color-surface-raised)] - File header hover fill; the
 *   pressed fill mixes from it.
 * @csspart empty - Empty review copy.
 * @csspart limit - Render-limit notice.
 * @status experimental
 * @since 22.0.0
 */
export class LyraChangeReview extends LyraElement<LyraChangeReviewEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    changeReviewDiscard: LYRA_DEFAULT_changeReviewDiscard,
    changeReviewDiscardHunk: LYRA_DEFAULT_changeReviewDiscardHunk,
    changeReviewDiscarded: LYRA_DEFAULT_changeReviewDiscarded,
    changeReviewEmpty: LYRA_DEFAULT_changeReviewEmpty,
    changeReviewHunk: LYRA_DEFAULT_changeReviewHunk,
    changeReviewHunkInFile: LYRA_DEFAULT_changeReviewHunkInFile,
    changeReviewKeep: LYRA_DEFAULT_changeReviewKeep,
    changeReviewKeepHunk: LYRA_DEFAULT_changeReviewKeepHunk,
    changeReviewKept: LYRA_DEFAULT_changeReviewKept,
    changeReviewLabel: LYRA_DEFAULT_changeReviewLabel,
    changeReviewLimit: LYRA_DEFAULT_changeReviewLimit,
    changeReviewPending: LYRA_DEFAULT_changeReviewPending,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;
  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];
  protected static override readonly ownedCollectionProperties = Object.freeze(['files']);

  /** Ordered files with already-separated hunks. Never mutated by the component. */
  @property({ attribute: false }) files: readonly ChangeReviewFile[] = [];
  /** Disable decision controls while preserving readable changes and disclosure. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Level of the visible title: `'1'`-`'6'`, or `'none'` for no heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';
  /** Hide decision actions while preserving their current state. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Visible heading and accessible name. Omission uses the localized default. */
  @property() label?: string;

  private get normalizedFiles(): ChangeReviewFile[] {
    return firstByIdentityMemo(this.files, fileIdentity);
  }
  private hunks(file: ChangeReviewFile): ChangeReviewHunk[] {
    return firstByIdentityMemo(file.hunks, hunkIdentity);
  }
  private readonly limitAnnouncements = new AnnouncementSinkController(this, { eager: ['polite'] });

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const text = this.renderRoot.querySelector('[part="limit"]')?.textContent?.trim() ?? '';
    this.limitAnnouncements.transition('limit', text ? 'limited' : 'complete', text, 'polite');
  }

  private decision(hunk: ChangeReviewHunk): ChangeReviewDecision {
    return hunk.decision === 'keep' || hunk.decision === 'discard' ? hunk.decision : 'pending';
  }
  private decisionDispatching = false;
  private decide(renderedFile: ChangeReviewFile, renderedHunk: ChangeReviewHunk, decision: 'keep' | 'discard'): void {
    if (this.decisionDispatching || this.disabled || this.readonly) return;
    const file = this.normalizedFiles.find((candidate) => candidate.id === renderedFile.id);
    const hunk = file && this.hunks(file).find((candidate) => candidate.id === renderedHunk.id);
    if (file !== renderedFile || hunk !== renderedHunk || this.decision(hunk) === decision) return;
    this.decisionDispatching = true;
    try {
      this.emit('lr-change-decision-request', { fileId: file.id, hunkId: hunk.id, decision });
    } finally {
      this.decisionDispatching = false;
    }
  }
  private renderHunk(file: ChangeReviewFile, hunk: ChangeReviewHunk, index: number, multipleFiles: boolean): TemplateResult {
    const decision = this.decision(hunk);
    const authored = normalizeLabel(hunk.label);
    const ordinal = getNumberFormat(this.effectiveLocale).format(index + 1);
    const visibleLabel = authored ?? this.localize('changeReviewHunk', undefined, { index: ordinal });
    // With several files, a generated hunk name also carries its file so the regions and their
    // decision buttons stay distinguishable across files.
    const label = authored ?? (multipleFiles
      ? this.localize('changeReviewHunkInFile', undefined, { index: ordinal, file: file.path })
      : visibleLabel);
    return html`<section part="hunk" aria-label=${label}>
      <div part="hunk-header"><span>${visibleLabel}</span><span part="status">${this.localize(
        decision === 'keep' ? 'changeReviewKept' : decision === 'discard' ? 'changeReviewDiscarded' : 'changeReviewPending',
      )}</span></div>
      <lr-diff-view .oldText=${typeof hunk.before === 'string' ? hunk.before : ''}
        .newText=${typeof hunk.after === 'string' ? hunk.after : ''} layout="unified"></lr-diff-view>
      ${this.readonly ? nothing : html`<div part="actions">
        ${(['keep', 'discard'] as const).map((next) => html`<button part="decision" data-agent-action="neutral" type="button"
          data-decision=${next} aria-pressed=${decision === next ? 'true' : 'false'}
          aria-label=${this.localize(next === 'keep' ? 'changeReviewKeepHunk' : 'changeReviewDiscardHunk', undefined, { label })}
          ?disabled=${this.disabled} @click=${() => this.decide(file, hunk, next)}>${this.localize(next === 'keep' ? 'changeReviewKeep' : 'changeReviewDiscard')}</button>`)}
      </div>`}
    </section>`;
  }
  override render(): TemplateResult {
    const files = this.normalizedFiles;
    let remaining = MAX_CHANGES;
    let limited = files.length > MAX_CHANGES;
    const visible = files.slice(0, MAX_CHANGES).map((file) => {
      const hunks = this.hunks(file);
      const retained = hunks.slice(0, remaining);
      remaining -= retained.length;
      if (retained.length < hunks.length) limited = true;
      return { file, hunks: retained };
    });
    const label = this.label ?? this.localize('changeReviewLabel');
    const level = resolveHeadingLevel(this.headingLevel, '2');
    return html`<div part="base" role="group" aria-label=${ifDefined(resolveAccessibleName(this, label))}>
      ${label === '' ? nothing : html`<div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${label}</div>`}
      ${visible.length === 0 ? html`<p part="empty">${this.localize('changeReviewEmpty')}</p>` : repeat(visible, ({ file }) => file.id, ({ file, hunks }) => html`
        <details part="file" open>
          <summary part="file-header">${bdi(file.path)}${file.previousPath ? html`<span part="previous-path">${bdi(file.previousPath)}</span>` : nothing}</summary>
          ${repeat(hunks, (hunk) => hunk.id, (hunk, index) => this.renderHunk(file, hunk, index, visible.length > 1))}
        </details>`)}
      ${limited ? html`<p part="limit" role="note">${this.localize('changeReviewLimit', undefined, { count: getNumberFormat(this.effectiveLocale).format(MAX_CHANGES) })}</p>` : nothing}
    </div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-change-review': LyraChangeReview; } }
