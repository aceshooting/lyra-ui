import { expect, fixture, html } from '@open-wc/testing';
import { activeElementIn, deepActiveElementIn, safeDeepActiveElement, shadowFocusTarget } from './active-element.js';

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
    b.focus();
    expect(activeElementIn(document)).to.equal(b);
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
    button.focus();

    // document.activeElement collapses to the outermost host; the deep walk resolves the button.
    expect(activeElementIn(document)).to.equal(host);
    expect(deepActiveElementIn(document)).to.equal(button);
  });

  it('stops at the last root that answered when a getter throws mid-chain', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLElement;
    const outer = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    outer.append(inner);
    const innerRoot = inner.attachShadow({ mode: 'open' });
    innerRoot.append(document.createElement('button'));

    const restore = breakActiveElement(innerRoot);
    try {
      expect(() => deepActiveElementIn(document)).to.not.throw();
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
    button.focus();
    expect(shadowFocusTarget(host) === button).to.equal(true);
  });

  it('reports the nested host, not the inner control, for a focus in a nested root', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLElement;
    const outer = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    outer.append(inner);
    const input = document.createElement('input');
    inner.attachShadow({ mode: 'open' }).append(input);
    input.focus();
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

it('safeDeepActiveElement descends nested shadow roots and fails closed on a lookalike', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  const root = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  root.append(button);
  button.focus();
  expect(safeDeepActiveElement(document) === button).to.equal(true);
  const restore = breakActiveElement(root);
  try {
    expect(safeDeepActiveElement(document) === host).to.equal(true);
  } finally {
    restore();
  }
  expect(safeDeepActiveElement(null)).to.equal(null);
});
