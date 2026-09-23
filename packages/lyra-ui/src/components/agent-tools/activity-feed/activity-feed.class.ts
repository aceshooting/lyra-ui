import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame, LyraVariant } from '../../../internal/variants.js';
import type { LyraTranscriptMode } from '../../../internal/shared-unions.js';
import { nextId } from '../../../internal/a11y.js';
import {
  acquireResolvedAriaRelationship,
  type ResolvedAriaRelationshipLease,
} from '../../../internal/aria-controls.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  repairComposedFocus,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getDateTimeFormat, getNumberFormat, getPluralRules } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import type { LyraVirtualList, LyraVirtualListRange } from '../../layout/virtual-list/virtual-list.class.js';
import { styles } from './activity-feed.styles.js';
import {
  literalSetConverter,
  presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_activityFeedCompletedStep, LYRA_DEFAULT_activityFeedCompletedSteps, LYRA_DEFAULT_activityFeedLabel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface ActivityEntry {
  id: string;
  text: string;
  /** Literal icon hint (e.g. an emoji), like `<lr-tool-call-chip>`'s `icon`. A small variant dot
   *  renders in its place when omitted. */
  icon?: string;
  /** Invalid strings are treated as unset. */
  timestamp?: Date | string;
  /** Token-mapped, the library's shared `variant` vocabulary. */
  variant?: LyraVariant;
  /** Opaque caller payload (e.g. the source record this entry summarizes). Never read or
   *  rendered by `<lr-activity-feed>` itself -- carried through the owned `entries` snapshot and
   *  handed back to `renderText` by reference, never deep-cloned, so a consumer can look up
   *  richer per-entry context without re-scanning its own source array by id on every render. */
  data?: unknown;
}

/** Whether the feed is streaming a run live or replaying a finished one -- the library's shared
 *  transcript-mode vocabulary, identical to `<lr-thinking-panel>`'s `ThinkingPanelMode`. */
export type ActivityFeedMode = LyraTranscriptMode;

const ACTIVITY_FEED_MODE = literalSetConverter<ActivityFeedMode>(['live', 'post-hoc'], 'live');

export interface ActivityFeedToggleDetail {
  expanded: boolean;
}

export interface ActivityFeedFollowChangeDetail {
  following: boolean;
}

export interface LyraActivityFeedEventMap {
  'lr-toggle': CustomEvent<ActivityFeedToggleDetail>;
  'lr-follow-change': CustomEvent<ActivityFeedFollowChangeDetail>;
}

/** Close enough to the body's own max scroll position to count as anchored there -- identical
 *  value and rationale to `<lr-thinking-panel>`'s `NEAR_BOTTOM_PX`. */
const NEAR_BOTTOM_PX = 48;

/** The variant dot's `part` list: the shared `variant-dot` name plus a variant-specific one. Shadow
 *  Parts forbids an attribute selector after `::part()`, so
 *  `::part(variant-dot)[data-variant='success']` is invalid CSS and the variant would be unstylable
 *  once the entry renders inside `<lr-virtual-list>`'s shadow root. A part *list* carries the state
 *  in the part name instead (`::part()` matches with `part~=` semantics, so both names select the
 *  same element). Spelled as a ternary over literals rather than a lookup table so every rendered
 *  part name stays statically resolvable from this file, the same shape `<lr-code-block-core>`'s
 *  line parts use. */
function variantDotPart(variant: LyraVariant): string {
  const part =
    variant === 'brand'
      ? 'variant-dot variant-dot-brand'
      : variant === 'success'
      ? 'variant-dot variant-dot-success'
      : variant === 'warning'
      ? 'variant-dot variant-dot-warning'
      : variant === 'danger'
      ? 'variant-dot variant-dot-danger'
      : 'variant-dot variant-dot-neutral';
  return part;
}

/** `hour:minute` in the component's effective locale -- identical algorithm to
 *  `<lr-chat-message>`'s own `defaultFormatTimestamp`, duplicated locally. Uses the shared
 *  per-locale formatter cache: this runs once per entry on every render of a live feed, and
 *  constructing an `Intl.DateTimeFormat` per call is an ICU locale-data lookup that would
 *  otherwise repeat for every visible row on every appended entry. `effectiveLocale` always
 *  resolves to a non-empty tag (it falls back to `'en'`), so no empty-locale guard is needed. */
function defaultFormatTimestamp(date: Date, locale: string): string {
  return getDateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * `<lr-activity-feed>` — an append-only streaming log of granular agent actions ("Searching the
 * web…", "Read src/index.ts"), collapsing to a localized "Completed N steps" summary once the run
 * is over. Entries never change state once added (a step whose status mutates in place belongs to
 * `<lr-task-list>` instead). Implements the shared follow (stick-to-bottom) contract: `follow`
 * is a component-managed, host-assignable property, released on user scroll-up and re-engaged at
 * the bottom. `lr-follow-change` reports user-driven transitions only; direct host assignments are
 * controlled input and never echo an event. At/above
 * `virtualizeAt` entries, the body renders through an internal `<lr-virtual-list>`
 * instead of a plain keyed list — same list semantics either way, keyed by `id`. Empty/blank ids
 * are omitted and duplicates normalize before counts, follow calculations, and rendering; the
 * first occurrence wins.
 *
 * Each entry's `text` renders as plain text by default; a host needing richer per-entry content
 * (rendered markdown, a trailing tool-call chip list, etc.) sets `renderText` to replace the
 * default text inside the stable `entry-text` styling wrapper, identically whether or not the feed
 * is currently virtualized. An entry's optional `data` is an opaque caller payload -- never read
 * or rendered by this component -- carried through by reference (never deep-cloned) and handed
 * back to `renderText`, so a host needing the original source record behind a rendered line does
 * not have to re-derive it by re-scanning its own source array on every render.
 *
 * `compact` tightens the header and entry-row padding for dense transcript rows. `frame="plain"`
 * removes the outside card chrome when a containing message or panel already supplies it; the
 * header/body divider remains, so the disclosure keeps its internal structure -- the same two-knob
 * convention `<lr-thinking-panel>` and `<lr-confirm-bar>` already establish. The card's own paint
 * is retunable without a `::part(base)` override through `--lr-activity-feed-background`,
 * `--lr-activity-feed-border-color` and `--lr-activity-feed-radius`; each is an inline `var()`
 * fallback at its point of use, so an unset feed renders exactly as before and any of the three can
 * be set on the feed or on an ancestor transcript.
 *
 * Focus is repaired, not merely dropped, when the currently focused control disappears from under
 * it: collapsing (`expanded` becoming `false`) moves focus already inside the body to
 * `[part="header"]` before the body is hidden, and an `entries` update that removes the specific
 * row holding focus does the same once that update (and, while virtualized, the internal
 * `<lr-virtual-list>`'s own follow-up render) has settled. Neither case fires when focus is
 * elsewhere -- appending a live entry never steals focus from an unrelated, still-present control.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-activity-feed
 * @event lr-toggle - The header was activated, expanding or collapsing the body. `detail: {
 *   expanded }`.
 * @event lr-follow-change - A user scroll released or re-engaged `follow`. `detail: {
 *   following }`. Direct property/attribute assignments never echo an event.
 * @csspart base - The outer container.
 * @csspart header - The clickable header (`<button>`).
 * @csspart status-dot - The decorative mode indicator dot; pulses while `mode="live"`.
 * @csspart label - The header's title text — `label`, or its localized default when `label` is
 *   omitted.
 * @csspart summary - The header's one-line ticker (`live`) or completed-count summary
 *   (`post-hoc`).
 * @csspart toggle - The chevron indicator inside the header.
 * @csspart body - The scrollable region containing the entries (or the internal virtual-list).
 * @csspart entry - One entry row; carries `data-variant`.
 * @csspart entry-icon - The literal `icon` hint, or a variant dot when unset.
 * @csspart variant-dot - The variant dot rendered inside `entry-icon` when the entry sets no
 *   literal `icon`. Its own named part rather than an internal class, so it stays styleable in both
 *   the plain and virtualized rendering paths and reachable from a consumer's `::part()`. Also
 *   carries a variant-specific name, since `::part()` cannot be qualified by `[data-variant]`.
 * @csspart variant-dot-neutral - An entry with no `variant`'s dot (also carries `variant-dot`).
 * @csspart variant-dot-brand - A `brand`-variant entry's dot (also carries `variant-dot`).
 * @csspart variant-dot-success - A `success`-variant entry's dot (also carries `variant-dot`).
 * @csspart variant-dot-warning - A `warning`-variant entry's dot (also carries `variant-dot`).
 * @csspart variant-dot-danger - A `danger`-variant entry's dot (also carries `variant-dot`).
 * @csspart entry-text - The entry's text styling wrapper. `renderText`, when set, supplies rich
 *   content inside this stable part instead of replacing the part itself.
 * @csspart entry-timestamp - The formatted timestamp, only rendered while `showTimestamps` and a
 *   valid `timestamp` is set.
 * @cssprop [--lr-activity-feed-max-height=16rem] - Cap on how tall the expanded body grows
 *   before it scrolls internally (non-virtualized mode); also sizes the internal virtual-list.
 * @cssprop [--lr-activity-feed-live-status-color=var(--lr-color-brand)] - Background color of
 *   `status-dot` while `mode="live"`.
 * @cssprop [--lr-activity-feed-compact-header-padding=var(--lr-space-2xs) var(--lr-space-s)] -
 *   `[part="header"]` padding while `compact`.
 * @cssprop [--lr-activity-feed-compact-header-gap=var(--lr-space-2xs)] - Gap between the header
 *   toggle, status dot, label, and summary while `compact`.
 * @cssprop [--lr-activity-feed-compact-entry-padding=var(--lr-space-2xs) var(--lr-space-s)] -
 *   `[part="entry"]` padding while `compact`.
 * @cssprop [--lr-activity-feed-compact-entry-gap=var(--lr-space-2xs)] - Gap between an entry's
 *   icon/dot and its label/timestamp while `compact`.
 * @cssprop [--lr-activity-feed-entry-text-link-color=var(--lr-color-brand)] - Colour of an anchor
 *   returned from `renderText`. Such an anchor renders inside this component's shadow root (or
 *   the internal `<lr-virtual-list>`'s, once virtualized), so page CSS cannot reach it and
 *   `::part()` cannot select past the first compound selector to reach it either; without this
 *   hook it computes to the UA default link blue. Set `revert` for the UA default.
 * @cssprop [--lr-activity-feed-background=var(--lr-color-surface)] - Fill of the outer card
 *   (`[part="base"]`) while `frame="card"`. `frame="plain"` still removes the fill entirely.
 * @cssprop [--lr-activity-feed-border-color=var(--lr-color-border)] - Colour of the outer card's
 *   border and of the header/body divider, which `frame="plain"` keeps.
 * @cssprop [--lr-activity-feed-radius=var(--lr-radius)] - Corner radius of the outer card.
 *   `frame="plain"` still squares the corners.
 * @status stable
 * @since 4.0.0
 */
export class LyraActivityFeed extends LyraElement<LyraActivityFeedEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    activityFeedCompletedStep: LYRA_DEFAULT_activityFeedCompletedStep,
    activityFeedCompletedSteps: LYRA_DEFAULT_activityFeedCompletedSteps,
    activityFeedLabel: LYRA_DEFAULT_activityFeedLabel,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['entries']);
  /** Entries may carry opaque caller `data`. Keep each admitted entry's identity only, rather
   *  than deep-cloning unknown data -- the same policy `<lr-prompt-queue>`'s `items` uses for its
   *  own opaque `metadata` field. */
  protected static override readonly identityCollectionProperties = Object.freeze(['entries']);

  static override styles = [LyraElement.styles, styles];

  /** Append-only: stable ids, new entries at the end. Entries never change state once added.
   *  Empty/blank ids are omitted and duplicates normalize first-wins before summary,
   *  virtualization, and rendering. */
  @property({ attribute: false }) entries: readonly ActivityEntry[] = [];

  /** `'live'` follows the tail (per `follow`) and pulses; `'post-hoc'` shows the completed-count
   *  summary and never scrolls. */
  private _mode: ActivityFeedMode = 'live';

  @property({ reflect: true, converter: ACTIVITY_FEED_MODE })
  get mode(): ActivityFeedMode {
    return this._mode;
  }
  set mode(next: ActivityFeedMode) {
    const normalized = ACTIVITY_FEED_MODE.normalizeReflected(this, 'mode', next);
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
  }

  /** Component-managed, host-assignable stick-to-bottom flag — released on user scroll-up,
   *  re-engaged at the bottom. Only drives scrolling in `'live'` mode. */
  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  follow = true;

  /** Body visibility. Never self-mutated on `mode` changes — a host wanting the finished feed
   *  collapsed sets `mode="post-hoc"` and `expanded=false` together. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** Optional header-text override. Omission localizes `activityFeedLabel`; any supplied string,
   *  including `'Activity'` or `''`, is rendered verbatim. The semantic list uses an authored host
   *  `aria-label` when present (including an explicit empty value), otherwise its localized
   *  `activityFeedLabel` fallback, while this remains the visible header text. */
  @property() label?: string;

  /** Tighter header and entry-row padding and gap for dense transcript contexts. Defaults to
   *  `false`, preserving the regular-density treatment. This changes density only; the outer
   *  border and surface remain, so use `frame="plain"` to remove card chrome. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled outer container. `'plain'` removes that outer border, background,
   *  and corner radius so a feed nested inside existing message chrome does not double it. Plain
   *  preserves the header/body divider and whichever regular or compact padding applies. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** Trailing `<time datetime>` per entry, default `hour:minute` in `effectiveLocale`. */
  @property({ type: Boolean, attribute: 'show-timestamps' }) showTimestamps = false;

  /** Overrides the default `hour:minute` rendering of every entry's `timestamp`. */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** Overrides the default plain text inside every `[part="entry-text"]` wrapper with an arbitrary
   *  `TemplateResult` (e.g. rendered markdown, or markdown plus a trailing list of
   *  `<lr-tool-call-chip>`s). The stable wrapper remains available for styling in both rendering
   *  paths, since both render every entry through the same internal template. A returned anchor
   *  is given the `--lr-activity-feed-entry-text-link-color` hook (see below) since it otherwise
   *  renders inside a shadow root neither page CSS nor `::part()` can reach past the wrapper;
   *  other descendant markup stays reachable only by inheritance or an inline style. */
  @property({ attribute: false }) renderText?: (entry: ActivityEntry) => TemplateResult;

  /** At/above this entry count, the body renders through an internal `<lr-virtual-list>`. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 199;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  @query('lr-virtual-list') private virtualListEl?: LyraVirtualList;

  private readonly headerId = nextId('activity-feed-header');
  private readonly bodyId = nextId('activity-feed-body');

  /** Stable across renders on purpose -- a fresh closure here would defeat the internal
   *  `<lr-virtual-list>`'s row-offset cache (it treats a `keyFunction` identity change the
   *  same as an `items` change) on every unrelated re-render. */
  private readonly activityEntryKey = (item: unknown): string => (item as ActivityEntry).id;

  /** `true` until the first completed update -- gates the mode-transition announcement so
   *  mounting in a non-default mode never announces historical state. */
  private isMounting = true;

  private scrollRafId?: number;
  private scrollRafOwner?: Window;
  private scrollRafDocument?: Document;
  private virtualAnchorReleaseRafId?: number;
  private virtualAnchorReleaseRafOwner?: Window;
  private virtualAnchorReleaseRafDocument?: Document;
  private anchoringVirtualTail = false;
  private ownerRealmGeneration = 0;
  private virtualAnchorRequest = 0;
  private externalLabelledByLease?: ResolvedAriaRelationshipLease;
  private externalDescribedByLease?: ResolvedAriaRelationshipLease;
  private relationshipSyncRequest = 0;
  /** Captured in `willUpdate()` before an `entries` change re-renders, settled in `updated()`
   *  once it's clear whether the specific row that held focus actually disappeared. The snapshot
   *  already records that row as its `activeElement`, so no parallel node field is kept. */
  private pendingEntryFocusRepair?: ComposedFocusRepairSnapshot;
  private entryFocusRepairRequest = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.syncListRelationships();
      this.scheduleListRelationshipSync();
    }
    if (this.hasUpdated && this.shouldFollowLiveTail) this.scrollToLatest();
  }

  override disconnectedCallback(): void {
    this.releaseListRelationships();
    this.resetOwnerRealmWork();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseListRelationships();
    this.resetOwnerRealmWork();
    if (this.isConnected && this.hasUpdated) {
      this.syncListRelationships();
      this.scheduleListRelationshipSync();
    }
    if (this.isConnected && this.shouldFollowLiveTail) this.scrollToLatest();
  }

  /** `virtualizeAt`, normalized to a finite non-negative integer (falling back to the
   *  property's own default of `199`) -- a raw `NaN` (e.g. an invalid `virtualize-at`
   *  attribute) would otherwise make `entries.length > virtualizeAt` always false,
   *  silently disabling virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 199);
  }

  private get normalizedEntries(): ActivityEntry[] {
    return firstByIdentity(Array.isArray(this.entries) ? this.entries : [], (entry) => entry.id);
  }

  private get isVirtualized(): boolean {
    return this.normalizedEntries.length > this.effectiveVirtualizeAt;
  }

  private get shouldFollowLiveTail(): boolean {
    return this.expanded && this.mode === 'live' && this.follow;
  }

  private cancelScrollFrame(): void {
    if (this.scrollRafId !== undefined) {
      this.scrollRafOwner?.cancelAnimationFrame(this.scrollRafId);
    }
    this.scrollRafId = undefined;
    this.scrollRafOwner = undefined;
    this.scrollRafDocument = undefined;
  }

  private cancelVirtualAnchorReleaseFrame(): void {
    if (this.virtualAnchorReleaseRafId !== undefined) {
      this.virtualAnchorReleaseRafOwner?.cancelAnimationFrame(this.virtualAnchorReleaseRafId);
    }
    this.virtualAnchorReleaseRafId = undefined;
    this.virtualAnchorReleaseRafOwner = undefined;
    this.virtualAnchorReleaseRafDocument = undefined;
  }

  private resetOwnerRealmWork(): void {
    this.ownerRealmGeneration += 1;
    this.virtualAnchorRequest += 1;
    this.relationshipSyncRequest += 1;
    this.entryFocusRepairRequest += 1;
    this.pendingEntryFocusRepair = undefined;
    this.cancelScrollFrame();
    this.cancelVirtualAnchorReleaseFrame();
    this.anchoringVirtualTail = false;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if ((changed.has('expanded') || changed.has('mode')) && this.expanded && this.mode === 'live') {
      // Resetting to "anchored" on expand/live-transition, in willUpdate (not updated) so this
      // stays part of the SAME update pass rather than scheduling a second one -- identical
      // willUpdate/updated split rationale to lr-generation-metrics's elapsedMs computation.
      this.follow = true;
    }
    if (changed.has('expanded') && changed.get('expanded') === true && !this.expanded) {
      this.repairFocusOnCollapse();
    }
    if (changed.has('entries')) {
      this.captureEntryFocusRepair();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncListRelationships();
    this.scheduleListRelationshipSync();
    const wasMounting = this.isMounting;
    this.isMounting = false;

    if (!wasMounting && changed.has('mode')) {
      const previousMode = changed.get('mode') as ActivityFeedMode | undefined;
      if (previousMode === 'live' && this.mode === 'post-hoc') {
        const region = this.liveRegion;
        if (region) {
          region.mode = 'polite';
          region.announce(this.completedStepsSummary(), { force: true });
        }
      }
    }

    const justAnchored = (changed.has('expanded') || changed.has('mode')) && this.expanded && this.mode === 'live';
    const followingChangedRenderPath =
      changed.has('virtualizeAt') && this.expanded && this.mode === 'live' && this.follow;
    if (
      justAnchored ||
      followingChangedRenderPath ||
      (changed.has('entries') && this.expanded && this.mode === 'live' && this.follow)
    ) {
      this.scrollToLatest();
    }

    if (changed.has('entries') && this.pendingEntryFocusRepair) {
      this.settleEntryFocusRepair();
    }
  }

  /** The always-rendered header button, this component's single focus-repair fallback target. */
  private get headerElement(): HTMLElement | null {
    // `willUpdate()` runs before the first render, and under SSR there is no render root at all
    // (`@lit-labs/ssr` drives `connectedCallback` -> `willUpdate` with `renderRoot` still
    // undefined), so reading it unguarded throws during a server render. Focus repair is
    // meaningless before anything is painted, so an absent root is simply "nothing to repair".
    return this.hasUpdated ? (this.renderRoot?.querySelector<HTMLElement>('[part="header"]') ?? null) : null;
  }

  /** Moves focus already inside the body to `[part="header"]` before the body becomes hidden --
   *  the shared helper's synchronous capture-then-apply, called from `willUpdate()`, the same
   *  shape `<lr-callout>`'s own collapse handling uses. The header renders regardless of
   *  `expanded`, so its focusability never depends on the render this `willUpdate()` is about to
   *  commit, and no async settle (or generation guard) is needed. A no-op when focus is
   *  elsewhere. */
  private repairFocusOnCollapse(): void {
    repairComposedFocus(this, () => this.headerElement);
  }

  /**
   * Captures a possible focus repair before an `entries` change re-renders. Unlike collapsing,
   * whether repair is actually needed depends on whether the *specific* row that held focus
   * survives the render -- appending a new live entry must never steal focus from an unrelated,
   * still-present control. `settleEntryFocusRepair()` (`updated()`) resolves that once the render
   * (and, while virtualized, the internal `<lr-virtual-list>`'s own follow-up render) has
   * committed, by checking whether the originally focused node is still connected.
   */
  private captureEntryFocusRepair(): void {
    this.pendingEntryFocusRepair = captureComposedFocusRepair(this, this.headerElement) ?? undefined;
  }

  /** Settles a capture from `captureEntryFocusRepair()`. Guarded by `entryFocusRepairRequest` (a
   *  newer capture supersedes an older, still-pending one) and `ownerRealmGeneration` (a
   *  disconnect/adopt in between invalidates it) so a stale check can never steal focus that has
   *  since legitimately moved elsewhere. */
  private settleEntryFocusRepair(): void {
    const pending = this.pendingEntryFocusRepair;
    this.pendingEntryFocusRepair = undefined;
    if (!pending) return;
    const request = ++this.entryFocusRepairRequest;
    const generation = this.ownerRealmGeneration;
    const settle = (): void => {
      if (
        request !== this.entryFocusRepairRequest ||
        generation !== this.ownerRealmGeneration ||
        !this.isConnected
      ) {
        return;
      }
      // Still connected: the render kept (or reordered) this row, so its focus is still valid.
      if (pending.activeElement.isConnected) return;
      // The fallback is resolved as a thunk, at apply time, so the repair names whichever header
      // node the settled render left behind rather than the one captured before it.
      applyComposedFocusRepair(pending, () => this.headerElement);
    };
    const list = this.virtualListEl;
    if (list) void list.updateComplete.then(settle);
    else settle();
  }

  private scrollToLatest(): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected || !this.shouldFollowLiveTail) return;
    const generation = this.ownerRealmGeneration;
    if (this.isVirtualized) {
      this.cancelScrollFrame();
      this.cancelVirtualAnchorReleaseFrame();
      this.anchoringVirtualTail = true;
      const request = ++this.virtualAnchorRequest;
      // Deferred to updateComplete: the internal virtual-list may not have re-rendered its own
      // windowed rows for the latest `entries` yet within this same synchronous pass.
      void this.updateComplete.then(() => {
        const list = this.virtualListEl;
        if (
          request !== this.virtualAnchorRequest ||
          generation !== this.ownerRealmGeneration ||
          this.ownerDocument !== ownerDocument ||
          !this.isConnected
        ) {
          return;
        }
        if (!list || !this.isVirtualized || !this.shouldFollowLiveTail) {
          this.anchoringVirtualTail = false;
          return;
        }
        list.scrollToIndex(this.normalizedEntries.length - 1, {
          align: 'end',
          behavior: 'auto',
        });
        const firstHandle = ownerWindow.requestAnimationFrame(() => {
          if (
            this.virtualAnchorReleaseRafId !== firstHandle ||
            this.virtualAnchorReleaseRafOwner !== ownerWindow ||
            this.virtualAnchorReleaseRafDocument !== ownerDocument ||
            request !== this.virtualAnchorRequest ||
            generation !== this.ownerRealmGeneration ||
            !this.isConnected ||
            this.ownerDocument !== ownerDocument
          ) {
            return;
          }
          this.virtualAnchorReleaseRafId = undefined;
          this.virtualAnchorReleaseRafOwner = undefined;
          this.virtualAnchorReleaseRafDocument = undefined;
          if (!this.anchoringVirtualTail || !this.isVirtualized || !this.shouldFollowLiveTail) {
            this.anchoringVirtualTail = false;
            return;
          }
          const secondHandle = ownerWindow.requestAnimationFrame(() => {
            if (
              this.virtualAnchorReleaseRafId !== secondHandle ||
              this.virtualAnchorReleaseRafOwner !== ownerWindow ||
              this.virtualAnchorReleaseRafDocument !== ownerDocument ||
              request !== this.virtualAnchorRequest ||
              generation !== this.ownerRealmGeneration ||
              !this.isConnected ||
              this.ownerDocument !== ownerDocument
            ) {
              return;
            }
            this.virtualAnchorReleaseRafId = undefined;
            this.virtualAnchorReleaseRafOwner = undefined;
            this.virtualAnchorReleaseRafDocument = undefined;
            this.anchoringVirtualTail = false;
          });
          this.virtualAnchorReleaseRafId = secondHandle;
          this.virtualAnchorReleaseRafOwner = ownerWindow;
          this.virtualAnchorReleaseRafDocument = ownerDocument;
        });
        this.virtualAnchorReleaseRafId = firstHandle;
        this.virtualAnchorReleaseRafOwner = ownerWindow;
        this.virtualAnchorReleaseRafDocument = ownerDocument;
      });
      return;
    }
    this.virtualAnchorRequest += 1;
    this.cancelVirtualAnchorReleaseFrame();
    this.anchoringVirtualTail = false;
    if (this.scrollRafId !== undefined) return;
    const handle = ownerWindow.requestAnimationFrame(() => {
      if (
        this.scrollRafId !== handle ||
        this.scrollRafOwner !== ownerWindow ||
        this.scrollRafDocument !== ownerDocument ||
        generation !== this.ownerRealmGeneration ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.scrollRafId = undefined;
      this.scrollRafOwner = undefined;
      this.scrollRafDocument = undefined;
      // Re-check inside the callback -- the reader may have scrolled away in the window between
      // scheduling and firing (identical rationale/pattern to lr-thinking-panel's own
      // onContentMutated rAF coalescing).
      if (!this.shouldFollowLiveTail || this.isVirtualized) return;
      const body = this.renderRoot.querySelector('[part="body"]') as HTMLElement | null;
      if (body) body.scrollTop = body.scrollHeight;
    });
    this.scrollRafId = handle;
    this.scrollRafOwner = ownerWindow;
    this.scrollRafDocument = ownerDocument;
  }

  private completedStepsSummary(): string {
    const count = this.normalizedEntries.length;
    const key =
      getPluralRules(this.effectiveLocale).select(count) === 'one'
        ? 'activityFeedCompletedStep'
        : 'activityFeedCompletedSteps';
    return this.localize(key, undefined, {
      count: getNumberFormat(this.effectiveLocale).format(count),
    });
  }

  /** The element that owns the real list role in either rendering path. The virtual list's public
   *  scrollContainer is its internal `[part="base"]` list owner, not the composed custom-element
   *  host, so host IDREF relationships reach the semantic element without widening virtual-list's
   *  public API. */
  private get listSemanticOwner(): HTMLElement | null {
    if (!this.isVirtualized) {
      return this.renderRoot.querySelector<HTMLElement>('[part="body"][role="list"]');
    }
    return this.virtualListEl?.scrollContainer ?? null;
  }

  /** Projects both authored host IDREF relationships onto the current semantic list owner. */
  private syncListRelationships(): void {
    const target = this.listSemanticOwner;
    if (!target) {
      this.releaseListRelationships();
      return;
    }
    if (!this.externalLabelledByLease) {
      this.externalLabelledByLease = acquireResolvedAriaRelationship(this, target, 'aria-labelledby');
    } else {
      this.externalLabelledByLease.update(target);
    }
    if (!this.externalDescribedByLease) {
      this.externalDescribedByLease = acquireResolvedAriaRelationship(this, target, 'aria-describedby');
    } else {
      this.externalDescribedByLease.update(target);
    }
  }

  /** A parent update can finish before the composed virtual list creates its real list owner. */
  private scheduleListRelationshipSync(): void {
    const list = this.virtualListEl;
    if (!this.isVirtualized || !list || !this.isConnected) {
      this.relationshipSyncRequest += 1;
      return;
    }
    const request = ++this.relationshipSyncRequest;
    const ownerDocument = this.ownerDocument;
    const generation = this.ownerRealmGeneration;
    void list.updateComplete.then(() => {
      if (
        request !== this.relationshipSyncRequest ||
        generation !== this.ownerRealmGeneration ||
        this.ownerDocument !== ownerDocument ||
        !this.isConnected ||
        !this.isVirtualized ||
        this.virtualListEl !== list
      ) {
        return;
      }
      this.syncListRelationships();
    });
  }

  private releaseListRelationships(): void {
    this.externalLabelledByLease?.release();
    this.externalLabelledByLease = undefined;
    this.externalDescribedByLease?.release();
    this.externalDescribedByLease = undefined;
  }

  private toggle = (): void => {
    this.expanded = !this.expanded;
    this.emit('lr-toggle', { expanded: this.expanded });
  };

  private setFollowFromUser(following: boolean): void {
    if (following === this.follow) return;
    this.follow = following;
    this.emit('lr-follow-change', { following });
  }

  private onBodyScroll = (e: Event): void => {
    if (this.isVirtualized || this.mode !== 'live') return;
    const body = e.currentTarget as HTMLElement;
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= NEAR_BOTTOM_PX;
    this.setFollowFromUser(nearBottom);
  };

  private onVirtualListRangeChanged = (e: CustomEvent<LyraVirtualListRange>): void => {
    e.stopPropagation();
    if (this.mode !== 'live') return;
    if (this.anchoringVirtualTail) return;
    const entries = this.normalizedEntries;
    const atBottom = entries.length > 0 && e.detail.end >= entries.length - 1;
    this.setFollowFromUser(atBottom);
  };

  private stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private normalizedTimestamp(value: Date | string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private entryTemplate(entry: ActivityEntry, ownRole: boolean): TemplateResult {
    const ts = this.normalizedTimestamp(entry.timestamp);
    const formatter = this.formatTimestamp ?? ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));
    const variant = entry.variant ?? 'neutral';
    const dotPart = variantDotPart(variant);
    return html`
      <div part="entry" role=${ownRole ? 'listitem' : nothing} data-variant=${variant}>
        <span part="entry-icon" aria-hidden="true"
          >${entry.icon ? entry.icon : html`<span part=${dotPart} data-variant=${variant}></span>`}</span
        >
        <span part="entry-text">${this.renderText ? this.renderText(entry) : entry.text}</span>
        ${this.showTimestamps && ts
          ? html`<time part="entry-timestamp" datetime=${ts.toISOString()}>${formatter(ts)}</time>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const entries = this.normalizedEntries;
    const fallbackLabel = this.localize('activityFeedLabel');
    const label = this.label == null ? fallbackLabel : this.label;
    const headerText = this.mode === 'live' ? entries[entries.length - 1]?.text ?? '' : this.completedStepsSummary();
    const listAriaLabel = this.hasAttribute('aria-label') ? this.getAttribute('aria-label') ?? '' : fallbackLabel;
    const headerAriaLabel = `${label} ${headerText}`.trim() ? nothing : fallbackLabel;
    const virtualized = this.isVirtualized;

    return html`
      <div part="base">
        <button
          part="header"
          type="button"
          id=${this.headerId}
          aria-expanded=${this.expanded ? 'true' : 'false'}
          aria-controls=${this.bodyId}
          aria-label=${headerAriaLabel}
          @click=${this.toggle}
        >
          <span part="toggle" aria-hidden="true">${chevronIcon()}</span>
          <span part="status-dot" aria-hidden="true"></span>
          <span part="label">${label}</span>
          <span part="summary">${headerText}</span>
        </button>
        <div
          part="body"
          id=${this.bodyId}
          role=${virtualized ? nothing : 'list'}
          tabindex=${virtualized ? nothing : '0'}
          aria-label=${virtualized ? nothing : listAriaLabel}
          ?hidden=${!this.expanded}
          @scroll=${this.onBodyScroll}
        >
          ${virtualized
            ? html`<lr-virtual-list
                exportparts="entry:entry, entry-icon:entry-icon, variant-dot:variant-dot, variant-dot-neutral:variant-dot-neutral, variant-dot-brand:variant-dot-brand, variant-dot-success:variant-dot-success, variant-dot-warning:variant-dot-warning, variant-dot-danger:variant-dot-danger, entry-text:entry-text, entry-timestamp:entry-timestamp"
                .items=${guard([this.entries], () => entries)}
                .renderItem=${(item: unknown) => this.entryTemplate(item as ActivityEntry, false)}
                .keyFunction=${this.activityEntryKey}
                aria-label=${listAriaLabel}
                @lr-visible-range-change=${this.onVirtualListRangeChanged}
                @lr-virtual-scroll=${this.stopOwnedEvent}
              ></lr-virtual-list>`
            : repeat(
                entries,
                (entry) => entry.id,
                (entry) => this.entryTemplate(entry, true),
              )}
        </div>
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-activity-feed': LyraActivityFeed;
  }
}
