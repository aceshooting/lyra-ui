/**
 * Opt-in shim for a downstream consumer's own Vitest+happy-dom test suite -- NOT used by this
 * package's own tests (which run against real browsers via `@web/test-runner`, where
 * `ElementInternals` already exists natively). happy-dom has no `ElementInternals`
 * implementation at all, and every form-associated `lr-*` component (`lr-switch`,
 * `lr-combobox`, `lr-select`, `lr-checkbox`, `lr-model-select`, `lr-time-range`,
 * `lr-tool-param-form`, plus anything built on the shared `FormAssociated` mixin) calls
 * `this.attachInternals()` unconditionally in its constructor, so instantiating any of them
 * under happy-dom throws immediately without this. The stub also implements `setValidity()`
 * as a no-op -- `AnchoredValidityController` (the shared validity-refresh controller every
 * form-associated component uses) calls `internals.setValidity()` on every update, which would
 * otherwise throw the moment any of those components' `value` changes, not just at construction.
 * `states` is a real `Set` -- several controls (e.g. `lr-input`) call
 * `internals.states.add('blank')`/`.delete('blank')` on every update to drive a custom-state
 * pseudo-class, which would otherwise throw on `add` of `undefined`.
 *
 * `attachInternals()` is specified on the `HTMLElement` interface (not `Element`), and every
 * `lr-*` component is an `HTMLElement` subclass (via `LitElement`), so this patches
 * `HTMLElement.prototype.attachInternals` -- the exact lookup `this.attachInternals()` resolves
 * through.
 *
 * Call `installHappyDomFormAssociatedShims()` once, in a Vitest `setupFiles` entry, before
 * importing any `lyra-ui` component. It is a no-op wherever `attachInternals` already exists
 * (any real browser, or an environment that already supports it) or where `HTMLElement` isn't
 * even a global (a plain Node test environment with no DOM at all) -- safe to call
 * unconditionally from a shared setup file used across multiple test environments/projects,
 * including ones that mix DOM and non-DOM test files under one `setupFiles` entry.
 */

interface StubValidityState {
  valid: boolean;
}

interface StubElementInternals {
  form: HTMLFormElement | null;
  labels: NodeList;
  states: Set<string>;
  validity: StubValidityState;
  validationMessage: string;
  willValidate: boolean;
  setFormValue(value: string | File | FormData | null, state?: string | FormData | null): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setValidity(flags?: Partial<ValidityStateFlags>, message?: string, anchor?: HTMLElement): void;
}

function createStubInternals(host: Element): StubElementInternals {
  return {
    // A live getter, not a value captured once here: a form-associated component calls
    // attachInternals() from its own constructor, which the platform always runs BEFORE the
    // element is inserted anywhere -- host.closest('form') at that instant can only ever see
    // null, even when the element is later appended into a real <form>. Snapshotting it here
    // would leave every such component's `internals.form` permanently null under this shim
    // regardless of where it actually ends up in the DOM -- silently breaking anything (like
    // `<lr-button>`) that resolves its submit target through `internals.form` rather than
    // `closest('form')`.
    get form(): HTMLFormElement | null {
      return host.closest('form');
    },
    labels: document.createDocumentFragment().querySelectorAll('label'),
    // `CustomStateSet` is Set-like (add/delete/has), which is the entire surface this library's
    // form-associated components call -- a real Set covers it without reimplementing the DOM type.
    states: new Set<string>(),
    validity: { valid: true },
    validationMessage: '',
    willValidate: true,
    setFormValue(): void {
      // Intentional no-op -- happy-dom has no real form-submission pipeline to feed.
    },
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
    setValidity(): void {
      // Intentional no-op -- happy-dom has no real constraint-validation pipeline to feed.
    },
  };
}

export function installHappyDomFormAssociatedShims(): void {
  if (typeof HTMLElement === 'undefined') return;
  if (typeof HTMLElement.prototype.attachInternals === 'function') return;
  HTMLElement.prototype.attachInternals = function attachInternals(): ElementInternals {
    return createStubInternals(this) as unknown as ElementInternals;
  };
}

interface ActiveElementHolder {
  activeElement: Element | null;
}

/** True when reading a sibling shadow root's `activeElement` throws, as in Happy DOM 20.14. */
function siblingActiveElementThrows(): boolean {
  const body = document.body;
  if (!body) return false;
  const previous = document.activeElement;
  const hosts = [document.createElement('div'), document.createElement('div')];
  const roots = hosts.map((host) => host.attachShadow({ mode: 'open' }));
  const button = document.createElement('button');
  roots[0]?.appendChild(button);
  hosts.forEach((host) => body.appendChild(host));
  try {
    button.focus();
    void (roots[1] as unknown as ActiveElementHolder).activeElement;
    return false;
  } catch {
    return true;
  } finally {
    button.blur();
    hosts.forEach((host) => host.remove());
    if (previous instanceof HTMLElement) previous.focus();
  }
}

