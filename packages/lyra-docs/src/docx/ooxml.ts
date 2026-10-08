export const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const OFFICE_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
export const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const CONTENT_TYPE_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
export const DRAWING_MAIN_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const DRAWING_PICTURE_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
export const WORD_DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
export const WORD_DRAWING_2010_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing';
export const WORD_ML_2010_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';
/** The bounded OOXML tree walk shared by the image and table readers. */
export const OOXML_TREE_LIMITS: Readonly<{ parts: number; nodes: number; depth: number; attributes: number }> = Object.freeze({ parts: 128, nodes: 20_000, depth: 64, attributes: 64 });

/** Resolves dot segments after a caller applies its own relationship policy. */
export function resolveOoxmlSegments(source: readonly string[], target: string): string[] | null {
  const segments = target.startsWith('/') ? [] : [...source];
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') { if (!segments.length) return null; segments.pop(); }
    else segments.push(segment);
  }
  return segments;
}

/** Resolves an internal package target without leaving the package root. */
export function resolveOoxmlPart(owner: string, target: string): string | null {
  if (!target || /[\\%\x00-\x20\x7f:?#]/.test(target) || target.startsWith('//')) return null;
  const segments = resolveOoxmlSegments(owner.split('/').slice(1, -1), target);
  return segments ? '/' + segments.join('/') : null;
}
