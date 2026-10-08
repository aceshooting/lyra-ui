import { expect } from '@open-wc/testing';
import {
  createAriaControlsElementsDescriptor,
  guardShadowActiveElement,
  installHappyDomAriaControlsShim,
  installHappyDomFormAssociatedShims,
  installHappyDomShadowFocusShim,
  installHappyDomShims,
  installStubInternalsForTest,
} from './happy-dom-shims.js';

describe('installHappyDomFormAssociatedShims', () => {
  it('is a no-op in a real browser (attachInternals already exists natively)', () => {
    const original = HTMLElement.prototype.attachInternals;
    installHappyDomFormAssociatedShims();
    expect(HTMLElement.prototype.attachInternals).to.equal(original);
  });

  it('does not throw when HTMLElement is not a global at all (a plain-Node test project sharing one setupFiles entry with a DOM project)', () => {
    // Can't literally delete HTMLElement in a real browser test-runner env; simulate the
    // ReferenceError-throwing lookup the function must guard against instead.
    const globalWithHtmlElement = globalThis as unknown as { HTMLElement?: unknown };
    const original = globalWithHtmlElement.HTMLElement;
    delete globalWithHtmlElement.HTMLElement;
    try {
      expect(() => installHappyDomFormAssociatedShims()).to.not.throw();
    } finally {
      globalWithHtmlElement.HTMLElement = original;
    }
  });

  it('installs a stub whose setFormValue accepts every call shape used across the library without throwing', () => {
    // Force-install the stub even though attachInternals exists natively here, purely to verify
    // the stub object's own shape in isolation (the real guard is exercised by the test above).
    const div = document.createElement('div');
    const stub = installStubInternalsForTest(div);
    expect(() => stub.setFormValue('')).to.not.throw();
    expect(() => stub.setFormValue(null, 'unchecked')).to.not.throw();
    expect(() => stub.setFormValue(new FormData(), '[]')).to.not.throw();
    expect(stub.validity.valid).to.be.true;
    expect(() => stub.checkValidity()).to.not.throw();
    expect(() => stub.reportValidity()).to.not.throw();
    expect(stub.form).to.be.null;
    expect(stub.labels.length).to.equal(0);
    expect(stub.validationMessage).to.equal('');
    expect(stub.willValidate).to.be.true;
  });

  it('resolves `form` to the host\'s owning <form>, live -- not snapshotted at attach time', () => {
    // A form-associated component calls attachInternals() from its own constructor, which the
    // platform always runs BEFORE the element is inserted anywhere -- host.closest('form') at
    // that instant can only ever see null, even when the element is later appended into a real
    // <form>. A `form` value captured once at stub-creation time would therefore always be null,
    // exactly like a plain `<lr-button>` resolving its submit target through `this.internals.form`
    // instead of `closest('form')`: it would silently find no form owner under this shim,
    // regardless of the real DOM. Reading `form` must re-resolve against the host's current
    // position every time, the same way the platform's own ElementInternals.form getter does.
    const host = document.createElement('div');
    const stub = installStubInternalsForTest(host); // "attachInternals()", host not yet inserted
    expect(stub.form, 'not yet inserted anywhere').to.be.null;

    const form = document.createElement('form');
    form.appendChild(host);
    document.body.appendChild(form);
    try {
      // Never chai-compare DOM nodes directly (hangs the whole file) -- compare identity as a
      // plain boolean instead.
      expect(stub.form === form, 'now a descendant of a real <form>').to.be.true;
    } finally {
      form.remove();
    }

    host.remove();
    expect(stub.form, 'removed from the form again').to.be.null;
  });

  it('installs a stub whose setValidity accepts every call shape AnchoredValidityController uses without throwing', () => {
    const div = document.createElement('div');
    const stub = installStubInternalsForTest(div);
    expect(() => stub.setValidity({})).to.not.throw();
    expect(() => stub.setValidity({ customError: true }, 'message')).to.not.throw();
    expect(() => stub.setValidity({ customError: true }, 'message', div)).to.not.throw();
  });

  it('installs a stub whose states supports the CustomStateSet calls form-associated components make', () => {
    const div = document.createElement('div');
    const stub = installStubInternalsForTest(div);
    expect(() => stub.states.add('blank')).to.not.throw();
    expect(stub.states.has('blank')).to.be.true;
    expect(() => stub.states.delete('blank')).to.not.throw();
    expect(stub.states.has('blank')).to.be.false;
  });
});

