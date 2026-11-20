import { VisibilityGate, watchDevicePixelRatio } from '../../../internal/owned-observer.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { parseCssTimeToken } from '../../../internal/css-motion-time.js';
import { observeReducedMotion } from '../../../internal/motion-observer.js';
import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { OwnedFrame } from '../../../internal/owned-timer.js';
import { DEFAULT_CANVAS_COLOR, resolveCanvasColor } from '../../../internal/canvas-color.js';
import { literalSetConverter, blankNumberConverter } from '../../../internal/converters.js';
import { styles } from './audio-visualizer.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_audioVisualizerIdle, LYRA_DEFAULT_audioVisualizerLabel, LYRA_DEFAULT_audioVisualizerListening, LYRA_DEFAULT_audioVisualizerSpeaking, LYRA_DEFAULT_audioVisualizerThinking } from '../../../internal/default-strings/conversation.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type AudioVisualizerMode = 'bars' | 'waveform';
export type AudioVisualizerState = 'idle' | 'listening' | 'thinking' | 'speaking';

const AUDIO_VISUALIZER_MODE = literalSetConverter<AudioVisualizerMode>(['bars', 'waveform'], 'bars');
const AUDIO_VISUALIZER_STATE = literalSetConverter<AudioVisualizerState>(
  ['idle', 'listening', 'thinking', 'speaking'],
  'idle',
);

const WAVEFORM_SAMPLES = 64;
const AMBIENT_REDUCED_MOTION_INTERVAL_MS = 500; // ~2 Hz snapshot cadence
const DEFAULT_AMBIENT_DURATION_MS = 1800; // mirrors --lr-duration-ambient's default

/** Parses the time-only custom property used to phase ambient canvas motion. CSS custom properties
 * keep their raw token sequence until their consuming declaration is evaluated, so deliberately
 * reject compound transition values (such as `1.8s ease-in-out`) rather than accepting a prefix. */
function parseAmbientDuration(value: string): number | undefined {
  const token = parseCssTimeToken(value);
  return token && !token.rest && token.ms > 0 ? token.ms : undefined;
}

/** Multiplies two untrusted canvas inputs without allowing an overflowing intermediate to escape
 * the requested drawing range. `finiteRange()` intentionally falls back for non-finite values;
 * an overflow has a known sign, so it saturates at that edge instead. */
function clampAmplitudeProduct(amplitude: number, gain: number, min: number, max: number): number {
  const product = finiteNumber(amplitude, 0) * finiteNumber(gain, 1);
  if (Number.isFinite(product)) return finiteRange(product, 0, min, max);
  if (product > 0) return max;
  if (product < 0) return min;
  return 0;
}

/**
 * `<lr-audio-visualizer>` — a presentational, canvas-drawn voice-activity visualization. Its
 * `mode` is `"bars"` (default) or `"waveform"`. Driven by a `MediaStream`
 * (lazily wired to a WebAudio `AnalyserNode`), a numeric `level` for hosts that already compute
 * levels (e.g. `lr-push-to-talk`'s `lr-level`), or `state` alone for an ambient animation when no
 * real signal exists. A real signal (`stream` or `level`) always drives amplitude regardless of
 * `prefers-reduced-motion` — that is live, user-controlled feedback, not decorative motion; only the
 * signal-less ambient animation is throttled and simplified under reduced motion.
 *
 * Animation frames are only scheduled while the drawn output is actually time-varying (live analyser
 * data, or a non-reduced ambient pulse/sweep). Static output — a constant `level`, idle bars, or the
 * flattened reduced-motion ambient patterns — draws once and stops; any change that could alter the
 * next frame (properties, stream/`AudioContext` state, size, theme, motion preference) re-enters the
 * loop via `scheduleDraw()`. The loop is also paused while the host is scrolled off-screen (an
 * `IntersectionObserver`-gated `visible` flag, mirroring `<lr-chart>`'s own `draw()` gating), so a
 * live-signal visualizer buried behind later transcript messages doesn't keep repainting for nobody.
 * Canvas-bound theme colors are materialized through a live DOM color probe before drawing, so
 * `currentColor`, inherited expressions, and invalid values cannot silently paint as stale black.
 *
 * @customElement lr-audio-visualizer
 * @csspart base - The root wrapper.
 * @csspart canvas - The drawing surface (`aria-hidden`; the host itself carries `role="img"` and the
 *   accessible name).
 * @cssprop [--lr-audio-visualizer-color=var(--lr-color-brand)] - Active bar/waveform color.
 * @cssprop [--lr-audio-visualizer-quiet-color=var(--lr-color-brand-border-normal)] - Inactive/idle
 *   color. Chosen over `--lr-color-brand-quiet` for its WCAG 1.4.11 non-text contrast against
 *   `--lr-color-surface` (the idle bars have no other distinguishing shape or border).
 * @cssprop [--lr-audio-visualizer-height=var(--lr-size-3rem)] - The host's block size, which the
 *   canvas fills at 100%.
 * @cssprop [--lr-audio-visualizer-ambient-duration=var(--lr-duration-ambient)] - Time-only
 *   duration of one signal-less ambient pulse or sweep cycle.
 * @status stable
 * @since 4.0.0
 */
