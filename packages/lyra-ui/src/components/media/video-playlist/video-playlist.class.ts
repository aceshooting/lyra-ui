import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  MAX_NATIVE_PLAYBACK_RATE,
  MIN_NATIVE_PLAYBACK_RATE,
  type NativeMediaPreferences,
  type NativeTextTrackPreference,
} from '../../../internal/media-controller.js';
import { finiteRange } from '../../../internal/numbers.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { tag } from '../../../internal/prefix.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import type { LyraVideo, LyraVideoControls } from '../video/video.js';
import { styles } from './video-playlist.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_videoPlaylistLabel, LYRA_DEFAULT_videoPlaylistUntitled } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraVideoPlaylistRepeat = 'none' | 'one' | 'all';

export interface LyraVideoPlaylistSource {
  readonly src: string;
  readonly type: string;
  readonly media: string;
}

export interface LyraVideoPlaylistTrack {
  readonly src: string;
  readonly kind: string;
  readonly srclang: string;
  readonly label: string;
  readonly default: boolean;
}

export interface LyraVideoPlaylistVideo {
  readonly title: string;
  readonly poster: string;
  readonly sources: readonly LyraVideoPlaylistSource[];
  readonly tracks: readonly LyraVideoPlaylistTrack[];
}

/**
 * Deterministic metadata for one first-render playlist row. Its index must match the corresponding
 * direct `<lr-video>` child; live child state becomes authoritative as soon as it is observable.
 */
export interface LyraVideoPlaylistItem {
  readonly title: string;
  readonly poster?: string;
  readonly duration?: number;
  /** Mirrors the corresponding child video's native `inert` state. */
  readonly unavailable?: boolean;
}

export interface LyraVideoPlaylistChangeDetail {
  readonly previousIndex: number;
  readonly currentIndex: number;
  readonly video: LyraVideoPlaylistVideo;
}

export interface LyraVideoPlaylistEventMap {
  'lr-video-change': CustomEvent<LyraVideoPlaylistChangeDetail>;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<undefined>;
  'lr-focus': CustomEvent<undefined>;
}

interface VideoListeners {
  ended: EventListener;
  error: EventListener;
  loadedmetadata: EventListener;
  pause: EventListener;
  play: EventListener;
}

function safeControls(value: unknown): LyraVideoControls {
  return value === 'none' || value === 'standard' ? value : 'full';
}

function safeRepeat(value: unknown): LyraVideoPlaylistRepeat {
  return value === 'one' || value === 'all' ? value : 'none';
}

function sameVideos(left: readonly LyraVideo[], right: readonly LyraVideo[]): boolean {
  return left.length === right.length && left.every((video, index) => video === right[index]);
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

function isSelectableTrack(track: TextTrack): boolean {
  return track.kind === 'subtitles' || track.kind === 'captions' || track.kind === 'descriptions';
}

function validVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validPlaybackRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_NATIVE_PLAYBACK_RATE &&
    value <= MAX_NATIVE_PLAYBACK_RATE
  );
}

function formatDuration(seconds: number, locale: string): string {
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
  return hours > 0
    ? `${regular.format(hours)}:${padded.format(minutes)}:${padded.format(remaining)}`
    : `${regular.format(minutes)}:${padded.format(remaining)}`;
}

function frozenSource(src: string, type: string, media: string): LyraVideoPlaylistSource {
  return Object.freeze({ src, type, media });
}

function frozenTrack(
  src: string,
  kind: string,
  srclang: string,
  label: string,
  isDefault: boolean,
): LyraVideoPlaylistTrack {
  return Object.freeze({ src, kind, srclang, label, default: isDefault });
}

