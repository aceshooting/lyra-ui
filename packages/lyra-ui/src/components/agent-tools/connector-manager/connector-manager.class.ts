import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './connector-manager.styles.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_connectorManagerConnect, LYRA_DEFAULT_connectorManagerConnectFor, LYRA_DEFAULT_connectorManagerDisconnect, LYRA_DEFAULT_connectorManagerDisconnectFor, LYRA_DEFAULT_connectorManagerEmpty, LYRA_DEFAULT_connectorManagerKindConnector, LYRA_DEFAULT_connectorManagerKindMcp, LYRA_DEFAULT_connectorManagerLabel, LYRA_DEFAULT_connectorManagerLimit, LYRA_DEFAULT_connectorManagerRetryFor, LYRA_DEFAULT_connectorManagerStatusConnected, LYRA_DEFAULT_connectorManagerStatusConnecting, LYRA_DEFAULT_connectorManagerStatusDisconnected, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type AgentConnectorKind = 'mcp' | 'connector';
export type AgentConnectorStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ConnectorAction = 'connect' | 'disconnect' | 'retry';

/** Host-owned connector metadata. `error`, when present, is already localized host text. */
export interface AgentConnector {
  id: string;
  name: string;
  description?: string;
  kind: AgentConnectorKind;
  status: AgentConnectorStatus;
  error?: string;
}

export interface LyraConnectorManagerEventMap {
  'lr-connector-action': CustomEvent<{ connectorId: string; action: ConnectorAction }>;
}

const MAX_RENDERED_CONNECTORS = 100;
const KINDS: readonly AgentConnectorKind[] = ['mcp', 'connector'];
const STATUSES: readonly AgentConnectorStatus[] = ['disconnected', 'connecting', 'connected', 'error'];
const KIND_LABEL_KEY: Record<AgentConnectorKind, string> = {
  mcp: 'connectorManagerKindMcp',
  connector: 'connectorManagerKindConnector',
};
const STATUS_LABEL_KEY: Record<AgentConnectorStatus, string> = {
  disconnected: 'connectorManagerStatusDisconnected',
  connecting: 'connectorManagerStatusConnecting',
  connected: 'connectorManagerStatusConnected',
  error: 'statusError',
};
const ACTION_LABEL_KEY: Record<ConnectorAction, string> = {
  connect: 'connectorManagerConnect',
  disconnect: 'connectorManagerDisconnect',
  retry: 'retry',
};
const ACTION_ACCESSIBLE_LABEL_KEY: Record<ConnectorAction, string> = {
  connect: 'connectorManagerConnectFor',
  disconnect: 'connectorManagerDisconnectFor',
  retry: 'connectorManagerRetryFor',
};

/**
 * `<lr-connector-manager>` — a controlled, provider-neutral connector list. It emits explicit
 * connect/disconnect/retry requests and never reads credentials, starts a server, or performs
 * network work. A `connecting` record has no action until the host supplies a new status. Error
 * text is caller data that the host has already localized. Collections are detached snapshots;
 * blank ids are skipped, duplicate ids retain the first valid item, and at most 100 rows render.
 *
 * @customElement lr-connector-manager
 * @event lr-connector-action - A connector action was requested. `detail: { connectorId, action }`.
 *   The host owns the operation and the controlled `connectors` array.
 * @csspart base - The fieldset and group.
 * @csspart legend - The visible component label.
 * @csspart list - The connector rows.
 * @csspart connector - One connector row, keyed by `data-connector-id`.
 * @csspart connector-controls - The action area for one connector row.
 * @csspart connector-copy - Connector name, kind and description.
 * @csspart name - The host-supplied connector name.
 * @csspart kind - The localized connector kind.
 * @csspart description - Optional host-supplied description.
 * @csspart status - The localized controlled connection status.
 * @csspart error - Optional host-localized error text.
 * @csspart action - The native action button.
 * @csspart empty - The empty state.
 * @csspart limit - Localized notice shown when more than 100 valid connectors are supplied.
 * @status experimental
 * @since 22.0.0
 */
