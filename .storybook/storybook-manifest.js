import { expandManifestInheritance } from '../packages/lyra-ui/scripts/manifest-compact.mjs';

const isPublicMember = (member) =>
  member?.privacy !== 'private' && member?.privacy !== 'protected';

/**
 * Storybook's custom-elements integration currently renders private/protected members in
 * autodocs tables. Filter a presentation-only clone while leaving the published manifest intact.
 */
export function publicStorybookManifest(manifest) {
  const expanded = expandManifestInheritance(manifest);
  return {
    ...expanded,
    modules: (expanded.modules ?? []).map((module) => ({
      ...module,
      declarations: (module.declarations ?? []).map((declaration) => ({
        ...declaration,
        members: (declaration.members ?? []).filter(isPublicMember),
      })),
    })),
  };
}
