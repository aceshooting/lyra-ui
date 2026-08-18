import { expect, fixture, html } from '@open-wc/testing';
import {
  acquireAriaDescription,
  describeElement,
  syncAriaControlsElements,
  syncAriaDescribedByElements,
  undescribeElement,
} from './aria-controls.js';

type Reflected = HTMLElement & { ariaDescribedByElements?: Element[] | null };

const supportsElementReferences = 'ariaDescribedByElements' in HTMLElement.prototype;

it('syncAriaControlsElements is a no-op when no control is supplied', async () => {
  const root = await fixture<HTMLElement>(html`<div><span id="dangling"></span></div>`);
  expect(() => syncAriaControlsElements(root, undefined, 'dangling')).to.not.throw();
});

it('tokenizes reflected IDREFs with ASCII whitespace only', async function () {
  if (!supportsElementReferences || !('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`<div><button></button><span>Description</span></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const reference = root.querySelector<HTMLElement>('span')!;
  reference.id = 'one\u00a0reference';

  expect(syncAriaDescribedByElements(root, target, reference.id)).to.equal(true);
  expect((target.ariaDescribedByElements ?? []).map((element) => element.id)).to.deep.equal([
    'one\u00a0reference',
  ]);
  syncAriaControlsElements(root, target, reference.id);
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
    'one\u00a0reference',
  ]);
});

it('syncAriaControlsElements clears an assigned element-reference list back to empty when controls becomes falsy', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`<div><button></button><span id="clear-controls-target">Panel</span></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const reference = root.querySelector<HTMLElement>('#clear-controls-target')!;

  syncAriaControlsElements(root, target, reference.id);
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
    'clear-controls-target',
  ]);

  syncAriaControlsElements(root, target, null);
  expect(target.ariaControlsElements).to.deep.equal([]);
});

it('syncAriaDescribedByElements clears an assigned element-reference list to null when describedBy becomes falsy', async function () {
  if (!supportsElementReferences) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="clear-described-first">First</span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const description = root.querySelector<HTMLElement>('#clear-described-first')!;

  expect(syncAriaDescribedByElements(root, target, description.id)).to.equal(true);
  expect((target.ariaDescribedByElements ?? []).map((element) => element.id)).to.deep.equal([
    'clear-described-first',
  ]);

  expect(syncAriaDescribedByElements(root, target, null)).to.equal(false);
  expect(target.ariaDescribedByElements).to.equal(null);
});

it('resolves no id references when the host is its own root (a detached element, not a Document/ShadowRoot)', () => {
  // A standalone, never-appended element is its own getRootNode() result -- a plain Element, which
  // (unlike Document/DocumentFragment/ShadowRoot) implements no NonElementParentNode.getElementById.
  const host = document.createElement('div');
  const target = document.createElement('button');
  const reference = document.createElement('span');
  reference.id = 'detached-reference';
  host.append(target, reference);

  expect(host.getRootNode() === host).to.equal(true);
  expect(syncAriaDescribedByElements(host, target, reference.id)).to.equal(false);
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('uses element reflection when an owned description id is not one serializable IDREF token', async function () {
  if (!supportsElementReferences) this.skip();
  const root = await fixture<HTMLElement>(html`<div><button></button><span>Description</span></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const description = root.querySelector<HTMLElement>('span')!;
  description.id = 'owned description';
  const lease = acquireAriaDescription(target, [description]);

  expect(target.getAttribute('aria-describedby')).to.equal('');
  expect((target.ariaDescribedByElements ?? []).map((element) => element.id)).to.deep.equal([
    'owned description',
  ]);
  description.id = 'renamed owned description';
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect((target.ariaDescribedByElements ?? []).map((element) => element.id)).to.deep.equal([
    'renamed owned description',
  ]);
  lease.release();
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('adds a same-root description through the serialized attribute', async () => {
  const el = await fixture<HTMLElement>(html`
    <div><button id="describe-target">Go</button><span id="describe-source">Details</span></div>
  `);
  const target = el.querySelector<HTMLElement>('#describe-target')!;
  const source = el.querySelector('#describe-source')!;

  const applied = describeElement(target, source);
  expect(target.getAttribute('aria-describedby')).to.equal('describe-source');
  expect(applied.assigned).to.be.false;

  undescribeElement(applied);
  expect(target.hasAttribute('aria-describedby')).to.be.false;
});

it('keeps the descriptions a target already had and restores them exactly', async () => {
  const el = await fixture<HTMLElement>(html`
    <div>
      <button id="describe-target-2" aria-describedby="describe-existing">Go</button>
      <span id="describe-existing">Existing</span>
      <span id="describe-source-2">Details</span>
    </div>
  `);
  const target = el.querySelector<HTMLElement>('#describe-target-2')!;
  const source = el.querySelector('#describe-source-2')!;

  const applied = describeElement(target, source);
  expect(target.getAttribute('aria-describedby')?.split(/\s+/)).to.have.members([
    'describe-existing',
    'describe-source-2',
  ]);

  undescribeElement(applied);
  expect(target.getAttribute('aria-describedby')).to.equal('describe-existing');
});

it('is a no-op when the description is already applied', async () => {
  const el = await fixture<HTMLElement>(html`
    <div><button id="describe-target-3" aria-describedby="describe-source-3">Go</button><span id="describe-source-3">D</span></div>
  `);
  const target = el.querySelector<HTMLElement>('#describe-target-3')!;
  const source = el.querySelector('#describe-source-3')!;

  const applied = describeElement(target, source);
  expect(applied.assigned).to.be.false;
  expect(target.getAttribute('aria-describedby')).to.equal('describe-source-3');
  undescribeElement(applied);
  expect(target.getAttribute('aria-describedby')).to.equal('describe-source-3');
});

it('crosses a shadow boundary through the element-reference list without dropping existing links', async () => {
  const tagName = 'test-aria-controls-described-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML =
            '<button aria-describedby="inner-hint">Go</button><span id="inner-hint">Hint</span>';
        }
      },
    );
  }
  const el = await fixture<HTMLElement>(`<div>${`<${tagName}></${tagName}>`}<span id="outer-source">Details</span></div>`);
  const host = el.querySelector<HTMLElement>(tagName)!;
  const target = host.shadowRoot!.querySelector('button') as Reflected;
  const hint = host.shadowRoot!.querySelector('#inner-hint')!;
  const source = el.querySelector('#outer-source')!;

  const applied = describeElement(target, source);
  if (supportsElementReferences) {
    expect(applied.assigned).to.be.true;
    expect([...(target.ariaDescribedByElements ?? [])].map((node) => node.id)).to.have.members([
      'inner-hint',
      'outer-source',
    ]);
    // Assigning the element-reference list clears the serialized attribute by contract.
    expect(target.getAttribute('aria-describedby')).to.equal('');
  } else {
    expect(applied.assigned).to.be.false;
    expect(target.getAttribute('aria-describedby')?.split(/\s+/)).to.have.members(['inner-hint', 'outer-source']);
  }

  undescribeElement(applied);
  expect(target.getAttribute('aria-describedby')).to.equal('inner-hint');
  // Back to plain attribute reflection: the explicitly assigned list is gone.
  expect([...(target.ariaDescribedByElements ?? [hint])].map((node) => node.id)).to.deep.equal(['inner-hint']);
});

