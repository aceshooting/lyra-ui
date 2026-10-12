/** Controls that only render once a document is open; the registration entry supplies their loaders. */
const loaders = new Map<string, () => Promise<unknown>>();

export function provideDocumentControls(entries: Readonly<Record<string, () => Promise<unknown>>>): void {
  for (const [name, load] of Object.entries(entries)) loaders.set(name, load);
}

export function loadDocumentControls(...names: string[]): Promise<unknown> {
  return Promise.all(names.map(name => {
    const load = loaders.get(name);
    loaders.delete(name);
    return load?.().catch(() => undefined);
  }));
}

/** Advance past replacement-created literal matches. A changed match topology requires an explicit new choice. */
export function replacementSearchIndex(options: Readonly<{
  query: string; replacement: string; before: string; after: string; matchCase: boolean; wholeWord: boolean;
  previousCount: number; nextCount: number; index: number; truncated: boolean;
}>): number {
  if (options.truncated || options.nextCount < 1 || !options.query) return -1;
  const fold = (text: string) => options.matchCase ? text : text.toLowerCase();
  const query = fold(options.query), replacement = fold(options.replacement);
  const beforeContext = fold(options.before), afterContext = fold(options.after);
  // Search excerpts can be clipped. Unknown surrounding text cannot establish safe advancement.
  if (query.length > 49 && (beforeContext.length >= 48 || afterContext.length >= 48)) return -1;
  const combined = beforeContext + replacement + afterContext;
  const startBoundary = beforeContext.length, endBoundary = startBoundary + replacement.length;
  let crossing = combined.indexOf(query);
  while (crossing >= 0) {
    const end = crossing + query.length;
    if (crossing < startBoundary && end > startBoundary || crossing < endBoundary && end > endBoundary) return -1;
    crossing = combined.indexOf(query, crossing + 1);
  }
  const word = (char: string) => /[\p{L}\p{N}\p{M}_]/u.test(char);
  let inserted = 0, start = replacement.indexOf(query);
  while (start >= 0) {
    const end = start + query.length;
    const before = replacement.slice(0, start).at(-1) ?? options.before.at(-1) ?? '';
    const after = replacement.slice(end)[0] ?? options.after[0] ?? '';
    if (!options.wholeWord || !word(before) && !word(after)) inserted++;
    start = replacement.indexOf(query, end);
  }
  if (options.previousCount - 1 + inserted !== options.nextCount || options.previousCount === 1) return -1;
  return (options.index + inserted) % options.nextCount;
}
