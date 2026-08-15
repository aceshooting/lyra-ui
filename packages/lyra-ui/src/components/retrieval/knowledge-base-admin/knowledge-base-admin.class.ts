import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import type { CancelEventDetail, RetryEventDetail } from "../../../ai/types.js";
import type { KnowledgeSource } from "../knowledge-base/knowledge-base.class.js";
import type { IngestionQueueItem } from "../ingestion-queue/ingestion-queue.class.js";
import { styles } from "./knowledge-base-admin.styles.js";
import { activeElementIn } from "../../../internal/active-element.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_knowledgeBaseAdminIngestionTab, LYRA_DEFAULT_knowledgeBaseAdminLabel, LYRA_DEFAULT_knowledgeBaseAdminSourcesTab } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

let knowledgeBaseAdminInstance = 0;

export type KnowledgeBaseAdminTab = "sources" | "ingestion";

export interface LyraKnowledgeBaseAdminEventMap {
  "lr-tab-change": CustomEvent<{ tab: KnowledgeBaseAdminTab }>;
  "lr-source-create": CustomEvent<null>;
  "lr-source-sync": CustomEvent<{ sourceId: string }>;
  "lr-source-pause": CustomEvent<{ sourceId: string }>;
  "lr-source-delete": CustomEvent<{ sourceId: string }>;
  "lr-ingestion-retry": CustomEvent<RetryEventDetail & { itemId: string }>;
  "lr-ingestion-cancel": CustomEvent<CancelEventDetail & { itemId: string }>;
}

/**
 * `<lr-knowledge-base-admin>` — a responsive operations shell composing the existing controlled
 * source inventory and ingestion queue into one tabbed knowledge-base view. It forwards every
 * source/ingestion action under a namespaced event and never creates connectors, uploads files, or
 * changes indexing configuration itself. Put configuration controls in the `settings` slot.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
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
 * @cssprop [--lr-knowledge-base-admin-tab-selected-border=var(--lr-color-brand)] - Bottom border
 *   color of the selected `[part="tab"]`.
 * @cssprop [--lr-knowledge-base-admin-tab-selected-color=var(--lr-color-text)] - Text color of the
 *   selected `[part="tab"]`. `::part(tab)[aria-selected='true']` is invalid CSS, so this pair is
 *   the only way to restyle the active tab without re-pointing the shared brand/text tokens.
 * @status stable
 * @since 6.2.0
 */
