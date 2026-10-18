import { expect } from '@open-wc/testing';
import { css, html } from 'lit';
import { LyraElement } from './lyra-element.js';
import { defineElement, tag } from './prefix.js';
import '../components/layout/virtual-list/virtual-list.js';
import type { LyraVirtualList } from '../components/layout/virtual-list/virtual-list.class.js';

class AdoptionStyled extends LyraElement {
  static override styles = [LyraElement.styles, css`
    :host { display: block; padding-top: 3px; }
    span { color: rgb(1, 2, 3); }
  `, css`:host { padding-top: 7px; }`];
  label = 'first';
  override render() {
    return html`<style>span { color: rgb(4, 5, 6); } strong { color: rgb(7, 8, 9); }</style><span>${this.label}</span><strong>caller</strong><slot></slot>`;
  }
}
defineElement('adoption-styled-test', AdoptionStyled);

function createStyled(): AdoptionStyled {
  return document.createElement(tag('adoption-styled-test')) as AdoptionStyled;
}

async function frame(): Promise<HTMLIFrameElement> {
  const result = document.createElement('iframe');
  document.body.append(result);
  await new Promise<void>((resolve) => {
    if (result.contentDocument?.readyState === 'complete') resolve();
    else result.addEventListener('load', () => resolve(), { once: true });
  });
  return result;
}

it('preserves existing component styles, caller styles and Lit content across repeated document moves', async () => {
  const iframe = await frame();
  const element = createStyled();
  const light = document.createElement('b');
  light.textContent = 'slotted';
  element.append(light);
  document.body.append(element);
  await element.updateComplete;
  const root = element.shadowRoot!;
  const span = root.querySelector('span')!;
  const authoredStyle = root.querySelector('style')!;
  const sheetCount = root.adoptedStyleSheets.length;
  try {
    expect(sheetCount).to.be.greaterThan(0);
    for (const destination of [iframe.contentDocument!, document, iframe.contentDocument!, document]) {
      destination.body.append(destination.adoptNode(element));
      element.label += '!';
      element.requestUpdate();
      await element.updateComplete;
      const view = destination.defaultView!;
      expect(view.getComputedStyle(element).paddingTop).to.equal('7px');
      expect(view.getComputedStyle(span).color, 'constructed styles retain cascade precedence').to.equal('rgb(1, 2, 3)');
      expect(view.getComputedStyle(root.querySelector('strong')!).color).to.equal('rgb(7, 8, 9)');
      expect(root.querySelector('span') === span).to.equal(true);
      expect(root.querySelector('style') === authoredStyle).to.equal(true);
      expect(root.querySelectorAll('style').length).to.equal(1);
      expect(root.adoptedStyleSheets.length).to.equal(sheetCount);
      expect(span.textContent).to.equal(element.label);
      expect(element.firstChild === light).to.equal(true);
    }
    element.remove();
    document.body.append(element);
    await element.updateComplete;
    expect(root.adoptedStyleSheets.length).to.equal(sheetCount);
    expect(root.querySelectorAll('style').length).to.equal(1);
  } finally {
    element.remove();
    iframe.remove();
  }
});

it('keeps nested real virtual-list viewport sizing after its styled parent is adopted', async () => {
  const iframe = await frame();
  const parent = createStyled();
  const list = document.createElement(tag('virtual-list')) as LyraVirtualList;
  list.source = { count: 10000, itemAt: (index: number) => index };
  list.renderItem = (item) => html`${item}`;
  parent.append(list);
  document.body.append(parent);
  await parent.updateComplete;
  await list.updateComplete;
  try {
    const before = list.clientHeight;
    expect(before).to.be.greaterThan(0);
    iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(parent));
    await parent.updateComplete;
    await list.updateComplete;
    expect(list.clientHeight).to.equal(before);
    expect(iframe.contentWindow!.getComputedStyle(list).getPropertyValue('--_lr-virtual-list-height').trim()).not.to.equal('');
    expect(list.shadowRoot!.querySelectorAll('[part~="row"]').length).to.be.lessThan(100);
  } finally {
    parent.remove();
    iframe.remove();
  }
});

it('keeps same-document shared sheets and the new-root foreign-document fallback', async () => {
  const iframe = await frame();
  const first = createStyled();
  const second = createStyled();
  const foreign = createStyled();
  document.body.append(first, second);
  await Promise.all([first.updateComplete, second.updateComplete]);
  try {
    expect(first.shadowRoot!.adoptedStyleSheets[0] === second.shadowRoot!.adoptedStyleSheets[0]).to.equal(true);
    const sheets = [...first.shadowRoot!.adoptedStyleSheets];
    first.remove();
    document.body.append(first);
    await first.updateComplete;
    expect(first.shadowRoot!.adoptedStyleSheets.every((sheet, index) => sheet === sheets[index])).to.equal(true);
    iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(foreign));
    await foreign.updateComplete;
    expect(iframe.contentWindow!.getComputedStyle(foreign).paddingTop).to.equal('7px');
    expect(foreign.shadowRoot!.adoptedStyleSheets.length).to.equal(0);
    expect(foreign.shadowRoot!.querySelector('span')?.textContent).to.equal('first');
  } finally {
    first.remove(); second.remove(); foreign.remove(); iframe.remove();
  }
});

it('shares document-local replacements and survives an inert document without changing render boundaries', async () => {
  const iframe = await frame();
  const first = createStyled();
  const second = createStyled();
  document.body.append(first, second);
  await Promise.all([first.updateComplete, second.updateComplete]);
  const root = first.shadowRoot!;
  const originalSheets = [...root.adoptedStyleSheets];
  try {
    const inert = document.implementation.createHTMLDocument('inert');
    inert.adoptNode(first);
    expect(first.shadowRoot === root).to.equal(true);
    const destination = iframe.contentDocument!;
    destination.body.append(destination.adoptNode(first), destination.adoptNode(second));
    await Promise.all([first.updateComplete, second.updateComplete]);
    expect(root.adoptedStyleSheets.every((sheet, index) => sheet === second.shadowRoot!.adoptedStyleSheets[index])).to.equal(true);
    const replacements = [...root.adoptedStyleSheets];
    expect(destination.defaultView!.getComputedStyle(first).paddingTop).to.equal('7px');
    document.body.append(document.adoptNode(first));
    await first.updateComplete;
    expect(root.adoptedStyleSheets.every((sheet, index) => sheet === originalSheets[index])).to.equal(true);
    destination.body.append(destination.adoptNode(first));
    await first.updateComplete;
    expect(root.adoptedStyleSheets.every((sheet, index) => sheet === replacements[index])).to.equal(true);
    expect(root.querySelectorAll('style').length).to.equal(1);
  } finally {
    first.remove(); second.remove(); iframe.remove();
  }
});
