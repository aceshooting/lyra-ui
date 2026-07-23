import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getDateTimeFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { eyeOffIcon } from '../../../internal/icons.js';
import type { ToolInvocation, ToolApprovalEventDetail } from '../../../ai/types.js';
import { styles } from './tool-timeline.styles.js';
import '../tool-call-chip/tool-call-chip.js';
import '../tool-result-view/tool-result-view.js';
import '../tool-approval-dialog/tool-approval-dialog.js';
import '../../layout/details/details.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

/**
 * One entry in a `<lr-tool-timeline>`. Extends `ToolInvocation` (`src/ai/types.ts`) with exactly
 * the timeline-specific fields the roadmap calls for that a bare invocation record doesn't carry
 * on its own: when the call ran (`startedAt`/`endedAt`, from which duration is derived), how many
 * times it was retried before landing on its current `status`, which of its `args`/`result`/
 * `error` fields should render masked, and a human-in-the-loop approval decision. The inherited
 * `ToolInvocation` fields still assign directly onto `<lr-tool-call-chip>`/`<lr-tool-result-view>`
 * with no adapter, exactly as `ToolInvocation` itself already does.
 */
export interface ToolTimelineEntry extends ToolInvocation {
  /** Epoch milliseconds the call started. Entries are ordered by this field (ascending); an entry
   *  with no `startedAt` sorts after every timed entry, keeping its relative position among any
   *  other untimed entries, and renders with no visible timestamp. */
  startedAt?: number;
  /** Epoch milliseconds the call reached a terminal state. Paired with `startedAt` to derive the
   *  duration handed to `<lr-tool-call-chip>`'s own `durationMs` -- omitted (or paired with no
   *  `startedAt`) while still pending/running, or whenever the duration isn't known. */
  endedAt?: number;
  /** Number of retry attempts before this entry's current `status` -- `2` means the call reached
   *  its current state on its third try. Omitted or `0` renders no retry indicator. */
  retryCount?: number;
  /** Dotted field paths within `args`/`result`/`error` to mask in the rendered detail view, e.g.
   *  `['args.apiKey', 'result.rows.0.ssn']`, or the bare `'args'`/`'result'`/`'error'` to mask an
   *  entire branch. A path with no matching field is a no-op, never a thrown error. Never applied
   *  to the copy of `args` handed to the approval dialog -- see the class doc's approval note. */
  redactedFields?: string[];
  /** Whether this call is gated behind a human approval decision. While `true` and `approved` is
   *  still `undefined`, activating the entry's chip opens the shared approval dialog instead of
   *  merely firing the chip's own selection event. */
  needsApproval?: boolean;
  /** The approval decision, once made. `undefined` means still pending a decision. */
  approved?: boolean;
}

/**
 * `detail` for `lr-tool-approval-decide` -- extends the shared `ToolApprovalEventDetail`
 * (`src/ai/types.ts`) with the (possibly host-edited) `args` the approval dialog produced,
 * present only when `approved` is `true`. A listener that only cares about the shared
 * `{ invocationId, approved }` shape can ignore `args` entirely; one driving actual tool
 * execution needs it, since the dialog's optional inline editing step can hand back different
 * arguments than the entry originally proposed.
 */
export interface ToolTimelineApprovalDetail extends ToolApprovalEventDetail {
  args?: unknown;
}

export interface LyraToolTimelineEventMap {
  'lr-tool-approval-decide': CustomEvent<ToolTimelineApprovalDetail>;
}

/** `hour:minute` in the component's effective locale -- identical algorithm to
 *  `<lr-checkpoint>`'s own `defaultFormatTimestamp`, duplicated locally. */
function defaultFormatTimestamp(date: Date, locale: string): string {
  return getDateTimeFormat(locale || 'en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * Returns a structural clone of `value` with every leaf/branch under `currentPath` that `paths`
 * names replaced by `placeholder`. A path with no corresponding field in `value` is simply never
 * visited -- `Object.entries` only iterates real keys -- so a dangling path degrades gracefully
 * instead of throwing. Arrays are walked with numeric-index path segments (`args.rows.0.ssn`);
 * every other non-plain-object value below an unmasked branch is treated as an opaque leaf.
 */
function redactBranch(value: unknown, currentPath: string, paths: readonly string[], placeholder: string): unknown {
  if (paths.includes(currentPath)) return placeholder;
  if (!paths.some((p) => p.startsWith(`${currentPath}.`))) return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => redactBranch(item, `${currentPath}.${index}`, paths, placeholder));
  }
  if (value !== null && typeof value === 'object') {
    const result = Object.create(null) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactBranch(item, `${currentPath}.${key}`, paths, placeholder);
    }
    return result;
  }
  return value;
}

