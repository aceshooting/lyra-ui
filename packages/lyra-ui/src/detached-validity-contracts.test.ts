import { expect } from '@open-wc/testing';
import './all.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';

interface ValidityControl extends HTMLElement {
  readonly validity: ValidityState;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
}

// Constraint APIs are synchronous native contracts, including before a framework mounts a ref.
for (const tag of ROOT_BARREL_TAGS) {
  const prototype = customElements.get(tag)?.prototype as Partial<ValidityControl> | undefined;
  if (!prototype || typeof prototype.checkValidity !== 'function' || typeof prototype.setCustomValidity !== 'function' ||
    typeof prototype.reportValidity !== 'function' || !('validity' in prototype) || !('validationMessage' in prototype)) continue;

  it(`${tag} supports custom validity before its first render without stealing focus`, () => {
    const element = document.createElement(tag) as ValidityControl;
    const focused = document.activeElement;
    let invalid = 0;
    element.addEventListener('invalid', event => { invalid++; event.preventDefault(); });
    const initiallyValid = element.checkValidity();
    const initialMessage = element.validationMessage;
    invalid = 0;
    element.setCustomValidity('Choose another value');
    expect(element.validity.customError).to.equal(true);
    if (element.willValidate) {
      expect(element.validationMessage).to.equal('Choose another value');
      expect(element.checkValidity()).to.equal(false);
      expect(element.reportValidity()).to.equal(false);
      expect(invalid).to.equal(2);
    }
    element.setCustomValidity('');
    expect(element.validity.customError).to.equal(false);
    expect(element.checkValidity()).to.equal(initiallyValid);
    expect(element.validationMessage).to.equal(initialMessage);
    expect(element.reportValidity()).to.equal(initiallyValid);
    expect(document.activeElement === focused).to.equal(true);
    expect(element.isConnected).to.equal(false);
  });
}
