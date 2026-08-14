/**
 * Formats the per-component contexts for one CSS custom property.
 *
 * A default is part of the contract, not incidental prose: entries with identical descriptions
 * but different defaults must remain separate or an editor silently reports whichever component
 * happened to be visited first.
 */
export function cssPropertyDescription(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const description = entry.description ?? '';
    const hasDefault = Object.hasOwn(entry, 'default');
    const key = JSON.stringify([description, hasDefault, typeof entry.default, entry.default]);
    if (!groups.has(key)) {
      groups.set(key, {
        description,
        contexts: [],
        tags: [],
        hasDefault,
        default: entry.default,
      });
    }
    if (entry.context) groups.get(key).contexts.push(entry.context);
    if (entry.tag) groups.get(key).tags.push(entry.tag);
  }

  return [...groups.values()]
    .map(({ description, contexts, tags, hasDefault, default: defaultValue }) => {
      const subjects = [
        ...new Set(contexts),
        ...tags.map((tag) => `\`<${tag}>\``),
      ].join(', ');
      const defaultSuffix = hasDefault ? ` (default: \`${defaultValue}\`)` : '';
      return `**${subjects}**${defaultSuffix} — ${description}`;
    })
    .join('\n\n');
}