/** Entry point for `redactBranch()` -- a no-op (returns `value` unchanged) whenever `paths` is
 *  empty, so the common unredacted case never allocates a clone. */
function redactField(value: unknown, root: string, paths: readonly string[], placeholder: string): unknown {
  return paths.length === 0 ? value : redactBranch(value, root, paths, placeholder);
}

/**
 * `<lr-tool-timeline>` — a chronological list of an agent run's tool/function calls, each
 * rendered through `<lr-tool-call-chip>` (name/status/duration) and `<lr-tool-result-view>`
 * (args/result), with per-entry retry counts, sensitive-field redaction, and a shared
 * `<lr-tool-approval-dialog>` for entries gated behind a human approval decision. This component
 * owns none of the actual per-call rendering -- that is entirely those three existing
 * primitives -- its own job is ordering `entries` chronologically, computing each entry's
 * duration from `startedAt`/`endedAt`, masking `redactedFields` before handing `args`/`result` to
 * `<lr-tool-result-view>`, and opening/closing the one shared approval dialog for whichever entry
 * is currently pending a decision.
 *
 * Ordering: `entries` is sorted ascending by `startedAt`; an entry with no `startedAt` sorts after
 * every timed entry, keeping its position relative to any other untimed entries stable (input
 * order is preserved among ties) — a still-pending call with no timestamp yet naturally lands at
 * the end without needing to be pre-sorted by the host.
 *
 * Redaction only ever affects the read-only detail view: the copy of `args` handed to the
 * approval dialog is always the entry's real, unmasked value. Approving a masked-args call must
 * let the reviewer see (and, if `approvalEditable`, edit) what will actually be sent — handing the
 * dialog a placeholder string in place of a real field would silently corrupt the decision.
 *
 * Approval: activating the chip (`lr-tool-call-chip-select`) of an entry with `needsApproval` and
 * an undecided `approved` opens the shared dialog for that entry; approving or denying emits this
 * component's own `lr-tool-approval-decide` and closes the dialog. This component never mutates
 * `entries` itself — a host applies the decision (and any resulting status change) and re-assigns
 * `entries`; if the entry currently under review disappears or no longer qualifies as pending
 * (its `approved` was resolved some other way) by the time `entries` changes, the dialog closes on
 * its own rather than staying open over stale data. A chip belonging to an entry that isn't
 * pending approval is left alone — its own `lr-tool-call-chip-select` (and deprecated
 * `lr-tool-chip-select` alias) still bubble out normally for a host that wants to react to raw
 * chip selection for its own purposes.
 *
 * @customElement lr-tool-timeline
 * @event lr-tool-approval-decide - A pending entry's approval dialog was resolved.
 *   `detail: { invocationId, approved, args? }` — `args` (the dialog's current, possibly
 *   host-edited arguments) is present only when `approved` is `true`. Cancelable; preventing it
 *   preserves the pending dialog and its current argument edits.
 * @csspart base - The root `<ol>`.
 * @csspart entry - One entry's `<li>`; carries `data-status` (the entry's `status`) and
 *   `data-pending-approval` (`"true"`/`"false"`).
 * @csspart entry-marker - The decorative rail dot/connector for one entry.
 * @csspart entry-body - Wrapper around one entry's header and details.
 * @csspart entry-header - Wrapper around the timestamp, chip, retry badge, and approval status.
 * @csspart entry-timestamp - The formatted `startedAt`, only rendered while it's set.
 * @csspart entry-retries - The retry-count badge, only rendered while `retryCount > 0`.
 * @csspart entry-retries-label - The localized "Retry" text within the retry badge.
 * @csspart entry-retries-count - The formatted retry count within the retry badge.
 * @csspart entry-approval-status - The "Approved"/"Denied" badge, only rendered once `approved`
 *   is set; carries `data-decision` (`"approved"`/`"denied"`).
 * @csspart entry-redacted-indicator - A decorative marker shown when `redactedFields` is
 *   non-empty for that entry.
 * @csspart entry-details - The `<lr-details>` disclosure wrapping the entry's result view.
 * @csspart entry-result - The entry's `<lr-tool-result-view>`.
 * @csspart entry-error - The entry's `error` text, only rendered when set.
 * @csspart approval-dialog - The single shared `<lr-tool-approval-dialog>` instance.
 * @cssprop [--lr-tool-timeline-gap=var(--lr-space-l)] - Vertical gap between entries.
 * @cssprop [--lr-tool-timeline-marker-size=var(--lr-size-0-625rem)] - Diameter of an entry's rail
 *   dot; also the width of the marker gutter column.
 * @cssprop [--lr-tool-timeline-denied-marker-color=var(--lr-color-warning)] - Rail-dot color for a
 *   `status="denied"` entry, decoupled from the pending-approval border below so a consumer can
 *   retint either independently.
 * @cssprop [--lr-tool-timeline-pending-approval-border-color=var(--lr-color-warning)] - Color of
 *   the entry body's leading border while `data-pending-approval="true"`.
 * @cssprop [--lr-tool-timeline-running-marker-color=var(--lr-color-brand)] - Running rail dot.
 * @cssprop [--lr-tool-timeline-success-marker-color=var(--lr-color-success)] - Success rail dot.
 * @cssprop [--lr-tool-timeline-error-marker-color=var(--lr-color-danger)] - Error rail dot.
 * @cssprop [--lr-tool-timeline-approved-bg=var(--lr-color-success-quiet)] - Approved badge background.
 * @cssprop [--lr-tool-timeline-approved-color=var(--lr-color-success)] - Approved badge foreground.
 * @cssprop [--lr-tool-timeline-denied-bg=var(--lr-color-danger-quiet)] - Denied badge background.
 * @cssprop [--lr-tool-timeline-denied-color=var(--lr-color-danger)] - Denied badge foreground.
 * @cssprop [--lr-tool-timeline-error-color=var(--lr-color-danger)] - Expanded error text.
 */
