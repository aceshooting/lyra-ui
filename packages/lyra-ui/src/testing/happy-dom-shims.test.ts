import { expect } from '@open-wc/testing';
import {
  installHappyDomFormAssociatedShims,
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

  it('installs a stub whose setValidity accepts every call shape AnchoredValidityController uses without throwing', () => {
    const div = document.createElement('div');
    const stub = installStubInternalsForTest(div);
    expect(() => stub.setValidity({})).to.not.throw();
    expect(() => stub.setValidity({ customError: true }, 'message')).to.not.throw();
    expect(() => stub.setValidity({ customError: true }, 'message', div)).to.not.throw();
  });
});
