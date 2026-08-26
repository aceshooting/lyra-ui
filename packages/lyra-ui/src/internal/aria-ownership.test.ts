import { expect, fixture, html } from '@open-wc/testing';
import { acquireAriaOwnership } from './aria-ownership.js';

it('filters non-aria-prefixed keys and null/undefined values out of the attribute contribution', async () => {
  const target = await fixture<HTMLButtonElement>(html`<button>Go</button>`);
  const lease = acquireAriaOwnership(target, {
    attributes: {
      'data-foo': 'x',
      'aria-label': null,
      'aria-expanded': 'true',
    },
  });

  expect(target.getAttribute('aria-expanded')).to.equal('true');
  expect(target.hasAttribute('data-foo')).to.equal(false);
  expect(target.hasAttribute('aria-label')).to.equal(false);

  lease.release();
  expect(target.hasAttribute('aria-expanded')).to.equal(false);
});

it('accepts a null initial target and applies its contribution once retargeted', () => {
  const lease = acquireAriaOwnership(null, { attributes: { 'aria-label': 'Generated' } });
  expect(lease.target).to.equal(null);

  const target = document.createElement('button');
  document.body.append(target);
  try {
    lease.update(target, { attributes: { 'aria-label': 'Generated' } });
    expect(target.getAttribute('aria-label')).to.equal('Generated');
    lease.release();
    expect(target.hasAttribute('aria-label')).to.equal(false);
  } finally {
    target.remove();
  }
});

it('releases the controls relationship while keeping the attribute contribution when controls is dropped from an update', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div><button></button><section id="dropped-control"></section></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const control = root.querySelector<HTMLElement>('#dropped-control')!;
  const lease = acquireAriaOwnership(target, {
    attributes: { 'aria-expanded': 'true' },
    controls: [control],
  });

  expect(target.getAttribute('aria-expanded')).to.equal('true');
  expect(target.getAttribute('aria-controls')).to.equal('dropped-control');

  lease.update(target, { attributes: { 'aria-expanded': 'true' } });

  expect(target.getAttribute('aria-expanded')).to.equal('true');
  expect(target.hasAttribute('aria-controls')).to.equal(false);

  lease.release();
  expect(target.hasAttribute('aria-expanded')).to.equal(false);
});

it('releases the description relationship while keeping other contributions when descriptions is dropped from an update', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="dropped-description">Details</span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const description = root.querySelector<HTMLElement>('#dropped-description')!;
  const lease = acquireAriaOwnership(target, {
    attributes: { 'aria-expanded': 'true' },
    descriptions: [description],
  });

  expect(target.getAttribute('aria-describedby')).to.equal('dropped-description');

  lease.update(target, { attributes: { 'aria-expanded': 'true' } });

  expect(target.hasAttribute('aria-describedby')).to.equal(false);
  expect(target.getAttribute('aria-expanded')).to.equal('true');

  lease.release();
  expect(target.hasAttribute('aria-expanded')).to.equal(false);
});

it('preserves non-ASCII IDREF tokens and reflects controls whose ids contain ASCII whitespace', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div><button></button><section>Baseline</section><section>Owned</section></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const [baseline, owned] = root.querySelectorAll<HTMLElement>('section');
  baseline!.id = 'baseline\u00a0control';
  owned!.id = 'owned control';
  target.setAttribute('aria-controls', baseline!.id);

  const lease = acquireAriaOwnership(target, { controls: [owned!] });
  expect(target.getAttribute('aria-controls')).to.equal('');
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
    'baseline\u00a0control',
    'owned control',
  ]);

  owned!.id = 'renamed owned control';
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
    'baseline\u00a0control',
    'renamed owned control',
  ]);

  lease.release();
  expect(target.getAttribute('aria-controls')).to.equal('baseline\u00a0control');
});

it('composes whole-value owners and preserves a late author write after release', async () => {
  const target = await fixture<HTMLButtonElement>(html`<button aria-haspopup="listbox">Open</button>`);
  const first = acquireAriaOwnership(target, {
    attributes: { 'aria-expanded': 'false', 'aria-haspopup': 'menu' },
  });
  const second = acquireAriaOwnership(target, {
    attributes: { 'aria-expanded': 'true' },
  });

  expect(target.getAttribute('aria-expanded')).to.equal('true');
  target.setAttribute('aria-haspopup', 'dialog');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(target.getAttribute('aria-haspopup')).to.equal('menu');

  second.release();
  expect(target.getAttribute('aria-expanded')).to.equal('false');
  first.release();
  expect(target.hasAttribute('aria-expanded')).to.equal(false);
  expect(target.getAttribute('aria-haspopup')).to.equal('dialog');
});

