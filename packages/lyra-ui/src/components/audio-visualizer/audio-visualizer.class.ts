import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteInteger } from '../../internal/numbers.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { styles } from './audio-visualizer.styles.js';

export type AudioVisualizerVariant = 'bars' | 'waveform';
export type AudioVisualizerState = 'idle' | 'listening' | 'thinking' | 'speaking';

const WAVEFORM_SAMPLES = 64;
const AMBIENT_REDUCED_MOTION_INTERVAL_MS = 500; // ~2 Hz snapshot cadence

/**
 * `<lyra-audio-visualizer>` — a presentational, canvas-drawn voice-activity visualization (bars or
 * waveform), the LiveKit-BarVisualizer counterpart for this library. Driven by a `MediaStream`
 * (lazily wired to a WebAudio `AnalyserNode`), a numeric `level` for hosts that already compute
 * levels (e.g. `lyra-push-to-talk`'s `lyra-level`), or `state` alone for an ambient animation when no
 * real signal exists. A real signal (`stream` or `level`) always drives amplitude regardless of
 * `prefers-reduced-motion` — that is live, user-controlled feedback, not decorative motion; only the
 * signal-less ambient animation is throttled and simplified under reduced motion.
 *
 * @customElement lyra-audio-visualizer
 * @csspart base - The root wrapper.
 * @csspart canvas - The drawing surface (`aria-hidden`; the host itself carries `role="img"` and the
 *   accessible name).
 * @cssprop [--lyra-audio-visualizer-color=var(--lyra-color-brand)] - Active bar/waveform color.
 * @cssprop [--lyra-audio-visualizer-quiet-color=var(--lyra-color-brand-quiet)] - Inactive/idle color.
 */
