import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  getOwnDataDescriptor,
  readOwnDataValue,
  projectFrozenRows,
  projectStringList as projectDescriptorStringList,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import {
  finiteCount,
  finiteRange,
} from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { isRovingTargetAvailable, resolveListMove } from '../../../internal/list-navigation.js';
import { projectGroundedClaim } from '../grounded-claim-projection.js';
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
import '../claim-evidence/claim-evidence.class.js';
import type { LyraScoreThresholds } from '../graph/graph.class.js';
export type { LyraScoreThresholds } from '../graph/graph.class.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_citation, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_groundingSummaryCitationsLimit, LYRA_DEFAULT_groundingSummaryConfidenceLabel, LYRA_DEFAULT_groundingSummaryCoverageLabel, LYRA_DEFAULT_groundingSummaryEmpty, LYRA_DEFAULT_groundingSummaryEvidenceHeading, LYRA_DEFAULT_groundingSummaryEvidenceSpan, LYRA_DEFAULT_groundingSummaryLabel, LYRA_DEFAULT_groundingSummarySupportedLabel, LYRA_DEFAULT_groundingSummaryUnsupportedLabel, LYRA_DEFAULT_groundingSummaryWarningsHeading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraGroundingSummaryEventMap {
  'lr-citation-select': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
  'lr-citation-open': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
  'lr-claim-select': CustomEvent<LyraEventDetailSnapshot<{ claim: GroundedClaim }>>;
}

const MAX_PROJECTED_GROUNDING_ROWS = 10_000;

type CitationEventName = 'lr-citation-select' | 'lr-citation-open';

const DEFAULT_TIERS: LyraScoreThresholds = { high: 0.8, medium: 0.5 };

/** Caps how many evidence citations mount as `[part="evidence-item"]` rows. This is a rendering
 *  budget, distinct from and much smaller than `MAX_PROJECTED_GROUNDING_ROWS` (a DoS-safety
 *  descriptor-read ceiling on the raw input, not a UI cap) -- matches the 500-row ceiling used by
 *  every other bounded list in this library (e.g. `lr-task-list`'s `MAX_RENDERED_TASKS`). */
const MAX_RENDERED_GROUNDING_CITATIONS = 500;

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
  return readOwnDataValue(detail, property);
}

function projectStringList(value: unknown): readonly string[] | undefined {
  return projectDescriptorStringList(value, MAX_PROJECTED_GROUNDING_ROWS);
}

function projectRange(value: unknown): CanonicalRange | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const startDescriptor = getOwnDataDescriptor(value, 'start');
    const endDescriptor = getOwnDataDescriptor(value, 'end');
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
  const projected = projectGroundedClaim(value);
  if (!projected) return undefined;
  const { source, ...fields } = projected;
  const input = Object.freeze({ ...fields, status: fields.status as GroundedClaim['status'] });
  return Object.freeze({ source, input, id: projected.id });
}

function projectCitation(value: unknown): CanonicalCitation | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const idDescriptor = getOwnDataDescriptor(value, 'id');
    const chunkIdDescriptor = getOwnDataDescriptor(value, 'chunkId');
    const sourceIdDescriptor = getOwnDataDescriptor(value, 'sourceId');
    const spanDescriptor = getOwnDataDescriptor(value, 'span');
    const labelDescriptor = getOwnDataDescriptor(value, 'label');
    const quoteDescriptor = getOwnDataDescriptor(value, 'quote');
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
    const span = projectRange(spanValue);
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
  return projectFrozenRows(value, project, MAX_PROJECTED_GROUNDING_ROWS, empty, (row) => row.id);
}

function projectAssessment(value: unknown): CanonicalAssessment | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const supportedClaimsDescriptor = getOwnDataDescriptor(value, 'supportedClaims');
    const unsupportedClaimsDescriptor = getOwnDataDescriptor(value, 'unsupportedClaims');
    const coverageDescriptor = getOwnDataDescriptor(value, 'coverage');
    const confidenceDescriptor = getOwnDataDescriptor(value, 'confidence');
    const warningsDescriptor = getOwnDataDescriptor(value, 'warnings');
    const claimsDescriptor = getOwnDataDescriptor(value, 'claims');
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
 * This component contains `<lr-citation-badge>`'s raw `lr-citation-activate` and `lr-citation-open`
 * events and emits the richer `lr-citation-select` and `lr-citation-open` (`detail: { citation }`,
 * `CitationSelectEventDetail` from `src/ai/types.ts`) carrying the full `Citation` -- including its
 * `span` -- since a bare `sourceId`/`index` pair can't by itself tell a host which exact evidence
 * span to jump to. A `span` that is not a `{ start, end }` pair of numbers is treated as absent.
 *
 * Public collection sequences are bounded, frozen snapshots. The assessment and admitted
 * claim/citation source identities remain opaque while descriptor-safe projections copy fields
 * used for display, lookup, and composition once; later rendering and events never reread a
 * source record. Create a new collection and reassign it after changes; mutating the assigned
 * array does not update the view. Blank claim/citation ids and later duplicates are ignored before
 * counts, lookup, rendering, or activation. The first record for an id wins.
 *
 * At most 500 citations render as `[part="evidence-item"]` rows; a `citations` array past that
 * length still reports its true count in `[part="evidence-count"]` but renders a localized
 * `[part="limit"]` notice after the list rather than mounting an unbounded number of rows. The
 * full citation set is still forwarded to a composed `<lr-claim-evidence>` for claim-to-citation
 * lookup, which applies its own render cap on the claims it lists.
 *
 * @customElement lr-grounding-summary
 * @event lr-citation-select - An evidence citation badge was activated. `detail: { citation }`.
 * @event lr-citation-open - An evidence citation badge's full-preview affordance was triggered
 *   (double-click, or Space). `detail: { citation }`.
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
 * @csspart limit - Localized notice shown when `citations` exceeds the 500-citation render ceiling.
 * @csspart claims - Claim-level evidence, when present and enabled.
 * @csspart empty - The empty-state message, shown when `assessment` is `null`.
 * @status stable
 * @since 4.1.0
 */
