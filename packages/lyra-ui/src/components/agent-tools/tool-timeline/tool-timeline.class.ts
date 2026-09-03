import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getDateTimeFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { eyeOffIcon } from '../../../internal/icons.js';
import { srOnly } from '../../../internal/a11y.js';
import type { ToolInvocation, ToolApprovalEventDetail } from '../../../ai/types.js';
import type { ToolCallStatus } from '../tool-call-chip/tool-call-chip.class.js';
import { styles } from './tool-timeline.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { overallSemanticLabel } from '../semantic-owner.js';
import type { ApprovalAction } from '../approval-state.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_confirmApproved, LYRA_DEFAULT_confirmDenied, LYRA_DEFAULT_envListValueHidden, LYRA_DEFAULT_noData, LYRA_DEFAULT_retry, LYRA_DEFAULT_toolTimelineDetailsFor, LYRA_DEFAULT_toolTimelineLimit } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * One entry in a `<lr-tool-timeline>`. Extends `ToolInvocation` (`src/ai/types.ts`) with the
 * timeline-specific fields a bare invocation record doesn't carry on its own: when the call ran
 * (`startedAt`/`endedAt`, from which duration is derived), how many
 * times it was retried before landing on its current `status`, which of its `args`/`result`/
 * `error` fields should render masked, and a human-in-the-loop approval decision. The inherited
 * `ToolInvocation` fields still assign directly onto `<lr-tool-call-chip>`/`<lr-tool-result-view>`
 * with no adapter, exactly as `ToolInvocation` itself already does.
 */
export interface ToolTimelineEntry extends ToolInvocation {
  /** Stable identity for the owning run/source generation. Supply this when invocation ids can be
   *  reused; when an identity repeats, its first occurrence wins deterministically. */
  sourceKey?: string;
  /** Literal icon hint forwarded to the composed `<lr-tool-call-chip>`. */
  icon?: string;
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
  redactedFields?: readonly string[];
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
  sourceKey?: string;
}

export interface ToolTimelineActivateDetail {
  invocationId: string;
  sourceKey?: string;
}

export interface ToolTimelineRenderErrorDetail extends ToolTimelineActivateDetail {
  toolName: string;
  error: unknown;
}

/** Which approval action is waiting for a host that vetoed `lr-tool-approval-decide` to settle it. */
export type ToolTimelineApprovalPending = ApprovalAction | null;

export interface LyraToolTimelineEventMap {
  'lr-tool-approval-decide': CustomEvent<ToolTimelineApprovalDetail>;
  'lr-tool-activate': CustomEvent<ToolTimelineActivateDetail>;
  'lr-tool-render-error': CustomEvent<ToolTimelineRenderErrorDetail>;
}

/** The one-read data shape used after an entry source has been admitted. `source` remains opaque
 * and exists only to retain the caller's documented identity; every render path uses these copied
 * scalar fields and the explicitly opaque payload references instead. */
interface CanonicalToolTimelineEntry {
  readonly source: ToolTimelineEntry;
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
  readonly status: ToolCallStatus;
  readonly result?: unknown;
  readonly error?: string;
  readonly sourceKey?: string;
  readonly icon?: string;
  readonly startedAt?: number;
  readonly endedAt?: number;
  readonly retryCount?: number;
  readonly redactedFields: readonly unknown[];
  readonly needsApproval?: boolean;
  readonly approved?: boolean;
}

const MAX_RENDERED_ENTRIES = 500;
const MAX_REDACTION_PATHS = 100;
const MAX_REDACTION_DEPTH = 64;
const MAX_REDACTION_NODES = 10_000;
const TOOL_STATUSES = new Set<ToolCallStatus>(['pending', 'running', 'success', 'error', 'denied']);
const EMPTY_REDACTION_PATHS: readonly unknown[] = Object.freeze([]);
const TOO_MANY_REDACTION_PATHS: readonly unknown[] = Object.freeze(
  new Array<unknown>(MAX_REDACTION_PATHS + 1),
);

function descriptorValue(value: object, property: PropertyKey): ReturnType<typeof getOwnDataDescriptor> {
  return getOwnDataDescriptor(value, property);
}

