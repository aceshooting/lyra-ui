import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { styles } from './audio-visualizer.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_audioVisualizerIdle, LYRA_DEFAULT_audioVisualizerLabel, LYRA_DEFAULT_audioVisualizerListening, LYRA_DEFAULT_audioVisualizerSpeaking, LYRA_DEFAULT_audioVisualizerThinking, LYRA_DEFAULT_thinking } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type AudioVisualizerVariant = 'bars' | 'waveform';
export type AudioVisualizerState = 'idle' | 'listening' | 'thinking' | 'speaking';

const WAVEFORM_SAMPLES = 64;
const AMBIENT_REDUCED_MOTION_INTERVAL_MS = 500; // ~2 Hz snapshot cadence
const DEFAULT_AMBIENT_DURATION_MS = 1800; // mirrors --lr-duration-ambient's default

/** Parses the time-only custom property used to phase ambient canvas motion. CSS custom properties
 * keep their raw token sequence until their consuming declaration is evaluated, so deliberately
 * reject compound transition values (such as `1.8s ease-in-out`) rather than accepting a prefix. */
function parseAmbientDuration(value: string): number | undefined {
  const match = /^\+?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[+-]?\d+)?(ms|s)$/i.exec(value.trim());
  if (!match) return undefined;
  const unit = match[1]!.toLowerCase();
  const numeric = Number(value.trim().slice(0, -unit.length));
  const milliseconds = finiteNumber(numeric * (unit === 's' ? 1000 : 1), 0);
  return milliseconds > 0 ? milliseconds : undefined;
}

interface OwnedAnimationFrame {
  owner: Window;
  handle: number;
}

