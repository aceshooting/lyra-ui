/** Shared heading-level vocabulary for component-owned visible titles. */
export type LyraHeadingLevel = '1' | '2' | '3' | '4' | '5' | '6' | 'none';

export type LyraResolvedHeadingLevel = Exclude<LyraHeadingLevel, 'none'>;

/**
 * Resolves the public heading vocabulary to ARIA's positive level. `none` is the explicit
 * semantic opt-out. Any other value -- a removed attribute (`null`), `undefined` or an unknown
 * string -- resolves the component's own declared default `fallback`, so removing the attribute
 * restores the documented level.
 */
export function resolveHeadingLevel(
  value: string | null | undefined,
  fallback: LyraHeadingLevel = '3',
): LyraResolvedHeadingLevel | undefined {
  switch (value) {
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      return value;
    case 'none':
      return undefined;
    default:
      return fallback === 'none' ? undefined : fallback;
  }
}

/**
 * Resolves a card title's level from its `heading-level` token, which wins whenever it is set
 * (`none` included), and otherwise from the host's `aria-level` attribute, validated to 1-6 with
 * the level-three fallback. `undefined` means the title renders without heading semantics.
 */
export function resolveTitleHeadingLevel(
  headingLevel: string | null | undefined,
  hostAriaLevel: string | null,
): LyraResolvedHeadingLevel | undefined {
  if (typeof headingLevel === 'string' && headingLevel !== '') return resolveHeadingLevel(headingLevel);
  return resolveHeadingLevel(hostAriaLevel || '3') ?? '3';
}
