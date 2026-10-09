import {
  DOCUMENT_TOKEN_CSS,
  DOCUMENT_TOKEN_LAYER_ID,
  DOCUMENT_TOKEN_SCOPE_SELECTOR,
  DOCUMENT_TOKEN_SENTINEL,
} from './document-tokens.generated.js';
import { isRegisteredLyraElement } from './prefix.js';

/**
 * Delivery of the document token layer (RFC 0002). The shared --lr-* outputs are declared once per
 * tree scope that needs them instead of on every component host.
 *
 * **Providers.** A tree scope (a document or an application shadow root) gets the layer from one
 * provider: a static stylesheet that carries it (`theme.css` or `tokens-root.css`, linked or
 * imported, or a `<link>` inside a declarative shadow root), another Lyra copy's adopted sheet with
 * the same content hash, or this copy's own constructed sheet. A provider is identified by its sheet
 * object, found by reading the tail of each stylesheet for the layer's sentinel, and re-validated
 * cheaply (still adopted, or owner node still connected and enabled) instead of being assumed
 * present for the life of the page. When the provider disappears, the constructed copy is adopted;
 * when a static provider turns up after the constructed copy went in (a stylesheet that loaded
 * late), the constructed copy is withdrawn. Only this copy's own sheet is ever removed.
 *
 * **When.** At registration (`primeLyraTokens()`, from `customElements.define()`); on every Lyra
 * connect, synchronously and before the first update, at most once per tree scope per microtask
 * checkpoint; once after the document's `load` event, to find a static provider that was still
 * loading; and through the public `adoptLyraTokens()`, which always looks again.
 *
 * **Application shadow roots** receive the layer on demand: when a connecting Lyra element is a
 * scope or sits below one in that root, unless the root holds its own static provider. Library
 * components' own roots never receive it: none of their templates contains a scope.
 *
 * **Several copies of Lyra.** A copy whose layer has the same content hash reuses whichever provider
 * is present. A copy with a different layer adopts its own sheet, which comes later and wins where
 * values differ (the development build warns). The shared adopter that `applyLyraStyleScope()`
 * calls belongs to the copy whose layer was adopted last, for the same reason.
 */

interface ScopeState {
  /** A provider other than this copy's constructed sheet, while it is known to apply. */
  provider?: CSSStyleSheet;
}

interface DocumentLayerState extends ScopeState {
  /** This copy's constructed sheet, shared by the document and its shadow roots. */
  sheet?: CSSStyleSheet;
  /** The sentinel resolves to this layer, from a sheet whose rules cannot be read (cross-origin). */
  unreadableProvider: boolean;
  /** The sentinel value found before the first adoption, when it named a different layer. */
  foreignLayer?: string;
  /** A static provider was found after the constructed copy had been adopted. */
  arrivedLate: boolean;
}

const documentStates = new WeakMap<Document, DocumentLayerState>();
const rootStates = new WeakMap<ShadowRoot, ScopeState>();
/** Tree scopes already verified since the last microtask checkpoint. */
const verifiedSinceCheckpoint = new WeakSet<Document | ShadowRoot>();
/** Whether a sheet carries this layer; sheets are read once (a reloaded link is a new object). */
const carrierCache = new WeakMap<CSSStyleSheet, boolean>();
const libraryRoots = new WeakMap<ShadowRoot, boolean>();
const SENTINEL_TEXT = `${DOCUMENT_TOKEN_SENTINEL}:${DOCUMENT_TOKEN_LAYER_ID}`;

function onceSinceCheckpoint(scope: Document | ShadowRoot): boolean {
  if (verifiedSinceCheckpoint.has(scope)) return false;
  verifiedSinceCheckpoint.add(scope);
  // A batch insert connects every element before the next checkpoint; reading the style sheet lists
  // (observable arrays in WebKit) for each of them would be wasted work.
  queueMicrotask(() => verifiedSinceCheckpoint.delete(scope));
  return true;
}

/** True when a rule declares this layer's sentinel; the layer puts it first in its last @layer block. */
function declaresSentinel(rule: CSSRule): boolean {
  const nested = (rule as CSSGroupingRule).cssRules;
  const text = nested && nested.length ? nested[0]!.cssText : rule.cssText;
  return (text ?? '').replace(/\s+/g, '').includes(SENTINEL_TEXT);
}

/** True when `sheet` (or a sheet it imports) carries this layer. Unreadable sheets do not. */
function carriesLayer(sheet: CSSStyleSheet, depth = 0): boolean {
  const known = carrierCache.get(sheet);
  if (known !== undefined) return known;
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    return false; // cross-origin, or still loading: not cached, so a later look can succeed
  }
  let found = false;
  // The layer is the tail of theme.css and tokens-root.css: its sentinel opens the last @layer block.
  for (let index = rules.length - 1; !found && index >= Math.max(0, rules.length - 3); index--) {
    found = declaresSentinel(rules[index]!);
  }
  for (let index = 0; !found && depth < 3 && index < rules.length; index++) {
    const rule = rules[index] as CSSImportRule;
    if (rule.type !== 3) break; // @import rules come first
    if (rule.styleSheet) found = carriesLayer(rule.styleSheet, depth + 1);
  }
  carrierCache.set(sheet, found);
  return found;
}

