import {
  getAnimation,
  type LyraElementAnimation,
} from '../utilities/animation-registry.js';
import { prefersReducedMotion } from './motion.js';

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

function fallbackAnimation(target: HTMLElement, spec: RegisteredAnimationSpec): LyraElementAnimation {
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
 * Flattens timing under `prefers-reduced-motion: reduce`. Applied here, at the single call site
 * that reaches `Element.animate()`, so no per-component fallback, no public `--show-duration`/
 * `--hide-duration` value and no registry override carrying an explicit `options.duration` can
 * defeat the preference — a CSS media query cannot reach a Web Animations timing object at all.
 * Keyframes are preserved so the animation still lands on its end state and its `finished` promise
 * still resolves, keeping every caller's show/hide lifecycle intact.
 */
function clampReducedMotion(
  target: HTMLElement,
  options: KeyframeAnimationOptions,
): KeyframeAnimationOptions {
  if (!prefersReducedMotion(target.ownerDocument?.defaultView)) return options;
  return { ...options, duration: 0, delay: 0, endDelay: 0, iterations: 1 };
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
  const resolvedKeyframes = resolved.keyframes.map((keyframe) => ({ ...keyframe }));
  const options = clampReducedMotion(target, {
    ...resolved.options,
    id: resolved.options.id ?? animationName,
  });
  try {
    return target.animate(resolvedKeyframes, options);
  } catch {
    const keyframes = direction === 'rtl' && fallback.rtlKeyframes
      ? fallback.rtlKeyframes
      : fallback.keyframes;
    try {
      return target.animate(
        keyframes.map((keyframe) => ({ ...keyframe })),
        clampReducedMotion(target, fallback.options ?? {}),
      );
    } catch {
      return undefined;
    }
  }
}
