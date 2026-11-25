import type { LyraGenDiagnostic, LyraGenNode, LyraGenView } from './types.js';

export interface LyraGenRepairMessageOptions {
  /** Upper bound of the returned text in UTF-16 code units; default 4000, clamped to 200..32000. */
  readonly maxCharacters?: number;
  /** The view the diagnostics describe; when given, node groups name their node ids. */
  readonly view?: LyraGenView;
}

const HEADER = 'Fix these validation errors. Return a replacement for each listed node with the same id; keep every other node unchanged.';
const MAX_ENTRIES = 1000;
const MAX_LINE = 480;
const MAX_FIELD = 320;
const nodePattern = /^\/root(?:\/children\/\d+)*/u;

/** One line of plain text: control characters and whitespace runs collapse to one space. */
const flatten = (value: string, max: number): string => {
  const text = value.replace(/[\p{Cc}\u2028\u2029\s]+/gu, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};
const field = (item: object, key: string): string | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(item, key);
  return descriptor && 'value' in descriptor && typeof descriptor.value === 'string' ? descriptor.value : undefined;
};
const indices = (nodePath: string): number[] => nodePath === '/root' ? [] : nodePath.slice('/root/children/'.length).split('/children/').map(Number);
const compareNodes = (a: string, b: string): number => {
  const left = indices(a);
  const right = indices(b);
  for (let index = 0; index < Math.min(left.length, right.length); index++) if (left[index] !== right[index]) return left[index]! - right[index]!;
  return left.length - right.length;
};
const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const nodeAt = (view: LyraGenView | undefined, nodePath: string): LyraGenNode | undefined => {
  if (!view || typeof view !== 'object' || !view.root || typeof view.root !== 'object') return undefined;
  let node: LyraGenNode | undefined = view.root;
  for (const index of indices(nodePath)) node = Array.isArray(node?.children) ? node.children[index] : undefined;
  return node;
};

interface Entry { readonly group: string; readonly line: string }

/**
 * Render diagnostics as a compact, deterministic repair instruction for a model: grouped by node in
 * document order (view-level failures first), one line per distinct diagnostic with its code, path
 * relative to the node, message and hint, and bounded to `maxCharacters`. Diagnostics carry no
 * generated values, so neither does the message. Returns an empty string when there is nothing to
 * render. Formatting grants no authority: the host still decides whether to request a repair.
 */
export function formatRepairMessage(diagnostics: readonly LyraGenDiagnostic[], options: LyraGenRepairMessageOptions = {}): string {
  const requested = options?.maxCharacters;
  const maxCharacters = typeof requested === 'number' && Number.isFinite(requested) ? Math.min(32_000, Math.max(200, Math.floor(requested))) : 4000;
  if (!Array.isArray(diagnostics)) return '';
  const groups = new Map<string, { readonly label: string; readonly lines: Set<string> }>();
  for (let index = 0; index < Math.min(diagnostics.length, MAX_ENTRIES); index++) {
    const item: unknown = diagnostics[index];
    if (item === null || typeof item !== 'object') continue;
    const code = field(item, 'code');
    const message = field(item, 'message');
    if (code === undefined || message === undefined) continue;
    const path = field(item, 'path') ?? '';
    const hint = field(item, 'hint');
    const nodePath = nodePattern.exec(path)?.[0];
    const key = nodePath ?? '';
    const relative = nodePath === undefined ? path : path.slice(nodePath.length);
    const line = flatten(`- ${flatten(code, 64)}${relative ? ` at ${flatten(relative, MAX_FIELD)}` : ''}: ${flatten(message, MAX_FIELD)}${hint ? ` Hint: ${flatten(hint, MAX_FIELD)}` : ''}`, MAX_LINE);
    let group = groups.get(key);
    if (!group) {
      const id = nodePath === undefined ? undefined : nodeAt(options?.view, nodePath)?.id;
      const label = nodePath === undefined ? 'View:' : typeof id === 'string' ? `Node ${JSON.stringify(flatten(id, 128))} (${nodePath}):` : `Node at ${nodePath}:`;
      group = { label, lines: new Set() };
      groups.set(key, group);
    }
    group.lines.add(line);
  }
  const keys = [...groups.keys()].sort((a, b) => a === '' ? -1 : b === '' ? 1 : compareNodes(a, b));
  const entries: Entry[] = keys.flatMap(key => [...groups.get(key)!.lines].sort(compareText).map(line => ({ group: groups.get(key)!.label, line })));
  if (!entries.length) return '';
  let text = HEADER;
  let current = '';
  let written = 0;
  for (const entry of entries) {
    const remaining = entries.length - written - 1;
    const note = remaining ? `\n${remaining} more errors omitted.` : '';
    const addition = `${entry.group === current ? '' : `\n${entry.group}`}\n${entry.line}`;
    if (text.length + addition.length + note.length > maxCharacters) {
      if (written === 0) {
        const room = maxCharacters - text.length - note.length - (addition.length - entry.line.length) - 1;
        if (room > 8) { text += `${addition.slice(0, addition.length - entry.line.length)}\n${entry.line.slice(0, room - 3)}...`; written++; current = entry.group; }
      }
      break;
    }
    text += addition;
    current = entry.group;
    written++;
  }
  if (written < entries.length) text += `\n${entries.length - written} more errors omitted.`;
  return text.length > maxCharacters ? text.slice(0, maxCharacters) : text;
}
