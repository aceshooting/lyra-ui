/** One effective authority for viewers that accept both remote and inline input. */
export type LyraViewerSource<Inline> =
  | Readonly<{ kind: 'url'; url: string }>
  | Readonly<{ kind: 'inline'; value: Inline }>
  | null;

/** Normalizes presence-based inline precedence into an immutable discriminated snapshot. */
export function resolveViewerSource<Inline>(
  url: string,
  inline: Inline | undefined,
): LyraViewerSource<Inline> {
  if (inline !== undefined) return Object.freeze({ kind: 'inline', value: inline });
  return url ? Object.freeze({ kind: 'url', url }) : null;
}
