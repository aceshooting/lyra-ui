import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

/** Render literal native tooltip text without raw-text expression markers in SVG fragments. */
export function nativeSvgTitle(text: string): ReturnType<typeof unsafeSVG> {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r', '&#13;');
  return unsafeSVG(`<title>${escaped}</title>`);
}
