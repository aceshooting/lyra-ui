import { expect, fixtureCleanup, oneEvent } from '@open-wc/testing';
import { html, type ReactiveController, type TemplateResult } from 'lit';
import { LyraElement } from './lyra-element.js';
import { defineElement, tag } from './prefix.js';
import { SlotPresenceController } from './slot-presence-controller.js';

class SlotPresenceFixture extends LyraElement {
  readonly slots = new SlotPresenceController(this);

  override render(): TemplateResult {
    return html`
      <slot></slot>
      <slot name="label"></slot>
      <slot name="hint"><span>fallback is not consumer content</span></slot>
    `;
  }
}

const fixtureTag = tag('slot-presence-fixture');
defineElement('slot-presence-fixture', SlotPresenceFixture);

function createHost(...children: Node[]): SlotPresenceFixture {
  const host = document.createElement(fixtureTag) as SlotPresenceFixture;
  host.append(...children);
  document.body.append(host);
  return host;
}

afterEach(() => fixtureCleanup());

describe('SlotPresenceController', () => {
  it('seeds named and default light DOM synchronously before the first render', () => {
    const label = document.createElement('span');
    label.slot = 'label';
    const host = createHost(document.createTextNode('default text'), label);

    expect(host.slots.has()).to.equal(true);
    expect(host.slots.has('label')).to.equal(true);
    expect(host.slots.has('hint')).to.equal(false);
  });

  it('uses hasRealContent semantics and never counts slot fallback as consumer content', async () => {
    const host = createHost(document.createTextNode('  \n\t  '));
    await host.updateComplete;

    expect(host.slots.has()).to.equal(false);
    expect(host.slots.has('hint')).to.equal(false);

    const text = document.createTextNode('meaningful');
    const defaultSlot = host.renderRoot.querySelector('slot:not([name])') as HTMLSlotElement;
    const changed = oneEvent(defaultSlot, 'slotchange');
    host.append(text);
    await changed;
    await host.updateComplete;
    expect(host.slots.has()).to.equal(true);

    const changedAgain = oneEvent(defaultSlot, 'slotchange');
    text.remove();
    await changedAgain;
    await host.updateComplete;
    expect(host.slots.has()).to.equal(false);
  });

  it('updates named presence after dynamic assignment and removal', async () => {
    const host = createHost();
    await host.updateComplete;
    const labelSlot = host.renderRoot.querySelector('slot[name="label"]') as HTMLSlotElement;
    const label = document.createElement('span');
    label.slot = 'label';

    const added = oneEvent(labelSlot, 'slotchange');
    host.append(label);
    await added;
    await host.updateComplete;
    expect(host.slots.has('label')).to.equal(true);

    const removed = oneEvent(labelSlot, 'slotchange');
    label.remove();
    await removed;
    await host.updateComplete;
    expect(host.slots.has('label')).to.equal(false);
  });

  it('installs one delegated listener, removes it on disconnect, and reconnects cleanly', async () => {
    const originalAdd = ShadowRoot.prototype.addEventListener;
    const originalRemove = ShadowRoot.prototype.removeEventListener;
    let additions = 0;
    let removals = 0;
    ShadowRoot.prototype.addEventListener = function (type, listener, options): void {
      if (type === 'slotchange') additions += 1;
      originalAdd.call(this, type, listener, options);
    };
    ShadowRoot.prototype.removeEventListener = function (type, listener, options): void {
      if (type === 'slotchange') removals += 1;
      originalRemove.call(this, type, listener, options);
    };

    try {
      const host = createHost();
      await host.updateComplete;
      host.requestUpdate();
      await host.updateComplete;
      expect(additions).to.equal(1);

      host.remove();
      expect(removals).to.equal(1);

      document.body.append(host);
      await host.updateComplete;
      expect(additions).to.equal(2);
      host.remove();
      expect(removals).to.equal(2);
    } finally {
      ShadowRoot.prototype.addEventListener = originalAdd;
      ShadowRoot.prototype.removeEventListener = originalRemove;
    }
  });

  it('is inert when constructed by an SSR host without DOM surfaces', () => {
    let registered: ReactiveController | undefined;
    const host = {
      addController(controller: ReactiveController) {
        registered = controller;
      },
      removeController() {},
      requestUpdate() {},
      updateComplete: Promise.resolve(true),
    };
    const slots = new SlotPresenceController(host as never);

    expect(slots.has()).to.equal(false);
    expect(() => registered?.hostConnected?.()).to.not.throw();
    expect(() => registered?.hostUpdated?.()).to.not.throw();
    expect(() => registered?.hostDisconnected?.()).to.not.throw();
  });
});
