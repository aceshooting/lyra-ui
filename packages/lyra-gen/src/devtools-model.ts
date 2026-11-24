import { parsePointer, readPointer } from './references.js';
import type { JsonValue, LyraGenCatalog, LyraGenComponent, LyraGenFieldPurpose, LyraGenNode } from './types.js';

/** One visible row of the inspector's view tree. */
export interface DevtoolsTreeRow {
  readonly id: string;
  readonly type: string;
  readonly node: LyraGenNode;
  /** One-based depth, as `aria-level` expects. */
  readonly level: number;
  /** One-based position among siblings, as `aria-posinset` expects. */
  readonly position: number;
  readonly setSize: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly parentId: string | undefined;
}

/** Default cap on rendered tree rows, so a pathological view cannot freeze the inspector. */
const DEVTOOLS_MAX_ROWS = 2000;

/** Depth-first rows for the expanded part of a view tree, bounded to `maxRows`. */
export function flattenTree(root: LyraGenNode, expanded: ReadonlySet<string>, maxRows = DEVTOOLS_MAX_ROWS): readonly DevtoolsTreeRow[] {
  const rows: DevtoolsTreeRow[] = [];
  const visit = (node: LyraGenNode, level: number, position: number, setSize: number, parentId: string | undefined): void => {
    if (rows.length >= maxRows) return;
    const children = node.children ?? [];
    const open = children.length > 0 && expanded.has(node.id);
    rows.push({ id: node.id, type: node.type, node, level, position, setSize, hasChildren: children.length > 0, expanded: open, parentId });
    if (open) children.forEach((child, index) => visit(child, level + 1, index + 1, children.length, node.id));
  };
  visit(root, 1, 1, 1, undefined);
  return rows;
}

/** Ids of every node that has children, for an "expand all" initial state. */
export function branchIds(root: LyraGenNode): readonly string[] {
  const ids: string[] = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.children?.length) { ids.push(node.id); stack.push(...node.children); }
  }
  return ids;
}

export function nodeById(root: LyraGenNode, id: string): LyraGenNode | undefined {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === id) return node;
    if (node.children) stack.push(...node.children);
  }
  return undefined;
}

/** Event types the inspector records. */
export type DevtoolsEventType = 'lr-gen-ready' | 'lr-gen-state-change' | 'lr-gen-action' | 'lr-gen-error';
export interface DevtoolsEventInput {
  readonly type: DevtoolsEventType;
  /** Milliseconds since the Unix epoch. */
  readonly time: number;
  /** Already-redacted, display-ready detail. */
  readonly summary: string;
}
export interface DevtoolsEventEntry extends DevtoolsEventInput {
  /** Monotonic one-based sequence number, stable across buffer eviction. */
  readonly sequence: number;
}

export const DEVTOOLS_EVENT_CAPACITY = 200;

/** Fixed-capacity ring buffer; the oldest entry is evicted once it is full. */
export class DevtoolsEventLog {
  readonly capacity: number;
  private readonly buffer: (DevtoolsEventEntry | undefined)[];
  private start = 0;
  private count = 0;
  private sequence = 0;

  constructor(capacity: number = DEVTOOLS_EVENT_CAPACITY) {
    this.capacity = Number.isFinite(capacity) && capacity >= 1 ? Math.floor(capacity) : DEVTOOLS_EVENT_CAPACITY;
    this.buffer = new Array<DevtoolsEventEntry | undefined>(this.capacity);
  }

  get size(): number { return this.count; }

  push(input: DevtoolsEventInput): DevtoolsEventEntry {
    const entry = { ...input, sequence: ++this.sequence };
    if (this.count < this.capacity) {
      this.buffer[(this.start + this.count) % this.capacity] = entry;
      this.count++;
    } else {
      this.buffer[this.start] = entry;
      this.start = (this.start + 1) % this.capacity;
    }
    return entry;
  }

  /** Entries oldest first. */
  entries(): readonly DevtoolsEventEntry[] {
    const result: DevtoolsEventEntry[] = [];
    for (let index = 0; index < this.count; index++) result.push(this.buffer[(this.start + index) % this.capacity]!);
    return result;
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.start = 0;
    this.count = 0;
  }
}

