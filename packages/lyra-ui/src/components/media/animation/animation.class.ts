import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteDuration, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { styles } from './animation.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

/** Curated preset catalog for the `name` property. `slide-in-start`/`slide-in-end`/
 * `slide-out-start`/`slide-out-end` are resolved separately (see `slidePreset()`)
 * because they depend on the element's inherited text direction. */
export type LyraAnimationPreset =
  | 'none'
  | 'fade-in'
  | 'fade-out'
  | 'zoom-in'
  | 'zoom-out'
  | 'slide-in-start'
  | 'slide-in-end'
  | 'slide-out-start'
  | 'slide-out-end'
  | 'slide-in-up'
  | 'slide-in-down'
  | 'bounce'
  | 'pulse'
  | 'spin'
  | 'shake';

/** Ties `duration`/`easing` to the shared `--lr-transition-*` tokens instead of
 * the raw numeric properties. `'custom'` (the default) leaves `duration`/`easing`
 * fully consumer-controlled. */
export type LyraAnimationTimingPreset = 'custom' | 'fast' | 'base' | 'ambient';

export interface LyraAnimationEventMap {
  'lr-start': CustomEvent<undefined>;
  'lr-finish': CustomEvent<undefined>;
  'lr-cancel': CustomEvent<undefined>;
}

const PRESETS: Partial<Record<LyraAnimationPreset, Keyframe[]>> = {
  'fade-in': [{ opacity: 0 }, { opacity: 1 }],
  'fade-out': [{ opacity: 1 }, { opacity: 0 }],
  'zoom-in': [
    { opacity: 0, transform: 'scale(var(--lr-animation-zoom-scale, 0.5))' },
    { opacity: 1, transform: 'scale(1)' },
  ],
  'zoom-out': [
    { opacity: 1, transform: 'scale(1)' },
    { opacity: 0, transform: 'scale(var(--lr-animation-zoom-scale, 0.5))' },
  ],
  'slide-in-up': [
    { transform: 'translateY(var(--lr-animation-slide-distance, 100%))', opacity: 0 },
    { transform: 'translateY(0)', opacity: 1 },
  ],
  'slide-in-down': [
    { transform: 'translateY(calc(-1 * var(--lr-animation-slide-distance, 100%)))', opacity: 0 },
    { transform: 'translateY(0)', opacity: 1 },
  ],
  bounce: [
    { transform: 'translateY(0)', offset: 0 },
    { transform: 'translateY(calc(-1 * var(--lr-animation-bounce-height, 25%)))', offset: 0.4 },
    { transform: 'translateY(0)', offset: 0.7 },
    { transform: 'translateY(calc(-0.4 * var(--lr-animation-bounce-height, 25%)))', offset: 0.85 },
    { transform: 'translateY(0)', offset: 1 },
  ],
  pulse: [
    { transform: 'scale(1)', opacity: 1, offset: 0 },
    { transform: 'scale(0.92)', opacity: 0.75, offset: 0.5 },
    { transform: 'scale(1)', opacity: 1, offset: 1 },
  ],
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  shake: [
    { transform: 'translateX(0)', offset: 0 },
    { transform: 'translateX(calc(-1 * var(--lr-animation-shake-distance, 4%)))', offset: 0.2 },
    { transform: 'translateX(var(--lr-animation-shake-distance, 4%))', offset: 0.4 },
    { transform: 'translateX(calc(-1 * var(--lr-animation-shake-distance, 4%)))', offset: 0.6 },
    { transform: 'translateX(var(--lr-animation-shake-distance, 4%))', offset: 0.8 },
    { transform: 'translateX(0)', offset: 1 },
  ],
};

/** Builds the RTL-aware slide keyframes for `slide-in-start`/`slide-in-end`/
 * `slide-out-start`/`slide-out-end`. "start"/"end" are logical edges: under
 * `ltr` the start edge is physically left and the end edge is physically
 * right; under `rtl` that's reversed. */
