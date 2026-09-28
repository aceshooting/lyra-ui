import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { styles } from './permission-grant.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_approvalQueuePending, LYRA_DEFAULT_collapse, LYRA_DEFAULT_confirmApproved, LYRA_DEFAULT_confirmDenied, LYRA_DEFAULT_deny, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_permissionGrantAllowOnce, LYRA_DEFAULT_permissionGrantAllowSession, LYRA_DEFAULT_permissionGrantLabel, LYRA_DEFAULT_permissionGrantScopeLabel, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type PermissionGrantStatus = 'pending' | 'granted' | 'denied';
export type PermissionGrantDecision = 'allow-once' | 'allow-session' | 'deny';

export interface LyraPermissionGrantEventMap {
  'lr-permission-decision': CustomEvent<{ requestId: string; decision: PermissionGrantDecision }>;
}

const DECISION_LABEL_KEY: Record<PermissionGrantDecision, string> = {
  'allow-once': 'permissionGrantAllowOnce',
  'allow-session': 'permissionGrantAllowSession',
  deny: 'deny',
};

/**
 * `<lr-permission-grant>` — a provider-neutral view of one permission request with explicit
 * allow-once, allow-for-session, and deny request events. The host validates the visible scope,
 * authorizes the action, and persists any decision. This component has no network or persistence
 * behavior and does not infer permission from the request text.
 *
 * @customElement lr-permission-grant
 * @event lr-permission-decision - A permission decision was requested. `detail: { requestId,
 *   decision }`. The host owns authorization and the controlled `status` value.
 * @csspart base - The fieldset and overall request group.
 * @csspart legend - The visible request label.
 * @csspart description - The host-supplied request description.
 * @csspart scope-label - The localized scope label.
 * @csspart scope - The host-supplied requested scope.
 * @csspart scope-row - The row grouping the scope label and requested scope text.
 * @csspart status - The localized controlled request status.
 * @csspart actions - The decision button group, rendered only while pending.
 * @csspart decision - One native decision button.
 * @status experimental
 * @since unreleased
 */
export class LyraPermissionGrant extends LyraElement<LyraPermissionGrantEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    approvalQueuePending: LYRA_DEFAULT_approvalQueuePending,
    collapse: LYRA_DEFAULT_collapse,
    confirmApproved: LYRA_DEFAULT_confirmApproved,
    confirmDenied: LYRA_DEFAULT_confirmDenied,
    deny: LYRA_DEFAULT_deny,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    permissionGrantAllowOnce: LYRA_DEFAULT_permissionGrantAllowOnce,
    permissionGrantAllowSession: LYRA_DEFAULT_permissionGrantAllowSession,
    permissionGrantLabel: LYRA_DEFAULT_permissionGrantLabel,
    permissionGrantScopeLabel: LYRA_DEFAULT_permissionGrantScopeLabel,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Stable identity supplied by the host. Decision events are suppressed for blank identities. */
  @property({ attribute: 'request-id' }) requestId = '';
  /** Visible request label; defaults to the localized generic permission-request label. */
  @property() label?: string;
  /** Host-supplied explanation of the requested operation. */
  @property() description = '';
  /** Host-supplied scope that must be validated by the host before authorization. */
  @property() scope = '';
  /** Controlled host-owned status. */
  @property() status: PermissionGrantStatus = 'pending';
  /** Disables every available decision action. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private dispatchingDecision = false;

  private get identifiedRequestId(): string | null {
    return typeof this.requestId === 'string' && this.requestId.trim().length > 0
      ? this.requestId
      : null;
  }

  private requestDecision(renderedRequestId: string, renderedScope: string, decision: PermissionGrantDecision): void {
    if (
      this.disabled ||
      this.status !== 'pending' ||
      this.identifiedRequestId !== renderedRequestId ||
      this.scope !== renderedScope ||
      this.dispatchingDecision
    ) return;
    this.dispatchingDecision = true;
    try {
      this.emit('lr-permission-decision', { requestId: renderedRequestId, decision });
    } finally {
      this.dispatchingDecision = false;
    }
  }

  override render(): TemplateResult {
    const visibleLabel = this.label == null ? this.localize('permissionGrantLabel') : this.label;
    const hostLabel = hostAriaLabel(this);
    const scope = this.scope;
    const statusLabel = this.status === 'granted'
      ? this.localize('confirmApproved')
      : this.status === 'denied'
        ? this.localize('confirmDenied')
        : this.localize('approvalQueuePending');
    const pending = this.status === 'pending';
    const requestId = this.identifiedRequestId;
    const identified = requestId !== null;
    return html`
      <fieldset part="base" aria-label=${hostLabel === null ? nothing : hostLabel} ?disabled=${this.disabled}>
        <legend part="legend">${visibleLabel}</legend>
        ${this.description ? html`<p part="description">${this.description}</p>` : nothing}
        <div part="scope-row">
          <span part="scope-label">${this.localize('permissionGrantScopeLabel')}</span>
          <span part="scope">${this.scope}</span>
        </div>
        <p part="status">${statusLabel}</p>
        ${pending
          ? html`<div part="actions">
              ${(['allow-once', 'allow-session', 'deny'] as const).map((decision) => html`
                <button
                  part="decision"
                  type="button"
                  data-decision=${decision}
                  ?disabled=${this.disabled || !identified}
                  @click=${() => {
                    if (requestId !== null) this.requestDecision(requestId, scope, decision);
                  }}
                >${this.localize(DECISION_LABEL_KEY[decision])}</button>
              `)}
            </div>`
          : nothing}
      </fieldset>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-permission-grant': LyraPermissionGrant;
  }
}
