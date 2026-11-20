import { expect } from '@open-wc/testing';
import { loadLazyChildren, type LazyChildLoaders } from './lazy-children.js';
import { tag } from './prefix.js';

class LazyChildFixture extends HTMLElement {
  rendered = false;
  readonly updateComplete = Promise.resolve().then(() => { this.rendered = true; return true; });
}

describe('loadLazyChildren', () => {
  let warnings: string[];
  let originalWarn: typeof console.warn;
  beforeEach(() => {
    originalWarn = console.warn;
    warnings = [];
    console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  });
  afterEach(() => { console.warn = originalWarn; });

  it('never rejects, forgets a failed import, and retries it on the next call', async () => {
    const name = `lazy-child-retry-${Math.random().toString(36).slice(2)}`;
    let attempts = 0;
    const loaders: LazyChildLoaders = {
      [name]: () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error('chunk failed'));
        customElements.define(tag(name), LazyChildFixture);
        return Promise.resolve();
      },
    };
    const root = document.createElement('div');
    root.append(document.createElement(tag(name)));
    document.body.append(root);

    expect(await loadLazyChildren(loaders, root)).to.equal(false);
    expect(attempts).to.equal(1);
    const retried = loadLazyChildren(loaders, root);
    expect(retried).to.not.equal(undefined);
    expect(await retried).to.equal(true);
    expect(attempts).to.equal(2);
    expect((root.firstElementChild as LazyChildFixture).rendered, 'awaits the upgraded child render').to.equal(true);
    expect(loadLazyChildren(loaders, root), 'a loaded child is not imported again').to.equal(undefined);
    root.remove();
  });

  it('settles each root own children when another root started the shared load', async () => {
    const name = `lazy-child-shared-${Math.random().toString(36).slice(2)}`;
    class SlowChild extends HTMLElement {
      rendered = false;
      readonly updateComplete = new Promise<void>(resolve => setTimeout(() => { this.rendered = true; resolve(); }, 30));
    }
    const loaders: LazyChildLoaders = {
      [name]: () => { customElements.define(tag(name), SlowChild); return Promise.resolve(); },
    };
    const first = document.createElement('div');
    const second = document.createElement('div');
    first.append(document.createElement(tag(name)));
    second.append(document.createElement(tag(name)));
    document.body.append(first, second);
    const a = loadLazyChildren(loaders, first);
    const b = loadLazyChildren(loaders, second);
    await Promise.all([a, b]);
    expect((second.firstElementChild as SlowChild).rendered, 'second root child rendered').to.equal(true);
    expect((first.firstElementChild as SlowChild).rendered).to.equal(true);
    first.remove();
    second.remove();
  });

  it('skips loaders whose child is absent from the root', () => {
    let attempts = 0;
    const loaders: LazyChildLoaders = { 'lazy-child-absent': () => { attempts += 1; return Promise.resolve(); } };
    expect(loadLazyChildren(loaders, document.createElement('div'))).to.equal(undefined);
    expect(attempts).to.equal(0);
  });
});
