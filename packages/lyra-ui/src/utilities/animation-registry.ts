import { prefersReducedMotion } from '../internal/motion.js';

/** A component animation expressed in the native Web Animations API vocabulary. Each logical
 * direction is snapshotted at registration/resolution time and bounded to 512 keyframes. */
export interface LyraElementAnimation {
  readonly keyframes: readonly Readonly<Keyframe>[];
  /** Logical-direction alternative. Falls back to `keyframes` when omitted. */
  readonly rtlKeyframes?: readonly Readonly<Keyframe>[];
  readonly options?: Readonly<KeyframeAnimationOptions>;
}

/** The normalized value returned by {@link getAnimation}. */
export interface LyraResolvedElementAnimation {
  readonly keyframes: readonly Readonly<Keyframe>[];
  readonly options: Readonly<KeyframeAnimationOptions>;
}

export interface LyraGetAnimationOptions {
  /** Text direction used to select `rtlKeyframes`. Inferred from the element when omitted. */
  readonly dir?: 'ltr' | 'rtl';
  /** Component-owned animation used when neither registry level has an entry. Registry timing
   * overrides are merged over this fallback's options so token-derived duration/easing survive a
   * keyframes-only customization. */
  readonly fallback?: LyraElementAnimation | null;
  /** Defaults to true. Set false only when the caller owns a stronger reduced-motion policy. */
  readonly respectReducedMotion?: boolean;
}

/** Idempotently removes the exact registration made by one setter call. */
export type LyraAnimationCleanup = () => void;

const INVALID_ANIMATION = Symbol('invalid-animation');
type StoredAnimation = LyraElementAnimation | null | typeof INVALID_ANIMATION;

const MAX_ANIMATION_KEYFRAMES = 512;
const MAX_KEYFRAME_PROPERTIES = 256;
const MAX_ANIMATION_OPTION_PROPERTIES = 64;

interface RegistryEntry {
  animation: StoredAnimation;
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
  animation: LyraElementAnimation | null,
): LyraAnimationCleanup {
  assertAnimationName(animationName);
  const entry: RegistryEntry = {
    animation: snapshotAnimation(animation),
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
 * active registration and is safe to call more than once. Malformed, oversized, or getter-
 * throwing JavaScript records register inertly so they cannot throw later from a component's
 * render path.
 */
export function setDefaultAnimation(
  animationName: string,
  animation: LyraElementAnimation | null,
): LyraAnimationCleanup {
  return register(defaultAnimations, animationName, animation);
}

/**
 * Sets one element's animation override. Per-element state is stored in a `WeakMap`, so the
 * registry cannot retain a detached element. The override survives a reconnect of the same
 * element instance until the returned cleanup is called; `null` explicitly disables the name.
 * Malformed, oversized, or getter-throwing JavaScript records register inertly and resolve to a
 * valid caller fallback (or the disabled result) instead of escaping into component rendering.
 */
export function setAnimation(
  element: Element,
  animationName: string,
  animation: LyraElementAnimation | null,
): LyraAnimationCleanup {
  if (!isElement(element)) throw new TypeError('setAnimation() requires an Element.');
  let registry = elementAnimations.get(element);
  if (!registry) {
    registry = new Map();
    elementAnimations.set(element, registry);
  }
  return register(registry, animationName, animation);
}

function snapshotRecord<Value extends object>(
  value: unknown,
  maximumProperties: number,
): Readonly<Value> | typeof INVALID_ANIMATION {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return INVALID_ANIMATION;
  }
  try {
    if (Array.isArray(value)) return INVALID_ANIMATION;
    const prototype = Object.getPrototypeOf(value);
    const directPrototype =
      prototype === null ||
      Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value?.name ===
        'Object';
    const snapshot: Record<string, unknown> = {};
    let propertyCount = 0;
    const keys = directPrototype ? ownAnimationRecordKeys(value) : Object.keys(value);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) continue;
      propertyCount += 1;
      if (propertyCount > maximumProperties || !('value' in descriptor))
        return INVALID_ANIMATION;
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        value: descriptor.value,
        writable: false,
      });
    }
    return Object.freeze(snapshot) as Readonly<Value>;
  } catch {
    return INVALID_ANIMATION;
  }
}

function* ownAnimationRecordKeys(value: object): IterableIterator<string> {
  for (const key in value) {
    if (Object.getOwnPropertyDescriptor(value, key)?.enumerable) yield key;
  }
}

function snapshotKeyframes(
  value: unknown,
): readonly Readonly<Keyframe>[] | typeof INVALID_ANIMATION {
  try {
    if (!Array.isArray(value)) return INVALID_ANIMATION;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      !lengthDescriptor ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number'
    )
      return INVALID_ANIMATION;
    const length = lengthDescriptor.value;
    if (length > MAX_ANIMATION_KEYFRAMES) return INVALID_ANIMATION;
    const snapshot: Readonly<Keyframe>[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor)) return INVALID_ANIMATION;
      const keyframe = snapshotRecord<Keyframe>(
        descriptor.value,
        MAX_KEYFRAME_PROPERTIES,
      );
      if (keyframe === INVALID_ANIMATION) return INVALID_ANIMATION;
      snapshot.push(keyframe);
    }
    return Object.freeze(snapshot);
  } catch {
    return INVALID_ANIMATION;
  }
}

