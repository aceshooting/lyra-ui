import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { DocumentAnchorTarget } from '../../internal/anchor-target.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  HighlightActivateDetail,
  AnchorResultDetail,
} from '../document-viewer/anchors.js';
import { safeMediaSrc } from '../../internal/safe-url.js';
import { srOnly } from '../../internal/a11y.js';
import { finiteRange } from '../../internal/numbers.js';
import '../virtual-list/virtual-list.js';
import { styles } from './av-player.styles.js';

export type AvKind = 'audio' | 'video';

/** One synced transcript entry. `end` is exclusive; an omitted `end` extends to the next cue (or
 *  forever, for the last one). */
export interface LyraAvCue {
  id: string;
  start: number;
  end?: number;
  text: string;
  speaker?: string;
}

/** A native `<track>` source (subtitles/captions/descriptions), wired straight through to the
 *  underlying media element. */
export interface LyraAvTrack {
  src: string;
  kind: 'subtitles' | 'captions' | 'descriptions';
  srclang: string;
  label: string;
  default?: boolean;
}

/** Throttle window for `lyra-time-change` while playing -- at most 4/s, plus one extra emission per
 *  discrete `seek()` regardless of the window. */
const TIME_CHANGE_THROTTLE_MS = 250;

/** `HTMLMediaElement.playbackRate`'s reliably-supported range across browsers (values outside this
 *  commonly clamp silently or throw natively) -- kept explicit here so an out-of-range/non-finite
 *  assignment self-heals through `finiteRange` before it ever reaches the native element, instead of
 *  reaching it unsanitized. */
const MIN_PLAYBACK_RATE = 0.0625;
const MAX_PLAYBACK_RATE = 16;

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

export interface LyraAvPlayerEventMap {
  'lyra-play': CustomEvent<undefined>;
  'lyra-pause': CustomEvent<undefined>;
  'lyra-load': CustomEvent<{ duration: number; kind: AvKind }>;
  'lyra-time-change': CustomEvent<{ currentTime: number }>;
  'lyra-rate-change': CustomEvent<{ rate: number }>;
  'lyra-cue-change': CustomEvent<{ id: string | null }>;
  'lyra-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lyra-anchor-result': CustomEvent<AnchorResultDetail>;
  'lyra-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

class LyraAvPlayerBase extends LyraElement<LyraAvPlayerEventMap> {}

/**
 * `<lyra-av-player>` — audio/video player built on a native `<audio>`/`<video>` element, plus a cue
 * transcript synced to `currentTime`, `time-range` anchor/highlight support, an optional
 * dependency-free waveform (peaks in, no in-component decoding), and playback-rate control. Owns
 * recorded-media transcript sync; distinct from `<lyra-transcript-feed>` (live captions for an
 * in-progress voice session) and `<lyra-playback>` (an index stepper over `[0, length)` for
 * time-series dashboards — no media involved in either).
 *
 * Adopts `DocumentAnchorTarget` with `anchorKinds: ['time-range']` only. No text selection is bound:
 * transcript rows render inside `<lyra-virtual-list>`'s own nested shadow root, one boundary deeper
 * than the mixin's default selection lookup resolves.
 *
 * The transcript virtualizes through `<lyra-virtual-list>` the same way `pdf-viewer.class.ts`
 * virtualizes pages: `items`/`renderItem`/`keyFunction`/`activeId` props, and the active cue's
 * scroll-into-view comes for free from `activeId` rather than any custom follow logic.
 *
 * @customElement lyra-av-player
 * @event lyra-play - Playback started.
 * @event lyra-pause - Playback paused.
 * @event lyra-load - Media metadata finished loading. `detail: { duration, kind }`.
 * @event lyra-time-change - `detail: { currentTime }`, throttled to at most 4/s while playing, plus
 *   one extra emission per `seek()` regardless of the throttle window.
 * @event lyra-rate-change - `detail: { rate }`.
 * @event lyra-cue-change - The active transcript cue changed. `detail: { id }` (`null` when none is
 *   active).
 * @event lyra-highlight-activate - A `time-range` highlight marker was activated. `detail: { id }`.
 * @event lyra-anchor-result - Fired after `anchor` (or a `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @event lyra-search-change - Fired from `search()`/`searchNext()`/`searchPrevious()`/
 *   `clearSearch()`. `detail: { query, matchCount, activeIndex }`.
 * @event lyra-render-error - The native media element reported an `error` event. `detail: { error }`.
 * @csspart base - The root wrapper.
 * @csspart media - The native `<audio>`/`<video>` element.
 * @csspart toolbar - The playback-rate control row.
 * @csspart rate-select - The playback-rate `<select>`.
 * @csspart timeline - The waveform canvas or plain seek rail; click-to-seek and arrow-key seeking.
 * @csspart timeline-marker - One clickable marker per `time-range` highlight (`data-tone`,
 *   `data-active`).
 * @csspart transcript - The virtualized cue list (`<lyra-virtual-list>` itself).
 * @csspart cue - One transcript row (`aria-current`, `data-match`, `data-active-match`).
 * @csspart cue-time - A cue's timestamp label.
 * @csspart cue-speaker - A cue's speaker label.
 * @csspart cue-text - A cue's text.
 * @csspart error - The error region.
 * @cssprop [--lyra-av-player-transcript-height=var(--lyra-size-16rem)] - Block size of the
 *   virtualized transcript list.
 */
export class LyraAvPlayer extends DocumentAnchorTarget(LyraAvPlayerBase) {
  static styles = [LyraElement.styles, styles, srOnly];

