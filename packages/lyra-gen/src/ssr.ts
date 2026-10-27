import { html, nothing, type TemplateResult } from 'lit';
import { formatTableValue, type TableValueFormat } from './catalogs/formatting.js';
import { initialCatalog } from './catalog.js';
import { restoreSnapshot, type LyraGenSnapshot } from './runtime.js';
import { readPointer } from './references.js';
import { resolveLimits, snapshotJson } from './schema.js';
import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenNode, LyraGenResult } from './types.js';
import type { LyraGenViewElement } from './gen-view.class.js';

/** Native, noninteractive server markup followed by validated client restoration. */
export const GEN_SSR_PROFILE = 'lyra-gen-static-v1';
export const GEN_SSR_ROLES = Object.freeze(['stack', 'row', 'text', 'heading', 'form', 'input', 'textarea', 'select', 'option', 'checkbox', 'switch', 'button', 'table'] as const);
export interface GenSnapshotOptions {
  /** Explicit host locale context; model documents cannot choose it. */
  readonly locale?: string;
  readonly direction?: 'ltr' | 'rtl';
  readonly limits?: Partial<LyraGenLimits>;
}
export interface GenRenderedSnapshot {
  readonly profile: typeof GEN_SSR_PROFILE;
  /** Pass to the host's Lit SSR renderer. This contains real native content, not a client shell. */
  readonly template: TemplateResult;
  /** Bounded JSON with script-closing characters escaped; not executable code or raw HTML. */
  readonly serialized: string;
}
interface Envelope {
  readonly profile: typeof GEN_SSR_PROFILE;
  readonly snapshot: LyraGenSnapshot;
  readonly locale?: string;
  readonly direction?: 'ltr' | 'rtl';
}
export interface GenRestoreOptions { readonly signal?: AbortSignal; readonly limits?: Partial<LyraGenLimits> }
const roles: ReadonlySet<string> = new Set(GEN_SSR_ROLES);
const restorations = new WeakMap<HTMLElement, AbortController>();
const failure = <T>(code: string, message: string): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, path: '', message, severity: 'error' }] });
const string = (value: JsonValue | undefined): string => typeof value === 'string' ? value : '';
const properties = (node: LyraGenNode, snapshot: LyraGenSnapshot): Record<string, JsonValue> => {
  const values = { ...node.props };
  for (const [key, pointer] of Object.entries(node.bindings ?? {})) {
    const value = readPointer(snapshot.state.values, pointer);
    if (value.ok) values[key] = value.value;
  }
  return values;
};

function profile(snapshot: LyraGenSnapshot, catalog: LyraGenCatalog, limits?: Partial<LyraGenLimits>): readonly LyraGenDiagnostic[] {
  const diagnostics: LyraGenDiagnostic[] = [];
  const reject = (node: LyraGenNode, message: string): void => { if (diagnostics.length >= resolveLimits(limits).maxDiagnostics) return; diagnostics.push({ code: 'ssr.unsupported', path: `/nodes/${node.id}`, message, severity: 'error' }); };
  const visit = (node: LyraGenNode, parent?: LyraGenNode): void => {
    if (!roles.has(node.type) || catalog.components[node.type] !== initialCatalog.components[node.type]) {
      reject(node, 'The static SSR profile accepts only its reviewed, unmodified catalog roles.');
      return;
    }
    if (node.slot) reject(node, 'Named slots are not part of the static SSR profile.');
    if (node.type === 'option' && parent?.type !== 'select') reject(node, 'Static options must be children of a select.');
    if (node.type === 'table') {
      const props = properties(node, snapshot);
      const rows = props['rows'];
      const ceiling = Math.min(typeof props['pageSize'] === 'number' ? props['pageSize'] : 100, typeof props['maxRows'] === 'number' ? props['maxRows'] : 200);
      if (props['loading'] || props['error'] || !Array.isArray(rows) || rows.length > ceiling) reject(node, 'Static tables require complete data fitting their first page and row limit.');
    }
    node.children?.forEach(child => visit(child, node));
  };
  visit(snapshot.view.root);
  return diagnostics;
}

