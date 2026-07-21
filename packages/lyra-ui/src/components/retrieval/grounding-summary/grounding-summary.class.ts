import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { StatVariant } from '../../data/stat/stat.class.js';
import '../../data/stat/stat.class.js';
import '../citation-badge/citation-badge.class.js';
import '../../overlays/empty/empty.class.js';
import type { Citation, CitationSelectEventDetail, GroundingAssessment } from '../../../ai/types.js';
import { styles } from './grounding-summary.styles.js';

export interface LyraGroundingSummaryEventMap {
  'lr-citation-select': CustomEvent<CitationSelectEventDetail>;
}

/** Coverage/confidence tone thresholds (both are 0-1 fractions) -- the same shape and default
 *  magnitude `<lr-chunk-inspector>`'s own `thresholds` prop already establishes for its
 *  relevance-score tiers, reused here for the analogous "how well grounded" reading. */
export interface GroundingSummaryThresholds {
  high: number;
  medium: number;
}

/**
 * `<lr-grounding-summary>` -- the claim-level scorecard for one generated answer: supported/
 * unsupported claim counts, citation coverage, an optional confidence score, any warnings, and
 * (when `citations` is supplied) a list of evidence citations linking back to their exact spans.
 * Consumes `GroundingAssessment` from `src/ai/types.ts` directly as its primary input. Pure
 * projection + event conduit: never fetches or computes an assessment itself.
 *
 * Composes `<lr-stat>` for every numeric display (claim counts, coverage, confidence) and
 * `<lr-citation-badge>` for each evidence entry -- this component defines no numeric-badge or
 * citation-link markup of its own.
 *
 * `<lr-citation-badge>`'s own `lr-citation-activate` event (`detail: { sourceId, index }`) still
 * bubbles through unmodified, same as every other Lyra component composing a child that emits its
 * own events. This component additionally listens for it and re-emits the richer
 * `lr-citation-select` (`detail: { citation }`, `CitationSelectEventDetail` from `src/ai/types.ts`)
 * carrying the full `Citation` -- including its `span` -- since a bare `sourceId`/`index` pair
 * can't by itself tell a host which exact evidence span to jump to.
 *
 * @customElement lr-grounding-summary
 * @event lr-citation-select - An evidence citation badge was activated. `detail: { citation }`.
 * @csspart base - The `role="group"` root wrapper.
 * @csspart stats - Container for the claim-count/coverage/confidence `<lr-stat>` row.
 * @csspart warnings - Wrapper for the warnings section. Omitted when there are no warnings.
 * @csspart warnings-heading - The "Warnings" heading text.
 * @csspart warnings-count - The warnings count.
 * @csspart warnings-list - The `<ul>` of warning messages.
 * @csspart warning - One warning `<li>`.
 * @csspart evidence - Wrapper for the evidence section. Omitted when `citations` is empty.
 * @csspart evidence-heading - The "Evidence" heading text.
 * @csspart evidence-count - The evidence count.
 * @csspart evidence-item - One citation's row (badge + always-visible label/span text).
 * @csspart evidence-label - A citation's `label`, shown next to its badge (omitted when unset).
 * @csspart evidence-span - A citation's formatted `span` range, shown next to its badge (omitted
 *   when `span` is unset).
 * @csspart empty - The empty-state message, shown when `assessment` is `null`.
 */