it('retargets across replacement and restores each target baseline exactly', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div><button id="first" aria-label="First author"></button><button id="second" aria-label="Second author"></button></div>
  `);
  const first = root.querySelector<HTMLElement>('#first')!;
  const second = root.querySelector<HTMLElement>('#second')!;
  const lease = acquireAriaOwnership(first, { attributes: { 'aria-label': 'Generated' } });
  expect(first.getAttribute('aria-label')).to.equal('Generated');

  lease.update(second, { attributes: { 'aria-label': 'Replacement generated' } });
  expect(first.getAttribute('aria-label')).to.equal('First author');
  expect(second.getAttribute('aria-label')).to.equal('Replacement generated');

  lease.release();
  expect(second.getAttribute('aria-label')).to.equal('Second author');
});

it('owns controls and descriptions by element across roots and tracks controlled id changes', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const tagName = 'test-aria-ownership-trigger-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<button aria-controls="baseline"></button><span id="baseline"></span>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(
    `<div><${tagName}></${tagName}><section id="owned-panel"></section><span id="owned-description"></span></div>`,
  );
  const host = root.querySelector<HTMLElement>(tagName)!;
  const target = host.shadowRoot!.querySelector('button') as HTMLElement & {
    ariaControlsElements: Element[] | null;
  };
  const panel = root.querySelector<HTMLElement>('#owned-panel')!;
  const description = root.querySelector<HTMLElement>('#owned-description')!;
  const lease = acquireAriaOwnership(target, { controls: [panel], descriptions: [description] });

  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.have.members([
    'baseline',
    'owned-panel',
  ]);
  panel.id = 'renamed-owned-panel';
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.include('renamed-owned-panel');

  lease.release();
  expect(target.getAttribute('aria-controls')).to.equal('baseline');
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('owns a shadow-private control from a light-DOM native trigger', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const tagName = 'test-aria-ownership-private-control-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<section id="private-panel"></section>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(
    `<div><button id="outside-trigger"></button>${`<${tagName} id="private-control-host"></${tagName}>`}</div>`,
  );
  const trigger = root.querySelector<HTMLButtonElement>('#outside-trigger')!;
  const host = root.querySelector<HTMLElement>(tagName)!;
  const panel = host.shadowRoot!.querySelector<HTMLElement>('#private-panel')!;

  const lease = acquireAriaOwnership(trigger, { controls: [panel] });

  // A light-DOM relation cannot pierce inward into a private shadow tree. The host is the narrowest
  // exposed controlled target and semantically owns the private panel.
  expect((trigger.ariaControlsElements ?? []).includes(host)).to.equal(true);
  expect((trigger.ariaControlsElements ?? []).includes(panel)).to.equal(false);
  expect(trigger.getAttribute('aria-controls')).to.equal('private-control-host');
  lease.release();
  expect(trigger.hasAttribute('aria-controls')).to.equal(false);
});

it('keeps outward ancestor-shadow controls exact while exposing sibling-private controls', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const innerTag = 'test-aria-ownership-nested-trigger-host';
  const siblingTag = 'test-aria-ownership-sibling-control-host';
  const outerTag = 'test-aria-ownership-ancestor-scope-host';
  if (!customElements.get(innerTag)) {
    customElements.define(
      innerTag,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<button></button>';
        }
      },
    );
  }
  if (!customElements.get(siblingTag)) {
    customElements.define(
      siblingTag,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<section id="sibling-private"></section>';
        }
      },
    );
  }
  if (!customElements.get(outerTag)) {
    customElements.define(
      outerTag,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = `
            <section id="ancestor-control"></section>
            <${innerTag}></${innerTag}>
            <${siblingTag} id="sibling-host"></${siblingTag}>
          `;
        }
      },
    );
  }
  const outer = await fixture<HTMLElement>(`<${outerTag}></${outerTag}>`);
  const ancestorControl = outer.shadowRoot!.querySelector<HTMLElement>('#ancestor-control')!;
  const inner = outer.shadowRoot!.querySelector<HTMLElement>(innerTag)!;
  const target = inner.shadowRoot!.querySelector('button') as HTMLButtonElement & {
    ariaControlsElements: Element[] | null;
  };
  const siblingHost = outer.shadowRoot!.querySelector<HTMLElement>('#sibling-host')!;
  const siblingPrivate = siblingHost.shadowRoot!.querySelector<HTMLElement>('#sibling-private')!;

  const lease = acquireAriaOwnership(target, { controls: [ancestorControl, siblingPrivate] });
  const resolved = (target.ariaControlsElements ?? []).map((element) => element.id);

  expect(resolved).to.deep.equal(['ancestor-control', 'sibling-host']);
  expect(resolved.includes(outer.id)).to.equal(false);
  lease.release();
});

it('does not preserve a generated control when its target detaches before release', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const tagName = 'test-aria-ownership-detached-private-control-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<section></section>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(
    `<div><button id="detach-trigger"></button>${`<${tagName} id="detach-control-host"></${tagName}>`}</div>`,
  );
  const trigger = root.querySelector<HTMLButtonElement>('#detach-trigger')!;
  const host = root.querySelector<HTMLElement>(tagName)!;
  const panel = host.shadowRoot!.querySelector<HTMLElement>('section')!;
  const lease = acquireAriaOwnership(trigger, { controls: [panel] });

  host.remove();
  lease.release();

  expect(trigger.hasAttribute('aria-controls')).to.equal(false);
});

it('retargets after detachment without replacing late authored relationship baselines', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype) || !('ariaDescribedByElements' in HTMLElement.prototype)) {
    this.skip();
  }
  const root = await fixture<HTMLElement>(html`
    <div>
      <button id="detached-old-trigger"></button>
      <button id="detached-new-trigger"></button>
      <section id="generated-control"></section>
      <span id="generated-description">Generated</span>
      <section id="late-author-control"></section>
      <span id="late-author-description">Author</span>
    </div>
  `);
  const oldTarget = root.querySelector<HTMLButtonElement>('#detached-old-trigger')!;
  const newTarget = root.querySelector<HTMLButtonElement>('#detached-new-trigger')!;
  const generatedControl = root.querySelector<HTMLElement>('#generated-control')!;
  const generatedDescription = root.querySelector<HTMLElement>('#generated-description')!;
  const lease = acquireAriaOwnership(oldTarget, {
    controls: [generatedControl],
    descriptions: [generatedDescription],
  });

  oldTarget.setAttribute('aria-controls', 'late-author-control');
  oldTarget.setAttribute('aria-describedby', 'late-author-description');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  oldTarget.remove();
  lease.update(newTarget, {});

  expect(oldTarget.getAttribute('aria-controls')).to.equal('late-author-control');
  expect(oldTarget.getAttribute('aria-describedby')).to.equal('late-author-description');
  lease.release();
});

it('composes attribute and control owners acquired through separate module instances', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const firstPath = '../../dist/internal/aria-ownership.js?aria-owner-copy=first';
  const secondPath = '../../dist/internal/aria-ownership.js?aria-owner-copy=second';
  const firstCopy = await import(firstPath);
  const secondCopy = await import(secondPath);
  const root = await fixture<HTMLElement>(html`
    <div><button></button><section id="copy-control-first"></section><section id="copy-control-second"></section></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const firstControl = root.querySelector<HTMLElement>('#copy-control-first')!;
  const secondControl = root.querySelector<HTMLElement>('#copy-control-second')!;
  const first = firstCopy.acquireAriaOwnership(target, {
    attributes: { 'aria-expanded': 'false' },
    controls: [firstControl],
  });
  const second = secondCopy.acquireAriaOwnership(target, {
    attributes: { 'aria-expanded': 'true' },
    controls: [secondControl],
  });

  expect(target.getAttribute('aria-expanded')).to.equal('true');
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.have.members([
    'copy-control-first',
    'copy-control-second',
  ]);
  first.release();
  expect(target.getAttribute('aria-expanded')).to.equal('true');
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
    'copy-control-second',
  ]);
  second.release();
  expect(target.hasAttribute('aria-expanded')).to.equal(false);
  expect(target.hasAttribute('aria-controls')).to.equal(false);
});

