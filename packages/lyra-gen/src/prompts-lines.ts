import { LINES_HEADER, encodeLines } from './lines.js';
import { buildCatalogPrompt, type LyraGenPromptProfile } from './prompts.js';
import type { LyraGenCatalog } from './types.js';

export interface LyraGenLinesPromptOptions {
  /** Character ceiling for the whole prompt; default 65536. A longer prompt throws a `RangeError`. */
  readonly maxCharacters?: number;
  /** Catalog description. Default `'signature'`, the compact one-line-per-role form. */
  readonly profile?: LyraGenPromptProfile;
  /** Include each role's examples, written in Lines. Default `false`. */
  readonly examples?: boolean;
  /** Tell the model ids may be omitted; parse with `parseLines(..., { elideIds: true })`. Default `false`. */
  readonly elideIds?: boolean;
}

const DEFAULT_PROMPT_CHARACTERS = 65536;
// The shared catalog prompt starts with its output-format sentences; the content rules follow them.
const SHARED_RULES_START = 'Use plain text.';

const headerWord = (value: string): string => /^[A-Za-z0-9][A-Za-z0-9_.:+@-]*$/u.test(value) ? value : JSON.stringify(value);

/**
 * Prompt asking for Lyra Lines output (see `parseLines()`), with the same content, value and bound
 * rules and catalog description as `buildCatalogPrompt()`. The profile is opt in: evaluate it with
 * the model you deploy before preferring it over JSON.
 */
export function buildLinesPrompt(catalog: LyraGenCatalog, options: LyraGenLinesPromptOptions = {}): string {
  const shared = buildCatalogPrompt(catalog, { profile: options.profile ?? 'signature', format: 'json', examples: false, maxCharacters: Number.MAX_SAFE_INTEGER }).split('\n');
  const start = shared.findIndex(line => line.startsWith(SHARED_RULES_START));
  if (start < 0) throw new RangeError('The catalog prompt has no content rules to reuse.');
  const header = `${LINES_HEADER} ${headerWord(catalog.id)} ${headerWord(catalog.version)}`;
  const positional = Object.entries(catalog.components).filter(([, component]) => component.required?.length).map(([role, component]) => `${role} ${component.required!.join(' ')}`);
  const lines = [
    `Return Lyra Lines, not JSON. The first line is exactly: ${header}`,
    'Then one node per line: type#id, then the required props as positional values in the order listed below, then optional props as key=value, then node members as @member=JSON, then optionally " | " and the text content.',
    'The first node is the single root at column 1; each child is indented exactly one space deeper than its parent, in order. No closing lines, comments or other content.',
    'Values: numbers, true, false and null as in JSON; strings as JSON strings in double quotes with JSON escapes; an unquoted word only for a value the property enumerates; arrays and objects as compact JSON on the same line.',
    'Members slot, bindings, reads, liveReads, dataQuery, repeat, itemReads, visible, checks, computes, a11y and action use @name={JSON}. If a required prop comes from a binding or read instead, stop the positional values there and write the remaining props as key=value.',
    'Text after "| " runs to the end of the line; write \\n for a line break and \\\\ for a backslash.',
    options.elideIds
      ? 'Ids: #id may be omitted; an omitted id becomes <type>-<n>, n counting nodes of that type from 1 in document order, and the root becomes root. Write #id for any node that other content refers to.'
      : 'Every node needs a unique #id (letters, digits, _ . : -).',
    `Positional props (${header}): ${positional.join('; ')}.`,
    ...shared.slice(start),
  ];
  if (options.examples) {
    const shown: string[] = [];
    for (const [role, component] of Object.entries(catalog.components)) {
      for (const example of component.examples ?? []) {
        const encoded = encodeLines({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'example', revision: 0, root: example }, catalog);
        if (encoded.ok) shown.push(`${role}: ${encoded.value.split('\n').slice(1).join('\n').trimEnd()}`);
      }
    }
    if (shown.length) lines.push('Examples:', ...shown);
  }
  const prompt = lines.join('\n');
  const maximum = options.maxCharacters ?? DEFAULT_PROMPT_CHARACTERS;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || prompt.length > maximum) throw new RangeError('Catalog prompt exceeds its character budget. Select a smaller catalog.');
  return prompt;
}
