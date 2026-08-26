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
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { styles } from './av-player.styles.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { resolveBoundedCanvasAllocation } from '../../../internal/canvas.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import {
  EMPTY_LYRA_AV_CUES,
  EMPTY_LYRA_AV_TRACKS,
  snapshotLyraAvCues,
  snapshotLyraAvTracks,
  type LyraAvCue,
  type LyraAvTrack,
} from './av-metadata.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_avPlayerFailedToLoad, LYRA_DEFAULT_avPlayerLabel, LYRA_DEFAULT_avPlayerPlaybackRate, LYRA_DEFAULT_avPlayerPosition, LYRA_DEFAULT_avPlayerRateOption, LYRA_DEFAULT_avPlayerTimeline, LYRA_DEFAULT_avPlayerTranscript, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_viewerHighlightLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraAvCue, LyraAvTrack } from './av-metadata.js';

export type LyraAvKind = 'audio' | 'video';
export type LyraAvPreload = 'none' | 'metadata' | 'auto';

export interface LyraAvCueChangeDetail {
  readonly cueId: string | null;
  readonly index: number;
}

/** Throttle window for `lr-time-change` while playing -- at most 4/s, plus one extra emission per
 *  discrete `seek()` regardless of the window. */
const TIME_CHANGE_THROTTLE_MS = 250;
const MAX_AV_RATES = 32;
const MAX_AV_PEAKS = 65_536;
const MAX_CANVAS_DIMENSION = 4096;
const MAX_CANVAS_PIXELS = 8_388_608;
const OWNED_AV_COLLECTIONS = new WeakSet<object>();
const NO_REPORTED_ERROR = Symbol('no-reported-av-error');

function ownedSnapshot<T>(values: T[]): readonly T[] {
  const snapshot = Object.freeze(values);
  OWNED_AV_COLLECTIONS.add(snapshot);
  return snapshot;
}

const EMPTY_RATES = ownedSnapshot<number>([]);
const DEFAULT_RATES = ownedSnapshot([0.75, 1, 1.25, 1.5, 2]);
const EMPTY_CUES = EMPTY_LYRA_AV_CUES;
const EMPTY_PEAKS = ownedSnapshot<number>([]);
const EMPTY_TRACKS = EMPTY_LYRA_AV_TRACKS;

function normalizeArray<T>(
  value: unknown,
  limit: number,
  normalize: (candidate: unknown, index: number) => T | undefined,
  fallback: readonly T[],
): readonly T[] {
  try {
    if (!Array.isArray(value)) return fallback;
    if (OWNED_AV_COLLECTIONS.has(value)) return value as readonly T[];
    const result: T[] = [];
    const length = Math.min(value.length, limit);
    for (let index = 0; index < length; index++) {
      try {
        const normalized = normalize(value[index], index);
        if (normalized !== undefined) result.push(normalized);
      } catch {
        // A hostile entry does not discard earlier valid entries.
      }
    }
    return ownedSnapshot(result);
  } catch {
    return fallback;
  }
}

function normalizeRates(value: unknown): readonly number[] {
  const seen = new Set<number>();
  return normalizeArray(
    value,
    MAX_AV_RATES,
    (candidate) => {
      if (
        typeof candidate !== 'number' ||
        !Number.isFinite(candidate) ||
        candidate < MIN_PLAYBACK_RATE ||
        candidate > MAX_PLAYBACK_RATE ||
        seen.has(candidate)
      ) {
        return undefined;
      }
      seen.add(candidate);
      return candidate;
    },
    EMPTY_RATES,
  );
}

function normalizePeaks(value: unknown): readonly number[] {
  return normalizeArray(
    value,
    MAX_AV_PEAKS,
    (candidate) => typeof candidate === 'number' ? finiteRange(candidate, 0, 0, 1) : undefined,
    EMPTY_PEAKS,
  );
}

interface OwnedAnimationFrame {
  owner: Window;
  handle: number;
}

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
  'lr-play': CustomEvent<null>;
  'lr-pause': CustomEvent<null>;
  'lr-load': CustomEvent<{ duration: number; kind: LyraAvKind }>;
  'lr-time-change': CustomEvent<{ currentTime: number }>;
  'lr-rate-change': CustomEvent<{ rate: number }>;
  'lr-cue-change': CustomEvent<LyraAvCueChangeDetail>;
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  blur: FocusEvent;
  focus: FocusEvent;
}

