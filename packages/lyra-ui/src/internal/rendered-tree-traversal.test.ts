import { expect } from '@open-wc/testing';
import type { RenderedTreeTraversalState } from './rendered-tree-traversal.js';
import {
  DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS,
  RenderedTreeTraversalError,
  collectRenderedTree,
  nativeElementLocalName,
  renderedTreeTraversalLimits,
} from './rendered-tree-traversal.js';

describe('RenderedTreeTraversalError', () => {
  it('carries operation/limit/maximum fields and a formatted message', () => {
    const error = new RenderedTreeTraversalError('some-op', 'maxDepth', 42);
    expect(error).to.be.instanceOf(Error);
    expect(error.name).to.equal('RenderedTreeTraversalError');
    expect(error.operation).to.equal('some-op');
    expect(error.limit).to.equal('maxDepth');
    expect(error.maximum).to.equal(42);
    expect(error.message).to.equal('some-op exceeded maxDepth (42)');
  });
});

describe('DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS', () => {
  it('has the documented default values and is frozen', () => {
    expect(DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS).to.deep.equal({
      maxElements: 10_000,
      maxRoots: 2_000,
      maxDepth: 256,
      maxWork: 100_000,
    });
    expect(Object.isFrozen(DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS)).to.equal(true);
  });
});

describe('renderedTreeTraversalLimits', () => {
  it('falls back to every default when no overrides are supplied', () => {
    expect(renderedTreeTraversalLimits({}, 'op')).to.deep.equal(DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS);
  });

  it('applies a valid override for each of the four fields independently', () => {
    expect(renderedTreeTraversalLimits({ maxElements: 5 }, 'op').maxElements).to.equal(5);
    expect(renderedTreeTraversalLimits({ maxRoots: 3 }, 'op').maxRoots).to.equal(3);
    expect(renderedTreeTraversalLimits({ maxDepth: 7 }, 'op').maxDepth).to.equal(7);
    expect(renderedTreeTraversalLimits({ maxWork: 9 }, 'op').maxWork).to.equal(9);
  });

  it('throws a RangeError naming the field for a negative override', () => {
    expect(() => renderedTreeTraversalLimits({ maxElements: -1 }, 'my-op')).to.throw(
      RangeError,
      'my-op maxElements must be an integer >= 0',
    );
  });

  it('throws a RangeError for a non-integer override', () => {
    expect(() => renderedTreeTraversalLimits({ maxDepth: 1.5 }, 'my-op')).to.throw(
      RangeError,
      'my-op maxDepth must be an integer >= 0',
    );
  });

  it('throws a RangeError for a non-finite override (Infinity/NaN)', () => {
    expect(() => renderedTreeTraversalLimits({ maxRoots: Infinity }, 'my-op')).to.throw(
      RangeError,
      'my-op maxRoots must be an integer >= 0',
    );
    expect(() => renderedTreeTraversalLimits({ maxWork: Number.NaN }, 'my-op')).to.throw(
      RangeError,
      'my-op maxWork must be an integer >= 0',
    );
  });
});

describe('nativeElementLocalName', () => {
  it('returns the real lowercase tag name for a normal element', () => {
    const el = document.createElement('span');
    expect(nativeElementLocalName(el)).to.equal('span');
  });

  it('bypasses a hostile own localName getter override and still returns the real native value', () => {
    const tagName = 'test-rtt-hostile-localname';
    if (!customElements.get(tagName)) {
      customElements.define(tagName, class extends HTMLElement {});
    }
    const el = document.createElement(tagName);
    Object.defineProperty(el, 'localName', {
      configurable: true,
      get() {
        throw new Error('hostile localName getter');
      },
    });
    expect(nativeElementLocalName(el)).to.equal(tagName);
  });
});

