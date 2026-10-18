import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { resolveListMove, isRovingTargetAvailable } from '../../../internal/list-navigation.js';
import { collectionSupport, publicCollectionTruncation, snapshotEventDetail } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { ref } from 'lit/directives/ref.js';
import { setSourcePageScope } from '../../../internal/source-page-scope.js';
import { tag } from '../../../internal/prefix.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { CancelEventDetail, RetryEventDetail } from '../../../ai/types.js';
import type { KnowledgeBaseSource, KnowledgeSource, LyraKnowledgeBase } from '../knowledge-base/knowledge-base.class.js';
export type { KnowledgeSource } from '../knowledge-base/knowledge-base.class.js';
import type { IngestionQueueSource, IngestionQueueItem, LyraIngestionQueue } from '../ingestion-queue/ingestion-queue.class.js';
export type { IngestionQueueItem } from '../ingestion-queue/ingestion-queue.class.js';
import { styles } from './knowledge-base-admin.styles.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_knowledgeBaseAdminIngestionTab, LYRA_DEFAULT_knowledgeBaseAdminInputLimit, LYRA_DEFAULT_knowledgeBaseAdminLabel, LYRA_DEFAULT_knowledgeBaseAdminSourcesTab } from '../../../internal/default-strings/retrieval.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type KnowledgeBaseAdminTab = 'sources' | 'ingestion';
const EMPTY_ROWS = Object.freeze([]);

