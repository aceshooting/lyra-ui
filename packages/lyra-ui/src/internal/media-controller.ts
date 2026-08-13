import { finiteRange } from './numbers.js';
import { safeMediaSrc } from './safe-url.js';

export const MIN_NATIVE_PLAYBACK_RATE = 0.0625;
export const MAX_NATIVE_PLAYBACK_RATE = 16;

/** Native media notifications exposed by the public video surface. These events do not bubble or
 * compose natively, so a shadow-DOM wrapper must relay them from its own host. */
export const NATIVE_MEDIA_RELAY_EVENTS = [
  'ended',
  'error',
  'loadedmetadata',
  'pause',
  'play',
  'timeupdate',
  'volumechange',
] as const;


const CONTROLLER_EVENT_NAMES = [
  ...NATIVE_MEDIA_RELAY_EVENTS,
  'durationchange',
  'ratechange',
  'seeked',
] as const;

const TRACK_KINDS = new Set(['subtitles', 'captions', 'descriptions', 'chapters', 'metadata']);
const USER_SELECTABLE_TRACK_KINDS = new Set(['subtitles', 'captions', 'descriptions']);
const SOURCE_ATTRIBUTES = ['type', 'media'] as const;
const TRACK_ATTRIBUTES = ['srclang', 'label'] as const;

export interface NativeTextTrackPreference {
  index: number;
  kind: string;
  label: string;
  language: string;
}

/** User-controlled media state safe to carry to another native media element. Every field is
 * optional so malformed or unavailable native values are omitted rather than normalized into a
 * preference the user never chose. */
export interface NativeMediaPreferences {
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
  textTrack?: NativeTextTrackPreference | null;
}

export interface NativeMediaSourceSet {
  /** A direct native `src`. Empty/omitted leaves source selection to cloned `<source>` nodes. */
  src?: unknown;
  /** Consumer-owned `<source>`/`<track>` nodes. Safe allowlisted clones are inserted. */
  nodes?: Iterable<Node>;
}

export interface NativeMediaControllerOptions {
  /** Native events observed by `onEvent`. Relay events are added automatically. */
  events?: readonly string[];
  /** Events re-dispatched from `target`. Defaults to `NATIVE_MEDIA_RELAY_EVENTS`. */
  relayEvents?: readonly string[];
  onEvent?: (event: Event, controller: NativeMediaController) => void;
}

function isValidVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidPlaybackRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_NATIVE_PLAYBACK_RATE &&
    value <= MAX_NATIVE_PLAYBACK_RATE
  );
}

function mediaDuration(media: HTMLMediaElement | undefined): number {
  return finiteRange(media?.duration ?? 0, 0, 0);
}

function directMediaChildren(media: HTMLMediaElement): Array<HTMLSourceElement | HTMLTrackElement> {
  return [...media.children].filter(
    (child): child is HTMLSourceElement | HTMLTrackElement =>
      child.localName === 'source' || child.localName === 'track',
  );
}

function textTracks(media: HTMLMediaElement): TextTrack[] {
  const tracks: TextTrack[] = [];
  for (let index = 0; index < media.textTracks.length; index += 1) {
    const track = media.textTracks[index];
    if (track) tracks.push(track);
  }
  return tracks;
}

function textTrackPreference(track: TextTrack, index: number): NativeTextTrackPreference {
  return {
    index,
    kind: track.kind,
    label: track.label,
    language: track.language,
  };
}