function slidePreset(edge: 'start' | 'end', mode: 'in' | 'out', dir: 'ltr' | 'rtl'): Keyframe[] {
  const negative = dir === 'ltr' ? edge === 'start' : edge === 'end';
  const offscreen = `translateX(${
    negative ? 'calc(-1 * var(--lr-animation-slide-distance, 100%))' : 'var(--lr-animation-slide-distance, 100%)'
  })`;
  const onscreen = 'translateX(0)';
  return mode === 'in'
    ? [
        { transform: offscreen, opacity: 0 },
        { transform: onscreen, opacity: 1 },
      ]
    : [
        { transform: onscreen, opacity: 1 },
        { transform: offscreen, opacity: 0 },
      ];
}

const DIRECTIONAL_SLIDE_NAMES = new Set<LyraAnimationPreset>(['slide-in-start', 'slide-in-end', 'slide-out-start', 'slide-out-end']);

/** Reads and decomposes a compound `--lr-transition-*` token (e.g. `"180ms ease-out"`)
 * into the plain numeric `duration`/string `easing` pair the Web Animations API needs --
 * WAAPI's numeric timing options cannot take a `var()` reference the way a CSS `transform`
 * string can. Resolves against fully computed style, so a theme override that itself uses
 * `var()` internally never leaks unresolved text into `easing`. */
function resolveTimingToken(el: HTMLElement, preset: 'fast' | 'base' | 'ambient'): { duration: number; easing: string } {
  const raw = getComputedStyle(el).getPropertyValue(`--lr-transition-${preset}`).trim();
  const match = /^([\d.]+)(ms|s)\s+(.+)$/.exec(raw);
  if (!match) return { duration: 1000, easing: 'linear' };
  // safe: all three capture groups are non-optional, so a successful match fills them.
  const num = match[1]!;
  const unit = match[2]!;
  const easing = match[3]!;
  return { duration: unit === 's' ? parseFloat(num) * 1000 : parseFloat(num), easing: easing.trim() };
}

/**
 * `<lr-animation>` declaratively animates its single slotted child through the
 * native Web Animations API: a small curated preset catalog (`name`) or fully
 * custom `keyframes`, explicit WAAPI timing controls, an optional
 * `playOnVisible` trigger, and a `lr-start`/`lr-finish`/`lr-cancel` event
 * contract.
 *
 * `keyframes`, when set, always wins over `name`. The `iterations` default is
 * `Infinity` (mirrors the upstream Web Awesome/Shoelace animation contract
 * verbatim) -- a named preset plays forever unless the consumer sets
 * `iterations="1"`.
 *
 * `direction` is the Web Animations API's `PlaybackDirection`
 * (`'normal' | 'reverse' | 'alternate' | 'alternate-reverse'`) and is entirely
 * unrelated to text direction. Only the `slide-in-start`/`slide-in-end`/
 * `slide-out-start`/`slide-out-end` presets read the inherited text direction
 * (`effectiveDirection`) to resolve which physical edge "start"/"end" means,
 * and they do so fresh every time the animation is (re)built -- an animation
 * already mid-flight is not retroactively re-mirrored if an ancestor `dir`
 * flips while it plays; the next rebuild picks up the change.
 *
 * `respectReducedMotion` (default `true`) caps playback to one iteration and
 * calls `finish()` immediately instead of playing, whenever the OS/browser
 * reports `prefers-reduced-motion: reduce` -- the target snaps straight to
 * its resolved end state, and `lr-start`/`lr-finish` still fire in order
 * so a consumer sequencing further UI off those events keeps working even
 * though nothing visibly interpolated. Set `respectReducedMotion="false"`
 * only for genuine user-triggered feedback (e.g. a drag-confirm snap-back)
 * where a silent jump would be more confusing than a fast real animation --
 * ambient/decorative animation should always leave this at its default.
 *
 * `timingPreset` (default `'custom'`) optionally derives `duration`/`easing`
 * from the shared `--lr-transition-fast`/`-base`/`-ambient` tokens instead
 * of the raw `duration`/`easing` property values, so an app's global motion
 * retiming reaches this component's animations too.
 *
 * @customElement lr-animation
 * @slot - The element to animate. A second slotted element is accepted without error but ignored.
 * @event lr-start - A new animation was created and playback began or restarted.
 * @event lr-finish - The animation reached its natural end, including the reduced-motion instant-finish path.
 * @event lr-cancel - The animation was canceled via the public `cancel()` method or external cancellation.
 * @cssprop [--lr-animation-slide-distance=100%] - Travel distance for the slide-in/slide-out/slide-in-up/slide-in-down presets.
 * @cssprop [--lr-animation-zoom-scale=0.5] - Starting/ending scale factor for the zoom-in/zoom-out presets.
 * @cssprop [--lr-animation-bounce-height=25%] - Peak lift height of the bounce preset.
 * @cssprop [--lr-animation-shake-distance=4%] - Horizontal travel of the shake preset.
 */