describe('installHappyDomShadowFocusShim', () => {
  // Fake of Happy DOM's getter: own and nested focus resolve, a sibling root dereferences a
  // missing host and throws a TypeError.
  function fakeRoots() {
    const focused = { id: 'focused' };
    const proto = {
      get activeElement(): unknown {
        const self = this as unknown as { owns: boolean };
        if (!self.owns) throw new TypeError("Cannot read properties of null (reading 'getRootNode')");
        return focused;
      },
    };
    const own = Object.create(proto, { owns: { value: true } }) as { activeElement: { id: string } | null };
    const nested = Object.create(proto, { owns: { value: true } }) as { activeElement: { id: string } | null };
    const sibling = Object.create(proto, { owns: { value: false } }) as { activeElement: { id: string } | null };
    return { proto, own, nested, sibling };
  }

  it('returns null for a sibling shadow root and keeps own and nested focus', () => {
    const { proto, own, nested, sibling } = fakeRoots();
    expect(() => sibling.activeElement).to.throw(TypeError);
    const restore = guardShadowActiveElement(proto, () => true);
    expect(typeof restore).to.equal('function');
    expect(sibling.activeElement === null).to.be.true;
    expect(own.activeElement?.id).to.equal('focused');
    expect(nested.activeElement?.id).to.equal('focused');
    restore?.();
    expect(() => sibling.activeElement).to.throw(TypeError);
  });

  it('rethrows errors that are not the detached/sibling TypeError', () => {
    const proto = {
      get activeElement(): never {
        throw new RangeError('boom');
      },
    };
    guardShadowActiveElement(proto, () => true);
    expect(() => (proto as { activeElement: unknown }).activeElement).to.throw(RangeError);
  });

  it('leaves a correctly behaving getter untouched', () => {
    const { proto, sibling } = fakeRoots();
    const before = Object.getOwnPropertyDescriptor(proto, 'activeElement')?.get;
    expect(guardShadowActiveElement(proto, () => false)).to.equal(undefined);
    expect(Object.getOwnPropertyDescriptor(proto, 'activeElement')?.get === before).to.be.true;
    expect(() => sibling.activeElement).to.throw(TypeError);
  });

  it('is a no-op in a real browser and reports own focus natively', () => {
    const before = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'activeElement')?.get;
    installHappyDomShadowFocusShim();
    expect(Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'activeElement')?.get === before).to.be.true;
    const hosts = [document.createElement('div'), document.createElement('div')];
    const roots = hosts.map((host) => host.attachShadow({ mode: 'open' }));
    const button = document.createElement('button');
    roots[0]?.appendChild(button);
    hosts.forEach((host) => document.body.appendChild(host));
    try {
      button.focus();
      expect(roots[0]?.activeElement === button).to.be.true;
      expect(roots[1]?.activeElement === null).to.be.true;
    } finally {
      button.blur();
      hosts.forEach((host) => host.remove());
    }
  });
});

