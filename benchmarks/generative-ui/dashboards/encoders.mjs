/**
 * Encoders and incremental decoders for the five compared formats. Lyra Lines is lyra-gen's own opt-in
 * compact profile (`@aceshooting/lyra-gen/lines.js`), parsed into a JSON v1 view before validation. The statement-language encoding
 * is a minimal original design that borrows only the public idea of one `name = Component(args)`
 * statement per line with positional arguments and forward references; it is not an implementation
 * of any third-party grammar and shares no code with one. The flat element-map JSON Patch stream is
 * likewise a harness-local encoding in the style of RFC 6902 operations over `{ root, elements }`.
 */
import { createJsonViewStream } from '../../../packages/lyra-gen/dist/json-stream.js';
import { createLinesParser, encodeLines } from '../../../packages/lyra-gen/dist/lines.js';
import { createProgressiveMarkupParser } from '../../../packages/lyra-gen/dist/progressive.js';

export const FORMATS = Object.freeze(['json', 'markup', 'json-patch', 'statements', 'lines']);
export const FORMAT_LABELS = Object.freeze({ json: 'lyra-gen JSON view', markup: 'Lyra Markup', 'json-patch': 'RFC 6902 patch stream (flat map)', statements: 'Statement language (OpenUI Lang style)', lines: 'Lyra Lines (opt-in profile)' });

export const makeView = (catalog, root) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'bench', revision: 1, root });
export const clone = (value) => JSON.parse(JSON.stringify(value));
const META = ['slot', 'bindings', 'reads', 'liveReads', 'action'];

export function countNodes(node) { return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0); }
export function* walk(node) { yield node; for (const child of node.children ?? []) yield* walk(child); }

/* ---------------------------------------------------------------- (a) lyra-gen JSON view */
export const encodeJson = (view) => JSON.stringify(view);

