import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  MAX_NATIVE_PLAYBACK_RATE,
  MIN_NATIVE_PLAYBACK_RATE,
  NativeMediaController,
  canExitFullscreen,
  canRequestFullscreen,
  canRequestPictureInPicture,
  safeNativeMediaSource,
} from '../../../internal/media-controller.js';
import { finiteRange } from '../../../internal/numbers.js';
import { readResponseText, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './video.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_avPlayerPosition, LYRA_DEFAULT_pause, LYRA_DEFAULT_play, LYRA_DEFAULT_playbackPosition, LYRA_DEFAULT_videoCaptions, LYRA_DEFAULT_videoCaptionsOff, LYRA_DEFAULT_videoEnterFullscreen, LYRA_DEFAULT_videoExitFullscreen, LYRA_DEFAULT_videoExitPictureInPicture, LYRA_DEFAULT_videoMute, LYRA_DEFAULT_videoPictureInPicture, LYRA_DEFAULT_videoPlaybackSpeed, LYRA_DEFAULT_videoPlayerLabel, LYRA_DEFAULT_videoUnmute, LYRA_DEFAULT_videoVolume } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraVideoControls = 'none' | 'standard' | 'full';
export type LyraVideoPreload = 'auto' | 'metadata' | 'none';

export interface LyraVideoState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
}

/** Upstream-compatible name for {@linkcode LyraVideoState}. */
export type VideoState = LyraVideoState;

export interface LyraVideoEventMap {
  ended: Event;
  error: Event;
  loadedmetadata: Event;
  pause: Event;
  play: Event;
  timeupdate: Event;
  volumechange: Event;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}

interface ThumbnailCue {
  start: number;
  end: number;
  src: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface CaptionTrack {
  track: TextTrack;
  label: string;
  language: string;
}

const MAX_THUMBNAIL_BYTES = 256 * 1024;
const MAX_THUMBNAIL_CUES = 2_000;

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function safeControls(value: unknown): LyraVideoControls {
  return value === 'none' || value === 'full' ? value : 'standard';
}

function safePreload(value: unknown): LyraVideoPreload {
  return value === 'auto' || value === 'none' ? value : 'metadata';
}

function parseVttTime(source: string): number | null {
  const parts = source.trim().split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const seconds = parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!;
  return seconds >= 0 ? seconds : null;
}

function parseThumbnailUrl(
  source: string,
  baseUrl: string,
  URLCtor: typeof URL,
): Omit<ThumbnailCue, 'start' | 'end'> | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  try {
    const resolved = new URLCtor(trimmed, baseUrl);
    const sprite = /^#xywh=(\d+),(\d+),(\d+),(\d+)$/u.exec(resolved.hash);
    resolved.hash = '';
    const src = safeMediaSrc(resolved.href, URLCtor);
    if (!src) return null;
    if (!sprite) return { src };
    const [x, y, width, height] = sprite.slice(1).map(Number);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width! <= 0 ||
      height! <= 0
    ) {
      return null;
    }
    return { src, x, y, width, height };
  } catch {
    return null;
  }
}

function parseThumbnailVtt(source: string, sourceUrl: string, URLCtor: typeof URL): ThumbnailCue[] {
  const cues: ThumbnailCue[] = [];
  const normalized = source.replace(/^\uFEFF/u, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  for (const block of normalized.split(/\n{2,}/u)) {
    if (cues.length >= MAX_THUMBNAIL_CUES) break;
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0 || !lines[timingIndex + 1]) continue;
    const match = /^(\S+)\s+-->\s+(\S+)/u.exec(lines[timingIndex]!);
    if (!match) continue;
    const start = parseVttTime(match[1]!);
    const end = parseVttTime(match[2]!);
    const thumbnail = parseThumbnailUrl(lines[timingIndex + 1]!, sourceUrl, URLCtor);
    if (start === null || end === null || end <= start || !thumbnail) continue;
    cues.push({ start, end, ...thumbnail });
  }
  return cues;
}

function textTracks(media: HTMLVideoElement | undefined): TextTrack[] {
  const result: TextTrack[] = [];
  if (!media) return result;
  for (let index = 0; index < media.textTracks.length; index += 1) {
    const track = media.textTracks[index];
    if (track) result.push(track);
  }
  return result;
}