export class LyraGroundingSummary extends LyraElement<LyraGroundingSummaryEventMap> {
  private rovingEvidenceId = '';

  private onEvidenceKeyDown(event: KeyboardEvent, index: number, count: number): void {
    const badges = this.shadowRoot?.querySelectorAll<HTMLElement>('[part="evidence-list"] lr-citation-badge');
    const next = resolveListMove(event, {
      count, current: index, orientation: 'vertical',
      isAvailable: (candidate) => {
        const badge = badges?.[candidate];
        const button = badge?.shadowRoot?.querySelector<HTMLButtonElement>('[part="base"]');
        return Boolean(badge && button && isRovingTargetAvailable(badge) && isRovingTargetAvailable(button));
      },
    });
    if (next === null) return;
    event.preventDefault();
    const badge = badges?.[next];
    badge?.shadowRoot?.querySelector<HTMLButtonElement>('[part="base"]')?.focus();
  }
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    citation: LYRA_DEFAULT_citation,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    groundingSummaryCitationsLimit: LYRA_DEFAULT_groundingSummaryCitationsLimit,
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
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

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
    'lr-citation-open',
    'lr-claim-select',
  ]);
  /** Preserve admitted source identities inside the otherwise frozen event envelopes. */
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-citation-select': Object.freeze(['citation']),
    'lr-citation-open': Object.freeze(['citation']),
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

  /** Omits the `assessment.claims` detail that otherwise renders through `<lr-claim-evidence>`. */
  @property({ type: Boolean, attribute: 'without-claims', reflect: true })
  withoutClaims = false;

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
    const { high, medium } = { ...DEFAULT_TIERS, ...this.thresholds };
    if (value >= high) return 'success';
    if (value >= medium) return 'warning';
    return 'danger';
  }

  private formatPercent(value: number): string {
    return getNumberFormat(this.effectiveLocale, { style: 'percent' }).format(
      finiteRange(value, 0, 0, 1)
    );
  }

  private onCitation(
    name: CitationEventName,
    citation: CanonicalCitation,
    event: Event
  ): void {
    event.stopPropagation();
    this.emit(name, { citation: citation.source });
  }

  private onNestedCitation(
    name: CitationEventName,
    citations: readonly CanonicalCitation[],
    event: CustomEvent<unknown>
  ): void {
    event.stopPropagation();
    const selected = nestedEventDetailValue(event, 'citation');
    const citation = citations.find(
      (candidate) => candidate.input === selected
    );
    if (citation) this.emit(name, { citation: citation.source });
  }

  /** One stable input array per projected row list, so the nested claim evidence keeps its inputs. */
  private readonly inputsByRows = new WeakMap<readonly object[], object[]>();

  private inputsOf<T extends { readonly input: object }>(
    rows: readonly T[]
  ): T['input'][] {
    let inputs = this.inputsByRows.get(rows);
    if (!inputs) this.inputsByRows.set(rows, (inputs = rows.map((row) => row.input)));
    return inputs as T['input'][];
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
    index: number,
    count: number,
    rovingEvidenceId: string | undefined,
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
          .rovingTabIndex=${citation.id === rovingEvidenceId ? 0 : -1}
          @focusin=${() => { this.rovingEvidenceId = citation.id; this.requestUpdate(); }}
          @keydown=${(event: KeyboardEvent) => this.onEvidenceKeyDown(event, index, count)}
          @lr-citation-activate=${(event: Event) =>
            this.onCitation('lr-citation-select', citation, event)}
          @lr-citation-open=${(event: Event) =>
            this.onCitation('lr-citation-open', citation, event)}
        ></lr-citation-badge>
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
    const renderedCitations = citations.slice(0, MAX_RENDERED_GROUNDING_CITATIONS);
    const rovingEvidenceId = renderedCitations.some((citation) => citation.id === this.rovingEvidenceId)
      ? this.rovingEvidenceId : renderedCitations[0]?.id;

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
        ${!this.withoutClaims && claims.length
          ? html`
              <lr-claim-evidence
                part="claims"
                .claims=${guard([claims], () => this.inputsOf(claims))}
                .citations=${guard([citations], () => this.inputsOf(citations))}
                @lr-claim-select=${(event: CustomEvent<unknown>) =>
                  this.onNestedClaimSelect(claims, event)}
                @lr-citation-select=${(event: CustomEvent<unknown>) =>
                  this.onNestedCitation('lr-citation-select', citations, event)}
                @lr-citation-open=${(event: CustomEvent<unknown>) =>
                  this.onNestedCitation('lr-citation-open', citations, event)}
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
                  ${renderedCitations
                    .map((citation, index) =>
                      this.renderEvidenceItem(citation, index, renderedCitations.length, rovingEvidenceId)
                    )}
                </ul>
                ${citations.length > MAX_RENDERED_GROUNDING_CITATIONS
                  ? html`<p part="limit" role="note">${this.localize(
                      'groundingSummaryCitationsLimit',
                      undefined,
                      { count: numberFormat.format(MAX_RENDERED_GROUNDING_CITATIONS) }
                    )}</p>`
                  : nothing}
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