/**
 * `<lr-video-playlist>` — a direct-child `<lr-video>` playlist with a navigable current-item
 * list. It mirrors the public `<wa-video-playlist>` surface under the `lr-` prefix.
 *
 * Lyra additionally exposes `autoAdvance` and `repeat`. `autoAdvance` defaults to `true` to
 * preserve the mirrored ended behavior; `repeat="one"` restarts the current video and
 * `repeat="all"` wraps the final video to the first.
 * `items` can seed deterministic playlist-row metadata for server rendering. Seeded rows are
 * visible but disabled until the browser can adopt the indexed direct video children; live child
 * metadata is authoritative after that corrective update.
 *
 * A child marked `inert` is unavailable: it never becomes the active video,
 * `next()`/`previous()`/auto-advance step past it, and its playlist row renders `disabled` so the
 * roving `tabindex` can never strand focus on it. Only the child's *own* `inert` counts — a
 * playlist inerted wholesale by an open modal keeps playing. `<lr-video>` has no `disabled`
 * contract; use the native `inert` property to make a child unavailable.
 *
 * @customElement lr-video-playlist
 * @slot - Direct `<lr-video>` children. Other elements are not playlist items.
 * @event lr-video-change - Emitted when `goTo()`, `next()`, `previous()`, or automatic advancement
 *   selects a video. Detail is `{ previousIndex, currentIndex, video }`; `video` is a fresh frozen
 *   `{ title, poster, sources, tracks }` data snapshot and contains no live DOM nodes.
 * @event {FocusEvent} focus - Relayed once from a playlist row as a bubbling, composed native
 *   event.
 * @event {FocusEvent} blur - Relayed once from a playlist row as a bubbling, composed native
 *   event.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @csspart base - Deprecated alias on the same root node as `video-playlist`.
 * @csspart video-playlist - Root video-and-playlist layout.
 * @csspart playlist - Playlist sidebar container.
 * @csspart playlist-duration - Duration text within a playlist item.
 * @csspart playlist-item - An individual playlist item button.
 * @csspart playlist-thumbnail - Thumbnail within a playlist item.
 * @csspart playlist-title - Title text within a playlist item.
 * @cssprop [--lr-video-playlist-item-current-background=var(--lr-color-brand-fill-quiet)] - Current
 *   playlist-item background.
 * @cssprop [--lr-video-playlist-item-current-border-color=var(--lr-color-brand)] - Current
 *   playlist-item border color.
 * @status experimental
 * @since 8.0.0
 */