function validTextTrackPreference(value: unknown): value is NativeTextTrackPreference {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Record<keyof NativeTextTrackPreference, unknown>>;
  return (
    typeof candidate.index === 'number' &&
    Number.isInteger(candidate.index) &&
    candidate.index >= 0 &&
    typeof candidate.kind === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.language === 'string'
  );
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** Returns a validated media URL without widening the shared media-source scheme allowlist. */
export function safeNativeMediaSource(value: unknown): string | null {
  return safeMediaSrc(value);
}

/**
 * Creates fresh, safe native media children in `targetDocument`.
 *
 * Only URL-validated `<source>`/`<track>` elements and their native allowlisted attributes cross
 * the boundary. Consumer nodes are never moved or cloned wholesale, so ids, handlers, styles, and
 * arbitrary data attributes cannot leak into the private media tree.
 */
export function cloneSafeMediaNodes(
  nodes: Iterable<Node>,
  targetDocument: Document,
): Array<HTMLSourceElement | HTMLTrackElement> {
  const clones: Array<HTMLSourceElement | HTMLTrackElement> = [];
  for (const node of nodes) {
    if (node.nodeType !== 1) continue;
    const source = node as Element;
    const url = safeMediaSrc(source.getAttribute('src'));
    if (!url) continue;

    if (source.localName === 'source') {
      const clone = targetDocument.createElement('source');
      clone.setAttribute('src', url);
      for (const attribute of SOURCE_ATTRIBUTES) {
        const value = source.getAttribute(attribute);
        if (value !== null) clone.setAttribute(attribute, value);
      }
      clones.push(clone);
      continue;
    }

    if (source.localName !== 'track') continue;
    const kind = source.getAttribute('kind')?.toLowerCase() ?? '';
    if (!TRACK_KINDS.has(kind)) continue;
    const clone = targetDocument.createElement('track');
    clone.setAttribute('src', url);
    clone.setAttribute('kind', kind);
    for (const attribute of TRACK_ATTRIBUTES) {
      const value = source.getAttribute(attribute);
      if (value !== null) clone.setAttribute(attribute, value);
    }
    if (source.hasAttribute('default')) clone.setAttribute('default', '');
    clones.push(clone);
  }
  return clones;
}

/** Feature-based fullscreen capability check; deliberately contains no browser-name branch. */
export function canRequestFullscreen(element: Element | null | undefined): boolean {
  if (!element) return false;
  return (
    typeof element.requestFullscreen === 'function' &&
    element.ownerDocument.fullscreenEnabled !== false
  );
}

/** Feature-based fullscreen-exit capability check. */
export function canExitFullscreen(documentRef: Document | null | undefined): boolean {
  return Boolean(documentRef && typeof documentRef.exitFullscreen === 'function');
}

/** Feature-based picture-in-picture capability check; unsupported and explicitly-disabled videos
 * both return false. */
export function canRequestPictureInPicture(
  media: HTMLMediaElement | null | undefined,
): media is HTMLVideoElement {
  if (!media) return false;
  const candidate = media as HTMLVideoElement;
  const documentRef = media.ownerDocument as Document & { pictureInPictureEnabled?: boolean };
  return (
    media.localName === 'video' &&
    typeof candidate.requestPictureInPicture === 'function' &&
    documentRef.pictureInPictureEnabled !== false &&
    candidate.disablePictureInPicture !== true
  );
}

/**
 * Owns one native media element's source generation, listeners, finite state, preferences, and
 * host relays. It has no rendering policy, making it reusable by native-control and custom-control
 * players alike.
 */
export class NativeMediaController {
  #media?: HTMLMediaElement;
  #active = true;
  #generation = 0;
  #duration = 0;
  #currentTime = 0;
  #pendingCurrentTime: number | null = null;
  #listeners = new Map<string, EventListener>();
  #eventNames: Set<string>;
  #relayEvents: Set<string>;
  #preferences: NativeMediaPreferences = {};
  #hasPreferences = false;
  #onEvent?: NativeMediaControllerOptions['onEvent'];

  constructor(
    private readonly target: EventTarget,
    options: NativeMediaControllerOptions = {},
  ) {
    this.#relayEvents = new Set(options.relayEvents ?? NATIVE_MEDIA_RELAY_EVENTS);
    this.#eventNames = new Set(options.events ?? CONTROLLER_EVENT_NAMES);
    for (const name of this.#relayEvents) this.#eventNames.add(name);
    this.#onEvent = options.onEvent;
  }

  get element(): HTMLMediaElement | undefined {
    return this.#media;
  }

  /** Token for async work that belongs to the current attached source. */
  get generation(): number {
    return this.#generation;
  }

  /** Whether an async result still belongs to the current source and optional native element. */
  isCurrentGeneration(generation: number, media: HTMLMediaElement | undefined = this.#media): boolean {
    return this.#active && generation === this.#generation && media === this.#media;
  }

  get duration(): number {
    return finiteRange(this.#duration || mediaDuration(this.#media), 0, 0);
  }

  get currentTime(): number {
    if (this.#pendingCurrentTime !== null) return this.#pendingCurrentTime;
    const max = this.duration > 0 ? this.duration : Number.POSITIVE_INFINITY;
    const nativeValue = this.#media?.currentTime;
    return finiteRange(nativeValue ?? this.#currentTime, this.#currentTime, 0, max);
  }

  set currentTime(value: number) {
    const max = this.duration > 0 ? this.duration : Number.POSITIVE_INFINITY;
    const next = finiteRange(value, 0, 0, max);
    this.#currentTime = next;
    if (!this.#media) {
      this.#pendingCurrentTime = next;
      return;
    }
    try {
      this.#media.currentTime = next;
      this.#pendingCurrentTime = null;
    } catch {
      this.#pendingCurrentTime = next;
    }
  }

  get volume(): number {
    const nativeValue = this.#media?.volume;
    if (isValidVolume(nativeValue)) return nativeValue;
    return isValidVolume(this.#preferences.volume) ? this.#preferences.volume : 1;
  }

  set volume(value: number) {
    const next = finiteRange(value, this.volume, 0, 1);
    this.#preferences.volume = next;
    this.#hasPreferences = true;
    if (this.#media) this.#media.volume = next;
  }

  get muted(): boolean {
    return this.#media?.muted ?? this.#preferences.muted ?? false;
  }

  set muted(value: boolean) {
    const next = Boolean(value);
    this.#preferences.muted = next;
    this.#hasPreferences = true;
    if (this.#media) this.#media.muted = next;
  }

  get playbackRate(): number {
    const nativeValue = this.#media?.playbackRate;
    if (isValidPlaybackRate(nativeValue)) return nativeValue;
    return isValidPlaybackRate(this.#preferences.playbackRate) ? this.#preferences.playbackRate : 1;
  }

  set playbackRate(value: number) {
    const next = finiteRange(
      value,
      1,
      MIN_NATIVE_PLAYBACK_RATE,
      MAX_NATIVE_PLAYBACK_RATE,
    );
    this.#preferences.playbackRate = next;
    this.#hasPreferences = true;
    if (this.#media) this.#media.playbackRate = next;
  }

  /** Replaces the controlled native element. The old element is synchronously silenced and cannot
   * emit into the new generation. Valid user preferences are carried to the replacement. */
  attach(media: HTMLMediaElement | null | undefined): void {
    if (media === this.#media) {
      if (media && this.#active && this.#listeners.size === 0) this.#bindListeners();
      return;
    }

    const previous = this.#media;
    if (previous) {
      this.#rememberUserPreferences(previous);
      this.#unbindListeners();
      this.#generation += 1;
      if (this.#active) previous.pause();
    }

    this.#media = media ?? undefined;
    this.#duration = 0;
    this.#currentTime = 0;
    if (previous || !media) this.#pendingCurrentTime = null;
    if (!media) return;

    if (this.#hasPreferences) this.applyUserPreferences(this.#preferences, media);
    else this.#rememberUserPreferences(media);
    if (this.#active) this.#bindListeners();
  }

  /** Starts a source generation on the current element, preserving valid user preferences while
   * clearing duration/time and rejecting every listener captured by the prior generation. */
  startGeneration(): number {
    this.#rememberUserPreferences(this.#media);
    this.#unbindListeners();
    this.#generation += 1;
    this.#media?.pause();
    this.#duration = 0;
    this.#currentTime = 0;
    this.#pendingCurrentTime = null;
    if (this.#active && this.#media) this.#bindListeners();
    return this.#generation;
  }

  /** Stops playback and listeners while retaining the element for a later reconnect. */
  disconnect(): void {
    if (!this.#active) return;
    this.#rememberUserPreferences(this.#media);
    this.#active = false;
    this.#unbindListeners();
    this.#generation += 1;
    this.#media?.pause();
  }

  /** Reattaches one listener set to the retained element after a disconnect. */
  reconnect(): void {
    if (this.#active) return;
    this.#active = true;
    this.#generation += 1;
    if (!this.#media) return;
    this.applyUserPreferences(this.#preferences, this.#media);
    this.#bindListeners();
  }

  /** Returns the exact native promise. This method is intentionally not `async`, which would wrap
   * the promise and break identity/rejection behavior. */
  play(): Promise<void> {
    return this.#media?.play() ?? Promise.resolve();
  }

  pause(): void {
    this.#media?.pause();
  }

  /** Restarts native resource selection under a fresh listener generation. */
  load(): void {
    if (!this.#media) return;
    this.#rememberUserPreferences(this.#media);
    this.#unbindListeners();
    this.#generation += 1;
    this.#duration = 0;
    this.#currentTime = 0;
    this.#pendingCurrentTime = null;
    if (this.#active) this.#bindListeners();
    this.#media.load();
  }

  /** Pauses, removes direct sources/tracks, clears `src`, and resets native resource selection. */
  unload(): void {
    const media = this.#media;
    if (!media) return;
    this.startGeneration();
    media.removeAttribute('src');
    for (const child of directMediaChildren(media)) child.remove();
    media.load();
  }

  /** Validates a direct URL and replaces media children with fresh allowlisted clones. */
  setSources(sourceSet: NativeMediaSourceSet): boolean {
    const media = this.#media;
    if (!media) return false;
    const rawSrc = typeof sourceSet.src === 'string' ? sourceSet.src.trim() : sourceSet.src;
    const hasDirectSrc = rawSrc !== undefined && rawSrc !== null && rawSrc !== '';
    const directSrc = hasDirectSrc ? safeMediaSrc(rawSrc) : null;
    if (hasDirectSrc && !directSrc) {
      if (media.hasAttribute('src') || directMediaChildren(media).length > 0) this.unload();
      return false;
    }

    const clones = cloneSafeMediaNodes(sourceSet.nodes ?? [], media.ownerDocument);
    const hasSource = Boolean(directSrc || clones.some((node) => node.localName === 'source'));
    this.startGeneration();
    media.removeAttribute('src');
    for (const child of directMediaChildren(media)) child.remove();
    if (directSrc) media.setAttribute('src', directSrc);
    for (const clone of clones) media.append(clone);
    media.load();
    return hasSource;
  }

  captureUserPreferences(media: HTMLMediaElement | undefined = this.#media): NativeMediaPreferences {
    if (!media) return {};
    const preferences: NativeMediaPreferences = {};
    if (isValidVolume(media.volume)) preferences.volume = media.volume;
    if (typeof media.muted === 'boolean') preferences.muted = media.muted;
    if (isValidPlaybackRate(media.playbackRate)) preferences.playbackRate = media.playbackRate;

    const tracks = textTracks(media);
    const showingIndex = tracks.findIndex((track) => track.mode === 'showing');
    preferences.textTrack = showingIndex >= 0 && tracks[showingIndex]
      ? textTrackPreference(tracks[showingIndex], showingIndex)
      : null;
    return preferences;
  }

  /** Applies only fields that are already valid preferences. Invalid input leaves native state
   * untouched instead of clamping attacker- or race-produced data into a new user choice. */
  applyUserPreferences(
    preferences: Readonly<NativeMediaPreferences>,
    media: HTMLMediaElement | undefined = this.#media,
  ): void {
    if (!media || preferences === null || typeof preferences !== 'object') return;
    if (isValidVolume(preferences.volume)) {
      media.volume = preferences.volume;
      this.#preferences.volume = preferences.volume;
      this.#hasPreferences = true;
    }
    if (typeof preferences.muted === 'boolean') {
      media.muted = preferences.muted;
      this.#preferences.muted = preferences.muted;
      this.#hasPreferences = true;
    }
    if (isValidPlaybackRate(preferences.playbackRate)) {
      media.playbackRate = preferences.playbackRate;
      this.#preferences.playbackRate = preferences.playbackRate;
      this.#hasPreferences = true;
    }
    if (!hasOwn(preferences, 'textTrack')) return;

    const requested = preferences.textTrack;
    if (requested !== null && !validTextTrackPreference(requested)) return;
    const tracks = textTracks(media);
    if (requested === null) {
      for (const track of tracks) {
        if (USER_SELECTABLE_TRACK_KINDS.has(track.kind)) track.mode = 'disabled';
      }
      this.#preferences.textTrack = null;
      this.#hasPreferences = true;
      return;
    }

    const exact = tracks.find(
      (track) =>
        track.kind === requested.kind &&
        track.label === requested.label &&
        track.language === requested.language,
    );
    const indexed = tracks[requested.index];
    const selected = exact ?? (indexed?.kind === requested.kind ? indexed : undefined);
    if (!selected) return;
    for (const track of tracks) {
      if (USER_SELECTABLE_TRACK_KINDS.has(track.kind)) {
        track.mode = track === selected ? 'showing' : 'disabled';
      }
    }
    this.#preferences.textTrack = textTrackPreference(selected, tracks.indexOf(selected));
    this.#hasPreferences = true;
  }

  #rememberUserPreferences(media: HTMLMediaElement | undefined): void {
    if (!media) return;
    this.#preferences = this.captureUserPreferences(media);
    this.#hasPreferences = true;
  }

  #bindListeners(): void {
    const media = this.#media;
    if (!media || !this.#active || this.#listeners.size > 0) return;
    const generation = this.#generation;
    for (const name of this.#eventNames) {
      const listener: EventListener = (event) => {
        if (
          !this.#active ||
          generation !== this.#generation ||
          media !== this.#media ||
          event.currentTarget !== media
        ) {
          return;
        }
        this.#synchronizeNativeState(event.type);
        this.#onEvent?.(event, this);
        if (
          generation === this.#generation &&
          media === this.#media &&
          this.#relayEvents.has(event.type)
        ) {
          const EventConstructor = media.ownerDocument.defaultView?.Event ?? Event;
          this.target.dispatchEvent(new EventConstructor(event.type));
        }
      };
      media.addEventListener(name, listener);
      this.#listeners.set(name, listener);
    }
  }

  #unbindListeners(): void {
    const media = this.#media;
    if (media) {
      for (const [name, listener] of this.#listeners) {
        media.removeEventListener(name, listener);
      }
    }
    this.#listeners.clear();
  }

  #synchronizeNativeState(type: string): void {
    const media = this.#media;
    if (!media) return;
    if (type === 'loadedmetadata' || type === 'durationchange') {
      this.#duration = mediaDuration(media);
      if (this.#pendingCurrentTime !== null) {
        const pending = this.#pendingCurrentTime;
        this.#pendingCurrentTime = null;
        this.currentTime = pending;
      }
    }
    if (type === 'timeupdate' || type === 'seeked') {
      const max = this.duration > 0 ? this.duration : Number.POSITIVE_INFINITY;
      this.#currentTime = finiteRange(media.currentTime, this.#currentTime, 0, max);
    }
    if (type === 'volumechange' || type === 'ratechange') {
      this.#rememberUserPreferences(media);
    }
  }
}
