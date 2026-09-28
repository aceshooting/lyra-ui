import type { LyraElement } from '../internal/lyra-element.js';

/** A class-only Lyra definition. Import registration-free `.class.js` component entries. */
export type LyraScopedElementConstructor = {
  new (): LyraElement<any>;
  readonly prototype: LyraElement<any>;
};
export type LyraScopedDefinitions = Readonly<Record<string, LyraScopedElementConstructor>>;
export interface LyraScopedCreationScope {
  importNode<T extends Node>(node: T, deep?: boolean): T;
}
export interface LyraScopedRegistry<Definitions extends LyraScopedDefinitions = LyraScopedDefinitions> {
  readonly registry: CustomElementRegistry;
  /** Lit render option for templates mounted directly into this scope. */
  readonly creationScope: LyraScopedCreationScope;
  /** Creates an upgraded instance in the factory's owning document. Unknown names throw. */
  createElement<Name extends keyof Definitions & string>(name: Name): InstanceType<Definitions[Name]>;
  createElement(name: string): LyraElement<any>;
  /** Attaches a fresh isolated shadow root. Existing shadow roots are never replaced. */
  attachShadow(host: HTMLElement, options?: ShadowRootInit): ShadowRoot;
  /** Add an isolated definition later. Repeating the same source class is idempotent. */
  define(name: string, constructor: LyraScopedElementConstructor): void;
}
interface NativeScopedRegistry extends CustomElementRegistry { initialize(root: Node): void; }
interface ScopedShadowOptions extends ShadowRootInit { customElementRegistry: CustomElementRegistry; }
interface ScopedElementOptions extends ElementCreationOptions { customElementRegistry: CustomElementRegistry; }
interface LitScopeHost { renderOptions: { creationScope?: LyraScopedCreationScope }; }

function nativeRegistry(): NativeScopedRegistry {
  return new CustomElementRegistry() as NativeScopedRegistry;
}

/**
 * Whether this realm exposes the native scoped registry APIs this helper needs. Does not install
 * a polyfill or define global elements. SSR and browsers without support return false.
 */
export function supportsScopedRegistries(): boolean {
  if (typeof document === 'undefined' || typeof CustomElementRegistry === 'undefined'
    || typeof ShadowRoot === 'undefined' || !('customElementRegistry' in ShadowRoot.prototype)) return false;
  try { return typeof nativeRegistry().initialize === 'function'; } catch { return false; }
}

/**
 * Creates an isolated native registry from explicit class-only definitions, including all
 * composed children. Nothing is registered globally. Scope-specific subclasses preserve
 * `instanceof` while directing nested shadow roots and Lit template clones to this registry.
 * `define()` also wraps late definitions, so parser-created elements upgrade with the same rule.
 * Do not call `registry.define()` directly for composed Lyra classes.
 *
 * Missing custom-element definitions in cloned templates throw before any fragment is inserted.
 * Caller-created DOM nodes retain their own construction provenance. Imperative global
 * `document.createElement()` calls by arbitrary third-party code are not redirected. Existing
 * roots, scoped SSR/hydration and adoption to another document are outside this factory's scope;
 * create a separate factory for each owning document instead.
 * Unsupported native APIs throw, never falling back to a global registry or installing a polyfill.
 */
export function createScopedRegistry<Definitions extends LyraScopedDefinitions>(
  definitions: Definitions,
  options: { document?: Document } = {},
): LyraScopedRegistry<Definitions> {
  if (!supportsScopedRegistries()) throw new Error('Scoped custom element registries are not supported by this environment.');
  const owner = options.document ?? document;
  const registry = nativeRegistry();
  const scopeDocument = owner.implementation.createHTMLDocument('');
  registry.initialize(scopeDocument);
  const sources = new Map<string, LyraScopedElementConstructor>();

  const creationScope: LyraScopedCreationScope = Object.freeze({
    importNode<T extends Node>(node: T, deep = false): T {
      const elements: Element[] = [];
      if (node.nodeType === 1) elements.push(node as unknown as Element);
      if (deep && 'querySelectorAll' in node) elements.push(...(node as unknown as ParentNode).querySelectorAll('*'));
      for (const element of elements) {
        if (element.localName.includes('-') && !registry.get(element.localName)) {
          throw new Error(`Missing scoped definition for ${element.localName}. Include its class in this registry.`);
        }
      }
      return scopeDocument.importNode(node, deep);
    },
  });

  function define(name: string, Base: LyraScopedElementConstructor): void {
    const existing = sources.get(name);
    if (existing === Base) return;
    if (existing || registry.get(name)) throw new Error(`A different scoped definition already exists for ${name}.`);
    if (typeof Base !== 'function' || !Base.prototype || typeof Base.prototype.requestUpdate !== 'function') {
      throw new TypeError('Scoped definitions must be custom element classes.');
    }
    class ScopedElement extends Base {
      constructor() {
        super();
        const host = this as unknown as LitScopeHost;
        if (!host.renderOptions) throw new TypeError('Scoped definitions must extend LyraElement.');
        host.renderOptions.creationScope = creationScope;
      }
      override attachShadow(init: ShadowRootInit): ShadowRoot {
        if (this.ownerDocument !== owner) throw new Error('Create a scoped registry for the target document before constructing its elements.');
        const scoped: ScopedShadowOptions = { ...init, customElementRegistry: registry };
        return super.attachShadow(scoped);
      }
    }
    registry.define(name, ScopedElement);
    sources.set(name, Base);
  }

  for (const [name, Base] of Object.entries(definitions)) define(name, Base);
  return Object.freeze({
    registry,
    creationScope,
    define,
    createElement(name: string): LyraElement<any> {
      if (!registry.get(name)) throw new Error(`Missing scoped definition for ${name}.`);
      const scoped: ScopedElementOptions = { customElementRegistry: registry };
      return owner.createElement(name, scoped) as LyraElement<any>;
    },
    attachShadow(host: HTMLElement, init: ShadowRootInit = { mode: 'open' }): ShadowRoot {
      if (host.ownerDocument !== owner) throw new Error('Create a scoped registry for the target document before attaching its shadow root.');
      const scoped: ScopedShadowOptions = { ...init, customElementRegistry: registry };
      return host.attachShadow(scoped);
    },
  }) as LyraScopedRegistry<Definitions>;
}
