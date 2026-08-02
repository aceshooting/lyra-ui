/**
 * Builds the exact-tag lookup used by Storybook autodocs. Keeping this projection independent of
 * React makes the maturity/deprecation presentation contract directly testable in Node.
 */
export function buildComponentMetadataIndex(customElements) {
  return new Map(
    (customElements?.modules ?? []).flatMap((module) =>
      (module.declarations ?? [])
        .filter((declaration) => declaration.customElement && declaration.tagName)
        .map((declaration) => [declaration.tagName, declaration]),
    ),
  );
}

/**
 * Normalizes CEM maturity fields into the small view model rendered by the custom autodocs page.
 * Missing central metadata intentionally suppresses the block instead of displaying partial
 * policy claims.
 */
export function componentMetadataPresentation(metadata) {
  if (!metadata?.status || !metadata?.since) return null;

  return {
    tagName: metadata.tagName,
    status: metadata.status,
    since: metadata.since,
    rationale: metadata.maturity?.rationale ?? null,
    graduationCriteria: metadata.maturity?.graduationCriteria ?? null,
    deprecations: (metadata.deprecations ?? []).map((entry) => ({
      key: `${entry.kind}:${entry.name}`,
      subject: entry.kind === 'component'
        ? metadata.tagName
        : `${entry.kind} ${entry.name}${entry.attribute ? ` / ${entry.attribute}` : ''}`,
      since: entry.since,
      replacementKind: entry.replacement?.kind ?? 'API',
      replacement: entry.replacement?.usage ?? entry.replacement?.name,
      removalNotBefore: entry.removalNotBefore,
      rationale: entry.rationale,
    })),
  };
}
