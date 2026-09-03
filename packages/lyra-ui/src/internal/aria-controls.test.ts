import { expect, fixture, html } from '@open-wc/testing';
import {
  acquireAriaDescription,
  acquireResolvedAriaRelationship,
  describeElement,
  syncAriaControlsElements,
  syncAriaDescribedByElements,
  type ResolvedAriaRelationship,
  undescribeElement,
} from './aria-controls.js';
import { resolveIdReferencesIn } from './aria-reflection.js';

type Reflected = HTMLElement & {
  ariaDescribedByElements?: Element[] | null;
  ariaLabelledByElements?: Element[] | null;
};

function relationshipProperty(relationship: ResolvedAriaRelationship): keyof Reflected {
  return relationship === 'aria-describedby'
    ? 'ariaDescribedByElements'
    : 'ariaLabelledByElements';
}

function installElementReferenceReflection(
  target: HTMLElement,
  relationship: ResolvedAriaRelationship,
  initial: readonly Element[] | null = null,
): () => void {
  const property = relationshipProperty(relationship);
  let elements = initial === null ? null : [...initial];
  Object.defineProperty(target, property, {
    configurable: true,
    get: () => elements,
    set: (next: readonly Element[] | null) => {
      elements = next === null ? null : [...next];
      target.setAttribute(relationship, '');
    },
  });
  return () => {
    Reflect.deleteProperty(target, property);
  };
}

function reflectedIds(target: HTMLElement, relationship: ResolvedAriaRelationship): string[] {
  const value = Reflect.get(target, relationshipProperty(relationship)) as
    | Iterable<Element>
    | null
    | undefined;
  return value == null ? [] : [...value].map((element) => element.id);
}

function mutationComplete(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function propertyOwner(start: object, property: PropertyKey): object | null {
  let current: object | null = start;
  while (current) {
    if (Object.prototype.hasOwnProperty.call(current, property)) return current;
    current = Object.getPrototypeOf(current) as object | null;
  }
  return null;
}

it('syncAriaControlsElements is a no-op when no control is supplied', async () => {
  const root = await fixture<HTMLElement>(html`<div><span id="dangling"></span></div>`);
  expect(() => syncAriaControlsElements(root, undefined, 'dangling')).to.not.throw();
});

it('tokenizes reflected IDREFs with ASCII whitespace only', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype) ||
    !('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`<div><button></button><span>Reference</span></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const reference = root.querySelector<HTMLElement>('span')!;
  reference.id = 'one\u00a0reference';

  expect(syncAriaDescribedByElements(root, target, reference.id)).to.equal(true);
  expect((target.ariaDescribedByElements ?? []).map((element) => element.id)).to.deep.equal([
    reference.id,
  ]);
  syncAriaControlsElements(root, target, reference.id);
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
    reference.id,
  ]);
});

it('clears supported reflected lists for falsy controls and descriptions', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype) ||
    !('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="clear-reference">Reference</span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;

  syncAriaControlsElements(root, target, 'clear-reference');
  syncAriaControlsElements(root, target, null);
  expect(target.ariaControlsElements?.length ?? -1).to.equal(0);
  expect(syncAriaDescribedByElements(root, target, 'clear-reference')).to.equal(true);
  expect(syncAriaDescribedByElements(root, target, null)).to.equal(false);
  expect(target.ariaDescribedByElements === null).to.equal(true);
});

it('resolves no ID references when the host is its detached element root', () => {
  const host = document.createElement('div');
  const target = document.createElement('button');
  const reference = document.createElement('span');
  reference.id = 'detached-reference';
  host.append(target, reference);

  expect(resolveIdReferencesIn(host, reference.id)).to.deep.equal([]);
  expect(syncAriaDescribedByElements(host, target, reference.id)).to.equal(false);
});

it('adds and restores same-root descriptions through the serialized relationship', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <button aria-describedby="existing">Go</button>
      <span id="existing">Existing</span>
      <span id="owned">Owned</span>
    </div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const owned = root.querySelector<HTMLElement>('#owned')!;
  const applied = describeElement(target, owned);

  expect(target.getAttribute('aria-describedby')).to.equal('existing owned');
  expect(applied.assigned).to.equal(false);
  undescribeElement(applied);
  expect(target.getAttribute('aria-describedby')).to.equal('existing');
});

