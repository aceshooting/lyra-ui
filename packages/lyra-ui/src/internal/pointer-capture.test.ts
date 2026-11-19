import { expect, fixture, html } from '@open-wc/testing';
import { armClickSuppression, capturePointer, consumeSuppressedClick, releasePointer } from './pointer-capture.js';
import { listenUntilPointerEnd } from './document-pointer.js';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe('pointer-capture', () => {
  it('does not throw for an unknown pointer id', async () => {
    const el = (await fixture(html`<button>x</button>`)) as HTMLElement;
    expect(() => capturePointer(el, 987654)).not.to.throw();
    expect(capturePointer(el, 987654)).to.equal(false);
    expect(() => releasePointer(el, 987654)).not.to.throw();
  });

  it('tolerates elements without capture methods', () => {
    const fake = {} as unknown as Element;
    expect(capturePointer(fake, 1)).to.equal(false);
    expect(() => releasePointer(fake, 1)).not.to.throw();
  });

  it('swallows a throwing setPointerCapture', () => {
    const fake = { setPointerCapture() { throw new Error('NotFoundError'); } } as unknown as Element;
    expect(capturePointer(fake, 1)).to.equal(false);
  });

  it('consumes a suppressed click exactly once', async () => {
    const el = (await fixture(html`<button>x</button>`)) as HTMLElement;
    armClickSuppression(window);
    const first = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(first);
    expect(consumeSuppressedClick(first)).to.equal(true);
    expect(first.defaultPrevented).to.equal(true);
    const second = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(second);
    expect(consumeSuppressedClick(second)).to.equal(false);
  });

  it('auto-clears after one task', async () => {
    const el = (await fixture(html`<button>x</button>`)) as HTMLElement;
    armClickSuppression(window);
    await tick();
    const late = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(late);
    expect(consumeSuppressedClick(late)).to.equal(false);
  });

  it('disposal clears and respects keys', async () => {
    const el = (await fixture(html`<button>x</button>`)) as HTMLElement;
    const dispose = armClickSuppression(window, 'a');
    const keyed = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(keyed);
    expect(consumeSuppressedClick(keyed, 'b')).to.equal(false);
    dispose();
    dispose();
    expect(consumeSuppressedClick(keyed, 'a')).to.equal(false);
  });
});

describe('listenUntilPointerEnd', () => {
  it('calls on end events and releases idempotently', () => {
    const calls: string[] = [];
    const moves: string[] = [];
    const release = listenUntilPointerEnd(document, (e) => calls.push(e.type), {
      capture: true,
      lostCapture: true,
      extra: { pointermove: (e) => moves.push(e.type) },
    });
    document.dispatchEvent(new Event('pointerup'));
    document.dispatchEvent(new Event('pointercancel'));
    document.dispatchEvent(new Event('lostpointercapture'));
    document.dispatchEvent(new Event('pointermove'));
    release();
    release();
    document.dispatchEvent(new Event('pointerup'));
    document.dispatchEvent(new Event('pointermove'));
    expect(calls).to.deep.equal(['pointerup', 'pointercancel', 'lostpointercapture']);
    expect(moves).to.deep.equal(['pointermove']);
  });
});