function detachedActiveElementThrows(): boolean {
  const root = document.createElement('div').attachShadow({ mode: 'open' });
  try {
    void (root as unknown as ActiveElementHolder).activeElement;
    return false;
  } catch {
    return true;
  }
}

/**
 * Wraps `proto`'s `activeElement` getter so a TypeError (sibling or detached shadow root) reads as
 * `null`. Returns a restore function, or `undefined` when the getter already behaves.
 */
export function guardShadowActiveElement(proto: object, misbehaves: () => boolean): (() => void) | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'activeElement');
  const native = descriptor?.get;
  if (!descriptor || !native || !misbehaves()) return undefined;
  Object.defineProperty(proto, 'activeElement', {
    ...descriptor,
    get(this: unknown): Element | null {
      try {
        return native.call(this) as Element | null;
      } catch (error) {
        if (error instanceof TypeError) return null;
        throw error;
      }
    },
  });
  return () => Object.defineProperty(proto, 'activeElement', descriptor);
}

/**
 * Makes `ShadowRoot.activeElement` return `null` instead of throwing for a sibling or detached
 * shadow root (Happy DOM dereferences a missing host/focus node, e.g. during teardown while an
 * update is queued). Own-root and nested-root focus are untouched. No-op wherever the getter
 * already behaves; returns a function that restores the original descriptor.
 */
export function installHappyDomShadowFocusShim(): () => void {
  if (typeof ShadowRoot === 'undefined' || typeof document === 'undefined') return () => {};
  return guardShadowActiveElement(
    ShadowRoot.prototype,
    () => siblingActiveElementThrows() || detachedActiveElementThrows(),
  ) ?? (() => {});
}

function isInScope(source: Element, target: Element): boolean {
  const targetRoot = target.getRootNode();
  let root: Node | null = source.getRootNode();
  while (root) {
    if (root === targetRoot) return true;
    root = 'host' in root ? (root as ShadowRoot).host.getRootNode() : null;
  }
  return false;
}

/** Descriptor for `ariaControlsElements`: explicit references, else ids from `aria-controls`. */
export function createAriaControlsElementsDescriptor(): PropertyDescriptor {
  const explicit = new WeakMap<Element, { elements: Element[]; attr: string }>();
  return {
    configurable: true,
    enumerable: true,
    get(this: Element): readonly Element[] | null {
      const attr = this.getAttribute('aria-controls');
      if (attr === null) return null;
      const stored = explicit.get(this);
      if (stored && stored.attr === attr) {
        return stored.elements.filter((element) => isInScope(this, element));
      }
      const root = this.getRootNode() as Partial<Pick<Document, 'getElementById'>>;
      return attr
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => root.getElementById?.(id) ?? null)
        .filter((element): element is HTMLElement => element !== null);
    },
    set(this: Element, value: readonly Element[] | null | undefined) {
      if (value == null) {
        explicit.delete(this);
        this.removeAttribute('aria-controls');
        return;
      }
      this.setAttribute('aria-controls', '');
      explicit.set(this, { elements: Array.from(value), attr: '' });
    },
  };
}

/** Adds `Element.prototype.ariaControlsElements` only when the engine lacks it. */
export function installHappyDomAriaControlsShim(proto: object | undefined = globalThis.Element?.prototype): void {
  if (!proto || 'ariaControlsElements' in proto) return;
  Object.defineProperty(proto, 'ariaControlsElements', createAriaControlsElementsDescriptor());
}

/** Installs every Happy DOM shim: form-associated internals, shadow focus and ARIA reflection. */
/** Index just past the comment, string or `url(...)` token that starts at `index`, or `index`. */
function skipOpaqueToken(css: string, index: number): number {
  const char = css[index];
  if (char === '/' && css[index + 1] === '*') {
    const end = css.indexOf('*/', index + 2);
    return end === -1 ? css.length : end + 2;
  }
  if (char === '"' || char === "'") {
    let cursor = index + 1;
    while (cursor < css.length && css[cursor] !== char) cursor += css[cursor] === '\\' ? 2 : 1;
    return Math.min(cursor + 1, css.length);
  }
  if ((char === 'u' || char === 'U') && /^url\(/i.test(css.slice(index, index + 4)) && !/[\w-]/.test(css[index - 1] ?? '')) {
    let cursor = index + 4;
    while (cursor < css.length && /\s/.test(css[cursor]!)) cursor++;
    if (css[cursor] === '"' || css[cursor] === "'") return index; // a quoted url is a string token
    const end = css.indexOf(')', cursor);
    return end === -1 ? css.length : end + 1;
  }
  return index;
}

/** Index of the `}` closing the block whose `{` is at `open` (or the text length when unclosed). */
function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let index = open; index < css.length; index++) {
    const skipped = skipOpaqueToken(css, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }
    if (css[index] === '{') depth++;
    else if (css[index] === '}' && --depth === 0) return index;
  }
  return css.length;
}