/** The outermost sheet of an imported one: the one an owner node or an adopted list holds. */
function topSheet(sheet: CSSStyleSheet): CSSStyleSheet {
  let current = sheet;
  while (current.parentStyleSheet) current = current.parentStyleSheet;
  return current;
}

/** A static sheet applies: owner connected, enabled, not limited to a non-screen medium. */
function staticSheetApplies(sheet: CSSStyleSheet): boolean {
  if (sheet.disabled) return false;
  const owner = sheet.ownerNode;
  if (!owner || !owner.isConnected) return false;
  const media = sheet.media?.mediaText.trim() ?? '';
  return media === '' || media === 'all' || /\bscreen\b/.test(media);
}

function providerApplies(scope: Document | ShadowRoot, provider: CSSStyleSheet): boolean {
  const top = topSheet(provider);
  return top.ownerNode ? staticSheetApplies(top) : scope.adoptedStyleSheets.includes(top);
}

/** Finds a provider of this layer in a tree scope, other than `own`. Reads no computed style. */
function findProvider(scope: Document | ShadowRoot, own: CSSStyleSheet | undefined): CSSStyleSheet | undefined {
  const linked = scope.styleSheets;
  for (let index = linked.length - 1; index >= 0; index--) {
    const sheet = linked[index] as CSSStyleSheet;
    if (staticSheetApplies(sheet) && carriesLayer(sheet)) return sheet;
  }
  const adopted = scope.adoptedStyleSheets;
  for (let index = adopted.length - 1; index >= 0; index--) {
    const sheet = adopted[index]!;
    if (sheet !== own && carriesLayer(sheet)) return sheet;
  }
  return undefined;
}

function layerState(doc: Document): DocumentLayerState | undefined {
  const known = documentStates.get(doc);
  if (known) return known;
  // A document without a browsing context (a template's, or one made by DOMParser) cannot construct
  // stylesheets. It is skipped, and checked again when the element connects to a real document.
  const view = doc.defaultView;
  if (!view || typeof view.CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in doc)) return undefined;
  const state: DocumentLayerState = { unreadableProvider: false, arrivedLate: false };
  state.provider = findProvider(doc, undefined);
  if (!state.provider) {
    // One computed-style read per document, before anything is adopted: a provider whose rules
    // cannot be read (a cross-origin stylesheet), or a different layer from another release.
    let found = '';
    try {
      if (doc.documentElement) found = view.getComputedStyle(doc.documentElement).getPropertyValue(DOCUMENT_TOKEN_SENTINEL).trim();
    } catch {
      found = '';
    }
    if (found === DOCUMENT_TOKEN_LAYER_ID) state.unreadableProvider = true;
    else if (found) state.foreignLayer = found;
  }
  documentStates.set(doc, state);
  if (doc.readyState !== 'complete') {
    // A stylesheet that was still loading (async CSS, a module script that did not wait for it,
    // CSS injected by a bundler) is looked for once more when the document has loaded.
    view.addEventListener('load', () => verifyDocument(doc, state, true), { once: true });
  }
  return state;
}