export class LyraAnimation extends LyraElement<LyraAnimationEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property() name: LyraAnimationPreset = 'none';
  @property({ attribute: false }) keyframes: Keyframe[] | undefined = undefined;
  @property({ type: Boolean, reflect: true }) play = false;
  @property({ type: Number }) delay = 0;
  @property() direction: PlaybackDirection = 'normal';
  @property({ type: Number }) duration = 1000;
  @property() easing = 'linear';
  @property({ type: Number, attribute: 'end-delay' }) endDelay = 0;
  @property() fill: FillMode = 'auto';
  @property({ type: Number }) iterations = Infinity;
  @property({ type: Number, attribute: 'iteration-start' }) iterationStart = 0;
  @property({ type: Number, attribute: 'playback-rate' }) playbackRate = 1;
  @property({ attribute: 'timing-preset', reflect: true }) timingPreset: LyraAnimationTimingPreset = 'custom';
  @property({
    type: Boolean,
    attribute: 'respect-reduced-motion',
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  respectReducedMotion = true;
  @property({ type: Boolean, attribute: 'play-on-visible', reflect: true }) playOnVisible = false;
  @property({ type: Boolean, attribute: 'play-on-visible-repeat', reflect: true }) playOnVisibleRepeat = false;
  @property({ attribute: 'root-margin' }) rootMargin = '0px';
  @property({ attribute: false }) threshold: number | number[] = 0;
  @property({ attribute: false }) root: Element | null = null;

  private animation?: Animation;
  private hasStarted = false;
  private visibilityObserver?: IntersectionObserver;
  private motionQuery?: MediaQueryList;

  // `delay`/`duration`/`endDelay`/`iterations`/`iterationStart`/`playbackRate` all ultimately reach
  // `Element.animate()` or a live `Animation`'s own IDL setters -- the Web Animations API's
  // `EffectTiming`/`OptionalEffectTiming` conversion *synchronously throws* a `TypeError` for a
  // non-finite/negative `duration`, `delay`, or `endDelay`, and for a negative or non-finite
  // `iterationStart` (see the W3C spec's "update the timing properties of an animation effect"
  // procedure). That crash would surface from `createAnimation()`, which `updated()` calls on
  // nearly every property change including this component's very first render -- so a single bad
  // attribute (a stray `duration="NaN"`, or any of these left `undefined` by a buggy caller) would
  // otherwise crash the whole component rather than degrading gracefully. `delay`/`endDelay`, per
  // this component's own contract, are always non-negative durations (`finiteDuration` bounds
  // them at 0 and the timer-safe ceiling); `iterationStart` is bounded at 0 only (no timer
  // ceiling applies); `playbackRate` has no such throw risk (it's a plain `double` IDL setter) but
  // still needs finiteness so `NaN` doesn't poison the animation's timing math.
  private get safeDelay(): number {
    return finiteDuration(this.delay, 0, 0);
  }
  private get safeDuration(): number {
    return finiteDuration(this.duration, 1000, 0);
  }
  private get safeEndDelay(): number {
    return finiteDuration(this.endDelay, 0, 0);
  }
  /** `iterations` normalized to a finite, non-negative real -- *or* `Infinity` verbatim.
   *  `Infinity` is this property's own documented default (an animation that repeats forever,
   *  mirroring the upstream Web Awesome/Shoelace contract) and a legitimate, spec-sanctioned
   *  `EffectTiming.iterations` value, so it must never be coerced away by `finiteRange`'s clamp
   *  (which cannot itself represent "fall back to Infinity" -- its fallback parameter must be
   *  finite). Only a genuinely invalid raw value (`NaN`, negative, `-Infinity`) falls back to `1`. */
  private get safeIterations(): number {
    return this.iterations === Infinity ? Infinity : finiteRange(this.iterations, 1, 0);
  }
  private get safeIterationStart(): number {
    return finiteRange(this.iterationStart, 0, 0);
  }
  private get safePlaybackRate(): number {
    return finiteNumber(this.playbackRate, 1);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    this.motionQuery?.addEventListener('change', this.onMotionPreferenceChange);
    this.scheduleAfterUpdate(() => {
      this.createAnimation();
      this.syncVisibilityObserver();
    });
  }

  override disconnectedCallback(): void {
    this.destroyAnimation();
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
    this.motionQuery?.removeEventListener('change', this.onMotionPreferenceChange);
    this.motionQuery = undefined;
    super.disconnectedCallback();
  }

  // A live external event (the OS/browser toggling its reduced-motion
  // setting), not a construction-order concern -- rebuild directly rather
  // than routing through scheduleAfterUpdate.
  private onMotionPreferenceChange = (): void => this.createAnimation();

  protected override updated(changed: PropertyValues): void {
    const rebuildKeys = [
      'name',
      'keyframes',
      'delay',
      'direction',
      'duration',
      'easing',
      'endDelay',
      'fill',
      'iterations',
      'iterationStart',
      'timingPreset',
      'respectReducedMotion',
    ] as const;
    if (rebuildKeys.some((key) => changed.has(key))) this.createAnimation();
    else if (changed.has('play')) this.applyPlayState();
    if (changed.has('playbackRate') && this.animation) this.animation.playbackRate = this.safePlaybackRate;
    if (['playOnVisible', 'playOnVisibleRepeat', 'rootMargin', 'threshold', 'root'].some((key) => changed.has(key))) {
      this.scheduleAfterUpdate(this.syncVisibilityObserver);
    }
  }

  private onSlotChange = (): void => {
    this.createAnimation();
    this.syncVisibilityObserver();
  };

  private currentTarget(): HTMLElement | undefined {
    const slot = this.renderRoot.querySelector('slot');
    const [first] = slot?.assignedElements({ flatten: true }) ?? [];
    return first instanceof HTMLElement ? first : undefined;
  }

  private resolveKeyframes(): Keyframe[] | undefined {
    if (this.keyframes) return this.keyframes;
    const { name } = this;
    if (name === 'none') return undefined;
    if (DIRECTIONAL_SLIDE_NAMES.has(name)) {
      const mode = name.startsWith('slide-in-') ? 'in' : 'out';
      const edge = name.endsWith('-start') ? 'start' : 'end';
      return slidePreset(edge, mode, this.effectiveDirection);
    }
    return PRESETS[name];
  }

  private syncVisibilityObserver = (): void => {
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
    if (!this.playOnVisible) return;
    const target = this.currentTarget();
    if (!target) return;
    if (typeof IntersectionObserver === 'undefined') {
      // No observer support in this environment -- fail open and just play.
      this.play = true;
      return;
    }
    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) {
          this.play = true;
          if (!this.playOnVisibleRepeat) {
            this.visibilityObserver?.disconnect();
            this.visibilityObserver = undefined;
          }
        } else if (this.playOnVisibleRepeat) {
          this.play = false;
        }
      },
      { root: this.root instanceof Element ? this.root : null, rootMargin: this.rootMargin, threshold: this.threshold },
    );
    this.visibilityObserver.observe(target);
  };

  // Listeners are removed before `.cancel()` is called, not after. This
  // method runs at the top of every createAnimation() rebuild (e.g. the
  // consumer changed `duration` while playing) and in disconnectedCallback.
  // Calling `.cancel()` while the `cancel` listener is still attached would
  // spuriously fire the public `lr-cancel` event and reset `play` back to
  // `false` on every routine property change -- breaking the "lr-start
  // fires again on restart" contract. The public `cancel()` method below is
  // a deliberately separate path that does NOT call this, so the native
  // `cancel` event is allowed through to `lr-cancel` on purpose.
  private destroyAnimation(): void {
    if (!this.animation) return;
    this.animation.removeEventListener('cancel', this.onAnimationCancel);
    this.animation.removeEventListener('finish', this.onAnimationFinish);
    this.animation.cancel();
    this.animation = undefined;
    this.hasStarted = false;
  }

  private createAnimation = (): void => {
    this.destroyAnimation();
    const target = this.currentTarget();
    const keyframes = this.resolveKeyframes();
    if (!target || !keyframes) return;
    const reduced = this.respectReducedMotion && prefersReducedMotion();
    const { duration, easing } =
      this.timingPreset === 'custom'
        ? { duration: this.safeDuration, easing: this.easing }
        : resolveTimingToken(this, this.timingPreset);
    const options: KeyframeAnimationOptions = {
      delay: this.safeDelay,
      direction: this.direction,
      duration,
      easing,
      endDelay: this.safeEndDelay,
      fill: this.fill,
      iterationStart: this.safeIterationStart,
      iterations: reduced ? Math.min(this.safeIterations, 1) : this.safeIterations,
    };
    this.animation = target.animate(keyframes, options);
    this.animation.playbackRate = this.safePlaybackRate;
    this.animation.addEventListener('cancel', this.onAnimationCancel);
    this.animation.addEventListener('finish', this.onAnimationFinish);
    if (this.play) {
      this.hasStarted = true;
      this.emit('lr-start');
      if (reduced) this.animation.finish();
    } else {
      this.animation.pause();
    }
  };

  // Guards against double-emitting lr-start when both a rebuild-triggering
  // property and `play` change in the same update batch (e.g. the element's
  // very first update, where every property is "changed"): createAnimation()
  // already handles the emit and sets hasStarted in that case, so this path
  // (only reached when a rebuild did NOT also happen) never runs redundantly
  // for that same transition.
  private applyPlayState = (): void => {
    if (!this.animation) return;
    if (this.play) {
      if (!this.hasStarted) {
        this.hasStarted = true;
        this.emit('lr-start');
      }
      this.animation.play();
    } else {
      this.animation.pause();
    }
  };

  private onAnimationFinish = (): void => {
    this.play = false;
    this.hasStarted = false;
    this.emit('lr-finish');
  };

  private onAnimationCancel = (): void => {
    this.play = false;
    this.hasStarted = false;
    this.emit('lr-cancel');
  };

  get currentTime(): number {
    return (this.animation?.currentTime as number | null) ?? 0;
  }

  set currentTime(value: number) {
    if (this.animation) this.animation.currentTime = value;
  }

  /** Convenience sugar for `this.play = true`. Named `start()`, not `play()`,
   * because `play` is already a reactive boolean property on this class and a
   * method cannot share that identifier. */
  start(): void {
    this.play = true;
  }

  /** Convenience sugar for `this.play = false`. */
  pause(): void {
    this.play = false;
  }

  /** Forwards to the underlying `Animation.cancel()`. Fires `lr-cancel`. */
  cancel(): void {
    this.animation?.cancel();
  }

  /** Forwards to the underlying `Animation.finish()`. */
  finish(): void {
    this.animation?.finish();
  }

  override render(): TemplateResult {
    return html`<slot @slotchange=${this.onSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-animation': LyraAnimation;
  }
}
