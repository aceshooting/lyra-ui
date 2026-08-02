/** A component animation expressed in the native Web Animations API vocabulary. */
export interface ElementAnimation {
  keyframes: Keyframe[];
  /** Logical-direction alternative. Falls back to `keyframes` when omitted. */
  rtlKeyframes?: Keyframe[];
  options?: KeyframeAnimationOptions;
}

/** Lyra-prefixed alias for consumers that prefer library-qualified public types. */
export type LyraElementAnimation = ElementAnimation;

/** The normalized value returned by {@link getAnimation}. */
export interface ResolvedElementAnimation {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

export interface GetAnimationOptions {
  /** Text direction used to select `rtlKeyframes`. Inferred from the element when omitted. */
  dir?: 'ltr' | 'rtl';
  /** Component-owned animation used when neither registry level has an entry. Registry timing
   * overrides are merged over this fallback's options so token-derived duration/easing survive a
   * keyframes-only customization. */
  fallback?: ElementAnimation | null;
  /** Defaults to true. Set false only when the caller owns a stronger reduced-motion policy. */
  respectReducedMotion?: boolean;
}

/** Idempotently removes the exact registration made by one setter call. */
export type AnimationCleanup = () => void;

interface RegistryEntry {
  animation: ElementAnimation | null;
  previous?: RegistryEntry;
  active: boolean;
}

const defaultAnimations = new Map<string, RegistryEntry>();
// The registry never holds an element strongly. A per-element cleanup closure captures only its
// small name->entry map, not the element used as the WeakMap key, so retaining the cleanup does not
// keep a detached component alive either.
const elementAnimations = new WeakMap<Element, Map<string, RegistryEntry>>();

function isElement(value: unknown): value is Element {
  // Do not use `instanceof Element`: elements from another browsing context have a different
  // constructor, and the global is absent during SSR. The DOM node contract is sufficient for
  // every operation below and keeps the module safe in either environment.
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

function assertAnimationName(animationName: string): void {
  if (typeof animationName !== 'string' || animationName.trim().length === 0) {
    throw new TypeError('Animation names must be non-empty strings.');
  }
}

function currentEntry(entry: RegistryEntry | undefined): RegistryEntry | undefined {
  let current = entry;
  while (current && !current.active) current = current.previous;
  return current;
}

function register(
  registry: Map<string, RegistryEntry>,
  animationName: string,
  animation: ElementAnimation | null,
): AnimationCleanup {
  assertAnimationName(animationName);
  const entry: RegistryEntry = {
    animation,
    previous: currentEntry(registry.get(animationName)),
    active: true,
  };
  registry.set(animationName, entry);
  return () => {
    if (!entry.active) return;
    entry.active = false;
    if (registry.get(animationName) !== entry) return;
    const previous = currentEntry(entry.previous);
    if (previous) registry.set(animationName, previous);
    else registry.delete(animationName);
  };
}

/**
 * Sets a page-wide animation override. Pass `null` to disable that named animation while keeping
 * component show/hide lifecycle promises intact. The returned cleanup restores the preceding
 * active registration and is safe to call more than once.
 */
export function setDefaultAnimation(
  animationName: string,
  animation: ElementAnimation | null,
): AnimationCleanup {
  return register(defaultAnimations, animationName, animation);
}

/**
 * Sets one element's animation override. Per-element state is stored in a `WeakMap`, so the
 * registry cannot retain a detached element. The override survives a reconnect of the same
 * element instance until the returned cleanup is called; `null` explicitly disables the name.
 */
export function setAnimation(
  element: Element,
  animationName: string,
  animation: ElementAnimation | null,
): AnimationCleanup {
  if (!isElement(element)) throw new TypeError('setAnimation() requires an Element.');
  let registry = elementAnimations.get(element);
  if (!registry) {
    registry = new Map();
    elementAnimations.set(element, registry);
  }
  return register(registry, animationName, animation);
}

function cloneKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return keyframes.map((keyframe) => ({ ...keyframe }));
}

function isElementAnimation(animation: unknown): animation is ElementAnimation {
  return typeof animation === 'object' &&
    animation !== null &&
    Array.isArray((animation as Partial<ElementAnimation>).keyframes);
}

function inferredDirection(element: Element): 'ltr' | 'rtl' {
  const view = element.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return element.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
  return view.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}

function hasReducedMotion(element: Element): boolean {
  const view = element.ownerDocument?.defaultView;
  return Boolean(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function disabledAnimation(): ResolvedElementAnimation {
  return { keyframes: [], options: { duration: 0 } };
}

/**
 * Resolves a per-element override, then a page-wide default, then the caller's fallback.
 *
 * Results are defensive copies. Under `prefers-reduced-motion: reduce`, delay/end-delay are
 * removed and duration is flattened to zero while the resolved keyframes remain available so a
 * caller can apply the correct end state and complete its normal async lifecycle. No browser
 * global is touched at module evaluation time, making the utility safe to import during SSR.
 */
export function getAnimation(
  element: Element,
  animationName: string,
  options: GetAnimationOptions = {},
): ResolvedElementAnimation {
  if (!isElement(element)) throw new TypeError('getAnimation() requires an Element.');
  assertAnimationName(animationName);

  const elementEntry = currentEntry(elementAnimations.get(element)?.get(animationName));
  const defaultEntry = currentEntry(defaultAnimations.get(animationName));
  const entry = elementEntry ?? defaultEntry;
  const configured = entry?.animation;
  if (entry && configured === null) return disabledAnimation();

  const fallback = isElementAnimation(options.fallback) ? options.fallback : undefined;
  if (!entry && options.fallback === null) return disabledAnimation();
  // JavaScript consumers can bypass the public TypeScript shape, and a previously valid object
  // can be mutated after registration. Treat a structurally malformed override as unavailable so
  // component callers still reach their sanitized fallback instead of throwing during render.
  const selected = isElementAnimation(configured) ? configured : fallback;
  if (!selected) return disabledAnimation();

  const direction = options.dir ?? inferredDirection(element);
  const keyframes = cloneKeyframes(
    direction === 'rtl' && Array.isArray(selected.rtlKeyframes) ? selected.rtlKeyframes : selected.keyframes,
  );
  const resolvedOptions: KeyframeAnimationOptions = {
    ...(entry && fallback ? fallback.options : undefined),
    ...selected.options,
  };

  if (options.respectReducedMotion !== false && hasReducedMotion(element)) {
    resolvedOptions.delay = 0;
    resolvedOptions.duration = 0;
    resolvedOptions.endDelay = 0;
    resolvedOptions.iterations = 1;
  }

  return { keyframes, options: resolvedOptions };
}
