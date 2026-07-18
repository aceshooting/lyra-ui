import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { getDateTimeFormat } from '../../internal/intl-cache.js';
import { finiteCount } from '../../internal/numbers.js';
import { styles } from './transcript-feed.styles.js';

export interface LyraTranscriptEntry {
  id: string;
  speaker?: string;
  text: string;
  interim?: boolean;
  /** Epoch milliseconds. */
  timestamp?: number;
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
 * Rendering reconciles `entries` keyed by `id` via Lit's `repeat()`: a same-`id` entry with new
 * `text` replaces in place; a same-`id` entry whose `interim` flips from `true` to unset/`false`
 * moves from the interim area into the `role="log"` region and announces exactly once. Interim
 * entries render *after* the log container, visible but structurally outside it, so per-token
 * mutations are never spoken by assistive tech.
 *
 * Live captions only: recorded-media transcript sync — clickable cues, seek-on-select — is a
 * separate concern from this component.
 *
 * @customElement lr-transcript-feed
 * @slot empty - Custom empty state. Default: the localized "No transcript yet".
 * @event lr-follow-change - `detail: { following: boolean }` — fires on every `follow` transition,
 *   whether user-driven (scroll away/jump button) or a direct host assignment. Never fires for the
 *   value already in effect on the very first render.
 * @csspart base - The scroll container.
 * @csspart log - The `role="log"` region wrapping final entries only.
 * @csspart entry - One entry row (final or interim).
 * @csspart speaker - An entry's speaker label (omitted for a row that repeats the previous row's speaker).
 * @csspart text - An entry's text (`dir="auto"`, for mixed-language captions).
 * @csspart timestamp - An entry's timestamp, shown only when `show-timestamps` is set.
 * @csspart interim - Present (alongside `entry`) on an interim row.
 * @csspart jump-button - The "jump to latest" affordance, shown only while `follow` is `false`.
 * @csspart empty - The empty-state wrapper.
 */
export class LyraTranscriptFeed extends LyraElement<LyraTranscriptFeedEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) entries: LyraTranscriptEntry[] = [];
  @property({ type: Boolean, reflect: true }) follow = true;
  @property({ type: Boolean, attribute: 'show-timestamps' }) showTimestamps = false;
  /** Overrides the default `Intl.DateTimeFormat` short-time rendering. */
  @property({ attribute: false }) formatTimestamp?: (epochMs: number) => string;
  /** `> 0` renders only the newest N rows (host `entries` data is untouched); `0` renders all. */
  @property({ type: Number, attribute: 'max-rendered-entries' }) maxRenderedEntries = 0;
  /** Accessible name for the `role="log"` region. Defaults to the localized `transcriptFeedLabel`. */
  @property() label = '';
  /** Overrides the log region's computed accessible name. Wins over `label` and the localized
   *  default. Attribute-reflects from a host-level `aria-label` so a plain-markup consumer gets
   *  ARIA-name forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private _isFirstUpdate = true;

  /** `maxRenderedEntries`, normalized to a finite non-negative integer (falling back to the
   *  property's own default of `0`, meaning "render all") -- a raw `NaN` (e.g. an invalid
   *  `max-rendered-entries` attribute) would otherwise make `maxRenderedEntries > 0` always
   *  false, which happens to already match the "render all" fallback, but only by the same
   *  accidental-`NaN`-comparison quirk this guard exists to remove. */
  private get effectiveMaxRenderedEntries(): number {
    return finiteCount(this.maxRenderedEntries, 0);
  }

  private get renderedEntries(): LyraTranscriptEntry[] {
    const maxRenderedEntries = this.effectiveMaxRenderedEntries;
    if (maxRenderedEntries > 0 && this.entries.length > maxRenderedEntries) {
      return this.entries.slice(-maxRenderedEntries);
    }
    return this.entries;
  }
  private get finalEntries(): LyraTranscriptEntry[] {
    return this.renderedEntries.filter((e) => !e.interim);
  }
  private get interimEntries(): LyraTranscriptEntry[] {
    return this.renderedEntries.filter((e) => e.interim);
  }

  protected willUpdate(): void {
    this._isFirstUpdate = !this.hasUpdated;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('entries') && this.follow) this.scrollToBottom();
    if (changed.has('follow')) {
      if (this.follow) this.scrollToBottom();
      if (!this._isFirstUpdate) this.emit<{ following: boolean }>('lr-follow-change', { following: this.follow });
    }
  }

  /** Scrolls the feed to its current bottom, instantly -- matching `lr-thinking-panel`'s and
   *  `lr-virtual-list`'s own stick-to-bottom mechanics. New entries can arrive in rapid
   *  succession while streaming; an animated scroll on every single one would fight itself rather
   *  than settle cleanly, so this is a plain jump rather than a CSS-smoothed transition. */
  scrollToBottom(): void {
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!base) return;
    base.scrollTop = base.scrollHeight;
  }

  private onScroll = (e: Event): void => {
    const base = e.currentTarget as HTMLElement;
    const atBottom = base.scrollHeight - base.scrollTop - base.clientHeight <= NEAR_BOTTOM_PX;
    if (atBottom !== this.follow) this.follow = atBottom;
  };

  private onJumpClick = (): void => {
    this.follow = true;
  };

  private showSpeakerFor(list: LyraTranscriptEntry[], index: number): boolean {
    const prev = list[index - 1];
    return !prev || prev.speaker !== list[index].speaker;
  }

  private formatTs(epochMs: number): string {
    if (this.formatTimestamp) return this.formatTimestamp(epochMs);
    return getDateTimeFormat(this.effectiveLocale || 'en', { hour: 'numeric', minute: '2-digit' }).format(
      new Date(epochMs),
    );
  }

  private renderEntry(entry: LyraTranscriptEntry, showSpeaker: boolean, interim: boolean): TemplateResult {
    const parts = ['entry'];
    if (interim) parts.push('interim');
    return html`
      <div part=${parts.join(' ')} ?data-interim=${interim}>
        ${showSpeaker && entry.speaker ? html`<span part="speaker">${entry.speaker}</span>` : nothing}
        <span part="text" dir="auto">${entry.text}</span>
        ${interim ? html`<span class="sr-only">${this.localize('transcriptFeedInterim')}</span>` : nothing}
        ${this.showTimestamps && entry.timestamp != null
          ? html`<span part="timestamp">${this.formatTs(entry.timestamp)}</span>`
          : nothing}
      </div>
    `;
  }

  render(): TemplateResult {
    const finals = this.finalEntries;
    const interims = this.interimEntries;
    const empty = this.entries.length === 0;
    return html`
      <div part="base" @scroll=${this.onScroll}>
        ${empty
          ? html`<div part="empty"><slot name="empty">${this.localize('transcriptFeedEmpty')}</slot></div>`
          : html`
              <div part="log" role="log" aria-label=${this.accessibleLabel || this.label || this.localize('transcriptFeedLabel')}>
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
