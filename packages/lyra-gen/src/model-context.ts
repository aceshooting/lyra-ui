import { failure } from './json-bytes.js';
import { parsePointer } from './references.js';
import { snapshotJson } from './schema.js';
import type { LyraGenSurfaceState } from './runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenFieldPurpose, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';

/** Marker that replaces a value the model must not see but whose existence is useful context. */
export const MODEL_CONTEXT_REDACTED = '[redacted]';
const DEFAULT_MAX_BYTES = 16384;
const MIN_MAX_BYTES = 512;
const DEFAULT_MAX_NODES = 200;
const DEFAULT_MAX_STRING = 200;
const SENSITIVE: readonly LyraGenFieldPurpose[] = ['password', 'one-time-code', 'payment-card', 'secret'];
const LABEL_PROPS: readonly string[] = ['label', 'heading', 'caption', 'title', 'ariaLabel', 'aria-label', 'name'];
const SENSITIVE_AUTOCOMPLETE = /^(?:one-time-code|current-password|new-password|cc-.*)$/u;

export interface LyraGenModelContextOptions {
  /** Catalog that admitted the view; its `fieldPurpose` declarations decide which state paths are always redacted. */
  readonly catalog?: LyraGenCatalog;
  /** JSON Pointers into state, selection and live data that are never emitted, including everything beneath them. */
  readonly private?: readonly string[];
  /** Host-owned selection or filter state. */
  readonly selection?: JsonValue;
  /** Host-owned summary of live data (small aggregates, not raw rows). */
  readonly liveData?: JsonValue;
  /** UTF-8 byte ceiling of the serialized context; default 16384, minimum 512. */
  readonly maxBytes?: number;
  readonly maxNodes?: number;
  readonly maxStringLength?: number;
}
export interface LyraGenModelContextNode {
  readonly id: string;
  readonly type: string;
  readonly label?: string;
  readonly children?: readonly string[];
}
export interface LyraGenModelContext {
  readonly surfaceId: string;
  readonly revision: number;
  readonly nodes?: readonly LyraGenModelContextNode[];
  readonly values?: JsonValue;
  readonly dirty?: readonly string[];
  readonly selection?: JsonValue;
  readonly liveData?: JsonValue;
  readonly truncated?: true;
}

interface Trie { kind?: 'private' | 'sensitive'; readonly children: Map<string, Trie> }
const newTrie = (): Trie => ({ children: new Map() });
const addPath = (root: Trie, segments: readonly string[], kind: 'private' | 'sensitive'): void => {
  let at = root;
  for (const segment of segments) {
    let next = at.children.get(segment);
    if (!next) { next = newTrie(); at.children.set(segment, next); }
    at = next;
  }
  if (kind === 'private' || at.kind === undefined) at.kind = kind;
};
const isRecord = (value: JsonValue | undefined): value is { readonly [key: string]: JsonValue } => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Remove private values (omitted) and mask sensitive ones; any path that is exactly or beneath a rule is covered. */
function redact(value: JsonValue, trie: Trie | undefined): JsonValue | undefined {
  if (!trie) return value;
  if (trie.kind === 'private') return undefined;
  if (trie.kind === 'sensitive') return MODEL_CONTEXT_REDACTED;
  if (Array.isArray(value)) return value.map((item, index) => redact(item, trie.children.get(String(index))) ?? null);
  if (isRecord(value)) {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value)) {
      const next = redact(value[key]!, trie.children.get(key));
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value;
}
/** True when the pointer is covered by (equal to or beneath) a rule, or is an ancestor of a private rule's path that must not be named. */
function covered(trie: Trie, segments: readonly string[]): boolean {
  let at = trie;
  for (const segment of segments) {
    if (at.kind) return true;
    const next = at.children.get(segment);
    if (!next) return false;
    at = next;
  }
  return at.kind !== undefined;
}
const clip = (text: string, cap: number): string => {
  if (text.length <= cap) return text;
  let end = Math.max(0, cap - 1);
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return `${text.slice(0, end)}…`;
};
function limitValue(value: JsonValue, depth: number, cap: number): JsonValue {
  if (typeof value === 'string') return clip(value, cap);
  if (value === null || typeof value !== 'object') return value;
  if (depth <= 0) return Array.isArray(value) ? [] : {};
  if (Array.isArray(value)) return value.slice(0, 50).map(item => limitValue(item, depth - 1, cap));
  const out: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort().slice(0, 50)) out[clip(key, 64)] = limitValue((value as Record<string, JsonValue>)[key]!, depth - 1, cap);
  return out;
}
const sortKeys = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys((value as Record<string, JsonValue>)[key]!);
    return out;
  }
  return value;
};
const byteLength = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