export class LyraAudioVisualizer extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    audioVisualizerIdle: LYRA_DEFAULT_audioVisualizerIdle,
    audioVisualizerLabel: LYRA_DEFAULT_audioVisualizerLabel,
    audioVisualizerListening: LYRA_DEFAULT_audioVisualizerListening,
    audioVisualizerSpeaking: LYRA_DEFAULT_audioVisualizerSpeaking,
    audioVisualizerThinking: LYRA_DEFAULT_audioVisualizerThinking,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, 'role'])];
  }

  @property({ attribute: false }) stream: MediaStream | null = null;
  /** Externally-computed amplitude, `[0, 1]`, for a host that already derives its own level
   *  (e.g. `lr-push-to-talk`'s `lr-level`). `null` (the default) means "no external signal" --
   *  see `effectiveLevel` for how a non-null value is clamped/NaN-guarded before it feeds `draw()`. */
  @property({ converter: blankNumberConverter(null) }) level: number | null = null;
  private _state: AudioVisualizerState = 'idle';
  @property({ reflect: true, converter: AUDIO_VISUALIZER_STATE })
  get state(): AudioVisualizerState {
    return this._state;
  }
  set state(next: AudioVisualizerState) {
    const normalized = AUDIO_VISUALIZER_STATE.normalize(next);
    const old = this._state;
    if (old === normalized) return;
    this._state = normalized;
    this.requestUpdate('state', old);
  }
  private _mode: AudioVisualizerMode = 'bars';
  /** Drawing vocabulary: discrete `bars` or a continuous `waveform`. */
  @property({ reflect: true, converter: AUDIO_VISUALIZER_MODE })
  get mode(): AudioVisualizerMode {
    return this._mode;
  }
  set mode(next: AudioVisualizerMode) {
    const normalized = AUDIO_VISUALIZER_MODE.normalize(next);
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
  }
  @property({ attribute: 'bar-count', converter: blankNumberConverter(5) }) barCount = 5;
  /** Amplitude multiplier applied in `draw()`. NaN/non-finite falls back to `1` via `effectiveGain`. */
  @property({ converter: blankNumberConverter(1) }) gain = 1;
  /** Accessible-name override. Unset (the default) auto-generates "Voice activity: {state}"; an
   *  explicit empty string (`label=""` or `.label = ''`) suppresses that default and renders an
   *  empty accessible name, which makes the host `role="presentation"` instead of an unnamed image. */
  @property() label?: string;

  @query('canvas') private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private stopDprWatch?: () => void;
  private stopMotionWatch?: () => void;
  private reducedMotion = false;
  private readonly drawFrameRequest = new OwnedFrame(this);
  private lastAmbientDrawMs = 0;
  private nextTrackCheckMs = 0;
  private readonly amplitudes: number[] = [];
  private generatedAriaLabel?: string;
  private generatedRole?: string;
  /** Host size cached from the `ResizeObserver` so `draw()` never forces a per-frame layout read. */
  private hostSize?: { width: number; height: number };
  /** Token colors resolved once per theme change so `draw()` never calls `getComputedStyle` per frame. */
  private resolvedColors?: { active: string; quiet: string };
  /** Time-only ambient cycle duration resolved once per theme scope, avoiding a style read per frame. */
  private ambientDurationMs?: number;

  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private sourceNode?: MediaStreamAudioSourceNode;
  private timeDomainData?: Uint8Array<ArrayBuffer>;

  private readonly visibility = new VisibilityGate(this, {
    onVisible: (visible, wasPaintable) => {
      if (!visible) this.cancelDrawFrame();
      else if (!wasPaintable) this.scheduleDraw();
    },
  });

  private get effectiveBarCount(): number {
    return finiteInteger(this.barCount, 5, 1, 64);
  }

  /** `level` normalized to `[0, 1]`, or `null` when no external signal is set. A non-null-but-NaN
   *  `level` (e.g. a bad attribute) still counts as "level-driven" (see `hasLiveSignal`) but
   *  clamps to `0` here rather than flowing NaN into the canvas draw. */
  private get effectiveLevel(): number | null {
    return this.level == null ? null : finiteRange(this.level, 0, 0, 1);
  }

  private get effectiveGain(): number {
    return finiteNumber(this.gain, 1);
  }

  constructor() {
    super();
    this.requestUpdate('state', undefined);
    this.requestUpdate('mode', undefined);
    // Redraws when prefers-color-scheme flips or an ancestor's theme attribute mutates. The
    // controller registers itself with the host via addController().
    new ThemeWatcher(this, () => this.refreshTheme());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const owner = this.ownerDocument.defaultView;
    if (!owner) return;
    const ResizeObserverCtor = owner.ResizeObserver;
    if (ResizeObserverCtor) {
      let observer: ResizeObserver;
      observer = new ResizeObserverCtor((entries) => {
        if (
          !this.isConnected ||
          this.ownerDocument.defaultView !== owner ||
          this.resizeObserver !== observer
        ) {
          return;
        }
        const rect = entries[entries.length - 1]?.contentRect;
        if (rect) this.hostSize = { width: rect.width, height: rect.height };
        this.scheduleDraw();
      });
      this.resizeObserver = observer;
      observer.observe(this);
    }
    this.stopDprWatch = watchDevicePixelRatio(owner, this.scheduleDraw);
    // The draw loop parks itself while ambient output is static under reduced motion, so a
    // preference flip must restart it (and re-simplify/re-animate the pattern) explicitly.
    this.reducedMotion = prefersReducedMotion(this);
    this.stopMotionWatch = observeReducedMotion(this, (reduced) => {
      this.reducedMotion = reduced;
      if (this.isConnected) this.scheduleDraw();
    });
    // A reconnect may land under a different theme scope, so neither canvas colors nor the ambient
    // cycle duration can safely survive it.
    this.resolvedColors = undefined;
    this.ambientDurationMs = undefined;
    this.syncAnalyser();
    this.lastAmbientDrawMs = 0;
    this.scheduleDraw();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.hostSize = undefined;
    this.stopDprWatch?.();
    this.stopDprWatch = undefined;
    this.clearMotionWatcher();
    this.cancelDrawFrame();
    this.closeAudioContext();
  }

  private clearMotionWatcher(): void {
    this.stopMotionWatch?.();
    this.stopMotionWatch = undefined;
  }

  /** Redraws canvas content after an upstream token or theme change. */
  refreshTheme(): void {
    this.resolvedColors = undefined;
    this.ambientDurationMs = undefined;
    this.scheduleDraw();
  }

  private get hasUsableAudioStream(): boolean {
    if (!this.stream || typeof this.stream.getAudioTracks !== 'function') return false;
    try {
      return this.stream.getAudioTracks().some((track) => track.readyState !== 'ended');
    } catch {
      return false;
    }
  }

  /** Lazily creates (or tears down) the `AudioContext`/`AnalyserNode` pair to match `stream`.
   *  Clearing `stream` suspends the context (cheap to resume if reassigned soon); `disconnectedCallback`
   *  is what actually closes it. */
  private syncAnalyser(): void {
    this.nextTrackCheckMs = 0;
    if (!this.isConnected || !this.hasUsableAudioStream) {
      this.sourceNode?.disconnect();
      this.sourceNode = undefined;
      this.analyser = undefined;
      this.timeDomainData = undefined;
      if (this.audioCtx) void this.audioCtx.suspend().catch(() => {});
      return;
    }

    const stream = this.stream;
    if (!stream) return;
    const owner = this.ownerDocument.defaultView;
    if (!owner) return;
    let context = this.audioCtx;
    let source: MediaStreamAudioSourceNode | undefined;
    try {
      if (!context) {
        const AudioCtxCtor =
          owner.AudioContext ??
          (owner as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtxCtor) return;
        context = new AudioCtxCtor();
        context.addEventListener('statechange', this.onAudioCtxStateChange);
      }
      source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = this.mode === 'waveform' ? 2048 : 256;
      source.connect(analyser);
      const data = new owner.Uint8Array(analyser.frequencyBinCount);

      this.sourceNode?.disconnect();
      this.audioCtx = context;
      this.sourceNode = source;
      this.analyser = analyser;
      this.timeDomainData = data;
      // `resume()`/`suspend()` settle asynchronously, and the parked draw loop only animates while
      // the context reports `running` — restart it once the transition lands.
      void context.resume().catch(() => {});
    } catch {
      source?.disconnect();
      // A failed source/analyser construction is not reusable state. Close both a newly-created
      // and a previously parked context so the next valid stream starts from a clean transaction.
      if (context) {
        context.removeEventListener('statechange', this.onAudioCtxStateChange);
        void context.close().catch(() => {});
      }
      this.audioCtx = undefined;
      this.sourceNode = undefined;
      this.analyser = undefined;
      this.timeDomainData = undefined;
    }
  }

  private onAudioCtxStateChange = (): void => {
    this.scheduleDraw();
  };

  private closeAudioContext(): void {
    this.sourceNode?.disconnect();
    this.sourceNode = undefined;
    this.analyser = undefined;
    this.timeDomainData = undefined;
    if (this.audioCtx) {
      this.audioCtx.removeEventListener('statechange', this.onAudioCtxStateChange);
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = undefined;
    }
  }

  private get hasLiveSignal(): boolean {
    return (!!this.analyser && this.audioCtx?.state === 'running') || this.level != null;
  }

  private stateLabel(): string {
    switch (this.state) {
      case 'listening':
        return this.localize('audioVisualizerListening');
      case 'thinking':
        return this.localize('audioVisualizerThinking');
      case 'speaking':
        return this.localize('audioVisualizerSpeaking');
      default:
        return this.localize('audioVisualizerIdle');
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('stream') || (changed.has('mode') && this.stream)) this.syncAnalyser();
    const currentAriaLabel = this.getAttribute('aria-label');
    const consumerSuppliedAriaLabel = currentAriaLabel !== this.generatedAriaLabel &&
      (currentAriaLabel === '' || normalizeLabel(currentAriaLabel) !== undefined);
    if (consumerSuppliedAriaLabel) {
      this.generatedAriaLabel = undefined;
    } else {
      const generated = this.label === '' ? '' : normalizeLabel(this.label) ??
        this.localize('audioVisualizerLabel', undefined, { state: this.stateLabel() });
      if (currentAriaLabel !== generated) this.setAttribute('aria-label', generated);
      this.generatedAriaLabel = generated;
    }
    this.syncDefaultRole();
  }

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (name === 'role' && oldValue !== value && value === null) this.syncDefaultRole();
  }

  private syncDefaultRole(): void {
    const role = this.getAttribute('role');
    if (role !== null && role !== this.generatedRole) return;
    // An img role with no name is invalid, so an empty accessible name drops the role to presentation.
    const wanted = normalizeLabel(this.getAttribute('aria-label')) === undefined ? 'presentation' : 'img';
    this.generatedRole = wanted;
    if (role !== wanted) this.setAttribute('role', wanted);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (['state', 'mode', 'barCount', 'gain', 'level', 'stream'].some((key) => changed.has(key))) {
      this.scheduleDraw();
    }
  }

  /** Whether the next frame's content differs from the current one with no external change — i.e.
   *  the drawing is a function of time: live analyser data, or a non-reduced ambient pulse/sweep.
   *  A constant `level`, the flat idle pattern, and every reduced-motion ambient pattern are all
   *  time-independent, so re-rendering them each frame would produce identical pixels. */
  private get isTimeDriven(): boolean {
    if (this.analyser && this.audioCtx?.state === 'running') return true;
    if (this.level != null) return false;
    if (this.reducedMotion) return false;
    return this.state !== 'idle';
  }

  private scheduleDraw = (): void => {
    if (!this.visibility.visible) return;
    if (this.drawFrameRequest.pending) return;
    this.drawFrameRequest.schedule((nowMs) => this.drawFrame(nowMs));
  };

  private drawFrame(nowMs: number): void {
    if (!this.visibility.visible) return;
    if (this.analyser && nowMs >= this.nextTrackCheckMs) {
      this.nextTrackCheckMs = nowMs + 500;
      if (!this.hasUsableAudioStream) this.syncAnalyser();
    }
    const reduced = this.reducedMotion;
    if (reduced && !this.hasLiveSignal) {
      if (nowMs - this.lastAmbientDrawMs < AMBIENT_REDUCED_MOTION_INTERVAL_MS) {
        this.scheduleDraw();
        return;
      }
      this.lastAmbientDrawMs = nowMs;
    }
    this.draw(nowMs);
    // Static output parks the loop after this frame; `scheduleDraw()` restarts it from every input
    // that could change the picture (reactive properties, resize, DPR/theme/motion changes,
    // `AudioContext` state transitions).
    if (this.isTimeDriven) this.scheduleDraw();
  }

  private cancelDrawFrame(): void {
    this.drawFrameRequest.cancel();
  }

  private barsFromTimeDomain(data: Uint8Array, barCount: number): number[] {
    const segmentSize = Math.max(1, Math.floor(data.length / barCount));
    const bars = this.amplitudes;
    bars.length = barCount;
    for (let i = 0; i < barCount; i++) {
      let sumSquares = 0;
      const start = i * segmentSize;
      const end = Math.min(data.length, start + segmentSize);
      for (let j = start; j < end; j++) {
        const norm = (data[j]! - 128) / 128;
        sumSquares += norm * norm;
      }
      bars[i] = Math.sqrt(sumSquares / Math.max(1, end - start));
    }
    return bars;
  }

  /** The static, reduced-motion-aware ambient pattern used when neither `stream` nor `level`
   *  supplies a real signal. `idle` is quiet and flat; `listening`/`speaking` are a gentle ready
   *  pulse; `thinking` sweeps a moving peak across the array unless `reduced`, in which case it
   *  collapses to a flat mid-height pattern (never a frozen mid-sweep frame). */
  private ambientAmplitudes(nowMs: number, reduced: boolean): number[] {
    const n = this.mode === 'waveform' ? WAVEFORM_SAMPLES : this.effectiveBarCount;
    const amplitudes = this.amplitudes;
    amplitudes.length = n;
    const phase = reduced ? 0 : finiteNumber(nowMs, 0) / this.resolveAmbientDuration();
    switch (this.state) {
      case 'listening':
      case 'speaking': {
        const pulse = reduced ? 0.3 : 0.25 + 0.15 * Math.sin(phase * 2 * Math.PI);
        return amplitudes.fill(pulse);
      }
      case 'thinking': {
        if (reduced) return amplitudes.fill(0.3);
        const pos = phase % 1;
        for (let i = 0; i < n; i++) {
          const dist = Math.abs(i / (n - 1 || 1) - pos);
          amplitudes[i] = 0.15 + 0.35 * Math.max(0, 1 - dist * 4);
        }
        return amplitudes;
      }
      default:
        return amplitudes.fill(0.08);
    }
  }

  /** Resolves the time-only ambient duration once per theme scope, alongside the cached colors.
   * `getComputedStyle` returns custom-property text, so only complete `ms`/`s` values can become
   * a cycle duration; malformed, zero, negative, or non-finite values retain the shared default. */
  private resolveAmbientDuration(): number {
    if (this.ambientDurationMs !== undefined) return this.ambientDurationMs;
    const style = this.ownerDocument.defaultView?.getComputedStyle(this);
    const value = style?.getPropertyValue('--lr-audio-visualizer-ambient-duration').trim()
      || style?.getPropertyValue('--_lr-audio-visualizer-ambient-duration-default').trim()
      || '';
    this.ambientDurationMs = parseAmbientDuration(value) ?? DEFAULT_AMBIENT_DURATION_MS;
    return this.ambientDurationMs;
  }

  private currentAmplitudes(nowMs: number, maxPoints = Infinity): number[] {
    if (this.analyser && this.timeDomainData && this.audioCtx?.state === 'running') {
      this.analyser.getByteTimeDomainData(this.timeDomainData);
      if (this.mode === 'waveform') {
        const data = this.timeDomainData;
        const count = Math.min(data.length, maxPoints);
        this.amplitudes.length = count;
        for (let i = 0; i < count; i++) {
          const index = Math.floor(i * (data.length - 1) / Math.max(1, count - 1));
          this.amplitudes[i] = (data[index]! - 128) / 128;
        }
        return this.amplitudes;
      }
      return this.barsFromTimeDomain(this.timeDomainData, this.effectiveBarCount);
    }
    if (this.effectiveLevel != null) {
      const n = this.mode === 'waveform' ? WAVEFORM_SAMPLES : this.effectiveBarCount;
      this.amplitudes.length = n;
      return this.amplitudes.fill(this.effectiveLevel);
    }
    return this.ambientAmplitudes(nowMs, this.reducedMotion);
  }

  /** Resolves and validates the two drawing colors once; the theme/color-scheme observers and
   *  `refreshTheme()` invalidate the cached pair, so steady-state frames never pay for the DOM
   *  color probe or `getComputedStyle`. */
  private resolveColors(): { active: string; quiet: string } {
    const cs = this.ownerDocument.defaultView?.getComputedStyle(this);
    const active = cs?.getPropertyValue('--lr-audio-visualizer-color').trim()
      || cs?.getPropertyValue('--_lr-audio-visualizer-color-default').trim()
      || DEFAULT_CANVAS_COLOR;
    const quiet = cs?.getPropertyValue('--lr-audio-visualizer-quiet-color').trim()
      || cs?.getPropertyValue('--_lr-audio-visualizer-quiet-color-default').trim()
      || '#ddf4ff';
    return {
      active: resolveCanvasColor(this, active, DEFAULT_CANVAS_COLOR),
      quiet: resolveCanvasColor(this, quiet, '#ddf4ff'),
    };
  }

  private draw(nowMs: number): void {
    const canvas = this.canvas;
    if (!canvas) return;
    // The ResizeObserver keeps `hostSize` current; measuring here would force a layout read on
    // every animation frame. The one-off fallback covers the first frame, which can land before
    // the observer's initial entry is delivered.
    const size = this.hostSize ?? this.getBoundingClientRect();
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height || 48);
    const dpr = this.ownerDocument.defaultView?.devicePixelRatio || 1;
    // Assigning `width`/`height` reallocates and clears the backing store even when the value is
    // unchanged, so only touch them when the target really differs (canvas dimensions truncate
    // fractional assignments, hence the floor). `setTransform` (absolute, unlike a relative
    // `scale`) keeps the DPR mapping correct whether or not this frame resized.
    const backingW = Math.floor(w * dpr);
    const backingH = Math.floor(h * dpr);
    if (canvas.width !== backingW) canvas.width = backingW;
    if (canvas.height !== backingH) canvas.height = backingH;
    const cssW = `${w}px`;
    const cssH = `${h}px`;
    if (canvas.style.width !== cssW) canvas.style.width = cssW;
    if (canvas.style.height !== cssH) canvas.style.height = cssH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.resolvedColors ??= this.resolveColors();
    const { active: activeColor, quiet: quietColor } = this.resolvedColors;
    const amplitudes = this.currentAmplitudes(nowMs, Math.max(1, backingW));
    const active =
      this.hasLiveSignal ||
      this.state === 'listening' ||
      this.state === 'thinking' ||
      this.state === 'speaking';
    ctx.fillStyle = active ? activeColor : quietColor;
    ctx.strokeStyle = active ? activeColor : quietColor;

    const gain = this.effectiveGain;
    if (this.mode === 'waveform') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      amplitudes.forEach((amp, i) => {
        const x = (i / (amplitudes.length - 1 || 1)) * w;
        const y = h / 2 - clampAmplitudeProduct(amp, gain, -1, 1) * (h / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      const n = amplitudes.length;
      const gap = n > 1 ? Math.max(0, Math.min(4, (w - n * 2) / (n - 1))) : 0;
      const barWidth = Math.max(2, (w - gap * (n - 1)) / n);
      amplitudes.forEach((amp, i) => {
        const barH = Math.max(2, clampAmplitudeProduct(amp, gain, 0, 1) * h);
        const x = i * (barWidth + gap);
        const y = (h - barH) / 2;
        ctx.fillRect(x, y, barWidth, barH);
      });
    }
  }

  override render(): TemplateResult {
    return html`<div part="base"><canvas part="canvas" aria-hidden="true"></canvas></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-audio-visualizer': LyraAudioVisualizer;
  }
}
