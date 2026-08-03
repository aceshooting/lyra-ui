import { expect, fixture, html } from '@open-wc/testing';
import {
  composedParentElement,
  hasRealContent,
  isAccessibilityExcluded,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisible,
  isAccessibilityVisibilityHidden,
  nextId,
  resolveAccessibleTrigger,
} from './a11y.js';
import { tag } from './prefix.js';

it('generates a distinct id on every call for the same scope', () => {
  const a = nextId('listbox');
  const b = nextId('listbox');
  expect(a).to.not.equal(b);
});

it('prefixes the id through the shared tag() helper, not a hard-coded literal', () => {
  const id = nextId('listbox');
  expect(id.startsWith(`${tag('listbox')}-`)).to.be.true;
});

describe('hasRealContent', () => {
  it('treats an empty node list as having no real content', () => {
    expect(hasRealContent([])).to.be.false;
  });

  it('treats whitespace-only text nodes as having no real content', () => {
    expect(hasRealContent([document.createTextNode('   \n\t ')])).to.be.false;
  });

  it('treats a text node with non-whitespace content as real content', () => {
    expect(hasRealContent([document.createTextNode('  hello  ')])).to.be.true;
  });

  it('treats any element node as real content, even with no text of its own', () => {
    expect(hasRealContent([document.createElement('span')])).to.be.true;
  });

  it('accepts any Iterable<Node>, not just an array', () => {
    const nodes = new Set<Node>([document.createTextNode('x')]);
    expect(hasRealContent(nodes)).to.be.true;
  });
});

describe('resolveAccessibleTrigger', () => {
  const define = (tagName: string, define_: () => CustomElementConstructor): string => {
    if (!customElements.get(tagName)) customElements.define(tagName, define_());
    return tagName;
  };

  it('returns a native control unchanged -- it is its own focus target', async () => {
    const el = await fixture<HTMLButtonElement>(html`<button>Help</button>`);
    expect(resolveAccessibleTrigger(el) === el, 'a native button resolves to itself').to.be.true;
  });

  it('walks into a custom element shadow root to the control that actually takes focus', async () => {
    const tagName = define(
      'test-a11y-shadow-trigger',
      () =>
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' }).innerHTML = '<span>x</span><button type="button">Help</button>';
          }
        },
    );
    const el = await fixture<HTMLElement>(`<${tagName}></${tagName}>`);
    const inner = el.shadowRoot!.querySelector('button')!;
    expect(resolveAccessibleTrigger(el) === inner, 'resolves to the shadow-root button').to.be.true;
  });

  it('walks into light-DOM children of a wrapper element', async () => {
    const el = await fixture<HTMLElement>(html`<div><span>label</span><a href="#x">Help</a></div>`);
    expect(resolveAccessibleTrigger(el) === el.querySelector('a'), 'resolves to the light-DOM link').to.be.true;
  });

  it('keeps a trigger that carries its own tabindex ahead of anything it contains', async () => {
    const el = await fixture<HTMLElement>(html`<div tabindex="0"><button>Inner</button></div>`);
    expect(resolveAccessibleTrigger(el) === el, 'a tabbable wrapper stays its own focus target').to.be.true;
  });

  it('falls back to the trigger when nothing inside it is focusable', async () => {
    const el = await fixture<HTMLElement>(html`<div><button disabled>Inner</button></div>`);
    expect(resolveAccessibleTrigger(el) === el, 'falls back to the trigger itself').to.be.true;
  });
});

