import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import { AUTOLOADER_PENDING_ATTRIBUTE, discover, start, stop, type AutoloadableTagName } from './autoloader.js';
import { setAutoloaderLoaderForTesting } from './internal/autoloader-loaders.js';

const overriddenTags = new Set<AutoloadableTagName>();

function constructorForTag(): CustomElementConstructor {
  return class extends HTMLElement {};
}

function finishFirstUpdate(element: HTMLElement): void {
  const finishUpdate = Reflect.get(element, 'finishUpdate');
  if (typeof finishUpdate !== 'function') throw new Error('Expected a finishUpdate() test hook');
  Reflect.apply(finishUpdate, element, []);
}

function override(tag: AutoloadableTagName, loader: () => Promise<CustomElementConstructor>): void {
  stop();
  overriddenTags.add(tag);
  setAutoloaderLoaderForTesting(tag, loader);
}

function createScopedRegistry(): CustomElementRegistry {
  const definitions = new Map<string, CustomElementConstructor>();
  const waiters = new Map<string, Array<(constructor: CustomElementConstructor) => void>>();
  return {
    define(name: string, constructor: CustomElementConstructor) {
      if (definitions.has(name)) throw new DOMException(`The name ${name} is already defined`, 'NotSupportedError');
      definitions.set(name, constructor);
      for (const resolve of waiters.get(name) ?? []) resolve(constructor);
      waiters.delete(name);
    },
    get(name: string) {
      return definitions.get(name);
    },
    whenDefined(name: string) {
      const existing = definitions.get(name);
      if (existing) return Promise.resolve(existing);
      return new Promise<CustomElementConstructor>((resolve) => {
        const pending = waiters.get(name) ?? [];
        pending.push(resolve);
        waiters.set(name, pending);
      });
    },
  } as CustomElementRegistry;
}

afterEach(() => {
  stop();
  for (const tag of overriddenTags) setAutoloaderLoaderForTesting(tag, undefined);
  overriddenTags.clear();
});

