import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { captureComposedFocusRepair, applyComposedFocusRepair } from '../../../internal/focus-navigation.js';
import { styles } from './transcript-feed.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { normalizeLyraTimestamp, type LyraTimestamp } from '../timestamp.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_jumpToLatest, LYRA_DEFAULT_transcriptFeedEmpty, LYRA_DEFAULT_transcriptFeedInterim, LYRA_DEFAULT_transcriptFeedLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraTranscriptEntry {
  id: string;
  speaker?: string;
  /** Required caption text. Runtime records without a string value are omitted. */
  text: string;
  interim?: boolean;
  timestamp?: LyraTimestamp;
}

const NEAR_BOTTOM_PX = 48;

export interface LyraTranscriptFeedEventMap {
  'lr-follow-change': CustomEvent<{ following: boolean }>;
}

/**
 * `<lr-transcript-feed>` — live captions for an in-progress voice session: speaker-grouped
 * entries, interim-vs-final styling with in-place upgrades keyed by `id`, and a stick-to-bottom
 * auto-scroll with release, the same `follow`/`lr-follow-change` contract `lr-terminal` uses.
 *
 * Rendering reconciles `entries` keyed by `id` via Lit's `repeat()`. Ids must be nonempty,
 * nonblank, and unique within a session, and `text` must be a string; invalid and later duplicate
 * rows are omitted with the first valid occurrence winning. A same-`id` entry with new `text`
 * replaces in place; a same-`id` entry whose
 * `interim` flips from `true` to unset/`false`
 * moves from the interim area into the `role="log"` region and announces exactly once. Interim
 * entries render *after* the log container, visible but structurally outside it, so per-token
 * mutations are never spoken by assistive tech.
 *
 * That announcement does **not** come from the shadow `role="log"` region, which is explicitly
 * `aria-live="off"`: a live region rendered inside a component's own shadow root is not reliably
 * announced (JAWS with Firefox ignores one outright). Each newly final entry's `text` is announced
 * once through the shared light-DOM `polite` sink instead (`internal/announcer.ts`), the same route
 * `<lr-chat-viewport>` and `<lr-terminal>` take. The entries a feed is *mounted* with are existing
 * transcript rather than newly spoken captions, so the first render only records them; a caption is
 * announced when it becomes final on a later update, and never re-announced afterwards.
 *
 * Live captions only: recorded-media transcript sync — clickable cues, seek-on-select — is a
 * separate concern from this component.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * Activating the focused jump action resumes follow and transfers focus to the scroll base when the action disappears, unless a newer outside focus move takes precedence.
 *
 * @customElement lr-transcript-feed
 * @slot empty - Custom empty state. Default: the localized "No transcript yet".
 * @event lr-follow-change - `detail: { following: boolean }` — a user scroll or jump-button click
 *   changed stick-to-bottom. Direct `follow` assignments and calling `scrollToBottom()` directly
 *   are controlled input and do not echo an event, matching `lr-terminal`'s identical contract.
 * @csspart base - The scroll container.
 * @csspart log - The `role="log"` region wrapping final entries only.
 * @csspart interim-area - The wrapper around the interim (not-yet-final) entries, rendered as a sibling of `log`. Only rendered while at least one interim entry exists.
 * @csspart entry - One entry row (final or interim).
 * @csspart speaker - An entry's speaker label (omitted for a row that repeats the previous row's speaker).
 * @csspart text - An entry's text (`dir="auto"`, for mixed-language captions).
 * @csspart timestamp - An entry's timestamp, shown only when `show-timestamps` is set.
 * @csspart interim - Present (alongside `entry`) on an interim row.
 * @csspart jump-button - The "jump to latest" affordance, shown only while `follow` is `false`.
 * @csspart empty - The empty-state wrapper.
 * @status stable
 * @since 4.0.0
 */
