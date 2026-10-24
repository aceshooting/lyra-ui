import { expect, fixture, html } from '@open-wc/testing';
import { containsNestedInteractive } from './nested-interactive.js';

describe('containsNestedInteractive', () => {
  /** Dispatches a bubbling, composed event from `target` and answers the helper during dispatch. */
  function probe(target: EventTarget, root: EventTarget | null): boolean {
    let result: boolean | undefined;
    const listener = (event: Event): void => { result = containsNestedInteractive(event, root); };
    document.addEventListener('probe', listener);
    try {
      target.dispatchEvent(new Event('probe', { bubbles: true, composed: true }));
    } finally {
      document.removeEventListener('probe', listener);
    }
    return result === true;
  }

  it('finds a native or ARIA interactive element between the target and the owner', async () => {
    const card = await fixture<HTMLElement>(html`<article>
      <p id="plain">Text</p><a href="#x" id="link"><span id="inside-link">Link</span></a>
      <div role="button" id="aria"><span id="inside-aria"></span></div><div tabindex="-1" id="focusable"></div>
      <div contenteditable="false" id="locked"></div><div contenteditable id="editable"></div>
    </article>`);
    const pick = (id: string): Element => card.querySelector(`#${id}`)!;
    expect(probe(pick('inside-link'), card)).to.equal(true);
    expect(probe(pick('inside-aria'), card)).to.equal(true);
    expect(probe(pick('editable'), card)).to.equal(true);
    expect(probe(pick('plain'), card), 'plain text content is not interactive').to.equal(false);
    expect(probe(pick('focusable'), card), 'a programmatic-only tabindex does not count').to.equal(false);
    expect(probe(pick('locked'), card), 'contenteditable=false does not count').to.equal(false);
  });

  it('stops at the owner so an interactive ancestor beyond it is ignored', async () => {
    const outer = await fixture<HTMLElement>(html`<a href="#x"><article><p id="plain">Text</p></article></a>`);
    const owner = outer.querySelector('article')!;
    const plain = outer.querySelector('#plain')!;
    expect(probe(plain, owner)).to.equal(false);
    expect(probe(plain, outer), 'with the link as owner the card is the only thing crossed').to.equal(false);
    expect(probe(plain, null), 'without an owner the whole path is examined').to.equal(true);
  });

  it('answers false when the path holds nothing interactive and the owner is not on it', async () => {
    const stage = await fixture<HTMLElement>(html`<div><p id="plain">Text</p></div>`);
    expect(probe(stage.querySelector('#plain')!, document.createElement('section'))).to.equal(false);
  });

  it('looks through the shadow root of a slotted control', async () => {
    const host = await fixture<HTMLElement>(html`<div><span id="light">Light</span></div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<button id="inner"><slot></slot></button>';
    const light = host.querySelector('#light')!;
    expect(probe(light, host), 'the slotted node sits inside a shadow button on its composed path').to.equal(true);
    expect(probe(root.querySelector('#inner')!, host)).to.equal(true);
  });
});
