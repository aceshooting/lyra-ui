import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type {
  Citation,
  CitationSelectEventDetail,
  GroundedClaim,
  GroundedClaimStatus,
} from '../../../ai/types.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { finiteRange } from '../../../internal/numbers.js';
import type { LyraFrame } from '../../../internal/variants.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/empty/empty.class.js';
import '../citation-badge/citation-badge.class.js';
import { styles } from './claim-evidence.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_claimEvidenceConfidence, LYRA_DEFAULT_claimEvidenceContradicted, LYRA_DEFAULT_claimEvidenceEmpty, LYRA_DEFAULT_claimEvidenceLabel, LYRA_DEFAULT_claimEvidencePartiallySupported, LYRA_DEFAULT_claimEvidenceSupported, LYRA_DEFAULT_claimEvidenceUnsupported, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraClaimEvidenceEventMap {
  'lr-claim-select': CustomEvent<LyraEventDetailSnapshot<{ claim: GroundedClaim }>>;
  'lr-citation-select': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
}

const STATUS_VARIANT: Record<GroundedClaimStatus, BadgeVariant> = {
  supported: 'success',
  'partially-supported': 'warning',
  unsupported: 'danger',
  contradicted: 'danger',
};

/**
 * `<lr-claim-evidence>` — a controlled claim-by-claim grounding audit. It relates generated
 * claims to complete citation records, exposes assessment status/confidence, and tolerates
 * missing citation ids without fabricating evidence.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Blank claim/citation ids and later duplicates are ignored before lookup, rendering, counts, or
 * activation. The first record for an id wins.
 * A nested badge's `lr-citation-activate` is contained and translated to `lr-citation-select` with
 * the complete citation record. Its distinct `lr-citation-open` signal intentionally remains a
 * composed child event and crosses this host unchanged, preserving its `{ sourceId, index, href }`
 * detail for consumers that want the badge's richer open action.
 *
 * @customElement lr-claim-evidence
 * @event lr-claim-select - A claim was activated. `detail: { claim }`.
 * @event lr-citation-select - Evidence was activated. `detail: { citation }`.
 * @csspart base - The named claim-evidence region.
 * @csspart list - The claim list.
 * @csspart claim - One claim.
 * @csspart claim-selected - The selected claim.
 * @csspart claim-trigger - A claim's selection button.
 * @csspart status - The support-status badge.
 * @csspart claim-text - The claim text.
 * @csspart confidence - The optional localized confidence.
 * @csspart explanation - Caller-supplied assessment explanation.
 * @csspart evidence - Resolved evidence citations for one claim.
 * @csspart empty - The empty state.
 * @cssprop [--lr-claim-evidence-compact-padding=var(--lr-space-xs)] - `[part="claim-trigger"]`
 * padding while `compact`.
 * @cssprop [--lr-claim-evidence-compact-gap=var(--lr-space-xs)] - Gap between `[part="claim-trigger"]`'s
 * columns while `compact`.
 * @status stable
 * @since 7.0.0
 */