/* ---------------------------------------------------------------- (b) Lyra Markup */
const escapeText = (value) => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const escapeAttribute = (value) => escapeText(value).replace(/"/gu, '&quot;');
function markupNode(node, depth) {
  const pad = '  '.repeat(depth);
  const attributes = [`id="${escapeAttribute(node.id)}"`];
  for (const [key, value] of Object.entries(node.props ?? {})) attributes.push(typeof value === 'string' ? `${key}="${escapeAttribute(value)}"` : `${key}={${JSON.stringify(value)}}`);
  if (typeof node.slot === 'string') attributes.push(`slot="${escapeAttribute(node.slot)}"`);
  for (const key of META.slice(1)) if (node[key] !== undefined) attributes.push(`${key}={${JSON.stringify(node[key])}}`);
  const open = `<${node.type} ${attributes.join(' ')}`;
  if (node.children?.length) return `${pad}${open}>\n${node.children.map(child => markupNode(child, depth + 1)).join('\n')}\n${pad}</${node.type}>`;
  if (typeof node.text === 'string' && node.text.length) return `${pad}${open}>${escapeText(node.text)}</${node.type}>`;
  return `${pad}${open} />`;
}
export const encodeMarkup = (view) => markupNode(view.root, 0);

/* ---------------------------------------------------------------- (c) JSON Patch stream */
const escapePointer = (segment) => String(segment).replace(/~/gu, '~0').replace(/\//gu, '~1');
export function flatten(view) {
  const elements = {};
  const order = [];
  const visit = (node) => {
    const { children, ...rest } = node;
    elements[node.id] = { ...rest, ...(children?.length ? { children: children.map(child => child.id) } : {}) };
    order.push(node.id);
    for (const child of children ?? []) visit(child);
  };
  visit(view.root);
  return { root: view.root.id, elements, order };
}
/** Operations in streaming order: root pointer, then every element parent-before-child. */
export function patchOperations(view) {
  const { root, elements, order } = flatten(view);
  return [{ op: 'add', path: '/root', value: root }, ...order.map(id => ({ op: 'add', path: `/elements/${escapePointer(id)}`, value: elements[id] }))];
}
export const encodePatchStream = (view) => `${patchOperations(view).map(operation => JSON.stringify(operation)).join('\n')}\n`;

function pointerSegments(path) { return path.split('/').slice(1).map(segment => segment.replace(/~1/gu, '/').replace(/~0/gu, '~')); }
/** Minimal RFC 6902 add/replace/remove over plain JSON (the harness only needs these three). */
export function applyOperation(state, operation) {
  const segments = pointerSegments(operation.path);
  let target = state;
  for (const segment of segments.slice(0, -1)) {
    target = target?.[segment];
    if (target === undefined || target === null || typeof target !== 'object') throw new TypeError(`Missing path ${operation.path}`);
  }
  const last = segments.at(-1);
  if (Array.isArray(target)) {
    const index = last === '-' ? target.length : Number(last);
    if (!Number.isInteger(index) || index < 0 || index > target.length) throw new TypeError(`Bad index ${operation.path}`);
    if (operation.op === 'add') target.splice(index, 0, operation.value);
    else if (operation.op === 'replace') target[index] = operation.value;
    else if (operation.op === 'remove') target.splice(index, 1);
    else throw new TypeError(`Unsupported op ${operation.op}`);
  } else if (operation.op === 'add' || operation.op === 'replace') target[last] = operation.value;
  else if (operation.op === 'remove') delete target[last];
  else throw new TypeError(`Unsupported op ${operation.op}`);
  return state;
}
/** Resolve `{ root, elements }` into a tree, dropping child ids that have not arrived yet. */
export function materializeFlat(state) {
  if (typeof state.root !== 'string' || !state.elements?.[state.root]) return undefined;
  const seen = new Set();
  const build = (id) => {
    const element = state.elements[id];
    if (!element || seen.has(id)) return undefined;
    seen.add(id);
    const { children, ...rest } = element;
    const built = (children ?? []).map(build).filter(Boolean);
    return { ...rest, ...(built.length ? { children: built } : {}) };
  };
  return build(state.root);
}

/* ---------------------------------------------------------------- (d) statement language */
const pascal = (type) => type.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
const signatureOf = (catalog, type) => {
  const role = catalog.components[type];
  return [...(role.children ? ['$children'] : []), ...(role.text ? ['$text'] : []), ...Object.keys(role.properties ?? {})];
};
function literal(value) { return JSON.stringify(value); }
/** `id = Type(arg, ...)`; child arrays hold bare identifiers; trailing nulls are trimmed; one optional trailing meta object. */
export function encodeStatements(view, catalog) {
  const lines = [];
  const visit = (node) => {
    const signature = signatureOf(catalog, node.type);
    const known = new Set(signature.filter(key => !key.startsWith('$')));
    for (const key of Object.keys(node.props ?? {})) if (!known.has(key)) throw new TypeError(`Property ${key} is not in the ${node.type} signature.`);
    const args = signature.map(key => key === '$children' ? (node.children?.length ? `[${node.children.map(child => child.id).join(', ')}]` : null)
      : key === '$text' ? (node.text !== undefined ? literal(node.text) : null)
        : node.props?.[key] !== undefined ? literal(node.props[key]) : null);
    const meta = Object.fromEntries(META.filter(key => node[key] !== undefined).map(key => [key, node[key]]));
    const rendered = args.map(arg => arg ?? 'null');
    while (rendered.length && rendered.at(-1) === 'null') rendered.pop();
    if (Object.keys(meta).length) { while (rendered.length < signature.length) rendered.push('null'); rendered.push(literal(meta)); }
    lines.push(`${node.id} = ${pascal(node.type)}(${rendered.join(', ')})`);
    for (const child of node.children ?? []) visit(child);
  };
  visit(view.root);
  return `${lines.join('\n')}\n`;
}

/** Argument reader: JSON values plus bare identifiers (references). */
function readArguments(source) {
  let position = 0;
  const skip = () => { while (source[position] === ' ') position++; };
  const value = () => {
    skip();
    const character = source[position];
    if (character === '"') {
      let end = position + 1;
      while (end < source.length && source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
      if (end >= source.length) throw new SyntaxError('unterminated string');
      const parsed = JSON.parse(source.slice(position, end + 1));
      position = end + 1;
      return parsed;
    }
    if (character === '[') {
      position++;
      const items = [];
      skip();
      if (source[position] === ']') { position++; return items; }
      while (true) {
        items.push(value()); skip();
        if (source[position] === ',') { position++; continue; }
        if (source[position] === ']') { position++; return items; }
        throw new SyntaxError('bad array');
      }
    }
    if (character === '{') {
      let depth = 0; let end = position; let inString = false;
      for (; end < source.length; end++) {
        const current = source[end];
        if (inString) { if (current === '\\') end++; else if (current === '"') inString = false; continue; }
        if (current === '"') inString = true; else if (current === '{') depth++; else if (current === '}' && --depth === 0) break;
      }
      if (depth !== 0) throw new SyntaxError('unterminated object');
      const parsed = JSON.parse(source.slice(position, end + 1));
      position = end + 1;
      return parsed;
    }
    const match = /^(-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null|[A-Za-z][A-Za-z0-9_.:-]*)/u.exec(source.slice(position));
    if (!match) throw new SyntaxError('bad value');
    position += match[0].length;
    if (match[0] === 'true') return true;
    if (match[0] === 'false') return false;
    if (match[0] === 'null') return null;
    return /^[A-Za-z]/u.test(match[0]) ? { $ref: match[0] } : Number(match[0]);
  };
  const values = [];
  skip();
  if (position >= source.length) return values;
  while (true) {
    values.push(value()); skip();
    if (position >= source.length) return values;
    if (source[position] !== ',') throw new SyntaxError('expected comma');
    position++;
  }
}
const statementLine = /^([A-Za-z][A-Za-z0-9_.:-]*) = ([A-Z][A-Za-z0-9]*)\((.*)\)$/u;
export function parseStatement(line, catalog, typeByName) {
  const match = statementLine.exec(line);
  if (!match) throw new SyntaxError('not a statement');
  const type = typeByName.get(match[2]);
  if (!type) throw new SyntaxError(`unknown component ${match[2]}`);
  const signature = signatureOf(catalog, type);
  const args = readArguments(match[3]);
  const node = { id: match[1], type };
  const props = {};
  let children;
  args.forEach((arg, index) => {
    const key = signature[index];
    if (key === undefined) {
      if (index === signature.length && arg && typeof arg === 'object') for (const [metaKey, metaValue] of Object.entries(arg)) node[metaKey] = metaValue;
      else throw new SyntaxError('too many arguments');
    } else if (arg === null) return;
    else if (key === '$children') children = arg.map(item => item.$ref);
    else if (key === '$text') node.text = arg;
    else props[key] = arg;
  });
  if (Object.keys(props).length) node.props = props;
  return { node, children };
}
export function typeMap(catalog) { return new Map(Object.keys(catalog.components).map(type => [pascal(type), type])); }
export function materializeStatements(definitions) {
  const seen = new Set();
  const build = (id) => {
    const definition = definitions.get(id);
    if (!definition || seen.has(id)) return undefined;
    seen.add(id);
    const built = (definition.children ?? []).map(build).filter(Boolean);
    return { ...definition.node, ...(built.length ? { children: built } : {}) };
  };
  return build('root');
}

/* ---------------------------------------------------------------- (e) Lyra Lines */
/** Explicit ids (the default profile); every authored view in the corpus is encodable. */
export function encodeLinesView(view, catalog) {
  const result = encodeLines(view, catalog);
  if (!result.ok) throw new TypeError(`Lines encoding failed: ${result.diagnostics[0]?.code}`);
  return result.value;
}

/* ---------------------------------------------------------------- incremental consumers */
/**
 * A consumer accepts fixed-size text chunks. `push` returns `{ materialize }` after a complete line (call it
 * to build the partial tree; it is lazy so parse timing excludes it) or `{ failed }`; `finish` returns `{ view, status, codes }`. json and markup use the
 * lyra-gen progressive parsers, whose validated partial views appear on some incomplete pushes.
 */
export function createConsumer(format, context) {
  const { catalog, view: template } = context;
  const reference = { id: catalog.id, version: catalog.version };
  const frame = (root) => ({ version: '1', catalog: reference, surfaceId: template.surfaceId, revision: template.revision, root });
  if (format === 'json') {
    const stream = createJsonViewStream({ catalog, progressive: true });
    return {
      partialSupport: true,
      push: (chunk) => { const result = stream.push(chunk); if (result.status === 'error') return { failed: result.diagnostics[0]?.code }; const partial = result.partial; return partial ? { materialize: () => partial.view } : {}; },
      finish: () => { const result = stream.finish(); return { view: result.view, status: result.status, codes: result.diagnostics.map(d => d.code), validatedInside: true }; }
    };
  }
  if (format === 'markup') {
    const parser = createProgressiveMarkupParser({ catalog, surfaceId: template.surfaceId, revision: template.revision, allowedTags: Object.keys(catalog.components), progressive: {} });
    return {
      partialSupport: true,
      push: (chunk) => { const result = parser.push(chunk); if (result.status === 'error') return { failed: result.diagnostics[0]?.code }; const partial = result.partial; return partial ? { materialize: () => partial.view } : {}; },
      finish: () => { const result = parser.finish(); return { view: result.view, status: result.status, codes: result.diagnostics.map(d => d.code), validatedInside: false }; }
    };
  }
  if (format === 'lines') {
    const parser = createLinesParser(catalog, { surfaceId: template.surfaceId, revision: template.revision, progressive: {} });
    return {
      partialSupport: true,
      push: (chunk) => { const result = parser.push(chunk); if (result.status === 'error') return { failed: result.diagnostics[0]?.code }; const partial = result.partial; return partial ? { materialize: () => partial.view } : {}; },
      finish: () => { const result = parser.finish(); return result.ok ? { view: result.value, status: 'complete', codes: [], validatedInside: false } : { status: 'error', codes: result.diagnostics.map(d => d.code) }; }
    };
  }
  let buffer = '';
  let failed;
  const lineConsumer = (onLine, materialize) => ({
    partialSupport: true,
    push: (chunk) => {
      if (failed) return { failed };
      buffer += chunk;
      let changed = false;
      for (let newline = buffer.indexOf('\n'); newline >= 0; newline = buffer.indexOf('\n')) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        try { onLine(line); changed = true; } catch (error) { failed = error instanceof SyntaxError || error instanceof TypeError ? `stream.${format}` : 'stream.error'; return { failed }; }
      }
      return changed ? { materialize } : {};
    },
    finish: () => {
      if (!failed && buffer.trim()) { try { onLine(buffer); buffer = ''; } catch { failed = `stream.${format}`; } }
      if (failed) return { status: 'error', codes: [failed] };
      const root = materialize();
      return root ? { view: root, status: 'complete', codes: [], validatedInside: false } : { status: 'error', codes: ['stream.no-root'] };
    },
    frame
  });
  if (format === 'json-patch') {
    const state = { elements: {} };
    const consumer = lineConsumer(line => applyOperation(state, JSON.parse(line)), () => { const root = materializeFlat(state); return root ? frame(root) : undefined; });
    return consumer;
  }
  const definitions = new Map();
  const names = typeMap(catalog);
  return lineConsumer(line => { const { node, children } = parseStatement(line, catalog, names); definitions.set(node.id, { node, children }); }, () => { const root = materializeStatements(definitions); return root ? frame(root) : undefined; });
}

export const encode = (format, view, catalog) => format === 'json' ? encodeJson(view) : format === 'markup' ? encodeMarkup(view) : format === 'json-patch' ? encodePatchStream(view) : format === 'lines' ? encodeLinesView(view, catalog) : encodeStatements(view, catalog);

/** Split into fixed-size chunks of UTF-16 code units; never splits inside a surrogate pair. */
export function chunkText(text, size) {
  const chunks = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + size);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end++;
    chunks.push(text.slice(start, end)); start = end;
  }
  return chunks;
}
