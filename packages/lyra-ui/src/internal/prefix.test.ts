import { expect } from '@open-wc/testing';
import { defineElement, defineElementForPackageVersion, isRegisteredLyraElement, tag } from './prefix.js';

let sequence = 0;
function uniqueName(label: string): string {
  sequence += 1;
  return `diagnostic-${label}-${Date.now().toString(36)}-${sequence}`;
}

describe('defineElement registration diagnostics', () => {
  it('keeps repeated registration of the same constructor silent and idempotent', () => {
    const name = uniqueName('same');
    class SameConstructor extends HTMLElement {}
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      defineElementForPackageVersion(name, SameConstructor, '7.8.1');
      defineElementForPackageVersion(name, SameConstructor, '8.0.0');
      expect(customElements.get(tag(name))).to.equal(SameConstructor);
      expect(calls).to.have.lengthOf(0);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('reports old/new versions and passes both constructor references without replacing the tag', () => {
    const name = uniqueName('versions');
    class ExistingConstructor extends HTMLElement {}
    class IncomingConstructor extends HTMLElement {}
    class OtherIncomingConstructor extends HTMLElement {}
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      defineElementForPackageVersion(name, ExistingConstructor, '7.8.1');
      defineElementForPackageVersion(name, IncomingConstructor, '8.0.0');
      defineElementForPackageVersion(name, IncomingConstructor, '8.0.0');
      expect(calls).to.have.lengthOf(1);
      const [message, existing, incoming] = calls[0] ?? [];
      expect(String(message)).to.include(tag(name));
      expect(String(message)).to.include('7.8.1');
      expect(String(message)).to.include('8.0.0');
      expect(String(message)).to.include('ExistingConstructor');
      expect(String(message)).to.include('IncomingConstructor');
      expect(existing).to.equal(ExistingConstructor);
      expect(incoming).to.equal(IncomingConstructor);
      expect(customElements.get(tag(name))).to.equal(ExistingConstructor);

      defineElementForPackageVersion(name, OtherIncomingConstructor, '8.0.0');
      expect(calls).to.have.lengthOf(2);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('labels an existing constructor with no Lyra provenance as unknown', () => {
    const name = uniqueName('legacy');
    class LegacyConstructor extends HTMLElement {}
    class IncomingConstructor extends HTMLElement {}
    customElements.define(tag(name), LegacyConstructor);
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      defineElementForPackageVersion(name, IncomingConstructor, '8.0.0');
      expect(calls).to.have.lengthOf(1);
      expect(String(calls[0]?.[0])).to.include('unknown');
      expect(calls[0]?.[1]).to.equal(LegacyConstructor);
      expect(calls[0]?.[2]).to.equal(IncomingConstructor);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('does not invent provenance after silently observing the same external constructor', () => {
    const name = uniqueName('observed-legacy');
    class LegacyConstructor extends HTMLElement {}
    class IncomingConstructor extends HTMLElement {}
    customElements.define(tag(name), LegacyConstructor);
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      defineElement(name, LegacyConstructor);
      defineElementForPackageVersion(name, IncomingConstructor, '8.0.0');
      expect(calls).to.have.lengthOf(1);
      expect(String(calls[0]?.[0])).to.include('unknown');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('shares provenance and conflict de-duplication across separate module instances', async () => {
    const copyAPath = '../../dist/internal/prefix.js?diagnostics-copy=a';
    const copyBPath = '../../dist/internal/prefix.js?diagnostics-copy=b';
    const copyA = await import(copyAPath);
    const copyB = await import(copyBPath);
    const name = uniqueName('copies');
    class ExistingConstructor extends HTMLElement {}
    class IncomingConstructor extends HTMLElement {}
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      copyA.defineElementForPackageVersion(name, ExistingConstructor, '7.7.0');
      copyB.defineElementForPackageVersion(name, IncomingConstructor, '8.0.0');
      copyA.defineElementForPackageVersion(name, IncomingConstructor, '8.0.0');
      expect(calls).to.have.lengthOf(1);
      expect(String(calls[0]?.[0])).to.include('7.7.0');
      expect(String(calls[0]?.[0])).to.include('8.0.0');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('does not attach provenance properties to constructors', () => {
    const name = uniqueName('immutable');
    class RegisteredConstructor extends HTMLElement {}
    const before = Reflect.ownKeys(RegisteredConstructor);
    defineElement(name, RegisteredConstructor);
    expect(Reflect.ownKeys(RegisteredConstructor)).to.deep.equal(before);
  });
});

describe('anonymous constructors in registration diagnostics', () => {
  it('names an anonymous constructor in the conflict message', () => {
    const name = uniqueName('anonymous');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      defineElementForPackageVersion(name, class extends HTMLElement {}, '7.8.1');
      defineElementForPackageVersion(name, class extends HTMLElement {}, '8.0.0');
      expect(calls).to.have.lengthOf(1);
      expect(String(calls[0]?.[0]).split('(anonymous constructor)')).to.have.lengthOf(3);
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('isRegisteredLyraElement', () => {
  it('recognizes instances of registered constructors only', () => {
    const name = uniqueName('registered');
    class Registered extends HTMLElement {}
    defineElement(name, Registered);
    expect(isRegisteredLyraElement(document.createElement(tag(name)))).to.equal(true);

    const outsider = uniqueName('outsider');
    class Outsider extends HTMLElement {}
    customElements.define(`app-${outsider}`, Outsider);
    expect(isRegisteredLyraElement(document.createElement(`app-${outsider}`)), 'an application element is not a Lyra one').to.equal(false);
    expect(isRegisteredLyraElement(document.createElement('div')), 'a non-custom element is never registered').to.equal(false);
  });

  it('answers false for a custom-named element of a document without a browsing context', () => {
    const ownerless = document.implementation.createHTMLDocument('ownerless');
    expect(isRegisteredLyraElement(ownerless.createElement('x-widget'))).to.equal(false);
  });
});
