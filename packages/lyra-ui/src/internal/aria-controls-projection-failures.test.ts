import { expect, fixture, html } from '@open-wc/testing';
import { acquireAriaDescription, acquireResolvedAriaRelationship } from './aria-controls.js';

for (const relationship of ['aria-describedby', 'aria-labelledby'] as const) {
  for (const failure of ['constructor', 'observe', 'disconnect', 'availability'] as const) {
    it(`retains ${relationship} projection and author baselines when owner-realm observer ${failure} fails`, async () => {
      const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
      const view = iframe.contentWindow!;
      const doc = iframe.contentDocument!;
      const descriptor = Object.getOwnPropertyDescriptor(view, 'MutationObserver');
      const NativeObserver = Reflect.get(view, 'MutationObserver') as typeof MutationObserver;
      doc.body.innerHTML = '<div id="host"></div><button>Control</button>' +
        '<span id="author">Author</span><span id="replacement">Replacement</span>' +
        '<span id="first">First</span><span id="next">Next</span>';
      const host = doc.getElementById('host')!;
      const target = doc.querySelector<HTMLButtonElement>('button')!;
      host.setAttribute(relationship, 'first');
      target.setAttribute(relationship, 'author');
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
        override disconnect(): void {
          super.disconnect();
          if (failure === 'disconnect') {
            failedCalls += 1;
            throw new TypeError('observer cleanup unavailable');
          }
        }
      }
      Object.defineProperty(view, 'MutationObserver', failure === 'availability'
        ? { configurable: true, get() { failedCalls += 1; throw new TypeError('observer access unavailable'); } }
        : { configurable: true, value: PartialObserver });
      const restoreObserver = (): void => {
        if (descriptor) Object.defineProperty(view, 'MutationObserver', descriptor);
        else Reflect.deleteProperty(view, 'MutationObserver');
      };
      const lease = acquireResolvedAriaRelationship(host, target, relationship);
      try {
        expect(target.getAttribute(relationship)).to.equal('first author');
        host.removeAttribute(relationship);
        lease.update(target);
        expect(target.getAttribute(relationship)).to.equal('author');
        host.setAttribute(relationship, 'next');
        lease.update(target);
        expect(target.getAttribute(relationship)).to.equal('next author');
        target.setAttribute(relationship, 'replacement');
        lease.update(target);
        expect(target.getAttribute(relationship)).to.equal('next replacement');
        expect(failedCalls > 0).to.equal(true);

        lease.release();
        expect(target.getAttribute(relationship)).to.equal('replacement');
        host.setAttribute(relationship, 'first');
        lease.update(target);
        expect(target.getAttribute(relationship)).to.equal('replacement');

        // A subsequent lease regains native observation after the platform recovers.
        restoreObserver();
        const recovered = acquireResolvedAriaRelationship(host, target, relationship);
        try {
          expect(target.getAttribute(relationship)).to.equal('first replacement');
          host.setAttribute(relationship, 'next');
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          expect(target.getAttribute(relationship)).to.equal('next replacement');
          recovered.release();
          expect(target.getAttribute(relationship)).to.equal('replacement');
        } finally {
          recovered.release();
        }
      } finally {
        lease.release();
        restoreObserver();
        iframe.remove();
      }
    });
  }
}

it('serializes resolvable element baselines when native reflection is readable but read-only', async () => {
  const root = await fixture<HTMLElement>(html`<div>
    <button aria-describedby="">Control</button>
    <span id="readonly-author">Author</span><span id="readonly-description">Description</span>
  </div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const author = root.querySelector<HTMLElement>('#readonly-author')!;
  const description = root.querySelector<HTMLElement>('#readonly-description')!;
  Object.defineProperty(target, 'ariaDescribedByElements', {
    configurable: true,
    value: [author],
    writable: false,
  });
  const lease = acquireAriaDescription(target, [description]);
  try {
    expect(target.getAttribute('aria-describedby')).to.equal('readonly-author readonly-description');
    lease.update([author, description]);
    expect(target.getAttribute('aria-describedby')).to.equal('readonly-author readonly-description');
    lease.release();
    expect(target.hasAttribute('aria-describedby')).to.equal(false);
    expect((target.ariaDescribedByElements ?? []).map(element => element.id)).to.deep.equal(['readonly-author']);
  } finally {
    lease.release();
    Reflect.deleteProperty(target, 'ariaDescribedByElements');
  }
});
