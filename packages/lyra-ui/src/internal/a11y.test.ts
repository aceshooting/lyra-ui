import { expect, fixture, html } from '@open-wc/testing';
import { hasRealContent, nextId, resolveAccessibleTrigger } from './a11y.js';
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
