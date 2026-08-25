import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../../overlays/badge/badge.class.js';
import '../../layout/details/details.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './policy-summary.styles.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_deny, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_policySummaryAllowCount, LYRA_DEFAULT_policySummaryCategoryGuardrail, LYRA_DEFAULT_policySummaryCategoryPermission, LYRA_DEFAULT_policySummaryCategoryPrivacy, LYRA_DEFAULT_policySummaryCategoryTool, LYRA_DEFAULT_policySummaryDenyCount, LYRA_DEFAULT_policySummaryDetailLabel, LYRA_DEFAULT_policySummaryLabel, LYRA_DEFAULT_policySummaryNeedsReviewCount, LYRA_DEFAULT_policySummaryStateAllow, LYRA_DEFAULT_policySummaryStateDeny, LYRA_DEFAULT_policySummaryStateNeedsReview, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Outcome of one guardrail/permission/privacy/tool-policy decision. */
export type PolicyDecisionState = 'allow' | 'deny' | 'needs-review';

/** The domain a decision came from — the four kinds this component is built to summarize. */
export type PolicyDecisionCategory = 'guardrail' | 'permission' | 'privacy' | 'tool';

/**
 * One resolved policy decision. Read-only, display-only data -- this component never mutates a
 * decision or offers a "resolve"/"acknowledge" action; see `<lr-tool-approval-dialog>`/
 * `<lr-confirm-bar>` for an actual approve/deny gate.
 */
export interface PolicyDecision {
  id: string;
  category: PolicyDecisionCategory;
  /** The rule/policy's display name, e.g. "Read customer records" or a tool name for `category:
   *  'tool'`. Rendered as-is, not localized (host-supplied data). */
  label: string;
  state: PolicyDecisionState;
  /** Always-visible plain-text reason for the decision -- never conveyed by `state`'s color alone. */
  explanation: string;
  /** Optional richer detail (matched rule text, policy id, cited evidence), revealed through
   *  progressive disclosure instead of always rendering alongside `explanation`. */
  detail?: string;
}

/** `allow` -> success, `deny` -> danger, `needs-review` -> warning for the state badge. */
const STATE_VARIANT: Record<PolicyDecisionState, BadgeVariant> = {
  allow: 'success',
  deny: 'danger',
  'needs-review': 'warning',
};

const STATE_LABEL_KEY: Record<PolicyDecisionState, string> = {
  allow: 'policySummaryStateAllow',
  deny: 'policySummaryStateDeny',
  'needs-review': 'policySummaryStateNeedsReview',
};

const STATE_COUNT_KEY: Record<PolicyDecisionState, string> = {
  allow: 'policySummaryAllowCount',
  deny: 'policySummaryDenyCount',
  'needs-review': 'policySummaryNeedsReviewCount',
};

const CATEGORY_LABEL_KEY: Record<PolicyDecisionCategory, string> = {
  guardrail: 'policySummaryCategoryGuardrail',
  permission: 'policySummaryCategoryPermission',
  privacy: 'policySummaryCategoryPrivacy',
  tool: 'policySummaryCategoryTool',
};

const STATES: PolicyDecisionState[] = ['allow', 'deny', 'needs-review'];

// Validated against before any `STATE_LABEL_KEY`/`STATE_COUNT_KEY`/`CATEGORY_LABEL_KEY` lookup, so
// an out-of-union `category`/`state` on host-supplied decision data degrades to a dropped row
// instead of handing `localize()` an `undefined` key (see `<lr-file-tree>`'s `GIT_STATUSES` guard
// for the same pattern).
const POLICY_DECISION_STATES = new Set<PolicyDecisionState>(STATES);
const POLICY_DECISION_CATEGORIES = new Set<PolicyDecisionCategory>(
  Object.keys(CATEGORY_LABEL_KEY) as PolicyDecisionCategory[],
);

/**
 * `<lr-policy-summary>` — a read-only list of guardrail, permission, privacy, and tool-policy
 * decisions, each carrying an `allow` / `deny` / `needs-review` state and an always-visible,
 * accessible explanation of why that decision was made -- never conveyed by color alone.
 *
 * Composes `<lr-badge>` for the compact per-decision state indicator and renders the historical
 * explanation as ordinary text, so mounting an existing policy record does not announce it as a
 * fresh alert or status change. `<lr-details>` renders a decision's optional richer `detail` (matched rule text,
 * policy id, cited evidence) behind progressive disclosure, collapsed by default, instead of
 * always showing it alongside the shorter `explanation`.
 *
 * `decisions` is controlled and never mutated by this component -- pass a new array (e.g. as a
 * guardrail pipeline resolves) to update it. This is a summary surface, not an approval gate:
 * there is no per-decision action here, and a decision's `state` is fixed data, not something a
 * viewer can change from this component.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-policy-summary
 * @csspart base - The root wrapper, only rendered while `decisions` is non-empty.
 * @csspart summary - The always-visible allow/deny/needs-review count row.
 * @csspart count - One state's localized count text; carries `data-state`.
 * @csspart list - The `role="list"` wrapper around every decision row. Its purpose-specific name
 *   is the localized `policySummaryLabel`; a host `aria-label` names the host and is not cloned
 *   onto this nested semantic owner.
 * @csspart decision - One decision row (`role="listitem"`); carries `data-state` and `data-category`.
 * @csspart decision-header - The row's category/label/state-badge line.
 * @csspart category - The decision's localized category text.
 * @csspart label - The decision's `label` text.
 * @csspart state-badge - The resolved `<lr-badge>` state indicator.
 * @csspart explanation - The always-visible historical `explanation` text.
 * @csspart detail - The `<lr-details>` progressive-disclosure panel for `detail`, only rendered
 *   when a decision defines one.
 * @csspart empty - The `<lr-empty>` shown when `decisions` is empty.
 * @cssprop [--lr-policy-summary-count-allow-color=var(--lr-color-success)] - Text color of the
 *   `allow` count.
 * @cssprop [--lr-policy-summary-count-deny-color=var(--lr-color-danger)] - Text color of the `deny`
 *   count.
 * @cssprop [--lr-policy-summary-count-needs-review-color=var(--lr-color-warning)] - Text color of the
 *   `needs-review` count. Restyling a state count otherwise requires overriding the library-wide
 *   status tokens, since `::part(count)[data-state]` is invalid CSS.
 * @status stable
 * @since 4.1.0
 */
