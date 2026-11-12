import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { activeElementIn, deepActiveElementIn, isUsableActiveElement, safeDeepActiveElement, shadowFocusTarget } from './active-element.js';

/** Replaces one root's `activeElement` with a getter that throws, exactly as happy-dom's does when
 *  the document has no active element. Returns a restore function: deleting the own property
 *  re-exposes the real prototype getter underneath. */
function breakActiveElement(root: DocumentOrShadowRoot): () => void {
  Object.defineProperty(root, 'activeElement', {
    configurable: true,
    get(): never {
      throw new TypeError("Cannot read properties of undefined (reading 'getRootNode')");
    },
  });
  return () => {
    delete (root as unknown as Record<string, unknown>)['activeElement'];
  };
}

describe('activeElementIn', () => {
  it('returns the focused element in a normal DOM', async () => {
    const host = (await fixture(html`
      <div><button id="a">A</button><button id="b">B</button></div>
    `)) as HTMLElement;
    const b = host.querySelector<HTMLButtonElement>('#b')!;
    await focusByKeyboard(b);
    expect(activeElementIn(document) === b).to.equal(true);
  });

  it('returns null rather than throwing when the getter throws', () => {
    const root = document.createElement('div').attachShadow({ mode: 'open' });
    const restore = breakActiveElement(root);
    try {
      // The whole point: `root?.activeElement` would NOT survive this, because the throw happens
      // inside the getter, after optional chaining has already decided the receiver is non-nullish.
      expect(() => activeElementIn(root)).to.not.throw();
      expect(activeElementIn(root)).to.equal(null);
    } finally {
      restore();
    }
  });

  it('returns null for a nullish root, so it drops into optional-chained positions', () => {
    expect(activeElementIn(null)).to.equal(null);
    expect(activeElementIn(undefined)).to.equal(null);
  });
});

describe('deepActiveElementIn', () => {
  it('descends through nested shadow roots to the innermost focused node', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLElement;
    const outer = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    outer.append(inner);
    const innerRoot = inner.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    innerRoot.append(button);
    await focusByKeyboard(button);

    // document.activeElement collapses to the outermost host; the deep walk resolves the button.
    expect(activeElementIn(document) === host).to.equal(true);
    expect(deepActiveElementIn(document) === button).to.equal(true);
  });

  it('stops at the last root that answered when a getter throws mid-chain', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLElement;
    const outer = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    outer.append(inner);
    const innerRoot = inner.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    innerRoot.append(button);
    await focusByKeyboard(button);
    expect(deepActiveElementIn(document) === button).to.equal(true);

    const restore = breakActiveElement(innerRoot);
    try {
      expect(deepActiveElementIn(document) === inner).to.equal(true);
    } finally {
      restore();
    }
  });
});

describe('shadowFocusTarget', () => {
  it('returns the element focused inside the connected host own shadow root', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLElement;
    const root = host.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    root.append(button);
    await focusByKeyboard(button);
    expect(shadowFocusTarget(host) === button).to.equal(true);
  });

  it('reports the nested host, not the inner control, for a focus in a nested root', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLElement;
    const outer = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    outer.append(inner);
    const input = document.createElement('input');
    inner.attachShadow({ mode: 'open' }).append(input);
    await focusByKeyboard(input);
    expect(shadowFocusTarget(host) === inner).to.equal(true);
  });

  it('returns null when nothing in the root is focused or there is no root', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLElement;
    expect(shadowFocusTarget(host)).to.equal(null);
    host.attachShadow({ mode: 'open' }).append(document.createElement('button'));
    expect(shadowFocusTarget(host)).to.equal(null);
  });

  it('returns null for a detached host without reading activeElement', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    let reads = 0;
    Object.defineProperty(root, 'activeElement', {
      configurable: true,
      get(): never {
        reads += 1;
        throw new TypeError('detached read');
      },
    });
    try {
      expect(shadowFocusTarget(host)).to.equal(null);
      expect(reads).to.equal(0);
    } finally {
      delete (root as unknown as Record<string, unknown>)['activeElement'];
    }
  });
});

it('safeDeepActiveElement descends nested shadow roots and stops at an unreadable root', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  const root = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  root.append(button);
  await focusByKeyboard(button);
  expect(safeDeepActiveElement(document) === button).to.equal(true);
  const restore = breakActiveElement(root);
  try {
    expect(safeDeepActiveElement(document) === host).to.equal(true);
  } finally {
    restore();
  }
  expect(safeDeepActiveElement(null)).to.equal(null);
});

it('accepts genuine elements from frame and inert documents while rejecting other native nodes', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Focus element realm"></iframe>`);
  const inert = document.implementation.createHTMLDocument('Detached focus realm');
  expect(inert.defaultView === null).to.equal(true);
  for (const owner of [document, frame.contentDocument!, inert]) {
    expect(isUsableActiveElement(owner.createElement('button'))).to.equal(true);
    expect(isUsableActiveElement(owner.createElementNS('http://www.w3.org/2000/svg', 'svg'))).to.equal(true);
    expect(isUsableActiveElement(owner.createTextNode('text'))).to.equal(false);
    expect(isUsableActiveElement(owner.createDocumentFragment())).to.equal(false);
    expect(isUsableActiveElement(owner)).to.equal(false);
  }
});

it('rejects structural element lookalikes and inaccessible node metadata without throwing', () => {
  const throwing = new Proxy({}, { get() { throw new Error('Node metadata unavailable'); } });
  for (const value of [undefined, null, false, 1, 'button', Symbol('element'), () => undefined,
    { nodeType: 1, ownerDocument: document }, throwing]) {
    expect(isUsableActiveElement(value)).to.equal(false);
  }
});

it('fails closed when a focused host cannot expose its shadow root and recovers afterward', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  const root = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  root.append(button);
  await focusByKeyboard(button);
  expect(safeDeepActiveElement(document) === button).to.equal(true);
  Object.defineProperty(host, 'shadowRoot', { configurable: true, get() { throw new TypeError('Shadow root unavailable'); } });
  try {
    expect(safeDeepActiveElement(document) === null).to.equal(true);
  } finally {
    Reflect.deleteProperty(host, 'shadowRoot');
  }
  expect(safeDeepActiveElement(document) === button).to.equal(true);
});

it('rejects invalid nested focus answers instead of treating a structural lookalike as the focused control', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  const root = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  root.append(button);
  await focusByKeyboard(button);
  try {
    for (const value of [undefined, { nodeType: 1, ownerDocument: document }, document.createTextNode('not an element')]) {
      Object.defineProperty(root, 'activeElement', { configurable: true, get: () => value });
      expect(safeDeepActiveElement(document) === null).to.equal(true);
    }
  } finally {
    Reflect.deleteProperty(root, 'activeElement');
  }
  expect(safeDeepActiveElement(document) === button).to.equal(true);
});