export class LyraToolTimeline extends LyraElement<LyraToolTimelineEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The calls to render, in any order — see the class doc's ordering note. */
  @property({ attribute: false }) entries: ToolTimelineEntry[] = [];

  /** Forwarded to the shared approval dialog's own `editable` — whether a reviewer can edit an
   *  entry's arguments before approving it. */
  @property({ type: Boolean, reflect: true, attribute: 'approval-editable', converter: trueDefaultBooleanConverter })
  approvalEditable = true;

  /** Overrides the default `hour:minute` rendering of every entry's `startedAt`. */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** The `id` of the entry currently under review in the shared approval dialog, or `undefined`
   *  while it's closed. */
  @state() private reviewingEntryId?: string;
  @state() private openedEntryIds = new Set<string>();

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('entries') && this.reviewingEntryId !== undefined) {
      const still = this.entries.find((entry) => entry.id === this.reviewingEntryId);
      if (!still || !(still.needsApproval && still.approved === undefined)) {
        this.reviewingEntryId = undefined;
      }
    }
  }

  private get sortedEntries(): ToolTimelineEntry[] {
    return this.entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const ak = Number.isFinite(a.entry.startedAt) ? a.entry.startedAt! : Number.POSITIVE_INFINITY;
        const bk = Number.isFinite(b.entry.startedAt) ? b.entry.startedAt! : Number.POSITIVE_INFINITY;
        return ak !== bk ? ak - bk : a.index - b.index;
      })
      .map(({ entry }) => entry);
  }

  private get reviewingEntry(): ToolTimelineEntry | undefined {
    return this.reviewingEntryId === undefined
      ? undefined
      : this.entries.find((entry) => entry.id === this.reviewingEntryId);
  }

  private durationFor(entry: ToolTimelineEntry): number | undefined {
    if (entry.startedAt == null || entry.endedAt == null) return undefined;
    const diff = entry.endedAt - entry.startedAt;
    return Number.isFinite(diff) ? diff : undefined;
  }

  private normalizedDate(ms: number | undefined): Date | undefined {
    if (ms == null || !Number.isFinite(ms)) return undefined;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private onChipSelect(entry: ToolTimelineEntry, event: Event): void {
    if (entry.needsApproval && entry.approved === undefined) {
      event.stopPropagation();
      this.reviewingEntryId = entry.id;
    }
  }

  private onDialogApprove = (event: CustomEvent<{ args: unknown }>): void => {
    event.stopPropagation();
    const invocationId = this.reviewingEntryId;
    if (invocationId === undefined) return;
    const wrapperEvent = this.emit<ToolTimelineApprovalDetail>(
      'lr-tool-approval-decide',
      {
        invocationId,
        approved: true,
        args: event.detail.args,
      },
      { cancelable: true },
    );
    if (wrapperEvent.defaultPrevented) {
      event.preventDefault();
      return;
    }
    this.reviewingEntryId = undefined;
  };

  private onDialogDeny = (event: CustomEvent): void => {
    event.stopPropagation();
    const invocationId = this.reviewingEntryId;
    if (invocationId === undefined) return;
    const wrapperEvent = this.emit<ToolTimelineApprovalDetail>(
      'lr-tool-approval-decide',
      { invocationId, approved: false },
      { cancelable: true },
    );
    if (wrapperEvent.defaultPrevented) {
      event.preventDefault();
      return;
    }
    this.reviewingEntryId = undefined;
  };

  private onDialogClose = (event: CustomEvent): void => {
    event.stopPropagation();
    this.reviewingEntryId = undefined;
  };

  private onDetailsToggle(entryId: string, event: CustomEvent<{ open: boolean }>): void {
    event.stopPropagation();
    const next = new Set(this.openedEntryIds);
    if (event.detail.open) next.add(entryId);
    else next.delete(entryId);
    this.openedEntryIds = next;
  }

  private entryTemplate(entry: ToolTimelineEntry, placeholder: string): TemplateResult {
    const started = this.normalizedDate(entry.startedAt);
    const durationMs = this.durationFor(entry);
    const retryCount = finiteCount(entry.retryCount ?? 0);
    const redactedFields = entry.redactedFields ?? [];
    const redactedArgs = redactField(entry.args, 'args', redactedFields, placeholder);
    const redactedResult =
      entry.result !== undefined ? redactField(entry.result, 'result', redactedFields, placeholder) : entry.result;
    const redactedError =
      entry.error !== undefined && redactedFields.includes('error') ? placeholder : entry.error;
    const pendingApproval = entry.needsApproval === true && entry.approved === undefined;
    const formatter = this.formatTimestamp ?? ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));
    const detailsOpened = this.openedEntryIds.has(entry.id);

    return html`
      <li
        part="entry"
        role="listitem"
        data-status=${entry.status}
        data-pending-approval=${pendingApproval ? 'true' : 'false'}
      >
        <span part="entry-marker" aria-hidden="true"></span>
        <div part="entry-body">
          <div part="entry-header">
            ${started
              ? html`<time part="entry-timestamp" datetime=${started.toISOString()}>${formatter(started)}</time>`
              : nothing}
            <lr-tool-call-chip
              .name=${entry.name}
              .status=${entry.status}
              .durationMs=${durationMs}
              call-id=${entry.id}
              @lr-tool-call-chip-select=${(event: Event) => this.onChipSelect(entry, event)}
              @lr-tool-chip-select=${(event: Event) => this.onChipSelect(entry, event)}
            ></lr-tool-call-chip>
            ${retryCount > 0
              ? html`<span part="entry-retries">
                  <span part="entry-retries-label">${this.localize('retry')}</span>
                  <span part="entry-retries-count">${getNumberFormat(this.effectiveLocale).format(retryCount)}</span>
                </span>`
              : nothing}
            ${entry.approved === true
              ? html`<span part="entry-approval-status" data-decision="approved"
                  >${this.localize('confirmApproved')}</span
                >`
              : entry.approved === false
                ? html`<span part="entry-approval-status" data-decision="denied"
                    >${this.localize('confirmDenied')}</span
                  >`
                : nothing}
            ${redactedFields.length > 0
              ? html`<span part="entry-redacted-indicator" aria-hidden="true">${eyeOffIcon()}</span>`
              : nothing}
          </div>
          <lr-details
            part="entry-details"
            .open=${detailsOpened}
            @lr-toggle=${(event: CustomEvent<{ open: boolean }>) => this.onDetailsToggle(entry.id, event)}
          >
            ${detailsOpened
              ? html`
                  <lr-tool-result-view
                    part="entry-result"
                    tool-name=${entry.name}
                    .args=${redactedArgs}
                    .result=${redactedResult}
                  ></lr-tool-result-view>
                  ${redactedError !== undefined ? html`<p part="entry-error">${redactedError}</p>` : nothing}
                `
              : nothing}
          </lr-details>
        </div>
      </li>
    `;
  }

  override render(): TemplateResult {
    const entries = this.sortedEntries;
    const reviewing = this.reviewingEntry;
    const placeholder = this.localize('envListValueHidden');

    return html`
      <ol part="base" role="list" aria-label=${this.getAttribute('aria-label') || nothing}>
        ${repeat(entries, (entry) => entry.id, (entry) => this.entryTemplate(entry, placeholder))}
      </ol>
      <lr-tool-approval-dialog
        part="approval-dialog"
        tool-name=${reviewing?.name ?? ''}
        .args=${reviewing?.args ?? {}}
        .editable=${this.approvalEditable}
        ?open=${reviewing !== undefined}
        @lr-approve=${this.onDialogApprove}
        @lr-deny=${this.onDialogDeny}
        @lr-close=${this.onDialogClose}
      ></lr-tool-approval-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-tool-timeline': LyraToolTimeline;
  }
}
