import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import { NativeModalCarrier } from './native-modal-carrier.js';
import { sendMouse } from '../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { deepActiveElementIn } from './active-element.js';

it('releases deferred recovery resources after a rejected promotion and accepts a later activation', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <dialog id="outer"><button>Original action</button></dialog>
    <dialog id="cover"><button>Cover action</button></dialog>
    <div id="host"></div>
  </div>`);
  const outer = wrapper.querySelector<HTMLDialogElement>('#outer')!;
  const cover = wrapper.querySelector<HTMLDialogElement>('#cover')!;
  const host = wrapper.querySelector<HTMLElement>('#host')!;
  const shadow = host.attachShadow({ mode: 'open' });
  const OriginalObserver = window.MutationObserver;
  const observing = new Set<MutationObserver>();
  let recordingHelper = false;
  class RecordingObserver extends OriginalObserver {
    private readonly helperOwned = recordingHelper;
    override observe(target: Node, options?: MutationObserverInit): void {
      super.observe(target, options);
      if (this.helperOwned) observing.add(this);
    }
    override disconnect(): void {
      super.disconnect();
      observing.delete(this);
    }
  }
  window.MutationObserver = RecordingObserver;
  const helper = new NativeModalCarrier(host, {
    onCancel: () => {},
    onUnexpectedClose: () => { show(); },
  });
  // Attribute only observers constructed by this helper operation, not background page observers.
  const show = (): boolean => {
    const previous = recordingHelper;
    recordingHelper = true;
    try { return helper.show(); }
    finally { recordingHelper = previous; }
  };
  let carrier: HTMLDialogElement | undefined;
  let originalShow: HTMLDialogElement['showModal'] | undefined;
  try {
    outer.showModal();
    helper.prepare();
    render(helper.render(html`<button>Recovered action</button>${helper.renderHelperSlot()}`,  { label: 'Recovery' }), shadow);
    expect(show()).to.equal(true);
    carrier = shadow.querySelector<HTMLDialogElement>('dialog')!;
    cover.showModal();
    const closed = oneEvent(carrier, 'close');
    carrier.close();
    await closed;
    expect(show(), 'deferred carrier still owns its presentation').to.equal(true);
    expect(carrier.matches(':modal')).to.equal(false);
    expect(observing.size, 'recovery owns native lifecycle observers').to.be.greaterThan(0);

    originalShow = carrier.showModal;
    let failedAttempts = 0;
    carrier.showModal = () => {
      failedAttempts += 1;
      throw new DOMException('Injected native recovery failure', 'InvalidStateError');
    };
    cover.close();
    // An explicit retry before the queued wakeup must cancel that wakeup if promotion rejects.
    let rejected = false;
    try { show(); }
    catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'InvalidStateError' || error.message !== 'Injected native recovery failure') throw error;
      rejected = true;
    }
    expect(rejected).to.equal(true);
    expect(failedAttempts).to.equal(1);
    expect(observing.size, 'all predecessor and cover observers are disconnected').to.equal(0);
    expect(host.childElementCount, 'failed recovery removes its helper mount').to.equal(0);
    expect(host.hasAttribute('data-native-modal-active')).to.equal(false);
    expect(carrier.inert, 'temporary native autofocus suppression is released').to.equal(false);
    // wait-reason: failed promotion must cancel the queued real recovery task without another attempt.
    await aTimeout(50);
    expect(failedAttempts, 'superseded recovery cannot retry from a queued task').to.equal(1);

    carrier.showModal = originalShow;
    helper.hide();
    helper.prepare();
    expect(show()).to.equal(true);
    await waitUntil(() => carrier!.matches(':modal'));
    const button = shadow.querySelector<HTMLButtonElement>('button')!;
    let clicks = 0;
    button.addEventListener('click', () => clicks += 1);
    const rect = button.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    expect(clicks).to.equal(1);
    await focusByKeyboard(button, helper.helperMount!);
    expect(deepActiveElementIn(document) === button).to.equal(true);
    helper.hide();
    expect(observing.size, 'normal hide releases the successful retry observers').to.equal(0);
  } finally {
    if (carrier && originalShow) carrier.showModal = originalShow;
    helper.hide();
    window.MutationObserver = OriginalObserver;
    cover.close();
    outer.close();
  }
});
