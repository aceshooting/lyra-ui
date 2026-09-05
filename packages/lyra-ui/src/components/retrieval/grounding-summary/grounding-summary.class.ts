import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
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
import { LYRA_DEFAULT_citation, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_groundingSummaryConfidenceLabel, LYRA_DEFAULT_groundingSummaryCoverageLabel, LYRA_DEFAULT_groundingSummaryEmpty, LYRA_DEFAULT_groundingSummaryEvidenceHeading, LYRA_DEFAULT_groundingSummaryEvidenceSpan, LYRA_DEFAULT_groundingSummaryLabel, LYRA_DEFAULT_groundingSummarySupportedLabel, LYRA_DEFAULT_groundingSummaryUnsupportedLabel, LYRA_DEFAULT_groundingSummaryWarningsHeading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraGroundingSummaryEventMap {
  'lr-citation-select': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
  'lr-claim-select': CustomEvent<LyraEventDetailSnapshot<{ claim: GroundedClaim }>>;
}

const MAX_PROJECTED_GROUNDING_ROWS = 10_000;

interface CanonicalRange {
  readonly start: number;
  readonly end: number;
}

interface CanonicalClaim {
  /** The admitted source remains opaque and is used only for the outer public event. */
  readonly source: GroundedClaim;
  /** Safe, frozen input passed to the composed claim-evidence child. */
  readonly input: GroundedClaim;
  readonly id: string;
}

interface CanonicalCitation {
  /** The admitted source remains opaque and is used only for the outer public event. */
  readonly source: Citation;
  /** Safe, frozen input passed to the composed claim-evidence child. */
  readonly input: Citation;
  readonly id: string;
  readonly sourceId?: string;
  readonly label?: string;
  readonly span?: CanonicalRange;
}

interface CanonicalAssessment {
  readonly supportedClaims: number;
  readonly unsupportedClaims: number;
  readonly coverage: number;
  readonly confidence?: number;
  readonly warnings: readonly string[];
  readonly claims: readonly CanonicalClaim[];
}

const EMPTY_CANONICAL_CLAIMS: readonly CanonicalClaim[] = Object.freeze([]);
const EMPTY_CANONICAL_CITATIONS: readonly CanonicalCitation[] = Object.freeze(
  []
);
const EMPTY_WARNINGS: readonly string[] = Object.freeze([]);

function descriptorValue(
  value: object,
  property: PropertyKey
): ReturnType<typeof getOwnDataDescriptor> {
  return getOwnDataDescriptor(value, property);
}

function valueOfDescriptor(
  descriptor: ReturnType<typeof getOwnDataDescriptor>
): unknown | undefined {
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
    descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined
    : descriptor.value;
}

function hasUnsafeDescriptor(
  descriptors: readonly ReturnType<typeof getOwnDataDescriptor>[]
): boolean {
  return descriptors.some(
    (descriptor) => descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
  );
}

function nestedEventDetailValue(
  event: CustomEvent<unknown>,
  property: PropertyKey
): unknown | undefined {
  const detail = event.detail;
  if (detail === null || typeof detail !== 'object') return undefined;
  const descriptor = descriptorValue(detail, property);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
    descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined
    : descriptor.value;
}

function projectStringList(value: unknown): readonly string[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const lengthDescriptor = descriptorValue(value, 'length');
    if (
      lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    )
      return undefined;

    const values: string[] = [];
    const length = Math.min(
      lengthDescriptor.value,
      MAX_PROJECTED_GROUNDING_ROWS
    );
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptorValue(value, String(index));
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      if (
        descriptor !== MISSING_OWN_DATA_DESCRIPTOR &&
        typeof descriptor.value === 'string'
      )
        values.push(descriptor.value);
    }
    return Object.freeze(values);
  } catch {
    return undefined;
  }
}

function projectRange(value: unknown): CanonicalRange | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const startDescriptor = descriptorValue(value, 'start');
    const endDescriptor = descriptorValue(value, 'end');
    if (hasUnsafeDescriptor([startDescriptor, endDescriptor])) return undefined;
    const start = valueOfDescriptor(startDescriptor);
    const end = valueOfDescriptor(endDescriptor);
    if (typeof start !== 'number' || typeof end !== 'number') return undefined;
    return Object.freeze({ start, end });
  } catch {
    return undefined;
  }
}

