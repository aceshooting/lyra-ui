import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import {
  finiteCount,
  finiteRange,
} from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import type { LyraVariant } from '../../../internal/variants.js';
import '../../data/stat/stat.class.js';
import '../citation-badge/citation-badge.class.js';
import '../../overlays/empty/empty.class.js';
import type {
  Citation,
  CitationSelectEventDetail,
  GroundedClaim,
  GroundingAssessment,
} from '../../../ai/types.js';
import { styles } from './grounding-summary.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import '../claim-evidence/claim-evidence.class.js';
import type { LyraScoreThresholds } from '../graph/graph.class.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_groundingSummaryConfidenceLabel, LYRA_DEFAULT_groundingSummaryCoverageLabel, LYRA_DEFAULT_groundingSummaryEmpty, LYRA_DEFAULT_groundingSummaryEvidenceHeading, LYRA_DEFAULT_groundingSummaryEvidenceSpan, LYRA_DEFAULT_groundingSummaryLabel, LYRA_DEFAULT_groundingSummarySupportedLabel, LYRA_DEFAULT_groundingSummaryUnsupportedLabel, LYRA_DEFAULT_groundingSummaryWarningsHeading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraGroundingSummaryEventMap {
  'lr-citation-select': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
  'lr-claim-select': CustomEvent<LyraEventDetailSnapshot<{ claim: GroundedClaim }>>;
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
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Blank claim/citation ids and later duplicates are ignored before counts, lookup, rendering, or
 * activation. The first record for an id wins.
 *
 * @customElement lr-grounding-summary
 * @event lr-citation-select - An evidence citation badge was activated. `detail: { citation }`.
 * @event lr-claim-select - A composed claim-evidence row was activated. `detail: { claim }`.
 * @csspart base - The root wrapper. It owns `role="group"` and the fallback name unless a
 *   non-empty host `aria-label` makes the host the sole overall owner.
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
 * @csspart evidence-list - The semantic list containing the evidence citations.
 * @csspart claims - Claim-level evidence, when present and enabled.
 * @csspart empty - The empty-state message, shown when `assessment` is `null`.
 * @status stable
 * @since 4.1.0
 */