export class LyraClaimEvidence extends LyraElement<LyraClaimEvidenceEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    claimEvidenceConfidence: LYRA_DEFAULT_claimEvidenceConfidence,
    claimEvidenceContradicted: LYRA_DEFAULT_claimEvidenceContradicted,
    claimEvidenceEmpty: LYRA_DEFAULT_claimEvidenceEmpty,
    claimEvidenceLabel: LYRA_DEFAULT_claimEvidenceLabel,
    claimEvidencePartiallySupported: LYRA_DEFAULT_claimEvidencePartiallySupported,
    claimEvidenceSupported: LYRA_DEFAULT_claimEvidenceSupported,
    claimEvidenceUnsupported: LYRA_DEFAULT_claimEvidenceUnsupported,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['claims', 'citations']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-claim-select',
    'lr-citation-select',
  ]);

  /** Grounded claims rendered as the selectable evidence index. */
  @property({ attribute: false }) claims: readonly GroundedClaim[] = [];
  /** Citation records resolved by each claim's citation indexes. */
  @property({ attribute: false }) citations: readonly Citation[] = [];
  /** Controlled id of the claim whose evidence is expanded. */
  @property({ attribute: 'selected-claim-id' }) selectedClaimId = '';
  /** Fallback name for the claim-and-evidence region. A non-empty host `aria-label` makes the host
   *  the sole overall owner; an explicitly empty host label stays empty on the region. */
  @property() label = '';
  /** Tighter claim-trigger padding and column gap, for dense evidence lists -- same convention as
   *  `lr-source-card`'s/`lr-entity-card`'s `compact`. Defaults to `false`, i.e. the full
   *  claim-trigger padding. Purely a density knob: each claim's border and background stay, so use
   *  `frame="plain"` to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Container treatment, in the shared `LyraFrame` vocabulary. `'card'` (the default) keeps each
   *  claim's bordered, filled box. `'plain'` removes the border, background, and corner radius from
   *  every `[part~="claim"]` row, so claims nested inside an already-bordered container (e.g. a
   *  wider audit panel) don't double the frame. `plain` wins over `compact` when both are set
   *  (nothing left to tighten). */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  private get normalizedClaims(): GroundedClaim[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.claims) ? this.claims : [],
      (claim) => claim.id
    );
  }

  private get normalizedCitations(): Citation[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.citations) ? this.citations : [],
      (citation) => citation.id
    );
  }

  private statusLabel(status: GroundedClaimStatus): string {
    switch (status) {
      case 'supported':
        return this.localize('claimEvidenceSupported');
      case 'partially-supported':
        return this.localize('claimEvidencePartiallySupported');
      case 'unsupported':
        return this.localize('claimEvidenceUnsupported');
      case 'contradicted':
        return this.localize('claimEvidenceContradicted');
    }
  }

  private confidenceLabel(value: number): string {
    const percent = getNumberFormat(this.effectiveLocale, {
      style: 'percent',
    }).format(finiteRange(value, 0, 0, 1));
    return this.localize('claimEvidenceConfidence', undefined, { percent });
  }

  private resolvedCitations(
    claim: GroundedClaim,
    citations: readonly Citation[]
  ): Citation[] {
    const ids = new Set(claim.citationIds);
    return citations.filter((citation) => ids.has(citation.id));
  }

  private renderClaim(
    claim: GroundedClaim,
    allCitations: readonly Citation[]
  ): TemplateResult {
    const selected = claim.id === this.selectedClaimId;
    const citations = this.resolvedCitations(claim, allCitations);
    const claimPart = selected ? 'claim claim-selected' : 'claim';
    return html`
      <li part=${claimPart} aria-current=${selected ? 'true' : 'false'}>
        <button
          part="claim-trigger"
          type="button"
          aria-pressed=${selected ? 'true' : 'false'}
          @click=${() => this.emit('lr-claim-select', { claim })}
        >
          <lr-badge part="status" variant=${STATUS_VARIANT[claim.status]}>
            ${this.statusLabel(claim.status)}
          </lr-badge>
          <span part="claim-text">${claim.text}</span>
          ${typeof claim.confidence === 'number'
            ? html`<span part="confidence"
                >${this.confidenceLabel(claim.confidence)}</span
              >`
            : nothing}
        </button>
        ${claim.explanation
          ? html`<p part="explanation">${claim.explanation}</p>`
          : nothing}
        ${citations.length
          ? html`
              <div part="evidence">
                ${citations.map(
                  (citation) => html`
                    <lr-citation-badge
                      .index=${allCitations.indexOf(citation) + 1}
                      .sourceId=${citation.sourceId ?? ''}
                      .label=${citation.label ?? ''}
                      @lr-citation-activate=${(event: Event) => {
                        event.stopPropagation();
                        this.emit('lr-citation-select', { citation });
                      }}
                    ></lr-citation-badge>
                    ${citation.quote ? html`<q>${citation.quote}</q>` : nothing}
                  `
                )}
              </div>
            `
          : nothing}
      </li>
    `;
  }

  override render(): TemplateResult {
    const claims = this.normalizedClaims;
    const citations = this.normalizedCitations;
    const label = retrievalSemanticLabel(
      this,
      this.label || this.localize('claimEvidenceLabel')
    );
    const role = retrievalSemanticRole(this, 'region');
    return html`
      <section
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        ${claims.length
          ? html`<ol part="list">
              ${claims.map((claim) => this.renderClaim(claim, citations))}
            </ol>`
          : html`<lr-empty
              part="empty"
              heading=${this.localize('claimEvidenceEmpty')}
            ></lr-empty>`}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-claim-evidence': LyraClaimEvidence;
  }
}