it('keeps overlapping description handles independent and identity-deduplicated', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="first"></span><span id="second"></span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const firstSource = root.querySelector<HTMLElement>('#first')!;
  const secondSource = root.querySelector<HTMLElement>('#second')!;
  const first = acquireAriaDescription(target, [firstSource, firstSource]);
  const second = acquireAriaDescription(target, [firstSource, secondSource]);

  expect(target.getAttribute('aria-describedby')).to.equal('first second');
  first.release();
  expect(target.getAttribute('aria-describedby')).to.equal('first second');
  second.release();
  second.release();
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('adopts and preserves a late serialized author description while a lease is active', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="owned"></span><span id="author"></span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const owned = root.querySelector<HTMLElement>('#owned')!;
  const lease = acquireAriaDescription(target, [owned]);

  target.setAttribute('aria-describedby', 'author');
  await mutationComplete();
  expect(target.getAttribute('aria-describedby')).to.equal('author owned');
  lease.release();
  expect(target.getAttribute('aria-describedby')).to.equal('author');
});

it('treats a record-backed same-value author description write as the next baseline', async () => {
  const root = await fixture<HTMLElement>(html`<div><button></button><span id="owned"></span></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const owned = root.querySelector<HTMLElement>('#owned')!;
  const lease = acquireAriaDescription(target, [owned]);

  target.setAttribute('aria-describedby', owned.id);
  await mutationComplete();
  lease.release();

  expect(target.getAttribute('aria-describedby')).to.equal(owned.id);
});

it('does not promote generated descriptions when detachment changes native reflection', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="owned"></span><span id="author"></span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const owned = root.querySelector<HTMLElement>('#owned')!;
  const lease = acquireAriaDescription(target, [owned]);

  target.setAttribute('aria-describedby', 'author');
  await mutationComplete();
  target.remove();
  lease.release();

  expect(target.getAttribute('aria-describedby')).to.equal('author');
});

it('does not promote a detached owned source into the author baseline', async function () {
  if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`<div><button></button><span id="moved-owned"></span></div>`);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const owned = root.querySelector<HTMLElement>('#moved-owned')!;
  const lease = acquireAriaDescription(target, [owned]);

  expect(target.getAttribute('aria-describedby')).to.equal(owned.id);
  owned.remove();
  await mutationComplete();
  lease.release();

  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('preserves a serialized baseline when its resolved source detaches', async function () {
  if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div>
      <button aria-describedby="baseline-detached"></button>
      <span id="baseline-detached"></span>
      <span id="owned-retained"></span>
    </div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const baseline = root.querySelector<HTMLElement>('#baseline-detached')!;
  const owned = root.querySelector<HTMLElement>('#owned-retained')!;
  const lease = acquireAriaDescription(target, [owned]);

  expect(target.getAttribute('aria-describedby')).to.equal(`${baseline.id} ${owned.id}`);
  baseline.remove();
  await mutationComplete();
  lease.release();

  expect(target.getAttribute('aria-describedby')).to.equal(baseline.id);
});

it('preserves an initially unresolved serialized baseline when it becomes resolvable', async function () {
  if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
  const baselineId = 'baseline-arrives-later';
  const root = await fixture<HTMLElement>(html`
    <div>
      <button aria-describedby=${baselineId}></button>
      <span id="owned-late-baseline"></span>
    </div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const owned = root.querySelector<HTMLElement>('#owned-late-baseline')!;
  const lease = acquireAriaDescription(target, [owned]);

  expect(target.getAttribute('aria-describedby')).to.equal(`${baselineId} ${owned.id}`);
  const baseline = document.createElement('span');
  baseline.id = baselineId;
  root.append(baseline);
  await mutationComplete();
  lease.release();

  expect(target.getAttribute('aria-describedby')).to.equal(baselineId);
});

it('tracks owned IDs and replaces a lease collection', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="first"></span><span id="second"></span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const first = root.querySelector<HTMLElement>('#first')!;
  const second = root.querySelector<HTMLElement>('#second')!;
  const lease = acquireAriaDescription(target, [first]);

  first.id = 'renamed';
  await mutationComplete();
  expect(target.getAttribute('aria-describedby')).to.equal('renamed');
  lease.update([second]);
  expect(target.getAttribute('aria-describedby')).to.equal('second');
  lease.release();
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('uses and exactly restores an explicit element-reference baseline', () => {
  const target = document.createElement('button');
  const baseline = document.createElement('span');
  const external = document.createElement('span');
  baseline.id = 'baseline';
  external.id = 'external';
  document.body.append(target, baseline, external);
  const cleanup = installElementReferenceReflection(target, 'aria-describedby', [baseline]);
  target.setAttribute('aria-describedby', '');
  const lease = acquireAriaDescription(target, [external]);

  try {
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id, external.id]);
    lease.release();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id]);
  } finally {
    lease.release();
    cleanup();
    target.remove();
    baseline.remove();
    external.remove();
  }
});

