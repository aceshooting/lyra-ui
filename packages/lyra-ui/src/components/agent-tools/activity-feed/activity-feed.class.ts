import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getDateTimeFormat, getPluralRules } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.js';
import type { LyraVirtualList, VirtualListRange } from '../../layout/virtual-list/virtual-list.class.js';
import '../../layout/virtual-list/virtual-list.js';
import { styles } from './activity-feed.styles.js';

export type ActivityEntryTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface ActivityEntry {
  id: string;
  text: string;
  /** Literal icon hint (e.g. an emoji), like `<lr-tool-call-chip>`'s `icon`. A small tone dot
   *  renders in its place when omitted. */
  icon?: string;
  /** Invalid strings are treated as unset. */
  timestamp?: Date | string;
  /** Token-mapped, same vocabulary as `ContextMeterTone`. */
  tone?: ActivityEntryTone;
}

export type ActivityFeedMode = 'live' | 'post-hoc';

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

/** `true`-defaulting boolean attribute converter, identical shape to `<lr-task-list>`'s
 *  `trueDefaultBooleanConverter` -- duplicated locally per this library's convention of not
 *  sharing these tiny converters across independently-consumable component files. Lit's default
 *  presence-based `type: Boolean` can never be set back to `false` from a plain-HTML attribute
 *  once the property's own default is `true` (removing an attribute that was never present fires
 *  no `attributeChangedCallback`), so `fromAttribute` checks the literal string instead.
 *  `toAttribute` reflects the `true` state as a present (empty-string) attribute rather than
 *  omitting it, so `follow`'s host attribute is present by default, matching every other
 *  `reflect: true` boolean property in this library. */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? '' : null;
  },
};

/** `hour:minute` in the component's effective locale -- identical algorithm to
 *  `<lr-chat-message>`'s own `defaultFormatTimestamp`, duplicated locally. Uses the shared
 *  per-locale formatter cache: this runs once per entry on every render of a live feed, and
 *  constructing an `Intl.DateTimeFormat` per call is an ICU locale-data lookup that would
 *  otherwise repeat for every visible row on every appended entry. `effectiveLocale` always
 *  resolves to a non-empty tag (it falls back to `'en'`), so no empty-locale guard is needed. */