function projectClaim(value: unknown): CanonicalClaim | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const idDescriptor = descriptorValue(value, 'id');
    const textDescriptor = descriptorValue(value, 'text');
    const statusDescriptor = descriptorValue(value, 'status');
    const citationIdsDescriptor = descriptorValue(value, 'citationIds');
    const confidenceDescriptor = descriptorValue(value, 'confidence');
    const explanationDescriptor = descriptorValue(value, 'explanation');
    if (
      hasUnsafeDescriptor([
        idDescriptor,
        textDescriptor,
        statusDescriptor,
        citationIdsDescriptor,
        confidenceDescriptor,
        explanationDescriptor,
      ])
    )
      return undefined;

    const id = valueOfDescriptor(idDescriptor);
    const text = valueOfDescriptor(textDescriptor);
    const citationIds = projectStringList(valueOfDescriptor(citationIdsDescriptor));
    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      typeof text !== 'string' ||
      citationIds === undefined
    )
      return undefined;

    const status = valueOfDescriptor(statusDescriptor);
    const confidence = valueOfDescriptor(confidenceDescriptor);
    const explanation = valueOfDescriptor(explanationDescriptor);
    const input = Object.freeze({
      id,
      text,
      status: (typeof status === 'string' ? status : 'unsupported') as GroundedClaim['status'],
      citationIds,
      ...(typeof confidence === 'number' && Number.isFinite(confidence)
        ? { confidence }
        : {}),
      ...(typeof explanation === 'string' ? { explanation } : {}),
    });
    return Object.freeze({ source: value as GroundedClaim, input, id });
  } catch {
    return undefined;
  }
}

function projectCitation(value: unknown): CanonicalCitation | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const idDescriptor = descriptorValue(value, 'id');
    const chunkIdDescriptor = descriptorValue(value, 'chunkId');
    const sourceIdDescriptor = descriptorValue(value, 'sourceId');
    const spanDescriptor = descriptorValue(value, 'span');
    const labelDescriptor = descriptorValue(value, 'label');
    const quoteDescriptor = descriptorValue(value, 'quote');
    if (
      hasUnsafeDescriptor([
        idDescriptor,
        chunkIdDescriptor,
        sourceIdDescriptor,
        spanDescriptor,
        labelDescriptor,
        quoteDescriptor,
      ])
    )
      return undefined;

    const id = valueOfDescriptor(idDescriptor);
    if (typeof id !== 'string' || id.trim().length === 0) return undefined;
    const chunkId = valueOfDescriptor(chunkIdDescriptor);
    const sourceId = valueOfDescriptor(sourceIdDescriptor);
    const spanValue = valueOfDescriptor(spanDescriptor);
    const label = valueOfDescriptor(labelDescriptor);
    const quote = valueOfDescriptor(quoteDescriptor);
    const span =
      spanDescriptor === MISSING_OWN_DATA_DESCRIPTOR || spanValue === undefined
        ? undefined
        : projectRange(spanValue);
    if (spanValue !== undefined && span === undefined) return undefined;
    const input = Object.freeze({
      id,
      ...(typeof chunkId === 'string' ? { chunkId } : {}),
      ...(typeof sourceId === 'string' ? { sourceId } : {}),
      ...(span === undefined ? {} : { span }),
      ...(typeof label === 'string' ? { label } : {}),
      ...(typeof quote === 'string' ? { quote } : {}),
    });
    return Object.freeze({
      source: value as Citation,
      input,
      id,
      ...(typeof sourceId === 'string' ? { sourceId } : {}),
      ...(typeof label === 'string' ? { label } : {}),
      ...(span === undefined ? {} : { span }),
    });
  } catch {
    return undefined;
  }
}

function projectRows<T extends { readonly id: string }>(
  value: unknown,
  project: (entry: unknown) => T | undefined,
  empty: readonly T[]
): readonly T[] {
  try {
    if (!Array.isArray(value)) return empty;
    const lengthDescriptor = descriptorValue(value, 'length');
    if (
      lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    )
      return empty;

    const rows: T[] = [];
    const seen = new Set<string>();
    const length = Math.min(
      lengthDescriptor.value,
      MAX_PROJECTED_GROUNDING_ROWS
    );
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptorValue(value, String(index));
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
      )
        continue;
      const row = project(descriptor.value);
      // A malformed duplicate must never reserve its public identity ahead of a valid later row.
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    return Object.freeze(rows);
  } catch {
    return empty;
  }
}

