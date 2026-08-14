export function storyOwnerFromSource(source, importPath) {
  const defaultExport = source.match(/\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*;/);
  if (!defaultExport) return null;

  const declaration = new RegExp(`\\bconst\\s+${defaultExport[1]}\\b`).exec(source);
  if (!declaration || declaration.index > defaultExport.index) return null;

  const metaSource = source.slice(declaration.index, defaultExport.index);
  const component = metaSource.match(/\bcomponent\s*:\s*(['"])(lr-[a-z0-9-]+)\1/);
  return component ? { tag: component[2], importPath } : null;
}

export function manifestTagNames(manifest) {
  const tags = [];
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (typeof declaration.tagName === 'string') tags.push(declaration.tagName);
    }
  }
  return [...new Set(tags)].sort();
}

export function findStoryOwnershipFailures(manifestTags, owners) {
  const expected = new Set(manifestTags);
  const byTag = new Map();
  for (const owner of owners) {
    const paths = byTag.get(owner.tag) ?? [];
    paths.push(owner.importPath);
    byTag.set(owner.tag, paths);
  }

  const failures = [];
  for (const tag of [...expected].sort()) {
    const paths = byTag.get(tag) ?? [];
    if (paths.length === 0) failures.push(`${tag}: missing Storybook component owner`);
    if (paths.length > 1)
      failures.push(`${tag}: duplicate Storybook component owners (${paths.join(', ')})`);
  }
  for (const [tag, paths] of [...byTag].sort(([left], [right]) => left.localeCompare(right))) {
    if (!expected.has(tag))
      failures.push(
        `${tag}: owner is not present in the custom-elements manifest (${paths.join(', ')})`
      );
  }
  return failures;
}

export async function collectStoryOwners(storyFiles, readSource) {
  const owners = [];
  for (const importPath of storyFiles) {
    const owner = storyOwnerFromSource(await readSource(importPath), importPath);
    if (owner) owners.push(owner);
  }
  return owners;
}

export function resolveStoryOwnerDocs(entries, owners) {
  const docsEntries = entries.filter((entry) => entry.type === 'docs');
  const docs = [];
  const failures = [];
  for (const owner of owners) {
    const matches = docsEntries.filter((entry) => entry.importPath === owner.importPath);
    if (matches.length !== 1) {
      failures.push(
        `${owner.tag}: expected one exact docs import ${owner.importPath}, found ${matches.length}`
      );
      continue;
    }
    docs.push({ entry: matches[0], expectedTag: owner.tag });
  }
  return { docs, failures };
}

const docsAuditMatrices = Object.freeze([
  Object.freeze({ name: 'desktop', width: 980, height: 760, direction: 'ltr' }),
  Object.freeze({ name: 'narrow', width: 390, height: 800, direction: 'ltr' }),
  Object.freeze({ name: 'narrow-rtl', width: 390, height: 800, direction: 'rtl' }),
]);

/**
 * Keep all three layout states in one per-owner job so the browser loads each large autodocs page
 * once, then measures it after allocation and direction changes.
 */
export function buildStorybookDocsAuditPlan(entries) {
  return entries.map((entry) => ({ entry, matrices: docsAuditMatrices }));
}
