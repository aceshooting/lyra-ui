import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type {
  Citation,
  CitationSelectEventDetail,
  GroundedClaim,
  GroundedClaimStatus,
} from '../../../ai/types.js';
import {
  getOwnDataDescriptor,
  projectFrozenRows,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { projectGroundedClaim } from '../grounded-claim-projection.js';
import { isRovingTargetAvailable, resolveListMove } from '../../../internal/list-navigation.js';
import { devWarnOnce } from '../../../internal/dev-warning.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
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
import { LYRA_DEFAULT_citation, LYRA_DEFAULT_claimEvidenceClaimsLimit, LYRA_DEFAULT_claimEvidenceConfidence, LYRA_DEFAULT_claimEvidenceContradicted, LYRA_DEFAULT_claimEvidenceEmpty, LYRA_DEFAULT_claimEvidenceLabel, LYRA_DEFAULT_claimEvidencePartiallySupported, LYRA_DEFAULT_claimEvidenceSupported, LYRA_DEFAULT_claimEvidenceUnsupported, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_details, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusUnknown } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraClaimEvidenceEventMap {
  'lr-claim-select': CustomEvent<
    LyraEventDetailSnapshot<{ claim: GroundedClaim }>
  >;
  'lr-citation-select': CustomEvent<
    LyraEventDetailSnapshot<CitationSelectEventDetail>
  >;
  'lr-citation-open': CustomEvent<
    LyraEventDetailSnapshot<CitationSelectEventDetail>
  >;
}

type CitationEventName = 'lr-citation-select' | 'lr-citation-open';

type DisplayClaimStatus = GroundedClaimStatus | 'unknown';

const STATUS_VARIANT: Record<DisplayClaimStatus, BadgeVariant> = {
  supported: 'success',
  'partially-supported': 'warning',
  unsupported: 'danger',
  contradicted: 'danger',
  unknown: 'neutral',
};

const MAX_PROJECTED_CLAIM_EVIDENCE_ROWS = 10_000;

/** Caps how many claims mount as `[part="claim"]` rows. This is a rendering budget, distinct from
 *  and much smaller than `MAX_PROJECTED_CLAIM_EVIDENCE_ROWS` (a DoS-safety descriptor-read ceiling
 *  on the raw input, not a UI cap) -- matches the 500-row ceiling used by every other bounded list
 *  in this library (e.g. `lr-task-list`'s `MAX_RENDERED_TASKS`). */
const MAX_RENDERED_CLAIM_EVIDENCE_CLAIMS = 500;

interface CanonicalClaim {
  /** The admitted input is retained only for its public selection-event identity. */
  readonly source: GroundedClaim;
  readonly id: string;
  readonly text: string;
  readonly status: string;
  readonly citationIds: readonly string[];
  readonly confidence?: number;
  readonly explanation?: string;
}

interface CanonicalCitation {
  /** The admitted input is retained only for its public selection-event identity. */
  readonly source: Citation;
  readonly id: string;
  readonly sourceId?: string;
  readonly label?: string;
  readonly quote?: string;
}

const EMPTY_CANONICAL_CLAIMS: readonly CanonicalClaim[] = Object.freeze([]);
const EMPTY_CANONICAL_CITATIONS: readonly CanonicalCitation[] = Object.freeze(
  []
);

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

function projectCitation(value: unknown): CanonicalCitation | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const idDescriptor = getOwnDataDescriptor(value, 'id');
    const sourceIdDescriptor = getOwnDataDescriptor(value, 'sourceId');
    const labelDescriptor = getOwnDataDescriptor(value, 'label');
    const quoteDescriptor = getOwnDataDescriptor(value, 'quote');
    if (
      hasUnsafeDescriptor([
        idDescriptor,
        sourceIdDescriptor,
        labelDescriptor,
        quoteDescriptor,
      ])
    )
      return undefined;

    const id = valueOfDescriptor(idDescriptor);
    if (typeof id !== 'string' || id.trim().length === 0) return undefined;
    const sourceId = valueOfDescriptor(sourceIdDescriptor);
    const label = valueOfDescriptor(labelDescriptor);
    const quote = valueOfDescriptor(quoteDescriptor);
    return Object.freeze({
      source: value as Citation,
      id,
      ...(typeof sourceId === 'string' ? { sourceId } : {}),
      ...(typeof label === 'string' ? { label } : {}),
      ...(typeof quote === 'string' ? { quote } : {}),
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
  return projectFrozenRows(value, project, MAX_PROJECTED_CLAIM_EVIDENCE_ROWS, empty, (row) => row.id);
}

function normalizedClaimStatus(status: unknown): DisplayClaimStatus {
  switch (status) {
    case 'supported':
    case 'partially-supported':
    case 'unsupported':
    case 'contradicted':
      return status;
    default:
      return 'unknown';
  }
}

/**
 * `<lr-claim-evidence>` — a controlled claim-by-claim grounding audit. It relates generated
 * claims to complete citation records, exposes assessment status/confidence, and tolerates
 * missing citation ids without fabricating evidence. An unrecognized runtime claim status
 * appears as a neutral localized unknown state, never as an unsupported verdict.
 *
 * Public collection sequences are bounded, frozen snapshots. Admitted claim and citation source
 * identities remain opaque while descriptor-safe projections copy the fields used for display and
 * lookup once; later rendering and events never reread a source record. Create a new collection
 * and reassign it after changes; mutating the assigned array does not update the view. Blank
 * claim/citation ids and later duplicates are ignored before lookup, rendering, counts, or
 * activation. The first record for an id wins.
 *
 * At most 500 claims render as `[part="claim"]` rows; a `claims` array past that length renders a
 * localized `[part="limit"]` notice after the list rather than mounting an unbounded number of rows.
 * A nested badge's `lr-citation-activate` and `lr-citation-open` (double-click, or Space) are
 * contained and translated to `lr-citation-select` and `lr-citation-open`, each with the complete
 * citation record.
 *
 * @customElement lr-claim-evidence
 * @event lr-claim-select - A claim was activated. `detail: { claim }`.
 * @event lr-citation-select - Evidence was activated. `detail: { citation }`.
 * @event lr-citation-open - Evidence's full-preview affordance was triggered. `detail: { citation }`.
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
 * @csspart limit - Localized notice shown when `claims` exceeds the 500-claim render ceiling.
 * @csspart empty - The empty state.
 * @cssprop [--lr-claim-evidence-compact-padding=var(--lr-space-xs)] - `[part="claim-trigger"]`
 * padding while `size` is `s` or smaller.
 * @cssprop [--lr-claim-evidence-compact-gap=var(--lr-space-xs)] - Gap between `[part="claim-trigger"]`'s
 * columns while `size` is `s` or smaller.
 * @status stable
 * @since 7.0.0
 */
export class LyraClaimEvidence extends LyraElement<LyraClaimEvidenceEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    citation: LYRA_DEFAULT_citation,
    claimEvidenceClaimsLimit: LYRA_DEFAULT_claimEvidenceClaimsLimit,
    claimEvidenceConfidence: LYRA_DEFAULT_claimEvidenceConfidence,
    claimEvidenceContradicted: LYRA_DEFAULT_claimEvidenceContradicted,
    claimEvidenceEmpty: LYRA_DEFAULT_claimEvidenceEmpty,
    claimEvidenceLabel: LYRA_DEFAULT_claimEvidenceLabel,
    claimEvidencePartiallySupported: LYRA_DEFAULT_claimEvidencePartiallySupported,
    claimEvidenceSupported: LYRA_DEFAULT_claimEvidenceSupported,
    claimEvidenceUnsupported: LYRA_DEFAULT_claimEvidenceUnsupported,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    details: LYRA_DEFAULT_details,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusUnknown: LYRA_DEFAULT_statusUnknown,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  private rovingClaimId = '';

  private onClaimKeyDown(event: KeyboardEvent, index: number, count: number): void {
    const buttons = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part="claim-trigger"]');
    const next = resolveListMove(event, {
      count, current: index, orientation: 'vertical',
      isAvailable: (candidate) => Boolean(buttons?.[candidate] && isRovingTargetAvailable(buttons[candidate]!)),
    });
    if (next === null) return;
    event.preventDefault();
    buttons?.[next]?.focus();
  }
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'claims',
    'citations',
  ]);
  /** Source records carry opaque caller fields returned by the public selection events. */
  protected static override readonly identityCollectionProperties = Object.freeze([
    'claims',
    'citations',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-claim-select',
    'lr-citation-select',
    'lr-citation-open',
  ]);
  /** Keep the admitted source opaque inside the otherwise frozen event envelope. */
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-claim-select': Object.freeze(['claim']),
    'lr-citation-select': Object.freeze(['citation']),
    'lr-citation-open': Object.freeze(['citation']),
  });

  /** Grounded claims rendered as the selectable evidence index. */
  @property({ attribute: false }) claims: readonly GroundedClaim[] = [];
  /** Citation records resolved by each claim's citation indexes. */
  @property({ attribute: false }) citations: readonly Citation[] = [];
  /** Controlled id of the selected claim, marked `aria-pressed` and `claim-selected`. */
  @property({ attribute: 'selected-claim-id' }) selectedClaimId = '';
  /** Fallback name for the claim-and-evidence region; omitting it falls back to the localized
   *  default and an explicit empty string clears it. A non-empty host `aria-label` makes the host
   *  the sole overall owner; an explicitly empty host label stays empty on the region. */
  @property() label?: string;
  /**
   * Density on the shared size scale. `s` (and the smaller `xs`/`2xs`) tightens the claim-trigger
   * padding and column gap for dense evidence lists -- same convention as `lr-source-card`'s and
   * `lr-entity-card`'s `size`. `m` (the default) and larger keep the full claim-trigger padding.
   * Purely a density knob: each claim's border and background stay, so use `frame="plain"` to drop
   * the chrome entirely.
   */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Container treatment, in the shared `LyraFrame` vocabulary. `'card'` (the default) keeps each
   *  claim's bordered, filled box. `'plain'` removes the border, background, and corner radius from
   *  every `[part~="claim"]` row, so claims nested inside an already-bordered container (e.g. a
   *  wider audit panel) don't double the frame. `plain` wins over the dense `size` tier when both
   *  are set (nothing left to tighten). */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  private readonly canonicalClaimsBySource = new WeakMap<
    object,
    readonly CanonicalClaim[]
  >();
  private readonly canonicalCitationsBySource = new WeakMap<
    object,
    readonly CanonicalCitation[]
  >();

  private canonicalRowsFor<T extends { readonly id: string }>(
    source: unknown,
    cache: WeakMap<object, readonly T[]>,
    project: (entry: unknown) => T | undefined,
    empty: readonly T[]
  ): readonly T[] {
    if (source === null || typeof source !== 'object') return empty;
    const cached = cache.get(source);
    if (cached) return cached;
    const rows = projectRows(source, project, empty);
    cache.set(source, rows);
    return rows;
  }

  private get normalizedClaims(): readonly CanonicalClaim[] {
    return this.canonicalRowsFor(
      this.claims,
      this.canonicalClaimsBySource,
      projectGroundedClaim,
      EMPTY_CANONICAL_CLAIMS
    );
  }

  private get normalizedCitations(): readonly CanonicalCitation[] {
    return this.canonicalRowsFor(
      this.citations,
      this.canonicalCitationsBySource,
      projectCitation,
      EMPTY_CANONICAL_CITATIONS
    );
  }

  private statusLabel(status: DisplayClaimStatus): string {
    switch (status) {
      case 'supported':
        return this.localize('claimEvidenceSupported');
      case 'partially-supported':
        return this.localize('claimEvidencePartiallySupported');
      case 'unsupported':
        return this.localize('claimEvidenceUnsupported');
      case 'contradicted':
        return this.localize('claimEvidenceContradicted');
      case 'unknown':
        return this.localize('statusUnknown');
    }
  }

  private confidenceLabel(value: number): string {
    const percent = getNumberFormat(this.effectiveLocale, {
      style: 'percent',
    }).format(finiteRange(value, 0, 0, 1));
    return this.localize('claimEvidenceConfidence', undefined, { percent });
  }

  /** A claim's resolved evidence in citation-list order, from one id lookup built per render. */
  private resolvedCitations(
    claim: CanonicalClaim,
    byId: ReadonlyMap<string, { citation: CanonicalCitation; index: number }>
  ): { citation: CanonicalCitation; index: number }[] {
    const found = new Set<{ citation: CanonicalCitation; index: number }>();
    for (const id of claim.citationIds) {
      const entry = byId.get(id);
      if (entry) found.add(entry);
    }
    return [...found].sort((a, b) => a.index - b.index);
  }

  private renderClaim(
    claim: CanonicalClaim,
    byId: ReadonlyMap<string, { citation: CanonicalCitation; index: number }>,
    index: number,
    count: number,
    rovingClaimId: string | undefined,
  ): TemplateResult {
    const selected = claim.id === this.selectedClaimId;
    const citations = this.resolvedCitations(claim, byId);
    const status = normalizedClaimStatus(claim.status);
    if (status === 'unknown') devWarnOnce(
      'lr-claim-evidence:unknown-status',
      `<lr-claim-evidence>: unknown claim status ${JSON.stringify(claim.status.slice(0, 80))}; rendering a neutral status.`
    );
    const claimPart = selected ? 'claim claim-selected' : 'claim';
    return html`
      <li part=${claimPart} aria-current=${selected ? 'true' : 'false'}>
        <button
          part="claim-trigger"
          type="button"
          tabindex=${claim.id === rovingClaimId ? '0' : '-1'}
          @focus=${() => { this.rovingClaimId = claim.id; this.requestUpdate(); }}
          @keydown=${(event: KeyboardEvent) => this.onClaimKeyDown(event, index, count)}
          aria-pressed=${selected ? 'true' : 'false'}
          @click=${() => this.emit('lr-claim-select', { claim: claim.source })}
        >
          <lr-badge part="status" variant=${STATUS_VARIANT[status]}>
            ${this.statusLabel(status)}
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
                  ({ citation, index }) => html`
                    <lr-citation-badge
                      .index=${index + 1}
                      .sourceId=${citation.sourceId ?? ''}
                      .label=${citation.label ?? ''}
                      @lr-citation-activate=${(event: Event) =>
                        this.reportCitation('lr-citation-select', citation, event)}
                      @lr-citation-open=${(event: Event) =>
                        this.reportCitation('lr-citation-open', citation, event)}
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

  private reportCitation(
    name: CitationEventName,
    citation: CanonicalCitation,
    event: Event
  ): void {
    event.stopPropagation();
    this.emit(name, { citation: citation.source });
  }

  private citationsById?: {
    source: readonly CanonicalCitation[];
    map: Map<string, { citation: CanonicalCitation; index: number }>;
  };

  private lookupCitations(citations: readonly CanonicalCitation[]) {
    if (this.citationsById?.source !== citations)
      this.citationsById = {
        source: citations,
        map: new Map(
          citations.map((citation, index) => [citation.id, { citation, index }])
        ),
      };
    return this.citationsById.map;
  }

  override render(): TemplateResult {
    const claims = this.normalizedClaims;
    const renderedClaims = claims.slice(0, MAX_RENDERED_CLAIM_EVIDENCE_CLAIMS);
    const rovingClaimId = renderedClaims.some((claim) => claim.id === this.rovingClaimId)
      ? this.rovingClaimId : renderedClaims[0]?.id;
    const byId = this.lookupCitations(this.normalizedCitations);
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('claimEvidenceLabel') : this.label
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
              ${renderedClaims
                .map((claim, index) => this.renderClaim(claim, byId, index, renderedClaims.length, rovingClaimId))}
            </ol>
            ${claims.length > MAX_RENDERED_CLAIM_EVIDENCE_CLAIMS
              ? html`<p part="limit" role="note">${this.localize(
                  'claimEvidenceClaimsLimit',
                  undefined,
                  {
                    count: getNumberFormat(this.effectiveLocale).format(
                      MAX_RENDERED_CLAIM_EVIDENCE_CLAIMS
                    ),
                  }
                )}</p>`
              : nothing}`
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
