import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { CancelEventDetail, RetryEventDetail } from '../../../ai/types.js';
import type { KnowledgeSource } from '../knowledge-base/knowledge-base.class.js';
import type { IngestionQueueItem } from '../ingestion-queue/ingestion-queue.class.js';
import '../knowledge-base/knowledge-base.js';
import '../ingestion-queue/ingestion-queue.js';
import { styles } from './knowledge-base-admin.styles.js';

let knowledgeBaseAdminInstance = 0;

export type KnowledgeBaseAdminTab = 'sources' | 'ingestion';

export interface LyraKnowledgeBaseAdminEventMap {
  'lr-tab-change': CustomEvent<{ tab: KnowledgeBaseAdminTab }>;
  'lr-source-create': CustomEvent<undefined>;
  'lr-source-sync': CustomEvent<{ sourceId: string }>;
  'lr-source-pause': CustomEvent<{ sourceId: string }>;
  'lr-source-delete': CustomEvent<{ sourceId: string }>;
  'lr-ingestion-retry': CustomEvent<RetryEventDetail & { itemId: string }>;
  'lr-ingestion-cancel': CustomEvent<CancelEventDetail & { itemId: string }>;
}

/**
 * `<lr-knowledge-base-admin>` — a responsive operations shell composing the existing controlled
 * source inventory and ingestion queue into one tabbed knowledge-base view. It forwards every
 * source/ingestion action under a namespaced event and never creates connectors, uploads files, or
 * changes indexing configuration itself. Put configuration controls in the `settings` slot.
 *
 * @customElement lr-knowledge-base-admin
 * @slot settings - Optional host-owned ingestion, chunking, embedding, or permissions controls.
 * @event lr-tab-change - The active operations tab changed. `detail: { tab }`.
 * @event lr-source-create - Forwarded source creation request.
 * @event lr-source-sync - Forwarded source sync request. `detail: { sourceId }`.
 * @event lr-source-pause - Forwarded source pause request. `detail: { sourceId }`.
 * @event lr-source-delete - Forwarded source deletion request. `detail: { sourceId }`.
 * @event lr-ingestion-retry - Forwarded ingestion retry request.
 * @event lr-ingestion-cancel - Forwarded ingestion cancel request.
 * @csspart base - The root admin wrapper.
 * @csspart heading - The visible heading.
 * @csspart tabs - The tablist.
 * @csspart tab - One tab button.
 * @csspart panel - The active panel.
 * @csspart settings - The settings slot wrapper.
 */