it('treats late same-value generated attributes and controls as authored baselines', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const root = await fixture<HTMLElement>(html`
    <div><button></button><section id="same-control"></section></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const control = root.querySelector<HTMLElement>('section')!;
  const lease = acquireAriaOwnership(target, {
    attributes: { 'aria-expanded': 'false' },
    controls: [control],
  });

  target.setAttribute('aria-expanded', 'false');
  target.setAttribute('aria-controls', 'same-control');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  lease.release();

  expect(target.getAttribute('aria-expanded')).to.equal('false');
  expect(target.getAttribute('aria-controls')).to.equal('same-control');
});

it('recreates attribute and control observation in the target realm after adoption', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const wrapper = iframe.contentDocument!.createElement('div');
  wrapper.innerHTML = '<button></button><section id="adopted-owned-control"></section>';
  iframe.contentDocument!.body.append(wrapper);
  const target = wrapper.querySelector<HTMLButtonElement>('button')!;
  const owned = wrapper.querySelector<HTMLElement>('section')!;
  const contribution = {
    attributes: { 'aria-expanded': 'false' },
    controls: [owned],
  } as const;
  const lease = acquireAriaOwnership(target, contribution);

  document.body.append(wrapper);
  lease.update(target, contribution);
  iframe.remove();
  const author = document.createElement('section');
  author.id = 'adopted-author-control';
  document.body.append(author);
  target.setAttribute('aria-expanded', 'true');
  target.setAttribute('aria-controls', author.id);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(target.getAttribute('aria-expanded')).to.equal('false');
  expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.have.members([
    'adopted-author-control',
    'adopted-owned-control',
  ]);
  lease.release();
  expect(target.getAttribute('aria-expanded')).to.equal('true');
  expect(target.getAttribute('aria-controls')).to.equal('adopted-author-control');
  wrapper.remove();
  author.remove();
});

it('preserves whole-value owner order when an older lease updates after adoption', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const target = iframe.contentDocument!.createElement('button');
  iframe.contentDocument!.body.append(target);
  const older = acquireAriaOwnership(target, { attributes: { 'aria-label': 'Older' } });
  const newer = acquireAriaOwnership(target, { attributes: { 'aria-label': 'Newer' } });
  expect(target.getAttribute('aria-label')).to.equal('Newer');

  document.body.append(target);
  older.update(target, { attributes: { 'aria-label': 'Older adopted' } });

  expect(target.getAttribute('aria-label')).to.equal('Newer');
  newer.release();
  expect(target.getAttribute('aria-label')).to.equal('Older adopted');
  older.release();
  expect(target.hasAttribute('aria-label')).to.equal(false);
  target.remove();
});

it('uses serialized relationships in a defaultView-less document with hostile reflection', async () => {
  const detachedDocument = document.implementation.createHTMLDocument('detached ownership');
  const target = detachedDocument.createElement('button');
  const control = detachedDocument.createElement('section');
  const description = detachedDocument.createElement('span');
  control.id = 'detached-control';
  description.id = 'detached-description';
  detachedDocument.body.append(target, control, description);
  Object.defineProperty(target, 'ariaControlsElements', {
    configurable: true,
    get() {
      throw new Error('reflection read failed');
    },
    set() {},
  });

  const contribution = {
    attributes: { 'aria-expanded': 'true' },
    controls: [control],
    descriptions: [description],
  } as const;
  const lease = acquireAriaOwnership(target, contribution);
  expect(lease.target?.localName).to.equal('button');
  expect(target.getAttribute('aria-expanded')).to.equal('true');
  expect(target.getAttribute('aria-controls')).to.equal(control.id);
  expect(target.getAttribute('aria-describedby')).to.equal(description.id);

  lease.update(target, contribution);
  expect(target.getAttribute('aria-controls')).to.equal(control.id);
  lease.release();
  lease.release();
  lease.update(target, contribution);
  expect(lease.target).to.equal(null);
  expect(target.hasAttribute('aria-expanded')).to.equal(false);
  expect(target.hasAttribute('aria-controls')).to.equal(false);
  expect(target.hasAttribute('aria-describedby')).to.equal(false);
});

it('deduplicates and restores an explicit aria-controls element baseline', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const root = document.createElement('div');
  const target = document.createElement('button');
  const baseline = document.createElement('section');
  const owned = document.createElement('section');
  baseline.id = 'explicit-baseline-control';
  owned.id = 'explicit-owned-control';
  root.append(target, baseline, owned);
  document.body.append(root);
  try {
    target.ariaControlsElements = [baseline];
    const lease = acquireAriaOwnership(target, { controls: [baseline, owned, owned] });
    expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
      baseline.id,
      owned.id,
    ]);
    lease.release();
    expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
      baseline.id,
    ]);
  } finally {
    root.remove();
  }
});

it('fails closed when a detached target root cannot resolve its authored control ids', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const detachedRoot = document.createElement('div');
  const target = document.createElement('button');
  const authored = document.createElement('section');
  const owned = document.createElement('section');
  authored.id = 'detached-authored-control';
  owned.id = 'document-owned-control';
  target.setAttribute('aria-controls', authored.id);
  detachedRoot.append(target, authored);
  document.body.append(owned);
  try {
    expect(detachedRoot.getRootNode() === detachedRoot).to.equal(true);
    const lease = acquireAriaOwnership(target, { controls: [owned] });
    expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([]);
    expect(target.getAttribute('aria-controls')).to.equal('');
    lease.release();
    expect(target.getAttribute('aria-controls')).to.equal(authored.id);
  } finally {
    owned.remove();
  }
});

it('keeps a surviving control owner active when a peer releases', async function () {
  if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
  const root = document.createElement('div');
  const target = document.createElement('button');
  const firstControl = document.createElement('section');
  const secondControl = document.createElement('section');
  firstControl.id = 'surviving-first-control';
  secondControl.id = 'surviving-second-control';
  root.append(target, firstControl, secondControl);
  document.body.append(root);
  try {
    const first = acquireAriaOwnership(target, { controls: [firstControl] });
    const second = acquireAriaOwnership(target, { controls: [secondControl] });
    first.release();
    expect((target.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([
      secondControl.id,
    ]);
    second.release();
    expect(target.hasAttribute('aria-controls')).to.equal(false);
  } finally {
    root.remove();
  }
});
