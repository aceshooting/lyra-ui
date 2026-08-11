import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { DocumentAnchorTarget } from '../../../internal/anchor-target.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  HighlightActivateDetail,
  AnchorResultDetail,
} from '../../viewers/document-viewer/anchors.js';
import {
  MAX_NATIVE_PLAYBACK_RATE as MAX_PLAYBACK_RATE,
  MIN_NATIVE_PLAYBACK_RATE as MIN_PLAYBACK_RATE,
  NativeMediaController,
  safeNativeMediaSource as safeMediaSrc,
} from '../../../internal/media-controller.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { styles } from './av-player.styles.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_avPlayerFailedToLoad, LYRA_DEFAULT_avPlayerLabel, LYRA_DEFAULT_avPlayerPlaybackRate, LYRA_DEFAULT_avPlayerPosition, LYRA_DEFAULT_avPlayerRateOption, LYRA_DEFAULT_avPlayerTimeline, LYRA_DEFAULT_avPlayerTranscript, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open, LYRA_DEFAULT_pause, LYRA_DEFAULT_play, LYRA_DEFAULT_viewerHighlightLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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

/** Throttle window for `lr-time-change` while playing -- at most 4/s, plus one extra emission per
 *  discrete `seek()` regardless of the window. */
const TIME_CHANGE_THROTTLE_MS = 250;

function positiveFinite(value: number): number {
  const finite = finiteNumber(value, 1);
  return finite > 0 ? finite : 1;
}

/** Builds only the bars a canvas can physically display without changing the public source array.
 *  Each pre-endpoint bucket keeps its maximum so a narrow spike remains visible; the endpoint gets
 *  its own final column so it remains an exact sample rather than an accidental bucket maximum. */
function waveformPaintPeaks(peaks: readonly number[], maxBars: number): readonly number[] {
  const barCount = Math.max(1, Math.floor(finiteNumber(maxBars, 1)));
  if (peaks.length <= barCount) return peaks;

  const finalIndex = peaks.length - 1;
  if (barCount === 1) return [finiteRange(peaks[finalIndex]!, 0, 0, 1)];

  const result = new Array<number>(barCount);
  const preEndpointBars = barCount - 1;
  for (let barIndex = 0; barIndex < preEndpointBars; barIndex += 1) {
    const start = Math.floor((barIndex * finalIndex) / preEndpointBars);
    const end = Math.floor(((barIndex + 1) * finalIndex) / preEndpointBars);
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, finiteRange(peaks[sampleIndex]!, 0, 0, 1));
    }
    result[barIndex] = peak;
  }
  result[preEndpointBars] = finiteRange(peaks[finalIndex]!, 0, 0, 1);
  return result;
}

