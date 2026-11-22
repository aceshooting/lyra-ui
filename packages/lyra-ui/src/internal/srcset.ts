/** Largest-needed candidate of an `<img srcset>` list; blank when the list has no usable URL. */
export function chooseSrcsetCandidate(srcset: string, sizes: string, view: Window | null): string {
  const candidates: { url: string; width?: number; density?: number }[] = [];
  for (const entry of srcset.split(',')) {
    const [url, descriptor = ''] = entry.trim().split(/\s+/);
    if (!url) continue;
    const match = /^(\d+(?:\.\d+)?)([wx])$/.exec(descriptor);
    candidates.push({
      url,
      width: match?.[2] === 'w' ? Number(match[1]) : undefined,
      density: match?.[2] === 'x' ? Number(match[1]) : match ? undefined : 1,
    });
  }
  if (candidates.length === 0) return '';
  const ratio = view?.devicePixelRatio && Number.isFinite(view.devicePixelRatio) ? view.devicePixelRatio : 1;
  const viewport = view?.innerWidth && Number.isFinite(view.innerWidth) ? view.innerWidth : 1024;
  const length = /^\s*(\d+(?:\.\d+)?)(px|vw)\s*$/.exec(sizes);
  const cssWidth = length ? (length[2] === 'vw' ? (viewport * Number(length[1])) / 100 : Number(length[1])) : viewport;
  const sorted = [...candidates].sort(
    (a, b) => (a.width ?? (a.density ?? 1) * 1000) - (b.width ?? (b.density ?? 1) * 1000),
  );
  const hasWidths = sorted.some((candidate) => candidate.width !== undefined);
  const target = hasWidths ? cssWidth * ratio : ratio;
  const covering = sorted.find((candidate) => (hasWidths ? (candidate.width ?? 0) : (candidate.density ?? 1)) >= target);
  return (covering ?? sorted[sorted.length - 1]!).url;
}
