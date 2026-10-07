/** Convert one computed CSS time to milliseconds. Keep parseFloat's permissive prefix parsing:
 * callers already accept it for strings ending in `ms` or `s`. Invalid and non-finite values
 * contribute zero to timing calculations. Negative delays remain negative for paired animations. */
export function parseCssTime(value: string): number {
  const trimmed = value.trim();
  const parsed = trimmed.endsWith('ms')
    ? Number.parseFloat(trimmed)
    : trimmed.endsWith('s')
      ? Number.parseFloat(trimmed) * 1000
      : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The zero-floored maximum of a computed comma-separated time list. Callers deliberately add
 * duration and delay maxima independently rather than pairing transition list entries. */
export function maxCssTime(value: string): number {
  return Math.max(0, ...value.split(',').map(parseCssTime));
}

/** Watches the surface's live CSS exit duration, including cancellation and a bounded fallback. */
export function waitForTransitionSettle(
  surface: Element | null,
  host: Element,
  options: { reducedMotion?: boolean; includeAnimation?: boolean } = {},
): { readonly pending: boolean; readonly finished: Promise<void>; cancel(): void } {
  const view = host.ownerDocument.defaultView;
  if (!surface || !view || options.reducedMotion) {
    return { pending: false, finished: Promise.resolve(), cancel: () => undefined };
  }
  const computed = view.getComputedStyle(surface);
  const transitionMs = maxCssTime(computed.transitionDuration) + maxCssTime(computed.transitionDelay);
  const animationMs = options.includeAnimation
    ? maxCssTime(computed.animationDuration) + maxCssTime(computed.animationDelay)
    : 0;
  const durationMs = Math.max(transitionMs, animationMs);
  if (durationMs <= 0) {
    return { pending: false, finished: Promise.resolve(), cancel: () => undefined };
  }
  let finish = (): void => undefined;
  const finished = new Promise<void>(resolve => {
    let settled = false;
    let timeout: number | undefined;
    const onEnd = (event: Event): void => {
      if (event.target === surface) finish();
    };
    finish = (): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) view.clearTimeout(timeout);
      surface.removeEventListener('transitionend', onEnd);
      surface.removeEventListener('transitioncancel', onEnd);
      surface.removeEventListener('animationend', onEnd);
      surface.removeEventListener('animationcancel', onEnd);
      resolve();
    };
    surface.addEventListener('transitionend', onEnd);
    surface.addEventListener('transitioncancel', onEnd);
    if (options.includeAnimation) {
      surface.addEventListener('animationend', onEnd);
      surface.addEventListener('animationcancel', onEnd);
    }
    timeout = view.setTimeout(finish, durationMs + 50);
  });
  return { pending: true, finished, cancel: () => finish() };
}

const CSS_TIME_TOKEN = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(ms|s)(?:\s+(.*))?$/i;

/** A leading CSS `<time>` token of an authored value: its finite milliseconds (sign, exponent and
 * either unit case allowed) and the trimmed text after it, or undefined when the value is not one.
 * A caller that accepts only a bare time checks `rest === ''`. */
export function parseCssTimeToken(value: string): { ms: number; rest: string } | undefined {
  const match = CSS_TIME_TOKEN.exec(value.trim());
  const ms = match && Number(match[1]) * (match[2]!.toLowerCase() === 's' ? 1000 : 1);
  return match && Number.isFinite(ms) ? { ms: ms!, rest: match[3]?.trim() ?? '' } : undefined;
}
