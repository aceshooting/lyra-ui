import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './permission-rules.styles.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_deny, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_permissionRulesAllow, LYRA_DEFAULT_permissionRulesAsk, LYRA_DEFAULT_permissionRulesDecisionFor, LYRA_DEFAULT_permissionRulesEmpty, LYRA_DEFAULT_permissionRulesLabel, LYRA_DEFAULT_permissionRulesLimit, LYRA_DEFAULT_permissionRulesScope, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type PermissionRuleDecision = 'allow' | 'ask' | 'deny';

/** One host-defined permission rule. The component presents this data and requests a decision
 *  change; it never evaluates or applies a policy. */
export interface PermissionRule {
  id: string;
  label: string;
  description?: string;
  scope: string;
  decision: PermissionRuleDecision;
}

export interface LyraPermissionRulesEventMap {
  'lr-permission-rule-change': CustomEvent<{ ruleId: string; decision: PermissionRuleDecision }>;
}

/** Ceiling on rule rows mounted into the DOM. */
const MAX_RENDERED_RULES = 100;
const DECISIONS: readonly PermissionRuleDecision[] = ['allow', 'ask', 'deny'];
const DECISION_LABEL_KEY: Record<PermissionRuleDecision, string> = {
  allow: 'permissionRulesAllow',
  ask: 'permissionRulesAsk',
  deny: 'deny',
};

/**
 * `<lr-permission-rules>` — a controlled list of host-defined permission rules with a native
 * keyboard-operable decision select for each rule. It emits `lr-permission-rule-change` requests
 * and never evaluates policy or applies the selected decision. Reassign a new `rules` array after
 * host changes; assigned collections are detached snapshots. Blank identities and duplicate ids
 * are omitted with the first valid occurrence winning, and at most 100 rows are rendered.
 *
 * @customElement lr-permission-rules
 * @event lr-permission-rule-change - A decision change was requested. `detail: { ruleId, decision }`.
 *   The collection remains controlled by the host; programmatic assignment is silent.
 * @csspart base - The fieldset and overall group.
 * @csspart legend - The visible group label.
 * @csspart list - The rendered rule rows.
 * @csspart rule - One rule row.
 * @csspart rule-label - The host-supplied rule label.
 * @csspart rule-copy - The text area containing the rule label and description.
 * @csspart description - Optional host-supplied rule description.
 * @csspart scope - The localized scope label and host-supplied scope.
 * @csspart decision - The native decision select.
 * @csspart empty - The empty state.
 * @csspart limit - Localized notice shown when more than 100 valid rules are supplied.
 * @status experimental
 * @since unreleased
 */
export class LyraPermissionRules extends LyraElement<LyraPermissionRulesEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    deny: LYRA_DEFAULT_deny,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    permissionRulesAllow: LYRA_DEFAULT_permissionRulesAllow,
    permissionRulesAsk: LYRA_DEFAULT_permissionRulesAsk,
    permissionRulesDecisionFor: LYRA_DEFAULT_permissionRulesDecisionFor,
    permissionRulesEmpty: LYRA_DEFAULT_permissionRulesEmpty,
    permissionRulesLabel: LYRA_DEFAULT_permissionRulesLabel,
    permissionRulesLimit: LYRA_DEFAULT_permissionRulesLimit,
    permissionRulesScope: LYRA_DEFAULT_permissionRulesScope,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = Object.freeze(['rules']);

  static override styles = [LyraElement.styles, styles];

  /** Ordered host-defined rules. Controlled and never mutated; blank ids are skipped and duplicate
   *  ids retain their first valid occurrence. */
  @property({ attribute: false }) rules: readonly PermissionRule[] = [];
  /** Accessible group name and visible legend. */
  @property() label?: string;
  /** Disables all decision controls. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Presents decisions without allowing edits. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  private get normalizedRules(): PermissionRule[] {
    const rules = Array.isArray(this.rules) ? this.rules : [];
    const valid = rules.filter((rule): rule is PermissionRule => {
      try {
        return Boolean(
          rule &&
            typeof rule.label === 'string' &&
            typeof rule.scope === 'string' &&
            DECISIONS.includes(rule.decision),
        );
      } catch {
        return false;
      }
    });
    return firstByIdentity(valid, (rule) => rule.id);
  }

  private decisionDispatching = false;

  private onDecisionChange(rule: PermissionRule, event: Event): void {
    const select = event.currentTarget as HTMLSelectElement;
    const decision = select.value as PermissionRuleDecision;
    const current = this.normalizedRules.find((candidate) => candidate.id === rule.id);
    if (this.decisionDispatching || this.disabled || this.readonly || current !== rule || !DECISIONS.includes(decision)) {
      select.value = current?.decision ?? rule.decision;
      return;
    }
    this.decisionDispatching = true;
    try {
      this.emit('lr-permission-rule-change', { ruleId: rule.id, decision });
    } finally {
      this.decisionDispatching = false;
      // A host may acknowledge synchronously while the native select still owns its changed value.
      const latest = this.normalizedRules.find((candidate) => candidate.id === rule.id);
      select.value = latest?.decision ?? rule.decision;
    }
  }

  private renderRule(rule: PermissionRule): TemplateResult {
    return html`
      <div part="rule">
        <div part="rule-copy">
          <span part="rule-label">${rule.label}</span>
          ${rule.description ? html`<span part="description">${rule.description}</span>` : nothing}
          <span part="scope">${this.localize('permissionRulesScope', undefined, { scope: rule.scope })}</span>
        </div>
        <select
          part="decision"
          aria-label=${this.localize('permissionRulesDecisionFor', undefined, { label: rule.label })}
          aria-readonly=${this.readonly ? 'true' : nothing}
          ?disabled=${this.disabled || this.readonly}
          @change=${(event: Event) => this.onDecisionChange(rule, event)}
        >
          ${DECISIONS.map((decision) => html`<option value=${decision} ?selected=${rule.decision === decision}>${this.localize(DECISION_LABEL_KEY[decision])}</option>`)}
        </select>
      </div>
    `;
  }

  override render(): TemplateResult {
    const rules = this.normalizedRules;
    const visibleLabel = this.label ?? this.localize('permissionRulesLabel');
    const hostLabel = hostAriaLabel(this);
    const visibleRules = rules.slice(0, MAX_RENDERED_RULES);
    return html`
      <fieldset part="base" aria-label=${hostLabel === null ? nothing : hostLabel} ?disabled=${this.disabled}>
        <legend part="legend">${visibleLabel}</legend>
        ${rules.length === 0
          ? html`<p part="empty">${this.localize('permissionRulesEmpty')}</p>`
          : html`<div part="list">${visibleRules.map((rule) => this.renderRule(rule))}</div>`}
        ${rules.length > MAX_RENDERED_RULES
          ? html`<p part="limit">${this.localize('permissionRulesLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_RULES),
            })}</p>`
          : nothing}
      </fieldset>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-permission-rules': LyraPermissionRules;
  }
}
