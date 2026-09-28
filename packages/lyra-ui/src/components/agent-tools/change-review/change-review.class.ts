import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { firstByIdentity } from '../collection-identity.js';
import { styles } from './change-review.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_changeReviewDiscard, LYRA_DEFAULT_changeReviewDiscarded, LYRA_DEFAULT_changeReviewEmpty, LYRA_DEFAULT_changeReviewHunk, LYRA_DEFAULT_changeReviewKeep, LYRA_DEFAULT_changeReviewKept, LYRA_DEFAULT_changeReviewLabel, LYRA_DEFAULT_changeReviewLimit, LYRA_DEFAULT_changeReviewPending } from '../../../internal/default-strings.generated.js';
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
export interface LyraChangeReviewEventMap {
  'lr-change-decision': CustomEvent<{ fileId: string; hunkId: string; decision: Exclude<ChangeReviewDecision, 'pending'> }>;
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
 * @event lr-change-decision - A keep/discard request. `detail: { fileId, hunkId, decision }`.
 * @csspart base - The named review group.
 * @csspart heading - The review heading.
 * @csspart file - A file disclosure.
 * @csspart file-header - The file disclosure summary.
 * @csspart previous-path - Previous file path for renames.
 * @csspart hunk - One change region.
 * @csspart hunk-header - Change label and decision state.
 * @csspart status - The localized current decision.
 * @csspart actions - Hunk decision actions.
 * @csspart decision - A keep/discard button.
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
    changeReviewDiscarded: LYRA_DEFAULT_changeReviewDiscarded,
    changeReviewEmpty: LYRA_DEFAULT_changeReviewEmpty,
    changeReviewHunk: LYRA_DEFAULT_changeReviewHunk,
    changeReviewKeep: LYRA_DEFAULT_changeReviewKeep,
    changeReviewKept: LYRA_DEFAULT_changeReviewKept,
    changeReviewLabel: LYRA_DEFAULT_changeReviewLabel,
    changeReviewLimit: LYRA_DEFAULT_changeReviewLimit,
    changeReviewPending: LYRA_DEFAULT_changeReviewPending,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;
  static override styles = [LyraElement.styles, styles];
  protected static override readonly ownedCollectionProperties = Object.freeze(['files']);

  /** Ordered files with already-separated hunks. Never mutated by the component. */
  @property({ attribute: false }) files: readonly ChangeReviewFile[] = [];
  /** Disable decision controls while preserving readable changes and disclosure. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Hide decision actions while preserving their current state. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Visible heading and accessible name. Omission uses the localized default. */
  @property() label?: string;

  private get normalizedFiles(): ChangeReviewFile[] {
    return firstByIdentity(Array.isArray(this.files) ? this.files : [], (file) => file.id);
  }
  private hunks(file: ChangeReviewFile): ChangeReviewHunk[] {
    return firstByIdentity(Array.isArray(file.hunks) ? file.hunks : [], (hunk) => hunk.id);
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
      this.emit('lr-change-decision', { fileId: file.id, hunkId: hunk.id, decision });
    } finally {
      this.decisionDispatching = false;
    }
  }
  private renderHunk(file: ChangeReviewFile, hunk: ChangeReviewHunk, index: number): TemplateResult {
    const decision = this.decision(hunk);
    const label = hunk.label ?? this.localize('changeReviewHunk', undefined, {
      index: getNumberFormat(this.effectiveLocale).format(index + 1),
    });
    return html`<section part="hunk" aria-label=${label}>
      <div part="hunk-header"><span>${label}</span><span part="status">${this.localize(
        decision === 'keep' ? 'changeReviewKept' : decision === 'discard' ? 'changeReviewDiscarded' : 'changeReviewPending',
      )}</span></div>
      <lr-diff-view .oldText=${typeof hunk.before === 'string' ? hunk.before : ''}
        .newText=${typeof hunk.after === 'string' ? hunk.after : ''} layout="unified"></lr-diff-view>
      ${this.readonly ? nothing : html`<div part="actions">
        ${(['keep', 'discard'] as const).map((next) => html`<button part="decision" type="button"
          data-decision=${next} aria-pressed=${decision === next ? 'true' : 'false'}
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
    return html`<div part="base" role="group" aria-label=${this.getAttribute('aria-label') ?? label}>
      <h2 part="heading">${label}</h2>
      ${visible.length === 0 ? html`<p part="empty">${this.localize('changeReviewEmpty')}</p>` : repeat(visible, ({ file }) => file.id, ({ file, hunks }) => html`
        <details part="file" open>
          <summary part="file-header">${file.path}${file.previousPath ? html`<span part="previous-path">${file.previousPath}</span>` : nothing}</summary>
          ${repeat(hunks, (hunk) => hunk.id, (hunk, index) => this.renderHunk(file, hunk, index))}
        </details>`)}
      ${limited ? html`<p part="limit">${this.localize('changeReviewLimit', undefined, { count: getNumberFormat(this.effectiveLocale).format(MAX_CHANGES) })}</p>` : nothing}
    </div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-change-review': LyraChangeReview; } }
