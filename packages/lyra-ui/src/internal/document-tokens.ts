import {
  DOCUMENT_TOKEN_CSS,
  DOCUMENT_TOKEN_LAYER_ID,
  DOCUMENT_TOKEN_SCOPE_SELECTOR,
  DOCUMENT_TOKEN_SENTINEL,
} from './document-tokens.generated.js';
import { isRegisteredLyraElement } from './prefix.js';

/**
 * Delivery of the document token layer (RFC 0002). The shared --lr-* outputs are declared once per
 * tree scope that needs them, by one constructed stylesheet per document, instead of on every
 * component host:
 *
 * 1. The document. Every Lyra connect makes sure the layer is adopted into its owner document,
 *    synchronously and before the first update, and re-adopts it when an application replaced
 *    `adoptedStyleSheets` wholesale. The layer declares a content hash as a private sentinel on
 *    :root. A document whose root already resolves this exact value (it links `tokens-root.css`,
 *    or another copy of the same release adopted it first) keeps that copy and adopts no second
 *    one; a different value means a different layer, so this copy appends its own and the later
 *    one wins.
 * 2. An application shadow root, on demand. Selectors do not cross shadow boundaries, so a theme
 *    scope inside an application's shadow root only works if the layer is adopted there. It is,
 *    when a connecting Lyra element is a scope or sits below one in that root. Library components'
 *    own roots never receive it: none of their templates contains a scope.
 * 3. Explicitly, through the public `adoptLyraTokens()`.
 */

interface DocumentLayerState {
  /** Shared by the document and every shadow root of that document that adopts the layer. */
  sheet?: CSSStyleSheet;
  /** An identical layer already applies at document scope (a linked tokens-root.css). */
  readonly linked: boolean;
  /** The sentinel value found before the first adoption, when it named a different layer. */
  readonly foreignLayer?: string;
}

const documentStates = new WeakMap<Document, DocumentLayerState>();
const libraryRoots = new WeakMap<ShadowRoot, boolean>();

function layerState(doc: Document): DocumentLayerState | undefined {
  const known = documentStates.get(doc);
  if (known) return known;
  // A document without a browsing context (a template's, or one made by DOMParser) cannot construct
  // stylesheets. It is skipped, and checked again when the element connects to a real document.
  const view = doc.defaultView;
  if (!view || typeof view.CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in doc)) return undefined;
  // One computed-style read per document, before anything is adopted.
  let found = '';
  const root = doc.documentElement;
  if (root) {
    try {
      found = view.getComputedStyle(root).getPropertyValue(DOCUMENT_TOKEN_SENTINEL).trim();
    } catch {
      found = '';
    }
  }
  const linked = found === DOCUMENT_TOKEN_LAYER_ID;
  const state: DocumentLayerState = found && !linked ? { linked, foreignLayer: found } : { linked };
  documentStates.set(doc, state);
  return state;
}

function layerSheet(doc: Document, state: DocumentLayerState): CSSStyleSheet {
  if (!state.sheet) {
    // Constructed through the document's own realm: a sheet made in another document cannot be
    // adopted, and an element moved into an iframe has to get the iframe's own copy.
    const sheet = new doc.defaultView!.CSSStyleSheet();
    sheet.replaceSync(DOCUMENT_TOKEN_CSS);
    state.sheet = sheet;
  }
  return state.sheet;
}

function adopt(root: Document | ShadowRoot, sheet: CSSStyleSheet): void {
  const sheets = root.adoptedStyleSheets;
  if (sheets.includes(sheet)) return;
  // Appended, never replacing: the array belongs to the application.
  root.adoptedStyleSheets = [...sheets, sheet];
}

function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node && (node as ShadowRoot).host !== null;
}

function isLibraryRoot(root: ShadowRoot): boolean {
  let known = libraryRoots.get(root);
  if (known === undefined) {
    known = isRegisteredLyraElement(root.host);
    libraryRoots.set(root, known);
  }
  return known;
}

/**
 * Adopts the layer where `element` needs it: its document always, and each enclosing application
 * shadow root in which `element`, or the host it belongs to, is a theme scope or sits below one.
 *
 * @internal Called by `LyraElement` on connect and when one of its own scope attributes changes.
 */
export function ensureLyraTokens(element: Element): void {
  shareAdopter();
  const doc = element.ownerDocument;
  const state = layerState(doc);
  if (!state) return;
  if (!state.linked) adopt(doc, layerSheet(doc, state));
  let node: Element = element;
  for (let root = node.getRootNode(); isShadowRoot(root); root = node.getRootNode()) {
    if (isLibraryRoot(root)) return;
    if (node.closest(DOCUMENT_TOKEN_SCOPE_SELECTOR)) adopt(root, layerSheet(doc, state));
    node = root.host;
  }
}

const ADOPTER_KEY = Symbol.for('@aceshooting/lyra-ui.adopt-lyra-tokens.v1');
let adopterShared = false;

/**
 * Publishes `adoptLyraTokens` on a shared symbol, on the first connect rather than at import, so
 * `applyLyraStyleScope()` (theme.js, which imports nothing) can adopt the layer into the shadow root
 * of an element it turns into a scope. The first copy to connect wins; every copy adopts the same
 * vocabulary into a root.
 */
function shareAdopter(): void {
  if (adopterShared) return;
  adopterShared = true;
  const scope = globalThis as unknown as Record<symbol, unknown>;
  if (typeof scope[ADOPTER_KEY] === 'function') return;
  try {
    Object.defineProperty(scope, ADOPTER_KEY, { configurable: true, enumerable: false, writable: false, value: adoptLyraTokens });
  } catch {
    // A frozen global keeps explicit adoption working; only the theme.js convenience is lost.
  }
}

function documentOf(root: Document | ShadowRoot): Document {
  return root.nodeType === 9 ? (root as Document) : (root as ShadowRoot).ownerDocument;
}

/** True when the layer applies at `root`'s own scope (adopted there, or linked statically). */
export function hasLyraTokens(root: Document | ShadowRoot): boolean {
  const doc = documentOf(root);
  const state = documentStates.get(doc);
  if (!state) return false;
  if (root === doc && state.linked) return true;
  return !!state.sheet && root.adoptedStyleSheets.includes(state.sheet);
}

/**
 * Adopts the document token layer into `root`. Idempotent. Needed only for a shadow root whose
 * theme scopes appear after its Lyra elements connected, a root that has scopes but no Lyra element
 * yet, or a document (an iframe) that holds application elements only. A document that links
 * `tokens-root.css` keeps the static copy. Does nothing during server rendering.
 */
export function adoptLyraTokens(root: Document | ShadowRoot): void {
  if (typeof document === 'undefined' || !root) return;
  const doc = documentOf(root);
  const state = layerState(doc);
  if (!state) return;
  if (root === doc) {
    if (!state.linked) adopt(doc, layerSheet(doc, state));
  } else if (isShadowRoot(root)) {
    adopt(root, layerSheet(doc, state));
  }
}

/**
 * The sentinel of a different token layer found in `doc` before this copy adopted its own, if any.
 *
 * @internal Read by the development diagnostic.
 */
export function foreignLyraTokenLayer(doc: Document): string | undefined {
  return documentStates.get(doc)?.foreignLayer;
}