export class LyraAudioVisualizer extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) stream: MediaStream | null = null;
  @property({ type: Number }) level: number | null = null;
  @property({ reflect: true }) state: AudioVisualizerState = 'idle';
  @property({ reflect: true }) variant: AudioVisualizerVariant = 'bars';
  @property({ type: Number, attribute: 'bar-count' }) barCount = 5;
  @property({ type: Number }) gain = 1;
  /** Accessible-name override. Unset (the default) auto-generates "Voice activity: {state}". */
  @property() label = '';

  @query('canvas') private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private dprQuery?: MediaQueryList;
  private colorSchemeQuery?: MediaQueryList;
  private themeObserver?: MutationObserver;
  private themeRefreshQueued = false;
  private rafId?: number;
  private lastAmbientDrawMs = 0;
  private authorSuppliedRole = false;
  private authorSuppliedAriaLabel = false;

  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private sourceNode?: MediaStreamAudioSourceNode;
  private timeDomainData?: Uint8Array<ArrayBuffer>;

  private get effectiveBarCount(): number {
    return finiteInteger(this.barCount, 5, 1, 64);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(this.scheduleDraw);
    this.resizeObserver.observe(this);
    this.watchDpr();
    this.watchTheme();
    this.syncAnalyser();
    this.scheduleDraw();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.colorSchemeQuery?.removeEventListener('change', this.onColorSchemeChange);
    this.themeObserver?.disconnect();
    this.themeObserver = undefined;
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
    this.closeAudioContext();
  }

  private watchDpr(): void {
    // A MediaQueryList's `matches` is fixed at creation time, so crossing the DPR threshold it was
    // built for means building a fresh one for the new ratio — remove the previous instance's
    // listener first, or it leaks (disconnectedCallback only ever cleans up whichever is current).
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }
  private onDprChange = (): void => {
    this.watchDpr();
    this.scheduleDraw();
  };
  private onColorSchemeChange = (): void => {
    this.refreshTheme();
  };
  private queueThemeRefresh = (): void => {
    if (this.themeRefreshQueued) return;
    this.themeRefreshQueued = true;
    queueMicrotask(() => {
      this.themeRefreshQueued = false;
      if (this.isConnected) this.refreshTheme();
    });
  };
  private watchTheme(): void {
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.colorSchemeQuery = view.matchMedia?.('(prefers-color-scheme: dark)');
    this.colorSchemeQuery?.addEventListener('change', this.onColorSchemeChange);
    if (typeof MutationObserver === 'undefined') return;
    const targets: Element[] = [this];
    let parent = this.parentElement;
    while (parent) {
      targets.push(parent);
      parent = parent.parentElement;
    }
    this.themeObserver = new MutationObserver(this.queueThemeRefresh);
    for (const target of targets) {
      this.themeObserver.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'],
      });
    }
  }

  /** Redraws canvas content after an upstream token or theme change. */
  refreshTheme(): void {
    this.scheduleDraw();
  }

  /** Lazily creates (or tears down) the `AudioContext`/`AnalyserNode` pair to match `stream`.
   *  Clearing `stream` suspends the context (cheap to resume if reassigned soon); `disconnectedCallback`
   *  is what actually closes it. */
  private syncAnalyser(): void {
    if (this.stream) {
      if (!this.audioCtx) {
        const AudioCtxCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtxCtor) return;
        this.audioCtx = new AudioCtxCtor();
      } else {
        void this.audioCtx.resume().catch(() => {});
      }
      this.sourceNode?.disconnect();
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this.variant === 'waveform' ? 2048 : 256;
      this.sourceNode.connect(this.analyser);
      this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
    } else {
      this.sourceNode?.disconnect();
      this.sourceNode = undefined;
      this.analyser = undefined;
      this.timeDomainData = undefined;
      if (this.audioCtx) void this.audioCtx.suspend().catch(() => {});
    }
  }

  private closeAudioContext(): void {
    this.sourceNode?.disconnect();
    this.sourceNode = undefined;
    this.analyser = undefined;
    this.timeDomainData = undefined;
    if (this.audioCtx) {
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

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('stream') || (changed.has('variant') && this.stream)) this.syncAnalyser();
    if (!this.hasUpdated) {
      this.authorSuppliedRole = this.hasAttribute('role');
      this.authorSuppliedAriaLabel = this.hasAttribute('aria-label');
    }
    if (!this.authorSuppliedRole) this.setAttribute('role', 'img');
    if (!this.authorSuppliedAriaLabel) {
      this.setAttribute(
        'aria-label',
        this.label || this.localize('audioVisualizerLabel', undefined, { state: this.stateLabel() }),
      );
    }
  }

  protected updated(changed: PropertyValues): void {
    if (['state', 'variant', 'barCount', 'gain', 'level'].some((key) => changed.has(key))) this.scheduleDraw();
  }

  private scheduleDraw = (): void => {
    if (this.rafId !== undefined) return;
    this.rafId = requestAnimationFrame(this.drawFrame);
  };

  private drawFrame = (nowMs: number): void => {
    this.rafId = undefined;
    if (!this.isConnected) return;
    const reduced = prefersReducedMotion();
    if (reduced && !this.hasLiveSignal) {
      if (nowMs - this.lastAmbientDrawMs < AMBIENT_REDUCED_MOTION_INTERVAL_MS) {
        this.rafId = requestAnimationFrame(this.drawFrame);
        return;
      }
      this.lastAmbientDrawMs = nowMs;
    }
    this.draw(nowMs);
    this.rafId = requestAnimationFrame(this.drawFrame);
  };

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
    const t = nowMs / 1000;
    switch (this.state) {
      case 'listening':
      case 'speaking': {
        const pulse = reduced ? 0.3 : 0.25 + 0.15 * Math.sin(t * 2 * Math.PI * 0.5);
        return new Array(n).fill(pulse);
      }
      case 'thinking': {
        if (reduced) return new Array(n).fill(0.3);
        return Array.from({ length: n }, (_, i) => {
          const pos = (t * 0.6) % 1;
          const dist = Math.abs(i / (n - 1 || 1) - pos);
          return 0.15 + 0.35 * Math.max(0, 1 - dist * 4);
        });
      }
      default:
        return new Array(n).fill(0.08);
    }
  }

  private currentAmplitudes(nowMs: number): number[] {
    if (this.analyser && this.timeDomainData && this.audioCtx?.state === 'running') {
      this.analyser.getByteTimeDomainData(this.timeDomainData);
      if (this.variant === 'waveform') return Array.from(this.timeDomainData, (v) => (v - 128) / 128);
      return this.barsFromTimeDomain(this.timeDomainData, this.effectiveBarCount);
    }
    if (this.level != null) {
      const n = this.variant === 'waveform' ? WAVEFORM_SAMPLES : this.effectiveBarCount;
      const amp = Math.max(0, Math.min(1, this.level));
      return new Array(n).fill(amp);
    }
    return this.ambientAmplitudes(nowMs, prefersReducedMotion());
  }

  private draw(nowMs: number): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = this.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height || 48);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const cs = getComputedStyle(this);
    const activeColor = cs.getPropertyValue('--lyra-audio-visualizer-color').trim() || '#0969da';
    const quietColor = cs.getPropertyValue('--lyra-audio-visualizer-quiet-color').trim() || '#ddf4ff';
    const amplitudes = this.currentAmplitudes(nowMs);
    const active = this.hasLiveSignal || this.state === 'listening' || this.state === 'speaking';
    ctx.fillStyle = active ? activeColor : quietColor;
    ctx.strokeStyle = active ? activeColor : quietColor;

    if (this.variant === 'waveform') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      amplitudes.forEach((amp, i) => {
        const x = (i / (amplitudes.length - 1 || 1)) * w;
        const y = h / 2 - amp * (h / 2) * this.gain;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      const n = amplitudes.length;
      const gap = 4;
      const barWidth = Math.max(2, (w - gap * (n - 1)) / n);
      amplitudes.forEach((amp, i) => {
        const barH = Math.max(2, Math.min(h, amp * h * this.gain));
        const x = i * (barWidth + gap);
        const y = (h - barH) / 2;
        ctx.fillRect(x, y, barWidth, barH);
      });
    }
  }

  render(): TemplateResult {
    return html`<div part="base"><canvas part="canvas" aria-hidden="true"></canvas></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-audio-visualizer': LyraAudioVisualizer;
  }
}