describe('shared accessibility visibility', () => {
  it('recognizes authored and rendered accessibility exclusions', async () => {
    const el = await fixture<HTMLElement>(html`<div>Content</div>`);
    expect(isAccessibilityExcluded(el)).to.be.false;

    for (const value of ['true', ' TRUE ']) {
      el.setAttribute('aria-hidden', value);
      expect(isAccessibilityExcluded(el), `aria-hidden=${JSON.stringify(value)}`).to.be.true;
    }
    el.removeAttribute('aria-hidden');

    el.hidden = true;
    expect(isAccessibilityExcluded(el), 'hidden').to.be.true;
    el.hidden = false;

    el.setAttribute('inert', '');
    expect(isAccessibilityExcluded(el), 'inert').to.be.true;
    el.removeAttribute('inert');

    for (const declaration of [
      'display: none',
      'visibility: hidden',
      'visibility: collapse',
      'content-visibility: hidden',
    ]) {
      el.setAttribute('style', declaration);
      expect(isAccessibilityExcluded(el), declaration).to.be.true;
    }
  });

  it('walks composed ancestors across a shadow root and slot', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const root = host.attachShadow({ mode: 'open' });
    const slot = document.createElement('slot');
    root.append(slot);
    const child = document.createElement('span');
    host.append(child);
    await Promise.resolve();

    expect(composedParentElement(child) === slot, 'assigned node reaches its slot').to.be.true;
    expect(composedParentElement(slot) === host, 'shadow child reaches its host').to.be.true;
    expect(isAccessibilityVisible(child)).to.be.true;

    host.setAttribute('aria-hidden', ' TRUE ');
    expect(isAccessibilityVisible(child), 'hidden composed host suppresses the child').to.be.false;
  });

  it('uses the element owner realm for rendered ancestor styles', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument!;
      const ancestor = frameDocument.createElement('div');
      const child = frameDocument.createElement('span');
      ancestor.style.display = 'none';
      ancestor.append(child);
      frameDocument.body.append(ancestor);
      expect(isAccessibilityVisible(child)).to.be.false;
    } finally {
      frame.remove();
    }
  });

  it('honors a target visibility override inside a visibility-hidden ancestor', async () => {
    const ancestor = await fixture<HTMLElement>(html`
      <div style="visibility: hidden">
        <span style="visibility: visible">Exposed override</span>
      </div>
    `);
    const child = ancestor.querySelector('span')!;
    expect(isAccessibilitySubtreeExcluded(ancestor)).to.be.false;
    expect(isAccessibilityVisibilityHidden(ancestor)).to.be.true;
    expect(isAccessibilityExcluded(ancestor)).to.be.true;
    expect(isAccessibilityVisible(child)).to.be.true;

    child.style.removeProperty('visibility');
    expect(isAccessibilityVisible(child)).to.be.false;
  });

  it('does not require an exposed display-contents element to own a layout rectangle', async () => {
    const el = await fixture<HTMLElement>(html`
      <div style="display: contents" aria-label="Semantic wrapper">
        <span>Visible child</span>
      </div>
    `);
    expect(isAccessibilityVisible(el)).to.be.true;
  });

  it('rejects display-contents descendants in a closed details content branch', async () => {
    const details = await fixture<HTMLDetailsElement>(html`
      <details>
        <summary>
          Summary
          <span id="summary-semantic" style="display: contents" role="group">Visible summary</span>
        </summary>
        <div id="content-semantic" style="display: contents" role="group">Hidden content</div>
      </details>
    `);
    const summarySemantic = details.querySelector<HTMLElement>('#summary-semantic')!;
    const contentSemantic = details.querySelector<HTMLElement>('#content-semantic')!;

    expect(isAccessibilityVisible(summarySemantic), 'the first summary branch stays exposed').to.be.true;
    expect(isAccessibilityVisible(contentSemantic), 'closed details prunes its content branch').to.be.false;

    details.open = true;
    expect(isAccessibilityVisible(contentSemantic), 'opening details exposes its content branch').to.be.true;
  });

  it('rejects a box-generating source in a skipped content-visibility-auto subtree', async () => {
    const container = await fixture<HTMLElement>(html`
      <div
        style="content-visibility: auto; contain-intrinsic-size: 100px; position: absolute; inset-block-start: 10000px"
      >
        <div id="source">Deferred content</div>
      </div>
    `);
    const source = container.querySelector<HTMLElement>('#source')!;
    const ownerWindow = source.ownerDocument.defaultView!;
    await new Promise<void>((resolve) =>
      ownerWindow.requestAnimationFrame(() => ownerWindow.requestAnimationFrame(() => resolve())),
    );

    expect(isAccessibilityVisible(source)).to.be.false;
  });
});
