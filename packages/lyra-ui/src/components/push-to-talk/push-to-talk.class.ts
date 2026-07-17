import { html, nothing, svg, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.class.js';
import { styles } from './push-to-talk.styles.js';

export type PushToTalkMode = 'hold' | 'toggle';
export type PushToTalkState = 'idle' | 'requesting' | 'denied' | 'recording' | 'error';

const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function isPushToTalkSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

// One-off local glyphs, matching lyra-attachment-trigger's convention of keeping single-use icons
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
  'lyra-record-start': CustomEvent<{ stream: MediaStream }>;
  'lyra-record-chunk': CustomEvent<{ blob: Blob }>;
  'lyra-record-stop': CustomEvent<{ blob: Blob; durationMs: number }>;
  'lyra-record-cancel': CustomEvent<undefined>;
  'lyra-record-error': CustomEvent<{ error: DOMException | Error }>;
  'lyra-level': CustomEvent<{ level: number }>;
  'lyra-state-change': CustomEvent<{ state: PushToTalkState }>;
}

/**
 * `<lyra-push-to-talk>` — a mic capture button owning the full `getUserMedia` + `MediaRecorder`
 * lifecycle: permission request, recording, optional chunked streaming, teardown. The one place in
 * this library that touches the microphone — no SDK, no LiveKit/ElevenLabs import, native browser
 * APIs only.
 *
 * `mode="hold"` (the default) is a press-and-hold gesture: pointerdown/Enter-or-Space-keydown starts,
 * pointerup/keyup/blur stops. `mode="toggle"` is click-to-start/click-to-stop with `aria-pressed`.
 * Escape cancels the in-progress take in either mode (discarding it — `lyra-record-cancel`, never
 * `lyra-record-stop`). `state` is a read-only lifecycle reflected to the `data-state` attribute (not
 * `state`, avoiding any ambiguity with a native form-control `state`): `'idle' | 'requesting' |
 * 'denied' | 'recording' | 'error'`. A host-level `aria-label` (set on `<lyra-push-to-talk>` itself)
 * overrides the computed trigger label.
 *
 * @customElement lyra-push-to-talk
 * @slot icon - Replaces the default mic glyph.
 * @slot recording-icon - Replaces the default recording-state pulse glyph.
 * @event lyra-record-start - Capture began. `detail: { stream: MediaStream }` — the same object the
 *   `stream` getter then returns for the duration of the take.
 * @event lyra-record-chunk - A `timeslice-ms` slice was produced (only fires when `timeslice-ms > 0`,
 *   in order). `detail: { blob: Blob }` — a container fragment, decodable only once concatenated from
 *   the first chunk of the take.
 * @event lyra-record-stop - The take finished normally. `detail: { blob: Blob; durationMs: number }`
 *   — `durationMs` excludes the `requesting` phase.
 * @event lyra-record-cancel - The take was discarded via `cancel()`/Escape — no detail, and
 *   `lyra-record-stop` never fires for this take.
 * @event lyra-record-error - The capture request failed. `detail: { error: DOMException | Error }` —
 *   `NotAllowedError` transitions `state` to `'denied'`, anything else to `'error'`.
 * @event lyra-level - `detail: { level: number }` (0-1 RMS amplitude), opt-in via `level-events`,
 *   rAF-throttled, only while `state === 'recording'`.
 * @event lyra-state-change - `detail: { state: PushToTalkState }` — fires on every `state` transition.
 * @csspart trigger - The capture button.
 * @csspart icon - Wrapper around the `icon` slot / default mic glyph.
 * @csspart pulse - Wrapper around the `recording-icon` slot / default pulse glyph, rendered only
 *   while recording.
 * @csspart timer - The `M:SS` elapsed-time readout, rendered only while recording and `show-timer`.
 * @csspart status - Visible status text for the `requesting`/`denied`/`error`/unsupported states.
 */