it('adopts a reflected author baseline during an explicit update when observation is unavailable', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const foreignWindow = iframe.contentWindow!;
  const foreignDocument = iframe.contentDocument!;
  const descriptor = Object.getOwnPropertyDescriptor(foreignWindow, 'MutationObserver');
  class ThrowingMutationObserver {
    constructor(_callback: MutationCallback) {
      throw new Error('observer unavailable');
    }
  }
  Object.defineProperty(foreignWindow, 'MutationObserver', {
    configurable: true,
    value: ThrowingMutationObserver,
  });
  const target = foreignDocument.createElement('button');
  const owned = foreignDocument.createElement('span');
  const nextOwned = foreignDocument.createElement('span');
  const author = foreignDocument.createElement('span');
  owned.id = 'static-owned';
  nextOwned.id = 'static-owned-next';
  author.id = 'static-author';
  foreignDocument.body.append(target, owned, nextOwned, author);
  const cleanup = installElementReferenceReflection(target, 'aria-describedby');
  const lease = acquireAriaDescription(target, [owned]);

  try {
    Reflect.set(target, 'ariaDescribedByElements', [author]);
    lease.update([nextOwned]);
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([author.id, nextOwned.id]);
    lease.release();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([author.id]);
  } finally {
    lease.release();
    cleanup();
    if (descriptor) Object.defineProperty(foreignWindow, 'MutationObserver', descriptor);
    else Reflect.deleteProperty(foreignWindow, 'MutationObserver');
    iframe.remove();
  }
});

it('composes descriptions across query-imported current source copies', async () => {
  const copyUrl = new URL('./aria-controls.ts?current-description-copy=one', import.meta.url).href;
  const copy = await import(copyUrl) as typeof import('./aria-controls.js');
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="first"></span><span id="second"></span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const firstSource = root.querySelector<HTMLElement>('#first')!;
  const secondSource = root.querySelector<HTMLElement>('#second')!;
  const first = acquireAriaDescription(target, [firstSource]);
  const second = copy.acquireAriaDescription(target, [secondSource]);

  try {
    expect(target.getAttribute('aria-describedby')).to.equal('first second');
    first.release();
    expect(target.getAttribute('aria-describedby')).to.equal('second');
    second.release();
    expect(target.hasAttribute('aria-describedby')).to.equal(false);
  } finally {
    first.release();
    second.release();
  }
});

it('projects authored described-by references before target baseline and generated descriptions', () => {
  const host = document.createElement('div');
  const first = document.createElement('span');
  const second = document.createElement('span');
  const baseline = document.createElement('span');
  const generated = document.createElement('span');
  const target = document.createElement('button');
  first.id = 'author-first';
  second.id = 'author-second';
  baseline.id = 'target-baseline';
  generated.id = 'generated';
  host.setAttribute('aria-describedby', `${first.id} missing ${second.id} ${first.id}`);
  host.append(first, second);
  document.body.append(host, target, baseline, generated);
  const cleanup = installElementReferenceReflection(target, 'aria-describedby', [baseline]);
  target.setAttribute('aria-describedby', '');
  const generatedLease = acquireAriaDescription(target, [generated, first]);
  const resolved = acquireResolvedAriaRelationship(host, target, 'aria-describedby');

  try {
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([
      first.id,
      second.id,
      baseline.id,
      generated.id,
    ]);
    resolved.release();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id, generated.id, first.id]);
    generatedLease.release();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id]);
  } finally {
    resolved.release();
    generatedLease.release();
    cleanup();
    host.remove();
    target.remove();
    baseline.remove();
    generated.remove();
  }
});

it('keeps labelled-by ownership independent and author-first', () => {
  const host = document.createElement('div');
  const author = document.createElement('span');
  const baseline = document.createElement('span');
  const target = document.createElement('button');
  author.id = 'label-author';
  baseline.id = 'label-baseline';
  host.setAttribute('aria-labelledby', author.id);
  host.append(author);
  document.body.append(host, target, baseline);
  const cleanup = installElementReferenceReflection(target, 'aria-labelledby', [baseline]);
  target.setAttribute('aria-labelledby', '');
  const resolved = acquireResolvedAriaRelationship(host, target, 'aria-labelledby');

  try {
    expect(reflectedIds(target, 'aria-labelledby')).to.deep.equal([author.id, baseline.id]);
    resolved.release();
    expect(reflectedIds(target, 'aria-labelledby')).to.deep.equal([baseline.id]);
  } finally {
    resolved.release();
    cleanup();
    host.remove();
    target.remove();
    baseline.remove();
  }
});