describe('collectRenderedTree', () => {
  it('collects a light-DOM tree, skipping text nodes, with correct order and depths', () => {
    const root = document.createElement('div');
    root.id = 'root';
    const child1 = document.createElement('span');
    child1.id = 'child1';
    const child2 = document.createElement('span');
    child2.id = 'child2';
    const grandchild = document.createElement('em');
    grandchild.id = 'grandchild';
    child1.append(grandchild);
    root.append('text before', child1, 'text between', child2);

    const state: RenderedTreeTraversalState = { work: 0 };
    const result = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, state, 'test-op');

    expect(result.elements.map((el) => el.id)).to.deep.equal(['root', 'child1', 'child2', 'grandchild']);
    expect(result.elementDepths.get(root)).to.equal(0);
    expect(result.elementDepths.get(child1)).to.equal(1);
    expect(result.elementDepths.get(child2)).to.equal(1);
    expect(result.elementDepths.get(grandchild)).to.equal(2);
  });

  it('includes the root itself as both a root entry and an element entry when root is an Element', () => {
    const root = document.createElement('div');
    const state: RenderedTreeTraversalState = { work: 0 };
    const result = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, state, 'test-op');

    expect(result.elements.length).to.equal(1);
    expect(result.elements[0] === root).to.equal(true);
    expect(result.roots.length).to.equal(1);
    expect(result.roots[0] === root).to.equal(true);
    expect(result.rootDepths.get(root)).to.equal(0);
  });

  it('discovers an open shadow root and its children, which share the shadow root\'s own depth', () => {
    const tagName = 'test-rtt-shadow-host';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' }).innerHTML =
              '<span id="shadow-child"><em id="shadow-grandchild"></em></span>';
          }
        },
      );
    }
    const host = document.createElement(tagName);
    const state: RenderedTreeTraversalState = { work: 0 };
    const result = collectRenderedTree(host, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, state, 'test-op');

    const shadowRoot = host.shadowRoot!;
    expect(result.roots.some((r) => r === shadowRoot)).to.equal(true);
    expect(result.rootDepths.get(shadowRoot)).to.equal(1);
    const shadowChild = shadowRoot.querySelector('#shadow-child')!;
    const shadowGrandchild = shadowRoot.querySelector('#shadow-grandchild')!;
    expect(result.elements.some((el) => el === shadowChild)).to.equal(true);
    expect(result.elementDepths.get(shadowChild)).to.equal(1);
    expect(result.elementDepths.get(shadowGrandchild)).to.equal(2);
  });

  it('does not traverse into a closed shadow root', () => {
    const tagName = 'test-rtt-closed-shadow-host';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'closed' }).innerHTML = '<span id="closed-shadow-child"></span>';
          }
        },
      );
    }
    const host = document.createElement(tagName);
    const state: RenderedTreeTraversalState = { work: 0 };
    const result = collectRenderedTree(host, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, state, 'test-op');

    expect(result.elements.length).to.equal(1); // just the host itself
    expect(result.roots.length).to.equal(1); // just the initial host "root" entry
  });

  it('produces no new roots/elements on a second identical scan sharing state.elements/state.roots, though it still spends work', () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    root.append(child);
    const sharedState: RenderedTreeTraversalState = { work: 0, elements: new Set(), roots: new Set() };

    const first = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, sharedState, 'test-op');
    expect(first.elements.length).to.equal(2);
    const workAfterFirst = sharedState.work;

    const second = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, sharedState, 'test-op');
    expect(second.elements.length).to.equal(0);
    expect(second.roots.length).to.equal(0);
    expect(sharedState.work).to.be.greaterThan(workAfterFirst);
  });

  it('offsets reported depths by a non-zero initialDepth', () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    root.append(child);
    const state: RenderedTreeTraversalState = { work: 0 };
    const result = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, state, 'test-op', 10);

    expect(result.elementDepths.get(root)).to.equal(10);
    expect(result.elementDepths.get(child)).to.equal(11);
    expect(result.rootDepths.get(root)).to.equal(10);
  });

  it('throws RenderedTreeTraversalError with limit="maxElements" when maxElements is exceeded', () => {
    const root = document.createElement('div');
    root.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
    const limits = { ...DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, maxElements: 2 };
    const state: RenderedTreeTraversalState = { work: 0 };
    let caught: unknown;
    try {
      collectRenderedTree(root, limits, state, 'elements-op');
    } catch (error) {
      caught = error;
    }
    expect(caught).to.be.instanceOf(RenderedTreeTraversalError);
    const error = caught as RenderedTreeTraversalError;
    expect(error.limit).to.equal('maxElements');
    expect(error.operation).to.equal('elements-op');
    expect(error.maximum).to.equal(2);
  });

  it('throws RenderedTreeTraversalError with limit="maxRoots" when maxRoots is exceeded', () => {
    const outerTag = 'test-rtt-maxroots-outer';
    const innerTag = 'test-rtt-maxroots-inner';
    if (!customElements.get(innerTag)) {
      customElements.define(
        innerTag,
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
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
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.innerHTML = `<${innerTag}></${innerTag}><${innerTag}></${innerTag}>`;
          }
        },
      );
    }
    const host = document.createElement(outerTag);
    const limits = { ...DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, maxRoots: 2 };
    const state: RenderedTreeTraversalState = { work: 0 };
    let caught: unknown;
    try {
      collectRenderedTree(host, limits, state, 'roots-op');
    } catch (error) {
      caught = error;
    }
    expect(caught).to.be.instanceOf(RenderedTreeTraversalError);
    expect((caught as RenderedTreeTraversalError).limit).to.equal('maxRoots');
  });

  it('throws RenderedTreeTraversalError with limit="maxDepth" when maxDepth is exceeded', () => {
    const root = document.createElement('div');
    let parent = root;
    for (let index = 0; index < 5; index++) {
      const child = document.createElement('div');
      parent.append(child);
      parent = child;
    }
    const limits = { ...DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, maxDepth: 2 };
    const state: RenderedTreeTraversalState = { work: 0 };
    let caught: unknown;
    try {
      collectRenderedTree(root, limits, state, 'depth-op');
    } catch (error) {
      caught = error;
    }
    expect(caught).to.be.instanceOf(RenderedTreeTraversalError);
    expect((caught as RenderedTreeTraversalError).limit).to.equal('maxDepth');
  });

  it('throws RenderedTreeTraversalError with limit="maxWork" when maxWork is exceeded', () => {
    const root = document.createElement('div');
    root.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
    const limits = { ...DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, maxWork: 2 };
    const state: RenderedTreeTraversalState = { work: 0 };
    let caught: unknown;
    try {
      collectRenderedTree(root, limits, state, 'work-op');
    } catch (error) {
      caught = error;
    }
    expect(caught).to.be.instanceOf(RenderedTreeTraversalError);
    expect((caught as RenderedTreeTraversalError).limit).to.equal('maxWork');
  });
});