function projectedRedactionFields(value: unknown): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value)) return EMPTY_REDACTION_PATHS;
    const lengthDescriptor = descriptorValue(value, 'length');
    if (
      lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    )
      return undefined;
    if (lengthDescriptor.value > MAX_REDACTION_PATHS) return TOO_MANY_REDACTION_PATHS;
    const fields: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const field = descriptorValue(value, String(index));
      if (field === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      fields.push(field === MISSING_OWN_DATA_DESCRIPTOR ? undefined : field.value);
    }
    return Object.freeze(fields);
  } catch {
    return undefined;
  }
}

function projectToolTimelineEntry(value: unknown): CanonicalToolTimelineEntry | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const idDescriptor = descriptorValue(value, 'id');
    const nameDescriptor = descriptorValue(value, 'name');
    const argsDescriptor = descriptorValue(value, 'args');
    const statusDescriptor = descriptorValue(value, 'status');
    const resultDescriptor = descriptorValue(value, 'result');
    const errorDescriptor = descriptorValue(value, 'error');
    const sourceKeyDescriptor = descriptorValue(value, 'sourceKey');
    const iconDescriptor = descriptorValue(value, 'icon');
    const startedAtDescriptor = descriptorValue(value, 'startedAt');
    const endedAtDescriptor = descriptorValue(value, 'endedAt');
    const retryCountDescriptor = descriptorValue(value, 'retryCount');
    const redactedFieldsDescriptor = descriptorValue(value, 'redactedFields');
    const needsApprovalDescriptor = descriptorValue(value, 'needsApproval');
    const approvedDescriptor = descriptorValue(value, 'approved');
    if (
      [
        idDescriptor,
        nameDescriptor,
        argsDescriptor,
        statusDescriptor,
        resultDescriptor,
        errorDescriptor,
        sourceKeyDescriptor,
        iconDescriptor,
        startedAtDescriptor,
        endedAtDescriptor,
        retryCountDescriptor,
        redactedFieldsDescriptor,
        needsApprovalDescriptor,
        approvedDescriptor,
      ].some((descriptor) => descriptor === UNSAFE_OWN_DATA_DESCRIPTOR)
    )
      return undefined;
    const valueOf = (descriptor: ReturnType<typeof getOwnDataDescriptor>): unknown | undefined => {
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
      )
        return undefined;
      return descriptor.value;
    };
    const id = valueOf(idDescriptor);
    if (typeof id !== 'string' || id.trim().length === 0) return undefined;
    const redactedFieldsValue = valueOf(redactedFieldsDescriptor);
    const redactedFields = redactedFieldsValue === undefined
      ? EMPTY_REDACTION_PATHS
      : projectedRedactionFields(redactedFieldsValue);
    if (redactedFields === undefined) return undefined;
    const name = valueOf(nameDescriptor);
    const status = valueOf(statusDescriptor);
    const result = valueOf(resultDescriptor);
    const error = valueOf(errorDescriptor);
    const sourceKey = valueOf(sourceKeyDescriptor);
    const icon = valueOf(iconDescriptor);
    const startedAt = valueOf(startedAtDescriptor);
    const endedAt = valueOf(endedAtDescriptor);
    const retryCount = valueOf(retryCountDescriptor);
    const needsApproval = valueOf(needsApprovalDescriptor);
    const approved = valueOf(approvedDescriptor);
    return Object.freeze({
      source: value as ToolTimelineEntry,
      id,
      name: typeof name === 'string' ? name : '',
      args: valueOf(argsDescriptor),
      status: TOOL_STATUSES.has(status as ToolCallStatus) ? status as ToolCallStatus : 'pending',
      ...(result === undefined ? {} : { result }),
      ...(typeof error === 'string' ? { error } : {}),
      ...(typeof sourceKey === 'string' ? { sourceKey } : {}),
      ...(typeof icon === 'string' ? { icon } : {}),
      ...(typeof startedAt === 'number' ? { startedAt } : {}),
      ...(typeof endedAt === 'number' ? { endedAt } : {}),
      ...(typeof retryCount === 'number' ? { retryCount } : {}),
      redactedFields,
      ...(typeof needsApproval === 'boolean' ? { needsApproval } : {}),
      ...(typeof approved === 'boolean' ? { approved } : {}),
    });
  } catch {
    return undefined;
  }
}

