import { expect } from '@open-wc/testing';
import {
  diagnoseLyraHydration,
  getLyraSsrMode,
  LYRA_SSR_CLIENT_RENDER_TAGS,
  LyraSsrFallbackRenderer,
  lyraSsrElementRenderers,
  type LyraLitElementRendererConstructor,
} from './ssr.js';

describe('diagnoseLyraHydration', () => {
  it('includes a foreign element root and consults its owner custom-element registry', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignWindow = iframe.contentWindow!;
      const foreignDocument = iframe.contentDocument!;
      const ForeignHTMLElement = (
        foreignWindow as unknown as { HTMLElement: typeof HTMLElement }
      ).HTMLElement;
      class ForeignLyraButton extends ForeignHTMLElement {
        readonly updateComplete = Promise.resolve();

        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }
      }
      foreignWindow.customElements.define('lr-button', ForeignLyraButton);
      const root = foreignDocument.createElement('lr-button');
      foreignDocument.body.append(root);

      const diagnostics = await diagnoseLyraHydration(root);

      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-button');
      expect(diagnostics[0]?.status).to.equal('hydrated');
      expect(diagnostics[0]?.element === root).to.equal(true);
    } finally {
      iframe.remove();
    }
  });

  it('does not borrow the ambient registry for an inert foreign owner document', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const inertDocument = iframe.contentDocument!.implementation.createHTMLDocument('inert');
    const root = inertDocument.createElement('lr-button');
    const descriptor = Object.getOwnPropertyDescriptor(customElements, 'get');
    const nativeGet = customElements.get;
    Object.defineProperty(customElements, 'get', {
      configurable: true,
      value(name: string) {
        if (name === 'lr-button') return class AmbientOnlyDefinition extends HTMLElement {};
        return nativeGet.call(customElements, name);
      },
    });

    try {
      const diagnostics = await diagnoseLyraHydration(root);
      expect(inertDocument.defaultView).to.equal(null);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.status).to.equal('unregistered');
    } finally {
      if (descriptor) Object.defineProperty(customElements, 'get', descriptor);
      else delete (customElements as CustomElementRegistry & { get?: CustomElementRegistry['get'] }).get;
      iframe.remove();
    }
  });

  // --- Fixture custom elements for the status-branch tests below. Each tag is registered exactly
  // once at module scope (a `CustomElementRegistry` rejects a second `define()` for the same
  // name); every test that needs an instance creates a fresh element from the already-registered
  // constructor rather than redefining the tag.

  // Render-and-hydrate tag (not in LYRA_SSR_CLIENT_RENDER_REASONS), shadow root attached, resolved
  // updateComplete -> exercises the 'hydrated' status.
  customElements.define(
    'lr-badge',
    class extends HTMLElement {
      readonly updateComplete = Promise.resolve();

      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }
    },
  );

  // Client-render tag (present in LYRA_SSR_CLIENT_RENDER_REASONS), shadow root attached, resolved
  // updateComplete -> exercises the 'client-rendered' status.
  customElements.define(
    'lr-radio',
    class extends HTMLElement {
      readonly updateComplete = Promise.resolve();

      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }
    },
  );

  // Registered, resolved updateComplete, but no shadow root -> 'missing-shadow-root'.
  customElements.define(
    'lr-chip',
    class extends HTMLElement {
      readonly updateComplete = Promise.resolve();
    },
  );

  // Registered, shadow root attached, updateComplete rejects -> 'update-failed' (async branch).
  customElements.define(
    'lr-card',
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      get updateComplete(): Promise<unknown> {
        return Promise.reject(new Error('synthetic card update failure'));
      }
    },
  );

  // Registered, shadow root attached, accessing updateComplete throws synchronously ->
  // 'update-failed' (synchronous-throw branch).
  customElements.define(
    'lr-callout',
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      get updateComplete(): Promise<unknown> {
        throw new Error('synthetic callout synchronous failure');
      }
    },
  );

  function withContainer(): { container: HTMLDivElement; cleanup: () => void } {
    const container = document.createElement('div');
    document.body.append(container);
    return { container, cleanup: () => container.remove() };
  }

  it('reports unregistered for a candidate tag with no custom element definition', async () => {
    expect(customElements.get('lr-avatar')).to.equal(undefined);
    const { container, cleanup } = withContainer();
    try {
      container.append(document.createElement('lr-avatar'));
      const diagnostics = await diagnoseLyraHydration(container);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-avatar');
      expect(diagnostics[0]?.mode).to.equal(getLyraSsrMode('lr-avatar'));
      expect(diagnostics[0]?.status).to.equal('unregistered');
      expect(diagnostics[0]?.error).to.equal(undefined);
    } finally {
      cleanup();
    }
  });

  it('reports hydrated for a registered render-and-hydrate tag with a shadow root and a resolved updateComplete', async () => {
    const { container, cleanup } = withContainer();
    try {
      container.append(document.createElement('lr-badge'));
      const diagnostics = await diagnoseLyraHydration(container);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-badge');
      expect(diagnostics[0]?.mode).to.equal('render-and-hydrate');
      expect(diagnostics[0]?.status).to.equal('hydrated');
    } finally {
      cleanup();
    }
  });

  it('reports client-rendered for a registered client-render tag with a shadow root and a resolved updateComplete', async () => {
    expect(LYRA_SSR_CLIENT_RENDER_TAGS).to.include('lr-radio');
    const { container, cleanup } = withContainer();
    try {
      container.append(document.createElement('lr-radio'));
      const diagnostics = await diagnoseLyraHydration(container);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-radio');
      expect(diagnostics[0]?.mode).to.equal('client-render');
      expect(diagnostics[0]?.status).to.equal('client-rendered');
    } finally {
      cleanup();
    }
  });

  it('reports missing-shadow-root for a registered element with no shadow root', async () => {
    const { container, cleanup } = withContainer();
    try {
      container.append(document.createElement('lr-chip'));
      const diagnostics = await diagnoseLyraHydration(container);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-chip');
      expect(diagnostics[0]?.status).to.equal('missing-shadow-root');
    } finally {
      cleanup();
    }
  });

  it('reports update-failed with the rejection reason when updateComplete rejects', async () => {
    const { container, cleanup } = withContainer();
    try {
      container.append(document.createElement('lr-card'));
      const diagnostics = await diagnoseLyraHydration(container);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-card');
      expect(diagnostics[0]?.status).to.equal('update-failed');
      expect(diagnostics[0]?.error).to.be.an('error');
      expect((diagnostics[0]?.error as Error).message).to.equal('synthetic card update failure');
    } finally {
      cleanup();
    }
  });

  it('reports update-failed when reading updateComplete throws synchronously', async () => {
    const { container, cleanup } = withContainer();
    try {
      container.append(document.createElement('lr-callout'));
      const diagnostics = await diagnoseLyraHydration(container);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-callout');
      expect(diagnostics[0]?.status).to.equal('update-failed');
      expect(diagnostics[0]?.error).to.be.an('error');
      expect((diagnostics[0]?.error as Error).message).to.equal('synthetic callout synchronous failure');
    } finally {
      cleanup();
    }
  });

  it('limits candidates to descendants when the root itself is not a matching element', async () => {
    const { container, cleanup } = withContainer();
    try {
      container.append(document.createElement('lr-badge'));
      // The container is a plain <div>: it has a localName (so it is a structural candidate
      // before filtering) but is not itself a Lyra tag, so only its descendant is reported.
      const diagnostics = await diagnoseLyraHydration(container);
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]?.tag).to.equal('lr-badge');
      expect(diagnostics.some((d) => d.element === container)).to.equal(false);
    } finally {
      cleanup();
    }
  });

  it('accepts a detached DocumentFragment root, which has no localName of its own', async () => {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createElement('lr-badge'));

    const diagnostics = await diagnoseLyraHydration(fragment);

    expect(diagnostics.length).to.equal(1);
    expect(diagnostics[0]?.tag).to.equal('lr-badge');
    expect(diagnostics[0]?.status).to.equal('hydrated');
  });

  it('defaults to the ambient document when no root argument is given', async () => {
    const element = document.createElement('lr-badge');
    document.body.append(element);
    try {
      const diagnostics = await diagnoseLyraHydration();
      const own = diagnostics.find((d) => d.element === element);
      expect(own).to.not.equal(undefined);
      expect(own?.tag).to.equal('lr-badge');
      expect(own?.status).to.equal('hydrated');
    } finally {
      element.remove();
    }
  });
});

