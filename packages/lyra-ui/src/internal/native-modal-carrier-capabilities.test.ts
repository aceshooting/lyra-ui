import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import { NativeModalCarrier } from './native-modal-carrier.js';

it('recovers through native close events when mutation observation is unavailable', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><dialog id="outer">Original</dialog><dialog id="cover">Cover</dialog><div id="host"></div></div>`);
  const outer = wrapper.querySelector<HTMLDialogElement>('#outer')!;
  const cover = wrapper.querySelector<HTMLDialogElement>('#cover')!;
  const host = wrapper.querySelector<HTMLElement>('#host')!;
  const shadow = host.attachShadow({ mode: 'open' });
  const original = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const helper = new NativeModalCarrier(host, { onCancel() {}, onUnexpectedClose() { helper.show(); } });
  outer.showModal();
  Object.defineProperty(window, 'MutationObserver', { configurable: true, value: undefined });
  try {
    helper.prepare(); render(helper.render(html`<button>Action</button>`), shadow);
    expect(helper.show()).to.equal(true);
    const carrier = shadow.querySelector('dialog')!;
    expect(carrier.matches(':modal')).to.equal(true);
    cover.showModal();
    const closed = oneEvent(carrier, 'close'); carrier.close(); await closed;
    expect(helper.show()).to.equal(true);
    expect(carrier.matches(':modal')).to.equal(false);
    expect(host.hasAttribute('data-native-modal-active')).to.equal(false);
    // Without observation, a predecessor may have reopened above the carrier. Recovery waits
    // until the other native modals are gone instead of taking their top-layer ownership.
    outer.close(); cover.close();
    await waitUntil(() => carrier.matches(':modal'));
    expect(host.hasAttribute('data-native-modal-active')).to.equal(true);
    expect(helper.helperMount?.isConnected).to.equal(true);
    helper.hide();
    expect(carrier.open).to.equal(false);
    expect(host.childElementCount).to.equal(0);
  } finally {
    try { helper.hide(); cover.close(); outer.close(); }
    finally {
      if (original) Object.defineProperty(window, 'MutationObserver', original);
      else Reflect.deleteProperty(window, 'MutationObserver');
    }
  }
});

it('rebinds recovery and helper ownership when its host is adopted into another document', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><dialog>Original</dialog><div></div><iframe></iframe></div>`);
  const originalModal = wrapper.querySelector('dialog')!;
  const host = wrapper.querySelector('div')!;
  const iframe = wrapper.querySelector('iframe')!;
  const owner = iframe.contentDocument!;
  const destinationModal = owner.createElement('dialog'); destinationModal.textContent = 'Destination'; owner.body.append(destinationModal);
  const shadow = host.attachShadow({ mode: 'open' });
  const helper = new NativeModalCarrier(host, { onCancel() {}, onUnexpectedClose() {} });
  try {
    originalModal.showModal(); helper.prepare();
    render(helper.render(html`<button>Action</button>`), shadow);
    expect(helper.show()).to.equal(true);
    const carrier = shadow.querySelector('dialog')!;
    const previousMount = helper.helperMount!;
    destinationModal.showModal(); owner.body.append(owner.adoptNode(host));
    expect(carrier.ownerDocument === owner).to.equal(true);
    expect(helper.show()).to.equal(true);
    expect(carrier.matches(':modal')).to.equal(true);
    expect(helper.helperMount?.ownerDocument === owner).to.equal(true);
    expect(helper.helperMount === previousMount).to.equal(false);
    expect(previousMount.isConnected).to.equal(false);
    originalModal.close();
    expect(carrier.matches(':modal')).to.equal(true);
    helper.hide();
    expect(carrier.open).to.equal(false); expect(host.childElementCount).to.equal(0);
    expect(destinationModal.matches(':modal')).to.equal(true);
  } finally {
    helper.hide(); destinationModal.close(); originalModal.close();
    host.remove(); document.adoptNode(host);
  }
});
