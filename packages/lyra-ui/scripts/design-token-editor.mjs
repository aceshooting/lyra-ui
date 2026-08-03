const TOKEN_NAME = /^--lr-(?:theme-)?[a-z0-9-]+$/;

/**
 * Merges the generated canonical-token projection into the editor custom-property inventory.
 * Component-scoped manifest entries remain alongside the global token description when a name is
 * shared; the caller performs the final name-level deduplication for its output format.
 */
export function mergeDesignTokenEditorProperties(propertiesByName, input) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.properties)) {
    throw new Error('token-editor.generated.json must be a schema-version 1 property projection');
  }
  for (const property of input.properties) {
    if (
      typeof property?.name !== 'string' ||
      !TOKEN_NAME.test(property.name) ||
      typeof property.description !== 'string' ||
      !Array.isArray(property.references) ||
      property.references.some((name) => typeof name !== 'string' || !TOKEN_NAME.test(name))
    ) {
      throw new Error(
        `Invalid generated design-token editor property: ${property?.name ?? '<unknown>'}`,
      );
    }
    if (!propertiesByName.has(property.name)) propertiesByName.set(property.name, []);
    const references = property.references.length
      ? ` Reads ${property.references.map((name) => `\`${name}\``).join(', ')}.`
      : '';
    propertiesByName.get(property.name).push({
      context: property.name.startsWith('--lr-theme-')
        ? 'Application theme input'
        : 'Shared design token',
      description: `${property.description}${references}`,
    });
  }
  return propertiesByName;
}