class LyraAvPlayerBase extends LyraElement<LyraAvPlayerEventMap> {}

/**
 * `<lr-av-player>` — audio/video player built on a native `<audio>`/`<video>` element, plus a cue
 * transcript synced to `currentTime`, `time-range` anchor/highlight support, an optional
 * dependency-free waveform (peaks in, no in-component decoding), and playback-rate control. Owns
 * recorded-media transcript sync; distinct from `<lr-transcript-feed>` (live captions for an
 * in-progress voice session) and `<lr-sequence-playback>` (an index stepper over
 * `[0, itemCount)` for
 * time-series dashboards — no media involved in either).
 *
 * Adopts `DocumentAnchorTarget` with `anchorKinds: ['time-range']` only. No text selection is bound:
 * transcript rows render inside `<lr-virtual-list>`'s own nested shadow root, one boundary deeper
 * than the mixin's default selection lookup resolves.
 *
 * The transcript virtualizes through `<lr-virtual-list>` the same way `pdf-viewer.class.ts`
 * virtualizes pages: `items`/`renderItem`/`keyFunction`/`activeItemId` props. Playback follows its
 * active cue through `activeItemId`; search navigation reveals its active match through the list's
 * `scrollToIndex()` API without seeking the media.
 * An authored host `aria-label` remains the aggregate name on the host. Otherwise a nonempty
 * `name` labels `[part="base"]` as a region. The native media element keeps the distinct localized
 * player-purpose label, avoiding duplicate semantic owners; a bare loaded player uses the native
 * media element as its sole named owner.
 *
 * **RTL behavior:** surrounding controls stay logical, but `[part="timeline"]` is a physical
 * elapsed-time axis and remains left-to-right under `dir="rtl"`. ArrowLeft rewinds and ArrowRight
 * advances in both text directions.
 *
 * Waveform canvas painting is visibility-gated: peak, theme, and resize changes while the player
 * is off-screen stay dirty and coalesce into one paint on re-entry. Environments without
 * `IntersectionObserver` retain eager painting.
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
 * @event lr-cue-change - The active transcript cue changed. `detail: { cueId, index }`
 *   (`cueId:null,index:-1` when none is active).
 * @event lr-highlight-activate - A `time-range` highlight marker was activated.
 *   `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after `anchor` (or a `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @event lr-search-change - Fired from `search()`/`searchNext()`/`searchPrevious()`/
 *   `clearSearch()`. `detail: { query, matchCount, matchCountExact, activeIndex }`.
 *   `matchCountExact` is always `true`: `search()` matches over the already-loaded `cues` array
 *   with no additional ceiling.
 * @event lr-render-error - Native media failure, unsafe-source rejection, or an internal playback
 *   rejection. `detail: { error }`; native `MediaError` identity is preserved.
 * @event {FocusEvent} focus - Relayed once from the native media element as a bubbling, composed
 *   native event.
 * @event {FocusEvent} blur - Relayed once from the native media element as a bubbling, composed
 *   native event.
 * @csspart base - The root wrapper.
 * @csspart media - The native `<audio>`/`<video>` element.
 * @csspart toolbar - The playback-rate control row.
 * @csspart rate-select - The playback-rate `<select>`.
 * @csspart timeline - The waveform canvas or plain seek rail; click-to-seek and arrow-key seeking.
 *   It is disabled and removed from sequential focus until duration is positive.
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
    fieldRequired: LYRA_DEFAULT_fieldRequired,
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
    volume: { type: Number, reflect: true, noAccessor: true },
  };

  /** Media URL; validated with `safeMediaSrc` before it ever reaches the `<audio>`/`<video>` `src`. */
  @property() src = '';
  /** Accessible name of the stable `[part="base"]` region and of the native `[part="media"]`
   *  element (the actual keyboard tab stop, which would otherwise be nameless); a host
   *  `aria-label` wins, then the localized `avPlayerLabel` fallback. */
  @property() name = '';
  /** Forces exact `audio`/`video` rendering, overriding the `mime-type`-based auto-detection.
   *  Unrecognized runtime or attribute values continue MIME auto-detection. */
  @property() kind?: LyraAvKind;
  /** Drives auto-detection: an `audio/*` mime type renders `<audio>`; anything else renders
   *  `<video>`. Ignored once `kind` is set explicitly. */
  @property({ attribute: 'mime-type' }) mimeType = '';
  /** Poster image for `<video>`; validated with `safeMediaSrc` and omitted when unsafe. Ignored for
   *  `<audio>`. */
  @property() poster = '';
  @property({ type: Boolean }) loop = false;
  @property({ type: Boolean }) muted = false;
  @property() preload: LyraAvPreload = 'metadata';
  private _playbackRate = 1;
  private _volume = 1;
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
  /** Native volume on the canonical `0..1` scale. Native `volumechange` updates this property, and
   * direct property writes update the current media generation without feedback duplicates. */
  get volume(): number {
    return this._volume;
  }
  set volume(next: number) {
    const old = this._volume;
    this._volume = finiteRange(next, 1, 0, 1);
    this.requestUpdate('volume', old);
  }
  private _rates: readonly number[] = DEFAULT_RATES;
  /** Selectable rates offered by `[part="rate-select"]`; snapshotted, deduplicated, bounded to 32. */
  @property({ attribute: false })
  get rates(): readonly number[] { return this._rates; }
  set rates(value: readonly number[]) {
    const previous = this._rates;
    this._rates = normalizeRates(value);
    this.requestUpdate('rates', previous);
  }
  private _cues: readonly LyraAvCue[] = EMPTY_CUES;
  /** Transcript entries, rendered as a virtualized, `currentTime`-synced list. Valid nonempty
   * `cueId` values are unique; the first occurrence wins. Inputs are bounded, cloned, and frozen. */
  @property({ attribute: false })
  get cues(): readonly LyraAvCue[] { return this._cues; }
  set cues(value: readonly LyraAvCue[]) {
    const previous = this._cues;
    this._cues = snapshotLyraAvCues(value);
    this.requestUpdate('cues', previous);
  }
  private _peaks: readonly number[] = EMPTY_PEAKS;
  /** Normalized `0..1` waveform amplitude samples. Empty renders a plain seek rail instead of a
   *  canvas -- this component never decodes audio itself. */
  @property({ attribute: false })
  get peaks(): readonly number[] { return this._peaks; }
  set peaks(value: readonly number[]) {
    const previous = this._peaks;
    this._peaks = normalizePeaks(value);
    this.requestUpdate('peaks', previous);
  }
  private _tracks: readonly LyraAvTrack[] = EMPTY_TRACKS;
  /** Native `<track>` sources (subtitles/captions/descriptions), bounded and snapshotted. */
  @property({ attribute: false })
  get tracks(): readonly LyraAvTrack[] { return this._tracks; }
  set tracks(value: readonly LyraAvTrack[]) {
    const previous = this._tracks;
    this._tracks = snapshotLyraAvTracks(value);
    this.requestUpdate('tracks', previous);
  }

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
  @state() private sourceError = false;
  @state() private playbackError = false;

  @query('[part="timeline"] canvas') private canvasEl?: HTMLCanvasElement;

  private readonly mediaController = new NativeMediaController(this, {
    onEvent: (event) => this.onNativeMediaEvent(event),
  });
  private readonly semanticInternals = attachInternalsSafely(this);
  private lastTimeChangeAt = 0;
  private searchLocale = '';
  private transcriptLocale = '';
  private searchMatchIndices = new Set<number>();
  private cueKeys: string[] = [];
  private errorAnnouncementSink?: AnnouncementSink;
  private resizeWindow?: Window;
  private waveformResizeObserver?: ResizeObserver;
  private waveformResizeObserverWindow?: Window;
  private waveformResizeTarget?: HTMLCanvasElement;
  private waveformIntersectionObserver?: IntersectionObserver;
  private waveformObserverWindow?: Window;
  private waveformDetachedObserverWindow?: Window;
  private waveformDrawFrame?: OwnedAnimationFrame;
  // Fail closed until the owner realm's observer reports. The no-observer fallback below restores
  // eager painting before any mount draw reaches the canvas.
  private waveformVisible = false;
  private waveformDirty = false;
  private lastWaveformAllocation?: {
    target: HTMLCanvasElement;
    width: number;
    height: number;
    dpr: number;
  };
  private pendingSeekEmission: number | null = null;
  private lastEmittedTime: number | null = null;
  private lastReportedSourceError: unknown = NO_REPORTED_ERROR;
  /** A connection begins from state, not from a publicly observable source transition. */
  private connectionEventBaselinePending = true;

  constructor() {
    super();
    new ThemeWatcher(this, () => {
      if (this.peaks.length > 0) this.drawWaveform();
    });
  }

  private get mediaEl(): HTMLMediaElement | undefined {
    return this.mediaController.element;
  }

  /** Focus the native `[part="media"]` element — it carries `controls`, so it is this component's
   *  primary focusable affordance. */
  override focus(options?: FocusOptions): void {
    this.mediaEl?.focus(options);
  }

  /** Blur the native `[part="media"]` element. */
  override blur(): void {
    this.mediaEl?.blur();
  }

  /** Activate the native `[part="media"]` element, so a host-level `.click()` is not a silent
   *  no-op. */
  override click(): void {
    this.mediaEl?.click();
  }

  private onMediaFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onMediaBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  /** Live playback position: the media element's own `currentTime` once mounted, else the last
   *  locally-tracked value (e.g. a `seek()` issued before metadata loaded). */
  get currentTime(): number {
    return this.mediaController.currentTime;
  }
  set currentTime(value: number) {
    this.mediaController.currentTime = value;
    this.currentTimeState = this.mediaController.currentTime;
  }

  private detectedKind(): LyraAvKind {
    if (this.kind === 'audio' || this.kind === 'video') return this.kind;
    return this.mimeType.startsWith('audio/') ? 'audio' : 'video';
  }

  private get effectivePreload(): LyraAvPreload {
    return this.preload === 'none' || this.preload === 'auto' ? this.preload : 'metadata';
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // A host aria-label names the aggregate player, so give it a real default semantic owner.
    // An explicit author `role` attribute still overrides ElementInternals semantics.
    this.semanticInternals.role = hostAriaLabel(this) !== null ? 'region' : null;
    const mayEmitConnectionTransition = this.isConnected && !this.connectionEventBaselinePending;
    const locale = this.effectiveLocale;
    let refreshTranscript = false;
    if (changed.has('kind') && this.kind !== undefined && this.kind !== 'audio' && this.kind !== 'video') {
      this.kind = undefined;
    }
    if (changed.has('preload') && this.preload !== this.effectivePreload) this.preload = this.effectivePreload;
    if (changed.has('cues')) {
      this.rebuildCueKeys();
      if (this.metadataLoaded) this.reconcileActiveCue();
    }
    if (this.transcriptLocale !== locale) {
      this.transcriptLocale = locale;
      refreshTranscript = true;
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
      this.sourceError = false;
      this.playbackError = false;
      this.lastTimeChangeAt = 0;
      this.pendingSeekEmission = null;
      this.lastEmittedTime = null;
      this.lastReportedSourceError = NO_REPORTED_ERROR;
      this.mediaController.startGeneration();
      if (changed.has('src') && this.src && !safeMediaSrc(this.src)) {
        const error = new TypeError('The media source URL is not allowed.');
        if (mayEmitConnectionTransition) {
          this.announceRenderError();
          this.emit('lr-render-error', { error });
        }
      }
    }
    if (
      this.searchQuery &&
      (changed.has('cues') || this.searchLocale !== locale)
    ) {
      this.reconcileSearchMatches(changed.get('cues') as readonly LyraAvCue[] | undefined);
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
    if (changed.has('volume')) this.mediaController.volume = this.volume;
    if (changed.has('muted')) this.mediaController.muted = this.muted;
    if (changed.has('peaks')) {
      this.syncWaveformVisibilityObserver();
      this.syncWaveformResizeObserver();
      this.drawWaveform();
    }
    if (this.isConnected) this.connectionEventBaselinePending = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.connectionEventBaselinePending = true;
    this.syncErrorAnnouncementSink();
    this.mediaController.reconnect();
    // Added here (not in firstUpdated) so every reconnect, including cross-document adoption,
    // binds the window that actually owns the component and pairs with disconnectedCallback.
    this.bindResizeWindow();
    this.syncWaveformVisibilityObserver();
    this.syncWaveformResizeObserver();
    if (this.waveformDirty) this.drawWaveform();
    this.requestUpdate();
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.drawWaveform();
  }

  override disconnectedCallback(): void {
    this.connectionEventBaselinePending = true;
    this.mediaController.disconnect();
    this.releaseErrorAnnouncementSink();
    this.unbindResizeWindow();
    this.unbindWaveformResizeObserver();
    this.cancelWaveformDrawFrame();
    // An old same-realm observation cannot describe where a reattached host now sits. Preserve
    // the owner long enough for syncWaveformVisibilityObserver() to require a fresh delivery on
    // that reconnect; a new owner realm intentionally keeps its immediate resize behavior.
    this.waveformDetachedObserverWindow = this.waveformObserverWindow;
    this.unbindWaveformVisibilityObserver();
    this.waveformDirty = this.peaks.length > 0;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseErrorAnnouncementSink();
    this.syncErrorAnnouncementSink();
    this.bindResizeWindow();
    this.syncWaveformVisibilityObserver();
    this.syncWaveformResizeObserver();
    if (this.isConnected && this.waveformDirty) this.drawWaveform();
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

  /** Binds canvas visibility to the document currently owning this element. */
  private syncWaveformVisibilityObserver(): void {
    const owner = this.isConnected && this.peaks.length > 0 ? this.ownerDocument.defaultView : null;
    if (this.waveformIntersectionObserver && this.waveformObserverWindow === owner) return;

    // A same-realm reparent can move a previously visible player beneath the viewport between
    // observer registrations. Do not repaint from that stale truth value before the new observer
    // reports. Cross-document adoption retains the established eager owner-resize behavior, and a
    // realm without IntersectionObserver still deliberately falls back to eager drawing below.
    const needsFreshSameRealmVisibility = owner !== null && this.waveformDetachedObserverWindow === owner;
    if (owner !== null) this.waveformDetachedObserverWindow = undefined;
    this.cancelWaveformDrawFrame();
    this.unbindWaveformVisibilityObserver();
    if (!owner) return;
    const IntersectionObserverCtor = owner.IntersectionObserver;
    if (!IntersectionObserverCtor) {
      this.waveformVisible = true;
      return;
    }
    if (needsFreshSameRealmVisibility) this.waveformVisible = false;
    this.waveformDirty = true;

    let observer: IntersectionObserver;
    observer = new IntersectionObserverCtor((entries) => {
      if (
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner ||
        this.waveformIntersectionObserver !== observer
      ) {
        return;
      }
      const entry = entries.find((candidate) => candidate.target === this);
      if (!entry || entry.isIntersecting === this.waveformVisible) return;
      this.waveformVisible = entry.isIntersecting;
      if (!this.waveformVisible) this.cancelWaveformDrawFrame();
      else if (this.waveformDirty) this.scheduleWaveformDraw();
    });
    this.waveformObserverWindow = owner;
    this.waveformIntersectionObserver = observer;
    observer.observe(this);
  }

  private unbindWaveformVisibilityObserver(): void {
    this.waveformIntersectionObserver?.disconnect();
    this.waveformIntersectionObserver = undefined;
    this.waveformObserverWindow = undefined;
  }

  private onWindowResize = (): void => this.drawWaveform();

  private syncWaveformResizeObserver(): void {
    const target = this.isConnected && this.peaks.length > 0 ? this.canvasEl : undefined;
    const owner = target?.ownerDocument.defaultView;
    if (
      target &&
      owner &&
      this.waveformResizeObserver &&
      this.waveformResizeObserverWindow === owner &&
      this.waveformResizeTarget === target
    ) {
      return;
    }
    this.unbindWaveformResizeObserver();
    if (!target || !owner || typeof owner.ResizeObserver !== 'function') return;
    let observer: ResizeObserver;
    observer = new owner.ResizeObserver((entries) => {
      if (
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner ||
        this.waveformResizeObserver !== observer ||
        this.waveformResizeTarget !== target ||
        !entries.some((entry) => entry.target === target)
      ) {
        return;
      }
      const width = positiveFinite(target.clientWidth);
      const height = positiveFinite(target.clientHeight);
      const dpr = positiveFinite(owner.devicePixelRatio);
      const previous = this.lastWaveformAllocation;
      if (
        previous?.target === target &&
        previous.width === width &&
        previous.height === height &&
        previous.dpr === dpr
      ) {
        return;
      }
      this.drawWaveform();
    });
    this.waveformResizeObserver = observer;
    this.waveformResizeObserverWindow = owner;
    this.waveformResizeTarget = target;
    observer.observe(target);
  }

  private unbindWaveformResizeObserver(): void {
    this.waveformResizeObserver?.disconnect();
    this.waveformResizeObserver = undefined;
    this.waveformResizeObserverWindow = undefined;
    this.waveformResizeTarget = undefined;
    this.lastWaveformAllocation = undefined;
  }

  // A stable, class-field-bound callback (not a fresh arrow-function literal per `render()` call)
  // so `ref()` sees the same identity across unrelated re-renders -- Lit treats a changed ref
  // callback as an unmount (undefined) immediately followed by a remount even though the canvas
  // element itself persists, which would otherwise fire `drawWaveform()` on every re-render (e.g.
  // every `timeupdate`-driven `currentTimeState` tick during playback) instead of only real mounts,
  // redundant with the `changed.has('peaks')` gate already in `updated()`. Mirrors
  // `pdf-viewer.class.ts`'s per-page-memoized `pageCanvasRef()`/`textLayerContainerRef()` maps --
  // this component only ever has one canvas, so a single bound method suffices in place of a Map.
  private canvasRef = (el?: Element): void => {
    if (!el) {
      this.unbindWaveformResizeObserver();
      return;
    }
    this.syncWaveformVisibilityObserver();
    this.syncWaveformResizeObserver();
    this.drawWaveform();
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
    const media = this.mediaEl;
    if (media?.paused) {
      const generation = this.mediaController.generation;
      void this.play().catch((error: unknown) => {
        if (
          !this.isConnected
          || !this.mediaController.isCurrentGeneration(generation, media)
        ) return;
        this.onPlaybackFailure(error);
      });
    } else this.pause();
  }
  /** Sets `currentTime` and forces an immediate `lr-time-change`, bypassing the playing-time throttle. */
  seek(seconds: number): void {
    this.currentTime = seconds;
    this.emitTimeChange(true, true);
    this.pendingSeekEmission = this.currentTimeState;
    this.reconcileActiveCue();
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
    this.sourceError = false;
    this.playbackError = false;
    this.lastReportedSourceError = NO_REPORTED_ERROR;
    this.reconcileActiveCue();
    this.emit('lr-load', { duration: this.duration, kind: this.detectedKind() });
  }

  private onPlay(): void {
    this.playbackError = false;
    this.emit('lr-play', null);
  }
  private onPause(): void {
    this.emit('lr-pause', null);
  }
  private onMediaError(): void {
    const error = this.mediaEl?.error ?? null;
    const identity = error ?? 'native-media-error-without-detail';
    if (identity === this.lastReportedSourceError) return;
    this.lastReportedSourceError = identity;
    this.sourceError = true;
    this.playbackError = false;
    this.announceRenderError();
    this.emit('lr-render-error', { error: error ?? new Error('The media failed to load.') });
  }

  private onNativeMediaEvent(event: Event): void {
    switch (event.type) {
      case 'loadedmetadata':
        this.onLoadedMetadata();
        break;
      case 'durationchange':
        this.duration = this.mediaController.duration;
        this.reconcileActiveCue();
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
      case 'volumechange': {
        const nextVolume = this.mediaController.volume;
        const nextMuted = this.mediaController.muted;
        if (this.volume !== nextVolume) this.volume = nextVolume;
        if (this.muted !== nextMuted) this.muted = nextMuted;
        break;
      }
      case 'ratechange': {
        const nextRate = this.mediaController.playbackRate;
        if (this.playbackRate !== nextRate) this.playbackRate = nextRate;
        break;
      }
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
    this.playbackError = true;
    this.announceRenderError();
    this.emit('lr-render-error', { error });
  };

  private emitTimeChange(force: boolean, allowDuplicate = false): void {
    const now = Date.now();
    if (!force && now - this.lastTimeChangeAt < TIME_CHANGE_THROTTLE_MS) return;
    const nextTime = this.currentTime;
    this.currentTimeState = nextTime;
    if (!allowDuplicate && nextTime === this.lastEmittedTime) return;
    this.lastTimeChangeAt = now;
    this.lastEmittedTime = nextTime;
    this.emit('lr-time-change', { currentTime: this.currentTimeState });
  }

  private onTimeUpdate(): void {
    this.emitTimeChange(false);
    this.reconcileActiveCue();
  }

  private reconcileActiveCue(): void {
    const time = this.currentTime;
    let active: LyraAvCue | undefined;
    let activeIndex = -1;
    this.cues.forEach((cue, index) => {
      const start = this.safeCueStart(cue);
      const end = this.safeCueEnd(cue, start, index);
      if (time >= start && time < end) {
        if (!active || start >= this.safeCueStart(active)) {
          active = cue;
          activeIndex = index;
        }
      }
    });
    const nextId = active?.cueId ?? null;
    this.setActiveCue(nextId, activeIndex);
  }

  private setActiveCue(nextId: string | null, activeIndex: number): void {
    if (nextId !== this.activeCueId || activeIndex !== this.activeCueIndex) {
      this.activeCueId = nextId;
      this.activeCueIndex = activeIndex;
      this.emit('lr-cue-change', Object.freeze({ cueId: nextId, index: activeIndex }));
    }
  }

  private onSeeked(): void {
    const completedTime = this.currentTime;
    if (this.pendingSeekEmission === null || completedTime !== this.pendingSeekEmission) {
      this.emitTimeChange(true);
    } else {
      this.currentTimeState = completedTime;
    }
    this.pendingSeekEmission = null;
    this.reconcileActiveCue();
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

  private reconcileSearchMatches(previousCues?: readonly LyraAvCue[]): void {
    const locale = this.effectiveLocale;
    const q = this.searchQuery.trim().toLocaleLowerCase(locale);
    const previousMatchIndex = this.searchMatches[this.activeSearchIndex];
    const previousActiveId =
      previousCues && previousMatchIndex !== undefined
        ? previousCues[previousMatchIndex]?.cueId
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
      ? this.searchMatches.findIndex((index) => this.cues[index]?.cueId === previousActiveId)
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
      // reconcileSearchMatches() reduces over the already-loaded `cues` array with no additional
      // ceiling (the array itself is bounded to MAX_LYRA_AV_CUES entries when it is loaded, which
      // is a corpus-retention limit like `<lr-terminal>`'s scrollback trim, not a search-time cap),
      // so the count is always exact.
      matchCountExact: true,
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
    const ownerWindow = this.ownerDocument.defaultView;
    if (!this.peaks.length) {
      this.waveformDirty = false;
      return;
    }
    if (!this.isConnected || !canvas || !ownerWindow || !this.waveformVisible) {
      this.waveformDirty = true;
      return;
    }
    this.cancelWaveformDrawFrame();
    this.waveformDirty = false;
    this.paintWaveform();
  }

  /** Paints once the visibility gate has confirmed that waveform work is useful. */
  private paintWaveform(): void {
    const canvas = this.canvasEl;
    if (!canvas || !this.peaks.length) return;
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const dpr = positiveFinite(ownerWindow.devicePixelRatio);
    const width = positiveFinite(canvas.clientWidth);
    const height = positiveFinite(canvas.clientHeight);
    const allocation = resolveBoundedCanvasAllocation({
      cssWidth: width,
      cssHeight: height,
      desiredScale: dpr,
      maxDimension: MAX_CANVAS_DIMENSION,
      maxPixels: MAX_CANVAS_PIXELS,
    });
    this.lastWaveformAllocation = { target: canvas, width, height, dpr };
    canvas.width = allocation.pixelWidth;
    canvas.height = allocation.pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scaleX = allocation.scaleX;
    const scaleY = allocation.scaleY;
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

  /** Coalesces the one deferred paint when an off-screen waveform returns to view. */
  private scheduleWaveformDraw(): void {
    if (this.waveformDrawFrame) return;
    const owner = this.ownerDocument.defaultView;
    if (!owner || !this.isConnected) return;
    const request: OwnedAnimationFrame = { owner, handle: 0 };
    request.handle = owner.requestAnimationFrame(() => {
      if (this.waveformDrawFrame !== request) return;
      this.waveformDrawFrame = undefined;
      if (this.isConnected && this.ownerDocument.defaultView === owner) this.drawWaveform();
    });
    this.waveformDrawFrame = request;
  }

  private cancelWaveformDrawFrame(): void {
    const request = this.waveformDrawFrame;
    if (request) request.owner.cancelAnimationFrame(request.handle);
    this.waveformDrawFrame = undefined;
  }

  private onHighlightActivate = (id: string, start: number): void => {
    this.activeHighlightId = id;
    this.seek(start);
    this.emit('lr-highlight-activate', { highlightId: id });
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
    if (!(this.duration > 0)) return;
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

  private safeCueEnd(cue: LyraAvCue, start: number, cueIndex: number): number {
    if (cue.end == null) {
      let nextStart = Infinity;
      this.cues.forEach((candidate, index) => {
        if (index === cueIndex) return;
        const candidateStart = this.safeCueStart(candidate);
        if (candidateStart > start && candidateStart < nextStart) nextStart = candidateStart;
      });
      return nextStart;
    }
    const max = this.duration > 0 ? this.duration : Infinity;
    return finiteRange(cue.end, start, start, max);
  }

  private rebuildCueKeys(): void {
    this.cueKeys = this.cues.map((cue) => `cue:${cue.cueId.length}:${cue.cueId}`);
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
    const explicitHostLabel = hostAriaLabel(this);
    const aggregateLabel = explicitHostLabel ?? (this.name || this.localize('avPlayerLabel'));
    const safeSrc = this.src ? safeMediaSrc(this.src) : null;
    const safePoster = this.poster ? safeMediaSrc(this.poster) : null;
    const kind = this.detectedKind();
    const baseOwnsAggregate = explicitHostLabel === null && Boolean(this.name || (!safeSrc && this.src));
    const mediaLabel = explicitHostLabel === '' ? '' : this.localize('avPlayerLabel');
    if (!safeSrc && this.src) {
      return html`<div
        part="base"
        role=${baseOwnsAggregate ? 'region' : nothing}
        aria-label=${baseOwnsAggregate ? aggregateLabel : nothing}
      >
        <div part="error">${this.localize('avPlayerFailedToLoad')}</div>
        ${this.renderAnchorLiveRegion()}
      </div>`;
    }
    return html`<div
      part="base"
      role=${baseOwnsAggregate ? 'region' : nothing}
      aria-label=${baseOwnsAggregate ? aggregateLabel : nothing}
    >
      ${kind === 'audio'
        ? keyed(`${kind}:${safeSrc ?? ''}`, html`<audio
            part="media"
            controls
            aria-label=${mediaLabel}
            src=${safeSrc ?? nothing}
            ?loop=${this.loop}
            .muted=${this.muted}
            .volume=${this.volume}
            preload=${this.effectivePreload}
            @focus=${this.onMediaFocus}
            @blur=${this.onMediaBlur}
            ${ref(this.mediaRef)}
            >${this.renderTracks()}</audio
          >`)
        : keyed(`${kind}:${safeSrc ?? ''}`, html`<video
            part="media"
            controls
            aria-label=${mediaLabel}
            src=${safeSrc ?? nothing}
            poster=${safePoster ?? nothing}
            ?loop=${this.loop}
            .muted=${this.muted}
            .volume=${this.volume}
            preload=${this.effectivePreload}
            @focus=${this.onMediaFocus}
            @blur=${this.onMediaBlur}
            ${ref(this.mediaRef)}
            >${this.renderTracks()}</video
          >`)}
      ${this.sourceError || this.playbackError
        ? html`<div part="error">${this.localize('avPlayerFailedToLoad')}</div>`
        : nothing}
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
      <div class="timeline-positioner">
        <div
          part="timeline"
          role="slider"
          tabindex=${this.duration > 0 ? '0' : '-1'}
          aria-disabled=${this.duration > 0 ? 'false' : 'true'}
          aria-valuemin="0"
          aria-valuemax=${String(this.duration)}
          aria-valuenow=${String(this.currentTimeState)}
          aria-valuetext=${this.localize('avPlayerPosition', undefined, { current: formatTime(this.currentTimeState, this.effectiveLocale), duration: formatTime(this.duration, this.effectiveLocale) })}
          aria-label=${this.localize('avPlayerTimeline')}
          @click=${this.onTimelineClick}
          @keydown=${this.onTimelineKeyDown}
        >
          ${this.peaks.length ? html`<canvas ${ref(this.canvasRef)}></canvas>` : nothing}
        </div>
        <div class="timeline-markers">${this.renderMarkers()}</div>
      </div>
      ${this.cues.length
        ? html`<lr-virtual-list
            part="transcript"
            exportparts="cue:cue, cue-current:cue-current, cue-match:cue-match, cue-active-match:cue-active-match, cue-time:cue-time, cue-speaker:cue-speaker, cue-text:cue-text"
            aria-label=${this.localize('avPlayerTranscript')}
            .items=${this.cues}
            .renderItem=${this.transcriptRenderItem}
            .keyFunction=${this.cueKey}
            .activeItemId=${this.activeCueIndex >= 0 && this.cues[this.activeCueIndex]
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
