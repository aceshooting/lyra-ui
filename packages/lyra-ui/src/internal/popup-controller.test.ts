import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { PopupController, type PopupLifecycleEvent } from './popup-controller.js';

interface Probe {
  host: HTMLElement & { updateComplete: Promise<void> };
  emitted: string[];
  pointers: number;
  controller: PopupController;
  prevent: boolean;
}

async function probe(): Promise<Probe> {
  const wrapper = await fixture<HTMLElement>(html`<div><span id="host"></span><button id="outside"></button></div>`);
  const host = wrapper.querySelector('#host') as Probe['host'];
  host.updateComplete = Promise.resolve();
  const state = { host, emitted: [] as string[], pointers: 0, prevent: false } as Probe;
  state.controller = new PopupController({
    host,
    popup: () => null,
    emit: (name, cancelable) => {
      state.emitted.push(name);
      return cancelable && state.prevent;
    },
    onPointer: () => { state.pointers++; },
  });
  return state;
}

async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => { done = true; });
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

describe('PopupController', () => {
  it('emits the after-event once and releases its callers when a settle completes', async () => {
    const p = await probe();
    const shown = p.controller.wait(true);
    await p.controller.settle('lr-after-show');
    await shown;
    expect(p.emitted).to.deep.equal(['lr-after-show']);
  });

  it('does not emit for a settle superseded by a newer one or by cancel()', async () => {
    const p = await probe();
    const first = p.controller.settle('lr-after-show');
    p.controller.cancel();
    await first;
    expect(p.emitted).to.deep.equal([]);
    const stale = p.controller.settle('lr-after-hide');
    const current = p.controller.settle('lr-after-hide');
    await Promise.all([stale, current]);
    expect(p.emitted).to.deep.equal(['lr-after-hide']);
  });

  it('cancel() releases every pending show and hide caller', async () => {
    const p = await probe();
    const shown = p.controller.wait(true);
    expect(await settled(shown)).to.equal(false);
    p.controller.cancel();
    await shown;
    const hidden = p.controller.wait(false);
    p.controller.cancel();
    await hidden;
  });

  it('opposite-direction callers are released when a new direction is requested', async () => {
    const p = await probe();
    const shown = p.controller.wait(true);
    void p.controller.wait(false);
    await shown;
  });

  it('abandons a settle whose position wait reports false', async () => {
    const p = await probe();
    await p.controller.settle('lr-after-show', { waitForPosition: async () => false });
    expect(p.emitted).to.deep.equal([]);
  });

  it('conceals only on the hide direction', async () => {
    const p = await probe();
    const calls: string[] = [];
    const conceal = (): void => { calls.push('conceal'); };
    await p.controller.settle('lr-after-show', { conceal });
    await p.controller.settle('lr-after-hide' satisfies PopupLifecycleEvent, { conceal });
    expect(calls).to.deep.equal(['conceal']);
  });

  it('announce() flips a cancelled transition and releases the cancelled direction', async () => {
    const p = await probe();
    p.prevent = true;
    let flipped = 0;
    const shown = p.controller.wait(true);
    expect(p.controller.announce(true, () => { flipped++; })).to.equal(true);
    await shown;
    expect(flipped).to.equal(1);
    expect(p.controller.vetoed).to.equal(true);
    expect(p.emitted).to.deep.equal(['lr-show']);
  });

  it('announce() leaves an accepted transition alone', async () => {
    const p = await probe();
    let flipped = 0;
    expect(p.controller.announce(false, () => { flipped++; })).to.equal(false);
    expect(flipped).to.equal(0);
    expect(p.controller.vetoed).to.equal(false);
    expect(p.emitted).to.deep.equal(['lr-hide']);
  });

  it('binds one capture-phase pointerdown listener that survives a stopped bubble', async () => {
    const p = await probe();
    const outside = p.host.parentElement!.querySelector('#outside') as HTMLElement;
    outside.addEventListener('pointerdown', (event) => event.stopPropagation());
    p.controller.bindPointer();
    p.controller.bindPointer();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(p.pointers).to.equal(1);
    p.controller.unbindPointer();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await waitUntil(() => p.pointers === 1);
    expect(p.pointers).to.equal(1);
  });

  it('does not bind for a disconnected host', async () => {
    const p = await probe();
    const outside = p.host.parentElement!.querySelector('#outside') as HTMLElement;
    p.host.remove();
    p.controller.bindPointer();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(p.pointers).to.equal(0);
  });

  it('serves pointer-only hosts that supply no popup or emit', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><span id="host"></span><button id="outside"></button></div>`);
    const host = wrapper.querySelector('#host') as Probe['host'];
    let pointers = 0;
    const controller = new PopupController({ host, onPointer: () => { pointers++; } });
    controller.bindPointer();
    wrapper.querySelector('#outside')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(pointers).to.equal(1);
    expect(controller.announce(true, () => undefined)).to.equal(false);
    controller.unbindPointer();
    wrapper.querySelector('#outside')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(pointers).to.equal(1);
  });
});