describe('autoloader', () => {
  it('loads an existing tag through its generated literal class-module import', async () => {
    const root = await fixture<HTMLElement>(html`<div><lr-badge>Ready</lr-badge></div>`);
    const loaded = await discover(root);

    expect(loaded).to.include('lr-badge');
    expect(customElements.get('lr-badge')).to.be.a('function');
    expect(root.querySelector('lr-badge')!.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('marks a tag while its import is pending and clears the FOUCE marker after definition', async () => {
    const tag = 'lr-progress-ring';
    let resolve!: (constructor: CustomElementConstructor) => void;
    const module = new Promise<CustomElementConstructor>((done) => {
      resolve = done;
    });
    override(tag, () => module);
    const root = await fixture<HTMLElement>(html`<div><lr-progress-ring></lr-progress-ring></div>`);
    const element = root.querySelector(tag)!;

    const discovered = discover(root);
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);
    resolve(constructorForTag());
    await discovered;

    expect(customElements.get(tag)).to.be.a('function');
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('keeps the FOUCE marker through the first render and emits loaded after definition', async () => {
    const tag = 'lr-kbd';
    let resolveUpdate!: () => void;
    const updateComplete = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    override(
      tag,
      async () =>
        class extends HTMLElement {
          readonly updateComplete = updateComplete;
        },
    );
    const root = await fixture<HTMLElement>(html`<div><lr-kbd></lr-kbd></div>`);
    const element = root.querySelector(tag)!;
    const events: string[] = [];
    root.addEventListener('lr-autoload-preload', () => events.push('preload'));
    root.addEventListener('lr-autoload-loaded', () => events.push('loaded'));

    const loadedEvent = oneEvent(root, 'lr-autoload-loaded');
    const pending = discover(root, { events: true });
    await customElements.whenDefined(tag);
    await loadedEvent;
    expect(events.join(',')).to.equal('preload,loaded');
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

    resolveUpdate();
    await pending;
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('tracks each insertion through its own first update when a definition load is shared', async () => {
    const tag = 'lr-live-region';
    let resolveConstructor!: (constructor: CustomElementConstructor) => void;
    const constructor = new Promise<CustomElementConstructor>((resolve) => {
      resolveConstructor = resolve;
    });
    override(tag, () => constructor);
    const root = await fixture<HTMLElement>(html`<div></div>`);
    await start(root);

    const first = document.createElement(tag);
    root.append(first);
    await aTimeout(0);
    const second = document.createElement(tag);
    root.append(second);
    await aTimeout(0);
    expect(first.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);
    expect(second.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

    resolveConstructor(
      class extends HTMLElement {
        private resolveUpdate!: () => void;
        readonly updateComplete = new Promise<void>((resolve) => {
          this.resolveUpdate = resolve;
        });

        finishUpdate(): void {
          this.resolveUpdate();
        }
      },
    );
    await customElements.whenDefined(tag);

    finishFirstUpdate(first);
    await aTimeout(0);
    expect(first.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    expect(second.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

    finishFirstUpdate(second);
    await aTimeout(0);
    expect(second.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('discovers delayed shadow content from an instance inserted after its host was defined', async () => {
    const hostTag = 'lr-stat';
    const childTag = 'lr-poll-status';
    let childLoads = 0;
    override(childTag, async () => {
      childLoads += 1;
      return constructorForTag();
    });
    customElements.define(
      hostTag,
      class extends HTMLElement {
        private resolveUpdate!: () => void;
        readonly updateComplete = new Promise<void>((resolve) => {
          this.resolveUpdate = resolve;
        });

        finishUpdate(): void {
          const shadow = this.attachShadow({ mode: 'open' });
          shadow.append(document.createElement(childTag));
          this.resolveUpdate();
        }
      },
    );
    const root = await fixture<HTMLElement>(html`<div></div>`);
    await start(root);

    const host = document.createElement(hostTag);
    root.append(host);
    await aTimeout(0);
    expect(host.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

    finishFirstUpdate(host);
    await aTimeout(0);
    await aTimeout(0);
    expect(childLoads).to.equal(1);
    expect(customElements.get(childTag)).to.be.a('function');
    expect(host.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('observes dynamically inserted tags and ignores insertions after stop()', async () => {
    const dynamicTag = 'lr-breadcrumb';
    const stoppedTag = 'lr-breadcrumb-item';
    override(dynamicTag, async () => constructorForTag());
    override(stoppedTag, async () => constructorForTag());
    const root = await fixture<HTMLElement>(html`<div></div>`);

    await start(root);
    root.append(document.createElement(dynamicTag));
    await customElements.whenDefined(dynamicTag);
    expect(customElements.get(dynamicTag)).to.be.a('function');

    stop();
    root.append(document.createElement(stoppedTag));
    await aTimeout(0);
    expect(customElements.get(stoppedTag)).to.equal(undefined);
  });

  it('discovers a Turbo-style replacement subtree and can restart after stop()', async () => {
    const replacementTag = 'lr-card';
    const restartTag = 'lr-callout';
    override(replacementTag, async () => constructorForTag());
    override(restartTag, async () => constructorForTag());
    const root = await fixture<HTMLElement>(html`<main><p>old body</p></main>`);

    await start(root);
    const replacement = document.createElement('section');
    replacement.append(document.createElement(replacementTag));
    root.replaceChildren(replacement);
    await customElements.whenDefined(replacementTag);
    expect(customElements.get(replacementTag)).to.be.a('function');

    stop();
    await start(root);
    root.append(document.createElement(restartTag));
    await customElements.whenDefined(restartTag);
    expect(customElements.get(restartTag)).to.be.a('function');
  });

  it('observes caller-owned open shadow roots without escaping the caller subtree', async () => {
    const shadowTag = 'lr-skeleton';
    const outsideTag = 'lr-spinner';
    override(shadowTag, async () => constructorForTag());
    override(outsideTag, async () => constructorForTag());
    const root = await fixture<HTMLElement>(html`<div><section></section></div>`);
    const shadow = root.querySelector('section')!.attachShadow({ mode: 'open' });
    shadow.append(document.createElement(shadowTag));

    const outside = document.createElement(outsideTag);
    document.body.append(outside);
    try {
      await start(root);
      await customElements.whenDefined(shadowTag);
      await aTimeout(0);
      expect(customElements.get(shadowTag)).to.be.a('function');
      expect(customElements.get(outsideTag)).to.equal(undefined);
    } finally {
      outside.remove();
    }
  });

  it('stops observing an open shadow root after its host leaves the caller subtree', async () => {
    const tag = 'lr-agent-eval-dashboard';
    let loads = 0;
    let loadedEvents = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div><section></section></div>`);
    const host = root.querySelector('section')!;
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    root.addEventListener('lr-autoload-loaded', () => {
      loadedEvents += 1;
    });

    try {
      await start(root, { events: true });
      host.remove();
      await aTimeout(0);

      shadow.append(document.createElement(tag));
      await aTimeout(0);
      expect(loads).to.equal(0);
      expect(loadedEvents).to.equal(0);
      expect(typeof registry.get(tag)).to.equal('undefined');

      root.append(host);
      await registry.whenDefined(tag);
      await aTimeout(0);
      expect(loads).to.equal(1);
      expect(loadedEvents).to.equal(1);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('defines into the scoped registry associated with an open shadow root', async () => {
    const tag = 'lr-activity-feed';
    override(tag, async () => constructorForTag());
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    shadow.append(document.createElement(tag));
    try {
      expect(await discover(host)).to.deep.equal([tag]);
      expect(typeof registry.get(tag)).to.equal('function');
      expect(customElements.get(tag)).to.equal(undefined);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('leaves known tags in a detached document without a registry untouched', async () => {
    const tag = 'lr-pagination';
    let loads = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const detachedDocument = document.implementation.createHTMLDocument('autoloader-without-registry');
    const element = detachedDocument.createElement(tag);
    detachedDocument.body.append(element);

    expect(detachedDocument.defaultView).to.equal(null);
    expect(await discover(detachedDocument)).to.deep.equal([]);
    expect(loads).to.equal(0);
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('clears a predefined element marker when stopped before its first update settles', async () => {
    const tag = 'lr-color-picker';
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    let resolveUpdate!: () => void;
    const updateComplete = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    let updateRead = false;
    const element = document.createElement(tag);
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      get() {
        updateRead = true;
        return updateComplete;
      },
    });
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    registry.define(tag, constructorForTag());
    shadow.append(element);

    try {
      const started = start(host);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);
      for (let attempts = 0; attempts < 10 && !updateRead; attempts += 1) await aTimeout(0);
      expect(updateRead).to.equal(true);

      stop();
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
      resolveUpdate();
      await started;
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      resolveUpdate();
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
      host.remove();
    }
  });

  it('emits autoload events from a detached explicitly registered document', async () => {
    const tag = 'lr-menu';
    override(tag, async () => constructorForTag());
    const detachedDocument = document.implementation.createHTMLDocument('autoloader-events');
    const registry = createScopedRegistry();
    Object.defineProperty(detachedDocument, 'customElements', {
      configurable: true,
      value: registry,
    });
    detachedDocument.body.append(detachedDocument.createElement(tag));
    const loadedEvent = oneEvent(detachedDocument, 'lr-autoload-loaded');

    try {
      expect(await discover(detachedDocument, { events: true })).to.deep.equal([tag]);
      const event = (await loadedEvent) as CustomEvent<{ tag: string }>;
      expect(event instanceof CustomEvent).to.equal(true);
      expect(event.detail.tag).to.equal(tag);
      expect(typeof registry.get(tag)).to.equal('function');
    } finally {
      delete (detachedDocument as unknown as Record<string, unknown>)['customElements'];
    }
  });

  it('invalidates a pending generation on stop and lets a restart define the tag', async () => {
    const tag = 'lr-relative-time';
    let resolve!: (constructor: CustomElementConstructor) => void;
    const module = new Promise<CustomElementConstructor>((done) => {
      resolve = done;
    });
    override(tag, () => module);
    const root = await fixture<HTMLElement>(html`<div><lr-relative-time></lr-relative-time></div>`);
    const element = root.querySelector(tag)!;

    const firstStart = start(root);
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);
    stop();
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    resolve(constructorForTag());
    await firstStart;
    expect(customElements.get(tag)).to.equal(undefined);

    override(tag, async () => constructorForTag());
    await start(root);
    expect(customElements.get(tag)).to.be.a('function');
  });

  it('retries a rejected import without creating duplicate in-flight loads', async () => {
    const tag = 'lr-rating';
    let calls = 0;
    const failure = new Error('synthetic import failure');
    override(tag, async () => {
      calls += 1;
      throw failure;
    });
    const root = await fixture<HTMLElement>(html`<div><lr-rating></lr-rating></div>`);

    const first = discover(root);
    const concurrent = discover(root);
    for (const pending of [first, concurrent]) {
      try {
        await pending;
        expect.fail('the synthetic import should reject');
      } catch (error) {
        expect(error).to.equal(failure);
      }
    }
    expect(calls).to.equal(1);
    expect(root.querySelector(tag)!.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);

    override(tag, async () => {
      calls += 1;
      return constructorForTag();
    });
    await discover(root);
    expect(calls).to.equal(2);
    expect(customElements.get(tag)).to.be.a('function');
  });

  it('propagates only the first of several concurrent definition failures', async () => {
    const tagA = 'lr-rating';
    const tagB = 'lr-card';
    const errorA = new Error('first concurrent failure');
    const errorB = new Error('second concurrent failure');
    override(tagA, async () => {
      throw errorA;
    });
    override(tagB, async () => {
      throw errorB;
    });
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    shadow.append(document.createElement(tagA), document.createElement(tagB));

    try {
      let error: unknown;
      try {
        await discover(host);
      } catch (caught) {
        error = caught;
      }
      expect(error === errorA || error === errorB).to.equal(true);
      expect(typeof registry.get(tagA)).to.equal('undefined');
      expect(typeof registry.get(tagB)).to.equal('undefined');
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('rejects when a loader throws undefined', async () => {
    const tag = 'lr-rating';
    override(tag, async () => {
      throw undefined;
    });
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    const element = document.createElement(tag);
    shadow.append(element);

    try {
      let rejected = false;
      try {
        await discover(host);
      } catch (error) {
        rejected = true;
        expect(error).to.equal(undefined);
      }
      expect(rejected).to.equal(true);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('finishes valid siblings and their rendered shadow content when another import fails', async () => {
    const failedTag = 'lr-rating';
    const validTag = 'lr-card';
    const childTag = 'lr-badge';
    const failure = new Error('synthetic sibling import failure');
    override(failedTag, async () => {
      throw failure;
    });
    override(validTag, async () => constructorForTag());
    override(childTag, async () => constructorForTag());
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    const failed = document.createElement(failedTag);
    const valid = document.createElement(validTag);
    Object.defineProperty(valid, 'updateComplete', {
      configurable: true,
      value: Promise.resolve().then(() => {
        const rendered = valid.attachShadow({ mode: 'open' });
        Object.defineProperty(rendered, 'customElementRegistry', {
          configurable: true,
          value: registry,
        });
        rendered.append(document.createElement(childTag));
      }),
    });
    shadow.append(failed, valid);

    try {
      let error: unknown;
      try {
        await discover(host);
      } catch (caught) {
        error = caught;
      }
      expect(error).to.equal(failure);
      expect(typeof registry.get(failedTag)).to.equal('undefined');
      expect(typeof registry.get(validTag)).to.equal('function');
      expect(typeof registry.get(childTag)).to.equal('function');
      expect(failed.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
      expect(valid.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
      const rendered = valid.shadowRoot;
      if (rendered) delete (rendered as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('clears a failed import marker without waiting for a valid sibling render', async () => {
    const failedTag = 'lr-rating';
    const validTag = 'lr-card';
    const failure = new Error('synthetic sibling import failure');
    override(failedTag, async () => {
      throw failure;
    });
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    registry.define(validTag, constructorForTag());
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    const failed = document.createElement(failedTag);
    const valid = document.createElement(validTag);
    let resolveValid!: () => void;
    Object.defineProperty(valid, 'updateComplete', {
      configurable: true,
      value: new Promise<void>((resolve) => {
        resolveValid = resolve;
      }),
    });
    shadow.append(failed, valid);

    try {
      const importError = oneEvent(host, 'lr-autoload-error');
      const pending = discover(host, { events: true });
      await importError;
      await aTimeout(0);
      expect(failed.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
      expect(valid.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

      resolveValid();
      let error: unknown;
      try {
        await pending;
      } catch (caught) {
        error = caught;
      }
      expect(error).to.equal(failure);
      expect(valid.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      resolveValid();
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('fails soft for a hostile first-update getter while finishing a valid sibling', async () => {
    const hostileTag = 'lr-rating';
    const validTag = 'lr-card';
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    registry.define(hostileTag, constructorForTag());
    registry.define(validTag, constructorForTag());
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    const hostile = document.createElement(hostileTag);
    Object.defineProperty(hostile, 'updateComplete', {
      configurable: true,
      get(): never {
        throw new Error('hostile updateComplete');
      },
    });
    let validUpdateReads = 0;
    const valid = document.createElement(validTag);
    Object.defineProperty(valid, 'updateComplete', {
      configurable: true,
      get() {
        validUpdateReads += 1;
        return Promise.resolve();
      },
    });
    shadow.append(hostile, valid);

    try {
      await discover(host);
      expect(validUpdateReads).to.equal(1);
      expect(hostile.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
      expect(valid.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('serializes overlapping observer batches without clearing a later first-update marker', async () => {
    const tag = 'lr-rating';
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    registry.define(tag, constructorForTag());
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    const resolvers: Array<() => void> = [];
    const element = document.createElement(tag);
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      get() {
        return new Promise<void>((resolve) => resolvers.push(resolve));
      },
    });

    try {
      await start(host);
      shadow.append(element);
      await aTimeout(0);
      expect(resolvers.length).to.equal(1);
      element.remove();
      shadow.append(element);
      await aTimeout(0);
      expect(resolvers.length).to.equal(1);

      resolvers[0]!();
      await aTimeout(0);
      await aTimeout(0);
      expect(resolvers.length).to.equal(2);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

      resolvers[1]!();
      await aTimeout(0);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      for (const resolve of resolvers) resolve();
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('retains the first-update marker across concurrent discovery contexts', async () => {
    const tag = 'lr-rating';
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    registry.define(tag, constructorForTag());
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    const resolvers: Array<() => void> = [];
    const element = document.createElement(tag);
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      get() {
        return new Promise<void>((resolve) => resolvers.push(resolve));
      },
    });

    try {
      await start(host);
      shadow.append(element);
      for (let attempts = 0; attempts < 10 && resolvers.length < 1; attempts += 1) await aTimeout(0);
      expect(resolvers.length).to.equal(1);

      const explicitDiscovery = discover(host);
      for (let attempts = 0; attempts < 10 && resolvers.length < 2; attempts += 1) await aTimeout(0);
      expect(resolvers.length).to.equal(2);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

      resolvers[0]!();
      await aTimeout(0);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

      resolvers[1]!();
      await explicitDiscovery;
      await aTimeout(0);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      for (const resolve of resolvers) resolve();
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('preserves rendered depth when first-update shadow content is discovered', async () => {
    const tag = 'lr-rating';
    const element = document.createElement(tag);
    const registry = createScopedRegistry();
    registry.define(tag, constructorForTag());
    Object.defineProperty(element, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      value: Promise.resolve().then(() => element.attachShadow({ mode: 'open' })),
    });

    try {
      let error: unknown;
      try {
        await discover(element, { maxDepth: 0 });
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof Error).to.equal(true);
      expect((error as Error).message).to.include('maxDepth');
    } finally {
      delete (element as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('retries an observer-driven failure on the next insertion', async () => {
    const tag = 'lr-divider';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      if (calls === 1) throw new Error('synthetic first observer failure');
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div></div>`);
    await start(root, { events: true });

    const errorEvent = oneEvent(root, 'lr-autoload-error');
    root.append(document.createElement(tag));
    const error = (await errorEvent) as CustomEvent<{ tag: string }>;
    expect(error.detail.tag).to.equal(tag);
    await aTimeout(0);

    root.append(document.createElement(tag));
    await customElements.whenDefined(tag);
    expect(calls).to.equal(2);
    expect(customElements.get(tag)).to.be.a('function');
  });

  it('emits opt-in prefixed preload, loaded, and error events', async () => {
    const loadedTag = 'lr-resize-observer';
    const failedTag = 'lr-copy-button';
    const events: string[] = [];
    override(loadedTag, async () => constructorForTag());
    override(failedTag, async () => {
      throw new Error('synthetic event failure');
    });
    const loadedRoot = await fixture<HTMLElement>(html`<div><lr-resize-observer></lr-resize-observer></div>`);
    loadedRoot.addEventListener('lr-autoload-preload', () => events.push('preload'));
    loadedRoot.addEventListener('lr-autoload-loaded', () => events.push('loaded'));
    await discover(loadedRoot, { events: true });
    expect(events.join(',')).to.equal('preload,loaded');

    const failedRoot = await fixture<HTMLElement>(html`<div><lr-copy-button></lr-copy-button></div>`);
    let detail: { tag?: string; error?: unknown } | undefined;
    failedRoot.addEventListener('lr-autoload-error', (event) => {
      detail = (event as CustomEvent<{ tag: string; error: unknown }>).detail;
    });
    try {
      await discover(failedRoot, { events: true });
    } catch {
      // Asserted through the event detail below.
    }
    expect(detail?.tag).to.equal(failedTag);
    expect(detail?.error).to.be.an('error');
  });

  it('loads peer-free phone input and fixed-glyph composites with the default policy', async () => {
    const tags = ['lr-phone-input', 'lr-command-palette', 'lr-condition-builder'] as const;
    const calls = new Map<AutoloadableTagName, number>();
    for (const tag of tags) {
      override(tag, async () => {
        calls.set(tag, (calls.get(tag) ?? 0) + 1);
        return constructorForTag();
      });
    }
    const root = await fixture<HTMLElement>(html`
      <div>
        <lr-phone-input></lr-phone-input>
        <lr-command-palette></lr-command-palette>
        <lr-condition-builder></lr-condition-builder>
      </div>
    `);

    expect((await discover(root)).join(',')).to.equal(tags.join(','));
    for (const tag of tags) {
      expect(calls.get(tag)).to.equal(1);
      expect(customElements.get(tag)).to.be.a('function');
    }
  });

  it('loads the base flag without requiring its separately registered asset peer', async () => {
    const tag = 'lr-flag';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div><lr-flag></lr-flag></div>`);

    expect((await discover(root)).join(',')).to.equal(tag);
    expect(calls).to.equal(1);
    expect(customElements.get(tag)).to.be.a('function');
  });

  it('requires every peer for a multi-peer tag and accepts the explicit all policy', async () => {
    const tag = 'lr-email-viewer';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div><lr-email-viewer></lr-email-viewer></div>`);

    expect(await discover(root, { optionalPeers: ['dompurify'] })).to.deep.equal([]);
    expect(calls).to.equal(0);
    await discover(root, { optionalPeers: 'all' });
    expect(calls).to.equal(1);
    expect(customElements.get(tag)).to.be.a('function');
  });

  it('rejects malformed optional-peer policies before observing or loading', async () => {
    const root = await fixture<HTMLElement>(html`<div></div>`);
    const missingIterator = { has: () => true };
    for (const optionalPeers of [[''], [' dompurify'], [123], missingIterator, 1] as unknown[]) {
      let message = '';
      try {
        await discover(root, { optionalPeers: optionalPeers as never });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).to.include('optionalPeers');
    }
  });

  it('rejects a deeply nested open-shadow tree at the configured iterative depth ceiling', async () => {
    const root = document.createDocumentFragment();
    let parent: DocumentFragment | ShadowRoot = root;
    for (let depth = 0; depth < 300; depth += 1) {
      const host = document.createElement('div');
      parent.append(host);
      parent = host.attachShadow({ mode: 'open' });
    }

    let error: unknown;
    try {
      await discover(root, { maxDepth: 64 });
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof Error).to.equal(true);
    expect(error instanceof RangeError, 'not recursive stack exhaustion').to.equal(false);
    expect((error as Error).message).to.include('maxDepth');
  });

  it('caps concurrent first-update discovery work', async () => {
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    registry.define('lr-tag', constructorForTag());
    let active = 0;
    let maximum = 0;
    try {
      for (let index = 0; index < 24; index += 1) {
        const element = document.createElement('lr-tag');
        Object.defineProperty(element, 'updateComplete', {
          configurable: true,
          get() {
            active += 1;
            maximum = Math.max(maximum, active);
            return new Promise<void>((resolve) => {
              setTimeout(() => {
                active -= 1;
                resolve();
              }, 5);
            });
          },
        });
        shadow.append(element);
      }

      await discover(host, { maxConcurrency: 4 });
      expect(maximum).to.be.at.most(4);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('reports an observer-driven traversal ceiling without launching partial discovery', async () => {
    const tag = 'lr-badge';
    let loads = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div></div>`);
    const shadow = root.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    let detail: { limit?: string; maximum?: number } | undefined;
    root.addEventListener('lr-autoload-traversal-error', (event) => {
      detail = (event as CustomEvent<{ limit: string; maximum: number }>).detail;
    });
    try {
      await start(root, { events: true, maxElements: 3 });

      const subtree = document.createElement('section');
      subtree.append(document.createElement(tag), ...Array.from({ length: 4 }, () => document.createElement('span')));
      shadow.append(subtree);
      await aTimeout(20);

      expect(detail?.limit).to.equal('maxElements');
      expect(detail?.maximum).to.equal(3);
      expect(loads).to.equal(0);
      expect(registry.get(tag)).to.equal(undefined);
      expect(subtree.querySelector(tag)!.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('charges observer ancestry work to maxWork and emits the traversal failure', async () => {
    const tag = 'lr-rating';
    let loads = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });

    try {
      await start(shadow, { events: true, maxWork: 1 });
      const traversalError = oneEvent(shadow, 'lr-autoload-traversal-error');
      const element = document.createElement(tag);
      shadow.append(element);
      const event = (await traversalError) as CustomEvent<{ limit: string; maximum: number }>;

      expect(event.detail.limit).to.equal('maxWork');
      expect(event.detail.maximum).to.equal(1);
      expect(loads).to.equal(0);
      expect(registry.get(tag)).to.equal(undefined);
      expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('rejects invalid traversal and concurrency ceilings before walking the tree', async () => {
    for (const options of [
      { maxElements: -1 },
      { maxRoots: Number.NaN },
      { maxDepth: Number.POSITIVE_INFINITY },
      { maxWork: 1.5 },
      { maxConcurrency: 0 },
      { maxConcurrency: 1.5 },
      { maxConcurrency: Number.NaN },
    ]) {
      let error: unknown;
      try {
        await discover(document.createDocumentFragment(), options);
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof RangeError).to.equal(true);
    }
  });

  it('accepts a structural ReadonlySet from outside the ambient Set realm', async () => {
    const tag = 'lr-code-block';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div><lr-code-block></lr-code-block></div>`);
    class StructuralPeers implements ReadonlySet<string> {
      readonly size = 1;

      has(peer: string): boolean {
        return peer === 'shiki';
      }

      forEach(
        callback: (value: string, key: string, set: ReadonlySet<string>) => void,
        thisArg?: unknown,
      ): void {
        callback.call(thisArg, 'shiki', 'shiki', this);
      }

      *entries() {
        yield ['shiki', 'shiki'] as [string, string];
        return undefined;
      }

      *keys() {
        yield 'shiki';
        return undefined;
      }

      values() {
        return this.keys();
      }

      [Symbol.iterator]() {
        return this.values();
      }
    }
    const peers = new StructuralPeers();

    await discover(root, { optionalPeers: peers });
    expect(calls).to.equal(1);
    expect(customElements.get(tag)).to.be.a('function');
  });

  it('ignores text and comment mutations before loading a later element insertion', async () => {
    const tag = 'lr-pagination';
    let loads = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div></div>`);
    await start(root);

    root.append(document.createTextNode('Loading…'), document.createComment('autoloader boundary'));
    await aTimeout(0);
    expect(loads).to.equal(0);

    root.append(document.createElement(tag));
    await customElements.whenDefined(tag);
    expect(loads).to.equal(1);
  });

  it('skips an element whose scoped registry throws from get() without failing the whole batch', async () => {
    const hostileTag = 'lr-rating';
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const hostileRegistry = {
      get(name: string): CustomElementConstructor | undefined {
        if (name === hostileTag) throw new Error('hostile registry.get');
        return undefined;
      },
      define() {},
      whenDefined() {
        return new Promise<CustomElementConstructor>(() => {});
      },
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: hostileRegistry,
    });
    shadow.append(document.createElement(hostileTag));

    try {
      expect(await discover(host)).to.deep.equal([]);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('keeps observing a surviving shadow root after pruning an unrelated detached one', async () => {
    const removedTag = 'lr-alert';
    const laterTag = 'lr-avatar';
    let removedLoads = 0;
    let laterLoads = 0;
    override(removedTag, async () => {
      removedLoads += 1;
      return constructorForTag();
    });
    override(laterTag, async () => {
      laterLoads += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div><section id="a"></section><section id="b"></section></div>`);
    const hostA = root.querySelector('#a')!;
    const hostB = root.querySelector('#b')!;
    const shadowA = hostA.attachShadow({ mode: 'open' });
    const shadowB = hostB.attachShadow({ mode: 'open' });

    await start(root);
    shadowA.append(document.createElement(removedTag));
    await customElements.whenDefined(removedTag);
    expect(removedLoads).to.equal(1);

    hostA.remove();
    await aTimeout(0);
    shadowA.append(document.createElement(removedTag));
    await aTimeout(20);
    expect(removedLoads, 'a pruned shadow root must not still be observed').to.equal(1);

    shadowB.append(document.createElement(laterTag));
    await customElements.whenDefined(laterTag);
    expect(laterLoads, 'a surviving shadow root must still be observed after pruning').to.equal(1);
  });

  it('falls back to the ambient MutationObserver constructor when the owner document has no browsing context', async () => {
    const tag = 'lr-badge';
    let loads = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const detachedDocument = document.implementation.createHTMLDocument('autoloader-ambient-observer');
    const registry = createScopedRegistry();
    Object.defineProperty(detachedDocument, 'customElements', {
      configurable: true,
      value: registry,
    });
    expect(detachedDocument.defaultView).to.equal(null);

    try {
      await start(detachedDocument);
      detachedDocument.body.append(detachedDocument.createElement(tag));
      await registry.whenDefined(tag);
      expect(loads).to.equal(1);
    } finally {
      delete (detachedDocument as unknown as Record<string, unknown>)['customElements'];
    }
  });

  it('bypasses hostile added-node type and parent getters without blocking a valid sibling', async () => {
    const tag = 'lr-zoomable-frame';
    let loads = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div></div>`);
    await start(root);
    const hostile = document.createElement('div');
    Object.defineProperty(hostile, 'nodeType', {
      configurable: true,
      get(): never {
        throw new Error('hostile nodeType');
      },
    });
    Object.defineProperty(hostile, 'localName', {
      configurable: true,
      get(): never {
        throw new Error('hostile localName');
      },
    });
    const cyclicParent = document.createElement('div');
    Object.defineProperty(cyclicParent, 'parentNode', {
      configurable: true,
      get() {
        return cyclicParent;
      },
    });

    root.append(hostile, cyclicParent, document.createElement(tag));
    await customElements.whenDefined(tag);
    expect(loads).to.equal(1);
  });

  it('fails soft for hostile observer records and drops queued work invalidated by stop()', async () => {
    const loadedTag = 'lr-animation';
    const stoppedTag = 'lr-format-bytes';
    let loadedCalls = 0;
    let stoppedCalls = 0;
    override(loadedTag, async () => {
      loadedCalls += 1;
      return constructorForTag();
    });
    override(stoppedTag, async () => {
      stoppedCalls += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div><section></section></div>`);
    const host = root.querySelector('section')!;
    const shadow = host.attachShadow({ mode: 'open' });
    const originalMutationObserver = window.MutationObserver;
    let callback!: MutationCallback;
    let observer!: MutationObserver;
    class ControlledMutationObserver implements MutationObserver {
      constructor(next: MutationCallback) {
        callback = next;
        observer = this;
      }
      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }
    window.MutationObserver = ControlledMutationObserver;

    const record = (target: Node, addedNodes: readonly Node[]): MutationRecord => ({
      type: 'childList',
      target,
      addedNodes: addedNodes as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      previousSibling: null,
      nextSibling: null,
      attributeName: null,
      attributeNamespace: null,
      oldValue: null,
    });

    try {
      await start(root);
      callback([record(host, [shadow])], observer);
      await aTimeout(0);

      const hostDescriptor = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'host')!;
      try {
        Object.defineProperty(ShadowRoot.prototype, 'host', {
          configurable: true,
          get(): never {
            throw new Error('hostile shadow host');
          },
        });
        callback([record(host, [shadow])], observer);
      } finally {
        Object.defineProperty(ShadowRoot.prototype, 'host', hostDescriptor);
      }

      const loaded = document.createElement(loadedTag);
      root.append(loaded);
      const detached = document.createElement('div');
      const hostileTarget = new Proxy(root, {}) as Node;
      const revokedAdded = Proxy.revocable<Node>(loaded, {});
      revokedAdded.revoke();
      callback(
        [
          record(hostileTarget, []),
          record(root, [revokedAdded.proxy, detached, loaded]),
        ],
        observer
      );
      await customElements.whenDefined(loadedTag);
      expect(loadedCalls).to.equal(1);

      const stopped = document.createElement(stoppedTag);
      root.append(stopped);
      callback([record(root, [stopped])], observer);
      expect(stopped.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);
      stop();
      callback([record(root, [document.createElement(stoppedTag)])], observer);
      await aTimeout(0);
      expect(stoppedCalls).to.equal(0);
      expect(stopped.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    } finally {
      stop();
      window.MutationObserver = originalMutationObserver;
    }
  });

  it('preserves a caller-owned pending marker', async () => {
    const tag = 'lr-format-bytes';
    override(tag, async () => constructorForTag());
    const root = await fixture<HTMLElement>(html`<div><lr-format-bytes></lr-format-bytes></div>`);
    const element = root.querySelector(tag)!;
    element.setAttribute(AUTOLOADER_PENDING_ATTRIBUTE, 'caller');

    await discover(root);

    expect(element.getAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal('caller');
  });

  it('waits for every bounded worker before propagating a hostile marker cleanup failure', async () => {
    const tag = 'lr-qr-code';
    const failure = new Error('hostile removeAttribute');
    override(
      tag,
      async () => class extends HTMLElement {
        override removeAttribute(name: string): void {
          if (name === AUTOLOADER_PENDING_ATTRIBUTE) throw failure;
          super.removeAttribute(name);
        }
      }
    );
    const root = await fixture<HTMLElement>(html`<div><lr-qr-code></lr-qr-code></div>`);
    let error: unknown;

    try {
      await discover(root, { optionalPeers: 'all' });
    } catch (caught) {
      error = caught;
    }

    expect(error).to.equal(failure);
    expect(root.querySelector(tag)!.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);
  });

  it('handles an element whose owner-document accessor becomes hostile during upgrade', async () => {
    const tag = 'lr-animated-image';
    override(
      tag,
      async () => class extends HTMLElement {
        constructor() {
          super();
          Object.defineProperty(this, 'ownerDocument', {
            configurable: true,
            get(): never {
              throw new Error('hostile ownerDocument');
            },
          });
        }
      }
    );
    const root = await fixture<HTMLElement>(html`<div><lr-animated-image></lr-animated-image></div>`);

    expect(await discover(root)).to.deep.equal([tag]);
    expect(root.querySelector(tag)!.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('skips observer additions with a missing or hostile scoped registry', async () => {
    const missingTag = 'lr-format-bytes';
    const hostileTag = 'lr-animation';
    let loads = 0;
    override(missingTag, async () => {
      loads += 1;
      return constructorForTag();
    });
    override(hostileTag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const detachedDocument = document.implementation.createHTMLDocument('autoloader-missing-registry');
    await start(detachedDocument);
    detachedDocument.body.append(detachedDocument.createElement(missingTag));
    await aTimeout(0);
    expect(loads).to.equal(0);

    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const hostileRegistry = {
      get(): never {
        throw new Error('hostile registry.get');
      },
      define() {},
      whenDefined() {
        return new Promise<CustomElementConstructor>(() => {});
      },
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: hostileRegistry,
    });
    try {
      await start(host);
      shadow.append(document.createElement(hostileTag));
      await aTimeout(0);
      expect(loads).to.equal(0);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('skips an observer-inserted optional-peer tag until its peer is allowed', async () => {
    const tag = 'lr-chart';
    let loads = 0;
    override(tag, async () => {
      loads += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div></div>`);
    await start(root);

    const element = document.createElement(tag);
    root.append(element);
    await aTimeout(0);

    expect(loads).to.equal(0);
    expect(element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
  });

  it('stops the active observer when initial start discovery rejects', async () => {
    const root = await fixture<HTMLElement>(html`<div><section><span></span></section></div>`);
    let error: unknown;
    try {
      await start(root, { maxDepth: 0 });
    } catch (caught) {
      error = caught;
    }

    expect(error instanceof Error).to.equal(true);
    expect((error as Error).message).to.include('maxDepth');
    expect(root.querySelectorAll(`[${AUTOLOADER_PENDING_ATTRIBUTE}]`)).to.have.length(0);
  });

  it('rejects roots whose querySelectorAll member is not callable', async () => {
    const invalidRoot = { querySelectorAll: true } as unknown as DocumentFragment;
    expect(await discover(invalidRoot)).to.deep.equal([]);
    expect(await start(invalidRoot)).to.deep.equal([]);
  });
});

it('defaults discovery to the ambient document when no root is given', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  try {
    // No manifest tag is present, so this exercises the default-root path and returns an
    // empty result rather than defining anything.
    expect(await discover()).to.deep.equal([]);
  } finally {
    host.remove();
  }
});

it('makes default discovery safe in a document-less worker', async () => {
  const moduleUrl = new URL('./autoloader.ts', import.meta.url).href;
  const source = `
    const hasDocument = typeof document !== 'undefined';
    import(${JSON.stringify(moduleUrl)}).then(async ({ discover, start }) => {
      try {
        postMessage({ hasDocument, discovered: await discover(), started: await start() });
      } catch (error) {
        postMessage({
          hasDocument,
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
    }).catch((error) => {
      postMessage({
        hasDocument,
        importError: error instanceof Error ? error.message : String(error),
      });
    });
  `;
  const workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  try {
    const result = await new Promise<{
      hasDocument: boolean;
      discovered?: string[];
      started?: string[];
      errorName?: string;
      importError?: string;
    }>((resolve, reject) => {
      worker.addEventListener('message', (event) => resolve(event.data), {
        once: true,
      });
      worker.addEventListener('error', () => reject(new Error('The document-less autoloader probe failed to run')), {
        once: true,
      });
    });
    expect(result.hasDocument).to.equal(false);
    expect(result.importError).to.equal(undefined);
    expect(result.errorName).to.equal(undefined);
    expect(result.discovered).to.deep.equal([]);
    expect(result.started).to.deep.equal([]);
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
});