function entrySourceKey(entry: CanonicalToolTimelineEntry): string | undefined {
  return entry.sourceKey?.trim() ? entry.sourceKey : undefined;
}

function entryIdentity(entry: CanonicalToolTimelineEntry): string {
  return JSON.stringify([entrySourceKey(entry) ?? null, entry.id]);
}

function entryCorrelation(entry: CanonicalToolTimelineEntry): ToolTimelineActivateDetail {
  const sourceKey = entrySourceKey(entry);
  return sourceKey === undefined
    ? { invocationId: entry.id }
    : { invocationId: entry.id, sourceKey };
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
function redactBranch(
  value: unknown,
  currentPath: string,
  paths: readonly string[],
  placeholder: string,
  budget: { nodes: number },
  depth: number,
): unknown {
  if (paths.includes(currentPath)) return placeholder;
  if (depth >= MAX_REDACTION_DEPTH || budget.nodes >= MAX_REDACTION_NODES) return placeholder;
  budget.nodes++;
  if (!paths.some((p) => p.startsWith(`${currentPath}.`))) return value;
  if (Array.isArray(value)) {
    try {
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        if (budget.nodes >= MAX_REDACTION_NODES) return placeholder;
        result.push(redactBranch(value[index], `${currentPath}.${index}`, paths, placeholder, budget, depth + 1));
      }
      return result;
    } catch {
      return placeholder;
    }
  }
  if (value !== null && typeof value === 'object') {
    const result = Object.create(null) as Record<string, unknown>;
    try {
      for (const key in value as Record<string, unknown>) {
        if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue;
        if (budget.nodes >= MAX_REDACTION_NODES) return placeholder;
        result[key] = redactBranch(
          (value as Record<string, unknown>)[key],
          `${currentPath}.${key}`,
          paths,
          placeholder,
          budget,
          depth + 1,
        );
      }
    } catch {
      return placeholder;
    }
    return result;
  }
  return value;
}

/** Entry point for `redactBranch()` -- a no-op (returns `value` unchanged) whenever `paths` is
 *  empty, so the common unredacted case never allocates a clone. */
function redactField(value: unknown, root: string, paths: readonly unknown[], placeholder: string): unknown {
  if (paths.length === 0) return value;
  if (paths.length > MAX_REDACTION_PATHS) return placeholder;
  const relevant: string[] = [];
  for (const path of paths) {
    if (typeof path !== 'string' || path.length > 4_096) return placeholder;
    if (path !== root && !path.startsWith(`${root}.`)) continue;
    if (path.split('.').length - 1 > MAX_REDACTION_DEPTH) return placeholder;
    relevant.push(path);
  }
  if (relevant.length === 0) return value;
  return redactBranch(value, root, relevant, placeholder, { nodes: 0 }, 0);
}

interface RedactedEntry {
  args: unknown;
  result: unknown;
  error: unknown;
}

