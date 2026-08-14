import { expect, fixtureCleanup, oneEvent } from '@open-wc/testing';
import { html, type ReactiveController, type TemplateResult } from 'lit';
import { LyraElement, SEED_FIRST_RENDER_STATE } from './lyra-element.js';
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

  it('defers browser light-DOM presence until after a hydration first render', () => {
    let registered: ReactiveController | undefined;
    const deferredSeeds: Array<() => void> = [];
    let updates = 0;
    const child = document.createElement('span');
    child.slot = 'label';
    const host = document.createElement('div') as HTMLDivElement & ReactiveControllerHost & {
      hasUpdated: boolean;
      [SEED_FIRST_RENDER_STATE](seed: () => void): void;
    };
    host.hasUpdated = false;
    host.append(child);
    host.addController = (controller: ReactiveController): void => {
      registered = controller;
    };
    host.removeController = (): void => undefined;
    host.requestUpdate = (): void => {
      updates += 1;
    };
    host.updateComplete = Promise.resolve(true);
    host[SEED_FIRST_RENDER_STATE] = (seed: () => void): void => {
      deferredSeeds.push(seed);
    };

    const slots = new SlotPresenceController(host);
    registered?.hostConnected?.();
    registered?.hostUpdate?.();

    expect(slots.has('label')).to.equal(false);
    expect(updates).to.equal(0);

    for (const seed of deferredSeeds) seed();
    expect(slots.has('label')).to.equal(true);
    expect(updates).to.equal(1);
    registered?.hostDisconnected?.();
  });

  it('reconciles rendered slots after hostUpdated without clearing an unseen conditional slot', async () => {
    let registered: ReactiveController | undefined;
    let updates = 0;
    const host = document.createElement('div') as HTMLDivElement & ReactiveControllerHost & {
      hasUpdated: boolean;
    };
    host.hasUpdated = false;
    host.addController = (controller: ReactiveController): void => {
      registered = controller;
    };
    host.removeController = (): void => undefined;
    host.requestUpdate = (): void => {
      updates += 1;
    };
    host.updateComplete = Promise.resolve(true);

    const emptyForwardingSlot = document.createElement('slot');
    emptyForwardingSlot.slot = 'label';
    const conditionalContent = document.createElement('span');
    conditionalContent.slot = 'conditional';
    host.append(emptyForwardingSlot, conditionalContent);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<slot name="label"></slot>';
    Object.defineProperty(host, 'renderRoot', { value: root });
    document.body.append(host);

    const slots = new SlotPresenceController(host);
    try {
      registered?.hostConnected?.();
      expect(slots.has('label'), 'the pre-render light-DOM seed is progressive').to.equal(true);
      expect(slots.has('conditional')).to.equal(true);
      updates = 0;
      host.hasUpdated = true;

      registered?.hostUpdated?.();
      expect(updates, 'hostUpdated must not request a new update from the completed cycle').to.equal(0);
      expect(slots.has('label'), 'reconciliation is deferred past hostUpdated').to.equal(true);

      await Promise.resolve();
      expect(slots.has('label'), 'the rendered forwarding slot is authoritative once assigned').to.equal(false);
      expect(
        slots.has('conditional'),
        'a temporarily absent internal slot retains its real light-DOM content',
      ).to.equal(true);
      expect(updates, 'the deferred correction requests exactly one follow-up update').to.equal(1);

      conditionalContent.remove();
      updates = 0;
      registered?.hostUpdated?.();
      await Promise.resolve();
      expect(slots.has('conditional'), 'unseen presence follows light-DOM removal').to.equal(false);
      expect(updates, 'light-DOM removal requests exactly one corrective update').to.equal(1);
    } finally {
      registered?.hostDisconnected?.();
      host.remove();
    }
  });

  it('excludes fallback behind nested unassigned forwarding slots', async () => {
    let registered: ReactiveController | undefined;
    let updates = 0;
    const frame = document.createElement('div');
    const frameRoot = frame.attachShadow({ mode: 'open' });
    const middle = document.createElement('div');
    frameRoot.append(middle);

    const innerForwarder = document.createElement('slot');
    innerForwarder.name = 'source';
    innerForwarder.slot = 'label';
    innerForwarder.append(document.createTextNode('inner fallback'));
    middle.append(innerForwarder);

    const middleRoot = middle.attachShadow({ mode: 'open' });
    const host = document.createElement('div') as HTMLDivElement & ReactiveControllerHost & {
      hasUpdated: boolean;
    };
    const outerForwarder = document.createElement('slot');
    outerForwarder.name = 'label';
    outerForwarder.slot = 'label';
    outerForwarder.append(document.createTextNode('outer fallback'));
    host.append(outerForwarder);
    middleRoot.append(host);

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<slot name="label"></slot>';
    Object.defineProperty(host, 'renderRoot', { value: root });
    host.hasUpdated = false;
    host.addController = (controller: ReactiveController): void => {
      registered = controller;
    };
    host.removeController = (): void => undefined;
    host.requestUpdate = (): void => {
      updates += 1;
    };
    host.updateComplete = Promise.resolve(true);
    document.body.append(frame);

    const slots = new SlotPresenceController(host);
    try {
      registered?.hostConnected?.();
      expect(slots.has('label'), 'the progressive light-DOM seed sees the forwarding element').to.equal(true);
      updates = 0;
      host.hasUpdated = true;

      registered?.hostUpdated?.();
      expect(updates, 'nested reconciliation is deferred past hostUpdated').to.equal(0);
      await Promise.resolve();
      expect(slots.has('label'), 'unassigned forwarding fallbacks are not consumer content').to.equal(false);
      expect(updates, 'the nested fallback correction requests one update').to.equal(1);
    } finally {
      registered?.hostDisconnected?.();
      frame.remove();
    }
  });
});