export class LyraPushToTalk extends LyraElement<LyraPushToTalkEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ reflect: true }) mode: PushToTalkMode = 'hold';
  @property({ type: Number, attribute: 'timeslice-ms' }) timesliceMs = 0;
  @property({ attribute: 'mime-type' }) mimeType = '';
  @property({ attribute: 'device-id' }) deviceId = '';
  /** Merged into the audio constraints (`echoCancellation`, …); unset keeps browser defaults. */
  @property({ attribute: false }) audioConstraints?: MediaTrackConstraints;
  @property({ type: Boolean, attribute: 'level-events' }) levelEvents = false;
  /** `> 0` auto-stops the take at this many milliseconds (a stuck-key guard); `0` (the default)
   *  never auto-stops. */
  @property({ type: Number, attribute: 'max-duration-ms' }) maxDurationMs = 0;
  @property({ type: Boolean, attribute: 'show-timer' }) showTimer = true;
  @property({ type: Boolean, reflect: true }) disabled = false;

  @state() private elapsedMs = 0;

  private _state: PushToTalkState = 'idle';
  /** Read-only recording lifecycle, reflected to the `data-state` attribute. Drive it via
   *  `start()`/`stop()`/`cancel()`, never by assignment. */
  get state(): PushToTalkState {
    return this._state;
  }
  // No-op setter so `el.state = x` doesn't throw in strict mode -- mirrors lyra-animated-image's
  // identical read-only `playing` accessor.
  set state(_next: PushToTalkState) {}

  private _stream: MediaStream | null = null;
  /** The active `MediaStream` — the same object `lyra-record-start` carries. `null` outside an
   *  active take. */
  get stream(): MediaStream | null {
    return this._stream;
  }

  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;

  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private recordingStartedAt = 0;
  private cancelRequested = false;
  private tickTimer?: ReturnType<typeof setInterval>;
  private maxDurationTimer?: ReturnType<typeof setTimeout>;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private levelData?: Uint8Array<ArrayBuffer>;
  private levelRafId?: number;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('data-state')) this.setAttribute('data-state', this._state);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._state === 'recording' || this._state === 'requesting') this.cancel();
  }

  private resolveMimeType(): string {
    if (this.mimeType) return this.mimeType;
    for (const candidate of CANDIDATE_MIME_TYPES) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(candidate)) return candidate;
    }
    return '';
  }

  private setState(next: PushToTalkState): void {
    if (this._state === next) return;
    const old = this._state;
    this._state = next;
    this.setAttribute('data-state', next);
    this.requestUpdate('state', old);
    this.emit<{ state: PushToTalkState }>('lyra-state-change', { state: next });
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
    if (!isPushToTalkSupported()) return false;
    this.cancelRequested = false;
    this.setState('requesting');
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...(this.deviceId ? { deviceId: { exact: this.deviceId } } : {}),
          ...(this.audioConstraints ?? {}),
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.cancelRequested) {
        for (const track of stream.getTracks()) track.stop();
        this.cancelRequested = false;
        this.setState('idle');
        this.emit('lyra-record-cancel');
        this.announce(this.localize('pushToTalkCancelled'));
        return false;
      }
      this._stream = stream;
      const mimeType = this.resolveMimeType();
      this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.recorder.ondataavailable = (e: BlobEvent) => {
        if (!e.data || e.data.size === 0) return;
        this.chunks.push(e.data);
        if (this.timesliceMs > 0) this.emit<{ blob: Blob }>('lyra-record-chunk', { blob: e.data });
      };
      this.recorder.onstop = () => this.finalizeStop();
      this.recorder.start(this.timesliceMs > 0 ? this.timesliceMs : undefined);
      this.recordingStartedAt = performance.now();
      this.elapsedMs = 0;
      this.setState('recording');
      this.emit<{ stream: MediaStream }>('lyra-record-start', { stream });
      this.announce(this.localize('pushToTalkStarted'));
      if (this.levelEvents) this.startLevelMeter(stream);
      if (this.maxDurationMs > 0) this.maxDurationTimer = setTimeout(() => this.stop(), this.maxDurationMs);
      if (this.showTimer) {
        this.tickTimer = setInterval(() => {
          this.elapsedMs = performance.now() - this.recordingStartedAt;
        }, 1000);
      }
      return true;
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError';
      this.setState(denied ? 'denied' : 'error');
      this.emit<{ error: DOMException | Error }>('lyra-record-error', { error: err as DOMException | Error });
      return false;
    }
  }

  /** Stops the active take, finalizing it via `lyra-record-stop`. No-op unless `state === 'recording'`. */
  stop(): void {
    if (this._state !== 'recording') return;
    this.recorder?.stop();
  }

  /** Discards the active or pending take: fires `lyra-record-cancel`, never `lyra-record-stop`. */
  cancel(): void {
    if (this._state === 'requesting') {
      this.cancelRequested = true;
      return;
    }
    if (this._state !== 'recording') return;
    this.cancelRequested = true;
    this.recorder?.stop();
  }

  private finalizeStop(): void {
    const cancelled = this.cancelRequested;
    const durationMs = Math.round(performance.now() - this.recordingStartedAt);
    const mimeType = this.recorder?.mimeType || this.resolveMimeType() || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mimeType });
    this.teardownStream();
    this.setState('idle');
    if (cancelled) {
      this.emit('lyra-record-cancel');
      this.announce(this.localize('pushToTalkCancelled'));
    } else {
      this.emit<{ blob: Blob; durationMs: number }>('lyra-record-stop', { blob, durationMs });
      this.announce(this.localize('pushToTalkStopped'));
    }
    this.cancelRequested = false;
  }

  private teardownStream(): void {
    for (const track of this._stream?.getTracks() ?? []) track.stop();
    this._stream = null;
    this.recorder = undefined;
    this.chunks = [];
    if (this.tickTimer !== undefined) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    if (this.maxDurationTimer !== undefined) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = undefined;
    }
    this.stopLevelMeter();
  }

  private startLevelMeter(stream: MediaStream): void {
    const AudioCtxCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;
    this.audioCtx = new AudioCtxCtor();
    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.levelData = new Uint8Array(this.analyser.frequencyBinCount);
    this.tickLevel();
  }

  private tickLevel = (): void => {
    if (!this.analyser || !this.levelData || this._state !== 'recording') return;
    this.analyser.getByteTimeDomainData(this.levelData);
    let sumSquares = 0;
    for (const v of this.levelData) {
      const norm = (v - 128) / 128;
      sumSquares += norm * norm;
    }
    const rms = Math.sqrt(sumSquares / this.levelData.length);
    this.emit<{ level: number }>('lyra-level', { level: Math.min(1, rms) });
    this.levelRafId = requestAnimationFrame(this.tickLevel);
  };

  private stopLevelMeter(): void {
    if (this.levelRafId !== undefined) {
      cancelAnimationFrame(this.levelRafId);
      this.levelRafId = undefined;
    }
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
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  // -- Pointer (hold mode) ----------------------------------------------
  private onPointerDown = (e: PointerEvent): void => {
    if (this.mode !== 'hold' || this.disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    void this.start();
  };
  private onPointerUp = (): void => {
    if (this.mode !== 'hold') return;
    this.releaseHold();
  };
  private onPointerCancel = (): void => {
    if (this.mode !== 'hold') return;
    this.releaseHold();
  };
  /** Ends a hold-mode press: stops an active take, or cancels a still-pending permission request
   *  so recording never silently starts after the user already let go. Mirrors
   *  disconnectedCallback()'s identical dual check. */
  private releaseHold(): void {
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
    void this.start();
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.mode !== 'hold') return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    this.releaseHold();
  };
  private onBlur = (): void => {
    if (this.mode === 'hold') this.releaseHold();
  };

  // -- Toggle mode ----------------------------------------------------------
  private onClick = (): void => {
    if (this.mode !== 'toggle' || this.disabled) return;
    if (this._state === 'recording') this.stop();
    else void this.start();
  };

  private get triggerLabel(): string {
    // A host-level `aria-label` (set directly on `<lyra-push-to-talk>`, not the shadow-DOM button
    // that actually owns the button role) wins over the computed default -- mirrors lyra-slider's
    // identical `this.getAttribute('aria-label')` fallback for the same reason: the host itself
    // carries no role, so its `aria-label` is otherwise inert, but a caller supplying one clearly
    // intends it to name the interactive control inside.
    const override = this.getAttribute('aria-label');
    if (override) return override;
    if (this.mode === 'hold') return this.localize('pushToTalkHold');
    return this._state === 'recording' ? this.localize('pushToTalkStop') : this.localize('pushToTalkStart');
  }

  private get statusText(): string {
    if (!isPushToTalkSupported()) return this.localize('pushToTalkUnsupported');
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

  render(): TemplateResult {
    const supported = isPushToTalkSupported();
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
        <span part="icon"><slot name="icon">${micIcon()}</slot></span>
        ${recording ? html`<span part="pulse"><slot name="recording-icon">${pulseGlyph()}</slot></span>` : nothing}
      </button>
      ${status ? html`<span part="status">${status}</span>` : nothing}
      ${recording && this.showTimer
        ? html`<span part="timer" aria-hidden="true">${this.formatElapsed(this.elapsedMs)}</span>`
        : nothing}
      <lyra-live-region></lyra-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-push-to-talk': LyraPushToTalk;
  }
}