export interface LyraKnowledgeBaseAdminEventMap {
  'lr-tab-change': CustomEvent<{ activeTab: KnowledgeBaseAdminTab }>;
  'lr-activate': CustomEvent<{ value: KnowledgeBaseAdminTab }>;
  'lr-source-create': CustomEvent<null>;
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
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Original input omissions are disclosed in input-limit before forwarding the retained collection.
 *
 * Optional dataSource and ingestionSource are opaque provider identities. Only the active child
 * receives its provider; changing tabs remounts that child at its default page. Same-reference
 * provider assignment and requestUpdate() refresh only the active child. Undefined restores the
 * corresponding legacy collection and its admission-loss notice. Provider rows and totals remain
 * owned by the children; the shell neither queries nor caches them.
 *
 * @customElement lr-knowledge-base-admin
 * @slot settings - Optional host-owned ingestion, chunking, embedding, or permissions controls.
 * @event lr-tab-change - The active operations tab changed. `detail: { activeTab }`.
 * @event lr-activate - Fired on every user activation of an available tab -- a click, or an
 *   Arrow/Home/End key -- whether or not `activeTab` actually moved. `detail: { value }` carries
 *   the activated tab, the same identity `lr-tab-change` reports. Bubbling and composed, so a host
 *   outside the shadow tree receives it. Not cancelable: it is a notification that the user picked
 *   a tab, not a veto point, and nothing in this component branches on it. Re-picking the active
 *   tab is the case `lr-tab-change` deliberately stays silent for -- "refresh that queue" is a real
 *   intent -- and from the keyboard it is otherwise unobservable, because Home on an already-first
 *   active tab (or End on an already-last one) activates a tab and produces no click at all. When
 *   an activation does move the tab, `lr-tab-change` is emitted first. The normalization that
 *   moves an invalid or newly-hidden tab back to Sources is not a user activation and fires only
 *   `lr-tab-change`.
 * @event lr-source-create - Forwarded source creation request.
 * @event lr-source-sync - Forwarded source sync request. `detail: { sourceId }`.
 * @event lr-source-pause - Forwarded source pause request. `detail: { sourceId }`.
 * @event lr-source-delete - Forwarded source deletion request. `detail: { sourceId }`.
 * @event lr-ingestion-retry - Forwarded ingestion retry request.
 * @event lr-ingestion-cancel - Forwarded ingestion cancel request.
 * @csspart input-limit - Original collection admission-loss notice.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    knowledgeBaseAdminIngestionTab: LYRA_DEFAULT_knowledgeBaseAdminIngestionTab,
    knowledgeBaseAdminInputLimit: LYRA_DEFAULT_knowledgeBaseAdminInputLimit,
    knowledgeBaseAdminLabel: LYRA_DEFAULT_knowledgeBaseAdminLabel,
    knowledgeBaseAdminSourcesTab: LYRA_DEFAULT_knowledgeBaseAdminSourcesTab,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['sources', 'ingestionItems']);

  protected static override readonly identityCollectionObjectProperties = Object.freeze(['dataSource', 'ingestionSource']);

  static override styles = [LyraElement.styles, styles];

  private _dataSource?: KnowledgeBaseSource;
  private _ingestionSource?: IngestionQueueSource;
  private forwardGeneration = 0;
  private readonly bindSourcePageScope = (child: Element | undefined): void => {
    if (child instanceof HTMLElement) setSourcePageScope(child, this);
  };

  /** Opaque inventory provider, forwarded only while Sources is active. Undefined restores sources.
   * Same-reference assignment refreshes the active child once. */
  @property({ attribute: false, hasChanged: () => true })
  get dataSource(): KnowledgeBaseSource | undefined { return this._dataSource; }
  set dataSource(value: KnowledgeBaseSource | undefined) {
    const old = this._dataSource; this._dataSource = value;
    if (this.activeView === 'sources') {
      this.forwardGeneration = (this.forwardGeneration ?? 0) + 1;
      const child = this.activeChild() as LyraKnowledgeBase | undefined;
      if (child) child.dataSource = value;
    }
    this.requestUpdate('dataSource', old);
  }

  /** Opaque queue provider, forwarded only while Ingestion is active. Undefined restores ingestionItems.
   * Same-reference assignment refreshes the active child once. */
  @property({ attribute: false, hasChanged: () => true })
  get ingestionSource(): IngestionQueueSource | undefined { return this._ingestionSource; }
  set ingestionSource(value: IngestionQueueSource | undefined) {
    const old = this._ingestionSource; this._ingestionSource = value;
    if (this.activeView === 'ingestion') {
      this.forwardGeneration = (this.forwardGeneration ?? 0) + 1;
      const child = this.activeChild() as LyraIngestionQueue | undefined;
      if (child) child.dataSource = value;
    }
    this.requestUpdate('ingestionSource', old);
  }

  private get activeView(): KnowledgeBaseAdminTab {
    return this.activeTab === 'ingestion' && !this.withoutIngestion ? 'ingestion' : 'sources';
  }
  private activeChild(): LyraKnowledgeBase | LyraIngestionQueue | undefined {
    if (!this.isConnected) return undefined;
    return this.shadowRoot?.querySelector<LyraKnowledgeBase | LyraIngestionQueue>(tag(this.activeView === 'sources' ? 'knowledge-base' : 'ingestion-queue')) ?? undefined;
  }
  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) {
      this.forwardGeneration = (this.forwardGeneration ?? 0) + 1;
      this.activeChild()?.requestUpdate();
    } else if ((args[0] === 'activeTab' && this.activeTab !== args[1]) || (args[0] === 'withoutIngestion' && this.withoutIngestion !== args[1])) {
      this.forwardGeneration = (this.forwardGeneration ?? 0) + 1;
    }
    super.requestUpdate(...args);
  }

  /** Knowledge-base source connectors. */
  @property({ attribute: false }) sources: readonly KnowledgeSource[] = [];
  /** Documents currently moving through ingestion. */
  @property({ attribute: false }) ingestionItems: readonly IngestionQueueItem[] = [];
  /** Active tab. Controlled by the host after `lr-tab-change` if desired. An invalid value, or an
   * ingestion tab that becomes unavailable, normalizes to `'sources'` through the same event
   * contract. */
  @property({ attribute: 'active-tab', reflect: true })
  activeTab: KnowledgeBaseAdminTab = 'sources';
  /** Accessible name and visible heading. Omitted falls back to a localized default; an
   *  explicitly empty `label` empties the visible heading, and the tablist keeps the localized name. */
  @property() label?: string;
  /** Semantic level of the heading, with the nested source inventory's heading one level below it;
   *  `none` removes heading semantics from both. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';
  /** Hides the ingestion tab and queue. An active/focused ingestion tab moves to Sources. */
  @property({ type: Boolean, attribute: 'without-ingestion' }) withoutIngestion =
    false;

  private readonly idPrefix = nextId('knowledge-base-admin');
  private focusSourcesAfterUpdate = false;

  private tabId(tab: KnowledgeBaseAdminTab): string {
    return `${this.idPrefix}-${tab}-tab`;
  }

  private panelId(tab: KnowledgeBaseAdminTab): string {
    return `${this.idPrefix}-${tab}-panel`;
  }

  private setTab(tab: KnowledgeBaseAdminTab): void {
    if (tab === 'ingestion' && this.withoutIngestion) return;
    if (tab !== this.activeTab) {
      this.activeTab = tab;
      this.emit('lr-tab-change', { activeTab: tab });
    }
    // Every activation of an available tab reports, including the re-pick of the active tab that
    // `lr-tab-change` is defined to stay silent for. See the class doc's `lr-activate` entry.
    this.emit('lr-activate', { value: tab });
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const invalidTab =
      this.activeTab !== 'sources' && this.activeTab !== 'ingestion';
    const unavailableIngestion =
      this.withoutIngestion && this.activeTab === 'ingestion';
    if (!invalidTab && !unavailableIngestion) return;
    this.focusSourcesAfterUpdate =
      shadowFocusTarget(this)?.matches('[role="tab"]') ?? false;
    this.activeTab = 'sources';
    this.emit('lr-tab-change', { activeTab: 'sources' });
  }

  private lastInputNotice = '';
  private inputNoticeMounted = false;
  private readonly inputAnnouncements = new AnnouncementSinkController(this);
  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) super.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.forwardGeneration++;
    super.disconnectedCallback();
    this.inputNoticeMounted = false;
  }
  override adoptedCallback(): void {
    this.forwardGeneration++;
    super.adoptedCallback();
    this.inputAnnouncements.adopted();
  }
  private inputLimitMessage(): string {
    const property = this.activeView === 'ingestion' ? 'ingestionItems' : 'sources';
    if (property === 'sources' ? this.dataSource !== undefined : this.ingestionSource !== undefined) return '';
    const loss = publicCollectionTruncation(this, property);
    const format = getNumberFormat(this.effectiveLocale);
    return loss ? this.localize('knowledgeBaseAdminInputLimit', undefined, {
      collection: this.localize(property === 'sources' ? 'knowledgeBaseAdminSourcesTab' : 'knowledgeBaseAdminIngestionTab'),
      count: format.format(loss.retained), total: format.format(loss.source),
    }) : '';
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const notice = this.inputLimitMessage();
    if (this.inputNoticeMounted && notice && notice !== this.lastInputNotice) this.inputAnnouncements.announcePolite(notice);
    this.lastInputNotice = notice;
    this.inputNoticeMounted = true;
    if (!this.focusSourcesAfterUpdate) return;
    this.focusSourcesAfterUpdate = false;
    this.shadowRoot
      ?.querySelector<HTMLButtonElement>(`#${this.tabId('sources')}`)
      ?.focus();
  }

  private handleTabKeydown(
    event: KeyboardEvent,
    current: KnowledgeBaseAdminTab
  ): void {
    const tabs: KnowledgeBaseAdminTab[] = this.withoutIngestion
      ? ['sources']
      : ['sources', 'ingestion'];
    const nextIndex = resolveListMove(event, {
      count: tabs.length,
      current: tabs.indexOf(current),
      orientation: 'horizontal',
      direction: this.effectiveDirection,
      isAvailable: (index) => {
        const target = this.shadowRoot?.getElementById(this.tabId(tabs[index]!));
        return Boolean(target && isRovingTargetAvailable(target));
      },
    });
    if (nextIndex === null) return;

    event.preventDefault();
    const next = tabs[nextIndex]!;
    this.setTab(next);
    void this.updateComplete.then(() => {
      this.shadowRoot
        ?.querySelector<HTMLButtonElement>(`#${this.tabId(next)}`)
        ?.focus();
    });
  }

  private forward(
    event: Event,
    name: keyof LyraKnowledgeBaseAdminEventMap,
    current: () => boolean,
    readDetail: () => unknown,
  ): void {
    event.stopPropagation();
    if (!current()) return;
    const detail = readDetail();
    if (!current()) return;
    const snapshot = snapshotEventDetail(detail, this.ownerDocument.defaultView);
    if (current()) this.emit(name as never, snapshot as never);
  }

  override render(): TemplateResult {
    const visibleLabel =
      this.label == null ? this.localize('knowledgeBaseAdminLabel') : this.label;
    // A host aria-label wins over the internal tablist's computed accessible name; the visible
    // heading keeps showing `visibleLabel`, and the tablist is never left unnamed.
    const tablistLabel =
      hostAriaLabel(this) ??
      (visibleLabel || this.localize('knowledgeBaseAdminLabel'));
    const tab: KnowledgeBaseAdminTab =
      this.activeTab === 'ingestion' && !this.withoutIngestion
        ? 'ingestion'
        : 'sources';
    const generation = this.forwardGeneration; const owner = this.ownerDocument;
    const current = (event: Event) => () => this.isConnected && this.ownerDocument === owner && this.forwardGeneration === generation && this.activeView === tab && event.currentTarget === this.activeChild();
    const notice = this.inputLimitMessage();
    const level = resolveHeadingLevel(this.headingLevel);
    const childLevel = level ? (String(Math.min(6, +level + 1)) as LyraHeadingLevel) : 'none';
    return html`<section part="base">
      <div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${visibleLabel}</div>
      ${notice ? html`<p part="input-limit" role="note">${notice}</p>` : nothing}
      <div part="tabs" role="tablist" aria-label=${tablistLabel}>
        <button
          part="tab"
          id=${this.tabId('sources')}
          type="button"
          role="tab"
          aria-controls=${this.panelId('sources')}
          aria-selected=${tab === 'sources' ? 'true' : 'false'}
          tabindex=${tab === 'sources' ? '0' : '-1'}
          @click=${() => this.setTab('sources')}
          @keydown=${(event: KeyboardEvent) =>
            this.handleTabKeydown(event, 'sources')}
        >
          ${this.localize('knowledgeBaseAdminSourcesTab')}
        </button>
        ${this.withoutIngestion
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
              @keydown=${(event: KeyboardEvent) =>
                this.handleTabKeydown(event, 'ingestion')}
            >
              ${this.localize('knowledgeBaseAdminIngestionTab')}
            </button>`}
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
              ${ref(this.bindSourcePageScope)}
              .dataSource=${live(this.dataSource)}
              .sources=${this.dataSource === undefined ? this.sources : EMPTY_ROWS}
              .headingLevel=${childLevel}
              @lr-source-create=${(event: Event) =>
                this.forward(event, 'lr-source-create', current(event), () => undefined)}
              @lr-source-sync=${(event: CustomEvent<{ sourceId: string }>) =>
                this.forward(event, 'lr-source-sync', current(event), () => event.detail)}
              @lr-source-pause=${(event: CustomEvent<{ sourceId: string }>) =>
                this.forward(event, 'lr-source-pause', current(event), () => event.detail)}
              @lr-source-delete=${(event: CustomEvent<{ sourceId: string }>) =>
                this.forward(event, 'lr-source-delete', current(event), () => event.detail)}
            ></lr-knowledge-base>`
          : nothing}
      </div>
      ${this.withoutIngestion
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
                  ${ref(this.bindSourcePageScope)}
                  .dataSource=${live(this.ingestionSource)}
                  .items=${this.ingestionSource === undefined ? this.ingestionItems : EMPTY_ROWS}
                  @lr-retry=${(
                    event: CustomEvent<RetryEventDetail & { itemId: string }>
                  ) => this.forward(event, 'lr-ingestion-retry', current(event), () => event.detail)}
                  @lr-cancel=${(
                    event: CustomEvent<CancelEventDetail & { itemId: string }>
                  ) => this.forward(event, 'lr-ingestion-cancel', current(event), () => event.detail)}
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
