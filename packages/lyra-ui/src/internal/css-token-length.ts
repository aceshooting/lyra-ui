import { resolveCssLength } from './css-length.js';

/**
 * Resolves a theme length to pixels, including density's CSS math. Literal lengths retain the
 * allocation-free resolver path. Expressions use a connected probe in the owner's tree so rem,
 * em and inherited variables resolve where the token is consumed. Percentages have no unambiguous
 * basis here; layout breakpoints keep using resolveCssLength with their explicit context.
 */
export function resolveCssTokenLength(
  value: number | string | undefined,
  options: { readonly host: Element },
): number | undefined {
  const literal = resolveCssLength(value, options);
  if (literal !== undefined) return literal;
  if (typeof value !== 'string' || !/^(?:calc|min|max|clamp)\(/i.test(value.trim()) || value.includes('%')) {
    return undefined;
  }
  const { host } = options;
  const view = host.ownerDocument.defaultView;
  if (!host.isConnected || !view) return undefined;

  const probe = host.ownerDocument.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  // Prepare all declarations while detached. A connected CSSOM write would invalidate the theme
  // observer that requested this measurement. setProperty also prevents declaration injection.
  probe.style.setProperty('all', 'initial', 'important');
  for (const [name, input] of [
    ['position', 'fixed'],
    ['display', 'block'],
    ['font-size', view.getComputedStyle(host).fontSize],
    ['width', '0'],
    ['height', '0'],
    ['visibility', 'hidden'],
    ['pointer-events', 'none'],
    ['translate', value],
  ] as const) {
    probe.style.setProperty(name, input, 'important');
  }
  // translate has a 'none' initial value, so invalid math (including a missing var) cannot be
  // mistaken for a valid zero length. It also preserves negative lengths for caller-side clamps.
  if (!probe.style.translate) return undefined;
  try {
    (host.shadowRoot ?? host).append(probe);
    const resolved = view.getComputedStyle(probe).translate;
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)px$/i.test(resolved)) return undefined;
    const pixels = Number.parseFloat(resolved);
    return Number.isFinite(pixels) ? pixels : undefined;
  } finally {
    probe.remove();
  }
}