function validateEnvelope(input: unknown, catalog: LyraGenCatalog, limits?: Partial<LyraGenLimits>): LyraGenResult<Envelope> {
  const admitted = snapshotJson(input, limits);
  if (!admitted.ok) return admitted;
  const value = admitted.value;
  if (value === null || Array.isArray(value) || typeof value !== 'object') return failure('ssr.envelope', 'Unknown SSR snapshot profile.');
  const data = value as JsonObject;
  if (data['profile'] !== GEN_SSR_PROFILE || Object.keys(data).some(key => !['profile', 'snapshot', 'locale', 'direction'].includes(key))) return failure('ssr.envelope', 'Unknown SSR snapshot profile.');
  if (data['direction'] !== undefined && data['direction'] !== 'ltr' && data['direction'] !== 'rtl') return failure('ssr.context', 'Invalid snapshot direction.');
  if (data['locale'] !== undefined) {
    if (typeof data['locale'] !== 'string' || data['locale'].length > 64) return failure('ssr.context', 'Invalid snapshot locale.');
    try { if (Intl.getCanonicalLocales(data['locale']).length !== 1) return failure('ssr.context', 'Invalid snapshot locale.'); }
    catch { return failure('ssr.context', 'Invalid snapshot locale.'); }
  }
  const restored = restoreSnapshot(data['snapshot'], catalog, { limits });
  if (!restored.ok) return restored;
  const diagnostics = profile(restored.value, catalog, limits);
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, value: Object.freeze({ profile: GEN_SSR_PROFILE, snapshot: restored.value, ...(data['locale'] !== undefined ? { locale: data['locale'] as string } : {}), ...(data['direction'] !== undefined ? { direction: data['direction'] as 'ltr' | 'rtl' } : {}) }), diagnostics: [] };
}

/**
 * Render a reviewed native snapshot through an ordinary Lit SSR host. No component modules,
 * actions, data providers, HTML strings, or custom property adapters execute on the server.
 * The supplied snapshot is intended for the current viewer; callers own redaction and access.
 */
