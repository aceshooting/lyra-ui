import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { formatMediaTime } from '../../../internal/media-time.js';
import { LyraElement, type LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { HostChildrenObserver } from '../../../internal/owned-observer.js';
import { restoreComposedFocus } from '../../../internal/focus-repair.js';
import { resolveListMove, shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import type { NativeMediaPreferences } from '../../../internal/media-controller.js';
import { finiteRange, nearestEnabledIndex } from '../../../internal/numbers.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { tag } from '../../../internal/prefix.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import type { LyraVideo, LyraVideoControls } from '../../lr-video.js';
import { styles } from './video-playlist.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_videoPlaylistLabel, LYRA_DEFAULT_videoPlaylistUntitled } from '../../../internal/default-strings/media.generated.js';
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
  readonly video: LyraVideoPlaylistVideo | null;
}

export interface LyraVideoPlaylistEventMap {
  'lr-video-change': CustomEvent<LyraEventDetailSnapshot<LyraVideoPlaylistChangeDetail>>;
  blur: FocusEvent;
  focus: FocusEvent;
}

interface VideoListeners {
  ended: EventListener;
  error: EventListener;
  loadedmetadata: EventListener;
  pause: EventListener;
  play: EventListener;
}

interface OwnedVideoState {
  controls: LyraVideoControls;
  iconLibrary: string;
  hidden: boolean;
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

function sourceSnapshot(src: string, type: string, media: string): LyraVideoPlaylistSource {
  return { src, type, media };
}

function trackSnapshot(
  src: string,
  kind: string,
  srclang: string,
  label: string,
  isDefault: boolean,
): LyraVideoPlaylistTrack {
  return { src, kind, srclang, label, default: isDefault };
}

/**
 * `<lr-video-playlist>` — a direct-child `<lr-video>` playlist with a navigable current-item
 * list. It mirrors the public `<wa-video-playlist>` surface under the `lr-` prefix.
 *
 * Lyra additionally exposes `without-auto-advance` and `repeat`. An ended video advances by
 * default, preserving the mirrored ended behavior, until `without-auto-advance` is set;
 * `repeat="one"` restarts the current video and `repeat="all"` wraps the final video to the first.
 * `items` can seed deterministic playlist-row metadata for server rendering. Seeded rows are
 * visible but disabled until the browser can adopt the indexed direct video children; live child
 * metadata is authoritative after that corrective update. Later interactions do not inspect the
 * obsolete seed, even when all adopted children are subsequently removed.
 *
 * A child marked `inert` is unavailable: it never becomes the active video,
 * `next()`/`previous()`/automatic advancement step past it, and its playlist row renders `disabled` so the
 * row cannot enter the sequential or arrow-key path. Only the child's *own* `inert` counts — a
 * playlist inerted wholesale by an open modal keeps playing. `<lr-video>` has no `disabled`
 * contract; use the native `inert` property to make a child unavailable.
 * Every enabled row is an ordinary sequentially reachable button (`tabindex="0"`); arrow keys are
 * optional shortcuts, not a required composite-widget navigation contract. Visible durations are
 * associated with their row through `aria-describedby`. Child presentation overrides are owned
 * reversibly while the child belongs to this playlist and restored on removal/reparenting.
 *
 * @customElement lr-video-playlist
 * @slot - Direct `<lr-video>` children. Other elements are not playlist items.
 * @event lr-video-change - Emitted when `goTo()`, `next()`, `previous()`, or ended advancement
 *   selects a video, and when a light-DOM mutation (a video removed, or every remaining video made
 *   `inert`/disabled) leaves no enabled video to replace a previously active one. Detail is
 *   `{ previousIndex, currentIndex, video }`; `video` is a fresh, detached, recursively frozen
 *   `{ title, poster, sources, tracks }` data snapshot with no live DOM nodes, or `null` when the
 *   playlist has no active video after this change -- `currentIndex` is `-1` in that case.
 * @event {FocusEvent} focus - Relayed once from a playlist row as a bubbling, composed native
 *   event.
 * @event {FocusEvent} blur - Relayed once from a playlist row as a bubbling, composed native
 *   event.
 * @csspart video-playlist - Root video-and-playlist layout.
 * @csspart playlist - Playlist sidebar container.
 * @csspart playlist-duration - Duration text within a playlist item.
 * @csspart playlist-item - An individual playlist item button.
 * @csspart playlist-thumbnail - Thumbnail within a playlist item.
 * @csspart playlist-title - Title text within a playlist item.
 * @cssprop [--lr-video-playlist-item-hover-bg=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))] -
 *   Background of a hovered playlist row that is not the current one.
 * @cssprop [--lr-video-playlist-item-hover-border-color=var(--lr-color-border-strong)] - Border
 *   color of a hovered playlist row that is not the current one.
 * @cssprop [--lr-video-playlist-item-active-bg=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 *   Background of a pressed playlist row that is not the current one.
 * @cssprop [--lr-video-playlist-item-current-bg=var(--lr-color-brand-fill-quiet)] - Current
 *   playlist-item background, kept under the pointer.
 * @cssprop [--lr-video-playlist-item-current-border-color=var(--lr-color-brand)] - Current
 *   playlist-item border color, kept under the pointer.
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
  protected static override collectionSupport = eventCollectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-video-change',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** Controls preset forwarded to every direct child video. */
  @property({ reflect: true }) controls: LyraVideoControls = 'full';

  /** Icon library forwarded to every direct child video. */
  @property({ attribute: 'icon-library' }) iconLibrary = 'system';

  /** Stops an ended current video from advancing automatically; `repeat` then has no effect.
   *  Errors never change selection either way. */
  @property({ type: Boolean, attribute: 'without-auto-advance' }) withoutAutoAdvance = false;

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
  @state() private navigationIndex = -1;

  private activeVideo?: LyraVideo;
  protected readonly childObserver = new HostChildrenObserver(this, {
    subtree: true,
    attributeFilter: ['default', 'inert', 'kind', 'label', 'media', 'poster', 'src', 'srclang', 'title', 'type'],
    onChange: () => {
      this.scheduleAfterUpdate(() => {
        this.reconcileChildren();
        this.requestUpdate();
      }, 'video-playlist-reconcile');
    },
  });
  private readonly listeners = new Map<LyraVideo, VideoListeners>();
  private readonly lastKnownPlaying = new WeakMap<LyraVideo, boolean>();
  private readonly nativeVideos = new WeakMap<LyraVideo, HTMLVideoElement>();
  private readonly needsReload = new WeakSet<LyraVideo>();
  private readonly ownedVideoState = new WeakMap<LyraVideo, OwnedVideoState>();
  private preferences: NativeMediaPreferences = {};
  private activationGeneration = 0;
  private reconcileGeneration = 0;
  private pendingPlay?: { video: LyraVideo; generation: number };

  override connectedCallback(): void {
    super.connectedCallback();
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
    // The playlist still owns descendants when the whole subtree disconnects (including during
    // same-origin adoption). Keep the authored snapshots claimed so reconnecting does not briefly
    // restore and re-project every child, which would create needless media/custom-element work in
    // the wrong document realm. A child moved out while the playlist stays connected is released
    // synchronously by reconciliation below.
    for (const video of this.playlistVideos) {
      this.unbindVideo(video);
      video.hidden = true;
      this.pauseAndUnload(video);
    }
    super.disconnectedCallback();
  }

  private readonly semanticInternals = attachInternalsSafely(this);

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // A host aria-label names the whole playlist (stage plus list), so the host owns a real role;
    // an author `role` attribute still overrides ElementInternals semantics.
    this.semanticInternals.role = normalizeLabel(hostAriaLabel(this)) === undefined ? null : 'region';
    if (changed.has('controls')) this.controls = safeControls(this.controls);
    if (changed.has('repeat')) this.repeat = safeRepeat(this.repeat);
    if (changed.has('controls') || changed.has('iconLibrary')) {
      this.scheduleAfterUpdate(() => this.reconcileChildren(), 'video-playlist-reconcile');
    }
  }

  private directVideos(): LyraVideo[] {
    const videoTag = tag('video');
    return [...this.children].filter(
      (child): child is LyraVideo => child.localName === videoTag,
    );
  }

  /**
   * Whether `video` can be selected, played, and reached by the playlist controls.
   *
   * An inert element refuses focus and pointer input, so an arrow shortcut that steps onto its row
   * would silently strand focus. The row this component
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
    return nearestEnabledIndex(preferred, videos.length, (at) => !this.isEnabled(videos[at]!));
  }

  private reconcileChildren(): void {
    if (!this.isConnected) return;
    const previousVideos = this.playlistVideos;
    const previousActive = this.activeVideo;
    const previousIndex = this.activeIndex;
    const previousNavigation = previousVideos[this.navigationIndex];
    // Read before the render that disables the outgoing row: once that row carries `disabled` the
    // platform has already blurred it, and there is no way left to tell "the user was on this row"
    // apart from "focus was never in the playlist at all".
    const navigationHadFocus =
      shadowFocusTarget(this)?.getAttribute('part') === 'playlist-item';
    const videos = this.directVideos();
    const videoSet = new Set(videos);
    // Once any live child has been observed, it remains the source of truth even if all children
    // are later removed. This prevents stale first-render metadata from reappearing after removal.
    if (videos.length > 0 || this.liveChildrenReady) this.liveChildrenReady = true;

    let active = previousActive && videoSet.has(previousActive) && this.isEnabled(previousActive)
      ? previousActive
      : undefined;
    let nextIndex = active ? videos.indexOf(active) : this.nearestEnabledIndex(videos, previousIndex);
    if (!active && nextIndex >= 0) active = videos[nextIndex];
    if (!active) nextIndex = -1;

    const activeChanged = active !== previousActive;
    const outgoingWasRemoved = Boolean(previousActive && !videoSet.has(previousActive));
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
      if (!videoSet.has(video)) {
        this.releaseVideo(video);
      }
    }
    for (const video of videos) {
      this.claimVideo(video);
      this.bindVideo(video);
    }

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

    const keptNavigation = previousNavigation &&
      videoSet.has(previousNavigation) &&
      this.isEnabled(previousNavigation)
      ? videos.indexOf(previousNavigation)
      : -1;
    this.navigationIndex = keptNavigation >= 0 ? keptNavigation : nextIndex;
    // The row that held the arrow-navigation focus cursor just stopped being reachable (removed or
    // made inert) while the user was standing on it. Its button is about to render `disabled`, which
    // drops focus to `<body>` -- beyond reach of the list's own keydown handler, leaving the
    // playlist keyboard-dead. Hand focus to the row that replaced it instead.
    if (navigationHadFocus && keptNavigation < 0 && this.navigationIndex >= 0) {
      this.focusItem(this.navigationIndex);
    }

    if (activeChanged && previousActive) {
      this.emitChange(previousIndex, nextIndex, active ?? null);
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
        this.handleCompletion(video);
      },
      error: () => {
        this.rememberNativeVideo(video);
        this.lastKnownPlaying.set(video, false);
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

  private claimVideo(video: LyraVideo): void {
    if (this.ownedVideoState.has(video)) return;
    this.ownedVideoState.set(video, {
      controls: video.controls,
      iconLibrary: video.iconLibrary,
      hidden: Boolean(video.hidden),
    });
  }

  /** Releases every playlist-owned mutation before a child is removed, reparented, or disconnected. */
  private releaseVideo(video: LyraVideo): void {
    const authored = this.ownedVideoState.get(video);
    this.unbindVideo(video);
    this.pauseAndUnload(video);
    if (!authored) return;
    video.controls = authored.controls;
    video.iconLibrary = authored.iconLibrary;
    video.hidden = authored.hidden;
    this.ownedVideoState.delete(video);
    // Reconstitute sources/tracks removed by pauseAndUnload() from the child's untouched light DOM.
    // A disconnected child will rebuild when its next owner connects it; avoiding a render here is
    // also important during cross-document adoption.
    if (video.isConnected) video.load();
  }

  private rememberNativeVideo(video: LyraVideo): void {
    const native = video.getVideoElement();
    if (native) this.nativeVideos.set(video, native);
  }

  private pauseAndUnload(video: LyraVideo): void {
    video.pause();
    video.hidden = true;
    this.needsReload.add(video);
    video.unloadMedia();
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
    return video.captureMediaPreferences(native);
  }

  private applyPreferences(video: LyraVideo, preferences: Readonly<NativeMediaPreferences>): void {
    video.applyMediaPreferences(preferences);
  }

  private handleLoadedMetadata(video: LyraVideo): void {
    if (video !== this.activeVideo) return;
    this.applyPreferences(video, this.preferences);
    this.requestUpdate();
  }

  private restartVideo(video: LyraVideo): void {
    const generation = this.activationGeneration;
    // seek() synchronously dispatches timeupdate, which can change the active item.
    video.seek(0);
    if (generation !== this.activationGeneration || video.parentElement !== this || !this.isEnabled(video)) return;
    void video.play().catch(() => undefined);
  }

  private handleCompletion(video: LyraVideo): void {
    if (video !== this.activeVideo || this.withoutAutoAdvance) return;
    if (this.repeat === 'one') {
      this.restartVideo(video);
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
      } else if (first === this.activeIndex) {
        this.restartVideo(video);
      }
    }
  }

  private snapshotVideo(video: LyraVideo): LyraVideoPlaylistVideo {
    const sources: LyraVideoPlaylistSource[] = [];
    const directSrc = video.src.trim();
    if (directSrc) sources.push(sourceSnapshot(directSrc, '', ''));
    const tracks: LyraVideoPlaylistTrack[] = [];
    for (const child of video.children) {
      if (child.localName === 'source') {
        const src = child.getAttribute('src')?.trim() ?? '';
        if (src) {
          sources.push(sourceSnapshot(
            src,
            child.getAttribute('type') ?? '',
            child.getAttribute('media') ?? '',
          ));
        }
      } else if (child.localName === 'track') {
        const src = child.getAttribute('src')?.trim() ?? '';
        if (src) {
          tracks.push(trackSnapshot(
            src,
            child.getAttribute('kind') ?? '',
            child.getAttribute('srclang') ?? '',
            child.getAttribute('label') ?? '',
            child.hasAttribute('default'),
          ));
        }
      }
    }
    return {
      title: video.title,
      poster: video.poster,
      sources,
      tracks,
    };
  }

  private emitChange(previousIndex: number, currentIndex: number, video: LyraVideo | null): void {
    this.emit('lr-video-change', {
      previousIndex,
      currentIndex,
      video: video ? this.snapshotVideo(video) : null,
    });
  }

  private switchTo(index: number, forcePlay = false): void {
    const incoming = this.playlistVideos[index];
    if (!incoming || !this.isEnabled(incoming)) return;
    const previousIndex = this.activeIndex;
    const outgoing = this.activeVideo;
    if (incoming === outgoing) {
      this.navigationIndex = index;
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

    const hadFocus = Boolean(outgoing?.matches(':focus-within'));
    const wasPlaying = forcePlay || Boolean(outgoing?.getState().playing);
    if (outgoing) {
      this.preferences = this.capturePreferences(outgoing);
      this.pauseAndUnload(outgoing);
    }
    this.activationGeneration += 1;
    this.activeVideo = incoming;
    this.activeIndex = index;
    this.navigationIndex = index;
    for (const video of this.playlistVideos) {
      const isActive = video === incoming;
      video.hidden = !isActive;
      if (!isActive && video !== outgoing) this.pauseAndUnload(video);
    }
    this.activateVideo(incoming, wasPlaying, this.activationGeneration);
    this.requestUpdate();
    if (hadFocus) {
      void this.updateComplete.then(() => restoreComposedFocus(
        this,
        true,
        this.shadowRoot?.querySelector<HTMLElement>(`[data-index="${index}"]`),
      ));
    }
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
    this.navigationIndex = index;
    this.goTo(index);
  }

  /** The current row, falling back to the first enabled row, for host method forwarding. */
  private get navigationItem(): HTMLButtonElement | null {
    const rows = [
      ...this.renderRoot?.querySelectorAll<HTMLButtonElement>('[part~="playlist-item"]') ?? [],
    ];
    return rows.find((row) => !row.disabled && row.getAttribute('aria-current') === 'true')
      ?? rows.find((row) => !row.disabled)
      ?? null;
  }

  /** Focus the current playlist row. An empty playlist renders no row, so this
   *  is a no-op there. */
  override focus(options?: FocusOptions): void {
    this.navigationItem?.focus(options);
  }

  /** Blur the current playlist row. */
  override blur(): void {
    this.navigationItem?.blur();
  }

  /** Activate the current playlist row, so a host-level `.click()` is not a
   *  silent no-op. */
  override click(): void {
    this.navigationItem?.click();
  }

  private onItemFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onItemBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private focusItem(index: number): void {
    if (!this.isEnabled(this.playlistVideos[index]!)) return;
    this.navigationIndex = index;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      if (this.navigationIndex !== index) return;
      this.shadowRoot?.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)?.focus();
    });
  }

  private onItemKeyDown(event: KeyboardEvent): void {
    const button = event.currentTarget as HTMLButtonElement;
    const index = Number(button.dataset['index']);
    if (!Number.isInteger(index) || button.disabled || shouldIgnoreNavigationKey(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.navigationIndex = index;
      this.goTo(index);
      return;
    }
    if (event.shiftKey) return;
    const target = resolveListMove(event, {
      count: this.playlistVideos.length,
      current: index,
      orientation: 'both',
      direction: this.effectiveDirection,
      wrap: false,
      clamp: true,
      isAvailable: (candidate) => this.isEnabled(this.playlistVideos[candidate]!),
    });
    if (target === null) return;
    event.preventDefault();
    if (target !== index) this.focusItem(target);
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
  ): TemplateResult {
    const title = this.itemTitle(item.title, index);
    const poster = safeMediaSrc(typeof item.poster === 'string' ? item.poster : '');
    const duration = finiteRange(
      typeof item.duration === 'number' ? item.duration : 0,
      0,
      0,
    );
    const durationId = `playlist-duration-${index}`;
    return html`
      <li>
        <button
          type="button"
          part="playlist-item"
          data-index=${index}
          aria-current=${current ? 'true' : 'false'}
          aria-label=${title}
          aria-describedby=${duration > 0 ? durationId : nothing}
          tabindex=${disabled ? '-1' : '0'}
          ?disabled=${disabled}
          @click=${this.onItemClick}
          @keydown=${this.onItemKeyDown}
          @focus=${this.onItemFocus}
          @blur=${this.onItemBlur}
        >
          <span part="playlist-thumbnail" aria-hidden="true" inert>
            ${poster ? html`<img src=${poster} alt="">` : html`
              <lr-icon library=${this.iconLibrary} name="video" aria-hidden="true">
                <path d="M4 6h11v12H4zM15 10l5-3v10l-5-3z"></path>
              </lr-icon>
            `}
          </span>
          <span data-item-copy>
            <span part="playlist-title" dir="auto">${title}</span>
            <span part="playlist-duration" id=${durationId}>
              ${duration > 0 ? formatMediaTime(duration, this.effectiveLocale) : nothing}
            </span>
          </span>
        </button>
      </li>
    `;
  }

  override render(): TemplateResult {
    // The list keeps its own name inside a host-named region; an explicitly empty host label
    // clears it.
    const label = hostAriaLabel(this) === '' ? '' : this.localize('videoPlaylistLabel');
    const seededItems = !this.liveChildrenReady && Array.isArray(this.items)
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
        ))
      : seededItems.map((item, index) => this.renderItem(
          item,
          index,
          index === seededCurrent,
          true,
        ));
    return html`
      <div part="video-playlist">
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
