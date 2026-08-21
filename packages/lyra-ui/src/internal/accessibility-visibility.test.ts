import { expect, fixture, html } from '@open-wc/testing';
import {
  composedAccessibilityText,
  composedAccessibilityTextResult,
  composedAccessibleVisibleText,
  isAccessibilityExcluded,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisibilityHidden,
  isAccessibilityVisible,
  isAriaTrue,
  bindAccessibleTextObserver,
} from './accessibility-visibility.js';

describe('isAriaTrue', () => {
  it('recognizes the exact lowercase token "true"', () => {
    expect(isAriaTrue('true')).to.equal(true);
  });

  it('is ASCII case-insensitive', () => {
    expect(isAriaTrue('TRUE')).to.equal(true);
    expect(isAriaTrue('True')).to.equal(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isAriaTrue('  true  ')).to.equal(true);
  });

  it('rejects "false", empty string, and null', () => {
    expect(isAriaTrue('false')).to.equal(false);
    expect(isAriaTrue('')).to.equal(false);
    expect(isAriaTrue(null)).to.equal(false);
  });
});

describe('isAccessibilitySubtreeExcluded', () => {
  it('excludes an element with the hidden attribute', async () => {
    const el = await fixture<HTMLElement>(html`<div hidden>content</div>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(true);
  });

  it('excludes an element with the inert attribute', async () => {
    const el = await fixture<HTMLElement>(html`<div inert>content</div>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(true);
  });

  it('excludes an element with aria-hidden="true"', async () => {
    const el = await fixture<HTMLElement>(html`<div aria-hidden="true">content</div>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(true);
  });

  it('does not exclude aria-hidden="false"', async () => {
    const el = await fixture<HTMLElement>(html`<div aria-hidden="false">content</div>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(false);
  });

  it('excludes an element with display:none', async () => {
    const el = await fixture<HTMLElement>(html`<div style="display:none">content</div>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(true);
  });

  it('excludes an element with content-visibility:hidden', async () => {
    const el = await fixture<HTMLElement>(html`<div style="content-visibility:hidden">content</div>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(true);
  });

  it('does not exclude an ordinary visible connected element', async () => {
    const el = await fixture<HTMLElement>(html`<div>content</div>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(false);
  });
});

describe('isAccessibilityVisibilityHidden', () => {
  it('is true for visibility:hidden', async () => {
    const el = await fixture<HTMLElement>(html`<span style="visibility:hidden">x</span>`);
    expect(isAccessibilityVisibilityHidden(el)).to.equal(true);
  });

  it('is true for visibility:collapse', async () => {
    const el = await fixture<HTMLElement>(html`<span style="visibility:collapse">x</span>`);
    expect(isAccessibilityVisibilityHidden(el)).to.equal(true);
  });

  it('is false for the default visible state', async () => {
    const el = await fixture<HTMLElement>(html`<span>x</span>`);
    expect(isAccessibilityVisibilityHidden(el)).to.equal(false);
  });
});

describe('isAccessibilityExcluded', () => {
  it('is true when only visibility is hidden (not subtree-excluded)', async () => {
    const el = await fixture<HTMLElement>(html`<span style="visibility:hidden">x</span>`);
    expect(isAccessibilitySubtreeExcluded(el)).to.equal(false);
    expect(isAccessibilityExcluded(el)).to.equal(true);
  });

  it('is true when only subtree-excluded (hidden attribute)', async () => {
    const el = await fixture<HTMLElement>(html`<span hidden>x</span>`);
    expect(isAccessibilityExcluded(el)).to.equal(true);
  });

  it('is false when neither applies', async () => {
    const el = await fixture<HTMLElement>(html`<span>x</span>`);
    expect(isAccessibilityExcluded(el)).to.equal(false);
  });
});

describe('bindAccessibleTextObserver', () => {
  it('is a no-op when no observer is supplied', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    expect(() => bindAccessibleTextObserver(undefined, host)).to.not.throw();
  });

  it('fires when a watched content attribute changes on the host itself', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    let seen = 0;
    const observer = new MutationObserver(() => {
      seen++;
    });
    bindAccessibleTextObserver(observer, host);
    try {
      host.setAttribute('aria-label', 'changed');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(seen).to.be.greaterThan(0);
    } finally {
      observer.disconnect();
    }
  });

  it('fires when a watched attribute changes on a composed ancestor', async () => {
    const root = await fixture<HTMLElement>(html`<section><div id="observed-host"></div></section>`);
    const host = root.querySelector<HTMLElement>('#observed-host')!;
    let seen = 0;
    const observer = new MutationObserver(() => {
      seen++;
    });
    bindAccessibleTextObserver(observer, host);
    try {
      root.setAttribute('hidden', '');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(seen).to.be.greaterThan(0);
    } finally {
      observer.disconnect();
    }
  });

  it('widens the host/content attribute filter via extraAttributes but never the fixed ancestor filter', async () => {
    const root = await fixture<HTMLElement>(html`<section><div id="extra-attr-host"></div></section>`);
    const host = root.querySelector<HTMLElement>('#extra-attr-host')!;
    let seen = 0;
    const observer = new MutationObserver(() => {
      seen++;
    });
    bindAccessibleTextObserver(observer, host, ['data-extra']);
    try {
      host.setAttribute('data-extra', 'x');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(seen).to.be.greaterThan(0);

      seen = 0;
      root.setAttribute('data-extra', 'y'); // ANCESTOR_ATTRIBUTES stays fixed, unaffected by extraAttributes
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(seen).to.equal(0);
    } finally {
      observer.disconnect();
    }
  });
});

describe('composedAccessibilityText / composedAccessibilityTextResult', () => {
  it('extracts a plain text node', () => {
    const node = document.createTextNode('Hello world');
    expect(composedAccessibilityText(node)).to.equal('Hello world');
  });

  it('extracts text from a plain element with a single text child', async () => {
    const el = await fixture<HTMLElement>(html`<div>Hello world</div>`);
    expect(composedAccessibilityText(el)).to.equal('Hello world');
  });

  it('joins multiple root nodes passed as an iterable', async () => {
    const el = await fixture<HTMLElement>(html`<div><span id="a">Alpha</span><span id="b">Beta</span></div>`);
    const a = el.querySelector('#a')!;
    const b = el.querySelector('#b')!;
    const text = composedAccessibilityText([a, b]);
    expect(text).to.include('Alpha');
    expect(text).to.include('Beta');
    expect(text.indexOf('Alpha')).to.be.lessThan(text.indexOf('Beta'));
  });

  it('prunes an aria-hidden="true" subtree entirely', async () => {
    const el = await fixture<HTMLElement>(html`<div>Visible <span aria-hidden="true">Hidden</span></div>`);
    const text = composedAccessibilityText(el);
    expect(text).to.include('Visible');
    expect(text).to.not.include('Hidden');
  });

  it('prunes a hidden-attribute subtree', async () => {
    const el = await fixture<HTMLElement>(html`<div>Visible <span hidden>Hidden</span></div>`);
    expect(composedAccessibilityText(el)).to.not.include('Hidden');
  });

  it('prunes an inert subtree', async () => {
    const el = await fixture<HTMLElement>(html`<div>Visible <span inert>Hidden</span></div>`);
    expect(composedAccessibilityText(el)).to.not.include('Hidden');
  });

  it('uses aria-label instead of descending into children', async () => {
    const el = await fixture<HTMLElement>(html`<div aria-label="Label text"><span>Child text</span></div>`);
    expect(composedAccessibilityText(el)).to.equal('Label text');
  });

  it('resolves aria-labelledby against another element in the same root and records provenance', async () => {
    const el = await fixture<HTMLElement>(html`
      <div>
        <span id="labelledby-source">Source label</span>
        <button aria-labelledby="labelledby-source">Ignored button text</button>
      </div>
    `);
    const button = el.querySelector('button')!;
    const result = composedAccessibilityTextResult(button);
    expect(result.text).to.equal('Source label');
    expect(result.referencedElements.size).to.equal(1);
    expect([...result.referencedElements][0]!.id).to.equal('labelledby-source');
    expect(result.labelReferenceRoots.size).to.be.greaterThan(0);
  });

  it('uses alt text for an <img>', async () => {
    const el = await fixture<HTMLElement>(html`<img alt="A description" src="data:," />`);
    expect(composedAccessibilityText(el)).to.equal('A description');
  });

  it('resolves slotted content through an open shadow root', async () => {
    const tagName = 'test-a11y-text-slot-host';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' }).innerHTML = '<div><slot></slot></div>';
          }
        },
      );
    }
    const el = await fixture<HTMLElement>(`<${tagName}>Assigned text</${tagName}>`);
    expect(composedAccessibilityText(el)).to.include('Assigned text');
  });

  it('falls back to a slot\'s own children when nothing is assigned', async () => {
    const tagName = 'test-a11y-text-slot-fallback-host';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' }).innerHTML = '<div><slot>Fallback text</slot></div>';
          }
        },
      );
    }
    const el = await fixture<HTMLElement>(`<${tagName}></${tagName}>`);
    expect(composedAccessibilityText(el)).to.include('Fallback text');
  });

  it('uses fallback children for a standalone slot outside a shadow root', () => {
    const slot = document.createElement('slot');
    slot.textContent = 'Standalone fallback';

    expect(composedAccessibilityText(slot)).to.equal('Standalone fallback');
  });

  it('exposes only the summary of a closed <details> element', async () => {
    const el = await fixture<HTMLElement>(html`<details><summary>Summary text</summary><p>Body text</p></details>`);
    const text = composedAccessibilityText(el);
    expect(text).to.include('Summary text');
    expect(text).to.not.include('Body text');
  });

  it('exposes both summary and body of an open <details> element', async () => {
    const el = await fixture<HTMLElement>(
      html`<details open><summary>Summary text</summary><p>Body text</p></details>`,
    );
    const text = composedAccessibilityText(el);
    expect(text).to.include('Summary text');
    expect(text).to.include('Body text');
  });

  it('suppresses an element\'s own text when visibility:hidden, but not an overridden-visible descendant', async () => {
    const el = await fixture<HTMLElement>(html`
      <div style="visibility:hidden">Hidden text <span style="visibility:visible">Visible child</span></div>
    `);
    const text = composedAccessibilityText(el);
    expect(text).to.not.include('Hidden text');
    expect(text).to.include('Visible child');
  });

  it('truncates at maxCharacters and reports the reason with a valid text prefix', async () => {
    const el = await fixture<HTMLElement>(html`<div>Hello world</div>`);
    const result = composedAccessibilityTextResult(el, { maxCharacters: 5 });
    expect(result.truncated).to.equal(true);
    expect(result.truncationReasons).to.include('characters');
    expect(result.text).to.equal('Hello');
  });

  it('stops before a later root when the inter-root separator exhausts maxCharacters', () => {
    const first = document.createTextNode('A');
    const second = document.createTextNode('B');

    const result = composedAccessibilityTextResult([first, second], { maxCharacters: 1 });

    expect(result.text).to.equal('A');
    expect(result.truncationReasons).to.include('characters');
    expect(result.visitedNodes).to.equal(1);
  });

  it('truncates at maxNodes and reports the reason', async () => {
    const el = await fixture<HTMLElement>(html`<div><span>a</span><span>b</span><span>c</span></div>`);
    const result = composedAccessibilityTextResult(el, { maxNodes: 2 });
    expect(result.truncated).to.equal(true);
    expect(result.truncationReasons).to.include('nodes');
  });

  it('truncates at maxDepth and reports the reason', async () => {
    const el = await fixture<HTMLElement>(html`<div><div><div><div>Deep text</div></div></div></div>`);
    // skipRootAncestorValidation isolates the descendant-depth ceiling from the separate
    // 'ancestors' truncation reason that the fixture's own real DOM ancestor chain would otherwise
    // also trip at such a small maxDepth.
    const result = composedAccessibilityTextResult(el, { maxDepth: 1, skipRootAncestorValidation: true });
    expect(result.truncated).to.equal(true);
    expect(result.truncationReasons).to.include('depth');
    expect(result.text).to.not.include('Deep text');
  });

  it('shouldPrune excludes matched elements from the extracted text', async () => {
    const el = await fixture<HTMLElement>(html`<div>Keep <span class="drop">Drop</span></div>`);
    const result = composedAccessibilityTextResult(el, {
      shouldPrune: (element) => element.classList.contains('drop'),
    });
    expect(result.text).to.not.include('Drop');
    expect(result.text).to.include('Keep');
  });

  it('shouldPruneNode excludes matched nodes from the extracted text', async () => {
    const el = await fixture<HTMLElement>(html`<div>Keep <span>Drop</span></div>`);
    const dropSpan = el.querySelector('span')!;
    const result = composedAccessibilityTextResult(el, {
      shouldPruneNode: (node) => node === dropSpan,
    });
    expect(result.text).to.not.include('Drop');
    expect(result.text).to.include('Keep');
  });

  it('excludes content whose checkVisibility() reports false when requireRendered is true (the default)', async () => {
    const el = await fixture<HTMLElement>(html`<div>Some text</div>`);
    const original = el.checkVisibility?.bind(el);
    (el as unknown as { checkVisibility: () => boolean }).checkVisibility = () => false;
    try {
      const excluded = composedAccessibilityTextResult(el);
      expect(excluded.text).to.equal('');

      const included = composedAccessibilityTextResult(el, { requireRendered: false });
      expect(included.text).to.equal('Some text');
    } finally {
      if (original) (el as unknown as { checkVisibility: () => boolean }).checkVisibility = original;
      else delete (el as unknown as { checkVisibility?: () => boolean }).checkVisibility;
    }
  });

  it('the inheritedTextVisible boolean shorthand suppresses a top-level text node when false', () => {
    const node = document.createTextNode('Some text');
    expect(composedAccessibilityText(node, false)).to.equal('');
    expect(composedAccessibilityText(node, true)).to.equal('Some text');
    expect(composedAccessibilityText(node)).to.equal('Some text');
  });
});

describe('composedAccessibleVisibleText', () => {
  it('matches composedAccessibilityText with default options', async () => {
    const el = await fixture<HTMLElement>(html`<div>Hello world</div>`);
    expect(composedAccessibleVisibleText(el)).to.equal(composedAccessibilityText(el));
    expect(composedAccessibleVisibleText(el)).to.equal('Hello world');
  });
});

describe('isAccessibilityVisible', () => {
  it('returns false for a disconnected element', () => {
    const el = document.createElement('div');
    expect(isAccessibilityVisible(el)).to.equal(false);
  });

  it('returns true for a normal connected, visible element', async () => {
    const el = await fixture<HTMLElement>(html`<div>content</div>`);
    expect(isAccessibilityVisible(el)).to.equal(true);
  });

  it('returns false when an ancestor is aria-hidden', async () => {
    const root = await fixture<HTMLElement>(html`<div aria-hidden="true"><span id="descendant">x</span></div>`);
    const descendant = root.querySelector('#descendant')!;
    expect(isAccessibilityVisible(descendant)).to.equal(false);
  });

  it('returns false for non-summary content inside a closed <details>', async () => {
    const root = await fixture<HTMLElement>(html`<details><summary>Sum</summary><p id="body">Body</p></details>`);
    const body = root.querySelector('#body')!;
    expect(isAccessibilityVisible(body)).to.equal(false);
  });

  it('returns true for the summary of a closed <details>', async () => {
    const root = await fixture<HTMLElement>(html`<details><summary id="sum">Sum</summary><p>Body</p></details>`);
    const summary = root.querySelector('#sum')!;
    expect(isAccessibilityVisible(summary)).to.equal(true);
  });

  it('returns false for visibility:hidden on the element itself', async () => {
    const el = await fixture<HTMLElement>(html`<div style="visibility:hidden">content</div>`);
    expect(isAccessibilityVisible(el)).to.equal(false);
  });

  it('returns true for display:contents without relying on checkVisibility', async () => {
    const el = await fixture<HTMLElement>(html`<div style="display:contents">content</div>`);
    expect(isAccessibilityVisible(el)).to.equal(true);
  });

  it('ignorePresentation skips a specific presentational ancestor while still honoring real rendering', async () => {
    // The fence itself is the fixture root -- captured directly, not queried for, since a
    // descendant-only querySelector can never find the root element itself.
    const fence = await fixture<HTMLElement>(
      html`<div id="presentation-fence" aria-hidden="true"><span id="target">x</span></div>`,
    );
    const target = fence.querySelector<HTMLElement>('#target')!;
    expect(isAccessibilityVisible(target)).to.equal(false);
    expect(
      isAccessibilityVisible(target, { ignorePresentation: (candidate) => candidate === fence }),
    ).to.equal(true);
  });
});

describe('adversarial accessibility visibility boundaries', () => {
  it('falls back to authored state when owner-realm computed style throws', () => {
    const el = document.createElement('div');
    const original = window.getComputedStyle;
    window.getComputedStyle = ((target: Element, pseudo?: string | null) => {
      if (target === el) throw new Error('style unavailable');
      return original.call(window, target, pseudo);
    }) as typeof window.getComputedStyle;
    try {
      expect(isAccessibilitySubtreeExcluded(el)).to.equal(false);
      el.hidden = true;
      expect(isAccessibilitySubtreeExcluded(el)).to.equal(true);
    } finally {
      window.getComputedStyle = original;
    }
  });

  it('rejects a hostile node without invoking beyond the guarded identity probe', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const result = composedAccessibilityTextResult([revoked.proxy as unknown as Node]);
    expect(result.text).to.equal('');
    expect(result.visitedNodes).to.equal(0);
  });

  it('reports ancestor and descendant depth ceilings independently', async () => {
    const root = await fixture<HTMLElement>(html`
      <div><div><div><span id="deep-accessible-text">deep</span></div></div></div>
    `);
    const target = root.querySelector('#deep-accessible-text') as HTMLElement;
    const ancestors = composedAccessibilityTextResult(target, { maxDepth: 1 });
    expect(ancestors.truncationReasons).to.include('ancestors');

    const descendants = composedAccessibilityTextResult(root, {
      maxDepth: 1,
      skipRootAncestorValidation: true,
    });
    expect(descendants.truncationReasons).to.include('depth');
  });

  it('returns no text for closed details that has no summary', async () => {
    const details = await fixture<HTMLElement>(html`<details><p>hidden body</p></details>`);
    expect(composedAccessibilityText(details)).to.equal('');
    expect(isAccessibilityVisible(details.querySelector('p')!)).to.equal(false);
  });

  it('uses an empty serialized reflected aria-labelledby relationship and contains getter failures', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><span id="reflected-label">Reflected label</span><button aria-labelledby="">Button</button></div>
    `);
    const label = wrapper.querySelector('#reflected-label')!;
    const button = wrapper.querySelector('button')!;
    const prototype = window.Element.prototype as Element & {
      ariaLabelledByElements?: readonly Element[];
    };
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'ariaLabelledByElements');
    Object.defineProperty(prototype, 'ariaLabelledByElements', {
      configurable: true,
      get() {
        return this === button ? [label] : descriptor?.get?.call(this);
      },
    });
    try {
      expect(composedAccessibilityText(button)).to.equal('Reflected label');
      Object.defineProperty(prototype, 'ariaLabelledByElements', {
        configurable: true,
        get() {
          throw new Error('relationship unavailable');
        },
      });
      expect(composedAccessibilityText(button)).to.equal('Button');
    } finally {
      if (descriptor) Object.defineProperty(prototype, 'ariaLabelledByElements', descriptor);
      else Reflect.deleteProperty(prototype, 'ariaLabelledByElements');
    }
  });

  it('falls back to element text for an empty reflected relationship in an ownerless document', () => {
    const ownerlessDocument = document.implementation.createHTMLDocument('ownerless relation');
    const button = ownerlessDocument.createElement('button');
    button.setAttribute('aria-labelledby', '');
    button.textContent = 'Ownerless button';
    ownerlessDocument.body.append(button);

    expect(composedAccessibilityText(button, { requireRendered: false })).to.equal('Ownerless button');
  });

  it('fails closed when the final rendered visibility probe throws', async () => {
    const el = await fixture<HTMLElement>(html`<div>content</div>`);
    const original = el.checkVisibility;
    el.checkVisibility = () => {
      throw new Error('visibility unavailable');
    };
    try {
      expect(isAccessibilityVisible(el)).to.equal(false);
      expect(composedAccessibilityText(el)).to.equal('');
    } finally {
      if (original) el.checkVisibility = original;
      else Reflect.deleteProperty(el, 'checkVisibility');
    }
  });

  it('reports depth before scheduling a closed-details summary or assigned slot node', async () => {
    const details = await fixture<HTMLElement>(html`
      <details><summary>Summary</summary><p>Body</p></details>
    `);
    const detailsResult = composedAccessibilityTextResult(details, {
      maxDepth: 0,
      skipRootAncestorValidation: true,
    });
    expect(detailsResult.truncationReasons).to.include('depth');

    const tagName = 'test-a11y-depth-slot-host';
    if (!customElements.get(tagName)) {
      customElements.define(tagName, class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>';
        }
      });
    }
    const host = await fixture<HTMLElement>(`<${tagName}>Assigned</${tagName}>`);
    const slot = host.shadowRoot!.querySelector('slot')!;
    const slotResult = composedAccessibilityTextResult(slot, {
      maxDepth: 0,
      skipRootAncestorValidation: true,
    });
    expect(slotResult.truncationReasons).to.include('depth');
  });

  it('rejects a referenced branch inside closed details without a summary', async () => {
    const details = await fixture<HTMLElement>(html`<details><p>Hidden</p></details>`);
    const body = details.querySelector('p')!;
    expect(composedAccessibilityText(body)).to.equal('');
  });

  it('accepts a connected box when checkVisibility is unavailable', async () => {
    const el = await fixture<HTMLElement>(html`<div>Visible</div>`);
    const own = Object.getOwnPropertyDescriptor(el, 'checkVisibility');
    Object.defineProperty(el, 'checkVisibility', {
      configurable: true,
      value: undefined,
    });
    try {
      expect(isAccessibilityVisible(el)).to.equal(true);
    } finally {
      if (own) Object.defineProperty(el, 'checkVisibility', own);
      else Reflect.deleteProperty(el, 'checkVisibility');
    }
  });
});