function projectAssessment(value: unknown): CanonicalAssessment | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const supportedClaimsDescriptor = descriptorValue(value, 'supportedClaims');
    const unsupportedClaimsDescriptor = descriptorValue(value, 'unsupportedClaims');
    const coverageDescriptor = descriptorValue(value, 'coverage');
    const confidenceDescriptor = descriptorValue(value, 'confidence');
    const warningsDescriptor = descriptorValue(value, 'warnings');
    const claimsDescriptor = descriptorValue(value, 'claims');
    if (
      hasUnsafeDescriptor([
        supportedClaimsDescriptor,
        unsupportedClaimsDescriptor,
        coverageDescriptor,
        confidenceDescriptor,
        warningsDescriptor,
        claimsDescriptor,
      ])
    )
      return undefined;

    const supportedClaims = valueOfDescriptor(supportedClaimsDescriptor);
    const unsupportedClaims = valueOfDescriptor(unsupportedClaimsDescriptor);
    const coverage = valueOfDescriptor(coverageDescriptor);
    const confidence = valueOfDescriptor(confidenceDescriptor);
    const warningsValue = valueOfDescriptor(warningsDescriptor);
    const claimsValue = valueOfDescriptor(claimsDescriptor);
    const warnings =
      warningsDescriptor === MISSING_OWN_DATA_DESCRIPTOR || warningsValue === undefined
        ? EMPTY_WARNINGS
        : projectStringList(warningsValue) ?? EMPTY_WARNINGS;
    const claims =
      claimsDescriptor === MISSING_OWN_DATA_DESCRIPTOR || claimsValue === undefined
        ? EMPTY_CANONICAL_CLAIMS
        : projectRows(claimsValue, projectClaim, EMPTY_CANONICAL_CLAIMS);
    return Object.freeze({
      supportedClaims: typeof supportedClaims === 'number' ? supportedClaims : 0,
      unsupportedClaims:
        typeof unsupportedClaims === 'number' ? unsupportedClaims : 0,
      coverage: typeof coverage === 'number' ? coverage : 0,
      ...(typeof confidence === 'number' ? { confidence } : {}),
      warnings,
      claims,
    });
  } catch {
    return undefined;
  }
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
 * This component contains `<lr-citation-badge>`'s raw `lr-citation-activate` event and emits the richer
 * `lr-citation-select` (`detail: { citation }`, `CitationSelectEventDetail` from `src/ai/types.ts`)
 * carrying the full `Citation` -- including its `span` -- since a bare `sourceId`/`index` pair
 * can't by itself tell a host which exact evidence span to jump to.
 *
 * Public collection sequences are bounded, frozen snapshots. The assessment and admitted
 * claim/citation source identities remain opaque while descriptor-safe projections copy fields
 * used for display, lookup, and composition once; later rendering and events never reread a
 * source record. Create a new collection and reassign it after changes; mutating the assigned
 * array does not update the view. Blank claim/citation ids and later duplicates are ignored before
 * counts, lookup, rendering, or activation. The first record for an id wins.
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
    citation: LYRA_DEFAULT_citation,
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
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'assessment',
    'citations',
  ]);
  /** Assessment is a closed schema projected below without generic record enumeration. */
  protected static override readonly identityCollectionObjectProperties =
    Object.freeze(['assessment']);
  /** Citation records carry opaque caller fields returned by the public selection event. */
  protected static override readonly identityCollectionProperties = Object.freeze([
    'citations',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-citation-select',
    'lr-claim-select',
  ]);
  /** Preserve admitted source identities inside the otherwise frozen event envelopes. */
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-citation-select': Object.freeze(['citation']),
    'lr-claim-select': Object.freeze(['claim']),
  });

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

  private readonly canonicalAssessmentBySource = new WeakMap<
    object,
    CanonicalAssessment | null
  >();
  private readonly canonicalCitationsBySource = new WeakMap<
    object,
    readonly CanonicalCitation[]
  >();

  private get normalizedAssessment(): CanonicalAssessment | undefined {
    const source = this.assessment;
    if (source === null || typeof source !== 'object') return undefined;
    const cached = this.canonicalAssessmentBySource.get(source);
    if (cached !== undefined) return cached ?? undefined;
    const assessment = projectAssessment(source);
    this.canonicalAssessmentBySource.set(source, assessment ?? null);
    return assessment;
  }

  private get normalizedCitations(): readonly CanonicalCitation[] {
    const source = this.citations;
    if (source === null || typeof source !== 'object')
      return EMPTY_CANONICAL_CITATIONS;
    const cached = this.canonicalCitationsBySource.get(source);
    if (cached) return cached;
    const citations = projectRows(
      source,
      projectCitation,
      EMPTY_CANONICAL_CITATIONS
    );
    this.canonicalCitationsBySource.set(source, citations);
    return citations;
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

  private onCitationSelect(citation: CanonicalCitation, event: Event): void {
    event.stopPropagation();
    this.emit('lr-citation-select', { citation: citation.source });
  }

  private onNestedCitationSelect(
    citations: readonly CanonicalCitation[],
    event: CustomEvent<unknown>
  ): void {
    event.stopPropagation();
    const selected = nestedEventDetailValue(event, 'citation');
    const citation = citations.find(
      (candidate) => candidate.input === selected
    );
    if (citation)
      this.emit('lr-citation-select', { citation: citation.source });
  }

  private onNestedClaimSelect(
    claims: readonly CanonicalClaim[],
    event: CustomEvent<unknown>
  ): void {
    event.stopPropagation();
    const selected = nestedEventDetailValue(event, 'claim');
    const claim = claims.find(
      (candidate) => candidate.input === selected
    );
    if (claim) this.emit('lr-claim-select', { claim: claim.source });
  }

  private renderEvidenceItem = (
    citation: CanonicalCitation,
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
    const a = this.normalizedAssessment;

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
    const warnings = a.warnings;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const claims = a.claims;
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
                .claims=${claims.map((claim) => claim.input)}
                .citations=${citations.map((citation) => citation.input)}
                @lr-claim-select=${(event: CustomEvent<unknown>) =>
                  this.onNestedClaimSelect(claims, event)}
                @lr-citation-select=${(event: CustomEvent<unknown>) =>
                  this.onNestedCitationSelect(citations, event)}
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