export class LyraTranscriptFeed extends LyraElement<LyraTranscriptFeedEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    jumpToLatest: LYRA_DEFAULT_jumpToLatest,
    transcriptFeedEmpty: LYRA_DEFAULT_transcriptFeedEmpty,
    transcriptFeedInterim: LYRA_DEFAULT_transcriptFeedInterim,
    transcriptFeedLabel: LYRA_DEFAULT_transcriptFeedLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['entries']);

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) entries: readonly LyraTranscriptEntry[] = [];
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;
  @property({ type: Boolean, attribute: 'show-timestamps' }) showTimestamps = false;
  /** Overrides the default `Intl.DateTimeFormat` short-time rendering. */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;
  /** `> 0` renders only the newest N rows (host `entries` data is untouched); `0` explicitly
   *  opts into rendering the full history. */
  @property({ type: Number, attribute: 'max-rendered-entries' }) maxRenderedEntries = 500;
  /** Session identity. Changing it resets final-announcement history and treats
   *  the new session's current entries as a silent baseline. */
  @property({ attribute: 'session-id' }) sessionId = '';
  /** Accessible name for the `role="log"` region. Optional. Omitting it localizes the default
   *  `transcriptFeedLabel` message; an explicit empty string renders no visible/accessible label,
   *  unless `accessibleLabel` is also set (it wins over both). */
  @property() label?: string;
  /** Overrides the log region's computed accessible name. Wins over `label` and the localized
   *  default. Attribute-reflects from a host-level `aria-label` so a plain-markup consumer gets
   *  ARIA-name forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private _isFirstUpdate = true;

  /** Handle on the shared light-DOM `polite` region every announcement is written to. */
  private announcementSink?: AnnouncementSink;
  /** Ids already spoken (or recorded on the first render), so a caption announces exactly once
   *  however many later updates keep re-rendering the same row. */
  private announcedFinalIds = new Set<string>();
  private sessionChanged = false;
  private pendingSessionBaseline = false;

  /** `maxRenderedEntries`, normalized to a finite non-negative integer (falling back to the
   *  property's own default of `500`) -- a raw `NaN` (e.g. an invalid
   *  `max-rendered-entries` attribute) would otherwise make `maxRenderedEntries > 0` always
   *  false, which happens to already match the "render all" fallback, but only by the same
   *  accidental-`NaN`-comparison quirk this guard exists to remove. */
  private get effectiveMaxRenderedEntries(): number {
    return finiteCount(this.maxRenderedEntries, 500);
  }

  private get normalizedEntries(): LyraTranscriptEntry[] {
    const seen = new Set<string>();
    return this.entries.filter((entry) => {
      if (entry === null || typeof entry !== 'object') return false;
      if (
        typeof entry.id !== 'string' ||
        entry.id.trim().length === 0 ||
        typeof entry.text !== 'string' ||
        seen.has(entry.id)
      ) return false;
      seen.add(entry.id);
      return true;
    });
  }

  private get renderedEntries(): LyraTranscriptEntry[] {
    const entries = this.normalizedEntries;
    const maxRenderedEntries = this.effectiveMaxRenderedEntries;
    if (maxRenderedEntries > 0 && entries.length > maxRenderedEntries) {
      return entries.slice(-maxRenderedEntries);
    }
    return entries;
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // The sink is per-document; an element moved into another document has to stop writing into
    // the region mounted in the one the user is no longer looking at.
    this.syncAnnouncementSink();
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  /** Mounts (or remounts) the shared region *ahead of* any text -- assistive tech has to have been
   *  observing a live region before content arrives, so acquiring it lazily at announce time is
   *  unreliable. Mirrors `<lr-chat-viewport>`'s identically-shaped helper. */
  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this._isFirstUpdate = !this.hasUpdated;
    this.sessionChanged = changed.has('sessionId') && this.hasUpdated;
    if (this.sessionChanged) {
      this.announcedFinalIds.clear();
      this.pendingSessionBaseline = true;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('entries')) {
      if (this.follow) this.scrollToBottom();
      this.announceFinalizedEntries();
    }
  }

  /** Speaks every entry that has become final since the previous update. The very first update
   *  only records what is already there: a feed mounted with existing transcript must not read
   *  the whole backlog aloud. `entries` is the full host-owned list (not `renderedEntries`), so a
   *  `max-rendered-entries` cap scrolling a row out of the DOM neither suppresses its
   *  announcement nor lets it be announced a second time on the way back in. */
  private announceFinalizedEntries(): void {
    const alreadyAnnounced = this.announcedFinalIds;
    const fresh: string[] = [];
    for (const entry of this.normalizedEntries) {
      if (entry.interim) continue;
      if (!alreadyAnnounced.has(entry.id)) {
        alreadyAnnounced.add(entry.id);
        fresh.push(entry.text);
      }
    }
    const establishesBaseline =
      this._isFirstUpdate || this.sessionChanged || this.pendingSessionBaseline;
    this.pendingSessionBaseline = false;
    if (establishesBaseline) return;
    const sink = this.announcementSink;
    if (!sink) return;
    for (const text of fresh) {
      const message = text.replace(/\s+/g, ' ').trim();
      if (message) sink.announce(message);
    }
  }

  /** Re-engages `follow` and scrolls the feed to its current bottom, instantly -- matching the
   *  shared stick-to-bottom contract. New entries can arrive in rapid succession while streaming;
   *  an animated scroll on every single one would fight itself rather than settle cleanly, so this
   *  is a plain jump rather than a CSS-smoothed transition. Imperative navigation, like a direct
   *  `follow` assignment: does not itself emit `lr-follow-change` (see `onJumpClick`, the
   *  user-driven wrapper that does, mirroring `lr-terminal`'s `scrollToBottom()`/`jumpToLatest()`
   *  split). */
  scrollToBottom(): void {
    this.follow = true;
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!base) return;
    base.scrollTop = base.scrollHeight;
  }

  /** The sole source of a user-driven `follow` transition from scrolling: this handler runs only
   *  in response to a real `scroll` event on `[part="base"]`, so setting `follow` here -- unlike a
   *  generic `updated()` diff of the property, which cannot tell a user scroll from a host
   *  assignment or this component's own `scrollToBottom()` -- is unambiguously the user's own
   *  action, and is the only path that emits `lr-follow-change`. */
  private onScroll = (e: Event): void => {
    const base = e.currentTarget as HTMLElement;
    const atBottom = base.scrollHeight - base.scrollTop - base.clientHeight <= NEAR_BOTTOM_PX;
    if (atBottom === this.follow) return;
    this.follow = atBottom;
    this.emit('lr-follow-change', { following: atBottom });
  };

  /** The jump-button's click handler: the other user-driven source of an `lr-follow-change`
   *  transition. Delegates the actual re-engage/scroll to `scrollToBottom()` (which does not
   *  itself emit) and emits only when clicking it actually changed `follow` -- identical shape to
   *  `lr-terminal`'s `jumpToLatest()`. */
  private onJumpClick = (): void => {
    const jump = this.renderRoot.querySelector<HTMLElement>('[part="jump-button"]');
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    const repair = jump ? captureComposedFocusRepair(jump, base) : null;
    const changed = !this.follow;
    this.scrollToBottom();
    if (changed) this.emit('lr-follow-change', { following: true });
    if (repair) void this.updateComplete.then(() => {
      if (this.isConnected && this.follow) applyComposedFocusRepair(repair);
    });
  };

  private showSpeakerFor(list: LyraTranscriptEntry[], index: number): boolean {
    const prev = list[index - 1];
    const current = list[index]!; // safe: called from list.map(), index is always in-bounds
    return !prev || prev.speaker !== current.speaker;
  }

  private formatTs(value: LyraTimestamp): string | null {
    const date = normalizeLyraTimestamp(value);
    if (!date) return null;
    if (this.formatTimestamp) return this.formatTimestamp(date);
    return getDateTimeFormat(this.effectiveLocale, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  private renderEntry(entry: LyraTranscriptEntry, showSpeaker: boolean, interim: boolean): TemplateResult {
    const parts = ['entry'];
    if (interim) parts.push('interim');
    const timestamp = entry.timestamp == null ? null : this.formatTs(entry.timestamp);
    return html`
      <div part=${parts.join(' ')} ?data-interim=${interim}>
        ${showSpeaker && entry.speaker ? html`<span part="speaker">${entry.speaker}</span>` : nothing}
        <span part="text" dir="auto">${entry.text}</span>
        ${interim ? html`<span class="sr-only">${this.localize('transcriptFeedInterim')}</span>` : nothing}
        ${this.showTimestamps && timestamp !== null
          ? html`<span part="timestamp">${timestamp}</span>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const entries = this.renderedEntries;
    const finals = entries.filter((entry) => !entry.interim);
    const interims = entries.filter((entry) => entry.interim);
    const empty = entries.length === 0;
    return html`
      <div
        part="base"
        role="region"
        tabindex="0"
        aria-label=${this.accessibleLabel ?? (this.label == null ? this.localize('transcriptFeedLabel') : this.label)}
        @scroll=${this.onScroll}
      >
        ${empty
          ? html`<div part="empty"><slot name="empty">${this.localize('transcriptFeedEmpty')}</slot></div>`
          : html`
              <div
                part="log"
                role="log"
                aria-live="off"
                aria-label=${this.accessibleLabel ?? (this.label == null ? this.localize('transcriptFeedLabel') : this.label)}
              >
                ${repeat(
                  finals,
                  (e) => e.id,
                  (entry, i) => this.renderEntry(entry, this.showSpeakerFor(finals, i), false),
                )}
              </div>
              ${interims.length
                ? html`
                    <div part="interim-area">
                      ${repeat(
                        interims,
                        (e) => e.id,
                        (entry, i) => this.renderEntry(entry, this.showSpeakerFor(interims, i), true),
                      )}
                    </div>
                  `
                : nothing}
            `}
      </div>
      ${!this.follow && !empty
        ? html`<button part="jump-button" type="button" @click=${this.onJumpClick}>
            ${this.localize('jumpToLatest')}
          </button>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-transcript-feed': LyraTranscriptFeed;
  }
}