export class LyraKnowledgeBaseAdmin extends LyraElement<LyraKnowledgeBaseAdminEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Knowledge-base source connectors. */
  @property({ attribute: false }) sources: KnowledgeSource[] = [];
  /** Documents currently moving through ingestion. */
  @property({ attribute: false }) ingestionItems: IngestionQueueItem[] = [];
  /** Active tab. Controlled by the host after `lr-tab-change` if desired. */
  @property({ attribute: 'active-tab', reflect: true }) activeTab: KnowledgeBaseAdminTab = 'sources';
  /** Accessible name and visible heading. */
  @property() label = '';
  /** Hides the ingestion tab and queue. */
  @property({ type: Boolean, attribute: 'hide-ingestion' }) hideIngestion = false;

  private readonly idPrefix = `lr-knowledge-base-admin-${++knowledgeBaseAdminInstance}`;

  private tabId(tab: KnowledgeBaseAdminTab): string {
    return `${this.idPrefix}-${tab}-tab`;
  }

  private panelId(tab: KnowledgeBaseAdminTab): string {
    return `${this.idPrefix}-${tab}-panel`;
  }

  private setTab(tab: KnowledgeBaseAdminTab): void {
    if (tab === 'ingestion' && this.hideIngestion) return;
    this.activeTab = tab;
    this.emit('lr-tab-change', { tab });
  }

  private handleTabKeydown(event: KeyboardEvent, current: KnowledgeBaseAdminTab): void {
    const tabs: KnowledgeBaseAdminTab[] = this.hideIngestion
      ? ['sources']
      : ['sources', 'ingestion'];
    const currentIndex = tabs.indexOf(current);
    const previousKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const nextKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    let nextIndex = currentIndex;
    if (event.key === previousKey) nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === nextKey) nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const next = tabs[nextIndex]!;
    this.setTab(next);
    void this.updateComplete.then(() => {
      this.shadowRoot
        ?.querySelector<HTMLButtonElement>(`#${this.tabId(next)}`)
        ?.focus();
    });
  }

  private forward<T>(event: Event, name: keyof LyraKnowledgeBaseAdminEventMap, detail: T): void {
    event.stopPropagation();
    this.emit(name as never, detail as never);
  }

  override render(): TemplateResult {
    const label = this.label || this.localize('knowledgeBaseAdminLabel');
    const tab = this.hideIngestion && this.activeTab === 'ingestion' ? 'sources' : this.activeTab;
    return html`<section part="base" aria-label=${label}>
      <h2 part="heading">${label}</h2>
      <div part="tabs" role="tablist" aria-label=${label}>
        <button
          part="tab"
          id=${this.tabId('sources')}
          type="button"
          role="tab"
          aria-controls=${this.panelId('sources')}
          aria-selected=${tab === 'sources' ? 'true' : 'false'}
          tabindex=${tab === 'sources' ? '0' : '-1'}
          @click=${() => this.setTab('sources')}
          @keydown=${(event: KeyboardEvent) => this.handleTabKeydown(event, 'sources')}
          >${this.localize('knowledgeBaseAdminSourcesTab')}</button
        >
        ${this.hideIngestion
          ? nothing
          : html`<button
              part="tab"
              id=${this.tabId('ingestion')}
              type="button"
              role="tab"
              aria-controls=${this.panelId('ingestion')}
              aria-selected=${tab === 'ingestion' ? 'true' : 'false'}
              tabindex=${tab === 'ingestion' ? '0' : '-1'}
              @click=${() => this.setTab('ingestion')}
              @keydown=${(event: KeyboardEvent) => this.handleTabKeydown(event, 'ingestion')}
              >${this.localize('knowledgeBaseAdminIngestionTab')}</button
            >`}
      </div>
      <div
        part="panel"
        id=${this.panelId('sources')}
        role="tabpanel"
        aria-labelledby=${this.tabId('sources')}
        ?hidden=${tab !== 'sources'}
      >
        ${tab === 'sources'
          ? html`<lr-knowledge-base
              .sources=${this.sources}
              @lr-kb-create=${(event: Event) => this.forward(event, 'lr-source-create', undefined)}
              @lr-kb-sync=${(event: CustomEvent<{ sourceId: string }>) => this.forward(event, 'lr-source-sync', event.detail)}
              @lr-kb-pause=${(event: CustomEvent<{ sourceId: string }>) => this.forward(event, 'lr-source-pause', event.detail)}
              @lr-kb-delete=${(event: CustomEvent<{ sourceId: string }>) => this.forward(event, 'lr-source-delete', event.detail)}
            ></lr-knowledge-base>`
          : nothing}
      </div>
      ${this.hideIngestion
        ? nothing
        : html`<div
            part="panel"
            id=${this.panelId('ingestion')}
            role="tabpanel"
            aria-labelledby=${this.tabId('ingestion')}
            ?hidden=${tab !== 'ingestion'}
          >
            ${tab === 'ingestion'
              ? html`<lr-ingestion-queue
              .items=${this.ingestionItems}
              @lr-retry=${(event: CustomEvent<RetryEventDetail & { itemId: string }>) => this.forward(event, 'lr-ingestion-retry', event.detail)}
              @lr-cancel=${(event: CustomEvent<CancelEventDetail & { itemId: string }>) => this.forward(event, 'lr-ingestion-cancel', event.detail)}
            ></lr-ingestion-queue>`
              : nothing}
          </div>`}
      <div part="settings"><slot name="settings"></slot></div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-knowledge-base-admin': LyraKnowledgeBaseAdmin;
  }
}