export class LyraConnectorManager extends LyraElement<LyraConnectorManagerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    connectorManagerConnect: LYRA_DEFAULT_connectorManagerConnect,
    connectorManagerConnectFor: LYRA_DEFAULT_connectorManagerConnectFor,
    connectorManagerDisconnect: LYRA_DEFAULT_connectorManagerDisconnect,
    connectorManagerDisconnectFor: LYRA_DEFAULT_connectorManagerDisconnectFor,
    connectorManagerEmpty: LYRA_DEFAULT_connectorManagerEmpty,
    connectorManagerKindConnector: LYRA_DEFAULT_connectorManagerKindConnector,
    connectorManagerKindMcp: LYRA_DEFAULT_connectorManagerKindMcp,
    connectorManagerLabel: LYRA_DEFAULT_connectorManagerLabel,
    connectorManagerLimit: LYRA_DEFAULT_connectorManagerLimit,
    connectorManagerRetryFor: LYRA_DEFAULT_connectorManagerRetryFor,
    connectorManagerStatusConnected: LYRA_DEFAULT_connectorManagerStatusConnected,
    connectorManagerStatusConnecting: LYRA_DEFAULT_connectorManagerStatusConnecting,
    connectorManagerStatusDisconnected: LYRA_DEFAULT_connectorManagerStatusDisconnected,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = Object.freeze(['connectors']);

  static override styles = [LyraElement.styles, styles];

  /** Ordered host-owned connector records. The component never mutates this collection. */
  @property({ attribute: false }) connectors: readonly AgentConnector[] = [];
  /** Accessible group name and visible legend. */
  @property() label?: string;
  /** Disables every available connector action. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private dispatchingAction = false;

  private get normalizedConnectors(): AgentConnector[] {
    const connectors = Array.isArray(this.connectors) ? this.connectors : [];
    const valid = connectors.filter((connector): connector is AgentConnector => {
      try {
        return Boolean(
          connector &&
            typeof connector.name === 'string' &&
            KINDS.includes(connector.kind) &&
            STATUSES.includes(connector.status),
        );
      } catch {
        return false;
      }
    });
    return firstByIdentity(valid, (connector) => connector.id);
  }

  private actionFor(connector: AgentConnector): ConnectorAction | null {
    if (connector.status === 'disconnected') return 'connect';
    if (connector.status === 'connected') return 'disconnect';
    if (connector.status === 'error') return 'retry';
    return null;
  }

  private requestAction(connector: AgentConnector, action: ConnectorAction): void {
    const current = this.normalizedConnectors.find((item) => item.id === connector.id);
    if (this.disabled || !current || this.actionFor(current) !== action || this.dispatchingAction) return;
    this.dispatchingAction = true;
    try {
      this.emit('lr-connector-action', { connectorId: current.id, action });
    } finally {
      this.dispatchingAction = false;
    }
  }

  private renderConnector(connector: AgentConnector): TemplateResult {
    const action = this.actionFor(connector);
    return html`
      <div part="connector" role="listitem" data-connector-id=${connector.id}>
        <div part="connector-copy">
          <span part="name">${connector.name}</span>
          <span part="kind">${this.localize(KIND_LABEL_KEY[connector.kind])}</span>
          ${connector.description ? html`<span part="description">${connector.description}</span>` : nothing}
          ${connector.error ? html`<span part="error">${connector.error}</span>` : nothing}
        </div>
        <div part="connector-controls">
          <span part="status" data-status=${connector.status}>${this.localize(STATUS_LABEL_KEY[connector.status])}</span>
          ${action
            ? html`<button
                part="action"
                type="button"
                aria-label=${this.localize(ACTION_ACCESSIBLE_LABEL_KEY[action], undefined, { name: connector.name })}
                ?disabled=${this.disabled}
                @click=${() => this.requestAction(connector, action)}
              >${this.localize(ACTION_LABEL_KEY[action])}</button>`
            : nothing}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const connectors = this.normalizedConnectors;
    const visibleLabel = this.label == null ? this.localize('connectorManagerLabel') : this.label;
    const hostLabel = hostAriaLabel(this);
    return html`
      <fieldset part="base" aria-label=${hostLabel === null ? nothing : hostLabel} ?disabled=${this.disabled}>
        <legend part="legend">${visibleLabel}</legend>
        ${connectors.length === 0
          ? html`<p part="empty">${this.localize('connectorManagerEmpty')}</p>`
          : html`<div part="list" role="list">
              ${connectors.slice(0, MAX_RENDERED_CONNECTORS).map((connector) => this.renderConnector(connector))}
            </div>`}
        ${connectors.length > MAX_RENDERED_CONNECTORS
          ? html`<p part="limit">${this.localize('connectorManagerLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_CONNECTORS),
            })}</p>`
          : nothing}
      </fieldset>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-connector-manager': LyraConnectorManager;
  }
}
