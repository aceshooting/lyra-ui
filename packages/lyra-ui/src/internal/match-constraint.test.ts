import { expect, fixture, html } from '@open-wc/testing';
import {
  readMatchConstraintValue,
  resolveMatchConstraintTarget,
} from './match-constraint.js';

const outerTag = 'lr-match-constraint-test-outer';
const innerTag = 'lr-match-constraint-test-inner';

if (!customElements.get(innerTag)) {
  customElements.define(
    innerTag,
    class extends HTMLElement {
      connectedCallback(): void {
        this.attachShadow({ mode: 'open' }).innerHTML =
          '<input id="inner-field" value="inner-value" />';
      }
    },
  );
}

if (!customElements.get(outerTag)) {
  customElements.define(
    outerTag,
    class extends HTMLElement {
      connectedCallback(): void {
        this.attachShadow({ mode: 'open' }).innerHTML =
          `<input id="host-field" /><${innerTag} id="nested"></${innerTag}>`;
      }
    },
  );
}

describe('resolveMatchConstraintTarget', () => {
  it('resolves a same-root id to the matching element', async () => {
    const root = await fixture<HTMLElement>(
      html`<div><input id="password" /><input id="confirm" /></div>`,
    );
    const confirm = root.querySelector('#confirm')!;
    const password = root.querySelector('#password');
    expect(resolveMatchConstraintTarget(confirm, 'password') === password).to.be.true;
  });

  it('returns null for a dangling id (no matching element in the tree)', async () => {
    const root = await fixture<HTMLElement>(html`<div><input id="confirm" /></div>`);
    const confirm = root.querySelector('#confirm')!;
    expect(resolveMatchConstraintTarget(confirm, 'does-not-exist')).to.equal(null);
  });

  it('returns null, undefined, and empty-string matches as null (no constraint)', async () => {
    const root = await fixture<HTMLElement>(html`<div><input id="confirm" /></div>`);
    const confirm = root.querySelector('#confirm')!;
    expect(resolveMatchConstraintTarget(confirm, null)).to.equal(null);
    expect(resolveMatchConstraintTarget(confirm, '')).to.equal(null);
  });

  it('returns a direct element reference as-is, even one outside the host document', () => {
    const detached = document.createElement('input');
    const host = document.createElement('input');
    expect(resolveMatchConstraintTarget(host, detached) === detached).to.be.true;
  });

  it('resolves an element reference across a shadow boundary (no lookup required)', async () => {
    const root = await fixture<HTMLElement>(
      html`<div><lr-match-constraint-test-outer></lr-match-constraint-test-outer></div>`,
    );
    const outer = root.querySelector(outerTag)!;
    const inner = outer.shadowRoot!.querySelector(innerTag)!;
    const innerField = inner.shadowRoot!.querySelector('#inner-field') as HTMLElement;
    const hostField = outer.shadowRoot!.querySelector('#host-field') as HTMLElement;
    expect(resolveMatchConstraintTarget(hostField, innerField) === innerField).to.be.true;
  });

  it('never resolves a string id across a shadow boundary (idrefs do not cross shadow roots)', async () => {
    const root = await fixture<HTMLElement>(
      html`<div><lr-match-constraint-test-outer></lr-match-constraint-test-outer></div>`,
    );
    const outer = root.querySelector(outerTag)!;
    const hostField = outer.shadowRoot!.querySelector('#host-field') as HTMLElement;
    // "inner-field" only exists inside the nested component's own shadow root, one level below
    // `hostField`'s own root -- an id reference must not reach through that boundary.
    expect(resolveMatchConstraintTarget(hostField, 'inner-field')).to.equal(null);
  });
});

describe('readMatchConstraintValue', () => {
  it('reads a plain string .value off the target', async () => {
    const root = await fixture<HTMLElement>(html`<div><input id="a" value="hello" /></div>`);
    const input = root.querySelector('#a') as HTMLElement;
    expect(readMatchConstraintValue(input)).to.equal('hello');
  });

  it('returns null for a null target and for a target with no string .value', () => {
    expect(readMatchConstraintValue(null)).to.equal(null);
    const span = document.createElement('span');
    expect(readMatchConstraintValue(span)).to.equal(null);
  });
});
