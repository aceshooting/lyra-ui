import { snapshotJson } from './schema.js';
import type { JsonValue, LyraGenCatalog, LyraGenComponent, LyraGenDiagnostic, LyraGenFieldPolicy, LyraGenFieldPurpose, LyraGenNode, LyraGenResult, LyraGenSchema, LyraGenUrlPolicy } from './types.js';

const purposes: readonly LyraGenFieldPurpose[] = ['general', 'password', 'one-time-code', 'payment-card', 'secret'];
const navigationProperty = /^(?:href|xlinkHref|action|formAction|ping)$/iu;
const urlProperty = /(?:url|uri|src|href)$|^(?:poster|srcset|imageSrcset)$/iu;
const unsafeUrlCharacters = /[\u0000-\u0020\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\\]/u;
const diagnostic = (code: string, path: string, message: string): LyraGenDiagnostic => ({ code, path, message, severity: 'error' });
const segment = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');

function canonicalHttps(value: unknown): URL | undefined {
  if (typeof value !== 'string' || !value.startsWith('https://') || unsafeUrlCharacters.test(value)) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : undefined;
  } catch { return undefined; }
}
function validOrigins(policy: LyraGenUrlPolicy): boolean {
  return Array.isArray(policy.origins) && policy.origins.length > 0 && policy.origins.every(origin => typeof origin === 'string' && !origin.includes('*') && canonicalHttps(origin)?.origin === origin);
}

/** Authorize and canonicalize a destination without fetching it or performing navigation. */
export function validateNavigationDestination(input: unknown, policy: LyraGenUrlPolicy): LyraGenResult<string> {
  const url = canonicalHttps(input);
  if (!url || !validOrigins(policy) || !policy.origins.includes(url.origin)) return { ok: false, diagnostics: [diagnostic('content.url', '', 'Destination must use an explicitly approved HTTPS origin.')] };
  return { ok: true, value: url.href, diagnostics: [] };
}

function hasNestedUrlSchema(schema: LyraGenSchema): boolean {
  if ('anyOf' in schema) return schema.anyOf.some(hasNestedUrlSchema);
  if (schema.type === 'array') return hasNestedUrlSchema(schema.items);
  return schema.type === 'object' && Object.entries(schema.properties).some(([key, child]) => navigationProperty.test(key) || urlProperty.test(key) || hasNestedUrlSchema(child));
}

/** Reject undeclared or ambiguous sinks while constructing trusted catalog metadata. */
export function assertComponentContentPolicy(component: LyraGenComponent): void {
  if (component.fieldPurpose !== undefined && !purposes.includes(component.fieldPurpose)) throw new TypeError('Unknown field purpose.');
  for (const [key, schema] of Object.entries(component.properties)) {
    if (navigationProperty.test(key)) throw new TypeError('Direct navigation properties require a host action instead of a catalog sink.');
    if (urlProperty.test(key) && !Object.hasOwn(component.urlSinks ?? {}, key)) throw new TypeError(`URL property requires an explicit sink policy: ${key}`);
    if (hasNestedUrlSchema(schema)) throw new TypeError('Nested URL properties are outside the supported sink profile.');
  }
  for (const [key, sink] of Object.entries(component.urlSinks ?? {})) {
    const schema = component.properties[key];
    if (!schema || !('type' in schema) || schema.type !== 'string' || sink.kind !== 'media' || !validOrigins(sink) || /srcset/iu.test(key)) throw new TypeError(`Invalid media sink policy: ${key}`);
    if (Object.hasOwn(component.bindings ?? {}, key)) throw new TypeError('URL sinks cannot be state bindings.');
  }
}

/** Validate final property values too: trusted adapters must not accidentally bypass sink policy. */
export function validateContentProperties(props: Readonly<Record<string, unknown>>, component: LyraGenComponent): readonly LyraGenDiagnostic[] {
  const issues: LyraGenDiagnostic[] = [];
  const hint = hintedPurpose(props);
  if (hint && component.fieldPurpose !== hint) issues.push(diagnostic('content.field', '/props', 'Sensitive control hints require the matching declared field purpose.'));
  for (const [key, value] of Object.entries(props)) {
    const path = `/props/${segment(key)}`;
    const sink = Object.hasOwn(component.urlSinks ?? {}, key) ? component.urlSinks![key] : undefined;
    const schema = component.properties[key];
    if (schema && hasNestedUrlSchema(schema)) issues.push(diagnostic('content.url-profile', path, 'Nested URL properties are outside the supported sink profile.'));
    if (navigationProperty.test(key)) issues.push(diagnostic('content.navigation', path, 'Navigation requires an explicitly authorized host action.'));
    else if (sink || urlProperty.test(key)) {
      if (!sink || sink.kind !== 'media' || /srcset/iu.test(key) || !validateNavigationDestination(value, sink).ok) issues.push(diagnostic('content.url', path, 'Media URL does not satisfy its declared origin policy.'));
    }
  }
  return issues;
}

