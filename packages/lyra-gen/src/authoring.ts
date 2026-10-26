import { parseMarkup } from './parser.js';
import type { MarkupLimits } from './parser.js';
import { validateView } from './runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenLimits, LyraGenNode, LyraGenResult } from './types.js';

export interface EmitMarkupOptions {
  readonly limits?: Partial<LyraGenLimits>;
  readonly markupLimits?: Partial<MarkupLimits>;
}

/** Escape a literal for a quoted attribute or plain text in Lyra Markup. */
export function escapeMarkupText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function stableJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${stableJson(key)}:${stableJson((value as Record<string, JsonValue>)[key]!)}`).join(',')}}`;
  }
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** Emit only a host-catalog-admitted view, and verify the resulting restricted syntax. */
export function emitMarkup(input: unknown, catalog: LyraGenCatalog, options: EmitMarkupOptions = {}): LyraGenResult<string> {
  const admitted = validateView(input, catalog, { limits: options.limits });
  if (!admitted.ok) return admitted;
  const view = admitted.value;
  let invalidProperty = false;
  const emit = (node: LyraGenNode): string => {
    const attributes = [`id="${escapeMarkupText(node.id)}"`];
    if (node.slot !== undefined) attributes.push(`slot="${escapeMarkupText(node.slot)}"`);
    if (node.text !== undefined) attributes.push(`text="${escapeMarkupText(node.text)}"`);
    for (const key of Object.keys(node.props ?? {}).sort()) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key) || ['id', 'slot', 'text', 'bindings', 'action'].includes(key)) { invalidProperty = true; continue; }
      attributes.push(`${key}={${stableJson(node.props![key]!)}}`);
    }
    if (node.bindings !== undefined) attributes.push(`bindings={${stableJson(node.bindings)}}`);
    if (node.action !== undefined) attributes.push(`action={${stableJson(node.action as unknown as JsonValue)}}`);
    const open = `<${node.type} ${attributes.join(' ')}`;
    return node.children?.length ? `${open}>${node.children.map(emit).join('')}</${node.type}>` : `${open}/>`;
  };
  const source = emit(view.root);
  if (invalidProperty) return { ok: false, diagnostics: [{ code: 'authoring.property', path: '/root', severity: 'error', message: 'A property cannot be represented as a Lyra Markup attribute.' }] };
  const parsed = parseMarkup(source, { catalog: view.catalog, surfaceId: view.surfaceId, revision: view.revision,
    allowedTags: Object.keys(catalog.components), limits: options.markupLimits });
  if (parsed.status !== 'complete' || !parsed.view) return { ok: false, diagnostics: parsed.diagnostics };
  const checked = validateView(parsed.view, catalog, { limits: options.limits });
  return checked.ok ? { ok: true, value: source, diagnostics: [] } : checked;
}