it('does not serialize cross-root resolved IDs when element-reference reflection is unavailable', async function () {
  const owner = propertyOwner(HTMLElement.prototype, 'ariaDescribedByElements');
  const descriptor = owner
    ? Object.getOwnPropertyDescriptor(owner, 'ariaDescribedByElements')
    : undefined;
  if (!owner || !descriptor?.configurable) this.skip();
  Reflect.deleteProperty(owner, 'ariaDescribedByElements');
  const host = document.createElement('div');
  const external = document.createElement('span');
  const shell = document.createElement('div');
  external.id = 'cross-root-external';
  host.setAttribute('aria-describedby', external.id);
  host.append(external);
  const shadow = shell.attachShadow({ mode: 'open' });
  const target = document.createElement('button');
  const internal = document.createElement('span');
  internal.id = 'cross-root-internal';
  target.setAttribute('aria-describedby', internal.id);
  shadow.append(target, internal);
  document.body.append(host, shell);
  let lease: ReturnType<typeof acquireResolvedAriaRelationship> | undefined;

  try {
    lease = acquireResolvedAriaRelationship(host, target, 'aria-describedby');
    expect(target.getAttribute('aria-describedby')).to.equal(internal.id);
    lease.release();
    lease = undefined;
    expect(target.getAttribute('aria-describedby')).to.equal(internal.id);
  } finally {
    lease?.release();
    Object.defineProperty(owner, 'ariaDescribedByElements', descriptor);
    host.remove();
    shell.remove();
  }
});

it('refreshes resolved elements for host changes, IDs, replacement, removal, and reinsertion', async () => {
  const host = document.createElement('div');
  const first = document.createElement('span');
  const second = document.createElement('span');
  const target = document.createElement('button');
  const baseline = document.createElement('span');
  first.id = 'first-source';
  second.id = 'second-source';
  baseline.id = 'dynamic-baseline';
  host.setAttribute('aria-describedby', `${first.id} missing ${first.id}`);
  host.append(first, second);
  document.body.append(host, target, baseline);
  const cleanup = installElementReferenceReflection(target, 'aria-describedby', [baseline]);
  target.setAttribute('aria-describedby', '');
  const lease = acquireResolvedAriaRelationship(host, target, 'aria-describedby');

  try {
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([first.id, baseline.id]);
    first.textContent = 'Changed text';
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([first.id, baseline.id]);

    first.id = 'first-source-renamed';
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id]);
    first.id = 'first-source';
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([first.id, baseline.id]);

    host.setAttribute('aria-describedby', second.id);
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([second.id, baseline.id]);

    const replacement = document.createElement('span');
    replacement.id = second.id;
    second.replaceWith(replacement);
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([replacement.id, baseline.id]);

    replacement.remove();
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id]);

    host.append(replacement);
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([replacement.id, baseline.id]);
  } finally {
    lease.release();
    cleanup();
    host.remove();
    target.remove();
    baseline.remove();
  }
});

it('retargets a resolved relationship and restores both exact target baselines', () => {
  const host = document.createElement('div');
  const source = document.createElement('span');
  const firstTarget = document.createElement('button');
  const secondTarget = document.createElement('button');
  const firstBaseline = document.createElement('span');
  const secondBaseline = document.createElement('span');
  source.id = 'retarget-source';
  firstBaseline.id = 'first-baseline';
  secondBaseline.id = 'second-baseline';
  host.setAttribute('aria-labelledby', source.id);
  host.append(source);
  document.body.append(host, firstTarget, secondTarget, firstBaseline, secondBaseline);
  const cleanupFirst = installElementReferenceReflection(
    firstTarget,
    'aria-labelledby',
    [firstBaseline],
  );
  const cleanupSecond = installElementReferenceReflection(
    secondTarget,
    'aria-labelledby',
    [secondBaseline],
  );
  firstTarget.setAttribute('aria-labelledby', '');
  secondTarget.setAttribute('aria-labelledby', '');
  const lease = acquireResolvedAriaRelationship(host, firstTarget, 'aria-labelledby');

  try {
    expect(reflectedIds(firstTarget, 'aria-labelledby')).to.deep.equal([source.id, firstBaseline.id]);
    lease.update(secondTarget);
    expect(reflectedIds(firstTarget, 'aria-labelledby')).to.deep.equal([firstBaseline.id]);
    expect(reflectedIds(secondTarget, 'aria-labelledby')).to.deep.equal([source.id, secondBaseline.id]);
    lease.release();
    expect(reflectedIds(secondTarget, 'aria-labelledby')).to.deep.equal([secondBaseline.id]);
  } finally {
    lease.release();
    cleanupFirst();
    cleanupSecond();
    host.remove();
    firstTarget.remove();
    secondTarget.remove();
    firstBaseline.remove();
    secondBaseline.remove();
  }
});

