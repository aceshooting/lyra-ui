const scopes = new WeakMap<Document, object>();

/** A shared lease key with no backreference to its document. */
export function xrDocumentScope(document: Document): object {
  let scope = scopes.get(document);
  if (!scope) { scope = Object.freeze({}); scopes.set(document, scope); }
  return scope;
}