export class LyraGroundingSummary extends LyraElement<LyraGroundingSummaryEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The assessment to summarize. `null` (the default) renders the empty state. */
  @property({ attribute: false }) assessment: GroundingAssessment | null = null;

  /** Evidence citations backing the assessment, each rendered as an `<lr-citation-badge>` linking
   *  back to its exact `span`. Independent of `assessment` -- the evidence section is simply
   *  omitted when this is empty, same as the warnings section is omitted when `assessment.warnings`
   *  is empty/unset. */
  @property({ attribute: false }) citations: Citation[] = [];

  /** Tone thresholds applied to both `coverage` and `confidence` (both 0-1 fractions): at or above
   *  `high` renders `success`, at or above `medium` renders `warning`, below `medium` renders
   *  `danger`. */
  @property({ attribute: false }) thresholds: GroundingSummaryThresholds = { high: 0.8, medium: 0.5 };

  /** Accessible group label override. Falls back to a host `aria-label`, then the localized
   *  `groundingSummaryLabel` default. */
  @property() label = '';

  private tone(value: number): StatVariant {
    if (value >= this.thresholds.high) return 'success';
    if (value >= this.thresholds.medium) return 'warning';
    return 'danger';
  }

  private formatPercent(value: number): string {
    return getNumberFormat(this.effectiveLocale, { style: 'percent' }).format(finiteRange(value, 0, 0, 1));
  }

  private onCitationSelect(citation: Citation): void {
    this.emit<CitationSelectEventDetail>('lr-citation-select', { citation });
  }

  private renderEvidenceItem = (citation: Citation, index: number): TemplateResult => {
    const spanText = citation.span
      ? this.localize('groundingSummaryEvidenceSpan', undefined, {
          start: citation.span.start,
          end: citation.span.end,
        })
      : '';
    return html`
      <div part="evidence-item">
        <lr-citation-badge
          index=${index + 1}
          source-id=${citation.sourceId ?? ''}
          @lr-citation-activate=${() => this.onCitationSelect(citation)}
        >
          ${citation.label ? html`<span>${citation.label}</span>` : nothing}
          ${spanText ? html`<span>${spanText}</span>` : nothing}
        </lr-citation-badge>
        ${citation.label ? html`<span part="evidence-label">${citation.label}</span>` : nothing}
        ${spanText ? html`<span part="evidence-span">${spanText}</span>` : nothing}
      </div>
    `;
  };

  override render(): TemplateResult {
    const groupLabel = this.getAttribute('aria-label') || this.label || this.localize('groundingSummaryLabel');
    const a = this.assessment;

    if (!a) {
      return html`<div part="base" role="group" aria-label=${groupLabel}>
        <lr-empty part="empty" heading=${this.localize('groundingSummaryEmpty')}></lr-empty>
      </div>`;
    }

    const supportedClaims = finiteCount(a.supportedClaims);
    const unsupportedClaims = finiteCount(a.unsupportedClaims);
    const coverage = finiteRange(a.coverage, 0, 0, 1);
    const hasConfidence = typeof a.confidence === 'number';
    const warnings = a.warnings ?? [];
    const numberFormat = getNumberFormat(this.effectiveLocale);

    return html`
      <div part="base" role="group" aria-label=${groupLabel}>
        <div part="stats">
          <lr-stat
            label=${this.localize('groundingSummarySupportedLabel')}
            value=${numberFormat.format(supportedClaims)}
            variant=${supportedClaims > 0 ? 'success' : 'neutral'}
          ></lr-stat>
          <lr-stat
            label=${this.localize('groundingSummaryUnsupportedLabel')}
            value=${numberFormat.format(unsupportedClaims)}
            variant=${unsupportedClaims > 0 ? 'danger' : 'neutral'}
          ></lr-stat>
          <lr-stat
            label=${this.localize('groundingSummaryCoverageLabel')}
            value=${this.formatPercent(coverage)}
            variant=${this.tone(coverage)}
          ></lr-stat>
          ${hasConfidence
            ? html`<lr-stat
                label=${this.localize('groundingSummaryConfidenceLabel')}
                value=${this.formatPercent(a.confidence as number)}
                variant=${this.tone(finiteRange(a.confidence as number, 0, 0, 1))}
              ></lr-stat>`
            : nothing}
        </div>
        ${warnings.length > 0
          ? html`
              <div part="warnings">
                <span part="warnings-heading">${this.localize('groundingSummaryWarningsHeading')}</span>
                <span part="warnings-count">${warnings.length}</span>
                <ul part="warnings-list">
                  ${warnings.map((warning) => html`<li part="warning">${warning}</li>`)}
                </ul>
              </div>
            `
          : nothing}
        ${this.citations.length > 0
          ? html`
              <div part="evidence">
                <span part="evidence-heading">${this.localize('groundingSummaryEvidenceHeading')}</span>
                <span part="evidence-count">${this.citations.length}</span>
                <div>${this.citations.map((citation, index) => this.renderEvidenceItem(citation, index))}</div>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-grounding-summary': LyraGroundingSummary;
  }
}