it('keeps overlapping description handles independent when they release out of order', async () => {
  const el = await fixture<HTMLElement>(html`
    <div>
      <button id="overlap-target">Go</button>
      <span id="overlap-first">First details</span>
      <span id="overlap-second">Second details</span>
    </div>
  `);
  const target = el.querySelector<HTMLElement>('#overlap-target')!;
  const first = el.querySelector('#overlap-first')!;
  const second = el.querySelector('#overlap-second')!;

  const firstHandle = describeElement(target, first);
  const secondHandle = describeElement(target, second);
  expect(target.getAttribute('aria-describedby')?.split(/\s+/)).to.have.members([
    'overlap-first',
    'overlap-second',
  ]);

  undescribeElement(firstHandle);
  expect(target.getAttribute('aria-describedby')).to.equal('overlap-second');

  undescribeElement(secondHandle);
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('preserves a late external aria-describedby write after the owned description releases', async () => {
  const el = await fixture<HTMLElement>(html`
    <div>
      <button id="late-target">Go</button>
      <span id="late-description">Temporary details</span>
      <span id="late-author">Late author details</span>
    </div>
  `);
  const target = el.querySelector<HTMLElement>('#late-target')!;
  const description = el.querySelector('#late-description')!;
  const handle = describeElement(target, description);

  target.setAttribute('aria-describedby', 'late-author');
  undescribeElement(handle);

  expect(target.getAttribute('aria-describedby')).to.equal('late-author');
});

it('merges a late external write while the owned description remains active', async () => {
  const el = await fixture<HTMLElement>(html`
    <div>
      <button id="live-target">Go</button>
      <span id="live-owned">Owned details</span>
      <span id="live-author">Author details</span>
    </div>
  `);
  const target = el.querySelector<HTMLElement>('#live-target')!;
  const description = el.querySelector('#live-owned')!;
  const handle = describeElement(target, description);

  target.setAttribute('aria-describedby', 'live-author');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(target.getAttribute('aria-describedby')?.split(/\s+/)).to.have.members([
    'live-author',
    'live-owned',
  ]);
  undescribeElement(handle);
  expect(target.getAttribute('aria-describedby')).to.equal('live-author');
});

it('tracks owned description id changes and supports replacing a lease collection', async () => {
  const el = await fixture<HTMLElement>(html`
    <div>
      <button id="update-target">Go</button>
      <span id="update-first">First</span>
      <span id="update-second">Second</span>
    </div>
  `);
  const target = el.querySelector<HTMLElement>('#update-target')!;
  const first = el.querySelector('#update-first')!;
  const second = el.querySelector('#update-second')!;
  const lease = acquireAriaDescription(target, [first]);

  first.id = 'update-first-renamed';
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(target.getAttribute('aria-describedby')).to.equal('update-first-renamed');

  lease.update([second]);
  expect(target.getAttribute('aria-describedby')).to.equal('update-second');
  lease.release();
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('restores an explicit element-reference baseline after a cross-root description releases', async function () {
  if (!supportsElementReferences) this.skip();
  const tagName = 'test-aria-description-baseline-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<button>Go</button><span id="baseline">Baseline</span>';
        }
      },
    );
  }
  const el = await fixture<HTMLElement>(
    `<div>${`<${tagName}></${tagName}>`}<span id="transient-cross-root">Transient</span></div>`,
  );
  const host = el.querySelector<HTMLElement>(tagName)!;
  const target = host.shadowRoot!.querySelector('button') as Reflected;
  const baseline = host.shadowRoot!.querySelector('#baseline')!;
  const transient = el.querySelector('#transient-cross-root')!;
  target.ariaDescribedByElements = [baseline];

  const handle = describeElement(target, transient);
  undescribeElement(handle);

  expect((target.ariaDescribedByElements ?? []).map((element) => element.id)).to.deep.equal(['baseline']);
});

