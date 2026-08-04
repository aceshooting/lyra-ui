/**
 * Rejects an attribute name that should never survive a raw DOM clone of consumer-supplied SVG
 * content (`<lr-icon>`'s and `<lr-icon-button>`'s slotted custom-content path -- unlike a fetched
 * `src` document, which is sanitized through DOMPurify before it ever reaches the DOM, a slotted
 * clone has no sanitizer in the loop, so this predicate is that path's own trust boundary).
 * Event-handler content attributes (`on*`) execute as inline JS once connected; `href`/
 * `xlink:href` on an SVG `<a>`/`<use>`/`<image>` can carry a `javascript:` URI or reference an
 * external resource. Every other presentational attribute (`d`, `fill`, `stroke`, `viewBox`,
 * `transform`, gradient stops, …) is left untouched -- this is a denylist, not an allowlist,
 * because SVG's legitimate presentation-attribute vocabulary is too large to enumerate without
 * silently breaking real icon markup.
 */
export function isUnsafeSvgCloneAttribute(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('on') || lower === 'href' || lower === 'xlink:href';
}
