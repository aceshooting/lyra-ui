import { expect, fixture, html } from '@open-wc/testing';
import { acquireAriaDescription } from './aria-controls.js';

for (const failure of ['constructor', 'observe', 'takeRecords'] as const) {
  it(`preserves description owners and later author writes when the owner-realm observer ${failure} fails`, async () => {
    const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const view = iframe.contentWindow!;
    const doc = iframe.contentDocument!;
    const descriptor = Object.getOwnPropertyDescriptor(view, 'MutationObserver');
    const NativeObserver = Reflect.get(view, 'MutationObserver') as typeof MutationObserver;
    doc.body.innerHTML = '<button aria-describedby="author"></button><span id="author"></span>' +
      '<span id="replacement"></span><span id="first"></span><span id="peer"></span><span id="next"></span>';
    const target = doc.querySelector<HTMLButtonElement>('button')!;
    const source = (id: string): HTMLElement => doc.getElementById(id)!;
    let failedCalls = 0;
    class PartialObserver extends NativeObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        if (failure === 'constructor') {
          failedCalls += 1;
          throw new TypeError('observer construction unavailable');
        }
      }
      override observe(node: Node, options?: MutationObserverInit): void {
        if (failure === 'observe') {
          failedCalls += 1;
          throw new TypeError('observer subscription unavailable');
        }
        super.observe(node, options);
      }
      override takeRecords(): MutationRecord[] {
        if (failure === 'takeRecords') {
          failedCalls += 1;
          throw new TypeError('observer record draining unavailable');
        }
        return super.takeRecords();
      }
    }
    Object.defineProperty(view, 'MutationObserver', { configurable: true, value: PartialObserver });
    const own = acquireAriaDescription(target, [source('first')]);
    const peer = acquireAriaDescription(target, [source('peer')]);
    try {
      expect(target.getAttribute('aria-describedby')).to.equal('author first peer');
      target.setAttribute('aria-describedby', 'replacement');
      own.update([source('next')]);
      expect(target.getAttribute('aria-describedby')).to.equal('replacement next peer');
      expect(failedCalls > 0).to.equal(true);
      if (descriptor) Object.defineProperty(view, 'MutationObserver', descriptor);
      else Reflect.deleteProperty(view, 'MutationObserver');
      own.update([source('next')]);
      peer.release();
      expect(target.getAttribute('aria-describedby')).to.equal('replacement next');
      own.release();
      expect(target.getAttribute('aria-describedby')).to.equal('replacement');
      own.update([source('first')]);
      expect(target.getAttribute('aria-describedby')).to.equal('replacement');
    } finally {
      own.release();
      peer.release();
      if (descriptor) Object.defineProperty(view, 'MutationObserver', descriptor);
      else Reflect.deleteProperty(view, 'MutationObserver');
      iframe.remove();
    }
  });
}

it('omits unresolvable descriptions when reflection rejects reads and writes and restores an authored empty baseline', async () => {
  const root = await fixture<HTMLElement>(html`<div><button aria-describedby="">Control</button><div></div></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const shadow = root.querySelector('div')!.attachShadow({ mode: 'open' });
  const description = document.createElement('span');
  description.id = 'partial-reflection-description';
  shadow.append(description);
  let reads = 0;
  let writes = 0;
  Object.defineProperty(target, 'ariaDescribedByElements', {
    configurable: true,
    get() { reads += 1; throw new TypeError('element-reference reads unavailable'); },
    set() { writes += 1; throw new TypeError('element-reference writes unavailable'); },
  });
  const lease = acquireAriaDescription(target, [description]);
  try {
    expect(target.getAttribute('aria-describedby')).to.equal('');
    expect(reads > 0 && writes > 0).to.equal(true);
    root.append(description);
    lease.update([description]);
    expect(target.getAttribute('aria-describedby')).to.equal(description.id);
    lease.release();
    expect(target.hasAttribute('aria-describedby')).to.equal(true);
    expect(target.getAttribute('aria-describedby')).to.equal('');
  } finally {
    lease.release();
    Reflect.deleteProperty(target, 'ariaDescribedByElements');
  }
});

for (const disconnectThrows of [false, true]) {
  it(`releases a description during observer construction and discards the candidate${disconnectThrows ? ' even when cleanup throws' : ''}`, async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const doc = frame.contentDocument!;
    const view = frame.contentWindow!;
    const original = Object.getOwnPropertyDescriptor(view, 'MutationObserver');
    const NativeObserver = Reflect.get(view, 'MutationObserver') as typeof MutationObserver;
    doc.body.innerHTML = '<button aria-describedby="author">Control</button><span id="author"></span><span id="first"></span><span id="next"></span>';
    const target = doc.querySelector<HTMLButtonElement>('button')!;
    const first = doc.getElementById('first')!;
    const next = doc.getElementById('next')!;
    const lease = acquireAriaDescription(target, [first]);
    let candidates = 0;
    let disconnects = 0;
    class ReleasingObserver extends NativeObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        candidates += 1;
        lease.release();
      }
      override disconnect(): void {
        super.disconnect();
        disconnects += 1;
        if (disconnectThrows) throw new TypeError('observer cleanup unavailable');
      }
    }
    try {
      Object.defineProperty(view, 'MutationObserver', { configurable: true, value: ReleasingObserver });
      lease.update([next]);
      expect(candidates).to.equal(1);
      expect(disconnects).to.equal(1);
      expect(target.getAttribute('aria-describedby')).to.equal('author');
      next.id = 'renamed-after-release';
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      expect(target.getAttribute('aria-describedby')).to.equal('author');
      lease.update([first]);
      expect(target.getAttribute('aria-describedby')).to.equal('author');
    } finally {
      lease.release();
      if (original) Object.defineProperty(view, 'MutationObserver', original);
      else Reflect.deleteProperty(view, 'MutationObserver');
    }
  });
}

it('omits an unresolved description when element-reference reflection cannot be written', async () => {
  const root = await fixture<HTMLElement>(html`<div><button>Control</button><div></div></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const shadow = root.querySelector('div')!.attachShadow({ mode: 'open' });
  const description = document.createElement('span');
  description.id = 'unreachable-description';
  shadow.append(description);
  Object.defineProperty(target, 'ariaDescribedByElements', { configurable: true, value: null, writable: false });
  const lease = acquireAriaDescription(target, [description]);
  try {
    expect(target.hasAttribute('aria-describedby')).to.equal(false);
    root.append(description);
    lease.update([description]);
    expect(target.getAttribute('aria-describedby')).to.equal(description.id);
    lease.release();
    expect(target.hasAttribute('aria-describedby')).to.equal(false);
  } finally {
    lease.release();
    Reflect.deleteProperty(target, 'ariaDescribedByElements');
  }
});