export function isContentUrlProperty(property: string, component: LyraGenComponent): boolean {
  return navigationProperty.test(property) || urlProperty.test(property) || Object.hasOwn(component.urlSinks ?? {}, property);
}

function equalJson(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equalJson((left as Record<string, JsonValue>)[key]!, (right as Record<string, JsonValue>)[key]!));
}

/** Check host registry shape once; runtime matching still uses the current active catalog. */
export function snapshotFieldPolicy(catalog: LyraGenCatalog): LyraGenFieldPolicy | undefined {
  if (!catalog.fieldPolicy) return;
  const admitted = snapshotJson(catalog.fieldPolicy);
  if (!admitted.ok) throw new TypeError('Field policy must contain bounded plain JSON.');
  const { requireApprovedFields, approvedFields } = catalog.fieldPolicy;
  if (requireApprovedFields !== undefined && typeof requireApprovedFields !== 'boolean') throw new TypeError('Invalid approved-field requirement.');
  if (approvedFields !== undefined && !Array.isArray(approvedFields)) throw new TypeError('Approved fields must be an array.');
  const scopes = new Set<string>();
  for (const approval of approvedFields ?? []) {
    const scope = JSON.stringify([approval.surfaceId, approval.node?.id]);
    if (typeof approval.surfaceId !== 'string' || !approval.surfaceId || !approval.node || typeof approval.node.id !== 'string' || !approval.node.id || !purposes.includes(approval.purpose) || (approval.allowSensitive !== undefined && typeof approval.allowSensitive !== 'boolean') || scopes.has(scope)) throw new TypeError('Invalid or duplicate approved field scope.');
    scopes.add(scope);
  }
  return admitted.value as unknown as LyraGenFieldPolicy;
}

function hintedPurpose(props: Readonly<Record<string, unknown>>): LyraGenFieldPurpose | undefined {
  // Native machine-readable hints have defined semantics; labels deliberately do not.
  if (typeof props['type'] === 'string' && props['type'].toLowerCase() === 'password') return 'password';
  const autocomplete = props['autocomplete'] ?? props['autoComplete'];
  if (typeof autocomplete === 'string') {
    const tokens = autocomplete.toLowerCase().split(/\s+/u);
    if (tokens.includes('one-time-code')) return 'one-time-code';
    if (tokens.some(token => token === 'current-password' || token === 'new-password')) return 'password';
    if (tokens.some(token => token.startsWith('cc-'))) return 'payment-card';
  }
  return undefined;
}
function concretePurpose(node: LyraGenNode, component: LyraGenComponent): LyraGenFieldPurpose | undefined {
  return hintedPurpose(node.props ?? {}) ?? component.fieldPurpose ?? (Object.keys(component.bindings ?? {}).length || ['input', 'textarea', 'select'].includes(component.tag) ? 'general' : undefined);
}

/** Model text cannot grant collection authority or change the reviewed presentation of a field. */
export function validateFieldPurpose(node: LyraGenNode, surfaceId: string, catalog: LyraGenCatalog): readonly LyraGenDiagnostic[] {
  const component = catalog.components[node.type];
  if (!component) return [];
  const purpose = concretePurpose(node, component);
  if (!purpose) return [];
  const approval = catalog.fieldPolicy?.approvedFields?.find(entry => entry.surfaceId === surfaceId && entry.node.id === node.id);
  const sensitive = purpose !== 'general';
  if (!approval && !sensitive && !catalog.fieldPolicy?.requireApprovedFields) return [];
  if (!approval || approval.purpose !== purpose || (sensitive && approval.allowSensitive !== true) || !equalJson(node as unknown as JsonValue, approval.node as unknown as JsonValue)) return [diagnostic('content.field', '', 'Field requires an exact scoped host approval for its collection purpose.')];
  return [];
}
