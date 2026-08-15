import { html, type PropertyValues, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { prefersReducedMotion } from "../../../internal/motion.js";
import { finiteNumber, finiteRange } from "../../../internal/numbers.js";
import {
  getAnimation,
  type LyraElementAnimation,
  type LyraResolvedElementAnimation,
} from "../../../utilities/animation-registry.js";
import { styles } from "./animation.styles.js";
import { trueDefaultBooleanConverter } from "../../../internal/converters.js";
import {
  resolveCatalogAnimation,
  resolveNamedEasing,
  type LyraMirrorAnimationName,
} from "./animation-catalog.js";

export {
  animations,
  getAnimationNames,
  getEasingNames,
  LYRA_ANIMATION_NAMES,
  LYRA_EASINGS,
  type LyraAnimationEasingName,
  type LyraAnimationCatalog,
  type LyraMirrorAnimationName,
} from "./animation-catalog.js";

/** Curated preset catalog for the `name` property. `slide-in-start`/`slide-in-end`/
 * `slide-out-start`/`slide-out-end` are resolved separately (see `slidePreset()`)
 * because they depend on the element's inherited text direction. */
export type LyraAnimationPreset =
  | LyraMirrorAnimationName
  | "none"
  | "fade-in"
  | "fade-out"
  | "zoom-in"
  | "zoom-out"
  | "slide-in-start"
  | "slide-in-end"
  | "slide-out-start"
  | "slide-out-end"
  | "slide-in-up"
  | "slide-in-down"
  | "bounce"
  | "pulse"
  | "spin"
  | "shake";

/** Ties `duration`/`easing` to the shared `--lr-transition-*` tokens instead of
 * the raw numeric properties. `'custom'` (the default) leaves `duration`/`easing`
 * fully consumer-controlled. */
export type LyraAnimationTimingPreset = "custom" | "fast" | "base" | "ambient";

export interface LyraAnimationEventMap {
  "lr-start": CustomEvent<null>;
  "lr-finish": CustomEvent<null>;
  "lr-cancel": CustomEvent<null>;
}

const MAX_VISIBILITY_THRESHOLDS = 1_000;

function snapshotVisibilityThreshold(
  value: unknown
): number | readonly number[] {
  if (!Array.isArray(value)) {
    const threshold = typeof value === "number" ? finiteNumber(value, -1) : -1;
    return threshold >= 0 && threshold <= 1 ? threshold : 0;
  }
  try {
    const count = Math.min(value.length, MAX_VISIBILITY_THRESHOLDS);
    const thresholds: number[] = [];
    for (let index = 0; index < count; index++) {
      try {
        const candidate = value[index];
        const threshold =
          typeof candidate === "number" ? finiteNumber(candidate, -1) : -1;
        if (threshold >= 0 && threshold <= 1) thresholds.push(threshold);
      } catch {
        // A hostile indexed getter invalidates only its own entry.
      }
    }
    return thresholds.length ? Object.freeze(thresholds) : 0;
  } catch {
    return 0;
  }
}

const PRESETS: Readonly<Partial<Record<string, Keyframe[]>>> = {
  "fade-in": [{ opacity: 0 }, { opacity: 1 }],
  "fade-out": [{ opacity: 1 }, { opacity: 0 }],
  "zoom-in": [
    {
      opacity: 0,
      transform:
        "scale(var(--lr-animation-zoom-scale, var(--_lr-animation-zoom-scale)))",
    },
    { opacity: 1, transform: "scale(1)" },
  ],
  "zoom-out": [
    { opacity: 1, transform: "scale(1)" },
    {
      opacity: 0,
      transform:
        "scale(var(--lr-animation-zoom-scale, var(--_lr-animation-zoom-scale)))",
    },
  ],
  "slide-in-up": [
    {
      transform:
        "translateY(var(--lr-animation-slide-distance, var(--_lr-animation-slide-distance)))",
      opacity: 0,
    },
    { transform: "translateY(0)", opacity: 1 },
  ],
  "slide-in-down": [
    {
      transform:
        "translateY(calc(-1 * var(--lr-animation-slide-distance, var(--_lr-animation-slide-distance))))",
      opacity: 0,
    },
    { transform: "translateY(0)", opacity: 1 },
  ],
  bounce: [
    { transform: "translateY(0)", offset: 0 },
    {
      transform:
        "translateY(calc(-1 * var(--lr-animation-bounce-height, var(--_lr-animation-bounce-height))))",
      offset: 0.4,
    },
    { transform: "translateY(0)", offset: 0.7 },
    {
      transform:
        "translateY(calc(-0.4 * var(--lr-animation-bounce-height, var(--_lr-animation-bounce-height))))",
      offset: 0.85,
    },
    { transform: "translateY(0)", offset: 1 },
  ],
  pulse: [
    { transform: "scale(1)", opacity: 1, offset: 0 },
    { transform: "scale(0.92)", opacity: 0.75, offset: 0.5 },
    { transform: "scale(1)", opacity: 1, offset: 1 },
  ],
  spin: [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
  shake: [
    { transform: "translateX(0)", offset: 0 },
    {
      transform:
        "translateX(calc(-1 * var(--lr-animation-shake-distance, var(--_lr-animation-shake-distance))))",
      offset: 0.2,
    },
    {
      transform:
        "translateX(var(--lr-animation-shake-distance, var(--_lr-animation-shake-distance)))",
      offset: 0.4,
    },
    {
      transform:
        "translateX(calc(-1 * var(--lr-animation-shake-distance, var(--_lr-animation-shake-distance))))",
      offset: 0.6,
    },
    {
      transform:
        "translateX(var(--lr-animation-shake-distance, var(--_lr-animation-shake-distance)))",
      offset: 0.8,
    },
    { transform: "translateX(0)", offset: 1 },
  ],
};

/** Builds the RTL-aware slide keyframes for `slide-in-start`/`slide-in-end`/
 * `slide-out-start`/`slide-out-end`. "start"/"end" are logical edges: under
 * `ltr` the start edge is physically left and the end edge is physically
 * right; under `rtl` that's reversed. */
function slidePreset(
  edge: "start" | "end",
  mode: "in" | "out",
  dir: "ltr" | "rtl"
): Keyframe[] {
  const negative = dir === "ltr" ? edge === "start" : edge === "end";
  const offscreen = `translateX(${
    negative
      ? "calc(-1 * var(--lr-animation-slide-distance, var(--_lr-animation-slide-distance)))"
      : "var(--lr-animation-slide-distance, var(--_lr-animation-slide-distance))"
  })`;
  const onscreen = "translateX(0)";
  return mode === "in"
    ? [
        { transform: offscreen, opacity: 0 },
        { transform: onscreen, opacity: 1 },
      ]
    : [
        { transform: onscreen, opacity: 1 },
        { transform: offscreen, opacity: 0 },
      ];
}

const DIRECTIONAL_SLIDE_NAMES = new Set<string>([
  "slide-in-start",
  "slide-in-end",
  "slide-out-start",
  "slide-out-end",
]);
const PLAYBACK_DIRECTIONS = new Set<string>([
  "normal",
  "reverse",
  "alternate",
  "alternate-reverse",
]);
const FILL_MODES = new Set<string>([
  "none",
  "forwards",
  "backwards",
  "both",
  "auto",
]);
function isElementOwnedBy(
  value: unknown,
  ownerDocument: Document
): value is Element {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<Element> & { nodeType?: number };
  if (
    candidate.nodeType !== 1 ||
    candidate.ownerDocument !== ownerDocument ||
    typeof candidate.localName !== "string" ||
    typeof candidate.getAttribute !== "function"
  )
    return false;
  const ElementCtor = ownerDocument.defaultView?.Element;
  if (ElementCtor && value instanceof ElementCtor) return true;
  return (
    typeof candidate.matches === "function" &&
    typeof candidate.getRootNode === "function"
  );
}

/** Reads and decomposes a compound `--lr-transition-*` token (e.g. `"180ms ease-out"`)
 * into the plain numeric `duration`/string `easing` pair the Web Animations API needs --
 * WAAPI's numeric timing options cannot take a `var()` reference the way a CSS `transform`
 * string can. Resolves against fully computed style, so a theme override that itself uses
 * `var()` internally never leaks unresolved text into `easing`. */
function resolveTimingToken(
  el: HTMLElement,
  preset: "fast" | "base" | "ambient"
): { duration: number; easing: string } {
  const raw =
    el.ownerDocument.defaultView
      ?.getComputedStyle(el)
      .getPropertyValue(`--lr-transition-${preset}`)
      .trim() ?? "";
  const match = /^((?:\d+(?:\.\d*)?)|(?:\.\d+))(ms|s)\s+(.+)$/.exec(raw);
  if (!match) return { duration: 1000, easing: "linear" };
  // safe: all three capture groups are non-optional, so a successful match fills them.
  const num = match[1]!;
  const unit = match[2]!;
  const easing = match[3]!;
  const duration = (unit === "s" ? 1000 : 1) * Number(num);
  const resolvedEasing = easing.trim();
  if (
    !Number.isFinite(duration) ||
    !el.ownerDocument.defaultView?.CSS?.supports(
      "animation-timing-function",
      resolvedEasing
    )
  ) {
    return { duration: 1000, easing: "linear" };
  }
  return { duration, easing: resolvedEasing };
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
 * Named presets resolve through the public animation registry as `animation.<name>`. Per-element
 * overrides win over page defaults; `rtlKeyframes` follows the live inherited text direction and
 * a `null` override disables interpolation without skipping `lr-start`/`lr-finish`.
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
 * @status stable
 * @since 4.0.0
 */
export class LyraAnimation extends LyraElement<LyraAnimationEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Built-in preset or consumer-registered `animation.<name>` key. */
  @property() name: string = "none";
  @property({ attribute: false }) keyframes: Keyframe[] | undefined = undefined;
  @property({ type: Boolean, reflect: true }) play = false;
  @property({ type: Number }) delay = 0;
  @property() direction: PlaybackDirection = "normal";
  @property({ type: Number }) duration = 1000;
  @property() easing = "linear";
  @property({ type: Number, attribute: "end-delay" }) endDelay = 0;
  @property() fill: FillMode = "auto";
  @property({ type: Number }) iterations: number = Infinity;
  @property({ type: Number, attribute: "iteration-start" }) iterationStart = 0;
  @property({ type: Number, attribute: "playback-rate" }) playbackRate = 1;
  @property({ attribute: "timing-preset", reflect: true })
  timingPreset: LyraAnimationTimingPreset = "custom";
  @property({
    type: Boolean,
    attribute: "respect-reduced-motion",
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  respectReducedMotion = true;
  @property({ type: Boolean, attribute: "play-on-visible", reflect: true })
  playOnVisible = false;
  @property({
    type: Boolean,
    attribute: "play-on-visible-repeat",
    reflect: true,
  })
  playOnVisibleRepeat = false;
  @property({ attribute: "root-margin" }) rootMargin = "0px";
  private _threshold: number | readonly number[] = 0;
  /** Intersection thresholds for `playOnVisible`; arrays are bounded, filtered, and frozen. */
  @property({ attribute: false })
  get threshold(): number | readonly number[] {
    return this._threshold;
  }
  set threshold(next: number | readonly number[]) {
    const old = this._threshold;
    this._threshold = snapshotVisibilityThreshold(next);
    this.requestUpdate("threshold", old);
  }
  @property({ attribute: false }) root: Element | null = null;

  private animation?: Animation;
  private hasStarted = false;
  private visibilityObserver?: IntersectionObserver;
  private motionQuery?: MediaQueryList;
  private motionQueryListener?: () => void;
  private lastTextDirection?: "ltr" | "rtl";

  // WAAPI timing values are not timer durations. Signed finite delay/endDelay values are valid,
  // and finite non-negative durations may exceed setTimeout's ceiling. Keep the two domains
  // separate while rejecting only values that Web Animations cannot consume.
  private get safeDelay(): number {
    return finiteNumber(this.delay, 0);
  }
  private get safeDuration(): number {
    return finiteRange(this.duration, 1000, 0);
  }
  private get safeEndDelay(): number {
    return finiteNumber(this.endDelay, 0);
  }
  /** `iterations` normalized to a finite, non-negative real -- *or* `Infinity` verbatim.
   *  `Infinity` is this property's own documented default (an animation that repeats forever,
   *  mirroring the upstream Web Awesome/Shoelace contract) and a legitimate, spec-sanctioned
   *  `EffectTiming.iterations` value, so it must never be coerced away by `finiteRange`'s clamp
   *  (which cannot itself represent "fall back to Infinity" -- its fallback parameter must be
   *  finite). Only a genuinely invalid raw value (`NaN`, negative, `-Infinity`) falls back to `1`. */
  private get safeIterations(): number {
    return this.iterations === Infinity
      ? Infinity
      : finiteRange(this.iterations, 1, 0);
  }
  private get safeIterationStart(): number {
    return finiteRange(this.iterationStart, 0, 0);
  }
  private get safePlaybackRate(): number {
    return finiteNumber(this.playbackRate, 1);
  }
  private get safeDirection(): PlaybackDirection {
    return PLAYBACK_DIRECTIONS.has(this.direction) ? this.direction : "normal";
  }
  private get safeFill(): FillMode {
    return FILL_MODES.has(this.fill) ? this.fill : "auto";
  }
  private get safeTimingPreset(): LyraAnimationTimingPreset {
    return this.timingPreset === "fast" ||
      this.timingPreset === "base" ||
      this.timingPreset === "ambient"
      ? this.timingPreset
      : "custom";
  }
  private safeEasing(value: string): string {
    const resolved = resolveNamedEasing(value);
    return this.ownerDocument.defaultView?.CSS?.supports(
      "animation-timing-function",
      resolved
    )
      ? resolved
      : "linear";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.bindMotionPreference();
    this.scheduleAfterUpdate(() => {
      this.createAnimation();
      this.syncVisibilityObserver();
    });
  }

  override disconnectedCallback(): void {
    this.destroyAnimation();
    this.disconnectVisibilityObserver();
    this.unbindMotionPreference();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Adoption normally brackets this hook with disconnect/connect callbacks. Repeat the teardown
    // here as a defensive boundary so no old-realm callback can survive an unusual adoption path.
    this.destroyAnimation();
    this.disconnectVisibilityObserver();
    this.unbindMotionPreference();
    if (!this.isConnected) return;
    this.bindMotionPreference();
    this.scheduleAfterUpdate(() => {
      this.createAnimation();
      this.syncVisibilityObserver();
    });
  }

  private bindMotionPreference(): void {
    this.unbindMotionPreference();
    const owner = this.ownerDocument.defaultView;
    const query = owner?.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!owner || !query) return;
    const listener = (): void => {
      if (
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner ||
        this.motionQuery !== query
      )
        return;
      this.createAnimation();
    };
    this.motionQuery = query;
    this.motionQueryListener = listener;
    query.addEventListener("change", listener);
  }

  private unbindMotionPreference(): void {
    if (this.motionQuery && this.motionQueryListener) {
      this.motionQuery.removeEventListener("change", this.motionQueryListener);
    }
    this.motionQuery = undefined;
    this.motionQueryListener = undefined;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const rebuildKeys = [
      "name",
      "keyframes",
      "delay",
      "direction",
      "duration",
      "easing",
      "endDelay",
      "fill",
      "iterations",
      "iterationStart",
      "timingPreset",
      "respectReducedMotion",
    ] as const;
    const textDirection = this.effectiveDirection;
    const textDirectionChanged =
      this.lastTextDirection !== undefined &&
      this.lastTextDirection !== textDirection;
    this.lastTextDirection = textDirection;
    if (rebuildKeys.some((key) => changed.has(key)) || textDirectionChanged)
      this.createAnimation();
    else if (changed.has("play")) this.applyPlayState();
    if (changed.has("playbackRate") && this.animation)
      this.animation.playbackRate = this.safePlaybackRate;
    if (
      [
        "playOnVisible",
        "playOnVisibleRepeat",
        "rootMargin",
        "threshold",
        "root",
      ].some((key) => changed.has(key))
    ) {
      this.scheduleAfterUpdate(this.syncVisibilityObserver);
    }
  }

  private onSlotChange = (): void => {
    this.createAnimation();
    this.syncVisibilityObserver();
  };

  private currentTarget(): Element | undefined {
    const slot = this.renderRoot.querySelector("slot");
    const [first] = slot?.assignedElements({ flatten: true }) ?? [];
    return isElementOwnedBy(first, this.ownerDocument) ? first : undefined;
  }

  private resolveAnimation(): LyraResolvedElementAnimation | undefined {
    if (this.keyframes) return { keyframes: this.keyframes, options: {} };
    const { name } = this;
    if (name === "none") return undefined;
    let fallback: LyraElementAnimation | undefined;
    if (DIRECTIONAL_SLIDE_NAMES.has(name)) {
      const mode = name.startsWith("slide-in-") ? "in" : "out";
      const edge = name.endsWith("-start") ? "start" : "end";
      fallback = {
        keyframes: slidePreset(edge, mode, "ltr"),
        rtlKeyframes: slidePreset(edge, mode, "rtl"),
      };
    } else {
      const keyframes = PRESETS[name] ?? resolveCatalogAnimation(name);
      if (keyframes) fallback = { keyframes };
    }
    try {
      return getAnimation(this, `animation.${name}`, {
        dir: this.effectiveDirection,
        fallback,
        // <lr-animation> already owns the stronger policy that instantly finishes while preserving
        // lr-start/lr-finish ordering; do not flatten twice inside the registry lookup.
        respectReducedMotion: false,
      });
    } catch {
      return fallback
        ? { keyframes: fallback.keyframes, options: fallback.options ?? {} }
        : undefined;
    }
  }

  private syncVisibilityObserver = (): void => {
    this.disconnectVisibilityObserver();
    if (!this.isConnected || !this.playOnVisible) return;
    const target = this.currentTarget();
    if (!target) return;
    const owner = this.ownerDocument.defaultView;
    const Observer = owner?.IntersectionObserver;
    if (!owner || !Observer) {
      // No observer support in this environment -- fail open and just play.
      this.play = true;
      return;
    }
    let observer: IntersectionObserver | undefined;
    const callback: IntersectionObserverCallback = (entries) => {
      if (
        !observer ||
        this.visibilityObserver !== observer ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner
      )
        return;
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) {
        this.play = true;
        if (!this.playOnVisibleRepeat) {
          observer.disconnect();
          if (this.visibilityObserver === observer)
            this.visibilityObserver = undefined;
        }
      } else if (this.playOnVisibleRepeat) {
        this.play = false;
      }
    };
    const root = isElementOwnedBy(this.root, this.ownerDocument)
      ? this.root
      : null;
    try {
      observer = new Observer(callback, {
        root,
        rootMargin: this.rootMargin,
        // The DOM lib still spells this Web IDL sequence as mutable `number[]`; retain our
        // readonly public snapshot and hand the browser a fresh mutable boundary copy.
        threshold:
          typeof this.threshold === "number"
            ? this.threshold
            : [...this.threshold],
      });
    } catch {
      try {
        observer = new Observer(callback, {
          root,
          rootMargin: "0px",
          threshold: 0,
        });
      } catch {
        this.play = true;
        return;
      }
    }
    this.visibilityObserver = observer;
    try {
      observer.observe(target);
    } catch {
      this.disconnectVisibilityObserver();
      this.play = true;
    }
  };

  private disconnectVisibilityObserver(): void {
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
  }

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
    this.animation.removeEventListener("cancel", this.onAnimationCancel);
    this.animation.removeEventListener("finish", this.onAnimationFinish);
    this.animation.cancel();
    this.animation = undefined;
    this.hasStarted = false;
  }

  private createAnimation = (): void => {
    this.destroyAnimation();
    if (!this.isConnected) return;
    const target = this.currentTarget();
    const registered = this.resolveAnimation();
    if (!target || !registered) return;
    const disabled = registered.keyframes.length === 0;
    let keyframes: Keyframe[];
    try {
      const source = disabled ? [{}, {}] : registered.keyframes;
      if (!Array.isArray(source) || source.length > 512)
        throw new TypeError("Invalid keyframe sequence.");
      keyframes = source.map((keyframe) => {
        if (typeof keyframe !== "object" || keyframe === null)
          throw new TypeError("Invalid keyframe record.");
        return { ...keyframe };
      });
    } catch {
      keyframes = [{}, {}];
    }
    const reduced =
      this.respectReducedMotion &&
      prefersReducedMotion(this.ownerDocument.defaultView);
    const timingPreset = this.safeTimingPreset;
    const { duration, easing } =
      timingPreset === "custom"
        ? { duration: this.safeDuration, easing: this.safeEasing(this.easing) }
        : resolveTimingToken(this, timingPreset);
    const baseOptions: KeyframeAnimationOptions = {
      delay: this.safeDelay,
      direction: this.safeDirection,
      duration,
      easing,
      endDelay: this.safeEndDelay,
      fill: this.safeFill,
      iterationStart: this.safeIterationStart,
      iterations: reduced
        ? Math.min(this.safeIterations, 1)
        : this.safeIterations,
    };
    const options: KeyframeAnimationOptions = {
      ...baseOptions,
      ...registered.options,
    };
    // The component owns reduced-motion arbitration because it must also call finish() below to
    // preserve the resolved end state and lr-start/lr-finish ordering. Apply that policy after a
    // registry override's timing so customization can never reintroduce motion. An explicit null
    // registration uses the same zero-time lifecycle even when the OS preference is unchanged.
    if (reduced || disabled) {
      options.delay = 0;
      options.duration = 0;
      options.endDelay = 0;
      options.iterations = 1;
    }
    try {
      this.animation = target.animate(keyframes, options);
    } catch {
      try {
        // Never retry the same rejected payload. An inert pair plus sanitized base timing keeps
        // the component usable without allowing hostile registry/keyframe input to reject update.
        this.animation = target.animate([{}, {}], baseOptions);
      } catch {
        this.animation = undefined;
        this.hasStarted = false;
        return;
      }
    }
    this.animation.playbackRate = this.safePlaybackRate;
    this.animation.addEventListener("cancel", this.onAnimationCancel);
    this.animation.addEventListener("finish", this.onAnimationFinish);
    if (this.play) {
      this.hasStarted = true;
      this.emit("lr-start", null);
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
        this.emit("lr-start", null);
      }
      this.animation.play();
    } else if (this.animation.playState !== "idle") {
      // An idle (canceled) animation is already "not playing", and pause() is not a no-op for it:
      // per the Web Animations API, pausing an idle animation with a non-negative playback rate
      // seeks it to time zero and un-cancels it into 'paused', re-applying the effect's first
      // keyframe. Since the public cancel() deliberately lets the native `cancel` event through,
      // and that handler sets `play = false`, this branch would otherwise resurrect every
      // canceled animation on the very next update -- freezing the target on keyframe zero
      // instead of reverting it. `finished` needs no such guard: its currentTime is already
      // resolved, so pause() there really is inert.
      this.animation.pause();
    }
  };

  private onAnimationFinish = (): void => {
    this.play = false;
    this.hasStarted = false;
    this.emit("lr-finish", null);
  };

  private onAnimationCancel = (): void => {
    this.play = false;
    this.hasStarted = false;
    this.emit("lr-cancel", null);
  };

  get currentTime(): CSSNumberish {
    return this.animation?.currentTime ?? 0;
  }

  set currentTime(value: CSSNumberish) {
    if (!this.animation) return;
    if (typeof value === "number" && !Number.isFinite(value)) return;
    this.animation.currentTime = value;
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
    "lr-animation": LyraAnimation;
  }
}