it('rebinds a resolved host observer after adoption when update is called on reconnect', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const foreignDocument = iframe.contentDocument!;
  const host = foreignDocument.createElement('div');
  const source = foreignDocument.createElement('span');
  const replacement = foreignDocument.createElement('span');
  const target = document.createElement('button');
  const baseline = document.createElement('span');
  source.id = 'adopt-source';
  replacement.id = 'adopt-replacement';
  baseline.id = 'adopt-baseline';
  host.setAttribute('aria-describedby', source.id);
  host.append(source, replacement);
  foreignDocument.body.append(host);
  document.body.append(target, baseline);
  const cleanup = installElementReferenceReflection(target, 'aria-describedby', [baseline]);
  target.setAttribute('aria-describedby', '');
  const lease = acquireResolvedAriaRelationship(host, target, 'aria-describedby');

  try {
    document.adoptNode(host);
    document.body.append(host);
    lease.update(target);
    host.setAttribute('aria-describedby', replacement.id);
    await mutationComplete();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([replacement.id, baseline.id]);
    lease.release();
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id]);
  } finally {
    lease.release();
    cleanup();
    host.remove();
    target.remove();
    baseline.remove();
    iframe.remove();
  }
});

it('observes only the host until a late described-by write needs source-root tracking', async () => {
  const OriginalMutationObserver = window.MutationObserver;
  let host: HTMLElement;
  let hostObserverDisconnects = 0;
  let rootObservations = 0;
  let rootObserverDisconnects = 0;
  class RecordingMutationObserver extends OriginalMutationObserver {
    private observesHostRelationship = false;
    private observesRoot = false;

    override observe(target: Node, options: MutationObserverInit): void {
      if (target === host && options.attributeFilter?.includes('aria-describedby')) {
        this.observesHostRelationship = true;
      }
      if (target === document && options.childList && options.subtree &&
        options.attributeFilter?.includes('id')) {
        this.observesRoot = true;
        rootObservations += 1;
      }
      super.observe(target, options);
    }

    override disconnect(): void {
      if (this.observesHostRelationship) hostObserverDisconnects += 1;
      if (this.observesRoot) rootObserverDisconnects += 1;
      super.disconnect();
    }
  }
  window.MutationObserver = RecordingMutationObserver;
  host = document.createElement('div');
  const target = document.createElement('button');
  const baseline = document.createElement('span');
  baseline.id = 'lazy-observer-baseline';
  document.body.append(host, target, baseline);
  const cleanup = installElementReferenceReflection(target, 'aria-describedby', [baseline]);
  target.setAttribute('aria-describedby', '');
  let lease: ReturnType<typeof acquireResolvedAriaRelationship> | undefined;

  try {
    lease = acquireResolvedAriaRelationship(host, target, 'aria-describedby');
    expect(rootObservations).to.equal(0);
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([baseline.id]);
    lease.update(target);
    expect(hostObserverDisconnects).to.equal(0);

    host.setAttribute('aria-describedby', 'late-description');
    await mutationComplete();
    const source = document.createElement('span');
    source.id = 'late-description';
    host.append(source);
    await mutationComplete();

    expect(rootObservations).to.be.greaterThan(0);
    expect(reflectedIds(target, 'aria-describedby')).to.deep.equal([source.id, baseline.id]);

    host.removeAttribute('aria-describedby');
    await mutationComplete();
    expect(rootObserverDisconnects).to.equal(1);
  } finally {
    lease?.release();
    cleanup();
    host.remove();
    target.remove();
    baseline.remove();
    window.MutationObserver = OriginalMutationObserver;
  }
});