/**
 * Removes CSS cascade layers from `css` while keeping every rule in place: `@layer a, b;`
 * statements are dropped and each `@layer name { ... }` block (named, anonymous or nested, also
 * inside `@media`/`@supports`) is replaced by its own content. Comments, strings and `url(...)`
 * are copied verbatim, and `@import ... layer(x)` is left alone. Layer precedence is NOT
 * modelled: the unwrapped rules cascade in source order like unlayered rules.
 */
export function flattenCascadeLayers(css: string): string {
  let output = '';
  let index = 0;
  while (index < css.length) {
    const skipped = skipOpaqueToken(css, index);
    if (skipped !== index) {
      output += css.slice(index, skipped);
      index = skipped;
      continue;
    }
    if (css.startsWith('@layer', index) && !/[\w-]/.test(css[index + 6] ?? '')) {
      let cursor = index + 6;
      while (cursor < css.length && css[cursor] !== ';' && css[cursor] !== '{') cursor++;
      if (css[cursor] === '{') {
        const close = matchingBrace(css, cursor);
        output += flattenCascadeLayers(css.slice(cursor + 1, close));
        index = close + 1;
      } else {
        index = cursor + 1;
      }
      continue;
    }
    output += css[index];
    index++;
  }
  return output;
}

/** True when this engine's CSSOM discards rules inside `@layer` blocks, as Happy DOM 20 does. */
function cascadeLayerRulesDropped(): boolean {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('@layer lr-probe{:root{--lr-probe:1}}');
    return sheet.cssRules.length === 0;
  } catch {
    return false;
  }
}

interface SheetTextMethods {
  replaceSync(text: string): void;
  replace(text: string): Promise<unknown>;
}

const FLATTENING = Symbol.for('lyra-ui.testing.cascade-layer-shim');

/**
 * Makes an engine whose CSSOM drops `@layer` rules (Happy DOM 20 discards every layered rule, so
 * `getComputedStyle()` never sees a custom property `theme.css` declares inside a layer) parse the
 * layer contents as ordinary rules. `replaceSync()` and `replace()` -- the path `<style>`,
 * `<link rel="stylesheet">` and constructed sheets all take -- receive the text through
 * {@link flattenCascadeLayers}, so Lyra's stylesheet probes (`--_lr-style-resolver`, the
 * `--_lr-*-installed` markers, the token-layer sentinel) resolve as in a browser. Layer order is
 * not modelled; assert behaviour, not values that depend on layer precedence. `insertRule()` is
 * unchanged. No-op wherever the engine keeps layer rules (every browser) or has no
 * `CSSStyleSheet`; installs once and returns a function that restores the original methods.
 * `proto` and `misbehaves` default to the global `CSSStyleSheet.prototype` and the engine probe.
 */
export function installHappyDomCascadeLayerShim(
  proto: SheetTextMethods | undefined = globalThis.CSSStyleSheet?.prototype,
  misbehaves: () => boolean = cascadeLayerRulesDropped,
): () => void {
  if (!proto || typeof proto.replaceSync !== 'function') return () => {};
  const installed = proto as SheetTextMethods & { [FLATTENING]?: boolean };
  if (installed[FLATTENING] || !misbehaves()) return () => {};
  const { replaceSync, replace } = proto;
  installed.replaceSync = function (this: SheetTextMethods, text: string): void {
    replaceSync.call(this, typeof text === 'string' ? flattenCascadeLayers(text) : text);
  };
  if (typeof replace === 'function') {
    installed.replace = function (this: SheetTextMethods, text: string): Promise<unknown> {
      return replace.call(this, typeof text === 'string' ? flattenCascadeLayers(text) : text);
    };
  }
  installed[FLATTENING] = true;
  return () => {
    installed.replaceSync = replaceSync;
    if (typeof replace === 'function') installed.replace = replace;
    delete installed[FLATTENING];
  };
}

export function installHappyDomShims(): void {
  installHappyDomFormAssociatedShims();
  installHappyDomShadowFocusShim();
  installHappyDomAriaControlsShim();
  installHappyDomCascadeLayerShim();
}

/** Test-only: returns a fresh stub `ElementInternals`-shaped object, independent of whether
 *  `attachInternals` already exists natively -- exists purely so this module's own test can
 *  verify the stub's call-shape coverage without needing to run under happy-dom itself. */
export function installStubInternalsForTest(host: Element): StubElementInternals {
  return createStubInternals(host);
}