function formatTime(seconds: number, locale: string): string {
  const total = Math.round(finiteRange(seconds, 0, 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const regular = getNumberFormat(locale, { maximumFractionDigits: 0, useGrouping: false });
  const padded = getNumberFormat(locale, {
    maximumFractionDigits: 0,
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const mm = (h > 0 ? padded : regular).format(m);
  const ss = padded.format(s);
  return h > 0 ? `${regular.format(h)}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface LyraAvPlayerEventMap {
  ended: Event;
  error: Event;
  loadedmetadata: Event;
  pause: Event;
  play: Event;
  timeupdate: Event;
  volumechange: Event;
  'lr-play': CustomEvent<undefined>;
  'lr-pause': CustomEvent<undefined>;
  'lr-load': CustomEvent<{ duration: number; kind: AvKind }>;
  'lr-time-change': CustomEvent<{ currentTime: number }>;
  'lr-rate-change': CustomEvent<{ rate: number }>;
  'lr-cue-change': CustomEvent<{ id: string | null }>;
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

class LyraAvPlayerBase extends LyraElement<LyraAvPlayerEventMap> {}

/**
 * `<lr-av-player>` — audio/video player built on a native `<audio>`/`<video>` element, plus a cue
 * transcript synced to `currentTime`, `time-range` anchor/highlight support, an optional
 * dependency-free waveform (peaks in, no in-component decoding), and playback-rate control. Owns
 * recorded-media transcript sync; distinct from `<lr-transcript-feed>` (live captions for an
 * in-progress voice session) and `<lr-playback>` (an index stepper over `[0, length)` for
 * time-series dashboards — no media involved in either).
 *
 * Adopts `DocumentAnchorTarget` with `anchorKinds: ['time-range']` only. No text selection is bound:
 * transcript rows render inside `<lr-virtual-list>`'s own nested shadow root, one boundary deeper
 * than the mixin's default selection lookup resolves.
 *
 * The transcript virtualizes through `<lr-virtual-list>` the same way `pdf-viewer.class.ts`
 * virtualizes pages: `items`/`renderItem`/`keyFunction`/`activeId` props. Playback follows its
 * active cue through `activeId`; search navigation reveals its active match through the list's
 * `scrollToIndex()` API without seeking the media.
 * `[part="base"]` remains a named `role="region"` in every render branch, including an unsafe
 * initial source and a later transition into the visible error state.
 *
 * @customElement lr-av-player
 * @event ended - Relayed native media event; non-bubbling and non-composed.
 * @event error - Relayed native media event; non-bubbling and non-composed. The localized
 *   `lr-render-error` notification additionally carries the underlying failure detail.
 * @event loadedmetadata - Relayed native media event; non-bubbling and non-composed.
 * @event pause - Relayed native media event; non-bubbling and non-composed.
 * @event play - Relayed native media event; non-bubbling and non-composed.
 * @event timeupdate - Relayed native media event; non-bubbling and non-composed.
 * @event volumechange - Relayed native media event; non-bubbling and non-composed.
 * @event lr-play - Playback started.
 * @event lr-pause - Playback paused.
 * @event lr-load - Media metadata finished loading. `detail: { duration, kind }`.
 * @event lr-time-change - `detail: { currentTime }`, throttled to at most 4/s while playing, plus
 *   one extra emission per `seek()` regardless of the throttle window.
 * @event lr-rate-change - `detail: { rate }`.
 * @event lr-cue-change - The active transcript cue changed. `detail: { id }` (`null` when none is
 *   active).
 * @event lr-highlight-activate - A `time-range` highlight marker was activated. `detail: { id }`.
 * @event lr-anchor-result - Fired after `anchor` (or a `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @event lr-search-change - Fired from `search()`/`searchNext()`/`searchPrevious()`/
 *   `clearSearch()`. `detail: { query, matchCount, activeIndex }`.
 * @event lr-render-error - The native media element reported an `error` event. `detail: { error }`.
 * @csspart base - The root wrapper.
 * @csspart media - The native `<audio>`/`<video>` element.
 * @csspart toolbar - The playback-rate control row.
 * @csspart rate-select - The playback-rate `<select>`.
 * @csspart timeline - The waveform canvas or plain seek rail; click-to-seek and arrow-key seeking.
 * @csspart timeline-marker - One clickable marker per `time-range` highlight (`data-tone`,
 *   `data-active`).
 * @csspart transcript - The virtualized cue list (`<lr-virtual-list>` itself).
 * @csspart cue - One transcript row (`aria-current`, `data-match`, `data-active-match`).
 * @csspart cue-current - Added alongside `cue` on the row the playhead is inside. A second part
 *   name rather than an attribute selector, because Shadow Parts forbids an attribute selector
 *   after `::part()`.
 * @csspart cue-match - Added alongside `cue` on every row matching the current search query.
 * @csspart cue-active-match - Added alongside `cue`/`cue-match` on the row holding the current
 *   search match.
 * @csspart cue-time - A cue's timestamp label.
 * @csspart cue-speaker - A cue's speaker label.
 * @csspart cue-text - A cue's text.
 * @csspart error - Ordinary visible failure text. Fresh post-mount media/source failures append
 *   the localized message to the shared light-DOM assertive announcement sink; an already-unsafe
 *   initial `src` renders visibly without interrupting on mount.
 * @cssprop [--lr-av-player-transcript-height=var(--lr-size-16rem)] - Block size of the
 *   virtualized transcript list.
 * @cssprop [--lr-av-player-marker-active-color=var(--lr-color-brand)] - Outline color of the
 *   `[part="timeline-marker"]` matching `activeHighlightId`.
 * @cssprop [--lr-av-player-marker-bg=color-mix(in srgb, var(--lr-color-brand) 35%, transparent)] -
 *   Background of a `[part="timeline-marker"]` with no (or an unrecognized) `data-tone`.
 * @cssprop [--lr-av-player-marker-success-bg=color-mix(in srgb, var(--lr-color-success) 35%, transparent)] -
 *   Background of a `[part="timeline-marker"][data-tone="success"]`.
 * @cssprop [--lr-av-player-marker-warning-bg=color-mix(in srgb, var(--lr-color-warning) 35%, transparent)] -
 *   Background of a `[part="timeline-marker"][data-tone="warning"]`.
 * @cssprop [--lr-av-player-marker-danger-bg=color-mix(in srgb, var(--lr-color-danger) 35%, transparent)] -
 *   Background of a `[part="timeline-marker"][data-tone="danger"]`.
 * @cssprop [--lr-av-player-marker-neutral-bg=color-mix(in srgb, var(--lr-color-text) 25%, transparent)] -
 *   Background of a `[part="timeline-marker"][data-tone="neutral"]`.
 * @cssprop --lr-av-player-marker-fill - The resting fill a `[part="timeline-marker"]` actually
 *   renders, resolved per tone from the `--lr-av-player-marker-*-bg` knobs above. Its hover and
 *   pressed states are colour mixes taken from this value, so setting it directly retints all
 *   three at once for one marker; retint a whole tone through the `-bg` knob instead.
 * @cssprop [--lr-av-player-cue-current-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `[part="cue"]` the playhead is currently inside.
 * @cssprop [--lr-av-player-cue-active-match-color=var(--lr-color-warning)] - Outline color of the
 *   `[part="cue"]` holding the current search match, leaving the other matches' dashed outline on
 *   the shared warning token.
 * @status stable
 * @since 4.0.0
 */
export class LyraAvPlayer extends DocumentAnchorTarget(LyraAvPlayerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    avPlayerFailedToLoad: LYRA_DEFAULT_avPlayerFailedToLoad,
    avPlayerLabel: LYRA_DEFAULT_avPlayerLabel,
    avPlayerPlaybackRate: LYRA_DEFAULT_avPlayerPlaybackRate,
    avPlayerPosition: LYRA_DEFAULT_avPlayerPosition,
    avPlayerRateOption: LYRA_DEFAULT_avPlayerRateOption,
    avPlayerTimeline: LYRA_DEFAULT_avPlayerTimeline,
    avPlayerTranscript: LYRA_DEFAULT_avPlayerTranscript,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
    pause: LYRA_DEFAULT_pause,
    play: LYRA_DEFAULT_play,
    viewerHighlightLabel: LYRA_DEFAULT_viewerHighlightLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  // `playbackRate` is declared here (rather than via a plain `@property()` decorator, like the rest
  // of this class) with a hand-written accessor below -- mirrors lr-slider's identical
  // min/max/step pattern -- so an out-of-range/non-finite assignment self-heals synchronously
  // through `finiteRange` instead of leaving the native media element unsanitized until the next
  // `updated()` flush.
  static override properties = {
    playbackRate: { type: Number, attribute: 'playback-rate', reflect: true, noAccessor: true },
  };

  /** Media URL; validated with `safeMediaSrc` before it ever reaches the `<audio>`/`<video>` `src`. */
  @property() src = '';
  /** Accessible name of the stable `[part="base"]` region and of the native `[part="media"]`
   *  element (the actual keyboard tab stop, which would otherwise be nameless); a host
   *  `aria-label` wins, then the localized `avPlayerLabel` fallback. */
  @property() name = '';
  /** Forces exact `audio`/`video` rendering, overriding the `mime-type`-based auto-detection.
   *  Unrecognized runtime or attribute values continue MIME auto-detection. */
  @property() kind?: AvKind;
  /** Drives auto-detection: an `audio/*` mime type renders `<audio>`; anything else renders
   *  `<video>`. Ignored once `kind` is set explicitly. */
  @property({ attribute: 'mime-type' }) mimeType = '';
  /** Poster image for `<video>`; validated with `safeMediaSrc` and omitted when unsafe. Ignored for
   *  `<audio>`. */
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
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['time-range'];

  @state() private duration = 0;
  @state() private currentTimeState = 0;
  @state() private activeCueId: string | null = null;
  @state() private activeCueIndex = -1;
  @state() private searchQuery = '';
  @state() private searchMatches: number[] = [];
  @state() private activeSearchIndex = -1;
  @state() private metadataLoaded = false;
  @state() private renderError = false;

  @query('[part="timeline"] canvas') private canvasEl?: HTMLCanvasElement;

  private readonly mediaController = new NativeMediaController(this, {
    onEvent: (event) => this.onNativeMediaEvent(event),
  });
  private lastTimeChangeAt = 0;
  private searchLocale = '';
  private transcriptLocale = '';
  private searchMatchIndices = new Set<number>();
  private cueKeys: string[] = [];
  private readonly cueTokens = new WeakMap<LyraAvCue, number>();
  private nextCueToken = 0;
  private errorAnnouncementSink?: AnnouncementSink;
  private resizeWindow?: Window;

  constructor() {
    super();
    new ThemeWatcher(this, () => {
      if (this.peaks.length > 0) this.drawWaveform();
    });
  }

  private get mediaEl(): HTMLMediaElement | undefined {
    return this.mediaController.element;
  }

  /** Live playback position: the media element's own `currentTime` once mounted, else the last
   *  locally-tracked value (e.g. a `seek()` issued before metadata loaded). */
  get currentTime(): number {
    return this.mediaController.currentTime;
  }
  set currentTime(value: number) {
    this.mediaController.currentTime = value;
    this.currentTimeState = this.mediaController.currentTime;
  }

  private detectedKind(): AvKind {
    if (this.kind === 'audio' || this.kind === 'video') return this.kind;
    return this.mimeType.startsWith('audio/') ? 'audio' : 'video';
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const locale = this.effectiveLocale;
    let refreshTranscript = false;
    if (changed.has('cues')) this.rebuildCueKeys();
    if (this.transcriptLocale !== locale) {
      this.transcriptLocale = locale;
      refreshTranscript = true;
    }
    if (this.hasUpdated && changed.has('src') && this.src && !safeMediaSrc(this.src)) {
      this.announceRenderError();
    }
    if (
      this.hasUpdated &&
      (changed.has('src') || changed.has('kind') || changed.has('mimeType'))
    ) {
      this.duration = 0;
      this.currentTimeState = 0;
      this.activeCueId = null;
      this.activeCueIndex = -1;
      this.metadataLoaded = false;
      this.renderError = false;
      this.lastTimeChangeAt = 0;
      this.mediaController.startGeneration();
    }
    if (
      this.searchQuery &&
      (changed.has('cues') || this.searchLocale !== locale)
    ) {
      this.reconcileSearchMatches(changed.get('cues') as LyraAvCue[] | undefined);
      refreshTranscript = true;
    }
    if (refreshTranscript) this.refreshTranscriptRenderItem();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('playbackRate')) {
      this.mediaController.playbackRate = this.playbackRate;
      if (changed.get('playbackRate') !== undefined) this.emit('lr-rate-change', { rate: this.playbackRate });
    }
    if (changed.has('peaks')) this.drawWaveform();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncErrorAnnouncementSink();
    this.mediaController.reconnect();
    // Added here (not in firstUpdated) so every reconnect, including cross-document adoption,
    // binds the window that actually owns the component and pairs with disconnectedCallback.
    this.bindResizeWindow();
  }

  override firstUpdated(): void {
    this.drawWaveform();
  }

  override disconnectedCallback(): void {
    this.mediaController.disconnect();
    this.releaseErrorAnnouncementSink();
    this.unbindResizeWindow();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.releaseErrorAnnouncementSink();
    this.syncErrorAnnouncementSink();
    this.bindResizeWindow();
  }

  private syncErrorAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseErrorAnnouncementSink();
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseErrorAnnouncementSink(): void {
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
  }

  private announceRenderError(): void {
    this.errorAnnouncementSink?.announce(this.localize('avPlayerFailedToLoad'));
  }

  private bindResizeWindow(): void {
    const nextWindow = this.isConnected ? this.ownerDocument.defaultView : null;
    if (this.resizeWindow === nextWindow) return;
    this.unbindResizeWindow();
    this.resizeWindow = nextWindow ?? undefined;
    this.resizeWindow?.addEventListener('resize', this.onWindowResize);
  }

  private unbindResizeWindow(): void {
    this.resizeWindow?.removeEventListener('resize', this.onWindowResize);
    this.resizeWindow = undefined;
  }

  private onWindowResize = (): void => this.drawWaveform();

  // A stable, class-field-bound callback (not a fresh arrow-function literal per `render()` call)
  // so `ref()` sees the same identity across unrelated re-renders -- Lit treats a changed ref
  // callback as an unmount (undefined) immediately followed by a remount even though the canvas
  // element itself persists, which would otherwise fire `drawWaveform()` on every re-render (e.g.
  // every `timeupdate`-driven `currentTimeState` tick during playback) instead of only real mounts,
  // redundant with the `changed.has('peaks')` gate already in `updated()`. Mirrors
  // `pdf-viewer.class.ts`'s per-page-memoized `pageCanvasRef()`/`textLayerContainerRef()` maps --
  // this component only ever has one canvas, so a single bound method suffices in place of a Map.
  private canvasRef = (el?: Element): void => {
    if (el) this.drawWaveform();
  };

  private mediaRef = (el?: Element): void => {
    const media = el?.localName === 'audio' || el?.localName === 'video'
      ? (el as HTMLMediaElement)
      : undefined;
    this.mediaController.attach(media);
  };

  /** Proxies the native media element's `play()` and preserves its promise/rejection. Resolves
   *  immediately before the element mounts. */
  play(): Promise<void> {
    return this.mediaController.play();
  }
  /** Proxies the native media element's `pause()`. A no-op before the element mounts. */
  pause(): void {
    this.mediaController.pause();
  }
  /** Plays if paused, pauses if playing. A no-op before the element mounts. */
  toggle(): void {
    if (this.mediaEl?.paused) void this.play().catch(this.onPlaybackFailure);
    else this.pause();
  }
  /** Sets `currentTime` and forces an immediate `lr-time-change`, bypassing the playing-time throttle. */
  seek(seconds: number): void {
    this.currentTime = seconds;
    this.emitTimeChange(true);
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'time-range' || !this.metadataLoaded) return false;
    this.seek(anchor.start);
    return true;
  }

  private onLoadedMetadata(): void {
    this.metadataLoaded = true;
    this.duration = this.mediaController.duration;
    this.currentTimeState = this.mediaController.currentTime;
    this.renderError = false;
    this.emit('lr-load', { duration: this.duration, kind: this.detectedKind() });
  }

  private onPlay(): void {
    this.emit('lr-play');
  }
  private onPause(): void {
    this.emit('lr-pause');
  }
  private onMediaError(): void {
    this.renderError = true;
    this.announceRenderError();
    this.emit('lr-render-error', { error: new Error('The media failed to load.') });
  }

  private onNativeMediaEvent(event: Event): void {
    switch (event.type) {
      case 'loadedmetadata':
        this.onLoadedMetadata();
        break;
      case 'durationchange':
        this.duration = this.mediaController.duration;
        break;
      case 'play':
        this.onPlay();
        break;
      case 'pause':
        this.onPause();
        break;
      case 'error':
        this.onMediaError();
        break;
      case 'timeupdate':
        this.onTimeUpdate();
        break;
      case 'seeked':
        this.onSeeked();
        break;
      default:
        break;
    }
  }

  private onPlaybackFailure = (error: unknown): void => {
    this.renderError = true;
    this.announceRenderError();
    this.emit('lr-render-error', { error });
  };

  private emitTimeChange(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastTimeChangeAt < TIME_CHANGE_THROTTLE_MS) return;
    this.lastTimeChangeAt = now;
    this.currentTimeState = this.currentTime;
    this.emit('lr-time-change', { currentTime: this.currentTimeState });
  }

  private onTimeUpdate(): void {
    this.emitTimeChange(false);
    const time = this.currentTime;
    let active: LyraAvCue | undefined;
    let activeIndex = -1;
    this.cues.forEach((cue, index) => {
      const start = this.safeCueStart(cue);
      const end = this.safeCueEnd(cue, start);
      if (time >= start && time < end) {
        if (!active || start >= this.safeCueStart(active)) {
          active = cue;
          activeIndex = index;
        }
      }
    });
    const nextId = active?.id ?? null;
    if (nextId !== this.activeCueId || activeIndex !== this.activeCueIndex) {
      this.activeCueId = nextId;
      this.activeCueIndex = activeIndex;
      this.emit('lr-cue-change', { id: nextId });
    }
  }

  private onSeeked(): void {
    this.emitTimeChange(true);
  }

  /** Case-insensitive substring match over cue text and speaker. Reveals the active matching
   *  transcript row without changing media playback, then resolves the match count. */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.reconcileSearchMatches();
    this.activeSearchIndex = this.searchMatches.length ? 0 : -1;
    this.refreshTranscriptRenderItem();
    this.emitSearchChange();
    await this.revealActiveSearchMatch();
    return this.searchMatches.length;
  }

  private reconcileSearchMatches(previousCues?: LyraAvCue[]): void {
    const locale = this.effectiveLocale;
    const q = this.searchQuery.trim().toLocaleLowerCase(locale);
    const previousMatchIndex = this.searchMatches[this.activeSearchIndex];
    const previousActiveId =
      previousCues && previousMatchIndex !== undefined
        ? previousCues[previousMatchIndex]?.id
        : undefined;
    this.searchMatches = q
      ? this.cues.reduce<number[]>((acc, cue, index) => {
          if (
            cue.text.toLocaleLowerCase(locale).includes(q) ||
            (cue.speaker ?? '').toLocaleLowerCase(locale).includes(q)
          ) {
            acc.push(index);
          }
          return acc;
        }, [])
      : [];
    this.searchMatchIndices = new Set(this.searchMatches);
    this.searchLocale = locale;
    if (!this.searchMatches.length) {
      this.activeSearchIndex = -1;
      return;
    }
    const retainedPosition = previousActiveId
      ? this.searchMatches.findIndex((index) => this.cues[index]?.id === previousActiveId)
      : -1;
    this.activeSearchIndex =
      retainedPosition >= 0
        ? retainedPosition
        : Math.min(Math.max(0, this.activeSearchIndex), this.searchMatches.length - 1);
  }

  /** Advances to the next match, wrapping to the first after the last and revealing it. Resolves
   *  `true` once the active match moved, `false` when there are no matches -- the shape the shared
   *  `LyraTextViewerTarget` search contract declares, so a find-in-page host can drive every
   *  searchable component through one typed surface. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % this.searchMatches.length;
    this.refreshTranscriptRenderItem();
    this.emitSearchChange();
    await this.revealActiveSearchMatch();
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first and revealing it. Resolves
   *  `true` once the active match moved, `false` when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.refreshTranscriptRenderItem();
    this.emitSearchChange();
    await this.revealActiveSearchMatch();
    return true;
  }

  /** Clears the query, matches, and active index, and emits a zero-match `lr-search-change`. */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchIndices = new Set();
    this.activeSearchIndex = -1;
    this.refreshTranscriptRenderItem();
    this.emitSearchChange();
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      activeIndex: this.activeSearchIndex,
    });
  }

  private async revealActiveSearchMatch(): Promise<void> {
    await this.updateComplete;
    const list = this.renderRoot.querySelector('lr-virtual-list') as
      | (HTMLElement & {
        updateComplete: Promise<boolean>;
        scrollToIndex(
          index: number,
          options?: { align?: 'start' | 'end' | 'auto'; behavior?: ScrollBehavior },
        ): void;
      })
      | null;
    if (!list) return;
    await list.updateComplete;
    const index = this.searchMatches[this.activeSearchIndex];
    if (index === undefined) return;
    list.scrollToIndex(index, { align: 'auto', behavior: 'auto' });
  }

  private drawWaveform(): void {
    const canvas = this.canvasEl;
    if (!canvas || !this.peaks.length) return;
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const dpr = positiveFinite(ownerWindow.devicePixelRatio);
    const width = positiveFinite(canvas.clientWidth);
    const height = positiveFinite(canvas.clientHeight);
    canvas.width = Math.max(1, Math.floor(finiteNumber(width * dpr, 1)));
    canvas.height = Math.max(1, Math.floor(finiteNumber(height * dpr, 1)));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scaleX = finiteNumber(canvas.width / width, 1);
    const scaleY = finiteNumber(canvas.height / height, 1);
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const computed = ownerWindow.getComputedStyle(this);
    const tokenColor = computed.getPropertyValue('--lr-color-brand').trim();
    const color = ownerWindow.CSS.supports('color', tokenColor) ? tokenColor : computed.color;
    ctx.fillStyle = color;
    const peaks = waveformPaintPeaks(this.peaks, canvas.width);
    const barWidth = width / peaks.length;
    const physicalPixel = Math.min(barWidth, finiteNumber(1 / scaleX, barWidth));
    const paintedBarWidth = Math.max(physicalPixel, barWidth - physicalPixel);
    peaks.forEach((peak, i) => {
      const barHeight = Math.max(1, finiteRange(peak, 0, 0, 1) * height);
      ctx.fillRect(i * barWidth, (height - barHeight) / 2, paintedBarWidth, barHeight);
    });
  }

  private onHighlightActivate = (id: string, start: number): void => {
    this.activeHighlightId = id;
    this.seek(start);
    this.emit('lr-highlight-activate', { id });
  };

  private renderMarkers(): TemplateResult | typeof nothing {
    if (!this.duration) return nothing;
    const ranged = this.highlights.filter(
      (h): h is LyraHighlight & { anchor: { kind: 'time-range'; start: number; end?: number } } => h.anchor.kind === 'time-range',
    );
    if (!ranged.length) return nothing;
    return html`${ranged.map((h) => {
      const startSeconds = finiteRange(h.anchor.start, 0, 0, this.duration);
      const endSeconds =
        h.anchor.end == null
          ? startSeconds
          : finiteRange(h.anchor.end, startSeconds, startSeconds, this.duration);
      const start = (startSeconds / this.duration) * 100;
      const end = (endSeconds / this.duration) * 100;
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
    const validRates = [
      ...new Set(
        (Array.isArray(this.rates) ? this.rates : []).filter(
          (rate) =>
            Number.isFinite(rate) &&
            rate >= MIN_PLAYBACK_RATE &&
            rate <= MAX_PLAYBACK_RATE,
        ),
      ),
    ];
    if (validRates.includes(this.playbackRate)) return validRates;
    return [...validRates, this.playbackRate].sort((a, b) => a - b);
  }

  private safeCueStart(cue: LyraAvCue): number {
    const max = this.duration > 0 ? this.duration : Infinity;
    return finiteRange(cue.start, 0, 0, max);
  }

  private safeCueEnd(cue: LyraAvCue, start: number): number {
    if (cue.end == null) return Infinity;
    const max = this.duration > 0 ? this.duration : Infinity;
    return finiteRange(cue.end, start, start, max);
  }

  private rebuildCueKeys(): void {
    // Allocate every cue object an opaque token, even while its public id is unique. Otherwise,
    // adding or removing another cue with the same id would switch the first cue between an id-only
    // key and a duplicate key, remounting its virtual row. Repeating the exact same object twice
    // has no separately-addressable identity in LyraAvCue, so its final occurrence suffix is
    // necessarily positional.
    const objectOccurrences = new Map<LyraAvCue, number>();
    this.cueKeys = this.cues.map((cue) => {
      const idToken = `${cue.id.length}:${cue.id}`;
      let objectToken = this.cueTokens.get(cue);
      if (objectToken === undefined) {
        objectToken = ++this.nextCueToken;
        this.cueTokens.set(cue, objectToken);
      }
      const occurrence = objectOccurrences.get(cue) ?? 0;
      objectOccurrences.set(cue, occurrence + 1);
      return `cue:${idToken}:${objectToken}:${occurrence}`;
    });
  }

  private cueKey = (_cue: unknown, index: number): string => this.cueKeys[index] ?? `index:${index}`;

  private renderCue = (cue: unknown, index: number): TemplateResult => {
    const c = cue as LyraAvCue;
    const start = this.safeCueStart(c);
    const isActive = this.activeCueIndex === index;
    const isMatch = this.searchMatchIndices.has(index);
    const isActiveMatch = index === this.searchMatches[this.activeSearchIndex];
    const part = ['cue', isActive ? 'cue-current' : '', isMatch ? 'cue-match' : '', isActiveMatch ? 'cue-active-match' : '']
      .filter(Boolean)
      .join(' ');
    return html`<button
      part=${part}
      type="button"
      aria-current=${isActive ? 'true' : 'false'}
      ?data-match=${isMatch}
      ?data-active-match=${isActiveMatch}
      @click=${() => this.seek(start)}
    >
      <span part="cue-time">${formatTime(start, this.effectiveLocale)}</span>
      ${c.speaker ? html`<span part="cue-speaker">${c.speaker}</span>` : nothing}
      <span part="cue-text">${c.text}</span>
    </button>`;
  };

  private transcriptRenderItem = this.renderCue;

  private refreshTranscriptRenderItem(): void {
    // `renderItem` is the declarative invalidation boundary for a virtual list whose input array
    // itself did not change. Refresh it only for transcript-visible state (search or locale), not
    // on every playback-time render; unlike `keyFunction`, virtual-list deliberately does not
    // rebuild offsets when this callback changes.
    this.transcriptRenderItem = (cue, index) => this.renderCue(cue, index);
  }

  private renderTracks(): unknown {
    return this.tracks.map((t) => {
      const trackSrc = safeMediaSrc(t.src);
      return trackSrc
        ? html`<track src=${trackSrc} kind=${t.kind} srclang=${t.srclang} label=${t.label} ?default=${t.default} />`
        : nothing;
    });
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.name || this.localize('avPlayerLabel');
    const safeSrc = this.src ? safeMediaSrc(this.src) : null;
    const safePoster = this.poster ? safeMediaSrc(this.poster) : null;
    const kind = this.detectedKind();
    if (!safeSrc && this.src) {
      return html`<div part="base" role="region" aria-label=${label}>
        <div part="error">${this.localize('avPlayerFailedToLoad')}</div>
        ${this.renderAnchorLiveRegion()}
      </div>`;
    }
    return html`<div part="base" role="region" aria-label=${label}>
      ${kind === 'audio'
        ? keyed(`${kind}:${safeSrc ?? ''}`, html`<audio
            part="media"
            controls
            aria-label=${label}
            src=${safeSrc ?? nothing}
            ?loop=${this.loop}
            ?muted=${this.muted}
            preload=${this.preload}
            ${ref(this.mediaRef)}
            >${this.renderTracks()}</audio
          >`)
        : keyed(`${kind}:${safeSrc ?? ''}`, html`<video
            part="media"
            controls
            aria-label=${label}
            src=${safeSrc ?? nothing}
            poster=${safePoster ?? nothing}
            ?loop=${this.loop}
            ?muted=${this.muted}
            preload=${this.preload}
            ${ref(this.mediaRef)}
            >${this.renderTracks()}</video
          >`)}
      ${this.renderError ? html`<div part="error">${this.localize('avPlayerFailedToLoad')}</div>` : nothing}
      <div part="toolbar">
        <span class="rate-select-wrapper">
          <select
            part="rate-select"
            aria-label=${this.localize('avPlayerPlaybackRate')}
            @change=${(e: Event) => (this.playbackRate = Number((e.target as HTMLSelectElement).value))}
          >
            ${this.rateOptions().map((rate) => {
              const formattedRate = getNumberFormat(this.effectiveLocale, {
                maximumFractionDigits: 2,
              }).format(rate);
              return html`<option value=${String(rate)} ?selected=${rate === this.playbackRate}
                >${this.localize('avPlayerRateOption', undefined, { rate: formattedRate })}</option
              >`;
            })}
          </select>
          <span class="rate-select-chevron" aria-hidden="true">${chevronIcon()}</span>
        </span>
      </div>
      <div
        part="timeline"
        role="slider"
        tabindex="0"
        aria-valuemin="0"
        aria-valuemax=${String(this.duration)}
        aria-valuenow=${String(this.currentTimeState)}
        aria-valuetext=${this.localize('avPlayerPosition', undefined, { current: formatTime(this.currentTimeState, this.effectiveLocale), duration: formatTime(this.duration, this.effectiveLocale) })}
        aria-label=${this.localize('avPlayerTimeline')}
        @click=${this.onTimelineClick}
        @keydown=${this.onTimelineKeyDown}
      >
        ${this.peaks.length ? html`<canvas ${ref(this.canvasRef)}></canvas>` : nothing}
        ${this.renderMarkers()}
      </div>
      ${this.cues.length
        ? html`<lr-virtual-list
            part="transcript"
            exportparts="cue:cue, cue-current:cue-current, cue-match:cue-match, cue-active-match:cue-active-match, cue-time:cue-time, cue-speaker:cue-speaker, cue-text:cue-text"
            aria-label=${this.localize('avPlayerTranscript')}
            .items=${this.cues}
            .renderItem=${this.transcriptRenderItem}
            .keyFunction=${this.cueKey}
            .activeId=${this.activeCueIndex >= 0 && this.cues[this.activeCueIndex]
              ? this.cueKey(this.cues[this.activeCueIndex], this.activeCueIndex)
              : ''}
          ></lr-virtual-list>`
        : nothing}
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-av-player': LyraAvPlayer;
  }
}
