import { getInheritedPropertyDescriptor } from '../../../internal/data-descriptors.js';
import { loadDompurify } from '../../../internal/dompurify-loader.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
import { MapImageExportError } from './map-image-export.js';

export interface MapExportAttributionPeer {
  getStyle(): unknown;
  getSource(id: string): unknown;
}
export interface MapExportAttributionContext {
  readonly document: Document;
  readonly customAttribution?: unknown;
  readonly signal?: AbortSignal;
  current(): boolean;
  loadSanitizer?(): Promise<HtmlSanitizer | null>;
}
const MAX_SOURCES = 256, MAX_TEXT = 4096;
/** Collect public style and resolved provider credits independently of native control visibility. */
export async function collectMapExportAttribution(peer: MapExportAttributionPeer, context: MapExportAttributionContext): Promise<string> {
  const fail = (): never => { throw new MapImageExportError('attribution-failed'); };
  const check = (): void => {
    let valid = false;
    try { valid = !context.signal?.aborted && context.current(); } catch { /* A failed owner check cancels collection. */ }
    if (!valid || context.signal?.aborted) throw new MapImageExportError('cancelled');
  };
  const read = (value: unknown, key: PropertyKey): unknown => {
    check();
    if (!value || typeof value !== 'object') return fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key); check();
    if (descriptor && !Object.hasOwn(descriptor, 'value')) return fail();
    return descriptor?.value;
  };
  const credits: string[] = [];
  let size = 0;
  const credit = (value: unknown): void => {
    if (value === undefined) return;
    if (typeof value !== 'string') return fail();
    size += value.length; if (size > MAX_TEXT) return fail();
    if (value.trim() && !credits.includes(value)) credits.push(value);
  };
  try {
    check();
    const method = (name: 'getStyle' | 'getSource'): ((this: MapExportAttributionPeer, ...args: string[]) => unknown) => {
      const descriptor = getInheritedPropertyDescriptor(peer, name); check();
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function') return fail();
      return descriptor.value as (this: MapExportAttributionPeer, ...args: string[]) => unknown;
    };
    const getStyle = method('getStyle'), getSource = method('getSource');
    const style: unknown = getStyle.call(peer); check();
    const sources = read(style, 'sources');
    if (!sources || typeof sources !== 'object' || Array.isArray(sources)) return fail();
    const ids = Reflect.ownKeys(sources); check();
    if (ids.length > MAX_SOURCES) return fail();
    for (const id of ids) {
      if (typeof id !== 'string' || !id || id.length > 512) return fail();
      const source = read(sources, id);
      credit(read(source, 'attribution'));
      const resolved: unknown = getSource.call(peer, id); check();
      if (!resolved || typeof resolved !== 'object') return fail();
      credit(read(resolved, 'attribution'));
    }
    const custom = context.customAttribution; check();
    if (Array.isArray(custom)) {
      const length = read(custom, 'length');
      if (typeof length !== 'number' || length > MAX_SOURCES) return fail();
      for (let i = 0; i < length; i++) { const value = read(custom, String(i)); if (value === undefined) return fail(); credit(value); }
    } else credit(custom);
    const output: string[] = [];
    let sanitizer: HtmlSanitizer | null | undefined;
    for (const value of credits) {
      let text = value;
      if (/[<&]/.test(value)) {
        if (sanitizer === undefined) { sanitizer = await (context.loadSanitizer?.() ?? loadDompurify()); check(); }
        if (!sanitizer || typeof sanitizer.sanitize !== 'function') return fail();
        const clean: unknown = sanitizer.sanitize(value); check();
        if (typeof clean !== 'string') return fail();
        const detached = context.document.createElement('template'); check();
        detached.innerHTML = clean; check();
        text = detached.content.textContent ?? ''; check();
        if (value.trim() && !text.trim()) return fail();
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text && !output.includes(text)) output.push(text);
    }
    const result = output.join(' | '); if (result.length > MAX_TEXT) return fail();
    check(); return result;
  } catch (error) {
    check();
    if (error instanceof MapImageExportError) throw error;
    return fail();
  }
}
