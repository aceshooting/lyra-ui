import { expect, fixture, html } from '@open-wc/testing';
import { allDefined } from './defined.js';

describe('allDefined', () => {
  it('waits for a known tag at the root itself using the owning document registry', async () => {
    const root = await fixture<HTMLElement>(html`<lr-animation></lr-animation>`);
    let resolved = false;
    const pending = allDefined(root).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).to.equal(false);

    customElements.define('lr-animation', class extends HTMLElement {});
    await pending;
    expect(resolved).to.equal(true);
  });

  it('traverses open shadow roots and honors their scoped registry when present', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(document.createElement('lr-avatar'));
    const calls: string[] = [];
    const constructor = class extends HTMLElement {};
    const registry = {
      get(name: string) {
        return name === 'lr-avatar' ? constructor : undefined;
      },
      whenDefined(name: string) {
        calls.push(name);
        return Promise.resolve(constructor);
      },
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    try {
      await allDefined(host);
      expect(calls).to.deep.equal(['lr-avatar']);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('repeats after first render to wait for newly rendered known tags', async () => {
    const root = await fixture<HTMLElement>(html`<div><lr-avatar-group></lr-avatar-group></div>`);
    let resolved = false;
    const pending = allDefined(root).then(() => {
      resolved = true;
    });

    customElements.define(
      'lr-avatar-group',
      class extends HTMLElement {
        readonly updateComplete = Promise.resolve().then(() => {
          const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
          shadow.append(document.createElement('lr-avatar'));
        });
      },
    );
    await customElements.whenDefined('lr-avatar-group');
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).to.equal(false);

    customElements.define('lr-avatar', class extends HTMLElement {});
    await pending;
    expect(resolved).to.equal(true);
  });

  it('ignores unknown lr-* names rather than waiting forever', async () => {
    const root = await fixture<HTMLElement>(html`<div><lr-not-a-library-component></lr-not-a-library-component></div>`);
    await allDefined(root);
  });

  it('skips hostile registry discovery for one element while waiting for valid siblings', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const hostileGetter = document.createElement('lr-badge');
    Object.defineProperty(hostileGetter, 'getRootNode', {
      configurable: true,
      get(): never {
        throw new Error('hostile getter');
      },
    });
    const hostileFunction = document.createElement('lr-button');
    Object.defineProperty(hostileFunction, 'getRootNode', {
      configurable: true,
      value(): never {
        throw new Error('hostile function');
      },
    });
    const valid = document.createElement('lr-avatar');
    shadow.append(hostileGetter, valid, hostileFunction);

    const calls: string[] = [];
    const constructor = class extends HTMLElement {};
    const registry = {
      get(name: string) {
        return name === 'lr-avatar' ? constructor : undefined;
      },
      whenDefined(name: string) {
        calls.push(name);
        return Promise.resolve(constructor);
      },
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });
    try {
      await allDefined(host);
      expect(calls).to.deep.equal(['lr-avatar']);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('resolves safely when no root is available', async () => {
    await allDefined(undefined);
  });

  it('walks 5,000 nested open shadow roots without recursive-stack exhaustion', async () => {
    const root = document.createDocumentFragment();
    let parent: DocumentFragment | ShadowRoot = root;
    for (let index = 0; index < 5_000; index += 1) {
      const host = document.createElement('div');
      parent.append(host);
      parent = host.attachShadow({ mode: 'open' });
    }

    await allDefined(root, {
      maxElements: 5_001,
      maxRoots: 5_001,
      maxDepth: 5_001,
      maxWork: 25_000,
    });
  });

  it('rejects truthfully when the rendered element ceiling is exceeded', async () => {
    const root = document.createDocumentFragment();
    root.append(document.createElement('div'), document.createElement('div'), document.createElement('div'));

    let error: unknown;
    try {
      await allDefined(root, { maxElements: 2 });
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof Error).to.equal(true);
    expect((error as Error).message).to.include('maxElements');
  });

  it('applies the element ceiling cumulatively across render-discovery passes', async () => {
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const first = document.createElement('lr-avatar');
    const second = document.createElement('lr-badge');
    Object.defineProperty(first, 'updateComplete', {
      configurable: true,
      value: Promise.resolve().then(() => shadow.replaceChildren(second)),
    });
    shadow.append(first);
    const constructor = class extends HTMLElement {};
    const registry = {
      get(name: string) {
        return name === 'lr-avatar' || name === 'lr-badge' ? constructor : undefined;
      },
      whenDefined() {
        return Promise.resolve(constructor);
      },
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });

    try {
      let error: unknown;
      try {
        await allDefined(shadow, { maxElements: 1 });
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof Error).to.equal(true);
      expect((error as Error).message).to.include('maxElements');
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('uses maxPasses for productive passes and permits the final empty confirmation scan', async () => {
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const element = document.createElement('lr-avatar');
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      value: Promise.resolve(),
    });
    shadow.append(element);
    const constructor = class extends HTMLElement {};
    const registry = {
      get: () => constructor,
      whenDefined: () => Promise.resolve(constructor),
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });

    try {
      await allDefined(shadow, { maxPasses: 1 });
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('contains missing and throwing scoped-registry methods without blocking readiness', async () => {
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(document.createElement('lr-avatar'), document.createElement('lr-avatar'));
    const constructor = class extends HTMLElement {};
    let definitionCalls = 0;
    const throwingGet = {
      get(): never {
        throw new Error('registry get unavailable');
      },
      whenDefined() {
        definitionCalls += 1;
        return Promise.resolve(constructor);
      },
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: throwingGet,
    });

    try {
      await allDefined(shadow);
      expect(definitionCalls, 'duplicate tags share one registry wait').to.equal(1);

      Object.defineProperty(shadow, 'customElementRegistry', {
        configurable: true,
        value: { get: () => constructor, whenDefined: undefined },
      });
      await allDefined(shadow);

      Object.defineProperty(shadow, 'customElementRegistry', {
        configurable: true,
        value: {
          get: () => constructor,
          whenDefined(): never {
            throw new Error('registry wait unavailable');
          },
        },
      });
      await allDefined(shadow);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('rejects when a completed update keeps discovering new known elements beyond maxPasses', async () => {
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const first = document.createElement('lr-avatar');
    const second = document.createElement('lr-badge');
    Object.defineProperty(first, 'updateComplete', {
      configurable: true,
      value: Promise.resolve().then(() => shadow.replaceChildren(second)),
    });
    shadow.append(first);
    const constructor = class extends HTMLElement {};
    const registry = {
      get: () => constructor,
      whenDefined: () => Promise.resolve(constructor),
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });

    try {
      let error: unknown;
      try {
        await allDefined(shadow, { maxPasses: 1 });
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof Error).to.equal(true);
      expect((error as Error).message).to.include('maxPasses (1)');
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('bypasses hostile traversal and update getters without blocking valid siblings', async () => {
    const host = await fixture<HTMLElement>(html`<section></section>`);
    const shadow = host.attachShadow({ mode: 'open' });
    const hostile = document.createElement('lr-badge');
    for (const property of [
      'nodeType',
      'localName',
      'firstElementChild',
      'nextElementSibling',
      'shadowRoot',
      'updateComplete',
    ]) {
      Object.defineProperty(hostile, property, {
        configurable: true,
        get(): never {
          throw new Error(`hostile ${property}`);
        },
      });
    }
    let validUpdateReads = 0;
    const valid = document.createElement('lr-avatar');
    Object.defineProperty(valid, 'updateComplete', {
      configurable: true,
      get() {
        validUpdateReads += 1;
        return Promise.resolve();
      },
    });
    shadow.append(hostile, valid);
    const constructor = class extends HTMLElement {};
    const registry = {
      get: () => constructor,
      whenDefined: () => Promise.resolve(constructor),
    } as unknown as CustomElementRegistry;
    Object.defineProperty(shadow, 'customElementRegistry', {
      configurable: true,
      value: registry,
    });

    try {
      await allDefined(shadow);
      expect(validUpdateReads).to.equal(1);
    } finally {
      delete (shadow as unknown as Record<string, unknown>)['customElementRegistry'];
    }
  });

  it('rejects truthfully when open-shadow-root or total-work ceilings are exceeded', async () => {
    const root = document.createDocumentFragment();
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    root.append(outer);
    outer.attachShadow({ mode: 'open' }).append(inner);
    inner.attachShadow({ mode: 'open' });

    for (const options of [{ maxRoots: 2 }, { maxWork: 1 }]) {
      let error: unknown;
      try {
        await allDefined(root, options);
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof Error).to.equal(true);
      expect((error as Error).message).to.match(/maxRoots|maxWork/);
    }
  });

  it('rejects invalid traversal ceilings before walking the tree', async () => {
    for (const options of [
      { maxElements: Number.NaN },
      { maxRoots: -1 },
      { maxDepth: -1 },
      { maxWork: Number.POSITIVE_INFINITY },
      { maxPasses: 0 },
    ]) {
      let error: unknown;
      try {
        await allDefined(document.createDocumentFragment(), options);
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof RangeError).to.equal(true);
    }
  });
});
