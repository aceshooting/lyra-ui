import type { DocxImageMetadata } from './image-bytes.js';
import { inspectDocxImage } from './image-bytes.js';
import { isDocxXmlText } from './xml-text.js';
import type { DocxInsertImageOptions, DocxResult } from './types.js';

export interface OwnedDocxImageInput {
  readonly bytes: Uint8Array;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly title: string;
  readonly description: string;
  readonly metadata: Readonly<DocxImageMetadata>;
}
interface NormalizedImageInsertion {
  readonly source: OwnedDocxImageInput;
  readonly options: Readonly<DocxInsertImageOptions>;
}

const ownKeys = Reflect.ownKeys;
const getPrototypeOf = Object.getPrototypeOf;
const descriptor = Object.getOwnPropertyDescriptor;
const apply = Reflect.apply;
const NativeBytes = Uint8Array;
const byteSet = Uint8Array.prototype.set;
const typed = getPrototypeOf(Uint8Array.prototype);
const typedGetter = (key: PropertyKey) => descriptor(typed, key)!.get!;
const byteKind = typedGetter(Symbol.toStringTag), byteBuffer = typedGetter('buffer');
const byteOffset = typedGetter('byteOffset'), byteLength = typedGetter('byteLength');
const bufferLength = descriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const bufferResizable = descriptor(ArrayBuffer.prototype, 'resizable')?.get;
const aborted = descriptor(AbortSignal.prototype, 'aborted')!.get!;
const listen = EventTarget.prototype.addEventListener, unlisten = EventTarget.prototype.removeEventListener;
const invalid = (): DocxResult<never> => ({ ok: false, code: 'invalid-option' });

/** Native accessors deliberately ignore any caller-defined signal members. */
export function imageInsertionAborted(signal: AbortSignal): boolean { return apply(aborted, signal, []); }
export function listenImageInsertionAbort(signal: AbortSignal, listener: () => void): () => void {
  apply(listen, signal, ['abort', listener, { once: true }]);
  return () => { apply(unlisten, signal, ['abort', listener]); };
}

/** Reflection is sequenced under the original insertion owner. */
export function normalizeImageInsertion(source: unknown, options: unknown,
  validate: () => DocxResult<void>, acceptOptions: (options: Readonly<DocxInsertImageOptions>) => DocxResult<void> = validate
): DocxResult<NormalizedImageInsertion> {
  const data = (value: unknown, allowed: readonly string[]): DocxResult<Record<string, unknown>> => {
    const initial = validate(); if (!initial.ok) return initial;
    if (!value || typeof value !== 'object') return invalid();
    const prototype = getPrototypeOf(value), afterPrototype = validate();
    if (!afterPrototype.ok) return afterPrototype;
    if (prototype !== Object.prototype && prototype !== null) return invalid();
    const keys = ownKeys(value), afterKeys = validate();
    if (!afterKeys.ok) return afterKeys;
    if (keys.length > allowed.length || keys.some(key => typeof key !== 'string' || !allowed.includes(key))) return invalid();
    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const property = descriptor(value, key), afterProperty = validate();
      if (!afterProperty.ok) return afterProperty;
      if (!property || !Object.hasOwn(property, 'value')) return invalid();
      result[key as string] = property.value;
    }
    return { ok: true, value: result };
  };
  try {
    const checkedOptions = data(options, ['expectedRevision', 'selection', 'signal']);
    if (!checkedOptions.ok) return checkedOptions;
    const raw = checkedOptions.value;
    const normalized: { expectedRevision?: { documentId: string; value: number }; selection?: DocxInsertImageOptions['selection']; signal?: AbortSignal } = {};
    if (Object.hasOwn(raw, 'expectedRevision')) {
      const revision = data(raw.expectedRevision, ['documentId', 'value']);
      if (!revision.ok) return revision;
      const value = revision.value;
      if (typeof value.documentId !== 'string' || !value.documentId.length || value.documentId.length > 128 ||
          typeof value.value !== 'number' || !Number.isSafeInteger(value.value) || value.value < 0) return invalid();
      normalized.expectedRevision = Object.freeze({ documentId: value.documentId, value: value.value });
    }
    if (Object.hasOwn(raw, 'selection')) {
      if (!raw.selection || typeof raw.selection !== 'object') return invalid();
      normalized.selection = raw.selection as NonNullable<DocxInsertImageOptions['selection']>;
    }
    if (Object.hasOwn(raw, 'signal')) {
      if (apply(aborted, raw.signal, [])) return { ok: false, code: 'aborted' };
      normalized.signal = raw.signal as AbortSignal;
    }
    const copiedOptions = Object.freeze(normalized), authorized = acceptOptions(copiedOptions);
    if (!authorized.ok) return authorized;
    const checked = data(source, ['bytes', 'widthPoints', 'heightPoints', 'title', 'description']);
    if (!checked.ok) return checked;
    const input = checked.value;
    for (const key of ['widthPoints', 'heightPoints']) {
      const value = input[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 1440) return invalid();
    }
    for (const [key, maximum] of [['title', 256], ['description', 2048]] as const) {
      if (!Object.hasOwn(input, key)) input[key] = '';
      const value = input[key];
      if (typeof value !== 'string' || value.length > maximum || value.includes('\r') || !isDocxXmlText(value)) return invalid();
    }
    if (apply(byteKind, input.bytes, []) !== 'Uint8Array') return invalid();
    const buffer = apply(byteBuffer, input.bytes, []), offset = apply(byteOffset, input.bytes, []), length = apply(byteLength, input.bytes, []);
    apply(bufferLength, buffer, []);
    if (bufferResizable && apply(bufferResizable, buffer, [])) return invalid();
    const view = new NativeBytes(buffer, offset, length);
    if (length < 1 || length > 4 * 1024 * 1024) return { ok: false, code: 'resource-limit' };
    const bytes = new NativeBytes(length); apply(byteSet, bytes, [view]);
    const metadata = inspectDocxImage(bytes);
    if (!metadata.ok) return metadata;
    if (metadata.value.hasJpegApp1) return { ok: false, code: 'unsupported' };
    const final = validate(); if (!final.ok) return final;
    if (normalized.signal && imageInsertionAborted(normalized.signal)) return { ok: false, code: 'aborted' };
    return { ok: true, value: Object.freeze({ options: copiedOptions, source: Object.freeze({ bytes,
      widthPoints: input.widthPoints as number, heightPoints: input.heightPoints as number,
      title: input.title as string, description: input.description as string, metadata: Object.freeze({ ...metadata.value }) }) }) };
  } catch {
    const authority = validate();
    return authority.ok ? invalid() : authority;
  }
}
