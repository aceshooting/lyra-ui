import { expect, fixture, html } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  MatchConstraintController,
  readMatchConstraintValue,
  resolveMatchConstraintTarget,
  type LyraMatchTarget,
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

  it('resolves a string id to null when the host root has no id lookup (a detached subtree)', () => {
    const detachedHost = document.createElement('div');
    const sibling = detachedHost.appendChild(document.createElement('input'));
    sibling.id = 'password';
    const field = detachedHost.appendChild(document.createElement('input'));
    expect(field.getRootNode() === detachedHost, 'the root of a detached subtree is an element').to.equal(true);
    expect(resolveMatchConstraintTarget(field, 'password')).to.equal(null);
    document.body.append(detachedHost);
    try {
      expect(resolveMatchConstraintTarget(field, 'password') === sibling).to.equal(true);
    } finally {
      detachedHost.remove();
    }
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

describe('MatchConstraintController', () => {
  function setup(initial: LyraMatchTarget) {
    const controllers = new Set<ReactiveController>();
    const host = Object.assign(document.createElement('div'), {
      addController: (controller: ReactiveController) => controllers.add(controller),
      removeController: (controller: ReactiveController) => controllers.delete(controller),
      requestUpdate: () => {},
      updateComplete: Promise.resolve(true),
    }) satisfies Element & ReactiveControllerHost;
    document.body.append(host);
    let match = initial;
    let changes = 0;
    const controller = new MatchConstraintController(host, () => match, () => { changes += 1; });
    return {
      controller, host,
      setMatch: (next: LyraMatchTarget) => { match = next; },
      changes: () => changes,
      connect: () => [...controllers].forEach((entry) => entry.hostConnected?.()),
      update: () => [...controllers].forEach((entry) => entry.hostUpdated?.()),
      disconnect: () => { host.remove(); [...controllers].forEach((entry) => entry.hostDisconnected?.()); },
    };
  }

  it('reports whether the constraint resolves and follows the target value as it changes', () => {
    const target = document.body.appendChild(document.createElement('input'));
    target.id = 'match-constraint-password';
    const test = setup('match-constraint-password');
    try {
      expect(test.controller.hasTarget).to.equal(false);
      expect(test.controller.targetValue).to.equal(null);
      test.connect();
      expect(test.controller.hasTarget).to.equal(true);
      target.value = 'secret';
      expect(test.controller.targetValue).to.equal('secret');
      const before = test.changes();
      target.dispatchEvent(new Event('input'));
      target.dispatchEvent(new Event('change'));
      expect(test.changes()).to.equal(before + 2);
    } finally {
      test.disconnect();
      target.remove();
    }
  });

  it('treats a dangling or cleared constraint as unresolved and rebinds when the target is swapped', () => {
    const first = document.body.appendChild(document.createElement('input'));
    const second = document.body.appendChild(document.createElement('input'));
    const test = setup(first);
    try {
      test.connect();
      expect(test.controller.hasTarget).to.equal(true);
      const settled = test.changes();
      test.update();
      expect(test.changes(), 'an unchanged target is not rebound').to.equal(settled);

      test.setMatch(second);
      test.update();
      expect(test.changes()).to.equal(settled + 1);
      first.dispatchEvent(new Event('input'));
      expect(test.changes(), 'the previous target no longer notifies').to.equal(settled + 1);
      second.dispatchEvent(new Event('input'));
      expect(test.changes()).to.equal(settled + 2);

      test.setMatch('does-not-exist');
      test.update();
      expect(test.controller.hasTarget, 'a dangling id leaves the constraint inert').to.equal(false);
      expect(test.controller.targetValue).to.equal(null);
      test.setMatch(null);
      test.update();
      expect(test.controller.hasTarget).to.equal(false);
    } finally {
      test.disconnect();
      first.remove();
      second.remove();
    }
  });

  it('stops listening once the host disconnects', () => {
    const target = document.body.appendChild(document.createElement('input'));
    const test = setup(target);
    try {
      test.connect();
      test.disconnect();
      const before = test.changes();
      target.dispatchEvent(new Event('input'));
      expect(test.changes()).to.equal(before);
      expect(test.controller.hasTarget).to.equal(false);
    } finally {
      target.remove();
    }
  });
});