function formatTime(seconds: number, locale: string): string {
  const total = Math.floor(finiteRange(seconds, 0, 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const regular = getNumberFormat(locale, { maximumFractionDigits: 0, useGrouping: false });
  const padded = getNumberFormat(locale, {
    maximumFractionDigits: 0,
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  if (hours > 0) {
    return `${regular.format(hours)}:${padded.format(minutes)}:${padded.format(remaining)}`;
  }
  return `${regular.format(minutes)}:${padded.format(remaining)}`;
}

function unsupportedPromise(message: string): Promise<never> {
  return Promise.reject(new DOMException(message, 'NotSupportedError'));
}

/**
 * `<lr-video>` — a native, inline video player with three custom-control presets, selectable
 * captions, fullscreen and picture-in-picture capability gates, and bounded WebVTT thumbnail
 * previews. Its elapsed-time timeline stays on a physical left-to-right axis in either text
 * direction, so native ArrowRight advances and ArrowLeft rewinds. Mirrors the public `<wa-video>`
 * surface under the `lr-` prefix.
 *
 * @customElement lr-video
 * @slot - Native `<source>` and `<track>` children. Consumer nodes remain in light DOM; safe
 *   allowlisted clones are inserted into the private native video.
 * @slot controls-after-play - Content immediately after the play/pause control.
 * @slot controls-start - Content at the start of the control bar.
 * @slot exit-fullscreen-icon - Decorative fullscreen-exit glyph override. Assigned content is
 *   rendered inert and accessibility-hidden beside, never inside, the named native button.
 * @slot fullscreen-icon - Decorative fullscreen-enter glyph override; rendered through the same
 *   inert sibling layer.
 * @slot mute-icon - Decorative muted-state glyph override; rendered through the same inert sibling layer.
 * @slot pause-icon - Decorative pause glyph override; rendered through the same inert sibling layer.
 * @slot play-icon - Decorative play glyph override; rendered through the same inert sibling layer.
 * @slot poster-icon - Decorative poster-play glyph override; rendered through the same inert sibling layer.
 * @slot volume-icon - Decorative audible-state glyph override; rendered through the same inert sibling layer.
 * @event {Event} ended - Relayed native video event; non-bubbling, non-composed, and non-cancelable.
 * @event {Event} error - Relayed native video event; non-bubbling, non-composed, and non-cancelable.
 * @event {Event} loadedmetadata - Relayed native video event; non-bubbling, non-composed, and non-cancelable.
 * @event {Event} pause - Relayed native video event; non-bubbling, non-composed, and non-cancelable.
 * @event {Event} play - Relayed native video event; non-bubbling, non-composed, and non-cancelable.
 * @event {Event} timeupdate - Relayed native video event; non-bubbling, non-composed, and
 *   non-cancelable. Scrubbing the
 *   custom timeline also dispatches this event immediately.
 * @event {Event} volumechange - Relayed native video event; non-bubbling, non-composed, and
 *   non-cancelable.
 * @event focus - Re-dispatched from the internal play/pause control as a bubbling, composed event.
 * @event blur - Re-dispatched from the internal play/pause control as a bubbling, composed event.
 * @csspart base - Alias on the same root node as `video-wrapper`.
 * @csspart caption - Active native caption text.
 * @csspart caption-overlay - Caption positioning layer.
 * @csspart controls - Custom control bar.
 * @csspart controls-overlay - Bottom controls positioning layer.
 * @csspart poster-overlay - Poster positioning layer.
 * @csspart poster-play-button - Poster play action.
 * @csspart progress - Native range input used to scrub.
 * @csspart thumbnail - Active WebVTT thumbnail preview.
 * @csspart timeline - Timeline wrapper.
 * @csspart timeline-indicator - Played portion of the timeline.
 * @csspart timeline-thumb - Current-time marker.
 * @csspart timeline-track - Timeline rail.
 * @csspart video - Native `<video>` element.
 * @csspart video-title-overlay - Title positioning layer.
 * @csspart video-wrapper - Alias on the same root node as `base`.
 * @cssprop [--controls-background=var(--lr-color-overlay-strong)] - Controls, captions, and title
 *   overlay background.
 * @cssprop [--controls-color=var(--lr-color-text)] - Custom-control foreground color.
 * @cssprop [--poster-play-button-background=var(--lr-color-surface-overlay)] - Poster play-button
 *   background.
 * @cssprop [--lr-video-poster-play-button-hover-background=color-mix(...)] - Poster play-button
 *   hover background.
 * @cssprop [--lr-video-poster-play-button-hover-border-color=var(--lr-color-brand)] - Poster
 *   play-button hover border color.
 * @status experimental
 * @since 8.0.0
 */
export class LyraVideo extends LyraElement<LyraVideoEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    avPlayerPosition: LYRA_DEFAULT_avPlayerPosition,
    pause: LYRA_DEFAULT_pause,
    play: LYRA_DEFAULT_play,
    playbackPosition: LYRA_DEFAULT_playbackPosition,
    videoCaptions: LYRA_DEFAULT_videoCaptions,
    videoCaptionsOff: LYRA_DEFAULT_videoCaptionsOff,
    videoEnterFullscreen: LYRA_DEFAULT_videoEnterFullscreen,
    videoExitFullscreen: LYRA_DEFAULT_videoExitFullscreen,
    videoExitPictureInPicture: LYRA_DEFAULT_videoExitPictureInPicture,
    videoMute: LYRA_DEFAULT_videoMute,
    videoPictureInPicture: LYRA_DEFAULT_videoPictureInPicture,
    videoPlaybackSpeed: LYRA_DEFAULT_videoPlaybackSpeed,
    videoPlayerLabel: LYRA_DEFAULT_videoPlayerLabel,
    videoUnmute: LYRA_DEFAULT_videoUnmute,
    videoVolume: LYRA_DEFAULT_videoVolume,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override get observedAttributes(): string[] {
    // The pinned public manifest spells this attribute `currentTime`. HTML normalizes authored
    // attribute names to lowercase, while Lyra's earlier kebab-case spelling remains supported as
    // a compatibility alias. Lit still owns every other observed attribute normally.
    return [...new Set([...super.observedAttributes, 'currenttime', 'current-time'])];
  }

  /** Starts playback as soon as the browser's autoplay policy allows. */
  @property({ type: Boolean }) autoplay = false;
  /** Starts muted autoplay without changing the authored `muted` property. */
  @property({ type: Boolean, attribute: 'autoplay-muted' }) autoplayMuted = false;
  /** Pauses playing video outside the viewport and resumes only playback this behavior paused. */
  @property({ type: Boolean, attribute: 'autoplay-on-visible' }) autoplayOnVisible = false;
  /** Custom controls: none, standard, or standard plus rate and picture-in-picture. */
  @property({ reflect: true }) controls: LyraVideoControls = 'standard';
  /** Current playback position in seconds. Assignments are finite and clamped to duration. */
  @property({ type: Number, attribute: 'currentTime' }) currentTime = 0;
  /** Current finite media duration. Read-only in normal use. */
  @property({ type: Number }) duration = 0;
  /** Icon library handed to every control fallback `<lr-icon>`. */
  @property({ attribute: 'icon-library' }) iconLibrary = 'system';
  /** Restarts playback when the video reaches its end. */
  @property({ type: Boolean }) loop = false;
  /** Current authored mute state; reflected for state styling. */
  @property({ type: Boolean, reflect: true }) muted = false;
  /** Current playing state. Read-only in normal use. */
  @property({ type: Boolean, reflect: true }) playing = false;
  /** Poster URL. Executable schemes fail closed. */
  @property() poster = '';
  /** Native preload policy. */
  @property() preload: LyraVideoPreload = 'metadata';
  /** Direct video URL. Executable schemes fail closed. */
  @property() src = '';
  /** URL of a WebVTT thumbnail file. Reads are byte- and cue-capped. */
  @property() thumbnails = '';
  /** Video title and accessible-name context. */
  @property() override title = '';
  /** Audio volume from zero to one. */
  @property({ type: Number }) volume = 1;

  @state() private playbackRate = 1;
  @state() private posterVisible = true;
  @state() private captionText = '';
  @state() private captionTracks: CaptionTrack[] = [];
  @state() private fullscreen = false;
  @state() private pictureInPicture = false;
  @state() private thumbnailCues: ThumbnailCue[] = [];
  @state() private activeThumbnail?: ThumbnailCue;
  @state() private thumbnailPosition = 50;

  @query('[part~="video-wrapper"]') private wrapperEl?: HTMLElement;

  private readonly mediaController = new NativeMediaController(this, {
    onEvent: (event) => this.onNativeMediaEvent(event),
  });
  private thumbnailGeneration = 0;
  private thumbnailAbort?: AbortController;
  private intersectionObserver?: IntersectionObserver;
  private visibilityPaused = false;
  private captionListeners: Array<{ track: TextTrack; listener: EventListener }> = [];
  private lastSourceSignature?: string;

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'currenttime' || name === 'current-time') {
      if (oldValue !== newValue) this.currentTime = finiteRange(Number(newValue ?? 0), 0, 0);
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  private get videoEl(): HTMLVideoElement | undefined {
    const media = this.mediaController.element;
    return media?.localName === 'video' ? media as HTMLVideoElement : undefined;
  }

  /** The play/pause control: this component's primary interactive affordance, and the target the
   *  host's own focus/blur/click forward to. Absent while `controls="none"`. */
  private get playControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('[data-control="play"]');
  }

  /** Focus the play/pause control. A `controls="none"` player renders none, so this is a no-op
   *  there — the bare host has no focusable area of its own. */
  override focus(options?: FocusOptions): void {
    this.playControl?.focus(options);
  }

  /** Blur the play/pause control. */
  override blur(): void {
    this.playControl?.blur();
  }

  /** Activate the play/pause control, so a host-level `.click()` is not a silent no-op. */
  override click(): void {
    this.playControl?.click();
  }

  private onControlFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('focus');
  };

  private onControlBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('blur');
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.mediaController.reconnect();
    this.ownerDocument.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.ownerDocument.addEventListener('enterpictureinpicture', this.onPictureInPictureChange, true);
    this.ownerDocument.addEventListener('leavepictureinpicture', this.onPictureInPictureChange, true);
    if (this.hasUpdated) {
      this.scheduleAfterUpdate(() => this.bindCaptionTracks(), 'video-caption-reconnect');
      this.scheduleAfterUpdate(() => this.configureVisibilityObserver(), 'video-visibility-reconnect');
      if (this.thumbnails) {
        this.scheduleAfterUpdate(() => void this.loadThumbnails(), 'video-thumbnails-reconnect');
      }
    }
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.syncSources();
    this.configureVisibilityObserver();
    void this.loadThumbnails();
  }

  override disconnectedCallback(): void {
    this.mediaController.disconnect();
    this.thumbnailGeneration += 1;
    this.thumbnailAbort?.abort();
    this.thumbnailAbort = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.visibilityPaused = false;
    this.unbindCaptionTracks();
    if (this.captionTracks.length) this.captionTracks = [];
    if (this.captionText) this.captionText = '';
    if (this.activeThumbnail) this.activeThumbnail = undefined;
    if (this.playing) this.playing = false;
    if (this.fullscreen) this.fullscreen = false;
    if (this.pictureInPicture) this.pictureInPicture = false;
    this.ownerDocument.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.ownerDocument.removeEventListener('enterpictureinpicture', this.onPictureInPictureChange, true);
    this.ownerDocument.removeEventListener('leavepictureinpicture', this.onPictureInPictureChange, true);
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('controls')) this.controls = safeControls(this.controls);
    if (changed.has('preload')) this.preload = safePreload(this.preload);

    if (changed.has('volume')) {
      const next = finiteRange(this.volume, this.mediaController.volume, 0, 1);
      if (!Object.is(next, this.volume)) this.volume = next;
      this.mediaController.volume = next;
    }

    if (changed.has('muted')) this.mediaController.muted = this.muted;
    if (changed.has('autoplayMuted') && this.autoplayMuted) this.mediaController.muted = true;

    if (changed.has('currentTime')) {
      const max = this.mediaController.duration > 0
        ? this.mediaController.duration
        : Number.POSITIVE_INFINITY;
      const next = finiteRange(this.currentTime, 0, 0, max);
      if (!Object.is(next, this.currentTime)) this.currentTime = next;
      this.mediaController.currentTime = next;
    }

    if (changed.has('duration')) {
      const next = finiteRange(this.duration, 0, 0);
      if (!Object.is(next, this.duration)) this.duration = next;
    }

    if (changed.has('src')) {
      this.visibilityPaused = false;
      this.posterVisible = true;
      if (this.hasUpdated) {
        this.playing = false;
        this.duration = 0;
        this.currentTime = 0;
        this.scheduleAfterUpdate(() => this.syncSources(), 'video-sources');
      }
    }
    if (changed.has('thumbnails') && this.hasUpdated) {
      this.scheduleAfterUpdate(() => void this.loadThumbnails(), 'video-thumbnails');
    }
    if (changed.has('autoplayOnVisible') && this.hasUpdated) {
      this.scheduleAfterUpdate(() => this.configureVisibilityObserver(), 'video-visibility');
    }
  }

  private mediaRef = (element?: Element): void => {
    const video = element?.localName === 'video' ? element as HTMLVideoElement : undefined;
    this.mediaController.attach(video);
    if (!video) return;
    this.mediaController.volume = finiteRange(this.volume, 1, 0, 1);
    this.mediaController.muted = this.muted || this.autoplayMuted;
    this.mediaController.playbackRate = this.playbackRate;
  };

  private sourceSignature(): string {
    const nodes = [...this.children]
      .filter((child) => child.localName === 'source' || child.localName === 'track')
      .map((child) => ({
        tag: child.localName,
        src: child.getAttribute('src'),
        type: child.getAttribute('type'),
        media: child.getAttribute('media'),
        kind: child.getAttribute('kind'),
        srclang: child.getAttribute('srclang'),
        label: child.getAttribute('label'),
        default: child.hasAttribute('default'),
      }));
    return JSON.stringify({ src: this.src, nodes });
  }

  private syncSources(force = false): void {
    if (!this.videoEl) return;
    const signature = this.sourceSignature();
    if (!force && signature === this.lastSourceSignature) return;
    this.lastSourceSignature = signature;
    this.visibilityPaused = false;
    this.unbindCaptionTracks();
    if (this.captionTracks.length) this.captionTracks = [];
    if (this.captionText) this.captionText = '';
    this.mediaController.setSources({ src: this.src, nodes: this.children });
    // `setSources()` intentionally starts a fresh generation; restore an authored pre-mount seek
    // as a pending currentTime so metadata can clamp/apply it instead of dropping it.
    this.mediaController.currentTime = this.currentTime;
  }

  private onSourceSlotChange = (): void => this.syncSources();

  /** Returns the private native `<video>`, or undefined before the first render. */
  getVideoElement(): HTMLVideoElement | undefined {
    return this.videoEl;
  }

  /** Returns a fresh synchronous snapshot of the six documented live playback fields. */
  getState(): VideoState {
    const video = this.videoEl;
    return {
      playing: Boolean(video && !video.paused && !video.ended),
      currentTime: this.mediaController.currentTime,
      duration: this.mediaController.duration,
      volume: this.mediaController.volume,
      muted: this.mediaController.muted,
      playbackRate: this.mediaController.playbackRate,
    };
  }

  /** Preserves the exact native `play()` promise and rejection. */
  play(): Promise<void> {
    return this.mediaController.play();
  }

  /** Pauses the private native video. */
  pause(): void {
    this.visibilityPaused = false;
    this.mediaController.pause();
  }

  /** Restarts native resource selection and invalidates old native event listeners. */
  load(): void {
    this.visibilityPaused = false;
    this.currentTime = 0;
    this.syncSources(true);
  }

  /** Seeks to a finite time, clamped to the known duration. */
  seek(time: number): void {
    const max = this.mediaController.duration > 0
      ? this.mediaController.duration
      : Number.POSITIVE_INFINITY;
    const next = finiteRange(time, 0, 0, max);
    this.mediaController.currentTime = next;
    this.currentTime = this.mediaController.currentTime;
    const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
    this.dispatchEvent(new EventConstructor('timeupdate'));
  }

  /** Sets a finite native playback-rate multiplier. */
  setPlaybackRate(rate: number): void {
    const next = finiteRange(rate, 1, MIN_NATIVE_PLAYBACK_RATE, MAX_NATIVE_PLAYBACK_RATE);
    this.playbackRate = next;
    this.mediaController.playbackRate = next;
  }

  /** Sets finite volume in the inclusive zero-to-one range. */
  setVolume(volume: number): void {
    const next = finiteRange(volume, this.mediaController.volume, 0, 1);
    this.volume = next;
    this.mediaController.volume = next;
  }

  /** Toggles the live native muted state. */
  toggleMute(): void {
    const next = !this.mediaController.muted;
    this.muted = next;
    this.mediaController.muted = next;
  }

  /** Plays when paused and pauses when playing. */
  togglePlay(): void {
    if (this.videoEl?.paused ?? true) void this.play().catch(() => undefined);
    else this.pause();
  }

  /** Requests fullscreen for the wrapper so custom overlays remain visible. */
  override requestFullscreen(): Promise<void> {
    if (!canRequestFullscreen(this.wrapperEl)) {
      return unsupportedPromise('Fullscreen is unavailable for this video.');
    }
    return this.wrapperEl!.requestFullscreen();
  }

  /** Exits document fullscreen and preserves the platform promise/rejection. */
  exitFullscreen(): Promise<void> {
    if (!canExitFullscreen(this.ownerDocument)) {
      return unsupportedPromise('Fullscreen exit is unavailable for this video.');
    }
    return this.ownerDocument.exitFullscreen();
  }

  private onNativeMediaEvent(event: Event): void {
    const video = this.videoEl;
    if (!video) return;
    switch (event.type) {
      case 'loadedmetadata':
      case 'durationchange':
        this.duration = this.mediaController.duration;
        this.currentTime = this.mediaController.currentTime;
        this.bindCaptionTracks();
        break;
      case 'play':
        this.playing = true;
        this.posterVisible = false;
        break;
      case 'pause':
      case 'ended':
        this.playing = false;
        break;
      case 'timeupdate':
      case 'seeked':
        this.currentTime = this.mediaController.currentTime;
        break;
      case 'volumechange':
        this.volume = this.mediaController.volume;
        this.muted = this.mediaController.muted;
        break;
      case 'ratechange':
        this.playbackRate = this.mediaController.playbackRate;
        break;
    }
  }

  private onTimelineInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.seek(Number(input.value));
  };

  private onVolumeInput = (event: Event): void => {
    this.setVolume(Number((event.currentTarget as HTMLInputElement).value));
  };

  private onRateChange = (event: Event): void => {
    this.setPlaybackRate(Number((event.currentTarget as HTMLSelectElement).value));
  };

  private onPosterPlay = (): void => {
    void this.play().catch(() => undefined);
  };

  private onFullscreenButton = (): void => {
    const operation = this.fullscreen ? this.exitFullscreen() : this.requestFullscreen();
    void operation.catch(() => undefined);
  };

  private onFullscreenChange = (): void => {
    this.fullscreen = this.ownerDocument.fullscreenElement === this.wrapperEl;
  };

  private onPictureInPictureChange = (): void => {
    const documentRef = this.ownerDocument as Document & { pictureInPictureElement?: Element | null };
    this.pictureInPicture = documentRef.pictureInPictureElement === this.videoEl;
  };

  private togglePictureInPicture = (): void => {
    const video = this.videoEl;
    const documentRef = this.ownerDocument as Document & {
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
    };
    if (!video || !canRequestPictureInPicture(video)) return;
    const promise = documentRef.pictureInPictureElement === video
      ? documentRef.exitPictureInPicture?.()
      : video.requestPictureInPicture().then(() => undefined);
    void promise?.catch(() => undefined);
  };

  private pauseForVisibility(): void {
    this.visibilityPaused = true;
    this.mediaController.pause();
  }

  private configureVisibilityObserver(): void {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.visibilityPaused = false;
    const ownerWindow = this.ownerDocument.defaultView;
    const IntersectionObserverCtor = ownerWindow?.IntersectionObserver;
    if (!this.autoplayOnVisible || !IntersectionObserverCtor) return;
    let observer: IntersectionObserver | undefined;
    observer = new IntersectionObserverCtor((entries) => {
      if (
        !observer ||
        !this.isConnected ||
        this.intersectionObserver !== observer ||
        this.ownerDocument.defaultView !== ownerWindow
      ) {
        return;
      }
      const visible = entries[0]?.isIntersecting ?? true;
      const video = this.videoEl;
      if (!video) return;
      if (!visible) {
        if (!video.paused) {
          this.pauseForVisibility();
        }
        return;
      }
      if (this.visibilityPaused) {
        this.visibilityPaused = false;
        void this.mediaController.play().catch(() => undefined);
      }
    });
    this.intersectionObserver = observer;
    observer.observe(this);
  }

  private unbindCaptionTracks(): void {
    for (const { track, listener } of this.captionListeners) {
      track.removeEventListener('cuechange', listener);
    }
    this.captionListeners = [];
  }

  private bindCaptionTracks(): void {
    this.unbindCaptionTracks();
    const selectable = textTracks(this.videoEl).filter(
      (track) => track.kind === 'captions' || track.kind === 'subtitles',
    );
    this.captionTracks = selectable.map((track) => ({
      track,
      label: track.label || track.language || this.localize('videoCaptions'),
      language: track.language,
    }));
    for (const track of selectable) {
      const listener = (): void => this.syncActiveCaption();
      track.addEventListener('cuechange', listener);
      this.captionListeners.push({ track, listener });
    }
    this.syncActiveCaption();
  }

  private syncActiveCaption(): void {
    const lines: string[] = [];
    for (const { track } of this.captionTracks) {
      if (track.mode !== 'showing' || !track.activeCues) continue;
      for (let index = 0; index < track.activeCues.length; index += 1) {
        const cue = track.activeCues[index] as VTTCue | undefined;
        if (cue && typeof cue.text === 'string') lines.push(cue.text);
      }
    }
    this.captionText = lines.join('\n');
  }

  private onCaptionChange = (event: Event): void => {
    const selected = Number((event.currentTarget as HTMLSelectElement).value);
    this.captionTracks.forEach(({ track }, index) => {
      track.mode = index === selected ? 'showing' : 'disabled';
    });
    this.syncActiveCaption();
  };

  private async loadThumbnails(): Promise<void> {
    const generation = ++this.thumbnailGeneration;
    this.thumbnailAbort?.abort();
    this.thumbnailAbort = undefined;
    if (this.thumbnailCues.length) this.thumbnailCues = [];
    if (this.activeThumbnail) this.activeThumbnail = undefined;
    const fetchTarget = resolveOwnerFetchTarget(this, this.thumbnails);
    const AbortControllerCtor = fetchTarget?.view.AbortController;
    if (!fetchTarget || !AbortControllerCtor) return;
    const controller = new AbortControllerCtor();
    this.thumbnailAbort = controller;
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, { signal: controller.signal });
      if (
        generation !== this.thumbnailGeneration ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== fetchTarget.view
      ) return;
      if (!response.ok) return;
      const text = await readResponseText(response, MAX_THUMBNAIL_BYTES);
      if (
        generation !== this.thumbnailGeneration ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== fetchTarget.view
      ) return;
      this.thumbnailCues = parseThumbnailVtt(text, fetchTarget.url, fetchTarget.view.URL);
    } catch {
      if (generation !== this.thumbnailGeneration || !this.isConnected) return;
      this.thumbnailCues = [];
      this.activeThumbnail = undefined;
    } finally {
      if (generation === this.thumbnailGeneration) this.thumbnailAbort = undefined;
    }
  }

  private onTimelinePointerMove = (event: PointerEvent): void => {
    const timeline = event.currentTarget as HTMLElement;
    const rect = timeline.getBoundingClientRect();
    if (rect.width <= 0 || this.duration <= 0) {
      this.activeThumbnail = undefined;
      return;
    }
    const ratio = finiteRange((event.clientX - rect.left) / rect.width, 0, 0, 1);
    const time = ratio * this.duration;
    this.activeThumbnail = this.thumbnailCues.find((cue) => time >= cue.start && time < cue.end);
    this.thumbnailPosition = ratio * 100;
  };

  private onTimelinePointerLeave = (): void => {
    this.activeThumbnail = undefined;
  };

  private renderIcon(name: string, path: string): TemplateResult {
    return html`<lr-icon library=${this.iconLibrary} name=${name} aria-hidden="true">
      <path d=${path}></path>
    </lr-icon>`;
  }

  /** Keeps consumer glyph markup out of the real button's flat-tree descendants. An author may
   * accidentally provide a link, button, or other focusable node for an icon slot; the visual
   * layer remains decorative and inert while the adjacent native button owns the sole action. */
  private renderDecorativeIconLayer(content: TemplateResult): TemplateResult {
    return html`<span class="control-icon-layer" aria-hidden="true" inert>${content}</span>`;
  }

  private renderPlaySlots(): TemplateResult {
    return html`
      <slot name="play-icon" ?hidden=${this.playing}>
        ${this.renderIcon('video-play', 'M8 5v14l11-7Z')}
      </slot>
      <slot name="pause-icon" ?hidden=${!this.playing}>
        ${this.renderIcon('video-pause', 'M8 5h3v14H8zM15 5h3v14h-3z')}
      </slot>
    `;
  }

  private renderVolumeSlots(): TemplateResult {
    const silent = this.mediaController.muted || this.mediaController.volume === 0;
    return html`
      <slot name="volume-icon" ?hidden=${silent}>
        ${this.renderIcon('video-volume', 'M4 10v4h4l5 4V6L8 10Zm12-1a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12')}
      </slot>
      <slot name="mute-icon" ?hidden=${!silent}>
        ${this.renderIcon('video-mute', 'M4 10v4h4l5 4V6L8 10Zm12 0 5 5m0-5-5 5')}
      </slot>
    `;
  }

  private renderFullscreenSlots(): TemplateResult {
    return html`
      <slot name="fullscreen-icon" ?hidden=${this.fullscreen}>
        ${this.renderIcon('video-fullscreen', 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5')}
      </slot>
      <slot name="exit-fullscreen-icon" ?hidden=${!this.fullscreen}>
        ${this.renderIcon('video-exit-fullscreen', 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5')}
      </slot>
    `;
  }

  private renderThumbnail(): TemplateResult | typeof nothing {
    const cue = this.activeThumbnail;
    if (!cue) return nothing;
    const crop = cue.width !== undefined && cue.height !== undefined;
    const frameStyle = crop
      ? { width: `${cue.width}px`, height: `${cue.height}px` }
      : {};
    const imageStyle = crop
      ? { transform: `translate(${-cue.x!}px, ${-cue.y!}px)` }
      : {};
    return html`
      <div
        part="thumbnail"
        aria-hidden="true"
        style=${styleMap({ 'inset-inline-start': `${this.thumbnailPosition}%` })}
      >
        <div style=${styleMap(frameStyle)}>
          <img src=${cue.src} alt="" style=${styleMap(imageStyle)}>
        </div>
      </div>
    `;
  }

  private renderControls(): TemplateResult | typeof nothing {
    if (this.controls === 'none') return nothing;
    // The first render happens before ref/query directives populate their targets. Gate the
    // affordances from the same platform capabilities as the public methods, then have the methods
    // re-check the concrete target before invoking it.
    const canFullscreen =
      typeof HTMLElement.prototype.requestFullscreen === 'function' &&
      this.ownerDocument.fullscreenEnabled !== false;
    const documentRef = this.ownerDocument as Document & { pictureInPictureEnabled?: boolean };
    const canPip =
      this.controls === 'full' &&
      typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function' &&
      documentRef.pictureInPictureEnabled !== false;
    const max = this.duration > 0 ? this.duration : 0;
    const progress = max > 0 ? finiteRange((this.currentTime / max) * 100, 0, 0, 100) : 0;
    return html`
      <div part="controls-overlay">
        <div part="controls">
          <slot name="controls-start"></slot>
          <span class="icon-button-stack">
            <button
              type="button"
              data-control="play"
              aria-label=${this.localize(this.playing ? 'pause' : 'play')}
              @click=${this.togglePlay}
              @focus=${this.onControlFocus}
              @blur=${this.onControlBlur}
            ></button>
            ${this.renderDecorativeIconLayer(this.renderPlaySlots())}
          </span>
          <slot name="controls-after-play"></slot>
          <div
            part="timeline"
            @pointermove=${this.onTimelinePointerMove}
            @pointerleave=${this.onTimelinePointerLeave}
          >
            <input
              part="progress"
              type="range"
              min="0"
              max=${String(max)}
              step="any"
              .value=${String(this.currentTime)}
              aria-label=${this.localize('playbackPosition')}
              aria-valuetext=${this.localize('avPlayerPosition', undefined, {
                current: formatTime(this.currentTime, this.effectiveLocale),
                duration: formatTime(this.duration, this.effectiveLocale),
              })}
              @input=${this.onTimelineInput}
            >
            <span part="timeline-track">
              <span part="timeline-indicator" style=${styleMap({ 'inline-size': `${progress}%` })}></span>
            </span>
            <span part="timeline-thumb" style=${styleMap({ 'inset-inline-start': `${progress}%` })}></span>
            ${this.renderThumbnail()}
          </div>
          <span data-time>${formatTime(this.currentTime, this.effectiveLocale)}</span>
          <span aria-hidden="true">/</span>
          <span data-time>${formatTime(this.duration, this.effectiveLocale)}</span>
          <span class="icon-button-stack">
            <button
              type="button"
              data-control="mute"
              aria-label=${this.localize(this.mediaController.muted ? 'videoUnmute' : 'videoMute')}
              @click=${this.toggleMute}
            ></button>
            ${this.renderDecorativeIconLayer(this.renderVolumeSlots())}
          </span>
          <input
            data-control="volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            .value=${String(this.volume)}
            aria-label=${this.localize('videoVolume')}
            @input=${this.onVolumeInput}
          >
          ${this.captionTracks.length
            ? html`<span class="select-control">
                <select
                  data-control="captions"
                  aria-label=${this.localize('videoCaptions')}
                  @change=${this.onCaptionChange}
                >
                  <option value="-1">${this.localize('videoCaptionsOff')}</option>
                  ${this.captionTracks.map(({ track, label, language }, index) => html`
                    <option
                      value=${String(index)}
                      lang=${language || nothing}
                      ?selected=${track.mode === 'showing'}
                    >${label}</option>
                  `)}
                </select>
                <lr-icon class="select-control-icon" library=${this.iconLibrary} name="chevron-down" aria-hidden="true">
                  <path d="m7 10 5 5 5-5"></path>
                </lr-icon>
              </span>`
            : nothing}
          ${this.controls === 'full'
            ? html`<span class="select-control">
                <select
                  data-control="rate"
                  aria-label=${this.localize('videoPlaybackSpeed')}
                  @change=${this.onRateChange}
                >
                  ${PLAYBACK_RATES.map((rate) => html`
                    <option value=${String(rate)} ?selected=${rate === this.playbackRate}>
                      ${getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 2 }).format(rate)}×
                    </option>
                  `)}
                </select>
                <lr-icon class="select-control-icon" library=${this.iconLibrary} name="chevron-down" aria-hidden="true">
                  <path d="m7 10 5 5 5-5"></path>
                </lr-icon>
              </span>`
            : nothing}
          ${canPip
            ? html`<button
                type="button"
                data-control="picture-in-picture"
                aria-label=${this.localize(
                  this.pictureInPicture ? 'videoExitPictureInPicture' : 'videoPictureInPicture',
                )}
                @click=${this.togglePictureInPicture}
              >${this.renderIcon('video-picture-in-picture', 'M3 5h18v14H3Zm10 6h6v5h-6z')}</button>`
            : nothing}
          ${canFullscreen
            ? html`<span class="icon-button-stack">
                <button
                  type="button"
                  data-control="fullscreen"
                  aria-label=${this.localize(
                    this.fullscreen ? 'videoExitFullscreen' : 'videoEnterFullscreen',
                  )}
                  @click=${this.onFullscreenButton}
                ></button>
                ${this.renderDecorativeIconLayer(this.renderFullscreenSlots())}
              </span>`
            : nothing}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const safePoster = safeNativeMediaSource(this.poster);
    const label = this.getAttribute('aria-label') || this.title || this.localize('videoPlayerLabel');
    return html`
      <div part="base video-wrapper">
        <video
          ${ref(this.mediaRef)}
          part="video"
          playsinline
          ?autoplay=${this.autoplay || this.autoplayMuted}
          ?loop=${this.loop}
          .muted=${this.mediaController.muted}
          .volume=${finiteRange(this.volume, 1, 0, 1)}
          preload=${safePreload(this.preload)}
          poster=${safePoster ?? nothing}
          aria-label=${label}
        ></video>
        ${safePoster && this.posterVisible
          ? html`<div part="poster-overlay">
              <img src=${safePoster} alt="">
              <span class="icon-button-stack">
                <button
                  part="poster-play-button"
                  type="button"
                  aria-label=${this.localize('play')}
                  @click=${this.onPosterPlay}
                ></button>
                ${this.renderDecorativeIconLayer(html`
                  <slot name="poster-icon">${this.renderIcon('video-poster-play', 'M8 5v14l11-7Z')}</slot>
                `)}
              </span>
            </div>`
          : nothing}
        ${this.title ? html`<div part="video-title-overlay">${this.title}</div>` : nothing}
        ${this.captionText
          ? html`<div part="caption-overlay"><div part="caption">${this.captionText}</div></div>`
          : nothing}
        ${this.renderControls()}
        <span hidden><slot @slotchange=${this.onSourceSlotChange}></slot></span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-video': LyraVideo;
  }
}