function sensitiveNode(node: LyraGenNode, catalog: LyraGenCatalog | undefined): boolean {
  const purpose = catalog && Object.hasOwn(catalog.components, node.type) ? catalog.components[node.type]!.fieldPurpose : undefined;
  if (purpose && SENSITIVE.includes(purpose)) return true;
  const props = node.props ?? {};
  const type = props['type'];
  const autocomplete = props['autocomplete'];
  return type === 'password' || (typeof autocomplete === 'string' && autocomplete.split(/\s+/u).some(token => SENSITIVE_AUTOCOMPLETE.test(token)));
}
function outline(view: LyraGenView, catalog: LyraGenCatalog | undefined, sensitiveIds: Set<string>): { readonly all: readonly LyraGenModelContextNode[]; readonly sensitive: ReadonlySet<string> } {
  const out: LyraGenModelContextNode[] = [];
  const queue: LyraGenNode[] = [view.root];
  const seen = new Set<string>();
  for (let at = 0; at < queue.length; at++) {
    const node = queue[at]!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    const sensitive = sensitiveNode(node, catalog);
    if (sensitive) sensitiveIds.add(node.id);
    const bound = new Set(Object.keys(node.bindings ?? {}));
    let label: string | undefined;
    if (!sensitive) {
      for (const name of LABEL_PROPS) {
        const candidate = node.props?.[name];
        if (typeof candidate === 'string' && candidate !== '' && !bound.has(name)) { label = candidate; break; }
      }
      if (label === undefined && typeof node.text === 'string' && node.text !== '') label = node.text;
    }
    const children = (node.children ?? []).map(child => child.id);
    out.push({ id: node.id, type: node.type, ...(label === undefined ? {} : { label }), ...(children.length ? { children } : {}) });
    queue.push(...(node.children ?? []));
  }
  return { all: out, sensitive: sensitiveIds };
}

/**
 * Serialize what the user currently sees and has edited into a bounded, deterministic plain-JSON object for the next model turn.
 * Private pointers and state owned by password, one-time-code, payment-card and secret fields never appear; the result is
 * frozen, validated by `snapshotJson()` and at most `maxBytes` UTF-8 bytes (parts are dropped, least relevant first, with `truncated: true`).
 */