function snapshotOptions(
  value: unknown,
): Readonly<KeyframeAnimationOptions> | typeof INVALID_ANIMATION {
  return snapshotRecord<KeyframeAnimationOptions>(value, MAX_ANIMATION_OPTION_PROPERTIES);
}

function snapshotAnimation(animation: unknown): StoredAnimation {
  if (animation === null) return null;
  if (typeof animation !== 'object' || animation === null) return INVALID_ANIMATION;
  try {
    const keyframesDescriptor = Object.getOwnPropertyDescriptor(
      animation,
      'keyframes',
    );
    if (!keyframesDescriptor || !('value' in keyframesDescriptor))
      return INVALID_ANIMATION;
    const keyframes = snapshotKeyframes(keyframesDescriptor.value);
    if (keyframes === INVALID_ANIMATION) return INVALID_ANIMATION;

    const rtlDescriptor = Object.getOwnPropertyDescriptor(
      animation,
      'rtlKeyframes',
    );
    if (rtlDescriptor && !('value' in rtlDescriptor)) return INVALID_ANIMATION;
    const rtlCandidate = rtlDescriptor?.value;
    const rtlKeyframes = rtlCandidate === undefined
      ? undefined
      : snapshotKeyframes(rtlCandidate);
    if (rtlKeyframes === INVALID_ANIMATION) return INVALID_ANIMATION;

    const optionsDescriptor = Object.getOwnPropertyDescriptor(
      animation,
      'options',
    );
    if (optionsDescriptor && !('value' in optionsDescriptor))
      return INVALID_ANIMATION;
    const optionsCandidate = optionsDescriptor?.value;
    const options = optionsCandidate === undefined
      ? undefined
      : snapshotOptions(optionsCandidate);
    if (options === INVALID_ANIMATION) return INVALID_ANIMATION;

    return Object.freeze({ keyframes, rtlKeyframes, options });
  } catch {
    return INVALID_ANIMATION;
  }
}

function inferredDirection(element: Element): 'ltr' | 'rtl' {
  const view = element.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return element.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
  return view.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}

function resolvedAnimation(
  keyframes: readonly Readonly<Keyframe>[],
  options: Readonly<KeyframeAnimationOptions>,
): LyraResolvedElementAnimation {
  const keyframeSnapshot = snapshotKeyframes(keyframes);
  const optionsSnapshot = snapshotOptions(options);
  if (keyframeSnapshot === INVALID_ANIMATION || optionsSnapshot === INVALID_ANIMATION) {
    return Object.freeze({
      keyframes: Object.freeze([]),
      options: Object.freeze({ duration: 0 }),
    });
  }
  return Object.freeze({
    keyframes: keyframeSnapshot,
    options: optionsSnapshot,
  });
}

function disabledAnimation(): LyraResolvedElementAnimation {
  return resolvedAnimation([], { duration: 0 });
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
  options: LyraGetAnimationOptions = {},
): LyraResolvedElementAnimation {
  if (!isElement(element)) throw new TypeError('getAnimation() requires an Element.');
  assertAnimationName(animationName);

  const elementEntry = currentEntry(elementAnimations.get(element)?.get(animationName));
  const defaultEntry = currentEntry(defaultAnimations.get(animationName));
  const entry = elementEntry ?? defaultEntry;
  const configured = entry?.animation;
  if (entry && configured === null) return disabledAnimation();

  let fallbackCandidate: unknown;
  try {
    fallbackCandidate = options?.fallback;
  } catch {
    fallbackCandidate = undefined;
  }
  const fallbackSnapshot = snapshotAnimation(fallbackCandidate);
  const fallback = fallbackSnapshot !== INVALID_ANIMATION && fallbackSnapshot !== null
    ? fallbackSnapshot
    : undefined;
  if (!entry && fallbackSnapshot === null) return disabledAnimation();
  // JavaScript consumers can bypass the public TypeScript shape, and a previously valid object
  // can be mutated after registration. Treat a structurally malformed override as unavailable so
  // component callers still reach their sanitized fallback instead of throwing during render.
  const selected = configured !== INVALID_ANIMATION && configured !== undefined
    ? configured
    : fallback;
  if (!selected) return disabledAnimation();

  let requestedDirection: unknown;
  try {
    requestedDirection = options?.dir;
  } catch {
    requestedDirection = undefined;
  }
  const direction = requestedDirection === 'ltr' || requestedDirection === 'rtl'
    ? requestedDirection
    : inferredDirection(element);
  const keyframes = direction === 'rtl' && selected.rtlKeyframes
    ? selected.rtlKeyframes
    : selected.keyframes;
  const resolvedOptions: KeyframeAnimationOptions = {
    ...(entry && fallback ? fallback.options : undefined),
    ...selected.options,
  };

  let respectReducedMotion: unknown;
  try {
    respectReducedMotion = options?.respectReducedMotion;
  } catch {
    respectReducedMotion = undefined;
  }

  // The element's OWN browsing context is what is queried: an element adopted into an iframe can
  // sit in a document whose media state differs from the top-level window's.
  if (
    respectReducedMotion !== false &&
    prefersReducedMotion(element.ownerDocument?.defaultView)
  ) {
    resolvedOptions.delay = 0;
    resolvedOptions.duration = 0;
    resolvedOptions.endDelay = 0;
    resolvedOptions.iterations = 1;
  }

  return resolvedAnimation(keyframes, resolvedOptions);
}