it('does not promote an owned relationship when a dangling reflected sync is a no-op', async function () {
  if (!supportsElementReferences) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div><button id="no-op-sync-target"></button><span id="no-op-sync-owned">Owned</span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('#no-op-sync-target')!;
  const owned = root.querySelector<HTMLElement>('#no-op-sync-owned')!;
  const lease = acquireAriaDescription(target, [owned]);

  expect(syncAriaDescribedByElements(root, target, 'dangling-description-id')).to.equal(false);
  lease.release();

  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('does not preserve a generated description when its source detaches before release', async function () {
  if (!supportsElementReferences) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div><button id="detach-description-target"></button><span id="detach-description-owned">Owned</span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('#detach-description-target')!;
  const owned = root.querySelector<HTMLElement>('#detach-description-owned')!;
  const lease = acquireAriaDescription(target, [owned]);

  owned.remove();
  lease.release();

  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('composes description leases acquired through separate module instances', async () => {
  const firstCopy = await import('./aria-controls.js?description-owner-copy=first');
  const secondCopy = await import('./aria-controls.js?description-owner-copy=second');
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="copy-first">First</span><span id="copy-second">Second</span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const first = root.querySelector<HTMLElement>('#copy-first')!;
  const second = root.querySelector<HTMLElement>('#copy-second')!;
  const firstLease = firstCopy.acquireAriaDescription(target, [first]);
  const secondLease = secondCopy.acquireAriaDescription(target, [second]);

  expect(target.getAttribute('aria-describedby')?.split(' ')).to.have.members(['copy-first', 'copy-second']);
  firstLease.release();
  expect(target.getAttribute('aria-describedby')).to.equal('copy-second');
  secondLease.release();
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('treats a late same-value aria-describedby mutation as an authored baseline', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="same-description">Description</span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const description = root.querySelector<HTMLElement>('#same-description')!;
  const lease = acquireAriaDescription(target, [description]);

  target.setAttribute('aria-describedby', 'same-description');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  lease.release();

  expect(target.getAttribute('aria-describedby')).to.equal('same-description');
});

it('recreates description observation in the target realm after adoption', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const wrapper = iframe.contentDocument!.createElement('div');
  wrapper.innerHTML = '<button></button><span id="adopted-owned-description">Owned</span>';
  iframe.contentDocument!.body.append(wrapper);
  const target = wrapper.querySelector<HTMLButtonElement>('button')!;
  const owned = wrapper.querySelector<HTMLElement>('span')!;
  const lease = acquireAriaDescription(target, [owned]);

  document.body.append(wrapper);
  lease.update([owned]);
  iframe.remove();
  const author = document.createElement('span');
  author.id = 'adopted-author-description';
  document.body.append(author);
  target.setAttribute('aria-describedby', author.id);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(target.getAttribute('aria-describedby')?.split(' ')).to.have.members([
    'adopted-author-description',
    'adopted-owned-description',
  ]);
  lease.release();
  expect(target.getAttribute('aria-describedby')).to.equal('adopted-author-description');
  wrapper.remove();
  author.remove();
});