export function renderGenSnapshot(input: unknown, catalog: LyraGenCatalog, options: GenSnapshotOptions = {}): LyraGenResult<GenRenderedSnapshot> {
  const checked = validateEnvelope({ profile: GEN_SSR_PROFILE, snapshot: input, ...(options.locale !== undefined ? { locale: options.locale } : {}), ...(options.direction !== undefined ? { direction: options.direction } : {}) }, catalog, options.limits);
  if (!checked.ok) return checked;
  const envelope = checked.value;
  const snapshot = envelope.snapshot;
  const pending = [snapshot.view.root];
  while (pending.length) {
    const node = pending.pop()!;
    const columns = properties(node, snapshot)['columns'];
    if (node.type === 'table' && Array.isArray(columns) && columns.some(column => column !== null && typeof column === 'object' && !Array.isArray(column) && column['format'] !== undefined) && !envelope.locale) return failure('ssr.context', 'Formatted table columns require an explicit host locale.');
    pending.push(...(node.children ?? []));
  }
  const field = (node: LyraGenNode): TemplateResult => {
    const props = properties(node, snapshot);
    const hintId = `gen-ssr-${snapshot.view.surfaceId}-${node.id}-hint`;
    const errorId = `gen-ssr-${snapshot.view.surfaceId}-${node.id}-error`;
    const descriptions = [props['hint'] ? hintId : '', props['errorText'] ? errorId : ''].filter(Boolean).join(' ');
    const name = string(props['accessibleLabel']) || string(props['label']);
    const value = string(props['value']);
    const supporting = html`${props['hint'] ? html`<small id=${hintId}>${props['hint']}</small>` : nothing}${props['errorText'] ? html`<small id=${errorId}>${props['errorText']}</small>` : nothing}`;
    if (node.type === 'checkbox' || node.type === 'switch') return html`<div data-gen-id=${node.id}><label><input type="checkbox" role=${node.type === 'switch' ? 'switch' : nothing} disabled ?checked=${props['checked'] === true} ?required=${props['required'] === true} name=${string(props['name'])} .value=${props['value'] === undefined ? 'on' : value} aria-describedby=${descriptions || nothing}>${node.text}</label>${supporting}</div>`;
    if (node.type === 'textarea') return html`<div data-gen-id=${node.id}><span>${props['label']}</span><pre role="textbox" aria-multiline="true" aria-readonly="true" aria-disabled="true" aria-label=${name} aria-describedby=${descriptions || nothing} aria-required=${props['required'] === true ? 'true' : 'false'}>${value}</pre>${supporting}</div>`;
    if (node.type === 'select') {
      const children = node.children ?? [];
      const selected = children.some(option => string(option.props?.['value']) === value);
      return html`<div data-gen-id=${node.id}><label>${props['label']}<select disabled name=${string(props['name'])} aria-label=${name} aria-describedby=${descriptions || nothing} ?required=${props['required'] === true}>${!selected ? html`<option value="" selected>${props['placeholder']}</option>` : nothing}${children.map(option => html`<option data-gen-id=${option.id} value=${string(option.props?.['value'])} ?selected=${string(option.props?.['value']) === value} ?disabled=${option.props?.['disabled'] === true}>${option.props?.['label'] ?? option.text}</option>`)}</select></label>${supporting}</div>`;
    }
    return html`<div data-gen-id=${node.id}><label>${props['label']}<input disabled readonly type=${string(props['type']) || 'text'} .value=${value} name=${string(props['name'])} aria-label=${name} aria-describedby=${descriptions || nothing} ?required=${props['required'] === true}></label>${supporting}</div>`;
  };
  const renderNode = (node: LyraGenNode): TemplateResult => {
    const props = properties(node, snapshot);
    const children = () => node.children?.map(renderNode) ?? nothing;
    switch (node.type) {
      case 'stack': case 'row': return html`<div data-gen-id=${node.id} data-gen-type=${node.type}>${children()}</div>`;
      case 'text': return html`<p data-gen-id=${node.id}>${node.text}</p>`;
      case 'heading': return html`<h2 data-gen-id=${node.id}>${node.text}</h2>`;
      case 'form': return html`<form data-gen-id=${node.id} aria-label=${props['ariaLabel']}><fieldset disabled>${children()}</fieldset></form>`;
      case 'button': return html`<button data-gen-id=${node.id} type="button" disabled aria-label=${props['accessibleLabel'] ?? nothing}>${node.text}</button>`;
      case 'table': {
        const columns = props['columns'] as readonly { readonly key: string; readonly label: string; readonly format?: TableValueFormat }[];
        const rows = props['rows'] as readonly Readonly<Record<string, JsonValue>>[];
        return html`<table data-gen-id=${node.id}><caption>${props['caption']}</caption><thead><tr>${columns.map(column => html`<th scope="col">${column.label}</th>`)}</tr></thead><tbody>${rows.map(row => html`<tr>${columns.map(column => html`<td>${formatTableValue(row[column.key], column.format, envelope.locale ?? 'und')}</td>`)}</tr>`)}</tbody></table>`;
      }
      default: return field(node);
    }
  };
  const serialized = JSON.stringify(envelope).replace(/[<>&\u2028\u2029]/gu, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const limits = resolveLimits(options.limits);
  if (new TextEncoder().encode(serialized).byteLength > limits.maxBytes) return failure('ssr.bytes', 'Serialized snapshot exceeds the byte limit.');
  const template = html`<section data-lyra-gen-snapshot=${GEN_SSR_PROFILE} data-surface-id=${snapshot.view.surfaceId} data-revision=${snapshot.view.revision} lang=${envelope.locale ?? nothing} dir=${envelope.direction ?? nothing}>${renderNode(snapshot.view.root)}<template data-lyra-gen-state=${serialized}></template></section>`;
  return { ok: true, value: { profile: GEN_SSR_PROFILE, template, serialized }, diagnostics: [] };
}

/**
 * Replace a qualified server snapshot with the existing keyed renderer after it becomes ready.
 * This is explicit client restoration, not in-place Lit/DSD hydration. Actions remain disabled;
 * the host attaches its listeners and deliberately sets enabledActions after this resolves.
 * Invalid, interrupted, or superseded restoration leaves the static snapshot in place.
 */
export async function restoreGenSnapshotElement(container: HTMLElement, catalog: LyraGenCatalog, options: GenRestoreOptions = {}): Promise<LyraGenResult<LyraGenViewElement>> {
  if (!container.isConnected || container.getAttribute('data-lyra-gen-snapshot') !== GEN_SSR_PROFILE) return failure('ssr.container', 'A connected static snapshot container is required.');
  const templates = [...container.children].filter(child => child.localName === 'template' && child.hasAttribute('data-lyra-gen-state'));
  if (templates.length !== 1) return failure('ssr.state', 'Exactly one inert snapshot payload is required.');
  const source = templates[0]!.getAttribute('data-lyra-gen-state') ?? '';
  const ownerDocument = container.ownerDocument;
  const limits = resolveLimits(options.limits);
  if (source.length > limits.maxBytes || new TextEncoder().encode(source).byteLength > limits.maxBytes) return failure('ssr.bytes', 'Serialized snapshot exceeds the byte limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { return failure('ssr.json', 'Invalid serialized snapshot.'); }
  const checked = validateEnvelope(parsed, catalog, limits);
  if (!checked.ok) return checked;
  const envelope = checked.value;
  if (container.getAttribute('data-surface-id') !== envelope.snapshot.view.surfaceId || container.getAttribute('data-revision') !== String(envelope.snapshot.view.revision) || (container.getAttribute('lang') ?? undefined) !== envelope.locale || (container.getAttribute('dir') ?? undefined) !== envelope.direction) return failure('ssr.identity', 'Snapshot container identity or context does not match its payload.');
  if (options.signal?.aborted) return failure('ssr.interrupted', 'Snapshot restoration was interrupted.');
  restorations.get(container)?.abort();
  const controller = new AbortController();
  restorations.set(container, controller);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let element: LyraGenViewElement | undefined;
  let observer: MutationObserver | undefined;
  try {
    const module = await import('./gen-view.js');
    if (controller.signal.aborted || !container.isConnected) return failure('ssr.interrupted', 'Snapshot restoration was interrupted.');
    element = new module.LyraGenViewElement();
    element.hidden = true;
    element.inert = true;
    element.enabledActions = [];
    element.catalog = catalog;
    element.limits = limits;
    const restored = element.restoreSnapshot(envelope.snapshot);
    if (!restored.ok) return restored;
    const view = element;
    const ready = new Promise<boolean>(resolve => {
      view.addEventListener('lr-gen-ready', () => resolve(true), { once: true });
      view.addEventListener('lr-gen-error', () => resolve(false), { once: true });
      controller.signal.addEventListener('abort', () => resolve(false), { once: true });
      observer = new MutationObserver(() => { if (!container.isConnected || !view.isConnected || !container.contains(view)) controller.abort(); });
      // Removal of the container or any ancestor is a childList change on the node's own parent, so
      // watch the ancestor chain shallowly instead of every mutation anywhere in the document.
      observer.observe(container, { childList: true });
      for (let node: Node | null = container; node;) {
        const parent: Node | null = node.parentNode ?? (node as ShadowRoot).host ?? null;
        if (parent) observer.observe(parent, { childList: true });
        node = parent;
      }
    });
    container.append(view);
    if (!await ready || controller.signal.aborted || !container.isConnected || view.status !== 'ready' || templates[0]!.parentNode !== container || templates[0]!.getAttribute('data-lyra-gen-state') !== source || container.ownerDocument !== ownerDocument || container.getAttribute('data-surface-id') !== envelope.snapshot.view.surfaceId || container.getAttribute('data-revision') !== String(envelope.snapshot.view.revision) || (container.getAttribute('lang') ?? undefined) !== envelope.locale || (container.getAttribute('dir') ?? undefined) !== envelope.direction) return failure('ssr.interrupted', 'Snapshot restoration could not complete.');
    for (const child of [...container.childNodes]) if (child !== view) child.remove();
    view.hidden = false;
    view.inert = false;
    return { ok: true, value: view, diagnostics: [] };
  } catch { return failure('ssr.restore', 'Snapshot restoration could not complete.'); }
  finally {
    observer?.disconnect();
    options.signal?.removeEventListener('abort', abort);
    if (restorations.get(container) === controller) restorations.delete(container);
    if (element?.hidden) element.remove();
  }
}
