import { createScopedRegistry, supportsScopedRegistries, type LyraScopedDefinitions, type LyraScopedRegistry } from './scoped-registry.js';
import { COMPONENT_LOADERS } from '../internal/component-loaders.generated.js';
import { scopedDefinitionClosures } from '../internal/scoped-definitions.generated.js';

/**
 * Loads registration-free classes for the requested full Lyra tags and their generated transitive
 * registration dependencies, then creates one native isolated scope. No global registrations or
 * optional-peer integration bridges are installed. Peer-backed components still need their peers.
 * Import this optional module only when catalog-driven loading is desired; the explicit
 * `scoped-registry.js` entry does not import this catalog.
 */
export async function loadScopedRegistry(
  tags: readonly string[],
  options: { document?: Document } = {},
): Promise<LyraScopedRegistry> {
  if (!supportsScopedRegistries()) throw new Error('Scoped custom element registries are not supported by this environment.');
  const closure = new Set<string>();
  for (const tag of tags) {
    if (!Object.prototype.hasOwnProperty.call(scopedDefinitionClosures, tag)) throw new Error(`Unknown Lyra scoped tag: ${tag}`);
    for (const dependency of scopedDefinitionClosures[tag]!) closure.add(dependency);
  }
  const definitions = await Promise.all([...closure].map(async (tag) => {
    const loader = (COMPONENT_LOADERS as Readonly<Record<string, (() => Promise<CustomElementConstructor>) | undefined>>)[tag];
    if (!loader) throw new Error(`Missing scoped class loader for ${tag}.`);
    return [tag, await loader()] as const;
  }));
  return createScopedRegistry(Object.fromEntries(definitions) as LyraScopedDefinitions, options);
}