function defaultFormatTimestamp(date: Date, locale: string): string {
  return getDateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * `<lr-activity-feed>` — an append-only streaming log of granular agent actions ("Searching the
 * web…", "Read src/index.ts"), collapsing to a localized "Completed N steps" summary once the run
 * is over. Entries never change state once added (a step whose status mutates in place belongs to
 * `<lr-task-list>` instead). Implements the shared follow (stick-to-bottom) contract: `follow`
 * is a component-managed, host-assignable property, released on user scroll-up and re-engaged at
 * the bottom, firing `lr-follow-change` on every transition (mount excluded). At/above
 * `virtualizeThreshold` entries, the body renders through an internal `<lr-virtual-list>`
 * instead of a plain keyed list — same list semantics either way, keyed by `id`.
 *
 * Each entry's `text` renders as plain text by default; a host needing richer per-entry content
 * (rendered markdown, a trailing tool-call chip list, etc.) sets `renderText` to fully replace it,
 * identically whether or not the feed is currently virtualized.
 *
 * @customElement lr-activity-feed
 * @event lr-toggle - The header was activated, expanding or collapsing the body. `detail: {
 *   expanded }`.
 * @event lr-follow-change - `follow` released or re-engaged (user scroll, or a host
 *   assignment). `detail: { following }`. Never fired for the value `follow` happens to mount
 *   with.
 * @csspart base - The outer container.
 * @csspart header - The clickable header (`<button>`).
 * @csspart status-dot - The decorative mode indicator dot; pulses while `mode="live"`.
 * @csspart summary - The header's one-line ticker (`live`) or completed-count summary
 *   (`post-hoc`).
 * @csspart toggle - The chevron indicator inside the header.
 * @csspart body - The scrollable region containing the entries (or the internal virtual-list).
 * @csspart entry - One entry row; carries `data-tone`.
 * @csspart entry-icon - The literal `icon` hint, or a tone dot when unset.
 * @csspart entry-text - The entry's `text`. Not rendered while `renderText` is set — its returned
 *   content replaces this part entirely.
 * @csspart entry-timestamp - The formatted timestamp, only rendered while `showTimestamps` and a
 *   valid `timestamp` is set.
 * @cssprop [--lr-activity-feed-max-height=16rem] - Cap on how tall the expanded body grows
 *   before it scrolls internally (non-virtualized mode); also sizes the internal virtual-list.
 */
export class LyraActivityFeed extends LyraElement<LyraActivityFeedEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Append-only: stable ids, new entries at the end. Entries never change state once added. */
  @property({ attribute: false }) entries: ActivityEntry[] = [];

  /** `'live'` follows the tail (per `follow`) and pulses; `'post-hoc'` shows the completed-count
   *  summary and never scrolls. */
  @property({ reflect: true }) mode: ActivityFeedMode = 'live';

  /** Component-managed, host-assignable stick-to-bottom flag — released on user scroll-up,
   *  re-engaged at the bottom. Only drives scrolling in `'live'` mode. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;

  /** Body visibility. Never self-mutated on `mode` changes — a host wanting the finished feed
   *  collapsed sets `mode="post-hoc"` and `expanded=false` together. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** Header text. Localized (`activityFeedLabel`) while at its default `'Activity'`. */
  @property() label = 'Activity';

  /** Trailing `<time datetime>` per entry, default `hour:minute` in `effectiveLocale`. */
  @property({ type: Boolean, attribute: 'show-timestamps' }) showTimestamps = false;

  /** Overrides the default `hour:minute` rendering of every entry's `timestamp`. */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** Overrides the default plain-text `[part="entry-text"]` rendering of every entry with an
   *  arbitrary `TemplateResult` (e.g. rendered markdown, or markdown plus a trailing list of
   *  `<lr-tool-call-chip>`s) — the returned content fully replaces `[part="entry-text"]` rather
   *  than augmenting it, the same way `formatTimestamp` fully replaces the default timestamp
   *  formatting. Applies identically whether or not the feed is currently virtualized, since both
   *  paths render every entry through the same internal template. */
  @property({ attribute: false }) renderText?: (entry: ActivityEntry) => TemplateResult;

  /** At/above this entry count, the body renders through an internal `<lr-virtual-list>`. */
  @property({ type: Number, attribute: 'virtualize-threshold' }) virtualizeThreshold = 200;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  @query('lr-virtual-list') private virtualListEl?: LyraVirtualList;

  private readonly headerId = nextId('activity-feed-header');
  private readonly bodyId = nextId('activity-feed-body');

  /** `true` until the first completed update -- gates `lr-follow-change` and the mode-transition
   *  announcement so mounting with a non-default `follow`/`mode` never itself fires either. */
  private isMounting = true;

  private scrollRafId?: number;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.scrollRafId !== undefined) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = undefined;
    }
  }

  /** `virtualizeThreshold`, normalized to a finite non-negative integer (falling back to the
   *  property's own default of `200`) -- a raw `NaN` (e.g. an invalid `virtualize-threshold`
   *  attribute) would otherwise make `entries.length >= virtualizeThreshold` always false,
   *  silently disabling virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeThreshold(): number {
    return finiteCount(this.virtualizeThreshold, 200);
  }

  private get isVirtualized(): boolean {
    return this.entries.length >= this.effectiveVirtualizeThreshold;
  }

  protected willUpdate(changed: PropertyValues): void {
    if ((changed.has('expanded') || changed.has('mode')) && this.expanded && this.mode === 'live') {
      // Resetting to "anchored" on expand/live-transition, in willUpdate (not updated) so this
      // stays part of the SAME update pass rather than scheduling a second one -- identical
      // willUpdate/updated split rationale to lr-generation-status's elapsedMs computation.
      this.follow = true;
    }
  }

  protected updated(changed: PropertyValues): void {
    const wasMounting = this.isMounting;
    this.isMounting = false;

    if (!wasMounting && changed.has('follow')) {
      this.emit<ActivityFeedFollowChangeDetail>('lr-follow-change', { following: this.follow });
    }

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
    if (justAnchored || (changed.has('entries') && this.expanded && this.mode === 'live' && this.follow)) {
      this.scrollToLatest();
    }
  }

  private scrollToLatest(): void {
    if (this.isVirtualized) {
      // Deferred to updateComplete: the internal virtual-list may not have re-rendered its own
      // windowed rows for the latest `entries` yet within this same synchronous pass.
      void this.updateComplete.then(() => {
        this.virtualListEl?.scrollToIndex(this.entries.length - 1, { align: 'end' });
      });
      return;
    }
    if (this.scrollRafId !== undefined) return;
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = undefined;
      // Re-check inside the callback -- the reader may have scrolled away in the window between
      // scheduling and firing (identical rationale/pattern to lr-thinking-panel's own
      // onContentMutated rAF coalescing).
      if (!(this.expanded && this.mode === 'live' && this.follow)) return;
      const body = this.renderRoot.querySelector('[part="body"]') as HTMLElement | null;
      if (body) body.scrollTop = body.scrollHeight;
    });
  }

  private completedStepsSummary(): string {
    const count = this.entries.length;
    const key =
      getPluralRules(this.effectiveLocale).select(count) === 'one'
        ? 'activityFeedCompletedStep'
        : 'activityFeedCompletedSteps';
    return this.localize(key, undefined, { count });
  }

  private toggle = (): void => {
    this.expanded = !this.expanded;
    this.emit<ActivityFeedToggleDetail>('lr-toggle', { expanded: this.expanded });
  };

  private onBodyScroll = (e: Event): void => {
    if (this.isVirtualized || this.mode !== 'live') return;
    const body = e.currentTarget as HTMLElement;
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= NEAR_BOTTOM_PX;
    if (nearBottom !== this.follow) this.follow = nearBottom;
  };

  private onVirtualListRangeChanged = (e: CustomEvent<VirtualListRange>): void => {
    if (this.mode !== 'live') return;
    const atBottom = this.entries.length > 0 && e.detail.end >= this.entries.length - 1;
    if (atBottom !== this.follow) this.follow = atBottom;
  };

  private normalizedTimestamp(value: Date | string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private entryTemplate(entry: ActivityEntry, ownRole: boolean): TemplateResult {
    const ts = this.normalizedTimestamp(entry.timestamp);
    const formatter = this.formatTimestamp ?? ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));
    return html`
      <div part="entry" role=${ownRole ? 'listitem' : nothing} data-tone=${entry.tone ?? 'neutral'}>
        <span part="entry-icon" aria-hidden="true">${entry.icon ? entry.icon : html`<span class="tone-dot"></span>`}</span>
        ${this.renderText ? this.renderText(entry) : html`<span part="entry-text">${entry.text}</span>`}
        ${this.showTimestamps && ts
          ? html`<time part="entry-timestamp" datetime=${ts.toISOString()}>${formatter(ts)}</time>`
          : nothing}
      </div>
    `;
  }

  render(): TemplateResult {
    const label = this.label === 'Activity' ? this.localize('activityFeedLabel') : this.label;
    const ariaLabel = this.getAttribute('aria-label') || label;
    const headerText = this.mode === 'live' ? (this.entries[this.entries.length - 1]?.text ?? '') : this.completedStepsSummary();
    const virtualized = this.isVirtualized;

    return html`
      <div part="base">
        <button
          part="header"
          type="button"
          id=${this.headerId}
          aria-expanded=${this.expanded ? 'true' : 'false'}
          aria-controls=${this.bodyId}
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
          aria-label=${virtualized ? nothing : ariaLabel}
          ?hidden=${!this.expanded}
          @scroll=${this.onBodyScroll}
        >
          ${virtualized
            ? html`<lr-virtual-list
                .items=${this.entries}
                .renderItem=${(item: unknown) => this.entryTemplate(item as ActivityEntry, false)}
                .keyFunction=${(item: unknown) => (item as ActivityEntry).id}
                aria-label=${ariaLabel}
                @lr-visible-range-changed=${this.onVirtualListRangeChanged}
              ></lr-virtual-list>`
            : repeat(this.entries, (entry) => entry.id, (entry) => this.entryTemplate(entry, true))}
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
