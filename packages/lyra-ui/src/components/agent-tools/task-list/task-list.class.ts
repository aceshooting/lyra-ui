import {
  html,
  svg,
  nothing,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
} from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { nextId } from '../../../internal/a11y.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { chevronIcon } from '../../../internal/icons.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './task-list.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_item, LYRA_DEFAULT_items, LYRA_DEFAULT_open, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_taskListCompletedOfTotal, LYRA_DEFAULT_taskListLabel, LYRA_DEFAULT_taskListStepCompletedAnnounce, LYRA_DEFAULT_taskListStepFailedAnnounce, LYRA_DEFAULT_taskListStepStartedAnnounce, LYRA_DEFAULT_treeNodeMoved } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** A plan step's lifecycle state — not permission-gated, so there is no `denied` state here
 *  (unlike `<lr-tool-call-chip>`'s status vocabulary, which does need one). */
export type TaskStatus = 'pending' | 'running' | 'success' | 'error';

/** Visual chrome for `<lr-task-list>`'s root — the library's shared container-frame vocabulary. */
export type TaskListAppearance = LyraFrame;

export interface TaskItem {
  /** Unique among every top-level task and direct child while `reorderable`; duplicated data stays
   *  visible but fails closed for reorder requests. */
  id: string;
  label: string;
  status: TaskStatus;
  /** Optional secondary plain-text line, e.g. an error message or a short progress note. */
  detail?: string;
  /** One level of sub-steps. Deeper nesting (a child's own `children`) is ignored, with a
   *  `console.warn`. */
  children?: TaskItem[];
}

export interface TaskListToggleDetail {
  expanded: boolean;
}

export interface LyraTaskListEventMap {
  'lr-toggle': CustomEvent<TaskListToggleDetail>;
  'lr-reorder': CustomEvent<{ id: string; parentId: string | null; fromIndex: number; toIndex: number }>;
}

interface PendingTaskReorder {
  id: string;
  parentId: string | null;
  originalSiblingIds: string[];
  targetSiblingId: string;
  fromIndex: number;
  toIndex: number;
}

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts) without adding
// task-list-specific glyphs there -- duplicated locally, matching lr-tool-call-chip's own
// STATUS_ICON set (same four shapes, minus its 'denied' glyph, which has no TaskStatus
// counterpart).
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function icon(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${paths}</svg>
  `;
}

function pendingIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>`);
}

