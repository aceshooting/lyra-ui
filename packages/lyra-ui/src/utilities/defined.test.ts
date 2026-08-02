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
    Object.defineProperty(shadow, 'customElementRegistry', { configurable: true, value: registry });
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

    customElements.define('lr-avatar-group', class extends HTMLElement {
      readonly updateComplete = Promise.resolve().then(() => {
        const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
        shadow.append(document.createElement('lr-avatar'));
      });
    });
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

  it('resolves safely when no root is available', async () => {
    await allDefined(undefined);
  });
});