  // `playbackRate` is declared here (rather than via a plain `@property()` decorator, like the rest
  // of this class) with a hand-written accessor below -- mirrors lyra-slider's identical
  // min/max/step pattern -- so an out-of-range/non-finite assignment self-heals synchronously
  // through `finiteRange` instead of leaving the native media element unsanitized until the next
  // `updated()` flush.
  static properties = {
    playbackRate: { type: Number, attribute: 'playback-rate', reflect: true, noAccessor: true },
  };

  /** Media URL; validated with `safeMediaSrc` before it ever reaches the `<audio>`/`<video>` `src`. */
  @property() src = '';
  /** Accessible name of `[part="base"]` and of the native `[part="media"]` element (the actual
   *  keyboard tab stop, which would otherwise be nameless); a host `aria-label` wins, then the
   *  localized `avPlayerLabel` fallback. */
  @property() name = '';
  /** Forces `audio`/`video` rendering, overriding the `mime-type`-based auto-detection. */
  @property() kind?: AvKind;
  /** Drives auto-detection: an `audio/*` mime type renders `<audio>`; anything else renders
   *  `<video>`. Ignored once `kind` is set explicitly. */
  @property({ attribute: 'mime-type' }) mimeType = '';
  /** Poster image for `<video>`; ignored for `<audio>`. */
  @property() poster = '';
  @property({ type: Boolean }) loop = false;
  @property({ type: Boolean }) muted = false;
  @property() preload: 'none' | 'metadata' | 'auto' = 'metadata';
  private _playbackRate = 1;
  /** Playback-rate multiplier, reflected to the native media element. Clamped to
   *  `[MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE]` -- a non-finite or wildly out-of-range assignment
   *  (e.g. a bad computed value) self-heals rather than reaching `HTMLMediaElement.playbackRate`
   *  unsanitized. */
  get playbackRate(): number {
    return this._playbackRate;
  }
  set playbackRate(next: number) {
    const old = this._playbackRate;
    this._playbackRate = finiteRange(next, 1, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE);
    this.requestUpdate('playbackRate', old);
  }
  /** Selectable rates offered by `[part="rate-select"]`. */
  @property({ attribute: false }) rates: number[] = [0.75, 1, 1.25, 1.5, 2];
  /** Transcript entries, rendered as a virtualized, `currentTime`-synced list. */
  @property({ attribute: false }) cues: LyraAvCue[] = [];
  /** Normalized `0..1` waveform amplitude samples. Empty renders a plain seek rail instead of a
   *  canvas -- this component never decodes audio itself. */
  @property({ attribute: false }) peaks: number[] = [];
  /** Native `<track>` sources (subtitles/captions/descriptions). */
  @property({ attribute: false }) tracks: LyraAvTrack[] = [];

  /** From `DocumentAnchorTarget` — only `time-range` anchors resolve here. */
  readonly anchorKinds: readonly LyraAnchorKind[] = ['time-range'];

  @state() private duration = 0;
  @state() private currentTimeState = 0;
  @state() private activeCueId: string | null = null;
  @state() private searchQuery = '';
  @state() private searchMatches: number[] = [];
  @state() private activeSearchIndex = -1;
  @state() private metadataLoaded = false;
  @state() private renderError = false;

  @query('audio, video') private mediaEl?: HTMLMediaElement;
  @query('[part="timeline"] canvas') private canvasEl?: HTMLCanvasElement;

