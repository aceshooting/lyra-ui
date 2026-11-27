import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { byteFormat, formatByteSize } from '../../../internal/bytes.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { repairControlFocusOnUpdate } from '../../../internal/control-focus-repair.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  canTransferAction, eligibleTransferIds, normalizeTransfers, sampleTransfers, totalTransferMetrics,
  transferMetrics, type LyraTransfer, type LyraTransferAction, type TransferMetrics, type TransferSample,
} from './transfer-manager-metrics.js';
import { styles } from './transfer-manager.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_connectorManagerStatusChanged, LYRA_DEFAULT_expand, LYRA_DEFAULT_pause, LYRA_DEFAULT_retry, LYRA_DEFAULT_showMoreCount, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_transferManagerBytes, LYRA_DEFAULT_transferManagerCancelAll, LYRA_DEFAULT_transferManagerCancelled, LYRA_DEFAULT_transferManagerCount, LYRA_DEFAULT_transferManagerEmpty, LYRA_DEFAULT_transferManagerEta, LYRA_DEFAULT_transferManagerItemAction, LYRA_DEFAULT_transferManagerLabel, LYRA_DEFAULT_transferManagerPauseAll, LYRA_DEFAULT_transferManagerPaused, LYRA_DEFAULT_transferManagerResume, LYRA_DEFAULT_transferManagerResumeAll, LYRA_DEFAULT_transferManagerRetryAll, LYRA_DEFAULT_transferManagerUnknownEta } from '../../../internal/default-strings/utility.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraTransfer, LyraTransferAction, LyraTransferStatus } from './transfer-manager-metrics.js';
export type LyraTransferPlacement = 'header' | 'floating';
export interface LyraTransferActionDetail { readonly ids: readonly string[]; }
export interface LyraTransferManagerEventMap {
  'lr-transfer-pause': CustomEvent<LyraTransferActionDetail>;
  'lr-transfer-resume': CustomEvent<LyraTransferActionDetail>;
  'lr-transfer-cancel': CustomEvent<LyraTransferActionDetail>;
  'lr-transfer-retry': CustomEvent<LyraTransferActionDetail>;
}

const ACTIONS = ['pause', 'resume', 'cancel', 'retry'] as const;
const ACTION_LABEL = { pause: 'pause', resume: 'transferManagerResume', cancel: 'cancel', retry: 'retry' } as const;
const BULK_LABEL = {
  pause: 'transferManagerPauseAll', resume: 'transferManagerResumeAll',
  cancel: 'transferManagerCancelAll', retry: 'transferManagerRetryAll',
} as const;
const STATUS_LABEL = {
  queued: 'statusPending', active: 'statusRunning', paused: 'transferManagerPaused', done: 'statusSuccess',
  error: 'statusError', cancelled: 'transferManagerCancelled',
} as const;
const PAGE_SIZE = 100;

/**
 * Displays caller-controlled transfers, per-item and overall progress, throughput and remaining time.
 * Assign a new transfers snapshot when a counter or status changes. Transfer controls request an
 * action from the application, which performs the operation and supplies the next snapshot.
 * Throughput and remaining time expire after ten seconds without a new snapshot, so a stalled
 * connection reads as unknown rather than as its last speed; supply a fresh snapshot (even with
 * unchanged counters) at least that often while transfers are active. Completion and failure of
 * a transfer are announced to assistive technology; counter updates are not.
 *
 * @customElement lr-transfer-manager
 * @event lr-transfer-pause - Requests pausing queued or active transfers. Detail contains eligible ids in input order.
 * @event lr-transfer-resume - Requests resuming paused transfers. Detail contains eligible ids in input order.
 * @event lr-transfer-cancel - Requests cancelling queued, active or paused transfers. Detail contains eligible ids in input order.
 * @event lr-transfer-retry - Requests retrying failed or cancelled transfers. Detail contains eligible ids in input order.
 * @csspart base - The named transfer region.
 * @csspart header - The disclosure header.
 * @csspart disclosure - The expand or collapse button.
 * @csspart summary - Aggregate transfer metrics.
 * @csspart overall-progress - Native progress indicator for the entire queue.
 * @csspart panel - The collapsible bulk controls and transfer list.
 * @csspart bulk-actions - Available queue actions.
 * @csspart list - The ordered transfer rows.
 * @csspart item - One transfer row.
 * @csspart name - The transfer name.
 * @csspart status - The localized transfer state.
 * @csspart metrics - The byte, rate and remaining-time values.
 * @csspart bytes - Transferred and known total bytes.
 * @csspart rate - The measured transfer rate.
 * @csspart eta - The estimated time remaining.
 * @csspart progress - A transfer's native progress indicator.
 * @csspart item-actions - Available actions for one transfer.
 * @csspart action - A transfer action or the button revealing additional rows.
 * @csspart empty - The empty queue message.
 * @status experimental
 * @since unreleased
 */
