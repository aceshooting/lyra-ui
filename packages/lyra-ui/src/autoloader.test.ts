import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import {
  AUTOLOADER_PENDING_ATTRIBUTE,
  discover,
  start,
  stop,
  type AutoloadableTagName,
} from './autoloader.js';
import { setAutoloaderLoaderForTesting } from './internal/autoloader-loaders.js';

const overriddenTags = new Set<AutoloadableTagName>();

function constructorForTag(): CustomElementConstructor {
  return class extends HTMLElement {};
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
      async () => class extends HTMLElement {
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

    const first = document.createElement(tag) as HTMLElement & { finishUpdate(): void };
    root.append(first);
    await aTimeout(0);
    const second = document.createElement(tag) as HTMLElement & { finishUpdate(): void };
    root.append(second);
    await aTimeout(0);
    expect(first.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);
    expect(second.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

    resolveConstructor(class extends HTMLElement {
      private resolveUpdate!: () => void;
      readonly updateComplete = new Promise<void>((resolve) => {
        this.resolveUpdate = resolve;
      });

      finishUpdate(): void {
        this.resolveUpdate();
      }
    });
    await customElements.whenDefined(tag);

    first.finishUpdate();
    await aTimeout(0);
    expect(first.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(false);
    expect(second.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

    second.finishUpdate();
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
    customElements.define(hostTag, class extends HTMLElement {
      private resolveUpdate!: () => void;
      readonly updateComplete = new Promise<void>((resolve) => {
        this.resolveUpdate = resolve;
      });

      finishUpdate(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.append(document.createElement(childTag));
        this.resolveUpdate();
      }
    });
    const root = await fixture<HTMLElement>(html`<div></div>`);
    await start(root);

    const host = document.createElement(hostTag) as HTMLElement & { finishUpdate(): void };
    root.append(host);
    await aTimeout(0);
    expect(host.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)).to.equal(true);

    host.finishUpdate();
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

  it('defines into the scoped registry associated with an open shadow root', async () => {
    const tag = 'lr-activity-feed';
    override(tag, async () => constructorForTag());
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const registry = createScopedRegistry();
    Object.defineProperty(shadow, 'customElementRegistry', { configurable: true, value: registry });
    shadow.append(document.createElement(tag));
    try {
      expect(await discover(host)).to.deep.equal([tag]);
      expect(typeof registry.get(tag)).to.equal('function');
      expect(customElements.get(tag)).to.equal(undefined);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
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
    const error = await errorEvent as CustomEvent<{ tag: string }>;
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

  it('excludes optional-peer tags by default and enables only a complete explicit peer set', async () => {
    const tag = 'lr-flag';
    let calls = 0;
    override(tag, async () => {
      calls += 1;
      return constructorForTag();
    });
    const root = await fixture<HTMLElement>(html`<div><lr-flag></lr-flag></div>`);

    expect(await discover(root)).to.deep.equal([]);
    expect(calls).to.equal(0);
    expect(customElements.get(tag)).to.equal(undefined);

    await discover(root, { optionalPeers: ['@aceshooting/lyra-flags'] });
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
    for (const optionalPeers of [[''], [' dompurify'], 1] as unknown[]) {
      let message = '';
      try {
        await discover(root, { optionalPeers: optionalPeers as never });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).to.include('optionalPeers');
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
    const peers = {
      has: (peer: string) => peer === 'shiki',
      *[Symbol.iterator]() {
        yield 'shiki';
      },
    } as ReadonlySet<string>;

    await discover(root, { optionalPeers: peers });
    expect(calls).to.equal(1);
    expect(customElements.get(tag)).to.be.a('function');
  });
});