describe('LyraSsrFallbackRenderer', () => {
  it('matches only tags declared in the client-render tier', () => {
    const clientRenderTag = LYRA_SSR_CLIENT_RENDER_TAGS[0];
    expect(clientRenderTag).to.be.a('string');
    expect(
      LyraSsrFallbackRenderer.matchesClass(
        class {} as unknown as CustomElementConstructor,
        clientRenderTag!,
        new Map(),
      ),
    ).to.equal(true);
    expect(
      LyraSsrFallbackRenderer.matchesClass(class {} as unknown as CustomElementConstructor, 'lr-badge', new Map()),
    ).to.equal(false);
  });

  it('has no-op connectedCallback, attributeChangedCallback, and setProperty hooks', () => {
    const renderer = new LyraSsrFallbackRenderer('lr-radio');
    expect(renderer.connectedCallback()).to.equal(undefined);
    expect(renderer.attributeChangedCallback('checked', null, 'true')).to.equal(undefined);
    expect(renderer.setProperty('checked', true)).to.equal(undefined);
  });

  it('opens a shadow root and renders nothing for either shadow or light DOM', () => {
    const renderer = new LyraSsrFallbackRenderer('lr-radio');
    expect(renderer.shadowRootOptions).to.deep.equal({ mode: 'open' });
    expect(renderer.renderShadow({})).to.equal(undefined);
    expect(renderer.renderLight({})).to.equal(undefined);
  });

  it('stores attribute names lowercased and renders a bare name for an empty-string value', () => {
    const renderer = new LyraSsrFallbackRenderer('lr-radio');
    renderer.setAttribute('CHECKED', '');
    expect(renderer.renderAttributes()).to.deep.equal([' checked']);
  });

  it('escapes &, ", <, and > when rendering a non-empty attribute value', () => {
    const renderer = new LyraSsrFallbackRenderer('lr-radio');
    renderer.setAttribute('data-label', `a&b"c<d>e`);
    expect(renderer.renderAttributes()).to.deep.equal([' data-label="a&amp;b&quot;c&lt;d&gt;e"']);
  });

  it('renders every set attribute, in insertion order', () => {
    const renderer = new LyraSsrFallbackRenderer('lr-radio');
    renderer.setAttribute('Value', 'a');
    renderer.setAttribute('Disabled', '');
    expect(renderer.renderAttributes()).to.deep.equal([' value="a"', ' disabled']);
  });
});

