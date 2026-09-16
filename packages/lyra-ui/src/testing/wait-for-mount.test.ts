import { expect } from '@open-wc/testing';
import { toast } from '../components/overlays/toast/toaster.js';
import { waitForLyraElement, waitForToast } from './wait-for-mount.js';

const TOAST_ITEM_TAG = 'lr-toast-item';

let probeCounter = 0;
/** A fresh, never-before-registered tag name so each test can `customElements.define()` it without
 *  colliding with another test's registration (a tag can only ever be defined once per registry). */
function nextProbeTag(): string {
  probeCounter += 1;
  return `wait-for-mount-probe-${probeCounter}`;
}

const mountedProbes: Element[] = [];
function mountProbe(tagName: string, text = ''): HTMLElement {
  const el = document.createElement(tagName);
  el.textContent = text;
  document.body.appendChild(el);
  mountedProbes.push(el);
  return el;
}

afterEach(() => {
  for (const el of mountedProbes.splice(0)) el.remove();
});

describe('waitForLyraElement', () => {
  it('resolves immediately when a connected, already-upgraded match already exists', async () => {
    const tagName = nextProbeTag();
    customElements.define(tagName, class extends HTMLElement {});
    mountProbe(tagName, 'already here');

    const found = await waitForLyraElement(tagName);

    expect(found.textContent).to.equal('already here');
  });

  it('resolves once a connected-but-undefined element finishes upgrading, via customElements.whenDefined()', async () => {
    const tagName = nextProbeTag();
    mountProbe(tagName, 'pending upgrade');

    const pending = waitForLyraElement(tagName);
    // Give the initial synchronous scan a turn to (not) resolve before the tag is ever defined --
    // proves this isn't resolving on connection alone.
    await new Promise((resolve) => setTimeout(resolve, 0));
    customElements.define(tagName, class extends HTMLElement {});

    const found = await pending;
    expect(found.textContent).to.equal('pending upgrade');
  });

  it('resolves once a matching element is connected later, ignoring a same-tag element that fails match()', async () => {
    const tagName = nextProbeTag();
    customElements.define(tagName, class extends HTMLElement {});
    mountProbe(tagName, 'wrong one');

    const pending = waitForLyraElement<HTMLElement>(tagName, {
      match: (el) => el.textContent === 'right one',
    });
    setTimeout(() => mountProbe(tagName, 'right one'), 10);

    const found = await pending;
    expect(found.textContent).to.equal('right one');
  });

  it('rejects with a descriptive, bounded-timeout error when nothing ever matches the selector', async () => {
    const tagName = nextProbeTag();
    let error: unknown;
    try {
      await waitForLyraElement(tagName, { timeoutMs: 50 });
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    const message = (error as Error).message;
    expect(message).to.contain('50ms');
    expect(message).to.contain(tagName);
    expect(message).to.contain('no element ever matched');
  });

  it('rejects with a descriptive error naming match() when candidates exist but none pass it', async () => {
    const tagName = nextProbeTag();
    customElements.define(tagName, class extends HTMLElement {});
    mountProbe(tagName, 'never matches');

    let error: unknown;
    try {
      await waitForLyraElement<HTMLElement>(tagName, {
        timeoutMs: 50,
        match: () => false,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    const message = (error as Error).message;
    expect(message).to.contain('found 1 element');
    expect(message).to.contain('match()');
  });
});

describe('waitForToast', () => {
  it('resolves a fire-and-forget toast() call made before its lazy import settles', async () => {
    toast('Saved via wait-for-mount');

    // toast() registers lr-toast/lr-toast-item through a dynamic import() -- guaranteed to still
    // be pending immediately after the call returns (dynamic import never settles synchronously),
    // so nothing has mounted yet.
    expect(document.querySelectorAll(TOAST_ITEM_TAG).length).to.equal(0);

    const item = await waitForToast('Saved via wait-for-mount');

    expect(item.textContent?.trim()).to.equal('Saved via wait-for-mount');
    expect(item.isConnected).to.be.true;
    item.remove();
  });

  it('matches by predicate across multiple concurrent toasts', async () => {
    toast('First toast');
    toast('Second toast');

    const item = await waitForToast((el) => (el.textContent ?? '').includes('Second'));

    expect(item.textContent?.trim()).to.equal('Second toast');
    document.querySelectorAll(TOAST_ITEM_TAG).forEach((el) => el.remove());
  });

  it('rejects with a descriptive, bounded-timeout error when no toast ever matches', async () => {
    let error: unknown;
    try {
      await waitForToast('text nobody ever toasts', { timeoutMs: 50 });
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    const message = (error as Error).message;
    expect(message).to.contain('50ms');
    expect(message).to.contain(TOAST_ITEM_TAG);
  });
});