/**
 * `<lr-audio-visualizer>` — a presentational, canvas-drawn voice-activity visualization (bars or
 * waveform), the LiveKit-BarVisualizer counterpart for this library. Driven by a `MediaStream`
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
 * @cssprop [--lr-audio-visualizer-quiet-color=var(--lr-color-brand-quiet)] - Inactive/idle color.
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
    thinking: LYRA_DEFAULT_thinking,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) stream: MediaStream | null = null;
  /** Externally-computed amplitude, `[0, 1]`, for a host that already derives its own level
   *  (e.g. `lr-push-to-talk`'s `lr-level`). `null` (the default) means "no external signal" --
   *  see `effectiveLevel` for how a non-null value is clamped/NaN-guarded before it feeds `draw()`. */
  @property({ type: Number }) level: number | null = null;
  @property({ reflect: true }) state: AudioVisualizerState = 'idle';
  @property({ reflect: true }) variant: AudioVisualizerVariant = 'bars';
  @property({ type: Number, attribute: 'bar-count' }) barCount = 5;
  /** Amplitude multiplier applied in `draw()`. NaN/non-finite falls back to `1` via `effectiveGain`. */
  @property({ type: Number }) gain = 1;
  /** Accessible-name override. Unset (the default) auto-generates "Voice activity: {state}". */
  @property() label = '';

  @query('canvas') private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private dprQuery?: MediaQueryList;
  private dprChangeListener?: (event: MediaQueryListEvent) => void;
  private motionQuery?: MediaQueryList;
  private motionChangeListener?: (event: MediaQueryListEvent) => void;
  private drawFrameRequest?: OwnedAnimationFrame;
  private lastAmbientDrawMs = 0;
  private authorSuppliedRole = false;
  private generatedAriaLabel = '';
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

  /** Whether the host is currently on-screen, per `intersectionObserver` below. Gates
   *  `scheduleDraw()` so a visualizer scrolled out of view (e.g. behind later transcript messages)
   *  while still driven by a live `stream`/non-idle `state` stops burning CPU on a redraw loop
   *  nobody can see -- mirrors `<lr-chart>`'s own `visible`-gated `draw()`. Not `@state()`: nothing
   *  in `render()` depends on it, so making it reactive would only schedule pointless extra update
   *  passes. */
  private visible = true;
  private intersectionObserver?: IntersectionObserver;

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
    this.watchDpr();
    // The draw loop parks itself while ambient output is static under reduced motion, so a
    // preference flip must restart it (and re-simplify/re-animate the pattern) explicitly.
    if (typeof owner.matchMedia === 'function') {
      const query = owner.matchMedia('(prefers-reduced-motion: reduce)');
      const listener = (): void => {
        if (
          !this.isConnected ||
          this.ownerDocument.defaultView !== owner ||
          this.motionQuery !== query
        ) {
          return;
        }
        this.scheduleDraw();
      };
      this.motionQuery = query;
      this.motionChangeListener = listener;
      query.addEventListener('change', listener);
    }
    // A reconnect may land under a different theme scope, so neither canvas colors nor the ambient
    // cycle duration can safely survive it.
    this.resolvedColors = undefined;
    this.ambientDurationMs = undefined;
    this.syncAnalyser();
    this.visible = true; // a reconnect may land at a different scroll position than last observed
    const IntersectionObserverCtor = owner.IntersectionObserver;
    if (IntersectionObserverCtor) {
      let observer: IntersectionObserver;
      observer = new IntersectionObserverCtor((entries) => {
        if (
          !this.isConnected ||
          this.ownerDocument.defaultView !== owner ||
          this.intersectionObserver !== observer
        ) {
          return;
        }
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) {
          this.scheduleDraw();
        } else if (!this.visible) {
          this.cancelDrawFrame();
        }
      });
      this.intersectionObserver = observer;
      observer.observe(this);
    }
    this.lastAmbientDrawMs = 0;
    this.scheduleDraw();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.hostSize = undefined;
    this.clearDprWatcher();
    this.clearMotionWatcher();
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.cancelDrawFrame();
    this.closeAudioContext();
  }

  private watchDpr(): void {
    // A MediaQueryList's `matches` is fixed at creation time, so crossing the DPR threshold it was
    // built for means building a fresh one for the new ratio — remove the previous instance's
    // listener first, or it leaks (disconnectedCallback only ever cleans up whichever is current).
    this.clearDprWatcher();
    const owner = this.ownerDocument.defaultView;
    if (!owner || typeof owner.matchMedia !== 'function') return;
    const query = owner.matchMedia(`(resolution: ${owner.devicePixelRatio}dppx)`);
    const listener = (): void => {
      if (
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner ||
        this.dprQuery !== query
      ) {
        return;
      }
      this.watchDpr();
      this.scheduleDraw();
    };
    this.dprQuery = query;
    this.dprChangeListener = listener;
    query.addEventListener('change', listener);
  }

  private clearDprWatcher(): void {
    if (this.dprQuery && this.dprChangeListener) {
      this.dprQuery.removeEventListener('change', this.dprChangeListener);
    }
    this.dprQuery = undefined;
    this.dprChangeListener = undefined;
  }

  private clearMotionWatcher(): void {
    if (this.motionQuery && this.motionChangeListener) {
      this.motionQuery.removeEventListener('change', this.motionChangeListener);
    }
    this.motionQuery = undefined;
    this.motionChangeListener = undefined;
  }

  /** Redraws canvas content after an upstream token or theme change. */
  refreshTheme(): void {
    this.resolvedColors = undefined;
    this.ambientDurationMs = undefined;
    this.scheduleDraw();
  }

  /** Lazily creates (or tears down) the `AudioContext`/`AnalyserNode` pair to match `stream`.
   *  Clearing `stream` suspends the context (cheap to resume if reassigned soon); `disconnectedCallback`
   *  is what actually closes it. */
  private syncAnalyser(): void {
    if (this.stream) {
      const owner = this.ownerDocument.defaultView;
      if (!owner) return;
      if (!this.audioCtx) {
        const AudioCtxCtor =
          owner.AudioContext ??
          (owner as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtxCtor) return;
        this.audioCtx = new AudioCtxCtor();
        // `resume()`/`suspend()` settle asynchronously, and the parked draw loop only animates while
        // the context reports `running` — restart it once the transition lands.
        this.audioCtx.addEventListener('statechange', this.onAudioCtxStateChange);
      }
      // Autoplay policy can hand back a brand-new context already `suspended`, and nothing
      // spontaneously transitions it to `running` without an explicit `resume()` call — so this
      // must run on every attach, not only when reusing a context created by a prior attach.
      void this.audioCtx.resume().catch(() => {});
      this.sourceNode?.disconnect();
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this.variant === 'waveform' ? 2048 : 256;
      this.sourceNode.connect(this.analyser);
      this.timeDomainData = new owner.Uint8Array(this.analyser.frequencyBinCount);
    } else {
      this.sourceNode?.disconnect();
      this.sourceNode = undefined;
      this.analyser = undefined;
      this.timeDomainData = undefined;
      if (this.audioCtx) void this.audioCtx.suspend().catch(() => {});
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
    if (changed.has('stream') || (changed.has('variant') && this.stream)) this.syncAnalyser();
    const currentRole = this.getAttribute('role');
    this.authorSuppliedRole = currentRole !== null && currentRole !== 'img';
    if (!this.authorSuppliedRole) this.setAttribute('role', 'img');
    const currentAriaLabel = this.getAttribute('aria-label');
    const consumerSuppliedAriaLabel = currentAriaLabel !== null && currentAriaLabel !== this.generatedAriaLabel;
    if (consumerSuppliedAriaLabel) {
      this.generatedAriaLabel = '';
    } else {
      const generated = this.label || this.localize('audioVisualizerLabel', undefined, { state: this.stateLabel() });
      if (currentAriaLabel !== generated) this.setAttribute('aria-label', generated);
      this.generatedAriaLabel = generated;
    }
  }

  protected override updated(changed: PropertyValues): void {
    if (['state', 'variant', 'barCount', 'gain', 'level', 'stream'].some((key) => changed.has(key))) {
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
    if (prefersReducedMotion(this.ownerDocument.defaultView)) return false;
    return this.state !== 'idle';
  }

  private scheduleDraw = (): void => {
    if (!this.visible) return; // becoming visible again resumes via the IntersectionObserver above
    if (this.drawFrameRequest) return;
    const owner = this.ownerDocument.defaultView;
    if (!owner || !this.isConnected) return;
    const request: OwnedAnimationFrame = { owner, handle: 0 };
    request.handle = owner.requestAnimationFrame((nowMs) => this.drawFrame(request, nowMs));
    this.drawFrameRequest = request;
  };

  private drawFrame(request: OwnedAnimationFrame, nowMs: number): void {
    if (this.drawFrameRequest !== request) return;
    this.drawFrameRequest = undefined;
    if (!this.isConnected || this.ownerDocument.defaultView !== request.owner) return;
    // Belt-and-suspenders alongside `scheduleDraw()`'s own gate: `IntersectionObserver` callbacks
    // are asynchronously batched, so a frame already in flight when visibility flips off could
    // otherwise still draw and re-arm itself before the observer's `cancelAnimationFrame` call
    // catches up. Redraws resume once the observer reports intersecting again via `scheduleDraw()`.
    if (!this.visible) return;
    const reduced = prefersReducedMotion(request.owner);
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
    const request = this.drawFrameRequest;
    if (request) request.owner.cancelAnimationFrame(request.handle);
    this.drawFrameRequest = undefined;
  }

  private barsFromTimeDomain(data: Uint8Array, barCount: number): number[] {
    const segmentSize = Math.max(1, Math.floor(data.length / barCount));
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      let sumSquares = 0;
      const start = i * segmentSize;
      const end = Math.min(data.length, start + segmentSize);
      for (let j = start; j < end; j++) {
        const norm = (data[j]! - 128) / 128;
        sumSquares += norm * norm;
      }
      bars.push(Math.sqrt(sumSquares / Math.max(1, end - start)));
    }
    return bars;
  }

  /** The static, reduced-motion-aware ambient pattern used when neither `stream` nor `level`
   *  supplies a real signal. `idle` is quiet and flat; `listening`/`speaking` are a gentle ready
   *  pulse; `thinking` sweeps a moving peak across the array unless `reduced`, in which case it
   *  collapses to a flat mid-height pattern (never a frozen mid-sweep frame). */
  private ambientAmplitudes(nowMs: number, reduced: boolean): number[] {
    const n = this.variant === 'waveform' ? WAVEFORM_SAMPLES : this.effectiveBarCount;
    const phase = reduced ? 0 : finiteNumber(nowMs, 0) / this.resolveAmbientDuration();
    switch (this.state) {
      case 'listening':
      case 'speaking': {
        const pulse = reduced ? 0.3 : 0.25 + 0.15 * Math.sin(phase * 2 * Math.PI);
        return new Array(n).fill(pulse);
      }
      case 'thinking': {
        if (reduced) return new Array(n).fill(0.3);
        return Array.from({ length: n }, (_, i) => {
          const pos = phase % 1;
          const dist = Math.abs(i / (n - 1 || 1) - pos);
          return 0.15 + 0.35 * Math.max(0, 1 - dist * 4);
        });
      }
      default:
        return new Array(n).fill(0.08);
    }
  }

  /** Resolves the time-only ambient duration once per theme scope, alongside the cached colors.
   * `getComputedStyle` returns custom-property text, so only complete `ms`/`s` values can become
   * a cycle duration; malformed, zero, negative, or non-finite values retain the shared default. */
  private resolveAmbientDuration(): number {
    if (this.ambientDurationMs !== undefined) return this.ambientDurationMs;
    const value = this.ownerDocument.defaultView
      ?.getComputedStyle(this)
      .getPropertyValue('--lr-audio-visualizer-ambient-duration') ?? '';
    this.ambientDurationMs = parseAmbientDuration(value) ?? DEFAULT_AMBIENT_DURATION_MS;
    return this.ambientDurationMs;
  }

  private currentAmplitudes(nowMs: number): number[] {
    if (this.analyser && this.timeDomainData && this.audioCtx?.state === 'running') {
      this.analyser.getByteTimeDomainData(this.timeDomainData);
      if (this.variant === 'waveform') return Array.from(this.timeDomainData, (v) => (v - 128) / 128);
      return this.barsFromTimeDomain(this.timeDomainData, this.effectiveBarCount);
    }
    if (this.effectiveLevel != null) {
      const n = this.variant === 'waveform' ? WAVEFORM_SAMPLES : this.effectiveBarCount;
      return new Array(n).fill(this.effectiveLevel);
    }
    return this.ambientAmplitudes(nowMs, prefersReducedMotion(this.ownerDocument.defaultView));
  }

  /** Resolves and validates the two drawing colors once; the theme/color-scheme observers and
   *  `refreshTheme()` invalidate the cached pair, so steady-state frames never pay for the DOM
   *  color probe or `getComputedStyle`. */
  private resolveColors(): { active: string; quiet: string } {
    const cs = this.ownerDocument.defaultView?.getComputedStyle(this);
    const active = cs?.getPropertyValue('--lr-audio-visualizer-color').trim() || '#0969da';
    const quiet = cs?.getPropertyValue('--lr-audio-visualizer-quiet-color').trim() || '#ddf4ff';
    return {
      active: resolveCanvasColor(this, active, '#0969da'),
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
    const amplitudes = this.currentAmplitudes(nowMs);
    const active =
      this.hasLiveSignal ||
      this.state === 'listening' ||
      this.state === 'thinking' ||
      this.state === 'speaking';
    ctx.fillStyle = active ? activeColor : quietColor;
    ctx.strokeStyle = active ? activeColor : quietColor;

    const gain = this.effectiveGain;
    if (this.variant === 'waveform') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      amplitudes.forEach((amp, i) => {
        const x = (i / (amplitudes.length - 1 || 1)) * w;
        const y = h / 2 - amp * (h / 2) * gain;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      const n = amplitudes.length;
      const gap = n > 1 ? Math.max(0, Math.min(4, (w - n * 2) / (n - 1))) : 0;
      const barWidth = Math.max(2, (w - gap * (n - 1)) / n);
      amplitudes.forEach((amp, i) => {
        const barH = Math.max(2, Math.min(h, amp * h * gain));
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
