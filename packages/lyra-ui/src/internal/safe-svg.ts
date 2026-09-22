/** SVG elements whose cloned form can execute code, embed another document, or load resources. */
const UNSAFE_SVG_CLONE_ELEMENTS = new Set([
  'script',
  'style',
  'foreignobject',
  'animate',
  'animatecolor',
  'animatemotion',
  'animatetransform',
  'set',
  'discard',
  'mpath',
  'feimage',
  'image',
  'iframe',
  'object',
  'embed',
]);

const SVG_URL_PRESENTATION_ATTRIBUTES = new Set([
  'clip-path',
  'cursor',
  'fill',
  'filter',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);

function isLocalSvgFragment(value: string): boolean {
  return /^#[^\s"'()<>]+$/.test(value.trim());
}

function hasUnsafeCssResource(value: string): boolean {
  // Escaped CSS can spell `url` without containing that literal token. Reject URL-bearing
  // presentation values containing escapes, while retaining local paint-server fragments.
  if (value.includes('\\')) return true;
  const urls = [...value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)];
  if (urls.length === 0) return false;
  const withoutUrls = value.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, '').trim();
  return withoutUrls !== '' || urls.some((match) => !isLocalSvgFragment(match[2] ?? ''));
}

/**
 * Rejects an element that should never survive a raw DOM clone of consumer-supplied SVG content.
 * Unlike a fetched `src` document, `<lr-icon>`'s and `<lr-icon-button>`'s slotted clone paths do
 * not pass through DOMPurify, so this predicate is their own element trust boundary. The list is
 * deliberately narrow enough to retain ordinary icon primitives, groups, definitions, gradients,
 * masks, clipping paths, and `<use>` elements.
 */
export function isUnsafeSvgCloneElement(name: string): boolean {
  return UNSAFE_SVG_CLONE_ELEMENTS.has(name.toLowerCase());
}

/**
 * Rejects an attribute that should never survive a raw DOM clone of consumer-supplied SVG content.
 * Event-handler attributes execute as inline JS once connected; style and secondary resource
 * attributes can apply attacker-controlled CSS or initiate fetches; and href attributes can carry
 * script URLs or external document references. URL-bearing presentation attributes retain only
 * same-document fragment references, so ordinary icon geometry and local paint servers continue
 * to work.
 */
export function isUnsafeSvgCloneAttribute(name: string, value = ''): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith('on')) return true;
  if (lower === 'style' || lower === 'src' || lower === 'srcset' || lower === 'poster') return true;
  if (lower === 'href' || lower === 'xlink:href') return true;
  return SVG_URL_PRESENTATION_ATTRIBUTES.has(lower) && hasUnsafeCssResource(value);
}