describe('ariaControlsElements shim', () => {
  function mount(): { outer: HTMLElement; rootA: ShadowRoot; rootB: ShadowRoot; cleanup: () => void } {
    const outer = document.createElement('div');
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    const rootA = hostA.attachShadow({ mode: 'open' });
    const rootB = hostB.attachShadow({ mode: 'open' });
    outer.append(hostA, hostB);
    document.body.appendChild(outer);
    return { outer, rootA, rootB, cleanup: () => outer.remove() };
  }
  function shimmed(...elements: Element[]): void {
    const descriptor = createAriaControlsElementsDescriptor();
    elements.forEach((element) => Object.defineProperty(element, 'ariaControlsElements', descriptor));
  }
  const read = (el: Element): Element[] | null =>
    (el as unknown as { ariaControlsElements: Element[] | null }).ariaControlsElements;
  const write = (el: Element, value: Element[] | null): void => {
    (el as unknown as { ariaControlsElements: Element[] | null }).ariaControlsElements = value;
  };

  it('returns same-scope and ancestor-scope references and rejects sibling and descendant shadow targets', () => {
    const { outer, rootA, rootB, cleanup } = mount();
    try {
      const trigger = document.createElement('button');
      const sameScope = document.createElement('div');
      const ancestorScope = document.createElement('div');
      const sibling = document.createElement('div');
      rootA.append(trigger, sameScope);
      outer.appendChild(ancestorScope);
      rootB.appendChild(sibling);
      const hostTrigger = document.createElement('button');
      outer.appendChild(hostTrigger);
      shimmed(trigger, hostTrigger);
      write(trigger, [sameScope, ancestorScope, sibling]);
      const got = read(trigger) ?? [];
      expect(got.length).to.equal(2);
      expect(got[0] === sameScope && got[1] === ancestorScope).to.be.true;
      write(hostTrigger, [ancestorScope, sameScope]);
      const outerGot = read(hostTrigger) ?? [];
      expect(outerGot.length).to.equal(1);
      expect(outerGot[0] === ancestorScope).to.be.true;
    } finally {
      cleanup();
    }
  });

  it('clears the reference and the aria-controls attribute when set to null', () => {
    const { outer, cleanup } = mount();
    try {
      const trigger = document.createElement('button');
      const target = document.createElement('div');
      outer.append(trigger, target);
      shimmed(trigger);
      write(trigger, [target]);
      expect(trigger.hasAttribute('aria-controls')).to.be.true;
      expect(read(trigger)?.length).to.equal(1);
      write(trigger, null);
      expect(trigger.hasAttribute('aria-controls')).to.be.false;
      expect(read(trigger) === null).to.be.true;
    } finally {
      cleanup();
    }
  });

  it('falls back to id resolution within the same root and ignores dangling ids', () => {
    const { rootA, rootB, cleanup } = mount();
    try {
      const trigger = document.createElement('button');
      const target = document.createElement('div');
      target.id = 'panel';
      const foreign = document.createElement('div');
      foreign.id = 'foreign';
      rootA.append(trigger, target);
      rootB.appendChild(foreign);
      shimmed(trigger);
      trigger.setAttribute('aria-controls', 'panel foreign missing');
      const got = read(trigger) ?? [];
      expect(got.length).to.equal(1);
      expect(got[0] === target).to.be.true;
    } finally {
      cleanup();
    }
  });

  it('prefers a changed attribute over a stale explicit reference', () => {
    const { outer, cleanup } = mount();
    try {
      const trigger = document.createElement('button');
      const explicit = document.createElement('div');
      const byId = document.createElement('div');
      byId.id = 'by-id';
      outer.append(trigger, explicit, byId);
      shimmed(trigger);
      write(trigger, [explicit]);
      trigger.setAttribute('aria-controls', 'by-id');
      const got = read(trigger) ?? [];
      expect(got.length).to.equal(1);
      expect(got[0] === byId).to.be.true;
    } finally {
      cleanup();
    }
  });

  it('installs only when the property is absent', () => {
    const native = {};
    Object.defineProperty(native, 'ariaControlsElements', { value: 'native', configurable: true });
    installHappyDomAriaControlsShim(native);
    expect((native as { ariaControlsElements: string }).ariaControlsElements).to.equal('native');
    const absent = {};
    installHappyDomAriaControlsShim(absent);
    expect('ariaControlsElements' in absent).to.be.true;
  });

  it('installHappyDomShims is a no-op on a real browser', () => {
    const before = Object.getOwnPropertyDescriptor(Element.prototype, 'ariaControlsElements');
    const beforeInternals = HTMLElement.prototype.attachInternals;
    installHappyDomShims();
    expect(Object.getOwnPropertyDescriptor(Element.prototype, 'ariaControlsElements')?.get === before?.get).to.be.true;
    expect(HTMLElement.prototype.attachInternals).to.equal(beforeInternals);
  });
});
