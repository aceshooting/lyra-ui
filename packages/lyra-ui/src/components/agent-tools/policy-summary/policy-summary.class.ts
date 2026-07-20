import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/callout/callout.class.js';
import '../../layout/details/details.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './policy-summary.styles.js';

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

/** `allow` -> success, `deny` -> danger, `needs-review` -> warning -- shared by the state badge
 *  and the explanation callout so both always agree on a decision's visual weight. */
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

/**
 * `<lr-policy-summary>` — a read-only list of guardrail, permission, privacy, and tool-policy
 * decisions, each carrying an `allow` / `deny` / `needs-review` state and an always-visible,
 * accessible explanation of why that decision was made -- never conveyed by color alone.
 *
 * Composes `<lr-badge>` for the compact per-decision state indicator and `<lr-callout inline>`
 * for the explanation text: the callout's own `role="alert"`/`role="status"` semantics already
 * carry the right urgency per state (`deny` renders as an alert, `allow`/`needs-review` as
 * status), so this component only needs to pick the matching `variant` rather than re-implement
 * that wiring. `<lr-details>` renders a decision's optional richer `detail` (matched rule text,
 * policy id, cited evidence) behind progressive disclosure, collapsed by default, instead of
 * always showing it alongside the shorter `explanation`.
 *
 * `decisions` is controlled and never mutated by this component -- pass a new array (e.g. as a
 * guardrail pipeline resolves) to update it. This is a summary surface, not an approval gate:
 * there is no per-decision action here, and a decision's `state` is fixed data, not something a
 * viewer can change from this component.
 *
 * @customElement lr-policy-summary
 * @csspart base - The root wrapper, only rendered while `decisions` is non-empty.
 * @csspart summary - The always-visible allow/deny/needs-review count row.
 * @csspart count - One state's localized count text; carries `data-state`.
 * @csspart list - The `role="list"` wrapper around every decision row.
 * @csspart decision - One decision row (`role="listitem"`); carries `data-state` and `data-category`.
 * @csspart decision-header - The row's category/label/state-badge line.
 * @csspart category - The decision's localized category text.
 * @csspart label - The decision's `label` text.
 * @csspart state-badge - The resolved `<lr-badge>` state indicator.
 * @csspart explanation - The `<lr-callout inline>` wrapping the always-visible `explanation` text.
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
 */
export class LyraPolicySummary extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The decisions to render, in the given order. Controlled and never mutated by this component
   *  -- pass a new array to update it. */
  @property({ attribute: false }) decisions: PolicyDecision[] = [];

  private countOf(state: PolicyDecisionState): number {
    return this.decisions.filter((decision) => decision.state === state).length;
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
        <lr-callout part="explanation" variant=${variant} inline>${decision.explanation}</lr-callout>
        ${decision.detail
          ? html`<lr-details part="detail" summary=${this.localize('policySummaryDetailLabel')}
              >${decision.detail}</lr-details
            >`
          : nothing}
      </div>
    `;
  }

  render(): TemplateResult {
    if (this.decisions.length === 0) {
      return html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`;
    }
    return html`
      <div part="base">
        <div part="summary">
          ${STATES.map((state) => {
            const count = this.countOf(state);
            return html`<span part="count" data-state=${state}
              >${this.localize(STATE_COUNT_KEY[state], undefined, { count })}</span
            >`;
          })}
        </div>
        <div part="list" role="list" aria-label=${this.localize('policySummaryLabel')}>
          ${this.decisions.map((decision) => this.renderDecision(decision))}
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