  private lastTimeChangeAt = 0;
  private pendingSeek: number | null = null;

  /** Live playback position: the media element's own `currentTime` once mounted, else the last
   *  locally-tracked value (e.g. a `seek()` issued before metadata loaded). */
  get currentTime(): number {
    return this.mediaEl ? this.mediaEl.currentTime : this.currentTimeState;
  }
  set currentTime(value: number) {
    // `this.duration` stays 0 until real metadata loads (see onLoadedMetadata()), so clamping the
    // upper bound to it unconditionally would wrongly zero out a pending seek issued before that --
    // only a real, positive, finite duration narrows the range; otherwise a non-negative value of
    // any size is accepted verbatim, same as this.duration being genuinely unknown.
    const max = this.duration > 0 ? this.duration : Infinity;
    const clamped = finiteRange(value, 0, 0, max);
    if (this.mediaEl) this.mediaEl.currentTime = clamped;
    else this.pendingSeek = clamped;
    this.currentTimeState = clamped;
  }

  private detectedKind(): AvKind {
    if (this.kind) return this.kind;
    return this.mimeType.startsWith('audio/') ? 'audio' : 'video';
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('playbackRate')) {
      if (this.mediaEl) this.mediaEl.playbackRate = this.playbackRate;
      if (changed.get('playbackRate') !== undefined) this.emit('lyra-rate-change', { rate: this.playbackRate });
    }
    if (changed.has('peaks')) this.drawWaveform();
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Added here (not in firstUpdated) so it pairs symmetrically with disconnectedCallback's
    // removeEventListener: firstUpdated runs only once per element lifetime while
    // disconnectedCallback runs on every disconnect, so a disconnect/reconnect cycle (e.g. a
    // reparent) would otherwise leave the waveform permanently deaf to window resizes. Re-adding
    // the same listener reference on the initial connect is a native no-op, so no guard is needed.
    window.addEventListener('resize', this.onWindowResize);
  }

  firstUpdated(): void {
    this.drawWaveform();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = (): void => this.drawWaveform();

  /** Proxies the native media element's `play()`. A no-op before the element mounts. */
  play(): void {
    void this.mediaEl?.play();
  }
  /** Proxies the native media element's `pause()`. A no-op before the element mounts. */
  pause(): void {
    this.mediaEl?.pause();
  }
  /** Plays if paused, pauses if playing. A no-op before the element mounts. */
  toggle(): void {
    if (this.mediaEl?.paused) this.play();
    else this.pause();
  }
  /** Sets `currentTime` and forces an immediate `lyra-time-change`, bypassing the playing-time throttle. */
  seek(seconds: number): void {
    this.currentTime = seconds;
    this.emitTimeChange(true);
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'time-range' || !this.metadataLoaded) return false;
    this.seek(anchor.start);
    return true;
  }

  private onLoadedMetadata = (): void => {
    this.metadataLoaded = true;
    this.duration = this.mediaEl?.duration || 0;
    if (this.pendingSeek !== null && this.mediaEl) {
      this.mediaEl.currentTime = this.pendingSeek;
      this.pendingSeek = null;
    }
    this.emit('lyra-load', { duration: this.duration, kind: this.detectedKind() });
  };

  private onPlay = (): void => {
    this.emit('lyra-play');
  };
  private onPause = (): void => {
    this.emit('lyra-pause');
  };
  private onMediaError = (error: unknown): void => {
    this.renderError = true;
    this.emit('lyra-render-error', { error });
  };