export class LyraVideoPlaylist extends LyraElement<LyraVideoPlaylistEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    videoPlaylistLabel: LYRA_DEFAULT_videoPlaylistLabel,
    videoPlaylistUntitled: LYRA_DEFAULT_videoPlaylistUntitled,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Controls preset forwarded to every direct child video. */
  @property({ reflect: true }) controls: LyraVideoControls = 'full';

  /** Icon library forwarded to every direct child video. */
  @property({ attribute: 'icon-library' }) iconLibrary = 'system';

  /** Whether an ended or failed current video advances automatically. Lyra extension. */
  @property({
    type: Boolean,
    attribute: 'auto-advance',
    converter: trueDefaultBooleanConverter,
  })
  autoAdvance = true;

  /** Automatic completion behavior: stop, repeat one, or wrap the full playlist. Lyra extension. */
  @property() repeat: LyraVideoPlaylistRepeat = 'none';

  /**
   * Initial row metadata for deterministic server rendering, indexed to the direct video children.
   * Assign the same value before the first server and browser render. Once live children can be
   * observed, their title/poster/duration/inert state replaces this seed.
   */
  @property({ attribute: false }) items: readonly LyraVideoPlaylistItem[] = [];

  @state() private playlistVideos: LyraVideo[] = [];
  @state() private liveChildrenReady = false;
  @state() private activeIndex = -1;
  @state() private rovingIndex = -1;

  private activeVideo?: LyraVideo;
  private mutationObserver?: MutationObserver;
  private readonly listeners = new Map<LyraVideo, VideoListeners>();
  private readonly lastKnownPlaying = new WeakMap<LyraVideo, boolean>();
  private readonly nativeVideos = new WeakMap<LyraVideo, HTMLVideoElement>();
  private readonly needsReload = new WeakSet<LyraVideo>();
  private preferences: NativeMediaPreferences = {};
  private activationGeneration = 0;
  private reconcileGeneration = 0;
  private pendingPlay?: { video: LyraVideo; generation: number };

  override connectedCallback(): void {
    super.connectedCallback();
    this.observeChildren();
    // A browser-only mount can derive its rows synchronously and never paint the seed. Hydration
    // must reproduce the server's deterministic `items` pass first, then adopt the live children
    // in a corrective update so Lit can reuse the server-rendered row nodes.
    if (this.hasUpdated) {
      this.scheduleAfterUpdate(() => this.reconcileChildren(), 'video-playlist-reconcile');
    } else {
      this.seedFirstRenderState(() => {
        if (this.directVideos().length > 0) this.reconcileChildren();
      });
    }
  }

  override disconnectedCallback(): void {
    this.activationGeneration += 1;
    this.reconcileGeneration += 1;
    this.pendingPlay = undefined;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    for (const video of this.playlistVideos) {
      this.unbindVideo(video);
      video.hidden = true;
      this.pauseAndUnload(video);
    }
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('controls')) this.controls = safeControls(this.controls);
    if (changed.has('repeat')) this.repeat = safeRepeat(this.repeat);
    if (changed.has('controls') || changed.has('iconLibrary')) {
      this.scheduleAfterUpdate(() => this.reconcileChildren(), 'video-playlist-reconcile');
    }
  }

  private observeChildren(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.mutationObserver = new MutationObserverCtor(() => {
      this.scheduleAfterUpdate(() => {
        this.reconcileChildren();
        this.requestUpdate();
      }, 'video-playlist-reconcile');
    });
    this.mutationObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'default',
        'inert',
        'kind',
        'label',
        'media',
        'poster',
        'src',
        'srclang',
        'title',
        'type',
      ],
    });
  }

  private directVideos(): LyraVideo[] {
    const videoTag = tag('video');
    return [...this.children].filter(
      (child): child is LyraVideo => child.localName === videoTag,
    );
  }

  /**
   * Whether `video` can be selected, played, and reached by the playlist's roving `tabindex`.
   *
   * An inert element refuses focus and pointer input, so a roving index that steps onto its row
   * leaves `focus()` a silent no-op and strands the user's arrow key. The row this component
   * renders for an inert video is itself `disabled`, so the two states can never disagree.
   *
   * Deliberately the child's **own** inert state, never an ancestor's. A playlist sitting in a
   * subtree an open modal has inerted is inert *as a whole*; treating every video as unavailable
   * there would drop the active video, pause it, and unload its media element for as long as the
   * dialog stayed open.
   */
  private isEnabled(video: LyraVideo): boolean {
    return !video.inert;
  }

  private nearestEnabledIndex(videos: readonly LyraVideo[], preferred: number): number {
    if (!videos.length) return -1;
    const start = Math.min(Math.max(preferred, 0), videos.length - 1);
    for (let index = start; index < videos.length; index += 1) {
      if (this.isEnabled(videos[index]!)) return index;
    }
    for (let index = start - 1; index >= 0; index -= 1) {
      if (this.isEnabled(videos[index]!)) return index;
    }
    return -1;
  }

  private reconcileChildren(): void {
    if (!this.isConnected) return;
    const previousVideos = this.playlistVideos;
    const previousActive = this.activeVideo;
    const previousIndex = this.activeIndex;
    const previousRoving = previousVideos[this.rovingIndex];
    // Read before the render that disables the outgoing row: once that row carries `disabled` the
    // platform has already blurred it, and there is no way left to tell "the user was on this row"
    // apart from "focus was never in the playlist at all".
    const rovingHadFocus =
      this.shadowRoot?.activeElement?.getAttribute('part') === 'playlist-item';
    const videos = this.directVideos();
    // Once any live child has been observed, it remains the source of truth even if all children
    // are later removed. This prevents stale first-render metadata from reappearing after removal.
    if (videos.length > 0 || this.liveChildrenReady) this.liveChildrenReady = true;

    let active = previousActive && videos.includes(previousActive) && this.isEnabled(previousActive)
      ? previousActive
      : undefined;
    let nextIndex = active ? videos.indexOf(active) : this.nearestEnabledIndex(videos, previousIndex);
    if (!active && nextIndex >= 0) active = videos[nextIndex];
    if (!active) nextIndex = -1;

    const activeChanged = active !== previousActive;
    const outgoingWasRemoved = Boolean(previousActive && !videos.includes(previousActive));
    const resumePlayback = activeChanged && previousActive
      ? outgoingWasRemoved
        ? this.lastKnownPlaying.get(previousActive) ?? previousActive.getState().playing
        : previousActive.getState().playing
      : false;
    const outgoingPreferences = activeChanged && previousActive
      ? outgoingWasRemoved
        ? this.capturePreferences(previousActive, this.nativeVideos.get(previousActive))
        : this.capturePreferences(previousActive)
      : undefined;

    for (const video of previousVideos) {
      if (!videos.includes(video)) {
        this.unbindVideo(video);
        this.pauseAndUnload(video);
      }
    }
    for (const video of videos) this.bindVideo(video);

    if (activeChanged && previousActive) {
      this.preferences = outgoingPreferences ?? {};
      if (!outgoingWasRemoved) this.pauseAndUnload(previousActive);
      this.activationGeneration += 1;
    } else if (activeChanged) {
      this.activationGeneration += 1;
    }

    this.activeVideo = active;
    this.activeIndex = nextIndex;
    if (!sameVideos(previousVideos, videos)) this.playlistVideos = videos;

    for (const video of videos) {
      if (video.controls !== this.controls) video.controls = this.controls;
      if (video.iconLibrary !== this.iconLibrary) video.iconLibrary = this.iconLibrary;
      const isActive = video === active;
      video.hidden = !isActive;
      if (!isActive) this.pauseAndUnload(video);
    }

    if (active) {
      if (activeChanged || this.needsReload.has(active)) {
        this.activateVideo(active, resumePlayback, this.activationGeneration);
      }
    } else {
      this.pendingPlay = undefined;
    }

    const keptRoving = previousRoving && videos.includes(previousRoving) && this.isEnabled(previousRoving)
      ? videos.indexOf(previousRoving)
      : -1;
    this.rovingIndex = keptRoving >= 0 ? keptRoving : nextIndex;
    // The row that held the roving tabindex just stopped being reachable (removed or made inert)
    // while the user was standing on it. Its button is about to render `disabled`, which
    // drops focus to `<body>` -- beyond reach of the list's own keydown handler, leaving the
    // playlist keyboard-dead. Hand focus to the row that replaced it instead.
    if (rovingHadFocus && keptRoving < 0 && this.rovingIndex >= 0) this.focusItem(this.rovingIndex);

    if (activeChanged && previousActive && active) {
      this.emitChange(previousIndex, nextIndex, active);
    }

    this.scheduleChildrenReady(videos);
  }

  private scheduleChildrenReady(videos: readonly LyraVideo[]): void {
    const reconcileGeneration = ++this.reconcileGeneration;
    void Promise.all(videos.map((video) => video.updateComplete)).then(() => {
      if (!this.isConnected || reconcileGeneration !== this.reconcileGeneration) return;
      for (const video of this.playlistVideos) this.rememberNativeVideo(video);
      for (const video of this.playlistVideos) {
        if (video !== this.activeVideo) this.pauseAndUnload(video);
      }
      const active = this.activeVideo;
      if (!active || !this.needsReload.has(active)) return;
      const shouldPlay = this.pendingPlay?.video === active &&
        this.pendingPlay.generation === this.activationGeneration;
      this.activateVideo(active, shouldPlay, this.activationGeneration);
    });
  }

  private bindVideo(video: LyraVideo): void {
    if (this.listeners.has(video)) return;
    const listeners: VideoListeners = {
      ended: () => {
        this.rememberNativeVideo(video);
        this.lastKnownPlaying.set(video, false);
        this.handleCompletion(video, 'ended');
      },
      error: () => {
        this.rememberNativeVideo(video);
        this.lastKnownPlaying.set(video, false);
        this.handleCompletion(video, 'error');
      },
      loadedmetadata: () => {
        this.rememberNativeVideo(video);
        this.handleLoadedMetadata(video);
      },
      pause: () => {
        this.rememberNativeVideo(video);
        this.lastKnownPlaying.set(video, false);
      },
      play: () => {
        this.rememberNativeVideo(video);
        this.lastKnownPlaying.set(video, true);
        if (video !== this.activeVideo) this.pauseAndUnload(video);
      },
    };
    this.lastKnownPlaying.set(video, video.getState().playing);
    this.rememberNativeVideo(video);
    this.listeners.set(video, listeners);
    video.addEventListener('ended', listeners.ended);
    video.addEventListener('error', listeners.error);
    video.addEventListener('loadedmetadata', listeners.loadedmetadata);
    video.addEventListener('pause', listeners.pause);
    video.addEventListener('play', listeners.play);
  }

  private unbindVideo(video: LyraVideo): void {
    const listeners = this.listeners.get(video);
    if (!listeners) return;
    video.removeEventListener('ended', listeners.ended);
    video.removeEventListener('error', listeners.error);
    video.removeEventListener('loadedmetadata', listeners.loadedmetadata);
    video.removeEventListener('pause', listeners.pause);
    video.removeEventListener('play', listeners.play);
    this.listeners.delete(video);
  }

  private rememberNativeVideo(video: LyraVideo): void {
    const native = video.getVideoElement();
    if (native) this.nativeVideos.set(video, native);
  }

  private pauseAndUnload(video: LyraVideo): void {
    video.pause();
    video.hidden = true;
    this.needsReload.add(video);
    const native = video.getVideoElement();
    if (!native) return;
    const mediaChildren = [...native.children].filter(
      (child) => child.localName === 'source' || child.localName === 'track',
    );
    if (!native.hasAttribute('src') && mediaChildren.length === 0) return;
    native.removeAttribute('src');
    for (const child of mediaChildren) child.remove();
    native.load();
  }

  private activateVideo(video: LyraVideo, shouldPlay: boolean, generation: number): void {
    video.hidden = false;
    if (!video.getVideoElement()) {
      this.needsReload.add(video);
      if (shouldPlay) this.pendingPlay = { video, generation };
      return;
    }
    this.rememberNativeVideo(video);
    video.load();
    this.needsReload.delete(video);
    this.applyPreferences(video, this.preferences);
    if (!shouldPlay) {
      if (this.pendingPlay?.video === video) this.pendingPlay = undefined;
      return;
    }
    this.pendingPlay = undefined;
    void video.play().catch(() => {
      // Playback rejection (for example, an autoplay policy) leaves the selected video paused.
      // The generation check deliberately prevents a superseded promise from touching its successor.
      if (generation !== this.activationGeneration || video !== this.activeVideo) return;
    });
  }

  private capturePreferences(
    video: LyraVideo,
    native: HTMLVideoElement | undefined = video.getVideoElement(),
  ): NativeMediaPreferences {
    const state = video.getState();
    const preferences: NativeMediaPreferences = {};
    if (validVolume(state.volume)) preferences.volume = state.volume;
    if (typeof state.muted === 'boolean') preferences.muted = state.muted;
    if (validPlaybackRate(state.playbackRate)) preferences.playbackRate = state.playbackRate;

    const tracks = textTracks(native);
    const showingIndex = tracks.findIndex((track) => isSelectableTrack(track) && track.mode === 'showing');
    if (showingIndex < 0) {
      preferences.textTrack = null;
    } else {
      const track = tracks[showingIndex]!;
      preferences.textTrack = {
        index: showingIndex,
        kind: track.kind,
        label: track.label,
        language: track.language,
      };
    }
    return preferences;
  }

  private applyPreferences(video: LyraVideo, preferences: Readonly<NativeMediaPreferences>): void {
    if (validVolume(preferences.volume)) video.setVolume(preferences.volume);
    if (validPlaybackRate(preferences.playbackRate)) video.setPlaybackRate(preferences.playbackRate);
    if (typeof preferences.muted === 'boolean' && video.getState().muted !== preferences.muted) {
      video.toggleMute();
    }
    this.applyTextTrackPreference(video.getVideoElement(), preferences.textTrack);
  }

  private applyTextTrackPreference(
    native: HTMLVideoElement | undefined,
    preference: NativeTextTrackPreference | null | undefined,
  ): void {
    if (!native || preference === undefined) return;
    const tracks = textTracks(native);
    if (preference === null) {
      for (const track of tracks) {
        if (isSelectableTrack(track)) track.mode = 'disabled';
      }
      return;
    }
    const exact = tracks.find(
      (track) =>
        track.kind === preference.kind &&
        track.label === preference.label &&
        track.language === preference.language,
    );
    const indexed = tracks[preference.index];
    const selected = exact ?? (indexed?.kind === preference.kind ? indexed : undefined);
    if (!selected) return;
    for (const track of tracks) {
      if (isSelectableTrack(track)) track.mode = track === selected ? 'showing' : 'disabled';
    }
  }

  private handleLoadedMetadata(video: LyraVideo): void {
    if (video !== this.activeVideo) return;
    this.applyPreferences(video, this.preferences);
    this.requestUpdate();
  }

  private handleCompletion(video: LyraVideo, reason: 'ended' | 'error'): void {
    if (video !== this.activeVideo || !this.autoAdvance) return;
    if (reason === 'ended' && this.repeat === 'one') {
      video.seek(0);
      const generation = this.activationGeneration;
      void video.play().catch(() => {
        if (generation !== this.activationGeneration || video !== this.activeVideo) return;
      });
      return;
    }
    const nextIndex = this.nearestEnabledIndex(this.playlistVideos, this.activeIndex + 1);
    if (nextIndex > this.activeIndex) {
      this.switchTo(nextIndex, true);
      return;
    }
    if (this.repeat === 'all') {
      const first = this.nearestEnabledIndex(this.playlistVideos, 0);
      if (first >= 0 && first !== this.activeIndex) {
        this.switchTo(first, true);
      } else if (reason === 'ended' && first === this.activeIndex) {
        video.seek(0);
        const generation = this.activationGeneration;
        void video.play().catch(() => {
          if (generation !== this.activationGeneration || video !== this.activeVideo) return;
        });
      }
    }
  }

  private snapshotVideo(video: LyraVideo): LyraVideoPlaylistVideo {
    const sources: LyraVideoPlaylistSource[] = [];
    const directSrc = video.src.trim();
    if (directSrc) sources.push(frozenSource(directSrc, '', ''));
    const tracks: LyraVideoPlaylistTrack[] = [];
    for (const child of video.children) {
      if (child.localName === 'source') {
        const src = child.getAttribute('src')?.trim() ?? '';
        if (src) {
          sources.push(frozenSource(
            src,
            child.getAttribute('type') ?? '',
            child.getAttribute('media') ?? '',
          ));
        }
      } else if (child.localName === 'track') {
        const src = child.getAttribute('src')?.trim() ?? '';
        if (src) {
          tracks.push(frozenTrack(
            src,
            child.getAttribute('kind') ?? '',
            child.getAttribute('srclang') ?? '',
            child.getAttribute('label') ?? '',
            child.hasAttribute('default'),
          ));
        }
      }
    }
    return Object.freeze({
      title: video.title,
      poster: video.poster,
      sources: Object.freeze(sources),
      tracks: Object.freeze(tracks),
    });
  }

  private emitChange(previousIndex: number, currentIndex: number, video: LyraVideo): void {
    this.emit('lr-video-change', Object.freeze({
      previousIndex,
      currentIndex,
      video: this.snapshotVideo(video),
    }));
  }

  private switchTo(index: number, forcePlay = false): void {
    const incoming = this.playlistVideos[index];
    if (!incoming || !this.isEnabled(incoming)) return;
    const previousIndex = this.activeIndex;
    const outgoing = this.activeVideo;
    if (incoming === outgoing) {
      this.rovingIndex = index;
      this.requestUpdate();
      if (forcePlay) {
        const generation = this.activationGeneration;
        void incoming.play().catch(() => {
          if (generation !== this.activationGeneration || incoming !== this.activeVideo) return;
        });
      }
      this.emitChange(previousIndex, index, incoming);
      return;
    }

    const wasPlaying = forcePlay || Boolean(outgoing?.getState().playing);
    if (outgoing) {
      this.preferences = this.capturePreferences(outgoing);
      this.pauseAndUnload(outgoing);
    }
    this.activationGeneration += 1;
    this.activeVideo = incoming;
    this.activeIndex = index;
    this.rovingIndex = index;
    for (const video of this.playlistVideos) {
      const isActive = video === incoming;
      video.hidden = !isActive;
      if (!isActive && video !== outgoing) this.pauseAndUnload(video);
    }
    this.activateVideo(incoming, wasPlaying, this.activationGeneration);
    this.requestUpdate();
    this.emitChange(previousIndex, index, incoming);
  }

  /** Jumps to a direct child video at a finite integer index. Invalid indexes are inert. */
  goTo(index: number): void {
    if (!Number.isFinite(index) || !Number.isInteger(index)) return;
    if (index < 0 || index >= this.playlistVideos.length) return;
    this.switchTo(index);
  }

  /** Selects the next enabled video when one exists. */
  next(): void {
    const index = this.nearestEnabledIndex(this.playlistVideos, this.activeIndex + 1);
    if (index > this.activeIndex) this.switchTo(index);
  }

  /** Selects the previous enabled video when one exists. */
  previous(): void {
    for (let index = this.activeIndex - 1; index >= 0; index -= 1) {
      if (this.isEnabled(this.playlistVideos[index]!)) {
        this.switchTo(index);
        return;
      }
    }
  }

  private onSlotChange = (): void => this.reconcileChildren();

  private onItemClick(event: MouseEvent): void {
    const button = event.currentTarget as HTMLButtonElement;
    const index = Number(button.dataset['index']);
    if (!Number.isInteger(index)) return;
    this.rovingIndex = index;
    this.goTo(index);
  }

  private enabledIndices(): number[] {
    const result: number[] = [];
    for (let index = 0; index < this.playlistVideos.length; index += 1) {
      if (this.isEnabled(this.playlistVideos[index]!)) result.push(index);
    }
    return result;
  }

  private moveRoving(from: number, direction: -1 | 1): void {
    const enabled = this.enabledIndices();
    const position = enabled.indexOf(from);
    if (position < 0) return;
    const next = enabled[position + direction];
    if (next === undefined) return;
    this.focusItem(next);
  }

  /** The playlist row that currently owns the roving tab stop, falling back to the first enabled
   *  row while the roving index sits on a disabled/absent one. This is the target the host's own
   *  focus/blur/click forward to — without it there is no public way to reach a row at all. */
  private get rovingItem(): HTMLButtonElement | null {
    const rows = [
      ...this.renderRoot.querySelectorAll<HTMLButtonElement>('[part~="playlist-item"]'),
    ];
    return rows.find((row) => !row.disabled && row.tabIndex === 0)
      ?? rows.find((row) => !row.disabled)
      ?? null;
  }

  /** Focus the playlist row holding the roving tab stop. An empty playlist renders no row, so this
   *  is a no-op there. */
  override focus(options?: FocusOptions): void {
    this.rovingItem?.focus(options);
  }

  /** Blur the playlist row holding the roving tab stop. */
  override blur(): void {
    this.rovingItem?.blur();
  }

  /** Activate the playlist row holding the roving tab stop, so a host-level `.click()` is not a
   *  silent no-op. */
  override click(): void {
    this.rovingItem?.click();
  }

  private onItemFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onItemBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  private focusItem(index: number): void {
    if (!this.isEnabled(this.playlistVideos[index]!)) return;
    this.rovingIndex = index;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      if (this.rovingIndex !== index) return;
      this.shadowRoot?.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)?.focus();
    });
  }

  private onItemKeyDown(event: KeyboardEvent): void {
    const button = event.currentTarget as HTMLButtonElement;
    const index = Number(button.dataset['index']);
    if (!Number.isInteger(index) || button.disabled) return;
    const forward = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.rovingIndex = index;
      this.goTo(index);
    } else if (event.key === 'ArrowDown' || event.key === forward) {
      event.preventDefault();
      this.moveRoving(index, 1);
    } else if (event.key === 'ArrowUp' || event.key === backward) {
      event.preventDefault();
      this.moveRoving(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = this.enabledIndices()[0];
      if (first !== undefined) this.focusItem(first);
    } else if (event.key === 'End') {
      event.preventDefault();
      const enabled = this.enabledIndices();
      const last = enabled[enabled.length - 1];
      if (last !== undefined) this.focusItem(last);
    }
  }

  private itemTitle(value: unknown, index: number): string {
    const title = typeof value === 'string' ? value.trim() : '';
    if (title) return title;
    const position = getNumberFormat(this.effectiveLocale).format(index + 1);
    return this.localize('videoPlaylistUntitled', undefined, { position });
  }

  private renderItem(
    item: LyraVideoPlaylistItem,
    index: number,
    current: boolean,
    disabled: boolean,
    roving: boolean,
  ): TemplateResult {
    const title = this.itemTitle(item.title, index);
    const poster = safeMediaSrc(typeof item.poster === 'string' ? item.poster : '');
    const duration = finiteRange(
      typeof item.duration === 'number' ? item.duration : 0,
      0,
      0,
    );
    return html`
      <li>
        <button
          type="button"
          part="playlist-item"
          data-index=${index}
          aria-current=${current ? 'true' : 'false'}
          aria-label=${title}
          tabindex=${!disabled && roving ? '0' : '-1'}
          ?disabled=${disabled}
          @click=${this.onItemClick}
          @keydown=${this.onItemKeyDown}
          @focus=${this.onItemFocus}
          @blur=${this.onItemBlur}
        >
          <span part="playlist-thumbnail" aria-hidden="true">
            ${poster ? html`<img src=${poster} alt="">` : html`
              <lr-icon library=${this.iconLibrary} name="video" aria-hidden="true">
                <path d="M4 6h11v12H4zM15 10l5-3v10l-5-3z"></path>
              </lr-icon>
            `}
          </span>
          <span data-item-copy>
            <span part="playlist-title">${title}</span>
            <span part="playlist-duration" aria-hidden="true">
              ${duration > 0 ? formatDuration(duration, this.effectiveLocale) : nothing}
            </span>
          </span>
        </button>
      </li>
    `;
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') ?? this.localize('videoPlaylistLabel');
    const seededItems = Array.isArray(this.items)
      ? this.items.filter((item): item is LyraVideoPlaylistItem =>
          item !== null && typeof item === 'object')
      : [];
    const seededCurrent = seededItems.findIndex((item) => item.unavailable !== true);
    const rows = this.liveChildrenReady
      ? this.playlistVideos.map((video, index) => this.renderItem(
          {
            title: video.title,
            poster: video.poster,
            duration: video.duration,
            unavailable: !this.isEnabled(video),
          },
          index,
          video === this.activeVideo,
          !this.isEnabled(video),
          index === this.rovingIndex,
        ))
      : seededItems.map((item, index) => this.renderItem(
          item,
          index,
          index === seededCurrent,
          true,
          false,
        ));
    return html`
      <div part="base video-playlist">
        <div data-video-stage>
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
        <ol part="playlist" aria-label=${label}>
          ${rows}
        </ol>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-video-playlist': LyraVideoPlaylist;
  }
}