export function createModelContext(view: LyraGenView, state: LyraGenSurfaceState, options: LyraGenModelContextOptions = {}): LyraGenResult<LyraGenModelContext> {
  const maxBytes = Math.max(MIN_MAX_BYTES, Number.isFinite(options.maxBytes) ? Math.floor(options.maxBytes!) : DEFAULT_MAX_BYTES);
  const maxNodes = Math.max(1, Number.isFinite(options.maxNodes) ? Math.floor(options.maxNodes!) : DEFAULT_MAX_NODES);
  const cap = Math.max(8, Number.isFinite(options.maxStringLength) ? Math.floor(options.maxStringLength!) : DEFAULT_MAX_STRING);
  if (state.surfaceId !== view.surfaceId) return failure('model-context.surface', 'The state belongs to a different surface than the view.');

  const rules = newTrie();
  for (const pointer of options.private ?? []) {
    const parsed = typeof pointer === 'string' ? parsePointer(pointer) : undefined;
    if (!parsed?.ok) return failure('model-context.private', 'Private paths must be valid JSON Pointers.');
    addPath(rules, parsed.value, 'private');
  }
  const sensitiveIds = new Set<string>();
  const { all } = outline(view, options.catalog, sensitiveIds);
  for (const [pointer, owner] of Object.entries(state.owners)) {
    if (!sensitiveIds.has(owner.nodeId)) continue;
    const parsed = parsePointer(pointer);
    if (parsed.ok) addPath(rules, parsed.value, 'sensitive');
  }

  const redactedValues = redact(state.values, rules) ?? {};
  const dirtyAll = [...state.dirty].filter(pointer => {
    const parsed = parsePointer(pointer);
    return parsed.ok && !covered(rules, parsed.value);
  }).sort();
  const selection = options.selection === undefined ? undefined : sortKeys(options.selection);
  const liveData = options.liveData === undefined ? undefined : sortKeys(redact(sortKeys(options.liveData), rules) ?? {});

  const build = (plan: { nodes: number; depth: number; strings: number; values: boolean; dirty: number; selection: boolean; live: boolean; truncated: boolean }): Record<string, unknown> => {
    const kept = all.slice(0, plan.nodes);
    const ids = new Set(kept.map(node => node.id));
    const nodes = kept.map(node => ({
      id: clip(node.id, 128), type: clip(node.type, 64),
      ...(node.label === undefined ? {} : { label: clip(node.label, plan.strings) }),
      ...(node.children ? (() => { const present = node.children.filter(child => ids.has(child)).map(child => clip(child, 128)); return present.length ? { children: present } : {}; })() : {})
    }));
    return {
      surfaceId: clip(view.surfaceId, 128), revision: view.revision, nodes,
      ...(plan.values ? { values: limitValue(sortKeys(redactedValues), plan.depth, plan.strings) } : {}),
      dirty: dirtyAll.slice(0, plan.dirty).map(pointer => clip(pointer, 256)),
      ...(plan.selection && selection !== undefined ? { selection: limitValue(selection, plan.depth, plan.strings) } : {}),
      ...(plan.live && liveData !== undefined ? { liveData: limitValue(liveData, plan.depth, plan.strings) } : {}),
      ...(plan.truncated ? { truncated: true } : {})
    };
  };
  const nodeCount = Math.min(all.length, maxNodes);
  const base = { nodes: nodeCount, depth: 8, strings: cap, values: true, dirty: dirtyAll.length, selection: true, live: true };
  const plans: (typeof base & { truncated: boolean })[] = [];
  const wasLimited = nodeCount < all.length;
  plans.push({ ...base, truncated: wasLimited });
  plans.push({ ...base, live: false, truncated: true });
  plans.push({ ...base, live: false, selection: false, truncated: true });
  plans.push({ ...base, live: false, selection: false, depth: 3, strings: Math.min(cap, 64), truncated: true });
  for (let nodes = Math.floor(nodeCount / 2); nodes >= 1; nodes = Math.floor(nodes / 2)) plans.push({ ...base, nodes, live: false, selection: false, depth: 2, strings: Math.min(cap, 48), truncated: true });
  plans.push({ ...base, nodes: 1, live: false, selection: false, values: false, dirty: 16, strings: 32, truncated: true });
  plans.push({ ...base, nodes: 0, live: false, selection: false, values: false, dirty: 0, strings: 32, truncated: true });

  let chosen: Record<string, unknown> = { surfaceId: clip(view.surfaceId, 64), revision: view.revision, truncated: true };
  for (const plan of plans) {
    const candidate = build(plan);
    if (byteLength(candidate) <= maxBytes) { chosen = candidate; break; }
  }
  const snap = snapshotJson(chosen);
  if (!snap.ok) return snap;
  return { ok: true, value: snap.value as unknown as LyraGenModelContext, diagnostics: [] };
}

/** Compact, deterministic text block for a prompt; each line is plain data, never instructions. */
export function toPromptText(context: LyraGenModelContext): string {
  const lines = [`surface ${context.surfaceId} revision ${context.revision}${context.truncated ? ' (truncated)' : ''}`];
  for (const node of context.nodes ?? []) lines.push(`node ${node.id} ${node.type}${node.label === undefined ? '' : ` ${JSON.stringify(node.label)}`}${node.children ? ` > ${node.children.join(',')}` : ''}`);
  if (context.values !== undefined) lines.push(`values ${JSON.stringify(context.values)}`);
  if (context.dirty?.length) lines.push(`edited ${context.dirty.join(' ')}`);
  if (context.selection !== undefined) lines.push(`selection ${JSON.stringify(context.selection)}`);
  if (context.liveData !== undefined) lines.push(`live ${JSON.stringify(context.liveData)}`);
  return lines.join('\n');
}
