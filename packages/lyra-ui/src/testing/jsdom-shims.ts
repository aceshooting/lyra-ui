/**
 * Opt-in shims for a downstream consumer's own jsdom test suite (Vitest or Jest with the jsdom
 * environment). Not used by this package's own tests, which run in real browsers.
 *
 * jsdom implements no `adoptedStyleSheets`, so Lit falls back to rendering one `<style>` element
 * per component shadow root. jsdom then registers every one of those sheets on the owner document
 * (it does not scope them to the shadow root), and each `getComputedStyle()` call matches the
 * element against every rule of every sheet. A page with a few hundred Lyra elements therefore
 * makes each computed-style read cost tens to hundreds of milliseconds, and a test that renders
 * many components spends most of its time there. Those sheets also never applied correctly: jsdom
 * cascades them globally instead of per shadow root.
 *
 * Install the shims once, in a `setupFiles` entry, before anything imports Lit or a Lyra
 * component: Lit decides at module evaluation whether it can adopt stylesheets. Importing
 * `@aceshooting/lyra-ui/testing` itself does not load Lit.
 */

/** Overridable environment for {@link installJsdomAdoptedStyleSheetsShim}; each entry defaults to the global. */
export interface JsdomAdoptedStyleSheetsTargets {
  /** Defaults to `Document.prototype`. */
  documentPrototype?: object;
  /** Defaults to `ShadowRoot.prototype`. */
  shadowRootPrototype?: object;
  /** Defaults to `CSSStyleSheet.prototype`. */
  styleSheetPrototype?: object;
  /** Defaults to a check for jsdom's `navigator.userAgent` signature (`jsdom/<version>`). */
  isJsdom?: () => boolean;
}

interface SheetTextMethods {
  replaceSync?: (text: string) => void;
  replace?: (text: string) => Promise<unknown>;
}

const INSTALLED = Symbol.for('lyra-ui.testing.jsdom-adopted-style-sheets');
const SHEET_TEXT = Symbol.for('lyra-ui.testing.jsdom-adopted-style-sheets.text');

function runningUnderJsdom(): boolean {
  try {
    return /\bjsdom\//.test(globalThis.navigator?.userAgent ?? '');
  } catch {
    return false;
  }
}

/**
 * Gives jsdom an inert `adoptedStyleSheets` on `Document` and `ShadowRoot`, so Lit adopts each
 * component's constructed stylesheet instead of appending a `<style>` element per shadow root.
 * Adopted sheets are stored and returned (the same array instance until it is reassigned, so
 * `push()` persists) but never applied: `getComputedStyle()` sees only the document's own sheets
 * and inline styles, which is all jsdom could cascade correctly in the first place. Assert
 * behaviour and DOM, not component styling, under jsdom.
 *
 * jsdom releases without `CSSStyleSheet.prototype.replace()`/`replaceSync()` (which Lit also
 * requires) get inert versions that record the text and leave the sheet's rules untouched.
 *
 * Installs only under jsdom (detected from its `navigator.userAgent` signature) and only while
 * `adoptedStyleSheets` is missing, so it is a no-op in every browser, under Happy DOM and in a
 * plain Node project that shares the setup file. Installs once and returns a function that
 * removes everything it added.
 */
export function installJsdomAdoptedStyleSheetsShim(targets: JsdomAdoptedStyleSheetsTargets = {}): () => void {
  const documentPrototype = targets.documentPrototype ?? globalThis.Document?.prototype;
  const shadowRootPrototype = targets.shadowRootPrototype ?? globalThis.ShadowRoot?.prototype;
  const sheetPrototype = (targets.styleSheetPrototype ?? globalThis.CSSStyleSheet?.prototype) as
    (SheetTextMethods & { [INSTALLED]?: boolean }) | undefined;
  const isJsdom = targets.isJsdom ?? runningUnderJsdom;
  if (!documentPrototype || !shadowRootPrototype || !sheetPrototype) return () => {};
  if (sheetPrototype[INSTALLED] || 'adoptedStyleSheets' in documentPrototype || !isJsdom()) return () => {};

  const adopted = new WeakMap<object, unknown[]>();
  const descriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: true,
    get(this: object): unknown[] {
      let sheets = adopted.get(this);
      if (!sheets) adopted.set(this, (sheets = []));
      return sheets;
    },
    set(this: object, value: Iterable<unknown> | ArrayLike<unknown>): void {
      if (value == null || typeof value !== 'object') {
        throw new TypeError('adoptedStyleSheets must be set to an array of CSSStyleSheet objects.');
      }
      adopted.set(this, Array.from(value));
    },
  };
  const patched: object[] = [];
  for (const proto of [documentPrototype, shadowRootPrototype]) {
    if (Object.hasOwn(proto, 'adoptedStyleSheets')) continue;
    Object.defineProperty(proto, 'adoptedStyleSheets', descriptor);
    patched.push(proto);
  }

  const added: (keyof SheetTextMethods)[] = [];
  if (typeof sheetPrototype.replaceSync !== 'function') {
    sheetPrototype.replaceSync = function (this: Record<symbol, unknown>, text: string): void {
      this[SHEET_TEXT] = String(text);
    };
    added.push('replaceSync');
  }
  if (typeof sheetPrototype.replace !== 'function') {
    sheetPrototype.replace = function (this: Record<symbol, unknown> & SheetTextMethods, text: string): Promise<unknown> {
      try {
        this.replaceSync!(text);
      } catch (error) {
        return Promise.reject(error);
      }
      return Promise.resolve(this);
    };
    added.push('replace');
  }
  sheetPrototype[INSTALLED] = true;

  return () => {
    for (const proto of patched) delete (proto as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
    for (const name of added) delete sheetPrototype[name];
    delete sheetPrototype[INSTALLED];
  };
}

/**
 * Installs every jsdom shim this package ships (currently {@link installJsdomAdoptedStyleSheetsShim}).
 * A no-op outside jsdom. Call it from a `setupFiles` entry before anything imports Lit.
 */
export function installJsdomShims(): () => void {
  return installJsdomAdoptedStyleSheetsShim();
}