export class LyraPolicySummary extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    deny: LYRA_DEFAULT_deny,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    policySummaryAllowCount: LYRA_DEFAULT_policySummaryAllowCount,
    policySummaryCategoryGuardrail: LYRA_DEFAULT_policySummaryCategoryGuardrail,
    policySummaryCategoryPermission: LYRA_DEFAULT_policySummaryCategoryPermission,
    policySummaryCategoryPrivacy: LYRA_DEFAULT_policySummaryCategoryPrivacy,
    policySummaryCategoryTool: LYRA_DEFAULT_policySummaryCategoryTool,
    policySummaryDenyCount: LYRA_DEFAULT_policySummaryDenyCount,
    policySummaryDetailLabel: LYRA_DEFAULT_policySummaryDetailLabel,
    policySummaryLabel: LYRA_DEFAULT_policySummaryLabel,
    policySummaryNeedsReviewCount: LYRA_DEFAULT_policySummaryNeedsReviewCount,
    policySummaryStateAllow: LYRA_DEFAULT_policySummaryStateAllow,
    policySummaryStateDeny: LYRA_DEFAULT_policySummaryStateDeny,
    policySummaryStateNeedsReview: LYRA_DEFAULT_policySummaryStateNeedsReview,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['decisions']);

  static override styles = [LyraElement.styles, styles];

  /** The decisions to render, in the given order. Controlled and never mutated by this component
   *  -- pass a new array to update it. Empty/blank ids are omitted, duplicates normalize
   *  first-wins before counts/rendering, and a decision with an out-of-union `category`/`state`
   *  is dropped rather than rendered. */
  @property({ attribute: false }) decisions: readonly PolicyDecision[] = [];

  private get normalizedDecisions(): PolicyDecision[] {
    return firstByIdentity(Array.isArray(this.decisions) ? this.decisions : [], (decision) => decision.id).filter(
      (decision) => POLICY_DECISION_CATEGORIES.has(decision.category) && POLICY_DECISION_STATES.has(decision.state),
    );
  }

  private countOf(state: PolicyDecisionState): number {
    return this.normalizedDecisions.filter((decision) => decision.state === state).length;
  }

  private stopNestedLifecycle(event: Event): void {
    event.stopPropagation();
  }

  private renderDecision(decision: PolicyDecision): TemplateResult {
    const variant = STATE_VARIANT[decision.state];
    return html`
      <div part="decision" role="listitem" data-state=${decision.state} data-category=${decision.category}>
        <div part="decision-header">
          <span part="category">${this.localize(CATEGORY_LABEL_KEY[decision.category])}</span>
          <span part="label">${decision.label}</span>
          <lr-badge part="state-badge" variant=${variant}>${this.localize(STATE_LABEL_KEY[decision.state])}</lr-badge>
        </div>
        <div part="explanation" data-state=${decision.state}>${decision.explanation}</div>
        ${decision.detail
          ? html`<lr-details part="detail" summary=${this.localize('policySummaryDetailLabel')}
              @lr-toggle=${this.stopNestedLifecycle}
              @lr-show=${this.stopNestedLifecycle}
              @lr-after-show=${this.stopNestedLifecycle}
              @lr-hide=${this.stopNestedLifecycle}
              @lr-after-hide=${this.stopNestedLifecycle}
              >${decision.detail}</lr-details
            >`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const decisions = this.normalizedDecisions;
    if (decisions.length === 0) {
      return html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`;
    }
    return html`
      <div part="base">
        <div part="summary">
          ${STATES.map((state) => {
            const count = this.countOf(state);
            const formattedCount = getNumberFormat(this.effectiveLocale).format(count);
            return html`<span part="count" data-state=${state}
              >${this.localize(STATE_COUNT_KEY[state], undefined, { count: formattedCount })}</span
            >`;
          })}
        </div>
        <div
          part="list"
          role="list"
          aria-label=${this.localize('policySummaryLabel')}
        >
          ${decisions.map((decision) => this.renderDecision(decision))}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-policy-summary': LyraPolicySummary;
  }
}
