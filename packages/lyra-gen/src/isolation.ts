import type { JsonValue, LyraGenDiagnostic, LyraGenIsolation, LyraGenNode, LyraGenValidationResult, LyraGenView } from './types.js';
import { failure } from './json-bytes.js';
import { escapePointerSegment, snapshotJson, validateSchema, resolveLimits } from './schema.js';
import { isContentUrlProperty, validateContentProperties, validateFieldPurpose } from './content-policy.js';
import { parsePointer } from './references.js';
/**
 * Error isolation policy: which validation failures a view may contain in place and which must reject
 * the whole document. Everything not explicitly listed here is a boundary failure (fail closed).
 */

/** Reserved node type of an isolation marker. Generated input can never use it; only validation produces it. */
export const LYRA_GEN_ISOLATED_TYPE = 'lyra-gen:isolated';

/**
 * Codes that describe a defect local to one component's own members (its type, properties, text,
 * slot, accessible name, child types, or the content a block expansion rejected). The node can be replaced in place
 * without affecting any other node's identity, state ownership or actions.
 */
export const ISOLATABLE_DIAGNOSTIC_CODES: readonly string[] = Object.freeze([
  'catalog.component', 'props.invalid', 'props.unknown', 'props.required',
  'node.text', 'node.slot', 'node.member',
  'children.type', 'children.forbidden', 'a11y.name', 'block.invalid',
  'read.invalid', 'read.unknown', 'read.pointer', 'read.unowned', 'read.conflict',
  'live.invalid', 'live.unknown', 'live.pointer', 'live.conflict',
  'query.invalid', 'query.unknown', 'query.param', 'query.pointer', 'query.unowned',
  'repeat.invalid', 'repeat.pointer', 'repeat.unowned', 'repeat.template', 'item.invalid', 'item.unknown', 'item.pointer', 'item.outside',
  'condition.invalid', 'condition.unowned', 'compute.invalid', 'compute.unknown', 'a11y.invalid', 'a11y.interactive'
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
export function classifyDiagnostic(code: string, relativePath = ''): 'isolatable' | 'boundary' {
  if (ISOLATABLE_DIAGNOSTIC_CODES.includes(code)) return 'isolatable';
  if (ISOLATABLE_SCHEMA_CODES.includes(code) && relativePath.startsWith('/props/')) return 'isolatable';
  return 'boundary';
}

/** Only content failures may be submitted to an explicit host repair request. */
export const REPAIRABLE_DIAGNOSTIC_CODES: readonly string[] = Object.freeze(['schema.type', 'schema.enum', 'schema.length', 'schema.range', 'schema.required', 'schema.any-of', 'props.required', 'a11y.name']);
const identityPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const validatedViews = new WeakSet<LyraGenView>();
/** Views produced by this module that contain isolation markers; only these may be re-validated with their markers. */
const isolatedViews = new WeakSet<object>();
/** Validated views whose tree differs from the supplied input (block expansion or isolation). */
const rewrittenViews = new WeakSet<object>();
const NO_MARKERS: ReadonlySet<string> = new Set();
const markersIn = (root: JsonValue | undefined): { readonly nodeId: string; readonly path: string }[] => {
  const found: { nodeId: string; path: string }[] = [];
  const walk = (node: JsonValue | undefined, path: string): void => {
    if (!object(node as JsonValue)) return;
    const record = node as Record<string, JsonValue>;
    if (record['type'] === LYRA_GEN_ISOLATED_TYPE) { if (typeof record['id'] === 'string') found.push({ nodeId: record['id'], path }); return; }
    const kids = record['children'];
    if (Array.isArray(kids)) kids.forEach((child, index) => walk(child, `${path}/children/${index}`));
  };
  walk(root, '/root');
  return found;
};
/** Nearest enclosing node path of a diagnostic path inside the node tree. */
const ownerPattern = /^\/root(?:\/children\/\d+)*/u;
export const object = (value: unknown): value is Record<string, import('./types.js').JsonValue> => value !== null && typeof value === 'object' && !Array.isArray(value);

const nodeMembers = new Set(['id', 'type', 'props', 'children', 'text', 'slot', 'bindings', 'reads', 'liveReads', 'dataQuery', 'repeat', 'itemReads', 'visible', 'checks', 'computes', 'a11y', 'action']);

export const isNodeMember = (key: string): boolean => nodeMembers.has(key);
export const isValidatedView = (view: import('./types.js').LyraGenView): boolean => validatedViews.has(view);

/** Preserve immutable, unchanged patch branches unless admission expanded or isolated a node. */
export function validatePatchedView(next: import('./types.js').LyraGenView, previous: import('./types.js').LyraGenView, catalog: import('./types.js').LyraGenCatalog, options: import('./runtime.js').LyraGenValidationOptions): import('./types.js').LyraGenValidationResult {
  const checked = validateCanonicalView(next, catalog, options, previous);
  if (!checked.ok || rewrittenViews.has(checked.value)) return checked;
  validatedViews.add(next);
  if (checked.isolated) isolatedViews.add(next);
  return { ...checked, value: next };
}

/** Find the outermost marked ancestor in a JSON Pointer tree, including the node itself. */
function outermostPath(path: string, candidates: ReadonlySet<string>): string | undefined {
  let result: string | undefined;
  for (let current = path; current; current = current.slice(0, current.lastIndexOf('/'))) {
    if (candidates.has(current)) result = current;
  }
  return result;
}

/** Only a view admitted by this module can carry existing isolation markers into revalidation. */
function trustedMarkers(input: unknown): ReadonlySet<string> {
  if (!input || typeof input !== 'object' || !isolatedViews.has(input)) return NO_MARKERS;
  return new Set(markersIn((input as LyraGenView).root as unknown as JsonValue).map(marker => marker.nodeId));
}

/** Admit the canonical document shape; normalization is opt-in at the public JSON boundary. */
export function validateCanonicalView(input: unknown, catalog: import('./types.js').LyraGenCatalog, options: import('./runtime.js').LyraGenValidationOptions = {}, markerSource: unknown = input): import('./types.js').LyraGenValidationResult {
  const allowedMarkers = trustedMarkers(markerSource);
  const admitted = snapshotJson(input, options.limits);
  if (!admitted.ok) return admitted;
  const view = admitted.value;
  if (!object(view)) return failure('view.invalid', 'Expected a view object.');
  if (view['version'] !== '1' || !object(view['catalog']) || view['catalog']['id'] !== catalog.id || view['catalog']['version'] !== catalog.version) return failure('view.catalog', 'View version and catalog version must match the active catalog.');
  if (Object.keys(view).some(key => !['version', 'catalog', 'surfaceId', 'revision', 'root'].includes(key)) || Object.keys(view['catalog']).some(key => !['id', 'version'].includes(key))) return failure('view.member', 'Unknown view member.');
  if (typeof view['surfaceId'] !== 'string' || !identityPattern.test(view['surfaceId']) || !Number.isSafeInteger(view['revision']) || (view['revision'] as number) < 0) return failure('identity.invalid', 'A surface needs a valid identity and nonnegative safe revision.');
  const diagnostics: LyraGenDiagnostic[] = [];
  const limits = resolveLimits(options.limits);
  const ids = new Set<string>();
  /** Paths of nodes that have a valid unique identity. */
  const identifiedPaths = new Set<string>();
  const expansionRoots = new Set<string>();
  const forcedBoundary = new Set<LyraGenDiagnostic>();
  let errorCount = 0;
  let overflowed = false;
  const bindings = new Set<string>();
  const bindingAncestors = new Set<string>();
  const reads: { readonly pointer: string; readonly path: string; readonly code?: string }[] = [];
  const repeatTemplates = new Set<string>();
  const queryReads: { readonly pointer: string; readonly path: string }[] = [];
  const issue = (code: string, path: string, message: string, hint?: string, boundary = false): void => {
    const diagnostic: LyraGenDiagnostic = { code, path, message, severity: 'error', ...(hint ? { hint } : {}) };
    errorCount++;
    if (boundary) forcedBoundary.add(diagnostic);
    if (diagnostics.length < limits.maxDiagnostics) diagnostics.push(diagnostic);
    else { overflowed = true; if (!REPAIRABLE_DIAGNOSTIC_CODES.includes(code)) diagnostics[diagnostics.length - 1] = diagnostic; }
  };
  /** Validate one node; returns the node to keep (the block's expansion, a rebuilt parent, or the input). `expanded` skips identity registration for a block's own replacement. */
  const visit = (value: JsonValue | undefined, path: string, parent?: LyraGenNode, inForm = false, expanded = false): JsonValue | undefined => {
    if (!object(value)) { issue('node.invalid', path, 'Expected a node object.'); return value; }
    const startErrors = errorCount;
    if (Object.keys(value).some(key => !isNodeMember(key))) issue('node.member', path, 'Unknown node member.');
    if (expanded) { /* identity was admitted with the block node */ }
    else if (typeof value['id'] !== 'string' || !identityPattern.test(value['id'])) issue('identity.invalid', `${path}/id`, 'A node needs an explicit valid identity.');
    else if (ids.has(value['id'])) issue('identity.duplicate', `${path}/id`, 'Node identities must be unique.');
    else { ids.add(value['id']); identifiedPaths.add(path); }
    if (value['type'] === LYRA_GEN_ISOLATED_TYPE) {
      if (!expanded && typeof value['id'] === 'string' && allowedMarkers.has(value['id']) && Object.keys(value).length === 2) return value;
      issue('catalog.component', `${path}/type`, 'Component is not in the active catalog.', undefined, true);
      return value;
    }
    if (typeof value['type'] !== 'string' || !Object.hasOwn(catalog.components, value['type'])) { issue('catalog.component', `${path}/type`, 'Component is not in the active catalog.'); return value; }
    const component = catalog.components[value['type']]!;
    for (const diagnostic of validateFieldPurpose(value as unknown as LyraGenNode, view['surfaceId'] as string, catalog)) issue(diagnostic.code, path + diagnostic.path, diagnostic.message);
    if (component.tag === 'form' && inForm) issue('node.nested-form', path, 'Forms cannot be nested.');
    const props = value['props'] ?? {};
    if (!object(props)) issue('props.invalid', `${path}/props`, 'Properties must be an object.');
    else {
      for (const diagnostic of validateContentProperties(props, component)) issue(diagnostic.code, path + diagnostic.path, diagnostic.message);
      for (const [key, prop] of Object.entries(props)) {
        const schema = Object.hasOwn(component.properties, key) ? component.properties[key] : undefined;
        if (!schema) { issue('props.unknown', `${path}/props/${escapePointerSegment(key)}`, 'Property is not declared by the catalog.', `Allowed properties: ${Object.keys(component.properties).join(', ')}`); continue; }
        const checked = validateSchema(prop, schema, options.limits);
        if (!checked.ok) for (const diagnostic of checked.diagnostics) issue(diagnostic.code, `${path}/props/${escapePointerSegment(key)}${diagnostic.path}`, diagnostic.message);
      }
      for (const key of component.required ?? []) if (!Object.hasOwn(props, key) && !(object(value['bindings']) && Object.hasOwn(value['bindings'], key))) issue('props.required', `${path}/props/${escapePointerSegment(key)}`, 'A required property is missing.');
    }
    if (value['text'] !== undefined && (typeof value['text'] !== 'string' || !component.text)) issue('node.text', `${path}/text`, 'This component does not accept this text value.');
    if (value['slot'] !== undefined && (typeof value['slot'] !== 'string' || !parent || !(catalog.components[parent.type]?.slots ?? []).includes(value['slot']))) issue('node.slot', `${path}/slot`, 'Slot is not declared by the parent.');
    if (value['bindings'] !== undefined) {
      if (!object(value['bindings'])) issue('binding.invalid', `${path}/bindings`, 'Bindings must map properties to JSON Pointers.');
      else for (const [property, pointer] of Object.entries(value['bindings'])) {
        const bindingPath = `${path}/bindings/${escapePointerSegment(property)}`;
        if (!component.bindings || !Object.hasOwn(component.bindings, property) || typeof pointer !== 'string') { issue('binding.unknown', bindingPath, 'Binding is not declared by the catalog.'); continue; }
        if (isContentUrlProperty(property, component)) issue('content.url-binding', bindingPath, 'URL sinks cannot be state bindings.');
        const parsed = parsePointer(pointer);
        if (!parsed.ok || pointer === '') { issue('binding.pointer', bindingPath, 'Bindings need a safe non-root JSON Pointer.'); continue; }
        if (!registerBinding(bindings, bindingAncestors, pointer)) issue('identity.binding', bindingPath, 'State paths must have exactly one nonoverlapping owner.');
      }
    }
    if (value['reads'] !== undefined) {
      if (!object(value['reads'])) issue('read.invalid', `${path}/reads`, 'Reads must map properties to JSON Pointers.');
      else for (const [property, pointer] of Object.entries(value['reads'])) {
        const readPath = `${path}/reads/${escapePointerSegment(property)}`;
        if (!Object.hasOwn(component.properties, property) || typeof pointer !== 'string') { issue('read.unknown', readPath, 'Read property is not declared by the catalog.'); continue; }
        if (isContentUrlProperty(property, component)) { issue('content.url-binding', readPath, 'URL sinks cannot read state.'); continue; }
        if (object(value['bindings']) && Object.hasOwn(value['bindings'], property)) { issue('read.conflict', readPath, 'A property cannot both write and read state.'); continue; }
        if (!parsePointer(pointer).ok || pointer === '') { issue('read.pointer', readPath, 'Reads need a safe non-root JSON Pointer.'); continue; }
        reads.push({ pointer, path: readPath });
      }
    }
    if (value['liveReads'] !== undefined) {
      if (!object(value['liveReads'])) issue('live.invalid', `${path}/liveReads`, 'Live members must map properties to JSON Pointers.');
      else for (const [property, pointer] of Object.entries(value['liveReads'])) {
        const livePath = `${path}/liveReads/${escapePointerSegment(property)}`;
        if (!Object.hasOwn(component.properties, property) || typeof pointer !== 'string') { issue('live.unknown', livePath, 'Live property is not declared by the catalog.'); continue; }
        if (isContentUrlProperty(property, component)) { issue('content.url-binding', livePath, 'URL sinks cannot show live data.'); continue; }
        if ((object(value['bindings']) && Object.hasOwn(value['bindings'], property)) || (object(value['reads']) && Object.hasOwn(value['reads'], property))) { issue('live.conflict', livePath, 'A property has at most one state or live source.'); continue; }
        if (!parsePointer(pointer).ok || pointer === '') issue('live.pointer', livePath, 'Live members need a safe non-root JSON Pointer.');
      }
    }
    if (value['dataQuery'] !== undefined) {
      const query = value['dataQuery'];
      const queryPath = `${path}/dataQuery`;
      const definition = object(query) && typeof query['name'] === 'string' && catalog.queries && Object.hasOwn(catalog.queries, query['name']) ? catalog.queries[query['name']] : undefined;
      if (!object(query) || Object.keys(query).some(key => !['name', 'params', 'paramReads'].includes(key)) || typeof query['name'] !== 'string' || (query['params'] !== undefined && !object(query['params'])) || (query['paramReads'] !== undefined && !object(query['paramReads']))) issue('query.invalid', queryPath, 'A data query needs a name and optional params and paramReads objects.');
      else if (!definition) issue('query.unknown', `${queryPath}/name`, 'Query is not declared by the catalog.');
      else {
        const declared = 'properties' in definition.params ? definition.params.properties : {};
        for (const [key, literal] of Object.entries(query['params'] ?? {})) {
          if (!Object.hasOwn(declared, key)) { issue('query.param', `${queryPath}/params/${escapePointerSegment(key)}`, 'Query parameter is not declared.'); continue; }
          const checked = validateSchema(literal, declared[key]!, options.limits);
          if (!checked.ok) for (const diagnostic of checked.diagnostics) issue(diagnostic.code, `${queryPath}/params/${escapePointerSegment(key)}${diagnostic.path}`, diagnostic.message);
        }
        for (const [key, pointer] of Object.entries(query['paramReads'] ?? {})) {
          const readPath = `${queryPath}/paramReads/${escapePointerSegment(key)}`;
          if (!Object.hasOwn(declared, key) || Object.hasOwn(query['params'] ?? {}, key)) { issue('query.param', readPath, 'Query parameter is not declared or is already literal.'); continue; }
          if (typeof pointer !== 'string' || !parsePointer(pointer).ok || pointer === '') { issue('query.pointer', readPath, 'Query parameters read safe non-root JSON Pointers.'); continue; }
          queryReads.push({ pointer, path: readPath });
        }
      }
    }
    const inTemplate = [...repeatTemplates].some(prefix => path === prefix || path.startsWith(prefix + '/'));
    if (inTemplate && ['bindings', 'action', 'dataQuery', 'repeat'].some(key => value[key] !== undefined)) issue('repeat.template', path, 'Repeat templates cannot bind state, start actions, run queries or repeat.');
    if (value['repeat'] !== undefined) {
      const repeat = value['repeat'];
      const repeatPath = `${path}/repeat`;
      if (!object(repeat) || Object.keys(repeat).some(key => !['items', 'key', 'from', 'max'].includes(key)) || typeof repeat['items'] !== 'string' || typeof repeat['key'] !== 'string' || (repeat['from'] !== undefined && !['live', 'state'].includes(repeat['from'] as string)) || (repeat['max'] !== undefined && !(Number.isSafeInteger(repeat['max']) && (repeat['max'] as number) >= 1 && (repeat['max'] as number) <= 200)) || !Array.isArray(value['children']) || value['children'].length !== 1) issue('repeat.invalid', repeatPath, 'A repeat needs items and key pointers, an optional source and limit, and exactly one template child.');
      else if (!parsePointer(repeat['items']).ok || repeat['items'] === '' || !parsePointer(repeat['key']).ok) issue('repeat.pointer', repeatPath, 'Repeat pointers must be safe JSON Pointers; items cannot be the root.');
      else {
        if (repeat['from'] === 'state') reads.push({ pointer: repeat['items'], path: `${repeatPath}/items`, code: 'repeat.unowned' });
        repeatTemplates.add(`${path}/children/0`);
      }
    }
    if (value['itemReads'] !== undefined) {
      if (!inTemplate) issue('item.outside', `${path}/itemReads`, 'Item reads are only valid inside a repeat template.');
      else if (!object(value['itemReads'])) issue('item.invalid', `${path}/itemReads`, 'Item reads must map properties to relative JSON Pointers.');
      else for (const [property, pointer] of Object.entries(value['itemReads'])) {
        const itemPath = `${path}/itemReads/${escapePointerSegment(property)}`;
        if (!Object.hasOwn(component.properties, property) || typeof pointer !== 'string') { issue('item.unknown', itemPath, 'Item property is not declared by the catalog.'); continue; }
        if (isContentUrlProperty(property, component)) { issue('content.url-binding', itemPath, 'URL sinks cannot show item data.'); continue; }
        if (!parsePointer(pointer).ok) issue('item.pointer', itemPath, 'Item reads need safe relative JSON Pointers.');
      }
    }
    const ref = (candidate: JsonValue | undefined, refPath: string): boolean => {
      if (!object(candidate) || Object.keys(candidate).some(key => !['source', 'pointer', 'op', 'value'].includes(key)) || !['state', 'live', 'item'].includes(candidate['source'] as string) || typeof candidate['pointer'] !== 'string' || !parsePointer(candidate['pointer']).ok) return false;
      if (candidate['source'] === 'item' && !inTemplate) return false;
      if (candidate['source'] === 'state') reads.push({ pointer: candidate['pointer'], path: refPath, code: 'condition.unowned' });
      return true;
    };
    const operators = ['truthy', 'falsy', 'equals', 'notEquals', 'in', 'gt', 'gte', 'lt', 'lte'];
    const condition = (candidate: JsonValue | undefined, conditionPath: string): void => {
      const valid = object(candidate) && operators.includes(candidate['op'] as string) && ref({ source: candidate['source']!, pointer: candidate['pointer']! } as JsonValue, conditionPath)
        && Object.keys(candidate).every(key => ['source', 'pointer', 'op', 'value'].includes(key))
        && (candidate['op'] === 'in' ? Array.isArray(candidate['value']) && candidate['value'].length <= 64 && candidate['value'].every(item => item === null || typeof item !== 'object')
          : ['truthy', 'falsy'].includes(candidate['op'] as string) ? candidate['value'] === undefined
            : ['gt', 'gte', 'lt', 'lte'].includes(candidate['op'] as string) ? typeof candidate['value'] === 'number'
              : candidate['value'] === null || ['string', 'number', 'boolean'].includes(typeof candidate['value']));
      if (!valid) issue('condition.invalid', conditionPath, 'A condition needs a state, live or item reference, a declared operator and a matching literal.');
    };
    if (value['visible'] !== undefined) condition(value['visible'], `${path}/visible`);
    if (value['checks'] !== undefined) {
      if (!Array.isArray(value['checks']) || value['checks'].length === 0 || value['checks'].length > 16) issue('condition.invalid', `${path}/checks`, 'Checks need between one and sixteen conditions.');
      else value['checks'].forEach((check, index) => condition(check, `${path}/checks/${index}`));
    }
    if (value['computes'] !== undefined) {
      if (!object(value['computes'])) issue('compute.invalid', `${path}/computes`, 'Computes must map properties to function calls.');
      else for (const [property, computation] of Object.entries(value['computes'])) {
        const computePath = `${path}/computes/${escapePointerSegment(property)}`;
        if (!Object.hasOwn(component.properties, property)) { issue('compute.unknown', computePath, 'Computed property is not declared by the catalog.'); continue; }
        if (isContentUrlProperty(property, component)) { issue('content.url-binding', computePath, 'URL sinks cannot be computed.'); continue; }
        const arg = object(computation) ? computation['arg'] : undefined;
        const literal = object(arg) && Object.keys(arg).length === 1 && Object.hasOwn(arg, 'value');
        const refs = Array.isArray(arg) ? arg : literal ? [] : [arg];
        if (!object(computation) || Object.keys(computation).some(key => !['fn', 'arg'].includes(key)) || typeof computation['fn'] !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(computation['fn']) || arg === undefined || refs.length > 32 || !refs.every((item, index) => ref(item, `${computePath}/arg${Array.isArray(arg) ? `/${index}` : ''}`))) issue('compute.invalid', computePath, 'A computation needs a function name and value references or a literal value.');
      }
    }
    if (value['action'] !== undefined) {
      if (!object(value['action']) || Object.keys(value['action']).some(key => !['name', 'payload'].includes(key)) || typeof value['action']['name'] !== 'string' || !catalog.actions || !Object.hasOwn(catalog.actions, value['action']['name']) || !component.events?.length) issue('action.unknown', `${path}/action`, 'Action or action event is not declared by the catalog.');
      else if (value['action']['payload'] !== undefined) {
        const checked = validateSchema(value['action']['payload'] ?? null, catalog.actions[value['action']['name']]!.payload, options.limits);
        if (!checked.ok) for (const diagnostic of checked.diagnostics) issue(diagnostic.code, `${path}/action/payload${diagnostic.path}`, diagnostic.message);
      }
    }
    const a11y = value['a11y'];
    if (a11y !== undefined) {
      const text = (candidate: JsonValue | undefined, max: number): boolean => candidate === undefined || (typeof candidate === 'string' && candidate.trim().length > 0 && candidate.length <= max);
      if (!object(a11y) || Object.keys(a11y).some(key => !['label', 'description', 'live', 'hidden'].includes(key)) || !text(a11y['label'], 256) || !text(a11y['description'], 1024) || (a11y['live'] !== undefined && !['off', 'polite'].includes(a11y['live'] as string)) || (a11y['hidden'] !== undefined && typeof a11y['hidden'] !== 'boolean')) issue('a11y.invalid', `${path}/a11y`, 'Accessibility needs a bounded label or description, live off or polite, and a boolean hidden.');
      else if ((a11y['live'] !== undefined || a11y['hidden'] === true) && (component.interactive || component.events?.length || Object.keys(component.bindings ?? {}).length)) issue('a11y.interactive', `${path}/a11y`, 'Interactive roles cannot be hidden or turned into live regions.');
      else if (a11y['label'] !== undefined && !component.accessibleName?.properties?.length) issue('a11y.invalid', `${path}/a11y/label`, 'This role has no accessible-name property for a label.');
    }
    if (component.accessibleName?.required) {
      const named = (object(props) && component.accessibleName.properties?.some(key => typeof props[key] === 'string' && (props[key] as string).trim().length > 0)) || (object(a11y) && typeof a11y['label'] === 'string' && a11y['label'].trim().length > 0 && !!component.accessibleName.properties?.length);
      if (!named && !(component.accessibleName.text && typeof value['text'] === 'string' && value['text'].trim())) issue('a11y.name', path, 'This component requires an accessible name.');
    }
    if (component.expand) {
      if (expanded) issue('block.expansion', path, 'Block expansion cannot produce another expandable block.', undefined, true);
      else {
        if (Array.isArray(value['children']) && value['children'].length) issue('children.forbidden', `${path}/children`, 'This component does not accept children.');
        if (errorCount === startErrors) return expand(value, component.expand, path, parent, inForm);
      }
    }
    if (value['children'] !== undefined) {
      if (!Array.isArray(value['children'])) issue('children.invalid', `${path}/children`, 'Children must be an array.');
      else {
        if (value['children'].length && !component.children) issue('children.forbidden', `${path}/children`, 'This component does not accept children.');
        const next = value['children'].map((child, index) => {
          if (Array.isArray(component.children) && object(child) && !component.children.includes(child['type'] as string)) issue('children.type', `${path}/children/${index}`, 'Child component type is not allowed here.');
          return visit(child, `${path}/children/${index}`, value as unknown as LyraGenNode, inForm || component.tag === 'form') ?? child;
        });
        if (next.some((child, index) => child !== (value['children'] as JsonValue[])[index])) return Object.freeze({ ...value, children: Object.freeze(next) });
      }
    }
    return value;
  };
  /** Run a trusted block expansion for a node whose own members are already valid, then validate the result in its place. */
  const expand = (value: Record<string, JsonValue>, run: (node: LyraGenNode) => LyraGenNode, path: string, parent: LyraGenNode | undefined, inForm: boolean): JsonValue | undefined => {
    let produced: unknown;
    try { produced = run(value as unknown as LyraGenNode); } catch (error) {
      const message = error instanceof Error && error.message.length > 0 && error.message.length <= 200 ? error.message : 'The block content is invalid.';
      issue('block.invalid', path, message);
      return value;
    }
    const copy = snapshotJson(produced, options.limits);
    if (!copy.ok) { issue('block.expansion', path, 'Block expansion must produce bounded JSON data.', undefined, true); return value; }
    const result = copy.value;
    if (!object(result)) { issue('block.expansion', path, 'Block expansion must produce a node object.', undefined, true); return value; }
    // Identity is derived, never invented: the block id is retained and children are `<id>--<index>`.
    if (result['id'] !== value['id']) { issue('block.expansion', path, 'An expanded block must retain its identity.', undefined, true); return value; }
    if (Array.isArray(result['children']) && result['children'].some((child, index) => object(child) && child['id'] !== `${value['id'] as string}--${index}`)) { issue('block.expansion', path, 'Expanded children must use the identities <id>--<index>.', undefined, true); return value; }
    expansionRoots.add(path);
    return visit(result, path, parent, inForm, true);
  };
  const root = visit(view['root'], '/root');
  // A read addresses state some binding in this view owns: the owned path itself or a path inside it.
  for (const read of reads) if (!ownedBy(bindings, read.pointer)) issue(read.code ?? 'read.unowned', read.path, 'Reads must address a state path owned by a binding in this view.');
  for (const read of queryReads) if (!ownedBy(bindings, read.pointer)) issue('query.unowned', read.path, 'Query parameters must read a state path owned by a binding in this view.');
  const finish = (finalRoot: JsonValue | undefined, warnings: readonly LyraGenDiagnostic[], contained: ReadonlyMap<string, readonly LyraGenDiagnostic[]>): LyraGenValidationResult => {
    const rewritten = finalRoot !== view['root'];
    const final = (rewritten ? Object.freeze({ ...view, root: finalRoot }) : view) as unknown as LyraGenView;
    validatedViews.add(final);
    if (rewritten) rewrittenViews.add(final);
    const isolated: LyraGenIsolation[] = markersIn(finalRoot).map(marker => Object.freeze({ nodeId: marker.nodeId, path: marker.path, diagnostics: Object.freeze([...(contained.get(marker.path) ?? [])]) }));
    if (isolated.length) isolatedViews.add(final);
    return isolated.length ? { ok: true, value: final, diagnostics: warnings, isolated: Object.freeze(isolated) } : { ok: true, value: final, diagnostics: warnings };
  };
  if (!diagnostics.length) return finish(root, [], new Map());
  if (options.recovery !== 'isolate' || overflowed) return { ok: false, diagnostics };
  // Group every error under its nearest enclosing node; any boundary error rejects as strict does.
  const owners: { readonly diagnostic: LyraGenDiagnostic; readonly path: string }[] = [];
  for (const diagnostic of diagnostics) {
    const nodePath = ownerPattern.exec(diagnostic.path)?.[0];
    if (!nodePath || forcedBoundary.has(diagnostic) || classifyDiagnostic(diagnostic.code, diagnostic.path.slice(nodePath.length)) === 'boundary') return { ok: false, diagnostics };
    // A failure inside an expanded block isolates the block, which is the component the author wrote.
    const owner = outermostPath(nodePath, expansionRoots) ?? nodePath;
    if (owner === '/root' || !identifiedPaths.has(owner)) return { ok: false, diagnostics };
    owners.push({ diagnostic, path: owner });
  }
  const failing = new Set(owners.map(entry => entry.path));
  const contained = new Map<string, LyraGenDiagnostic[]>();
  for (const entry of owners) { const key = outermostPath(entry.path, failing)!; contained.set(key, [...(contained.get(key) ?? []), entry.diagnostic]); }
  const replace = (node: JsonValue | undefined, path: string): JsonValue | undefined => {
    if (!object(node as JsonValue)) return node;
    const record = node as Record<string, JsonValue>;
    if (contained.has(path)) return Object.freeze({ id: record['id'] as string, type: LYRA_GEN_ISOLATED_TYPE });
    if (!Array.isArray(record['children'])) return node;
    const kids = record['children'].map((child, index) => replace(child, `${path}/children/${index}`) ?? child);
    return kids.some((child, index) => child !== (record['children'] as JsonValue[])[index]) ? Object.freeze({ ...record, children: Object.freeze(kids) }) : node;
  };
  const warnings = diagnostics.map(diagnostic => ({ ...diagnostic, severity: 'warning' as const }));
  return finish(replace(root, '/root'), warnings, contained);
}

/** Record a pointer and its proper prefixes; an existing ancestor, descendant or exact owner conflicts. */
function registerBinding(owned: Set<string>, ancestors: Set<string>, pointer: string): boolean {
  let unique = !owned.has(pointer) && !ancestors.has(pointer);
  owned.add(pointer);
  for (let end = pointer.lastIndexOf('/'); end > 0; end = pointer.lastIndexOf('/', end - 1)) {
    const ancestor = pointer.slice(0, end);
    if (owned.has(ancestor)) unique = false;
    ancestors.add(ancestor);
  }
  return unique;
}

/** Whether a pointer is an owned binding path or lies inside one. */
function ownedBy(owned: ReadonlySet<string>, pointer: string): boolean {
  for (let current = pointer; current; current = current.slice(0, current.lastIndexOf('/'))) if (owned.has(current)) return true;
  return false;
}
