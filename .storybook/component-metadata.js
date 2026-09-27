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
 * Plain-text subject of one structured deprecation record. Mirrors `formatDeprecationSubject` in
 * `packages/lyra-ui/scripts/component-metadata.mjs` (a Node-only module): the default slot has no
 * name to show, and a `slot-content` record names the content it covers rather than a member.
 */
function deprecationSubject(entry, tagName) {
  if (entry.kind === 'component') return tagName;
  if (entry.kind === 'slot' && !entry.name) return 'default slot';
  if (entry.kind === 'slot-content') {
    const subject = entry.name ? `${entry.name}-slot content` : 'default-slot content';
    const permitted = Array.isArray(entry.permittedContent) ? entry.permittedContent : [];
    return permitted.length
      ? `${subject} other than ${permitted.map((name) => `<${name}>`).join(', ')}`
      : subject;
  }
  return `${entry.kind} ${entry.name}${entry.attribute ? ` / ${entry.attribute}` : ''}`;
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
      subject: deprecationSubject(entry, metadata.tagName),
      since: entry.since,
      replacementKind: entry.replacement?.kind ?? 'API',
      replacement: entry.replacement?.usage ?? entry.replacement?.name,
      removalNotBefore: entry.removalNotBefore,
      rationale: entry.rationale,
    })),
  };
}