export class LyraGroundingSummary extends LyraElement<LyraGroundingSummaryEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    groundingSummaryConfidenceLabel: LYRA_DEFAULT_groundingSummaryConfidenceLabel,
    groundingSummaryCoverageLabel: LYRA_DEFAULT_groundingSummaryCoverageLabel,
    groundingSummaryEmpty: LYRA_DEFAULT_groundingSummaryEmpty,
    groundingSummaryEvidenceHeading: LYRA_DEFAULT_groundingSummaryEvidenceHeading,
    groundingSummaryEvidenceSpan: LYRA_DEFAULT_groundingSummaryEvidenceSpan,
    groundingSummaryLabel: LYRA_DEFAULT_groundingSummaryLabel,
    groundingSummarySupportedLabel: LYRA_DEFAULT_groundingSummarySupportedLabel,
    groundingSummaryUnsupportedLabel: LYRA_DEFAULT_groundingSummaryUnsupportedLabel,
    groundingSummaryWarningsHeading: LYRA_DEFAULT_groundingSummaryWarningsHeading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'assessment',
    'citations',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-citation-select',
    'lr-claim-select',
  ]);

  /** The assessment to summarize. `null` (the default) renders the empty state. */
  @property({ attribute: false }) assessment: Readonly<GroundingAssessment> | null = null;

  /** Evidence citations backing the assessment, each rendered as an `<lr-citation-badge>` linking
   *  back to its exact `span`. Independent of `assessment` -- the evidence section is simply
   *  omitted when this is empty, same as the warnings section is omitted when `assessment.warnings`
   *  is empty/unset. */
  @property({ attribute: false }) citations: readonly Citation[] = [];

  /** Tone thresholds applied to both `coverage` and `confidence` (both 0-1 fractions): at or above
   *  `high` renders `success`, at or above `medium` renders `warning`, below `medium` renders
   *  `danger`. */
  @property({ attribute: false }) thresholds: LyraScoreThresholds = {
    high: 0.8,
    medium: 0.5,
  };

  /** Accessible name used by the stable group when the host has no `aria-label`; falls back to the
   *  localized `groundingSummaryLabel` default. An explicitly empty host label stays empty, and so
   *  does an explicitly empty `label`. */
  @property() label?: string;

  /** Renders `assessment.claims` through `<lr-claim-evidence>` when available. */
  @property({
    type: Boolean,
    attribute: 'show-claims',
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  showClaims = true;

  /** Semantic level of the warnings and evidence section headings. Use `none` to keep the visual
   *  heading text without exposing it to heading navigation. Invalid untyped values use level 3. */
  @property({ attribute: 'heading-level' })
  headingLevel: LyraHeadingLevel = '3';

  private get normalizedCitations(): Citation[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.citations) ? this.citations : [],
      (citation) => citation.id
    );
  }

  private normalizedClaims(
    assessment: Readonly<GroundingAssessment>
  ): GroundedClaim[] {
    return firstByRetrievalIdentity(
      Array.isArray(assessment.claims) ? assessment.claims : [],
      (claim) => claim.id
    );
  }

  private sectionHeading(part: string, text: string): TemplateResult {
    const level = resolveHeadingLevel(this.headingLevel);
    switch (level) {
      case '1':
        return html`<h1 part=${part}>${text}</h1>`;
      case '2':
        return html`<h2 part=${part}>${text}</h2>`;
      case '4':
        return html`<h4 part=${part}>${text}</h4>`;
      case '5':
        return html`<h5 part=${part}>${text}</h5>`;
      case '6':
        return html`<h6 part=${part}>${text}</h6>`;
      case '3':
        return html`<h3 part=${part}>${text}</h3>`;
      default:
        // 'none': visual text with no heading semantics -- the shared opt-out.
        return html`<span part=${part}>${text}</span>`;
    }
  }

  private tone(value: number): LyraVariant {
    if (value >= this.thresholds.high) return 'success';
    if (value >= this.thresholds.medium) return 'warning';
    return 'danger';
  }

  private formatPercent(value: number): string {
    return getNumberFormat(this.effectiveLocale, { style: 'percent' }).format(
      finiteRange(value, 0, 0, 1)
    );
  }

  private onCitationSelect(citation: Citation, event: Event): void {
    event.stopPropagation();
    this.emit('lr-citation-select', { citation });
  }

  private renderEvidenceItem = (
    citation: Citation,
    index: number
  ): TemplateResult => {
    // The offsets are locale-formatted before interpolation, the same way every other number in
    // this component (and the adjacent citation badge's own index) is: interpolating raw JS numbers
    // into a translated sentence renders Latin digits with English grouping inside an otherwise
    // localized string.
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const spanText = citation.span
      ? this.localize('groundingSummaryEvidenceSpan', undefined, {
          start: numberFormat.format(finiteCount(citation.span.start)),
          end: numberFormat.format(finiteCount(citation.span.end)),
        })
      : '';
    return html`
      <li part="evidence-item">
        <lr-citation-badge
          index=${index + 1}
          source-id=${citation.sourceId ?? ''}
          @lr-citation-activate=${(event: Event) =>
            this.onCitationSelect(citation, event)}
        >
          ${citation.label ? html`<span>${citation.label}</span>` : nothing}
          ${spanText ? html`<span>${spanText}</span>` : nothing}
        </lr-citation-badge>
        ${citation.label
          ? html`<span part="evidence-label">${citation.label}</span>`
          : nothing}
        ${spanText
          ? html`<span part="evidence-span">${spanText}</span>`
          : nothing}
      </li>
    `;
  };

  override render(): TemplateResult {
    const groupLabel = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('groundingSummaryLabel') : this.label
    );
    const groupRole = retrievalSemanticRole(this, 'group');
    const a = this.assessment;

    if (!a) {
      return html`<div
        part="base"
        role=${groupRole ?? nothing}
        aria-label=${groupLabel ?? nothing}
      >
        <lr-empty
          part="empty"
          heading=${this.localize('groundingSummaryEmpty')}
        ></lr-empty>
      </div>`;
    }

    const supportedClaims = finiteCount(a.supportedClaims);
    const unsupportedClaims = finiteCount(a.unsupportedClaims);
    const coverage = finiteRange(a.coverage, 0, 0, 1);
    const hasConfidence = typeof a.confidence === 'number';
    const warnings = a.warnings ?? [];
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const claims = this.normalizedClaims(a);
    const citations = this.normalizedCitations;

    return html`
      <div
        part="base"
        role=${groupRole ?? nothing}
        aria-label=${groupLabel ?? nothing}
      >
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
                variant=${this.tone(
                  finiteRange(a.confidence as number, 0, 0, 1)
                )}
              ></lr-stat>`
            : nothing}
        </div>
        ${warnings.length > 0
          ? html`
              <div part="warnings">
                ${this.sectionHeading(
                  'warnings-heading',
                  this.localize('groundingSummaryWarningsHeading')
                )}
                <span part="warnings-count"
                  >${numberFormat.format(warnings.length)}</span
                >
                <ul part="warnings-list">
                  ${warnings.map(
                    (warning) => html`<li part="warning">${warning}</li>`
                  )}
                </ul>
              </div>
            `
          : nothing}
        ${this.showClaims && claims.length
          ? html`
              <lr-claim-evidence
                part="claims"
                .claims=${claims}
                .citations=${citations}
              ></lr-claim-evidence>
            `
          : nothing}
        ${citations.length > 0
          ? html`
              <div part="evidence">
                ${this.sectionHeading(
                  'evidence-heading',
                  this.localize('groundingSummaryEvidenceHeading')
                )}
                <span part="evidence-count"
                  >${numberFormat.format(citations.length)}</span
                >
                <ul part="evidence-list" role="list">
                  ${citations.map((citation, index) =>
                    this.renderEvidenceItem(citation, index)
                  )}
                </ul>
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