function runningIcon(): SVGTemplateResult {
  return icon(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

function successIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 11 15.5 16 9.5"></polyline>`);
}

function errorIcon(): SVGTemplateResult {
  return icon(svg`
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="9" y1="9" x2="15" y2="15"></line>
    <line x1="15" y1="9" x2="9" y2="15"></line>
  `);
}

const STATUS_ICON: Record<TaskStatus, () => SVGTemplateResult> = {
  pending: pendingIcon,
  running: runningIcon,
  success: successIcon,
  error: errorIcon,
};

const STATUS_LABEL_KEY: Record<TaskStatus, string> = {
  pending: 'statusPending',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusError',
};

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once the property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead (mirrors `lr-generation-status`'s
 *  `showStopConverter`). Unlike that converter, `toAttribute` here reflects the `true` state as a
 *  present attribute rather than omitting it: `expanded`'s host attribute drives this component's
 *  own `:host([expanded])` styling, so the attribute must actually be present while expanded and
 *  absent while collapsed for that selector to work. Shared by both `expanded` and `collapsible`,
 *  which have the identical `true`-default parsing need -- `collapsible` just isn't reflected. */

/**
 * `<lr-task-list>` — a live, collapsible tracker for an agent's plan: ordered steps with
 * per-step lifecycle status and one level of nested sub-steps, embedded in the transcript.
 * `items` is controlled and never mutated by this component, mirroring `<lr-stepper>`'s `steps`
 * contract. Unlike stepper's single-`current` navigation control, task-list has no selection and
 * several steps may be `running` at once. Set `reorderable` to request sibling-scoped keyboard
 * moves; the host applies the reordered `items` array. Reordering requires globally unique ids
 * among every top-level task and direct child; duplicate data stays visible but fails closed.
 * The visible header is a level-three heading by default; set `heading-level` from `1`–`6` to fit
 * the surrounding document outline, or `none` for a visual-only header.
 * Status changes and confirmed moves are announced through an internal `<lr-live-region>`.
 *
 * @customElement lr-task-list
 * @slot detail-<id> - Dynamic, one per item id (e.g. `slot="detail-step-3"`). Rich detail under
 *   that item's label, after its `detail` text -- typically a `<lr-tool-call-chip>` or file
 *   `<lr-chip>`. Plain-HTML friendly, no render props.
 * @event lr-toggle - The header was activated, expanding or collapsing the panel. `detail: {
 *   expanded }`.
 * @event lr-reorder - `detail: { id, parentId, fromIndex, toIndex }` — Ctrl/Cmd+ArrowUp/ArrowDown
 *   requests moving the focused task within its own sibling list (`parentId` is `null` for a
 *   top-level task; indices are sibling-scoped). Only fired while `reorderable` with unique ids;
 *   a boundary key never reparents. A move is announced only after the rendered order confirms it.
 * @csspart base - The outer container.
 * @csspart header - The visible header content (a `<button>` when `collapsible`, a plain wrapper
 *   otherwise), inside the configurable semantic heading.
 * @csspart label - The `label` text.
 * @csspart summary - The visible "N of M completed" summary, counting only top-level items.
 * @csspart toggle - The chevron indicator inside the header. Only rendered when `collapsible`.
 * @csspart body - The list of items, `hidden` while collapsed.
 * @csspart item - One item row (`role="listitem"`); carries `data-status`, `data-id`,
 *   `data-depth` (`"0"` for a top-level item, `"1"` for a child), and is keyboard-focusable only
 *   for valid `reorderable` data.
 * @csspart status-icon - The per-item status glyph.
 * @csspart item-label - The item's `label` text.
 * @csspart item-detail - The item's optional `detail` text.
 * @csspart item-children - The nested `role="list"` wrapper around a top-level item's children.
 * @cssprop [--lr-task-list-spin=var(--lr-transition-ambient)] - Running-status icon spin
 *   animation duration/timing.
 * @cssprop [--lr-task-list-compact-header-padding=var(--lr-space-2xs) var(--lr-space-s)] -
 *   `[part="header"]` padding while `compact`.
 * @cssprop [--lr-task-list-compact-header-gap=var(--lr-space-2xs)] - Gap between `[part="header"]`'s
 *   toggle/label/summary while `compact`.
 * @cssprop [--lr-task-list-compact-header-font-size=var(--lr-font-size-sm)] - `[part="header"]`
 *   font size while `compact`.
 * @cssprop [--lr-task-list-compact-gap=var(--lr-space-2xs)] - Gap between `[part="body"]`'s item
 *   rows while `compact`.
 * @cssprop [--lr-task-list-compact-body-padding=var(--lr-space-2xs) var(--lr-space-s) var(--lr-space-s)] -
 *   `[part="body"]` padding while `compact`.
 * @cssprop [--lr-task-list-pending-color=var(--lr-color-text-quiet)] - Pending status icon color.
 * @cssprop [--lr-task-list-running-color=var(--lr-color-brand)] - Running status icon color.
 * @cssprop [--lr-task-list-success-color=var(--lr-color-success)] - Success status icon color.
 * @cssprop [--lr-task-list-error-color=var(--lr-color-danger)] - Error status icon color.
 * @status stable
 * @since 4.0.0
 */
export class LyraTaskList extends LyraElement<LyraTaskListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    item: LYRA_DEFAULT_item,
    items: LYRA_DEFAULT_items,
    open: LYRA_DEFAULT_open,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    taskListCompletedOfTotal: LYRA_DEFAULT_taskListCompletedOfTotal,
    taskListLabel: LYRA_DEFAULT_taskListLabel,
    taskListStepCompletedAnnounce: LYRA_DEFAULT_taskListStepCompletedAnnounce,
    taskListStepFailedAnnounce: LYRA_DEFAULT_taskListStepFailedAnnounce,
    taskListStepStartedAnnounce: LYRA_DEFAULT_taskListStepStartedAnnounce,
    treeNodeMoved: LYRA_DEFAULT_treeNodeMoved,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The plan. Controlled and never mutated by this component -- pass a new array to update it. */
  @property({ attribute: false }) items: TaskItem[] = [];

  /** Opts into Ctrl/Cmd+ArrowUp/ArrowDown reorder requests. `items` remains host-owned: the
   *  component never moves a task until the host reassigns a confirmed sibling order. All ids
   *  across top-level tasks and direct children must be unique; otherwise the feature fails closed
   *  with no row tab stops or `lr-reorder` requests. */
  @property({ type: Boolean, reflect: true }) reorderable = false;

  /** Header text. Localized (`taskListLabel`) while at its default `'Tasks'`; any other value is
   *  shown as-is. */
  @property() label = 'Tasks';

  /** Semantic level of the visible header. Use `none` to keep the visual header without exposing
   *  it to heading navigation. Invalid untyped values use level 3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraHeadingLevel = '3';

  /** Whether the body (item list) is currently shown. Defaults open -- this is a progress surface,
   *  not a details disclosure a reader opts into. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) expanded = true;

  /** When `false`, the header renders as a static heading (no button, no toggle affordance) and
   *  `expanded` can still be set programmatically by the host, just not toggled via the UI. */
  @property({ converter: trueDefaultBooleanConverter }) collapsible = true;

  /** Tighter header/body padding and item gap for dense contexts (a plan tracker nested in an
   *  already-padded transcript row) -- same convention as `lr-agent-run`/`lr-source-card`'s
   *  `compact`. Defaults to `false`, i.e. the full padding. Purely a density knob: the border and
   *  background stay, so use `frame="plain"` instead to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled box. `'plain'` removes `[part="base"]`'s border, background, and
   *  corner radius, so a list embedded in the transcript inside a container that already draws a
   *  border (an agent-run panel, a message bubble) doesn't double it. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private readonly headerId = nextId('task-list-header');
  private readonly bodyId = nextId('task-list-body');

  /** `true` until the first completed update -- gates the status-change announcements below so a
   *  freshly-mounted list never announces whatever statuses its very first `items` happens to
   *  carry (mirrors `<lr-chat-message>`'s identical `isMounting` gate for its own status-change
   *  announcement). */
  private isMounting = true;

  /** Last-seen status per item id, one level deep (top-level items plus their direct children) --
   *  diffed against the incoming `items` on every update to decide what to announce. */
  private previousStatusById = new Map<string, TaskStatus>();
  private pendingReorder?: PendingTaskReorder;
  private pendingFocusId: string | null = null;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('reorderable') && !this.reorderable) this.clearPendingReorder();
    if (changed.has('items')) {
      for (const item of this.items) {
        for (const child of item.children ?? []) {
          for (const grandchild of child.children ?? []) {
            console.warn(
              `<lr-task-list> item "${grandchild.id}" is nested more than one level deep and will be ignored -- only one level of nesting is supported.`,
            );
          }
        }
      }
      this.capturePendingReorderFocus();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('items')) {
      this.diffAndAnnounce(wasMounting);
      this.confirmPendingReorder();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearPendingReorder();
  }

  private flattenOneLevel(items: TaskItem[]): TaskItem[] {
    const out: TaskItem[] = [];
    for (const item of items) {
      out.push(item);
      for (const child of item.children ?? []) out.push(child);
    }
    return out;
  }

  private diffAndAnnounce(firstSight: boolean): void {
    const region = this.liveRegion;
    const nextMap = new Map<string, TaskStatus>();
    for (const item of this.flattenOneLevel(this.items)) {
      nextMap.set(item.id, item.status);
      if (!firstSight && region) {
        const previous = this.previousStatusById.get(item.id);
        if (previous !== undefined && previous !== item.status) {
          // Every branch forces an immediate flush -- these are discrete lifecycle transitions
          // (a step starting/finishing), not a high-frequency stream where throttling matters, and
          // a caller updating `items` in a synchronous batch expects the *latest* transition heard
          // right away rather than coalesced behind the announcer's default throttle window.
          if (item.status === 'running') {
            region.mode = 'polite';
            region.announce(this.localize('taskListStepStartedAnnounce', undefined, { label: item.label }), {
              force: true,
            });
          } else if (item.status === 'success') {
            region.mode = 'polite';
            region.announce(this.localize('taskListStepCompletedAnnounce', undefined, { label: item.label }), {
              force: true,
            });
          } else if (item.status === 'error') {
            region.mode = 'assertive';
            region.announce(this.localize('taskListStepFailedAnnounce', undefined, { label: item.label }), {
              force: true,
            });
          }
        }
      }
    }
    this.previousStatusById = nextMap;
  }

  private toggle = (): void => {
    if (!this.collapsible) return;
    this.expanded = !this.expanded;
    this.emit('lr-toggle', { expanded: this.expanded });
  };

  private idsAreUnique(): boolean {
    const ids = new Set<string>();
    for (const item of this.flattenOneLevel(this.items)) {
      if (ids.has(item.id)) return false;
      ids.add(item.id);
    }
    return true;
  }

  private canReorderItems(): boolean {
    return this.reorderable && this.idsAreUnique();
  }

  private siblingItems(parentId: string | null): TaskItem[] | undefined {
    if (parentId === null) return this.items;
    return this.items.find((item) => item.id === parentId)?.children;
  }

  private requestReorder(item: TaskItem, parentId: string | null, delta: 1 | -1): void {
    if (!this.canReorderItems()) return;
    const siblings = this.siblingItems(parentId);
    if (!siblings) return;
    const fromIndex = siblings.findIndex((candidate) => candidate.id === item.id);
    const toIndex = fromIndex + delta;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= siblings.length) return;
    this.pendingReorder = {
      id: item.id,
      parentId,
      originalSiblingIds: siblings.map((candidate) => candidate.id),
      targetSiblingId: siblings[toIndex]!.id,
      fromIndex,
      toIndex,
    };
    this.pendingFocusId = null;
    this.emit('lr-reorder', { id: item.id, parentId, fromIndex, toIndex });
  }

  /** Only direct row key presses can request a move. This leaves Ctrl/Cmd+Arrow on slotted detail
   * controls (and a nested row bubbling through its parent row) to the focused control itself. */
  private onItemKeyDown(event: KeyboardEvent, item: TaskItem, parentId: string | null): void {
    if (event.composedPath()[0] !== event.currentTarget) return;
    if (!this.canReorderItems() || !(event.ctrlKey || event.metaKey)) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    // ArrowUp/ArrowDown describe sibling order and do not swap under RTL.
    event.preventDefault();
    this.requestReorder(item, parentId, event.key === 'ArrowDown' ? 1 : -1);
  }

  private capturePendingReorderFocus(): void {
    const pending = this.pendingReorder;
    if (!pending) return;
    const active = activeElementIn(this.shadowRoot);
    this.pendingFocusId =
      active instanceof HTMLElement && active.getAttribute('part') === 'item' && active.dataset['id'] === pending.id
        ? pending.id
        : null;
  }

  /** Announce only after the host's controlled refresh proves the exact sibling swap. Unrelated
   * updates retain a request, while a missing or divergent sibling list rejects it. */
  private confirmPendingReorder(): void {
    const pending = this.pendingReorder;
    if (!pending) return;
    const siblings = this.siblingItems(pending.parentId);
    if (!siblings || !this.idsAreUnique()) {
      this.clearPendingReorder();
      return;
    }
    const siblingIds = siblings.map((item) => item.id);
    const orderChanged =
      siblingIds.length !== pending.originalSiblingIds.length ||
      siblingIds.some((id, index) => id !== pending.originalSiblingIds[index]);
    if (!orderChanged) return;

    this.pendingReorder = undefined;
    const restoreFocus = this.pendingFocusId === pending.id;
    this.pendingFocusId = null;
    if (
      siblingIds[pending.toIndex] !== pending.id ||
      siblingIds[pending.fromIndex] !== pending.targetSiblingId
    ) {
      return;
    }
    const moved = siblings[pending.toIndex]!;
    const region = this.liveRegion;
    if (region) {
      region.mode = 'polite';
      region.announce(
        this.localize('treeNodeMoved', undefined, {
          label: moved.label,
          index: getNumberFormat(this.effectiveLocale).format(pending.toIndex + 1),
          total: getNumberFormat(this.effectiveLocale).format(siblings.length),
        }),
        { force: true },
      );
    }
    if (restoreFocus) this.focusItem(pending.id);
  }

  private focusItem(id: string): void {
    const row = [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part="item"]') ?? [])].find(
      (candidate) => candidate.dataset['id'] === id,
    );
    row?.focus();
  }

  private clearPendingReorder(): void {
    this.pendingReorder = undefined;
    this.pendingFocusId = null;
  }

  private renderItem(
    item: TaskItem,
    depth: 0 | 1,
    parentId: string | null,
    canReorder: boolean,
  ): TemplateResult {
    const hasChildren = depth === 0 && !!item.children && item.children.length > 0;
    return html`
      <div
        part="item"
        role="listitem"
        data-status=${item.status}
        data-id=${item.id}
        data-depth=${depth}
        tabindex=${canReorder ? '0' : nothing}
        @keydown=${(event: Event) => this.onItemKeyDown(event as KeyboardEvent, item, parentId)}
      >
        <span part="status-icon" aria-hidden="true">${STATUS_ICON[item.status]()}</span>
        <span class="sr-only">${this.localize(STATUS_LABEL_KEY[item.status])}</span>
        <span part="item-label">${item.label}</span>
        ${item.detail ? html`<span part="item-detail">${item.detail}</span>` : nothing}
        <slot name=${`detail-${item.id}`}></slot>
        ${hasChildren
          ? html`<div part="item-children" role="list">
              ${canReorder
                ? repeat(
                    item.children!,
                    (child) => child.id,
                    (child) => this.renderItem(child, 1, item.id, canReorder),
                  )
                : item.children!.map((child) => this.renderItem(child, 1, item.id, canReorder))}
            </div>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const label = this.label === 'Tasks' ? this.localize('taskListLabel') : this.label;
    const ariaLabel = this.getAttribute('aria-label') || label;
    const total = this.items.length;
    const completed = this.items.filter((item) => item.status === 'success').length;
    const canReorder = this.canReorderItems();
    const number = getNumberFormat(this.effectiveLocale);
    const summary = this.localize('taskListCompletedOfTotal', undefined, {
      completed: number.format(completed),
      total: number.format(total),
    });
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    const header = this.collapsible
      ? html`
          <button
            part="header"
            type="button"
            id=${this.headerId}
            aria-expanded=${this.expanded ? 'true' : 'false'}
            aria-controls=${this.bodyId}
            @click=${this.toggle}
          >
            <span part="toggle" aria-hidden="true">${chevronIcon()}</span>
            <span part="label">${label}</span>
            <span part="summary">${summary}</span>
          </button>
        `
      : html`
          <div part="header" id=${this.headerId}>
            <span part="label">${label}</span>
            <span part="summary">${summary}</span>
          </div>
        `;

    return html`
      <div part="base">
        <div role=${headingLevel ? 'heading' : nothing} aria-level=${headingLevel ?? nothing}>
          ${header}
        </div>
        <div part="body" id=${this.bodyId} role="list" aria-label=${ariaLabel} ?hidden=${!this.expanded}>
          ${canReorder
            ? repeat(
                this.items,
                (item) => item.id,
                (item) => this.renderItem(item, 0, null, canReorder),
              )
            : this.items.map((item) => this.renderItem(item, 0, null, canReorder))}
        </div>
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-task-list': LyraTaskList;
  }
}