interface RedactionCacheEntry extends RedactedEntry {
  sourceArgs: unknown;
  sourceResult: unknown;
  sourceError: unknown;
  sourcePaths: readonly unknown[];
  placeholder: string;
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
 * Rendering is bounded to 500 unique source entries before sorting. Duplicate `(sourceKey,id)`
 * identities use a deterministic first-wins policy. Entries already open or under approval
 * review are reserved inside that budget when new history would otherwise push them past the
 * ceiling, and a localized notice exposes truncation instead of silently hiding it. Foreign
 * runtime statuses normalize once to `pending` before both row and child presentation.
 *
 * Redaction work is deferred until a detail row opens and memoized while its payload/path inputs
 * remain unchanged. It is bounded to 100 paths, 64 levels, and 10,000 visited nodes; exceeding a
 * ceiling masks the affected branch rather than exposing data or exhausting the page. Redaction
 * only ever affects the read-only detail view: the copy of `args` handed to the
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
 * its own rather than staying open over stale data. If a host cancels `lr-tool-approval-decide` to
 * persist it asynchronously, `pendingApproval` identifies the held action. After success, update
 * the controlled entries and call `finalizePendingApproval()`; after failure, call
 * `revertPendingApproval()` to restore the same open dialog and its draft for retry. A chip
 * belonging to an entry that isn't pending approval emits the timeline-owned, correlated
 * `lr-tool-activate`; raw child selection and disclosure lifecycle events are contained.
 *
 * Public collection properties take bounded readonly snapshots. `entries` retains each source
 * object and its opaque `args`/`result` payloads by identity only while a closed descriptor-safe
 * projection copies the fields this component uses; later rendering never re-reads an admitted
 * source record. Create a new collection and reassign it after changes; mutating the assigned
 * array does not update the view.
 *
 * @customElement lr-tool-timeline
 * @event lr-tool-approval-decide - A pending entry's approval dialog was resolved.
 *   `detail: { invocationId, approved, args? }` — `args` (the dialog's current, possibly
 *   host-edited arguments) is present only when `approved` is `true`. Cancelable; preventing it
 *   preserves the pending dialog and its current argument edits, sets `pendingApproval`, and
 *   requires `finalizePendingApproval()` or `revertPendingApproval()` to settle the held action.
 * @event lr-tool-activate - A non-approval entry was activated. `detail: { invocationId,
 *   sourceKey? }`.
 * @event lr-tool-render-error - A nested result renderer failed. `detail: { invocationId,
 *   sourceKey?, toolName, error }`.
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
 *   non-empty for that entry; the glyph is decorative and localized hidden-state text remains in
 *   the accessibility tree.
 * @csspart entry-details - The `<lr-details>` disclosure wrapping the entry's result view.
 * @csspart entry-result - The entry's `<lr-tool-result-view>`.
 * @csspart entry-error - The entry's `error` text, only rendered when set.
 * @csspart approval-dialog - The single shared `<lr-tool-approval-dialog>` instance.
 * @csspart empty - Localized empty state shown when no entries are available.
 * @csspart limit - Localized resource-ceiling notice.
 * @cssprop [--lr-tool-timeline-gap=var(--lr-space-l)] - Vertical gap between entries.
 * @cssprop [--lr-tool-timeline-marker-size=var(--lr-size-0-625rem)] - Diameter of an entry's rail
 *   dot; also the width of the marker gutter column.
 * @cssprop [--lr-tool-timeline-denied-marker-color=var(--lr-color-warning)] - Rail-dot color for a
 *   `status="denied"` entry, decoupled from the pending-approval border below so a consumer can
 *   retint either independently.
 * @cssprop [--lr-tool-timeline-pending-marker-color=var(--lr-color-text-quiet)] - Rail-dot color
 *   for a `status="pending"` entry.
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
 * @status stable
 * @since 4.1.0
 */
export class LyraToolTimeline extends LyraElement<LyraToolTimelineEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    confirmApproved: LYRA_DEFAULT_confirmApproved,
    confirmDenied: LYRA_DEFAULT_confirmDenied,
    envListValueHidden: LYRA_DEFAULT_envListValueHidden,
    noData: LYRA_DEFAULT_noData,
    retry: LYRA_DEFAULT_retry,
    toolTimelineDetailsFor: LYRA_DEFAULT_toolTimelineDetailsFor,
    toolTimelineLimit: LYRA_DEFAULT_toolTimelineLimit,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['entries']);
  /** Provider tool payloads can be opaque objects. Preserve row identity at the array boundary,
   * then admit only one descriptor-safe canonical record for every rendering path. */
  protected static override readonly identityCollectionProperties = Object.freeze(['entries']);

  static override styles = [LyraElement.styles, styles, srOnly];

  /** The calls to render, in any order — see the class doc's ordering note. Entries with empty
   *  invocation ids are omitted; duplicate `(sourceKey, id)` identities normalize first-wins. */
  @property({ attribute: false }) entries: readonly ToolTimelineEntry[] = [];

  /** Forwarded to the shared approval dialog's own `editable` — whether a reviewer can edit an
   *  entry's arguments before approving it. */
  @property({ type: Boolean, reflect: true, attribute: 'approval-editable', converter: trueDefaultBooleanConverter })
  approvalEditable = true;

  /** Overrides the default `hour:minute` rendering of every entry's `startedAt`. */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** The `(sourceKey,id)` identity of the entry currently under review, or `undefined` while the
   *  shared dialog is closed. */
  @state() private reviewingEntryKey?: string;
  @state() private approvalPending: ToolTimelineApprovalPending = null;
  @state() private openedEntryIds = new Set<string>();
  private projectedEntriesCache: CanonicalToolTimelineEntry[] = [];
  private projectionTruncated = false;
  private redactionCache = new WeakMap<CanonicalToolTimelineEntry, RedactionCacheEntry>();
  private limitAnnouncementSink?: AnnouncementSink;
  private limitAnnouncementInitialized = false;
  private previouslyTruncated = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncLimitAnnouncementSink();
    this.limitAnnouncementInitialized = this.hasUpdated;
    this.previouslyTruncated = this.projectionTruncated;
  }

  override disconnectedCallback(): void {
    this.limitAnnouncementSink?.release();
    this.limitAnnouncementSink = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.limitAnnouncementSink?.release();
    this.limitAnnouncementSink = undefined;
    this.syncLimitAnnouncementSink();
  }

  private syncLimitAnnouncementSink(): void {
    if (!this.isConnected || this.limitAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.limitAnnouncementSink?.release();
    this.limitAnnouncementSink = acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
  }

  /** The approval/denial action held after a listener vetoes `lr-tool-approval-decide`, or `null`
   *  otherwise. Read-only: call `finalizePendingApproval()` after persisting the controlled entry,
   *  or `revertPendingApproval()` to release the same dialog and draft for another attempt. */
  get pendingApproval(): ToolTimelineApprovalPending {
    return this.approvalPending;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!changed.has('entries')) return;
    this.rebuildProjection();
    const projected = this.projectedEntriesCache;
    const identities = new Set(projected.map(entryIdentity));
    if (this.reviewingEntryKey !== undefined) {
      const still = projected.find((entry) => entryIdentity(entry) === this.reviewingEntryKey);
      if (!still || !(still.needsApproval && still.approved === undefined)) {
        this.reviewingEntryKey = undefined;
        this.approvalPending = null;
      }
    }
    const opened = new Set([...this.openedEntryIds].filter((key) => identities.has(key)));
    if (opened.size !== this.openedEntryIds.size) this.openedEntryIds = opened;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.limitAnnouncementInitialized && this.projectionTruncated && !this.previouslyTruncated) {
      this.limitAnnouncementSink?.announce(this.localize('toolTimelineLimit', undefined, {
        count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_ENTRIES),
      }));
    }
    this.limitAnnouncementInitialized = true;
    this.previouslyTruncated = this.projectionTruncated;
  }

  private rebuildProjection(): void {
    const entries = Array.isArray(this.entries) ? this.entries : [];
    const projected: CanonicalToolTimelineEntry[] = [];
    const projectedIndex = new Map<string, number>();
    const reservedKeys = new Set(this.openedEntryIds);
    if (this.reviewingEntryKey !== undefined) reservedKeys.add(this.reviewingEntryKey);
    const displacedReserved = new Map<string, CanonicalToolTimelineEntry>();
    const seen = new Set<string>();
    for (const sourceEntry of entries) {
      const entry = projectToolTimelineEntry(sourceEntry);
      if (!entry) continue;
      const key = entryIdentity(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      if (projected.length < MAX_RENDERED_ENTRIES) {
        projectedIndex.set(key, projected.length);
        projected.push(entry);
      } else if (reservedKeys.has(key)) {
        displacedReserved.set(key, entry);
      }
    }
    for (const [key, entry] of displacedReserved) {
      if (projectedIndex.has(key)) continue;
      let replacement = projected.length - 1;
      while (replacement >= 0 && reservedKeys.has(entryIdentity(projected[replacement]!))) replacement--;
      if (replacement < 0) break;
      projectedIndex.delete(entryIdentity(projected[replacement]!));
      projected[replacement] = entry;
      projectedIndex.set(key, replacement);
    }
    this.projectedEntriesCache = projected;
    this.projectionTruncated = seen.size > projected.length;
  }

  private get sortedEntries(): CanonicalToolTimelineEntry[] {
    return this.projectedEntriesCache
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const ak = Number.isFinite(a.entry.startedAt) ? a.entry.startedAt! : Number.POSITIVE_INFINITY;
        const bk = Number.isFinite(b.entry.startedAt) ? b.entry.startedAt! : Number.POSITIVE_INFINITY;
        return ak !== bk ? ak - bk : a.index - b.index;
      })
      .map(({ entry }) => entry);
  }

  private get reviewingEntry(): CanonicalToolTimelineEntry | undefined {
    return this.reviewingEntryKey === undefined
      ? undefined
      : this.projectedEntriesCache.find((entry) => entryIdentity(entry) === this.reviewingEntryKey);
  }

  private durationFor(entry: CanonicalToolTimelineEntry): number | undefined {
    if (entry.startedAt == null || entry.endedAt == null) return undefined;
    const diff = entry.endedAt - entry.startedAt;
    return Number.isFinite(diff) ? diff : undefined;
  }

  private normalizedDate(ms: number | undefined): Date | undefined {
    if (ms == null || !Number.isFinite(ms)) return undefined;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private onChipSelect(entry: CanonicalToolTimelineEntry, event: Event): void {
    event.stopPropagation();
    if (entry.needsApproval && entry.approved === undefined) {
      this.reviewingEntryKey = entryIdentity(entry);
      return;
    }
    this.emit('lr-tool-activate', entryCorrelation(entry));
  }

  private onDialogApprove = (event: CustomEvent<{ args: unknown }>): void => {
    event.stopPropagation();
    const entry = this.reviewingEntry;
    if (entry === undefined) return;
    const wrapperEvent = this.emit(
      'lr-tool-approval-decide',
      {
        ...entryCorrelation(entry),
        approved: true,
        args: event.detail.args,
      },
      { cancelable: true },
    );
    if (wrapperEvent.defaultPrevented) {
      this.approvalPending = 'approve';
      event.preventDefault();
      return;
    }
    this.reviewingEntryKey = undefined;
  };

  private onDialogDeny = (event: CustomEvent): void => {
    event.stopPropagation();
    const entry = this.reviewingEntry;
    if (entry === undefined) return;
    const wrapperEvent = this.emit(
      'lr-tool-approval-decide',
      { ...entryCorrelation(entry), approved: false },
      { cancelable: true },
    );
    if (wrapperEvent.defaultPrevented) {
      this.approvalPending = 'deny';
      event.preventDefault();
      return;
    }
    this.reviewingEntryKey = undefined;
  };

  private onDialogClose = (event: CustomEvent): void => {
    event.stopPropagation();
    this.approvalPending = null;
    this.reviewingEntryKey = undefined;
  };

  /** Completes a vetoed approval/denial after the host has persisted the controlled entry. Closes
   *  the review dialog without changing `entries`; no-op when no approval action is pending. */
  finalizePendingApproval(): void {
    if (this.approvalPending === null) return;
    this.approvalPending = null;
    this.reviewingEntryKey = undefined;
  }

  /** Releases a vetoed approval/denial after host persistence fails. Keeps the same dialog open
   *  and retains any edited arguments so the reviewer can retry; no-op when nothing is pending. */
  revertPendingApproval(): void {
    if (this.approvalPending === null) return;
    this.approvalPending = null;
  }

  private onDetailsToggle(entry: CanonicalToolTimelineEntry, event: CustomEvent<{ open: boolean }>): void {
    event.stopPropagation();
    const key = entryIdentity(entry);
    const next = new Set(this.openedEntryIds);
    if (event.detail.open) next.add(key);
    else next.delete(key);
    this.openedEntryIds = next;
  }

  private stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  private onRenderError(
    entry: CanonicalToolTimelineEntry,
    event: CustomEvent<{ toolName: string; error: unknown }>,
  ): void {
    event.stopPropagation();
    this.emit('lr-tool-render-error', { ...entryCorrelation(entry), ...event.detail });
  }

  private redactedEntry(entry: CanonicalToolTimelineEntry, placeholder: string): RedactedEntry {
    const paths = entry.redactedFields;
    const cached = this.redactionCache.get(entry);
    if (
      cached
      && cached.sourceArgs === entry.args
      && cached.sourceResult === entry.result
      && cached.sourceError === entry.error
      && cached.sourcePaths === paths
      && cached.placeholder === placeholder
    ) {
      return cached;
    }
    const redacted: RedactionCacheEntry = {
      sourceArgs: entry.args,
      sourceResult: entry.result,
      sourceError: entry.error,
      sourcePaths: paths,
      placeholder,
      args: redactField(entry.args, 'args', paths, placeholder),
      result: entry.result === undefined
        ? undefined
        : redactField(entry.result, 'result', paths, placeholder),
      error: entry.error === undefined
        ? undefined
        : redactField(entry.error, 'error', paths, placeholder),
    };
    this.redactionCache.set(entry, redacted);
    return redacted;
  }

  private openedDetailsTemplate(entry: CanonicalToolTimelineEntry, placeholder: string): TemplateResult {
    const redacted = this.redactedEntry(entry, placeholder);
    return html`
      <lr-tool-result-view
        part="entry-result"
        tool-name=${entry.name}
        .args=${redacted.args}
        .result=${redacted.result}
        @lr-render-error=${(event: CustomEvent<{ toolName: string; error: unknown }>) =>
          this.onRenderError(entry, event)}
      ></lr-tool-result-view>
      ${redacted.error !== undefined ? html`<p part="entry-error">${redacted.error}</p>` : nothing}
    `;
  }

  private entryTemplate(entry: CanonicalToolTimelineEntry, placeholder: string): TemplateResult {
    const started = this.normalizedDate(entry.startedAt);
    const durationMs = this.durationFor(entry);
    const retryCount = finiteCount(entry.retryCount ?? 0);
    const redactedFields = entry.redactedFields ?? [];
    const pendingApproval = entry.needsApproval === true && entry.approved === undefined;
    const formatter = this.formatTimestamp ?? ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));
    const detailsOpened = this.openedEntryIds.has(entryIdentity(entry));

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
              .icon=${entry.icon ?? ''}
              call-id=${entry.id}
              @lr-tool-call-chip-select=${(event: Event) => this.onChipSelect(entry, event)}
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
              ? html`<span part="entry-redacted-indicator">
                  <span aria-hidden="true">${eyeOffIcon()}</span>
                  <span class="sr-only">${this.localize('envListValueHidden')}</span>
                </span>`
              : nothing}
          </div>
          <lr-details
            part="entry-details"
            .summary=${this.localize('toolTimelineDetailsFor', undefined, { name: entry.name })}
            .open=${detailsOpened}
            @lr-show=${this.stopOwnedEvent}
            @lr-after-show=${this.stopOwnedEvent}
            @lr-hide=${this.stopOwnedEvent}
            @lr-after-hide=${this.stopOwnedEvent}
            @lr-toggle=${(event: CustomEvent<{ open: boolean }>) => this.onDetailsToggle(entry, event)}
          >
            ${detailsOpened ? this.openedDetailsTemplate(entry, placeholder) : nothing}
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
      ${entries.length === 0
        ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
        : html`<ol part="base" role="list" aria-label=${overallSemanticLabel(this) ?? nothing}>
            ${repeat(entries, entryIdentity, (entry) => this.entryTemplate(entry, placeholder))}
          </ol>`}
      ${this.projectionTruncated
        ? html`<p part="limit" role="note">${this.localize('toolTimelineLimit', undefined, {
            count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_ENTRIES),
          })}</p>`
        : nothing}
      <lr-tool-approval-dialog
        part="approval-dialog"
        tool-name=${reviewing?.name ?? ''}
        .proposalKey=${reviewing === undefined ? '' : entryIdentity(reviewing)}
        .args=${reviewing?.args ?? {}}
        .editable=${this.approvalEditable}
        .pending=${this.approvalPending}
        .open=${reviewing !== undefined}
        @focus=${this.stopOwnedEvent}
        @blur=${this.stopOwnedEvent}
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
