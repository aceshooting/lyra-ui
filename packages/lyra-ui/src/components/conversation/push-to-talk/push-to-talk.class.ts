import { html, nothing, svg, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.class.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteDuration, MAX_TIMEOUT_MS } from '../../../internal/numbers.js';
import { styles } from './push-to-talk.styles.js';
import { literalSetConverter, trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_pushToTalkCancelled, LYRA_DEFAULT_pushToTalkDenied, LYRA_DEFAULT_pushToTalkError, LYRA_DEFAULT_pushToTalkHold, LYRA_DEFAULT_pushToTalkRequesting, LYRA_DEFAULT_pushToTalkStart, LYRA_DEFAULT_pushToTalkStarted, LYRA_DEFAULT_pushToTalkStop, LYRA_DEFAULT_pushToTalkStopped, LYRA_DEFAULT_pushToTalkUnsupported } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type PushToTalkMode = 'hold' | 'toggle';
export type PushToTalkState = 'idle' | 'requesting' | 'denied' | 'recording' | 'error';
export type PushToTalkAudioConstraints = Omit<MediaTrackConstraints, 'deviceId'> & {
  readonly deviceId?: never;
};

const PUSH_TO_TALK_MODE = literalSetConverter<PushToTalkMode>(['hold', 'toggle'], 'hold');

const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

interface OwnedTimer {
  owner: Window;
  handle: number;
}

interface OwnedAnimationFrame {
  owner: Window;
  handle: number;
}

