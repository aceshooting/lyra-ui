import {
  html,
  svg,
  nothing,
  type ComplexAttributeConverter,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
} from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.js';
import { styles } from './task-list.styles.js';

/** A plan step's lifecycle state — not permission-gated, so there is no `denied` state here
 *  (unlike `<lr-tool-call-chip>`'s status vocabulary, which does need one). */
export type TaskStatus = 'pending' | 'running' | 'success' | 'error';

/** Visual chrome for `<lr-task-list>`'s root, mirroring `lr-card`'s `appearance` vocabulary. */
export type TaskListAppearance = 'card' | 'plain';

export interface TaskItem {
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
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? '' : null;
  },
};

/**
 * `<lr-task-list>` — a live, collapsible tracker for an agent's plan: ordered steps with
 * per-step lifecycle status and one level of nested sub-steps, embedded in the transcript.
 * `items` is controlled and never mutated by this component, mirroring `<lr-stepper>`'s `steps`
 * contract -- but unlike stepper's single-`current` navigation control, task-list is a read-only
 * status report: several steps may be `running` at once, there is no selection, and status changes
 * are announced through an internal `<lr-live-region>`.
 *
 * @customElement lr-task-list
 * @slot detail-<id> - Dynamic, one per item id (e.g. `slot="detail-step-3"`). Rich detail under
 *   that item's label, after its `detail` text -- typically a `<lr-tool-call-chip>` or file
 *   `<lr-chip>`. Plain-HTML friendly, no render props.
 * @event lr-toggle - The header was activated, expanding or collapsing the panel. `detail: {
 *   expanded }`.
 * @csspart base - The outer container.
 * @csspart header - The clickable header (a `<button>` when `collapsible`, a plain heading
 *   otherwise).
 * @csspart label - The `label` text.
 * @csspart summary - The visible "N of M completed" summary, counting only top-level items.
 * @csspart toggle - The chevron indicator inside the header. Only rendered when `collapsible`.
 * @csspart body - The list of items, `hidden` while collapsed.
 * @csspart item - One item row (`role="listitem"`); carries `data-status`, `data-id`,
 *   `data-depth` (`"0"` for a top-level item, `"1"` for a child).
 * @csspart status-icon - The per-item status glyph.
 * @csspart item-label - The item's `label` text.
 * @csspart item-detail - The item's optional `detail` text.
 * @csspart item-children - The nested `role="list"` wrapper around a top-level item's children.
 * @cssprop [--lr-task-list-spin=1s linear] - Running-status icon spin animation duration/timing.
 * @cssprop [--lr-task-list-compact-header-padding=var(--lr-space-2xs) var(--lr-space-s)] -
 *   `[part="header"]` padding while `compact`.
 * @cssprop [--lr-task-list-compact-gap=var(--lr-space-2xs)] - Gap between `[part="body"]`'s item
 *   rows while `compact`.
 * @cssprop [--lr-task-list-compact-body-padding=var(--lr-space-2xs) var(--lr-space-s) var(--lr-space-s)] -
 *   `[part="body"]` padding while `compact`.
 */
export class LyraTaskList extends LyraElement<LyraTaskListEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The plan. Controlled and never mutated by this component -- pass a new array to update it. */
  @property({ attribute: false }) items: TaskItem[] = [];

  /** Header text. Localized (`taskListLabel`) while at its default `'Tasks'`; any other value is
   *  shown as-is. */
  @property() label = 'Tasks';

  /** Whether the body (item list) is currently shown. Defaults open -- this is a progress surface,
   *  not a details disclosure a reader opts into. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) expanded = true;

  /** When `false`, the header renders as a static heading (no button, no toggle affordance) and
   *  `expanded` can still be set programmatically by the host, just not toggled via the UI. */
  @property({ converter: trueDefaultBooleanConverter }) collapsible = true;

  /** Tighter header/body padding and item gap for dense contexts (a plan tracker nested in an
   *  already-padded transcript row) -- same convention as `lr-agent-run`/`lr-source-card`'s
   *  `compact`. Defaults to `false`, i.e. the full padding. Purely a density knob: the border and
   *  background stay, so use `appearance="plain"` instead to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Visual chrome, mirroring `lr-card`'s `appearance` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled box. `'plain'` removes `[part="base"]`'s border, background, and corner
   *  radius, so a list embedded in the transcript inside a frame that already draws a border (an
   *  agent-run panel, a message bubble) doesn't double it. */
  @property({ reflect: true }) appearance: TaskListAppearance = 'card';

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

  protected willUpdate(changed: PropertyValues): void {
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
    }
  }

  protected updated(changed: PropertyValues): void {
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('items')) this.diffAndAnnounce(wasMounting);
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
    this.emit<TaskListToggleDetail>('lr-toggle', { expanded: this.expanded });
  };

  private renderItem(item: TaskItem, depth: 0 | 1): TemplateResult {
    const hasChildren = depth === 0 && !!item.children && item.children.length > 0;
    return html`
      <div part="item" role="listitem" data-status=${item.status} data-id=${item.id} data-depth=${depth}>
        <span part="status-icon" aria-hidden="true">${STATUS_ICON[item.status]()}</span>
        <span class="sr-only">${this.localize(STATUS_LABEL_KEY[item.status])}</span>
        <span part="item-label">${item.label}</span>
        ${item.detail ? html`<span part="item-detail">${item.detail}</span>` : nothing}
        <slot name=${`detail-${item.id}`}></slot>
        ${hasChildren
          ? html`<div part="item-children" role="list">
              ${item.children!.map((child) => this.renderItem(child, 1))}
            </div>`
          : nothing}
      </div>
    `;
  }

  render(): TemplateResult {
    const label = this.label === 'Tasks' ? this.localize('taskListLabel') : this.label;
    const ariaLabel = this.getAttribute('aria-label') || label;
    const total = this.items.length;
    const completed = this.items.filter((item) => item.status === 'success').length;
    const summary = this.localize('taskListCompletedOfTotal', undefined, { completed, total });

    return html`
      <div part="base">
        ${this.collapsible
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
            `}
        <div part="body" id=${this.bodyId} role="list" aria-label=${ariaLabel} ?hidden=${!this.expanded}>
          ${this.items.map((item) => this.renderItem(item, 0))}
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
