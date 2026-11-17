import { LYRA_PACKAGE_NAME, LYRA_PACKAGE_VERSION } from './package-metadata.js';

// This marker shares diagnostic data only. Overlay/resource ownership remains module-local.
const markerKey = Symbol.for('@aceshooting/lyra-ui.document-runtime-diagnostics.v1');
const runtimeToken = Symbol();
const claimedDocuments = new WeakSet<Document>();

function warn(message: string): void {
  try {
    console.warn(message);
  } catch {
    // A consumer's logger must not interrupt component connection or resource acquisition.
  }
}

function unavailable(): void {
  warn(`[lr-runtime-diagnostic-unavailable] Cannot check ${LYRA_PACKAGE_NAME} runtime copies in this document. ` +
    'Resolve all public imports and lazy chunks from one application package context; ' +
    'overlay coordination still requires one runtime.');
}

/** Claims actual document use, without reading browser globals or coordinating runtime state. */
export function claimDocumentRuntime(document: Document): void {
  if (claimedDocuments.has(document)) return;
  // Before descriptor traps or console hooks can reenter, including the unavailable path.
  claimedDocuments.add(document);
  try {
    const descriptor = Object.getOwnPropertyDescriptor(document, markerKey);
    if (!descriptor) {
      const marker = Object.preventExtensions(Object.defineProperties(Object.create(null) as object, {
        schema: { value: 1 },
        token: { value: runtimeToken },
        version: { value: LYRA_PACKAGE_VERSION },
        warned: { value: false, writable: true },
      }));
      Object.defineProperty(document, markerKey, { value: marker });
      return;
    }

    // Do not invoke getters or coerce foreign values. An incompatible marker is never replaced.
    const marker: unknown = descriptor.value;
    if (!('value' in descriptor) || descriptor.configurable || descriptor.writable ||
      descriptor.enumerable || marker === null || typeof marker !== 'object') {
      unavailable();
      return;
    }
    const schema = Object.getOwnPropertyDescriptor(marker, 'schema');
    const token = Object.getOwnPropertyDescriptor(marker, 'token');
    const version = Object.getOwnPropertyDescriptor(marker, 'version');
    const warned = Object.getOwnPropertyDescriptor(marker, 'warned');
    const immutable = (field: PropertyDescriptor | undefined): boolean =>
      !!field && 'value' in field && !field.writable && !field.configurable;
    if (!immutable(schema) || schema?.value !== 1 ||
      !immutable(token) || typeof token?.value !== 'symbol' ||
      !immutable(version) || typeof version?.value !== 'string' ||
      !/^[\dA-Za-z.+-]{1,128}$/u.test(version.value) ||
      !warned || !('value' in warned) || typeof warned.value !== 'boolean' ||
      !warned.writable || warned.configurable || Object.isExtensible(marker)) {
      unavailable();
      return;
    }
    if (token.value === runtimeToken || warned.value) return;
    // Mark first: reentrant use from another copy must not repeat this diagnostic.
    Object.defineProperty(marker, 'warned', { value: true });
    warn(`[lr-runtime-duplicate] Multiple ${LYRA_PACKAGE_NAME} runtime copies are active in one document ` +
      `(versions: ${version.value}, ${LYRA_PACKAGE_VERSION}). Overlay coordination requires one application-owned runtime. ` +
      `Resolve all ${LYRA_PACKAGE_NAME} public imports, including lazy chunks, from the same application package context; ` +
      'matching versions alone is insufficient. See the imports and registration guide.');
  } catch {
    unavailable();
  }
}