type PushToTalkWindow = Window & {
  MediaRecorder: typeof MediaRecorder;
  Blob: typeof Blob;
  Uint8Array: Uint8ArrayConstructor;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

function isPushToTalkSupported(owner: Window | null): owner is PushToTalkWindow {
  const runtime = owner as PushToTalkWindow | null;
  return !!runtime?.MediaRecorder && typeof runtime.navigator.mediaDevices?.getUserMedia === 'function';
}

// One-off local glyphs, matching lr-attachment-trigger's convention of keeping single-use icons
// local to the component that uses them rather than adding them to the shared internal/icons.ts
// module, which is reserved for icons reused across several components.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';
function icon(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" focusable="false">${paths}</svg>
  `;
}
function micIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  `);
}
function pulseGlyph(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="6"></circle>`);
}

export interface LyraPushToTalkEventMap {
  'lr-record-start': CustomEvent<{ stream: MediaStream }>;
  'lr-record-chunk': CustomEvent<{ blob: Blob }>;
  'lr-record-stop': CustomEvent<{ blob: Blob; durationMs: number }>;
  'lr-record-cancel': CustomEvent<null>;
  'lr-record-error': CustomEvent<{ error: DOMException | Error }>;
  'lr-level': CustomEvent<{ level: number }>;
  'lr-record-state-change': CustomEvent<{ state: PushToTalkState }>;
}

/**
 * `<lr-push-to-talk>` — a mic capture button owning the full `getUserMedia` + `MediaRecorder`
 * lifecycle: permission request, recording, optional chunked streaming, teardown. The one place in
 * this library that touches the microphone — no SDK, no LiveKit/ElevenLabs import, native browser
 * APIs only.
 *
 * `mode="hold"` (the default) is a press-and-hold gesture: pointerdown/Enter-or-Space-keydown starts,
 * pointerup/keyup/blur stops. `mode="toggle"` is click-to-start/click-to-stop with `aria-pressed`.
 * Escape cancels the in-progress take in either mode (discarding it — `lr-record-cancel`, never
 * `lr-record-stop`). `state` is a read-only lifecycle reflected to the `data-state` attribute (not
 * `state`, avoiding any ambiguity with a native form-control `state`): `'idle' | 'requesting' |
 * 'denied' | 'recording' | 'error'`. A host-level `aria-label` (set on `<lr-push-to-talk>` itself)
 * overrides the computed trigger label by attribute presence, including an explicit empty value.
 *
 * @customElement lr-push-to-talk
 * @slot microphone-icon - Replaces the default mic glyph. Decorative: assigned content is inert
 *   and hidden from accessibility APIs because it is rendered inside the named trigger button.
 * @slot recording-icon - Replaces the default recording-state pulse glyph. Decorative and inert.
 * @event lr-record-start - Capture began. `detail: { stream: MediaStream }` — the same object the
 *   `stream` getter then returns for the duration of the take.
 * @event lr-record-chunk - A `timeslice-ms` slice was produced (only fires when `timeslice-ms > 0`,
 *   in order). `detail: { blob: Blob }` — a container fragment, decodable only once concatenated from
 *   the first chunk of the take.
 * @event lr-record-stop - The take finished normally. `detail: { blob: Blob; durationMs: number }`
 *   — `durationMs` excludes the `requesting` phase.
 * @event lr-record-cancel - The take was discarded via `cancel()`/Escape — no detail, and
 *   `lr-record-stop` never fires for this take.
 * @event lr-record-error - A permission request, recorder construction/start, or active recorder
 *   failed. `detail: { error: DOMException | Error }` — `NotAllowedError` transitions `state` to
 *   `'denied'`, anything else to `'error'`.
 * @event lr-level - `detail: { level: number }` (0-1 RMS amplitude), opt-in via `level-events`,
 *   rAF-throttled, only while `state === 'recording'`.
 * @event lr-record-state-change - `detail: { state: PushToTalkState }` — fires on every recording
 *   lifecycle transition.
 * @csspart trigger - The capture button.
 * @csspart icon - Wrapper around the `microphone-icon` slot and default mic glyph.
 * @csspart pulse - Wrapper around the `recording-icon` slot / default pulse glyph, rendered only
 *   while recording.
 * @csspart timer - The localized `M:SS` elapsed-time readout, rendered only while recording and
 *   `show-timer`.
 * @csspart status - Visible status text for the `requesting`/`denied`/`error`/unsupported states.
 * @cssprop [--lr-push-to-talk-size=var(--lr-size-3rem)] - Preferred inline and block size of the
 *   circular `trigger` button; `--lr-icon-button-size` remains its minimum hit-area floor.
 * @cssprop [--lr-push-to-talk-recording-color=var(--lr-color-danger)] - Established aggregate
 *   fallback for the recording trigger border, trigger foreground, and pulse border. The three
 *   more-specific recording properties below win independently when set.
 * @cssprop [--lr-push-to-talk-trigger-recording-border-color=var(--lr-push-to-talk-recording-color, var(--lr-color-danger))] - Trigger border color while recording.
 * @cssprop [--lr-push-to-talk-trigger-recording-color=var(--lr-push-to-talk-recording-color, var(--lr-color-danger))] - Trigger foreground, including the default mic glyph, while recording.
 * @cssprop [--lr-push-to-talk-pulse-recording-border-color=var(--lr-push-to-talk-recording-color, var(--lr-color-danger))] - Recording pulse-ring border color.
 * @status stable
 * @since 4.0.0
 */
export class LyraPushToTalk extends LyraElement<LyraPushToTalkEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    pushToTalkCancelled: LYRA_DEFAULT_pushToTalkCancelled,
    pushToTalkDenied: LYRA_DEFAULT_pushToTalkDenied,
    pushToTalkError: LYRA_DEFAULT_pushToTalkError,
    pushToTalkHold: LYRA_DEFAULT_pushToTalkHold,
    pushToTalkRequesting: LYRA_DEFAULT_pushToTalkRequesting,
    pushToTalkStart: LYRA_DEFAULT_pushToTalkStart,
    pushToTalkStarted: LYRA_DEFAULT_pushToTalkStarted,
    pushToTalkStop: LYRA_DEFAULT_pushToTalkStop,
    pushToTalkStopped: LYRA_DEFAULT_pushToTalkStopped,
    pushToTalkUnsupported: LYRA_DEFAULT_pushToTalkUnsupported,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _mode: PushToTalkMode = 'hold';
  @property({ reflect: true, converter: PUSH_TO_TALK_MODE })
  get mode(): PushToTalkMode {
    return this._mode;
  }
  set mode(next: PushToTalkMode) {
    const normalized = PUSH_TO_TALK_MODE.normalize(next);
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
  }
  /** `> 0` requests periodic `lr-record-chunk` slices from `MediaRecorder` every this-many
   *  milliseconds; `0` (the default) requests one slice at stop. Clamped to
   *  `[1, MAX_TIMEOUT_MS]` at the point it's handed to `MediaRecorder.start()` -- see `start()` --
   *  so a non-finite/oversized value can't reach that native API unsanitized. */
  @property({ type: Number, attribute: 'timeslice-ms' }) timesliceMs = 0;
  @property({ attribute: 'mime-type' }) mimeType = '';
  @property({ attribute: 'device-id' }) deviceId = '';
  /** Additional audio constraints (`echoCancellation`, …). `deviceId` has one authority: the
   *  top-level `deviceId` property. */
  @property({ attribute: false }) audioConstraints?: PushToTalkAudioConstraints;
  /** Enables `lr-level` sampling. Changes take effect immediately during an active recording. */
  @property({ type: Boolean, attribute: 'level-events' }) levelEvents = false;
  /** `> 0` auto-stops the take at this many milliseconds (a stuck-key guard); `0` (the default)
   *  never auto-stops. Clamped to `[1, MAX_TIMEOUT_MS]` at the point it's handed to `setTimeout()`
   *  -- see `start()` -- the browser timer ceiling, matching
   *  `lr-sequence-playback`'s `interval-ms`
   *  handling of its own duration-like property. Changes during recording reschedule the deadline
   *  relative to the original recording start; setting `0` cancels it. */
  @property({ type: Number, attribute: 'max-duration-ms' }) maxDurationMs = 0;
  /** Shows and samples the elapsed timer. Changes take effect immediately while recording. */
  @property({
    type: Boolean,
    attribute: 'show-timer',
    converter: trueDefaultBooleanConverter,
  })
  showTimer = true;
  @property({ type: Boolean, reflect: true }) disabled = false;

  @state() private elapsedMs = 0;
  /** The server-safe first-render answer is unsupported. A browser-only mount seeds its owner
   *  realm before rendering; hydration keeps the server answer for one update, then corrects it. */
  @state() private captureSupported = false;

  private _state: PushToTalkState = 'idle';
  /** Read-only recording lifecycle, reflected to the `data-state` attribute. Drive it via
   *  `start()`/`stop()`/`cancel()`, never by assignment. */
  get state(): PushToTalkState {
    return this._state;
  }

  private _stream: MediaStream | null = null;
  /** The active `MediaStream` — the same object `lr-record-start` carries. `null` outside an
   *  active take. */
  get stream(): MediaStream | null {
    return this._stream;
  }

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  @query('[part="trigger"]') private trigger?: HTMLButtonElement;

  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private recordingStartedAt = 0;
  /** Window that granted the active capture. Native objects and scheduled work for a take stay
   *  bound to this realm even if the custom element is adopted before the recorder stops. */
  private captureWindow?: PushToTalkWindow;
  private cancelRequested = false;
  private recorderStopRequested = false;
  private recorderFailed = false;
  private holdGesture?: {
    generation: number;
    source: 'pointer' | 'keyboard';
    pointerId?: number;
    key?: string;
  };
  private holdGestureGeneration = 0;
  private tickTimer?: OwnedTimer;
  private maxDurationTimer?: OwnedTimer;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private levelData?: Uint8Array<ArrayBuffer>;
  private levelFrame?: OwnedAnimationFrame;

  /** Lit's server DOM intentionally gives custom elements no browser-owned document. */
  private get ownerWindow(): Window | null {
    return (this.ownerDocument as Document | undefined)?.defaultView ?? null;
  }

  private syncCaptureSupport(): void {
    this.captureSupported = isPushToTalkSupported(this.ownerWindow);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate('mode', undefined);
    if (!this.hasAttribute('data-state')) this.setAttribute('data-state', this._state);
  }

  override disconnectedCallback(): void {
    this.releaseHoldGesture();
    if (this._state === 'recording' || this._state === 'requesting') this.cancel();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.syncCaptureSupport();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this.hasUpdated) this.syncCaptureSupport();
    else this.seedFirstRenderState(() => this.syncCaptureSupport());
    if (changed.has('mode') && this.holdGesture) this.releaseHoldGesture();
    if (changed.has('disabled') && this.disabled) {
      this.releaseHoldGesture();
      if (this._state === 'recording' || this._state === 'requesting') this.cancel();
    }
    const owner = this.captureWindow;
    if (this._state !== 'recording' || !owner) return;
    if (changed.has('showTimer')) this.syncElapsedTimer(owner);
    if (changed.has('maxDurationMs')) this.syncMaxDurationTimer(owner);
    if (changed.has('levelEvents')) this.syncLevelMeter(owner);
  }

  override focus(options?: FocusOptions): void {
    this.trigger?.focus(options);
  }

  override blur(): void {
    this.trigger?.blur();
  }

  /** Programmatically starts/stops a take using the component's configured interaction mode. */
  override click(): void {
    if (this.disabled || !isPushToTalkSupported(this.ownerWindow)) return;
    if (this.mode === 'toggle') {
      this.trigger?.click();
    } else if (this._state === 'recording') {
      this.stop();
    } else {
      void this.start();
    }
  }

  private resolveMimeType(owner: PushToTalkWindow): string {
    if (this.mimeType) return this.mimeType;
    for (const candidate of CANDIDATE_MIME_TYPES) {
      if (owner.MediaRecorder.isTypeSupported?.(candidate)) return candidate;
    }
    return '';
  }

  private setState(next: PushToTalkState): void {
    if (this._state === next) return;
    const old = this._state;
    this._state = next;
    this.setAttribute('data-state', next);
    this.requestUpdate('state', old);
    this.emit('lr-record-state-change', { state: next });
  }

  private announce(text: string): void {
    const region = this.liveRegion;
    if (!region) return;
    region.mode = 'polite';
    region.announce(text, { force: true });
  }

  /** Begins a take: requests the microphone, then starts recording. Resolves `false` if the request
   *  is denied, errors, or the control is disabled/unsupported/already active/requesting. */
  async start(): Promise<boolean> {
    if (this.disabled || this._state === 'recording' || this._state === 'requesting') return false;
    const owner = this.ownerWindow;
    if (!isPushToTalkSupported(owner)) return false;
    this.captureWindow = owner;
    this.cancelRequested = false;
    this.setState('requesting');
    try {
      const additionalConstraints = {
        ...(this.audioConstraints ?? {}),
      } as MediaTrackConstraints;
      delete additionalConstraints.deviceId;
      const constraints: MediaStreamConstraints = {
        audio: {
          ...additionalConstraints,
          ...(this.deviceId ? { deviceId: { exact: this.deviceId } } : {}),
        },
      };
      const stream = await owner.navigator.mediaDevices.getUserMedia(constraints);
      if (
        this.disabled ||
        !this.isConnected ||
        this.cancelRequested ||
        this.captureWindow !== owner ||
        this.ownerWindow !== owner
      ) {
        for (const track of stream.getTracks()) track.stop();
        this.cancelRequested = false;
        if (this.captureWindow === owner) this.captureWindow = undefined;
        this.setState('idle');
        this.emit('lr-record-cancel', null);
        this.announce(this.localize('pushToTalkCancelled'));
        return false;
      }
      this._stream = stream;
      const mimeType = this.resolveMimeType(owner);
      const recorder = new owner.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.recorder = recorder;
      this.recorderStopRequested = false;
      this.recorderFailed = false;
      this.chunks = [];
      const timeslice =
        this.timesliceMs > 0 ? finiteDuration(this.timesliceMs, MAX_TIMEOUT_MS, 1, MAX_TIMEOUT_MS) : undefined;
      const emitChunksForTake = timeslice !== undefined;
      recorder.ondataavailable = (e: BlobEvent) => {
        if (this.recorder !== recorder || this.captureWindow !== owner) return;
        if (!e.data || e.data.size === 0) return;
        this.chunks.push(e.data);
        if (emitChunksForTake) this.emit('lr-record-chunk', { blob: e.data });
      };
      recorder.onstop = () => this.finalizeStop(recorder, owner);
      recorder.onerror = (event: Event) =>
        this.failRecorder(
          recorder,
          owner,
          (event as Event & { error?: DOMException }).error ?? new Error('MediaRecorder failed')
        );
      // Both duration-like properties are clamped right here, at the point they reach a native
      // timer/API, rather than by normalizing the public property itself -- same convention as
      // lr-sequence-playback's scheduleTick() for interval-ms. `> 0` already excludes
      // NaN/negative (both
      // fail that comparison), but not Infinity or an oversized finite value that would otherwise
      // overflow setTimeout's 32-bit delay or fail MediaRecorder.start()'s unsigned-long timeslice.
      recorder.start(timeslice);
      this.recordingStartedAt = owner.performance.now();
      this.elapsedMs = 0;
      this.setState('recording');
      this.emit('lr-record-start', { stream });
      this.announce(this.localize('pushToTalkStarted'));
      this.syncLevelMeter(owner);
      this.syncMaxDurationTimer(owner, true);
      this.syncElapsedTimer(owner, true);
      return true;
    } catch (err) {
      this.teardownStream();
      if (this.cancelRequested || this.disabled || !this.isConnected || this.ownerWindow !== owner) {
        this.cancelRequested = false;
        this.setState('idle');
        this.emit('lr-record-cancel', null);
        if (this.isConnected) this.announce(this.localize('pushToTalkCancelled'));
        return false;
      }
      const denied = typeof err === 'object' && err !== null && 'name' in err && err.name === 'NotAllowedError';
      this.setState(denied ? 'denied' : 'error');
      this.emit('lr-record-error', { error: err as DOMException | Error });
      this.announce(this.localize(denied ? 'pushToTalkDenied' : 'pushToTalkError'));
      return false;
    }
  }

  /** Stops the active take, finalizing it via `lr-record-stop`. No-op unless `state === 'recording'`. */
  stop(): void {
    this.requestRecorderStop(false);
  }

  /** Discards the active or pending take: fires `lr-record-cancel`, never `lr-record-stop`. */
  cancel(): void {
    if (this._state === 'requesting') {
      this.cancelRequested = true;
      return;
    }
    if (this._state !== 'recording') return;
    this.requestRecorderStop(true);
  }

  private requestRecorderStop(cancelled: boolean): void {
    if (this._state !== 'recording') return;
    if (cancelled) this.cancelRequested = true;
    if (this.recorderStopRequested) return;
    this.recorderStopRequested = true;
    this.stopRuntimeLoops();
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  private finalizeStop(recorder: MediaRecorder, owner: PushToTalkWindow): void {
    if (this.recorder !== recorder || this.captureWindow !== owner || this.recorderFailed) return;
    const cancelled = this.cancelRequested;
    const durationMs = Math.round(owner.performance.now() - this.recordingStartedAt);
    const mimeType = recorder.mimeType || this.resolveMimeType(owner) || 'audio/webm';
    const blob = new owner.Blob(this.chunks, { type: mimeType });
    this.teardownStream();
    this.setState('idle');
    if (cancelled) {
      this.emit('lr-record-cancel', null);
      this.announce(this.localize('pushToTalkCancelled'));
    } else {
      this.emit('lr-record-stop', { blob, durationMs });
      this.announce(this.localize('pushToTalkStopped'));
    }
    this.cancelRequested = false;
  }

  private failRecorder(recorder: MediaRecorder, owner: PushToTalkWindow, error: DOMException | Error): void {
    // Cancellation owns the terminal outcome. MediaRecorder may report an asynchronous error
    // between cancel() calling stop() and the corresponding stop event; allowing that callback to
    // clear the flag would turn the promised cancel event into a spurious recorder error.
    if (
      this.recorder !== recorder ||
      this.captureWindow !== owner ||
      this.recorderFailed ||
      this.cancelRequested
    ) return;
    this.recorderFailed = true;
    this.cancelRequested = false;
    this.teardownStream();
    this.setState('error');
    this.emit('lr-record-error', { error });
    this.announce(this.localize('pushToTalkError'));
  }

  private teardownStream(): void {
    for (const track of this._stream?.getTracks() ?? []) track.stop();
    this._stream = null;
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.onerror = null;
    }
    this.recorder = undefined;
    this.recorderStopRequested = false;
    this.chunks = [];
    this.stopRuntimeLoops();
    this.captureWindow = undefined;
  }

  private stopRuntimeLoops(): void {
    if (this.tickTimer) this.tickTimer.owner.clearInterval(this.tickTimer.handle);
    this.tickTimer = undefined;
    if (this.maxDurationTimer) this.maxDurationTimer.owner.clearTimeout(this.maxDurationTimer.handle);
    this.maxDurationTimer = undefined;
    this.stopLevelMeter();
  }

  private syncElapsedTimer(owner: PushToTalkWindow, initial = false): void {
    if (this.tickTimer) this.tickTimer.owner.clearInterval(this.tickTimer.handle);
    this.tickTimer = undefined;
    if (!this.showTimer || this._state !== 'recording' || this.captureWindow !== owner) return;
    if (!initial) this.elapsedMs = owner.performance.now() - this.recordingStartedAt;
    const timer: OwnedTimer = { owner, handle: 0 };
    timer.handle = owner.setInterval(() => {
      if (this.tickTimer !== timer || this.captureWindow !== owner || this._state !== 'recording') return;
      this.elapsedMs = owner.performance.now() - this.recordingStartedAt;
    }, 1000);
    this.tickTimer = timer;
  }

  private syncMaxDurationTimer(owner: PushToTalkWindow, initial = false): void {
    if (this.maxDurationTimer) this.maxDurationTimer.owner.clearTimeout(this.maxDurationTimer.handle);
    this.maxDurationTimer = undefined;
    if (this.maxDurationMs <= 0 || this._state !== 'recording' || this.captureWindow !== owner) return;
    const duration = finiteDuration(this.maxDurationMs, MAX_TIMEOUT_MS, 1, MAX_TIMEOUT_MS);
    const elapsed = initial ? 0 : Math.max(0, owner.performance.now() - this.recordingStartedAt);
    const timer: OwnedTimer = { owner, handle: 0 };
    timer.handle = owner.setTimeout(() => {
      if (this.maxDurationTimer !== timer || this.captureWindow !== owner) return;
      this.maxDurationTimer = undefined;
      this.stop();
    }, Math.max(0, duration - elapsed));
    this.maxDurationTimer = timer;
  }

  private syncLevelMeter(owner: PushToTalkWindow): void {
    if (!this.levelEvents || this._state !== 'recording' || this.captureWindow !== owner || !this._stream) {
      this.stopLevelMeter();
      return;
    }
    if (!this.audioCtx) this.startLevelMeter(this._stream, owner);
  }

  private startLevelMeter(stream: MediaStream, owner: PushToTalkWindow): void {
    const AudioCtxCtor = owner.AudioContext ?? owner.webkitAudioContext;
      if (!AudioCtxCtor) return;
      const audioCtx = new AudioCtxCtor();
      this.audioCtx = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      this.analyser = analyser;
      analyser.fftSize = 256;
      source.connect(analyser);
      this.levelData = new owner.Uint8Array(analyser.frequencyBinCount);
      this.sampleLevel(owner);
  }

  private sampleLevel(owner: PushToTalkWindow): void {
    if (!this.analyser || !this.levelData || this._state !== 'recording' || this.captureWindow !== owner) {
      return;
    }
    this.analyser.getByteTimeDomainData(this.levelData);
    let sumSquares = 0;
    for (const v of this.levelData) {
      const norm = (v - 128) / 128;
      sumSquares += norm * norm;
    }
    const rms = Math.sqrt(sumSquares / this.levelData.length);
    this.emit('lr-level', { level: Math.min(1, rms) });
    const request: OwnedAnimationFrame = { owner, handle: 0 };
    request.handle = owner.requestAnimationFrame(() => {
      if (this.levelFrame !== request) return;
      this.levelFrame = undefined;
      if (!this.isConnected || this.ownerWindow !== owner) return;
      this.sampleLevel(owner);
    });
    this.levelFrame = request;
  }

  private stopLevelMeter(): void {
    if (this.levelFrame) this.levelFrame.owner.cancelAnimationFrame(this.levelFrame.handle);
    this.levelFrame = undefined;
    this.analyser = undefined;
    this.levelData = undefined;
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = undefined;
    }
  }

  private formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const locale = this.effectiveLocale;
    const minuteText = getNumberFormat(locale, { useGrouping: false }).format(minutes);
    const secondText = getNumberFormat(locale, {
      minimumIntegerDigits: 2,
      useGrouping: false,
    }).format(seconds);
    return `${minuteText}:${secondText}`;
  }

  // -- Pointer (hold mode) ----------------------------------------------
  private onPointerDown = (e: PointerEvent): void => {
    if (this.mode !== 'hold' || this.disabled) return;
    e.preventDefault();
    // Firefox throws NotFoundError when a synthetic pointerdown carries an id that is not in its
    // active-pointer registry; a real pointer can also disappear between dispatch and capture.
    // Capture improves release delivery but is not a prerequisite for requesting the microphone,
    // so that platform race must not abort the gesture.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Continue with the hold gesture; pointerup/blur/cancel still share the same release path.
    }
    if (this.holdGesture) return;
    this.holdGesture = {
      generation: ++this.holdGestureGeneration,
      source: 'pointer',
      pointerId: e.pointerId,
    };
    void this.start();
  };
  private onPointerUp = (event: PointerEvent): void => {
    if (this.holdGesture?.source !== 'pointer' || this.holdGesture.pointerId !== event.pointerId) return;
    this.releaseHoldGesture();
  };
  private onPointerCancel = (event: PointerEvent): void => {
    if (this.holdGesture?.source !== 'pointer' || this.holdGesture.pointerId !== event.pointerId) return;
    this.releaseHoldGesture();
  };
  /** Ends a hold-mode press: stops an active take, or cancels a still-pending permission request
   *  so recording never silently starts after the user already let go. Mirrors
   *  disconnectedCallback()'s identical dual check. */
  private releaseHoldGesture(): void {
    if (!this.holdGesture) return;
    this.holdGesture = undefined;
    this.holdGestureGeneration += 1;
    if (this._state === 'requesting') this.cancel();
    else this.stop();
  }

  // -- Keyboard -----------------------------------------------------------
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (this.mode !== 'hold') return; // toggle mode: native click activation (onClick) handles it
    // Key auto-repeat must not restart the take -- only the initiating (non-repeat) keydown starts
    // it. Calling preventDefault() here also suppresses the browser's own synthetic click
    // activation for both Enter (queued on keydown) and Space (queued on keyup, but suppressed by
    // an uncanceled corresponding keydown per the HTML activation-behavior spec), so hold mode's
    // pointerup-driven stop() never races a spurious toggle-mode-style click.
    if (e.repeat) return;
    e.preventDefault();
    if (this.holdGesture) return;
    this.holdGesture = {
      generation: ++this.holdGestureGeneration,
      source: 'keyboard',
      key: e.key,
    };
    void this.start();
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (this.holdGesture?.source !== 'keyboard' || this.holdGesture.key !== e.key) return;
    this.releaseHoldGesture();
  };
  private onBlur = (): void => {
    this.releaseHoldGesture();
  };

  // -- Toggle mode ----------------------------------------------------------
  private onClick = (): void => {
    if (this.mode !== 'toggle' || this.disabled) return;
    if (this._state === 'recording') this.stop();
    else void this.start();
  };

  private get triggerLabel(): string {
    // A host-level `aria-label` (set directly on `<lr-push-to-talk>`, not the shadow-DOM button
    // that actually owns the button role) wins over the computed default -- mirrors lr-slider's
    // identical `this.getAttribute('aria-label')` fallback for the same reason: the host itself
    // carries no role, so its `aria-label` is otherwise inert, but a caller supplying one clearly
    // intends it to name the interactive control inside.
    const override = this.getAttribute('aria-label');
    if (override !== null) return override;
    if (this.mode === 'hold') return this.localize('pushToTalkHold');
    return this._state === 'recording' ? this.localize('pushToTalkStop') : this.localize('pushToTalkStart');
  }

  private get statusText(): string {
    if (!this.captureSupported) return this.localize('pushToTalkUnsupported');
    switch (this._state) {
      case 'requesting':
        return this.localize('pushToTalkRequesting');
      case 'denied':
        return this.localize('pushToTalkDenied');
      case 'error':
        return this.localize('pushToTalkError');
      default:
        return '';
    }
  }

  override render(): TemplateResult {
    const supported = this.captureSupported;
    const recording = this._state === 'recording';
    const status = this.statusText;
    return html`
      <button
        part="trigger"
        type="button"
        aria-label=${this.triggerLabel}
        aria-pressed=${this.mode === 'toggle' ? (recording ? 'true' : 'false') : nothing}
        ?disabled=${this.disabled || !supported}
        @pointerdown=${this.onPointerDown}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerCancel}
        @keydown=${this.onKeyDown}
        @keyup=${this.onKeyUp}
        @blur=${this.onBlur}
        @click=${this.onClick}
      >
        <span part="icon" aria-hidden="true" inert><slot name="microphone-icon">${micIcon()}</slot></span>
        ${recording
          ? html`<span part="pulse" aria-hidden="true" inert><slot name="recording-icon">${pulseGlyph()}</slot></span>`
          : nothing}
      </button>
      ${status ? html`<span part="status">${status}</span>` : nothing}
      ${recording && this.showTimer
        ? html`<span part="timer" aria-hidden="true">${this.formatElapsed(this.elapsedMs)}</span>`
        : nothing}
      <lr-live-region></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-push-to-talk': LyraPushToTalk;
  }
}