export class LyraKnowledgeBaseAdmin extends LyraElement<LyraKnowledgeBaseAdminEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(["sources", "ingestionItems"]);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    knowledgeBaseAdminIngestionTab: LYRA_DEFAULT_knowledgeBaseAdminIngestionTab,
    knowledgeBaseAdminLabel: LYRA_DEFAULT_knowledgeBaseAdminLabel,
    knowledgeBaseAdminSourcesTab: LYRA_DEFAULT_knowledgeBaseAdminSourcesTab,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Knowledge-base source connectors. */
  @property({ attribute: false }) sources: readonly KnowledgeSource[] = [];
  /** Documents currently moving through ingestion. */
  @property({ attribute: false }) ingestionItems: readonly IngestionQueueItem[] = [];
  /** Active tab. Controlled by the host after `lr-tab-change` if desired. An invalid value, or an
   * ingestion tab that becomes unavailable, normalizes to `'sources'` through the same event
   * contract. */
  @property({ attribute: "active-tab", reflect: true })
  activeTab: KnowledgeBaseAdminTab = "sources";
  /** Accessible name and visible heading. */
  @property() label = "";
  /** Hides the ingestion tab and queue. An active/focused ingestion tab moves to Sources. */
  @property({ type: Boolean, attribute: "hide-ingestion" }) hideIngestion =
    false;

  private readonly idPrefix = `lr-knowledge-base-admin-${++knowledgeBaseAdminInstance}`;
  private focusSourcesAfterUpdate = false;

  private tabId(tab: KnowledgeBaseAdminTab): string {
    return `${this.idPrefix}-${tab}-tab`;
  }

  private panelId(tab: KnowledgeBaseAdminTab): string {
    return `${this.idPrefix}-${tab}-panel`;
  }

  private setTab(tab: KnowledgeBaseAdminTab): void {
    if (tab === "ingestion" && this.hideIngestion) return;
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.emit("lr-tab-change", { tab });
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const invalidTab =
      this.activeTab !== "sources" && this.activeTab !== "ingestion";
    const unavailableIngestion =
      this.hideIngestion && this.activeTab === "ingestion";
    if (!invalidTab && !unavailableIngestion) return;
    this.focusSourcesAfterUpdate =
      activeElementIn(this.shadowRoot)?.matches('[role="tab"]') ?? false;
    this.activeTab = "sources";
    this.emit("lr-tab-change", { tab: "sources" });
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!this.focusSourcesAfterUpdate) return;
    this.focusSourcesAfterUpdate = false;
    this.shadowRoot
      ?.querySelector<HTMLButtonElement>(`#${this.tabId("sources")}`)
      ?.focus();
  }

  private handleTabKeydown(
    event: KeyboardEvent,
    current: KnowledgeBaseAdminTab
  ): void {
    const tabs: KnowledgeBaseAdminTab[] = this.hideIngestion
      ? ["sources"]
      : ["sources", "ingestion"];
    const currentIndex = tabs.indexOf(current);
    const previousKey =
      this.effectiveDirection === "rtl" ? "ArrowRight" : "ArrowLeft";
    const nextKey =
      this.effectiveDirection === "rtl" ? "ArrowLeft" : "ArrowRight";
    let nextIndex = currentIndex;
    if (event.key === previousKey)
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === nextKey)
      nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
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

  private forward<T>(
    event: Event,
    name: keyof LyraKnowledgeBaseAdminEventMap,
    detail: T
  ): void {
    event.stopPropagation();
    this.emit(name as never, detail as never);
  }

  override render(): TemplateResult {
    const visibleLabel = this.label || this.localize("knowledgeBaseAdminLabel");
    const tab: KnowledgeBaseAdminTab =
      this.activeTab === "ingestion" && !this.hideIngestion
        ? "ingestion"
        : "sources";
    return html`<section part="base">
      <h2 part="heading">${visibleLabel}</h2>
      <div part="tabs" role="tablist" aria-label=${visibleLabel}>
        <button
          part="tab"
          id=${this.tabId("sources")}
          type="button"
          role="tab"
          aria-controls=${this.panelId("sources")}
          aria-selected=${tab === "sources" ? "true" : "false"}
          tabindex=${tab === "sources" ? "0" : "-1"}
          @click=${() => this.setTab("sources")}
          @keydown=${(event: KeyboardEvent) =>
            this.handleTabKeydown(event, "sources")}
        >
          ${this.localize("knowledgeBaseAdminSourcesTab")}
        </button>
        ${this.hideIngestion
          ? nothing
          : html`<button
              part="tab"
              id=${this.tabId("ingestion")}
              type="button"
              role="tab"
              aria-controls=${this.panelId("ingestion")}
              aria-selected=${tab === "ingestion" ? "true" : "false"}
              tabindex=${tab === "ingestion" ? "0" : "-1"}
              @click=${() => this.setTab("ingestion")}
              @keydown=${(event: KeyboardEvent) =>
                this.handleTabKeydown(event, "ingestion")}
            >
              ${this.localize("knowledgeBaseAdminIngestionTab")}
            </button>`}
      </div>
      <div
        part="panel"
        id=${this.panelId("sources")}
        role="tabpanel"
        aria-labelledby=${this.tabId("sources")}
        ?hidden=${tab !== "sources"}
      >
        ${tab === "sources"
          ? html`<lr-knowledge-base
              .sources=${this.sources}
              @lr-source-create=${(event: Event) =>
                this.forward(event, "lr-source-create", undefined)}
              @lr-source-sync=${(event: CustomEvent<{ sourceId: string }>) =>
                this.forward(event, "lr-source-sync", event.detail)}
              @lr-source-pause=${(event: CustomEvent<{ sourceId: string }>) =>
                this.forward(event, "lr-source-pause", event.detail)}
              @lr-source-delete=${(event: CustomEvent<{ sourceId: string }>) =>
                this.forward(event, "lr-source-delete", event.detail)}
            ></lr-knowledge-base>`
          : nothing}
      </div>
      ${this.hideIngestion
        ? nothing
        : html`<div
            part="panel"
            id=${this.panelId("ingestion")}
            role="tabpanel"
            aria-labelledby=${this.tabId("ingestion")}
            ?hidden=${tab !== "ingestion"}
          >
            ${tab === "ingestion"
              ? html`<lr-ingestion-queue
                  .items=${this.ingestionItems}
                  @lr-retry=${(
                    event: CustomEvent<RetryEventDetail & { itemId: string }>
                  ) => this.forward(event, "lr-ingestion-retry", event.detail)}
                  @lr-cancel=${(
                    event: CustomEvent<CancelEventDetail & { itemId: string }>
                  ) => this.forward(event, "lr-ingestion-cancel", event.detail)}
                ></lr-ingestion-queue>`
              : nothing}
          </div>`}
      <div part="settings"><slot name="settings"></slot></div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-knowledge-base-admin": LyraKnowledgeBaseAdmin;
  }
}
