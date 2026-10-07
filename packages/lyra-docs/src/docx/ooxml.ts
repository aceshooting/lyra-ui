export const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const OFFICE_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
export const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const CONTENT_TYPE_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';

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