function layerSheet(doc: Document, state: DocumentLayerState): CSSStyleSheet {
  if (!state.sheet) {
    // Constructed through the document's own realm: a sheet made in another document cannot be
    // adopted, and an element moved into an iframe has to get the iframe's own copy.
    const sheet = new doc.defaultView!.CSSStyleSheet();
    sheet.replaceSync(DOCUMENT_TOKEN_CSS);
    carrierCache.set(sheet, true);
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

/** Removes this copy's own sheet from a tree scope; never touches an application sheet. */
function withdraw(root: Document | ShadowRoot, sheet: CSSStyleSheet | undefined): boolean {
  if (!sheet) return false;
  const sheets = root.adoptedStyleSheets;
  if (!sheets.includes(sheet)) return false;
  root.adoptedStyleSheets = sheets.filter((entry) => entry !== sheet);
  return true;
}

/**
 * Leaves the document with exactly one provider of this layer. `rescan` also looks for a provider
 * that appeared since the last look (the `load` check and explicit adoption).
 */
function verifyDocument(doc: Document, state: DocumentLayerState, rescan: boolean): void {
  if (state.provider && !providerApplies(doc, state.provider)) state.provider = undefined;
  if (!state.provider && rescan) state.provider = findProvider(doc, state.sheet);
  if (state.provider) {
    if (withdraw(doc, state.sheet)) state.arrivedLate = true;
    return;
  }
  // A provider that cannot be read cannot be validated either; it is trusted until the page adopts
  // this copy's sheet for another reason.
  if (state.unreadableProvider && !state.sheet) return;
  adopt(doc, layerSheet(doc, state));
}

function verifyRoot(root: ShadowRoot, doc: Document, state: DocumentLayerState): void {
  let local = rootStates.get(root);
  if (!local) rootStates.set(root, (local = {}));
  if (local.provider && !providerApplies(root, local.provider)) local.provider = undefined;
  // A declarative root's own <link> may finish loading after the first connect, so look each time;
  // the carrier cache keeps that to reading list lengths.
  if (!local.provider) local.provider = findProvider(root, state.sheet);
  if (local.provider) withdraw(root, state.sheet);
  else adopt(root, layerSheet(doc, state));
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
  if (onceSinceCheckpoint(doc)) verifyDocument(doc, state, false);
  let node: Element = element;
  for (let root = node.getRootNode(); isShadowRoot(root); root = node.getRootNode()) {
    if (isLibraryRoot(root)) return;
    if (!verifiedSinceCheckpoint.has(root) && node.closest(DOCUMENT_TOKEN_SCOPE_SELECTOR)) {
      onceSinceCheckpoint(root);
      verifyRoot(root, doc, state);
    }
    node = root.host;
  }
}

let primed = false;

/**
 * Adopts the layer into the global document when the first Lyra class is registered, unless a
 * static provider already carries it. Registration often happens while an application's document
 * is still small (before a client-rendered app renders). A deferred module on a large
 * server-rendered page, or a lazily loaded route, registers later and then pays a one-off
 * whole-document invalidation unless the page links `theme.css` or `tokens-root.css`. Does nothing
 * without a browsing context (server rendering).
 *
 * @internal Called by `LyraElement.observedAttributes`, which `customElements.define()` reads.
 */
export function primeLyraTokens(): void {
  if (primed || typeof document === 'undefined') return;
  primed = true;
  const doc = document;
  const state = layerState(doc);
  if (state && onceSinceCheckpoint(doc)) verifyDocument(doc, state, false);
}

const ADOPTER_KEY = Symbol.for('@aceshooting/lyra-ui.adopt-lyra-tokens.v1');
let adopterShared = false;
type SharedAdopter = ((root: Document | ShadowRoot) => void) & { readonly layerId?: string };

/**
 * Publishes `adoptLyraTokens` on a shared symbol, on the first connect rather than at import, so
 * `applyLyraStyleScope()` (theme.js, which imports nothing) can adopt the layer into the shadow root
 * of an element it turns into a scope. Ownership policy: a copy with the same layer leaves the
 * published adopter alone (it adopts the same text); a copy with a different layer replaces it,
 * because its own sheet is adopted later and is the one that wins.
 */
function shareAdopter(): void {
  if (adopterShared) return;
  adopterShared = true;
  const scope = globalThis as unknown as Record<symbol, unknown>;
  const existing = scope[ADOPTER_KEY] as SharedAdopter | undefined;
  if (typeof existing === 'function' && existing.layerId === DOCUMENT_TOKEN_LAYER_ID) return;
  const adopter: SharedAdopter = Object.assign((root: Document | ShadowRoot) => adoptLyraTokens(root), { layerId: DOCUMENT_TOKEN_LAYER_ID });
  try {
    Object.defineProperty(scope, ADOPTER_KEY, { configurable: true, enumerable: false, writable: false, value: adopter });
  } catch {
    // A frozen global keeps explicit adoption working; only the theme.js convenience is lost.
  }
}

function documentOf(root: Document | ShadowRoot): Document {
  return root.nodeType === 9 ? (root as Document) : (root as ShadowRoot).ownerDocument;
}

/** True when the layer applies at `root`'s own scope (adopted there, or provided statically). */
export function hasLyraTokens(root: Document | ShadowRoot): boolean {
  const doc = documentOf(root);
  const state = documentStates.get(doc);
  if (!state) return false;
  const local = root === doc ? state : rootStates.get(root as ShadowRoot);
  if (local?.provider && providerApplies(root, local.provider)) return true;
  if (root === doc && state.unreadableProvider && !state.sheet) return true;
  return !!state.sheet && root.adoptedStyleSheets.includes(state.sheet);
}

/**
 * Adopts the document token layer into `root`, or confirms that a stylesheet already provides it
 * there. Idempotent, and it always looks again, so it also repairs a root whose provider was
 * removed and withdraws this copy's sheet where a static provider arrived later. Needed for a
 * shadow root whose theme scopes appear after its Lyra elements connected, a root that has scopes
 * but no Lyra element yet, or a document (an iframe) that holds application elements only. Does
 * nothing during server rendering.
 */
export function adoptLyraTokens(root: Document | ShadowRoot): void {
  if (typeof document === 'undefined' || !root) return;
  const doc = documentOf(root);
  const state = layerState(doc);
  if (!state) return;
  if (root === doc) verifyDocument(doc, state, true);
  else if (isShadowRoot(root)) verifyRoot(root, doc, state);
}

/**
 * The sentinel of a different token layer found in `doc` before this copy adopted its own, if any.
 *
 * @internal Read by the development diagnostic.
 */
export function foreignLyraTokenLayer(doc: Document): string | undefined {
  return documentStates.get(doc)?.foreignLayer;
}

/**
 * True when a static provider of the layer appeared after this copy had adopted its own (which was
 * then withdrawn): the page should load `theme.css` before Lyra registers.
 *
 * @internal Read by the development diagnostic.
 */
export function lyraTokenLayerArrivedLate(doc: Document): boolean {
  return documentStates.get(doc)?.arrivedLate ?? false;
}
