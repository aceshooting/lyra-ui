import type { JsonObject, JsonValue, LyraGenCatalog } from '../types.js';

/** Candidate schema artifacts do not qualify a renderer or a protocol processor. */
export const A2UI_CANDIDATE_PROFILE = Object.freeze({
  version: 'v1.0',
  revision: '409ded29ccac3eebc541979ae5320771703248e8',
  catalogSchema: 'https://a2ui.org/specification/v1_0/catalog_definition.json',
  source: 'https://github.com/a2ui-project/a2ui/tree/409ded29ccac3eebc541979ae5320771703248e8/specification/v1_0',
  processorSupported: false,
  supportedCatalogIds: Object.freeze([] as string[])
});

/** Export a literal-property candidate catalog for schema experiments, never stable negotiation. */
export function exportA2uiCandidateCatalog(catalog: LyraGenCatalog, id = `https://github.com/aceshooting/lyra-ui/a2ui/v1.0-candidate/${encodeURIComponent(catalog.id)}/${encodeURIComponent(catalog.version)}`): JsonObject {
  const components: Record<string, JsonValue> = {};
  for (const [name, definition] of Object.entries(catalog.components)) {
    if (name === 'Surface') throw new TypeError('Surface is reserved by the candidate protocol.');
    const properties: Record<string, JsonValue> = { id: { type: 'string' }, component: { const: name } };
    for (const [key, schema] of Object.entries(definition.properties)) {
      if (['id', 'component', 'children', 'action', 'checks'].includes(key)) throw new TypeError('A catalog property collides with the protocol vocabulary.');
      properties[key] = schema as unknown as JsonValue;
    }
    if (definition.text) properties['text'] = { type: 'string' };
    if (definition.children) properties['children'] = { type: 'array', items: { type: 'string' } };
    components[name] = {
      type: 'object', properties, required: ['id', 'component', ...(definition.required ?? [])], additionalProperties: false,
      ...(Array.isArray(definition.children) ? { allowedChildren: [...definition.children] } : !definition.children ? { allowedChildren: [] } : {})
    };
  }
  return {
    $schema: 'https://a2ui.org/specification/v1_0/catalog_definition.json', $id: id, catalogId: id,
    protocolVersion: '1.0', title: 'Lyra candidate literal catalog',
    description: 'Experimental schema artifact only. Dynamic expressions, actions and candidate message processing are not supported.',
    components, functions: {},
    $defs: { anyComponent: { oneOf: Object.keys(components).map(name => ({ $ref: `#/components/${name.replaceAll('~', '~0').replaceAll('/', '~1')}` })) }, anyFunction: { not: {} } }
  };
}
