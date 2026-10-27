/**
 * Error isolation policy: which validation failures a view may contain in place and which must reject
 * the whole document. Everything not explicitly listed here is a boundary failure (fail closed).
 */

/** Reserved node type of an isolation marker. Generated input can never use it; only validation produces it. */
export const LYRA_GEN_ISOLATED_TYPE = 'lyra-gen:isolated';

/** Whether a failure may be contained by replacing its node, or must reject the whole document. */
export type LyraGenDiagnosticClass = 'isolatable' | 'boundary';

/**
 * Codes that describe a defect local to one component's own members (its type, properties, text,
 * slot, accessible name, child types, or the content a block expansion rejected). The node can be replaced in place
 * without affecting any other node's identity, state ownership or actions.
 */
export const ISOLATABLE_DIAGNOSTIC_CODES: readonly string[] = Object.freeze([
  'catalog.component', 'props.invalid', 'props.unknown', 'props.required',
  'node.text', 'node.slot', 'node.member',
  'children.type', 'children.forbidden', 'a11y.name', 'block.invalid'
]);

/**
 * Schema value codes; isolatable only when they describe a node's own `/props/...` value. The same
 * codes under an action payload or anywhere else are boundary failures.
 */
export const ISOLATABLE_SCHEMA_CODES: readonly string[] = Object.freeze([
  'schema.type', 'schema.enum', 'schema.length', 'schema.range', 'schema.required', 'schema.any-of', 'schema.property'
]);

/**
 * Codes that always reject the whole document, listed for documentation and tests. This list is
 * informational: classification never consults it, so an unlisted code is a boundary as well.
 * Groups: pre-walk admission (`json.*`, `limit.*`, `view.*`), identity (`identity.*`), state and
 * actions (`binding.*`, `action.*`), sinks and policy (`content.*`), block expansion contract (`block.expansion`: identity rules, malformed output), structure (`node.invalid`,
 * `node.nested-form`, `children.invalid`), and `schema.invalid`.
 */
export const BOUNDARY_DIAGNOSTIC_CODES: readonly string[] = Object.freeze([
  'json.accessor', 'json.array', 'json.cycle', 'json.duplicate-key', 'json.key', 'json.number', 'json.prototype', 'json.syntax', 'json.type', 'json.unreadable',
  'limit.array', 'limit.bytes', 'limit.depth', 'limit.keys', 'limit.nodes', 'limit.string', 'limit.validation',
  'view.invalid', 'view.catalog', 'view.member',
  'identity.invalid', 'identity.duplicate', 'identity.binding',
  'binding.invalid', 'binding.unknown', 'binding.pointer', 'action.unknown',
  'content.field', 'content.navigation', 'content.url', 'content.url-profile', 'content.url-binding',
  'block.expansion', 'node.invalid', 'node.nested-form', 'children.invalid', 'schema.invalid'
]);

/**
 * Classify one error. `relativePath` is the diagnostic path relative to its enclosing node (for
 * example `/props/title`). Unknown codes and every failure outside the node's own members are boundary.
 */
export function classifyDiagnostic(code: string, relativePath = ''): LyraGenDiagnosticClass {
  if (ISOLATABLE_DIAGNOSTIC_CODES.includes(code)) return 'isolatable';
  if (ISOLATABLE_SCHEMA_CODES.includes(code) && relativePath.startsWith('/props/')) return 'isolatable';
  return 'boundary';
}
