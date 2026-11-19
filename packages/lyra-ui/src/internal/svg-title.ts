import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { escapeHtml } from './escape-html.js';

/** Render literal native tooltip text without raw-text expression markers in SVG fragments. */
export function nativeSvgTitle(text: string): ReturnType<typeof unsafeSVG> {
  const escaped = escapeHtml(text, { svgText: true });
  return unsafeSVG(`<title>${escaped}</title>`);
}
