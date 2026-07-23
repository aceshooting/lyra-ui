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
import { finiteRange } from '../../../internal/numbers.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/empty/empty.class.js';
import '../citation-badge/citation-badge.class.js';
import { styles } from './claim-evidence.styles.js';

export interface LyraClaimEvidenceEventMap {
  'lr-claim-select': CustomEvent<{ claim: GroundedClaim }>;
  'lr-citation-select': CustomEvent<CitationSelectEventDetail>;
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
 */
export class LyraClaimEvidence extends LyraElement<LyraClaimEvidenceEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) claims: GroundedClaim[] = [];
  @property({ attribute: false }) citations: Citation[] = [];
  @property({ attribute: 'selected-claim-id' }) selectedClaimId = '';
  @property() label = '';

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
    const percent = getNumberFormat(this.effectiveLocale, { style: 'percent' }).format(
      finiteRange(value, 0, 0, 1),
    );
    return this.localize('claimEvidenceConfidence', undefined, { percent });
  }

  private resolvedCitations(claim: GroundedClaim): Citation[] {
    const ids = new Set(claim.citationIds);
    return this.citations.filter((citation) => ids.has(citation.id));
  }

  private renderClaim = (claim: GroundedClaim): TemplateResult => {
    const selected = claim.id === this.selectedClaimId;
    const citations = this.resolvedCitations(claim);
    return html`
      <li part=${selected ? 'claim claim-selected' : 'claim'} aria-current=${selected ? 'true' : nothing}>
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
            ? html`<span part="confidence">${this.confidenceLabel(claim.confidence)}</span>`
            : nothing}
        </button>
        ${claim.explanation ? html`<p part="explanation">${claim.explanation}</p>` : nothing}
        ${citations.length
          ? html`
              <div part="evidence">
                ${citations.map(
                  (citation) => html`
                    <lr-citation-badge
                      .index=${this.citations.indexOf(citation) + 1}
                      .sourceId=${citation.sourceId ?? ''}
                      .label=${citation.label ?? ''}
                      @lr-citation-activate=${() =>
                        this.emit<CitationSelectEventDetail>('lr-citation-select', { citation })}
                    ></lr-citation-badge>
                    ${citation.quote ? html`<q>${citation.quote}</q>` : nothing}
                  `,
                )}
              </div>
            `
          : nothing}
      </li>
    `;
  };

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('claimEvidenceLabel');
    return html`
      <section part="base" aria-label=${label}>
        ${this.claims.length
          ? html`<ol part="list">${this.claims.map(this.renderClaim)}</ol>`
          : html`<lr-empty part="empty" heading=${this.localize('claimEvidenceEmpty')}></lr-empty>`}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-claim-evidence': LyraClaimEvidence;
  }
}

