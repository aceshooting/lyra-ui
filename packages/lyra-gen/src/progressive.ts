import { createMarkupElementReader, createMarkupParser, type MarkupOpenTag, type MarkupOptions, type MarkupResult } from './parser.js';
import { PartialViewTracker, type LyraGenPartialView, type LyraGenProgressiveOptions } from './partial-view.js';
import type { LyraGenCatalog, LyraGenLimits, LyraGenNode } from './types.js';

export { DEFAULT_PARTIAL_INTERVAL, type LyraGenPartialView, type LyraGenProgressiveOptions } from './partial-view.js';

export interface ProgressiveMarkupOptions extends Omit<MarkupOptions, 'catalog'> {
  /** The active catalog: its reference is written into every view, and previews pass its strict validation. */
  readonly catalog: LyraGenCatalog;
  readonly progressive?: LyraGenProgressiveOptions;
  /** View-validation limits for previews; the Markup syntax limits stay in `limits`. */
  readonly validationLimits?: Partial<LyraGenLimits>;
  /** Apply catalog-directed property normalization while validating previews. */
  readonly normalize?: boolean;
}
export interface ProgressiveMarkupResult extends MarkupResult {
  /** A new validated preview assembled by this `incomplete` push. */
  readonly partial?: LyraGenPartialView;
}
export interface ProgressiveMarkupParser {
  push(chunk: string): ProgressiveMarkupResult;
  /** Exactly the result `createMarkupParser` gives for the same chunks. */
  finish(): MarkupResult;
  cancel(): MarkupResult;
}
interface OpenElement { readonly open: MarkupOpenTag; readonly children: LyraGenNode[]; text: string }
const blank = /^[ \t\r\n]*$/u;
const closeTag = /^<\/([A-Za-z][A-Za-z0-9_-]*)[ \t\r\n]*>$/u;

/**
 * A Markup stream that also yields validated previews while it streams. Each arriving code unit is
 * lexed once; every start tag, close tag and text run is parsed once, when it is complete, with the
 * same element rules as the batch parser. Any syntax defect stops previews and leaves the verdict to
 * `finish()`, which runs the unchanged batch parse.
 */
export function createProgressiveMarkupParser(options: ProgressiveMarkupOptions): ProgressiveMarkupParser {
  const inner = createMarkupParser(options);
  const reader = createMarkupElementReader(options);
  const tracker = new PartialViewTracker(options.catalog, options.progressive ?? {}, options.validationLimits, options.normalize);
  const stack: OpenElement[] = [];
  let root: LyraGenNode | undefined;
  let stopped = false;
  let dirty = false;
  let received = 0;
  // Unconsumed source from the start of the current token, and how much of it has been lexed.
  let buffer = '';
  let scanned = 0;
  let inTag = false;
  let quote = '';
  let depth = 0;
  let inString = false;
  let escaped = false;

  const stop = (): void => { stopped = true; stack.length = 0; buffer = ''; };
  const complete = (node: LyraGenNode): void => {
    const parent = stack.at(-1);
    if (parent) parent.children.push(node); else root = node;
    dirty = true;
  };
  const text = (raw: string): void => {
    const parent = stack.at(-1);
    if (!parent) { if (!blank.test(raw)) stop(); return; }
    parent.text += reader.decode(raw);
  };
  const tag = (source: string): void => {
    if (source.startsWith('</')) {
      const top = stack.pop();
      if (!top || closeTag.exec(source)?.[1] !== top.open.type) { stop(); return; }
      complete(reader.closeNode(top.open, top.children, top.text));
      return;
    }
    const parent = stack.at(-1);
    if (root || (parent && !blank.test(parent.text))) { stop(); return; }
    const open = reader.openTag(source, stack.length + 1);
    // Member checks run as soon as the start tag is known, so a shown container is already admissible.
    const node = reader.closeNode(open, [], '');
    if (open.selfClosing) complete(node);
    else stack.push({ open, children: [], text: '' });
  };
  const lex = (): void => {
    let index = scanned;
    while (index < buffer.length && !stopped) {
      const character = buffer[index]!;
      if (!inTag) {
        if (character === '<') {
          if (index > 0) text(buffer.slice(0, index));
          buffer = buffer.slice(index); index = 0;
          inTag = true; quote = ''; depth = 0; inString = false; escaped = false;
        }
        index++;
        continue;
      }
      if (inString) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') inString = false; }
      else if (depth > 0) { if (character === '"') inString = true; else if (character === '{' || character === '[') depth++; else if (character === '}' || character === ']') depth--; }
      else if (quote) { if (character === quote) quote = ''; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '{') depth = 1;
      else if (character === '>') {
        tag(buffer.slice(0, index + 1));
        buffer = buffer.slice(index + 1); index = 0; inTag = false;
        continue;
      }
      index++;
    }
    scanned = index;
  };
  const candidate = (): { root: LyraGenNode; open: Set<string> } | undefined => {
    const open = new Set<string>();
    if (root) return { root, open };
    const build = (level: number): LyraGenNode | undefined => {
      const element = stack[level];
      if (!element) return undefined;
      const children = [...element.children];
      const tail = build(level + 1);
      if (tail) children.push(tail);
      if (!children.length) return undefined;
      open.add(element.open.id);
      return reader.closeNode(element.open, children, '');
    };
    const shown = build(0);
    return shown ? { root: shown, open } : undefined;
  };

  return {
    push(chunk) {
      const step = inner.push(chunk);
      if (step.status === 'error') { stop(); return step; }
      if (stopped || typeof chunk !== 'string' || !chunk.length) return step;
      received += chunk.length;
      buffer += chunk;
      try { lex(); } catch { stop(); }
      if (stopped || !dirty || !tracker.due(received)) return step;
      dirty = false;
      const next = candidate();
      const partial = next && tracker.offer({ version: '1', catalog: { id: options.catalog.id, version: options.catalog.version }, surfaceId: options.surfaceId, revision: options.revision, root: next.root }, next.open, received);
      return partial ? { ...step, partial } : step;
    },
    finish() { stop(); return inner.finish(); },
    cancel() { stop(); return inner.cancel(); }
  };
}