describe('lyraSsrElementRenderers', () => {
  class FakeLitElementRenderer {
    readonly tagName: string;
    connectedCallCount = 0;
    element?: unknown;

    constructor(tagName: string) {
      this.tagName = tagName;
    }

    connectedCallback(): void {
      this.connectedCallCount += 1;
    }

    static matchesClass(): boolean {
      return true;
    }
  }

  function buildRenderers(): readonly [
    typeof LyraSsrFallbackRenderer,
    new (tagName: string) => FakeLitElementRenderer,
  ] {
    const [FallbackRenderer, RenderAndHydrateRenderer] = lyraSsrElementRenderers(
      FakeLitElementRenderer as unknown as LyraLitElementRendererConstructor,
    );
    return [FallbackRenderer, RenderAndHydrateRenderer as unknown as new (tagName: string) => FakeLitElementRenderer];
  }

  it('returns the shared fallback renderer unchanged', () => {
    const [FallbackRenderer] = buildRenderers();
    expect(FallbackRenderer).to.equal(LyraSsrFallbackRenderer);
  });

  it('fills in missing children/childNodes/query methods/closest/style before delegating to the parent', () => {
    const [, RenderAndHydrateRenderer] = buildRenderers();
    const instance = new RenderAndHydrateRenderer('lr-badge');
    const element: Record<string, unknown> = {};
    instance.element = element;

    instance.connectedCallback();

    expect(instance.connectedCallCount).to.equal(1);
    expect(element.children).to.deep.equal([]);
    expect(element.childNodes).to.deep.equal([]);
    expect((element.querySelector as () => unknown)()).to.equal(null);
    expect((element.querySelectorAll as () => unknown)()).to.deep.equal([]);
    expect((element.closest as () => unknown)()).to.equal(null);
    const style = element.style as {
      getPropertyValue(): string;
      removeProperty(): string;
      setProperty(): unknown;
    };
    expect(style.getPropertyValue()).to.equal('');
    expect(style.removeProperty()).to.equal('');
    expect(style.setProperty()).to.equal(undefined);
  });

  it('still invokes the parent connectedCallback and skips prep entirely when there is no element', () => {
    const [, RenderAndHydrateRenderer] = buildRenderers();
    const instance = new RenderAndHydrateRenderer('lr-badge');

    instance.connectedCallback();

    expect(instance.connectedCallCount).to.equal(1);
    expect(instance.element).to.equal(undefined);
  });

  it('does not overwrite existing children, methods, or style already present on the element', () => {
    const [, RenderAndHydrateRenderer] = buildRenderers();
    const instance = new RenderAndHydrateRenderer('lr-badge');
    const realChildren = [1, 2, 3];
    const realQuerySelector = () => 'real';
    const realStyle = { getPropertyValue: () => 'real-value' };
    instance.element = {
      children: realChildren,
      querySelector: realQuerySelector,
      style: realStyle,
    };

    instance.connectedCallback();

    const element = instance.element as Record<string, unknown>;
    expect(element.children).to.equal(realChildren);
    expect(element.querySelector).to.equal(realQuerySelector);
    expect(element.style).to.equal(realStyle);
    // Properties that were absent are still filled in alongside the preserved ones.
    expect(element.childNodes).to.deep.equal([]);
    expect((element.closest as () => unknown)()).to.equal(null);
  });
});