  private emitTimeChange(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastTimeChangeAt < TIME_CHANGE_THROTTLE_MS) return;
    this.lastTimeChangeAt = now;
    this.currentTimeState = this.currentTime;
    this.emit('lyra-time-change', { currentTime: this.currentTimeState });
  }

  private onTimeUpdate = (): void => {
    this.emitTimeChange(false);
    const time = this.currentTime;
    let active: LyraAvCue | undefined;
    for (const cue of this.cues) {
      if (time >= cue.start && time < (cue.end ?? Infinity)) {
        if (!active || cue.start >= active.start) active = cue;
      }
    }
    const nextId = active?.id ?? null;
    if (nextId !== this.activeCueId) {
      this.activeCueId = nextId;
      this.emit('lyra-cue-change', { id: nextId });
    }
  };

  private onSeeked = (): void => this.emitTimeChange(true);

  /** Case-insensitive substring match over cue text and speaker. Resolves the match count. */
  async search(query: string): Promise<number> {
    const q = query.trim().toLowerCase();
    this.searchQuery = query;
    this.searchMatches = q
      ? this.cues.reduce<number[]>((acc, cue, i) => {
          if (cue.text.toLowerCase().includes(q) || (cue.speaker ?? '').toLowerCase().includes(q)) acc.push(i);
          return acc;
        }, [])
      : [];
    this.activeSearchIndex = this.searchMatches.length ? 0 : -1;
    this.emitSearchChange();
    return this.searchMatches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. No-op with no matches. */
  searchNext(): void {
    if (!this.searchMatches.length) return;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
  }

  /** Moves to the previous match, wrapping to the last before the first. No-op with no matches. */
  searchPrevious(): void {
    if (!this.searchMatches.length) return;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
  }

  /** Clears the query, matches, and active index, and emits a zero-match `lyra-search-change`. */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.activeSearchIndex = -1;
    this.emitSearchChange();
  }

  private emitSearchChange(): void {
    this.emit('lyra-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      activeIndex: this.activeSearchIndex,
    });
  }

  private drawWaveform(): void {
    const canvas = this.canvasEl;
    if (!canvas || !this.peaks.length) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const color = getComputedStyle(this).getPropertyValue('--lyra-color-brand').trim() || '#0969da';
    ctx.fillStyle = color;
    const barWidth = width / this.peaks.length;
    this.peaks.forEach((peak, i) => {
      const barHeight = Math.max(1, peak * height);
      ctx.fillRect(i * barWidth, (height - barHeight) / 2, Math.max(1, barWidth - 1), barHeight);
    });
  }

  private onHighlightActivate = (id: string, start: number): void => {
    this.activeHighlightId = id;
    this.seek(start);
    this.emit<HighlightActivateDetail>('lyra-highlight-activate', { id });
  };

  private renderMarkers(): TemplateResult | typeof nothing {
    if (!this.duration) return nothing;
    const ranged = this.highlights.filter(
      (h): h is LyraHighlight & { anchor: { kind: 'time-range'; start: number; end?: number } } => h.anchor.kind === 'time-range',
    );
    if (!ranged.length) return nothing;
    return html`${ranged.map((h) => {
      const start = (h.anchor.start / this.duration) * 100;
      const end = ((h.anchor.end ?? h.anchor.start) / this.duration) * 100;
      return html`<button
        part="timeline-marker"
        type="button"
        data-tone=${h.tone ?? 'accent'}
        ?data-active=${this.activeHighlightId === h.id}
        style="inset-inline-start:${start}%;inline-size:${Math.max(0.5, end - start)}%"
        aria-label=${h.label || this.localize('viewerHighlightLabel')}
        @click=${(event: MouseEvent) => {
          event.stopPropagation();
          this.onHighlightActivate(h.id, h.anchor.start);
        }}
      ></button>`;
    })}`;
  }

  private onTimelineClick = (event: MouseEvent): void => {
    if (!this.duration) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.seek(ratio * this.duration);
  };

  private onTimelineKeyDown = (event: KeyboardEvent): void => {
    const delta = event.shiftKey ? 15 : 5;
    switch (event.key) {
      // policy-allow(rtl-arrow-keys): the time axis never mirrors -- [part='timeline'] is pinned
      // `direction: ltr` in av-player.styles.ts, matching native media controls -- so seek arrows
      // track the physical strip (left rewinds, right advances) in any text direction.
      case 'ArrowLeft':
        event.preventDefault();
        this.seek(Math.max(0, this.currentTime - delta));
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.seek(Math.min(this.duration, this.currentTime + delta));
        break;
      case 'Home':
        event.preventDefault();
        this.seek(0);
        break;
      case 'End':
        event.preventDefault();
        this.seek(this.duration);
        break;
      case ' ':
        event.preventDefault();
        this.toggle();
        break;
      default:
        return;
    }
  };

  /** `[part="rate-select"]`'s `<option>` values -- `rates`, plus the current `playbackRate` spliced
   *  in (numerically sorted) when it isn't already one of them. A native `<select>` shows its first
   *  option whenever no `<option>` carries `selected` at all, so a `playbackRate` set outside the
   *  offered `rates` list (a caller-driven value, or a rate offered by an earlier `rates` array that
   *  has since been narrowed) would otherwise display a rate that doesn't match `playbackRate`. */
  private rateOptions(): number[] {
    if (this.rates.includes(this.playbackRate)) return this.rates;
    return [...this.rates, this.playbackRate].sort((a, b) => a - b);
  }

  private renderCue = (cue: unknown, index: number): TemplateResult => {
    const c = cue as LyraAvCue;
    const isActive = this.activeCueId === c.id;
    const matchPosition = this.searchMatches.indexOf(index);
    return html`<button
      part="cue"
      type="button"
      aria-current=${isActive ? 'true' : 'false'}
      ?data-match=${matchPosition !== -1}
      ?data-active-match=${matchPosition !== -1 && matchPosition === this.activeSearchIndex}
      @click=${() => this.seek(c.start)}
    >
      <span part="cue-time">${formatTime(c.start)}</span>
      ${c.speaker ? html`<span part="cue-speaker">${c.speaker}</span>` : nothing}
      <span part="cue-text">${c.text}</span>
    </button>`;
  };

  private renderTracks(): unknown {
    return this.tracks.map((t) => {
      const trackSrc = safeMediaSrc(t.src);
      return trackSrc
        ? html`<track src=${trackSrc} kind=${t.kind} srclang=${t.srclang} label=${t.label} ?default=${t.default} />`
        : nothing;
    });
  }

  render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.name || this.localize('avPlayerLabel');
    const safeSrc = this.src ? safeMediaSrc(this.src) : null;
    const kind = this.detectedKind();
    if (!safeSrc && this.src) {
      return html`<div part="base" aria-label=${label}>
        <div part="error" role="alert">${this.localize('avPlayerFailedToLoad')}</div>
        ${this.renderAnchorLiveRegion()}
      </div>`;
    }
    return html`<div part="base" aria-label=${label}>
      ${kind === 'audio'
        ? html`<audio
            part="media"
            controls
            aria-label=${label}
            src=${safeSrc ?? ''}
            ?loop=${this.loop}
            ?muted=${this.muted}
            preload=${this.preload}
            @loadedmetadata=${this.onLoadedMetadata}
            @play=${this.onPlay}
            @pause=${this.onPause}
            @timeupdate=${this.onTimeUpdate}
            @seeked=${this.onSeeked}
            @error=${() => this.onMediaError(new Error('The media failed to load.'))}
            >${this.renderTracks()}</audio
          >`
        : html`<video
            part="media"
            controls
            aria-label=${label}
            src=${safeSrc ?? ''}
            poster=${this.poster || nothing}
            ?loop=${this.loop}
            ?muted=${this.muted}
            preload=${this.preload}
            @loadedmetadata=${this.onLoadedMetadata}
            @play=${this.onPlay}
            @pause=${this.onPause}
            @timeupdate=${this.onTimeUpdate}
            @seeked=${this.onSeeked}
            @error=${() => this.onMediaError(new Error('The media failed to load.'))}
            >${this.renderTracks()}</video
          >`}
      ${this.renderError ? html`<div part="error" role="alert">${this.localize('avPlayerFailedToLoad')}</div>` : nothing}
      <div part="toolbar">
        <select
          part="rate-select"
          aria-label=${this.localize('avPlayerPlaybackRate')}
          @change=${(e: Event) => (this.playbackRate = Number((e.target as HTMLSelectElement).value))}
        >
          ${this.rateOptions().map((rate) => html`<option value=${String(rate)} ?selected=${rate === this.playbackRate}>${rate}x</option>`)}
        </select>
      </div>
      <div
        part="timeline"
        role="slider"
        tabindex="0"
        aria-valuemin="0"
        aria-valuemax=${String(this.duration)}
        aria-valuenow=${String(this.currentTime)}
        aria-valuetext=${this.localize('avPlayerPosition', undefined, { current: formatTime(this.currentTime), duration: formatTime(this.duration) })}
        aria-label=${this.localize('avPlayerTimeline')}
        @click=${this.onTimelineClick}
        @keydown=${this.onTimelineKeyDown}
      >
        ${this.peaks.length
          ? html`<canvas
              ${ref((el) => {
                if (el) this.drawWaveform();
              })}
            ></canvas>`
          : nothing}
        ${this.renderMarkers()}
      </div>
      ${this.cues.length
        ? html`<lyra-virtual-list
            part="transcript"
            aria-label=${this.localize('avPlayerTranscript')}
            .items=${this.cues}
            .renderItem=${this.renderCue}
            .keyFunction=${(item: unknown) => (item as LyraAvCue).id}
            .activeId=${this.activeCueId ?? ''}
          ></lyra-virtual-list>`
        : nothing}
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-av-player': LyraAvPlayer;
  }
}