/** Same native hints content policy treats as sensitive; labels deliberately never count. */
function hintedPurpose(props: Readonly<Record<string, JsonValue>>): LyraGenFieldPurpose | undefined {
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

/** Whether a node collects a password, one-time code, payment card or secret. */
export function isSensitiveNode(node: LyraGenNode, component: LyraGenComponent | undefined): boolean {
  const purpose = hintedPurpose(node.props ?? {}) ?? component?.fieldPurpose;
  return purpose !== undefined && purpose !== 'general';
}

/** State pointers bound by sensitive nodes; their values are never displayed. */
export function sensitivePointers(root: LyraGenNode | undefined, catalog: LyraGenCatalog): ReadonlySet<string> {
  const pointers = new Set<string>();
  if (!root) return pointers;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (isSensitiveNode(node, Object.hasOwn(catalog.components, node.type) ? catalog.components[node.type] : undefined))
      for (const pointer of Object.values(node.bindings ?? {})) pointers.add(pointer);
    if (node.children) stack.push(...node.children);
  }
  return pointers;
}

const escapeSegment = (segment: string): string => segment.replace(/~/gu, '~0').replace(/\//gu, '~1');

/** A copy of `value` whose subtrees at `pointers` are replaced by `mask`. */
export function redactJson(value: JsonValue, pointers: ReadonlySet<string>, mask: string): JsonValue {
  if (pointers.size === 0) return value;
  const masked = new Set<string>();
  for (const pointer of pointers) {
    const parsed = parsePointer(pointer);
    masked.add(parsed.ok ? (parsed.value.length ? `/${parsed.value.map(escapeSegment).join('/')}` : '') : pointer);
  }
  const walk = (current: JsonValue, path: string): JsonValue => {
    if (masked.has(path)) return mask;
    if (current === null || typeof current !== 'object') return current;
    if (Array.isArray(current)) return current.map((item: JsonValue, index: number) => walk(item, `${path}/${index}`));
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(current)) result[key] = walk(item, `${path}/${escapeSegment(key)}`);
    return result;
  };
  return walk(value, '');
}

/** Replace any string leaf equal to one of `secrets`; catches values copied into payloads. */
function maskCopies(value: unknown, secrets: ReadonlySet<string>, mask: string): unknown {
  if (typeof value === 'string') return secrets.has(value) ? mask : value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => maskCopies(item, secrets, mask));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = maskCopies(item, secrets, mask);
  return result;
}

function sensitiveStrings(state: JsonValue, pointers: ReadonlySet<string>): ReadonlySet<string> {
  const secrets = new Set<string>();
  const collect = (value: JsonValue): void => {
    if (typeof value === 'string') { if (value) secrets.add(value); }
    else if (typeof value === 'number' || typeof value === 'boolean') secrets.add(String(value));
    else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) collect(item);
  };
  for (const pointer of pointers) {
    const read = readPointer(state, pointer);
    if (read.ok) collect(read.value);
  }
  return secrets;
}

/** Display-ready JSON with a known size ceiling. */
export function formatJson(value: unknown, maxLength = 20000): string {
  let text: string;
  try { text = JSON.stringify(value, null, 2) ?? String(value); } catch { text = String(value); }
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * An event detail rendered for the log: sensitive state paths are masked wherever the detail
 * carries a `values` object, and copies of sensitive values anywhere else are masked too.
 */
export function summarizeDetail(detail: unknown, state: JsonValue, pointers: ReadonlySet<string>, mask: string): string {
  if (pointers.size === 0) return formatJson(detail, 4000);
  let current: unknown = detail;
  if (current !== null && typeof current === 'object' && !Array.isArray(current) && 'values' in current)
    current = { ...current, values: redactJson((current as { values: JsonValue }).values, pointers, mask) };
  const secrets = sensitiveStrings(state, pointers);
  return formatJson(secrets.size ? maskCopies(current, secrets, mask) : current, 4000);
}

interface DevtoolsRole {
  readonly name: string;
  readonly tag: string;
  readonly fieldPurpose: LyraGenFieldPurpose | undefined;
  readonly interactive: boolean;
}
export interface DevtoolsRoles {
  readonly id: string;
  readonly version: string;
  readonly components: readonly DevtoolsRole[];
  readonly actions: readonly { readonly name: string; readonly confirm: boolean }[];
}

export function catalogRoles(catalog: LyraGenCatalog): DevtoolsRoles {
  const byName = (left: { name: string }, right: { name: string }) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  return {
    id: catalog.id,
    version: catalog.version,
    components: Object.entries(catalog.components).map(([name, component]) => ({ name, tag: component.tag, fieldPurpose: component.fieldPurpose, interactive: component.interactive === true || Object.keys(component.bindings ?? {}).length > 0 })).sort(byName),
    actions: Object.entries(catalog.actions ?? {}).map(([name, action]) => ({ name, confirm: action.confirm === true })).sort(byName),
  };
}
