import {
  getAnimation,
  type ElementAnimation,
} from '../utilities/animation-registry.js';

export interface RegisteredAnimationSpec {
  keyframes: Keyframe[];
  rtlKeyframes?: Keyframe[];
  /** Custom properties checked in order. Values may be a plain time or a compound `time easing`. */
  durationProperties: readonly string[];
  /** Custom properties checked in order for a standalone easing value. */
  easingProperties?: readonly string[];
  fallbackDuration?: number;
  fallbackEasing?: string;
  options?: KeyframeAnimationOptions;
}

interface ParsedDuration {
  duration: number;
  easing?: string;
}

function parseDuration(value: string): ParsedDuration | undefined {
  const match = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(ms|s)(?:\s+(.+))?$/i.exec(value.trim());
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const duration = Math.max(0, amount * (match[2]?.toLowerCase() === 's' ? 1000 : 1));
  return { duration, easing: match[3]?.trim() || undefined };
}

function supportsEasing(value: string): boolean {
  return typeof CSS === 'undefined' || typeof CSS.supports !== 'function'
    ? value.length > 0
    : CSS.supports('animation-timing-function', value);
}

function fallbackAnimation(target: HTMLElement, spec: RegisteredAnimationSpec): ElementAnimation {
  const style = target.ownerDocument.defaultView?.getComputedStyle(target);
  let parsed: ParsedDuration | undefined;
  for (const property of spec.durationProperties) {
    const candidate = style?.getPropertyValue(property).trim() ?? '';
    parsed = parseDuration(candidate);
    if (parsed) break;
  }

  let easing: string | undefined;
  for (const property of spec.easingProperties ?? []) {
    const candidate = style?.getPropertyValue(property).trim() ?? '';
    if (candidate && supportsEasing(candidate)) {
      easing = candidate;
      break;
    }
  }
  if (!easing && parsed?.easing && supportsEasing(parsed.easing)) easing = parsed.easing;
  easing ??= spec.fallbackEasing ?? 'linear';

  return {
    keyframes: spec.keyframes,
    rtlKeyframes: spec.rtlKeyframes,
    options: {
      duration: parsed?.duration ?? spec.fallbackDuration ?? 0,
      easing,
      fill: 'both',
      ...spec.options,
    },
  };
}

/**
 * Starts one registry-resolved animation with a component-owned, token-derived fallback.
 * A `null` override returns no native `Animation`, so callers can complete their normal lifecycle
 * immediately. Malformed public overrides fail closed to the sanitized fallback instead of
 * throwing out of a component update.
 */
export function animateRegistered(
  registryHost: Element,
  target: HTMLElement,
  animationName: string,
  direction: 'ltr' | 'rtl',
  spec: RegisteredAnimationSpec,
): Animation | undefined {
  const fallback = fallbackAnimation(target, spec);
  const resolved = getAnimation(registryHost, animationName, {
    dir: direction,
    fallback,
  });
  if (resolved.keyframes.length === 0) return undefined;
  const options: KeyframeAnimationOptions = {
    ...resolved.options,
    id: resolved.options.id ?? animationName,
  };
  try {
    return target.animate(resolved.keyframes, options);
  } catch {
    const keyframes = direction === 'rtl' && fallback.rtlKeyframes
      ? fallback.rtlKeyframes
      : fallback.keyframes;
    try {
      return target.animate(keyframes, fallback.options);
    } catch {
      return undefined;
    }
  }
}