export class LyraTransferManager extends LyraElement<LyraTransferManagerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    cancel: LYRA_DEFAULT_cancel,
    collapse: LYRA_DEFAULT_collapse,
    connectorManagerStatusChanged: LYRA_DEFAULT_connectorManagerStatusChanged,
    expand: LYRA_DEFAULT_expand,
    pause: LYRA_DEFAULT_pause,
    retry: LYRA_DEFAULT_retry,
    showMoreCount: LYRA_DEFAULT_showMoreCount,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    transferManagerBytes: LYRA_DEFAULT_transferManagerBytes,
    transferManagerCancelAll: LYRA_DEFAULT_transferManagerCancelAll,
    transferManagerCancelled: LYRA_DEFAULT_transferManagerCancelled,
    transferManagerCount: LYRA_DEFAULT_transferManagerCount,
    transferManagerEmpty: LYRA_DEFAULT_transferManagerEmpty,
    transferManagerEta: LYRA_DEFAULT_transferManagerEta,
    transferManagerItemAction: LYRA_DEFAULT_transferManagerItemAction,
    transferManagerLabel: LYRA_DEFAULT_transferManagerLabel,
    transferManagerPauseAll: LYRA_DEFAULT_transferManagerPauseAll,
    transferManagerPaused: LYRA_DEFAULT_transferManagerPaused,
    transferManagerResume: LYRA_DEFAULT_transferManagerResume,
    transferManagerResumeAll: LYRA_DEFAULT_transferManagerResumeAll,
    transferManagerRetryAll: LYRA_DEFAULT_transferManagerRetryAll,
    transferManagerUnknownEta: LYRA_DEFAULT_transferManagerUnknownEta,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  /** @internal A rate older than this without a new snapshot no longer measures the connection. */
  static staleRateMs = 10_000;
  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-transfer-pause', 'lr-transfer-resume', 'lr-transfer-cancel', 'lr-transfer-retry',
  ]);
  // Every ID array is freshly allocated and frozen before dispatch; retain the complete selection.
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-transfer-pause': ['ids'], 'lr-transfer-resume': ['ids'], 'lr-transfer-cancel': ['ids'], 'lr-transfer-retry': ['ids'],
  });

  private rows: readonly LyraTransfer[] = Object.freeze([]);
  private inputRef?: WeakRef<readonly LyraTransfer[]>;
  /** Immutable transfer snapshots. Invalid entries and later duplicate IDs are omitted. */
  @property({ attribute: false })
  get transfers(): readonly LyraTransfer[] { return this.rows; }
  set transfers(value: readonly LyraTransfer[]) {
    const referenceable = value !== null && typeof value === 'object';
    if (value === this.rows || (referenceable && this.inputRef?.deref() === value)) return;
    this.rows = normalizeTransfers(value);
    this.inputRef = referenceable ? new WeakRef(value) : undefined;
  }

  /** Hide the transfer list while keeping the summary and disclosure available. */
  @property({ type: Boolean, reflect: true }) collapsed = false;
  /** Place the manager in document flow or in the logical bottom-end corner. */
  @property({ reflect: true }) placement: LyraTransferPlacement = 'header';

  @state() private visibleCount = PAGE_SIZE;
  private samples: ReadonlyMap<string, TransferSample> = new Map();
  private summary = totalTransferMetrics(this.rows, this.samples);
  private bulkActions: readonly LyraTransferAction[] = [];
  @state() private rateStale = false;
  private staleTimer?: ReturnType<typeof setTimeout>;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite', 'assertive'] });

  constructor() {
    super();
    repairControlFocusOnUpdate(this, control => {
      const id = control.dataset['transferId'];
      const disclosure = this.renderRoot.querySelector<HTMLButtonElement>('[part="disclosure"]');
      if (!this.collapsed && id !== undefined) {
        const row = [...this.renderRoot.querySelectorAll<HTMLElement>('[part="item"]')].find(item => item.dataset['id'] === id);
        return [row?.querySelector<HTMLButtonElement>('button'), disclosure];
      }
      if (!this.collapsed && control.dataset['action']) {
        return [this.renderRoot.querySelector<HTMLButtonElement>('[part="bulk-actions"] button'), disclosure];
      }
      return [disclosure];
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.sample();
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.samples = new Map();
    this.clearStaleTimer();
  }

  private clearStaleTimer(): void {
    if (this.staleTimer !== undefined) clearTimeout(this.staleTimer);
    this.staleTimer = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('transfers')) {
      this.sample();
      this.visibleCount = Math.max(PAGE_SIZE, Math.min(this.visibleCount, this.rows.length));
    }
    if (changed.has('collapsed') && this.collapsed) this.visibleCount = PAGE_SIZE;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('transfers')) return;
    // The controller keeps the first observation of each row silent, so mounting never announces.
    for (const row of this.rows) {
      const politeness = row.status === 'done' ? 'polite' : row.status === 'error' ? 'assertive' : undefined;
      this.announcements.transition(`transfer:${row.id}`, row.status, this.localize('connectorManagerStatusChanged', undefined, {
        name: row.name, status: this.localize(STATUS_LABEL[row.status]),
      }), politeness, true);
    }
  }

  private sample(): void {
    const now = this.ownerDocument?.defaultView?.performance.now();
    if (this.isConnected && now !== undefined) this.samples = sampleTransfers(this.rows, this.samples, now);
    this.rateStale = false;
    this.clearStaleTimer();
    if (this.isConnected && this.rows.some(row => row.status === 'active')) {
      this.staleTimer = setTimeout(() => { this.staleTimer = undefined; this.rateStale = true; }, (this.constructor as typeof LyraTransferManager).staleRateMs);
    }
    this.summary = totalTransferMetrics(this.rows, this.samples);
    this.bulkActions = ACTIONS.filter(action => this.rows.some(row => canTransferAction(row.status, action)));
  }

  private requestAction(action: LyraTransferAction, id?: string): void {
    let ids: readonly string[];
    if (id === undefined) {
      ids = eligibleTransferIds(this.rows, action);
    } else {
      const row = this.rows.find(item => item.id === id);
      if (!row || !canTransferAction(row.status, action)) return;
      ids = Object.freeze([id]);
    }
    if (!ids.length) return;
    switch (action) {
      case 'pause': this.emit('lr-transfer-pause', { ids }); break;
      case 'resume': this.emit('lr-transfer-resume', { ids }); break;
      case 'cancel': this.emit('lr-transfer-cancel', { ids }); break;
      case 'retry': this.emit('lr-transfer-retry', { ids }); break;
    }
  }

  private actionButton(action: LyraTransferAction, row?: LyraTransfer): TemplateResult {
    const label = row ? this.localize(ACTION_LABEL[action]) : this.localize(BULK_LABEL[action]);
    return html`<button type="button" part="action" data-action=${action} data-transfer-id=${row?.id ?? nothing}
      aria-label=${row ? this.localize('transferManagerItemAction', undefined, { action: label, name: row.name }) : nothing}
      @click=${() => this.requestAction(action, row?.id)}>${label}</button>`;
  }

  private duration(seconds: number): string {
    const unit = seconds >= 3600 ? 'hour' : seconds >= 60 ? 'minute' : 'second';
    // Hours keep one decimal so 61 minutes reads 1.1 hr, never a rounded-up 2 hr.
    const step = unit === 'hour' ? 360 : unit === 'minute' ? 60 : 1;
    const divisor = unit === 'hour' ? 3600 : step;
    return getNumberFormat(this.effectiveLocale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 })
      .format(Math.ceil(seconds / step) * step / divisor);
  }

  private rate(bytesPerSecond: number): string {
    const { amount, options } = byteFormat(bytesPerSecond, 'byte', 'short', 1000, 1);
    return getNumberFormat(this.effectiveLocale, { ...options, unit: `${options.unit}-per-second` }).format(amount);
  }

  private metrics(value: TransferMetrics): TemplateResult {
    const locale = this.effectiveLocale;
    const done = formatByteSize(value.bytesDone, locale);
    const bytes = value.bytesTotal === undefined ? done : this.localize('transferManagerBytes', undefined, {
      done, total: formatByteSize(value.bytesTotal, locale),
    });
    const measured = value.active && !this.rateStale;
    const rate = !measured || value.bytesPerSecond === undefined ? undefined : this.rate(value.bytesPerSecond);
    const eta = !value.active ? undefined : !measured || value.etaSeconds === undefined ? this.localize('transferManagerUnknownEta')
      : this.localize('transferManagerEta', undefined, { duration: this.duration(value.etaSeconds) });
    return html`<div part="metrics"><span part="bytes">${bytes}</span>
      ${rate === undefined ? nothing : html`<span part="rate">${rate}</span>`}
      ${eta === undefined ? nothing : html`<span part="eta">${eta}</span>`}</div>`;
  }

  private renderRow(row: LyraTransfer, index: number): TemplateResult {
    const value = transferMetrics(row, this.samples.get(row.id));
    return html`<li part="item" data-id=${row.id} data-status=${row.status}
      aria-posinset=${index + 1} aria-setsize=${this.rows.length}>
      <bdi part="name">${row.name}</bdi><span part="status">${this.localize(STATUS_LABEL[row.status])}</span>
      <progress part="progress" max="100" value=${value.progress ?? nothing} aria-label=${row.name}></progress>
      ${this.metrics(value)}
      <div part="item-actions">${repeat(ACTIONS.filter(action => canTransferAction(row.status, action)), action => action,
        action => this.actionButton(action, row))}</div>
    </li>`;
  }

  override render(): TemplateResult {
    const label = hostAriaLabel(this) ?? this.localize('transferManagerLabel');
    const count = this.rows.length;
    const countLabel = this.localize('transferManagerCount', undefined, { count: this.formatLocaleNumber(count), pluralCount: count });
    const percent = this.summary.progress === undefined ? undefined
      // Round down so an unfinished queue never reads 100 %.
      : this.formatLocaleNumber(Math.floor(this.summary.progress) / 100, { style: 'percent', maximumFractionDigits: 0 });
    const action = this.collapsed ? this.localize('expand') : this.localize('collapse');
    const more = Math.min(PAGE_SIZE, count - this.visibleCount);
    return html`<section part="base" aria-label=${label}>
      <div part="header"><button part="disclosure" type="button" aria-expanded=${String(!this.collapsed)}
        aria-controls="panel" aria-description=${action}
        @click=${() => { this.collapsed = !this.collapsed; }}>
        <span aria-hidden="true">${this.collapsed ? '▾' : '▴'}</span>${countLabel}
        ${percent === undefined ? nothing : html`<span>${percent}</span>`}</button></div>
      <div part="summary"><progress part="overall-progress" aria-label=${label} max="100" value=${this.summary.progress ?? nothing}></progress>
        ${this.collapsed || !count ? nothing : this.metrics(this.summary)}</div>
      <div part="panel" id="panel" ?hidden=${this.collapsed}>${this.collapsed ? nothing : html`
        <div part="bulk-actions">${repeat(this.bulkActions, action => action, action => this.actionButton(action))}</div>
        ${count ? html`<ul part="list" role="list">${repeat(this.rows.slice(0, this.visibleCount), row => row.id,
          (row, index) => this.renderRow(row, index))}</ul>` : html`<p part="empty">${this.localize('transferManagerEmpty')}</p>`}
        ${more > 0 ? html`<button type="button" part="action" data-more @click=${() => { this.visibleCount += PAGE_SIZE; }}>
          ${this.localize('showMoreCount', undefined, { count: this.formatLocaleNumber(more), pluralCount: more })}</button>` : nothing}
      `}</div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-transfer-manager': LyraTransferManager; }
}
