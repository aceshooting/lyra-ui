import { expect, fixture, html } from '@open-wc/testing';
import { acquireAriaDescription, acquireResolvedAriaRelationship } from './aria-controls.js';

const nativeOwnerDocument = Object.getOwnPropertyDescriptor(Node.prototype, 'ownerDocument')!.get!;

/** An inert document has no browsing context, so no mutation observer ever drains on its own and
 *  every relationship change is adopted only by an explicit lease `update()`. */
function inertFixture(): { doc: Document; make: (id: string) => HTMLElement } {
  const doc = document.implementation.createHTMLDocument('');
  return {
    doc,
    make(id: string) {
      const element = doc.createElement('span');
      if (id) element.id = id;
      doc.body.append(element);
      return element;
    },
  };
}

describe('aria-controls structural fallout and hostile nodes', () => {
  it('preserves an authored id when its root lookup throws while recording relationship ownership', () => {
    const { doc, make } = inertFixture();
    const target = doc.createElement('button');
    doc.body.append(target);
    target.setAttribute('aria-describedby', 'author');
    make('author');
    const generated = make('generated');
    const nativeGetElementById = doc.getElementById.bind(doc);
    let failedLookups = 0;
    doc.getElementById = (id: string): HTMLElement | null => {
      if (id === 'author') {
        failedLookups += 1;
        throw new TypeError('id lookup unavailable');
      }
      return nativeGetElementById(id);
    };
    let lease: ReturnType<typeof acquireAriaDescription> | undefined;
    try {
      expect(() => { lease = acquireAriaDescription(target, [generated]); }).to.not.throw();
      expect(failedLookups > 0).to.equal(true);
      expect(target.getAttribute('aria-describedby')).to.equal('author generated');
      expect(() => lease!.release()).to.not.throw();
      expect(target.getAttribute('aria-describedby')).to.equal('author');
    } finally {
      Reflect.deleteProperty(doc, 'getElementById');
      lease?.release();
    }
  });

  it('keeps the author baseline when a projected endpoint loses its id', function () {
    if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
    const { doc, make } = inertFixture();
    const target = doc.createElement('button');
    doc.body.append(target);
    target.setAttribute('aria-describedby', 'author');
    make('author');
    const generated = make('generated');
    const lease = acquireAriaDescription(target, [generated]);
    expect(target.getAttribute('aria-describedby')).to.equal('author generated');

    generated.removeAttribute('id');
    lease.update([generated]);
    lease.release();

    expect(target.getAttribute('aria-describedby')).to.equal('author');
  });

  it('survives an endpoint whose root lookup fails while a native list changed under the lease', function () {
    if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
    const { doc, make } = inertFixture();
    const target = doc.createElement('button');
    doc.body.append(target);
    target.setAttribute('aria-describedby', 'author');
    make('author');
    const first = make('first');
    const second = make('second');
    const lease = acquireAriaDescription(target, [first, second]);
    let armed = true;
    const nativeGetRootNode = first.getRootNode.bind(first);
    first.getRootNode = (options?: GetRootNodeOptions): Node => {
      if (armed) {
        armed = false;
        throw new TypeError('root lookup unavailable');
      }
      return nativeGetRootNode(options);
    };

    second.removeAttribute('id');
    expect(() => lease.update([first, second])).to.not.throw();
    expect(armed).to.equal(false);
    lease.release();

    expect(target.getAttribute('aria-describedby')).to.equal('author');
  });

  for (const failingRead of [1, 2] as const) {
    it(`keeps the relationship intact when the owner document read fails (read ${failingRead} of a refresh)`, async () => {
      const root = await fixture<HTMLElement>(html`
        <div><button aria-describedby="author"></button><span id="author"></span><span id="generated"></span></div>
      `);
      const target = root.querySelector<HTMLButtonElement>('button')!;
      const generated = root.querySelector<HTMLElement>('#generated')!;
      const lease = acquireAriaDescription(target, [generated]);
      expect(target.getAttribute('aria-describedby')).to.equal('author generated');
      let reads = 0;
      Object.defineProperty(target, 'ownerDocument', {
        configurable: true,
        get() {
          reads += 1;
          if (reads === failingRead) throw new TypeError('document unavailable');
          return nativeOwnerDocument.call(target);
        },
      });
      try {
        expect(() => lease.update([generated])).to.not.throw();
        expect(reads >= failingRead).to.equal(true);
        expect(target.getAttribute('aria-describedby')).to.equal('author generated');
      } finally {
        Reflect.deleteProperty(target, 'ownerDocument');
      }
      lease.release();
      expect(target.getAttribute('aria-describedby')).to.equal('author');
    });
  }

  it('projects nothing and leaves the target alone when the host root cannot be read', async () => {
    const root = await fixture<HTMLElement>(html`
      <div><div id="host" aria-describedby="source"></div><button aria-describedby="author"></button>
      <span id="source"></span><span id="author"></span></div>
    `);
    const host = root.querySelector<HTMLElement>('#host')!;
    const target = root.querySelector<HTMLButtonElement>('button')!;
    host.getRootNode = (): Node => {
      throw new TypeError('root unavailable');
    };
    const lease = acquireResolvedAriaRelationship(host, target, 'aria-describedby');
    try {
      expect(target.getAttribute('aria-describedby')).to.equal('author');
      expect(() => lease.update(target)).to.not.throw();
      expect(target.getAttribute('aria-describedby')).to.equal('author');
    } finally {
      lease.release();
    }
    expect(target.getAttribute('aria-describedby')).to.equal('author');
  });

  it('tolerates a rejecting disconnect on an unpublished resolved observer candidate', async () => {
    const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const view = iframe.contentWindow!;
    const doc = iframe.contentDocument!;
    const descriptor = Object.getOwnPropertyDescriptor(view, 'MutationObserver');
    const NativeObserver = Reflect.get(view, 'MutationObserver') as typeof MutationObserver;
    const host = doc.createElement('div');
    const source = doc.createElement('span');
    source.id = 'reentrant-description';
    doc.body.append(host, source);
    const lease = acquireResolvedAriaRelationship(host, null, 'aria-describedby');
    let disconnects = 0;
    class ReleasingObserver extends NativeObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        lease.release();
      }
      override disconnect(): void {
        disconnects += 1;
        super.disconnect();
        throw new TypeError('observer cleanup unavailable');
      }
    }
    try {
      Object.defineProperty(view, 'MutationObserver', { configurable: true, value: ReleasingObserver });
      host.setAttribute('aria-describedby', source.id);
      expect(() => lease.update(null)).to.not.throw();
      expect(disconnects).to.equal(1);
      expect(lease.target === null).to.equal(true);
    } finally {
      lease.release();
      if (descriptor) Object.defineProperty(view, 'MutationObserver', descriptor);
      else Reflect.deleteProperty(view, 'MutationObserver');
    }
  });
});
