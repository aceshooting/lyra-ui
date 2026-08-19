import { expect, fixture, html } from '@open-wc/testing';
import { imageMapImageFor, isDateObject, isHtmlElement, isSvgElement } from './dom-guards.js';

it('recognizes genuine HTML elements and Dates from another same-origin realm', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow as Window & typeof globalThis;
  const foreignButton = frameDocument.createElement('button');
  const foreignSvgLink = frameDocument.createElementNS('http://www.w3.org/2000/svg', 'a');
  const foreignDate = new frameWindow.Date(2026, 6, 14);

  expect(foreignButton instanceof HTMLElement).to.equal(false);
  expect(foreignDate instanceof Date).to.equal(false);
  expect(isHtmlElement(foreignButton)).to.equal(true);
  expect(isSvgElement(foreignSvgLink)).to.equal(true);
  expect(isDateObject(foreignDate)).to.equal(true);
});

it('keeps recognizing a foreign-branded HTML element after adoption changes ownerDocument', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignButton = frame.contentDocument!.createElement('button');
  const foreignSvgLink = frame.contentDocument!.createElementNS('http://www.w3.org/2000/svg', 'a');
  document.body.append(foreignButton);
  document.body.append(foreignSvgLink);
  try {
    expect(foreignButton instanceof HTMLElement).to.equal(false);
    expect(foreignButton.ownerDocument === document).to.equal(true);
    expect(isHtmlElement(foreignButton)).to.equal(true);
    expect(isSvgElement(foreignSvgLink)).to.equal(true);
  } finally {
    foreignButton.remove();
    foreignSvgLink.remove();
  }
});

it('rejects forged element and Date lookalikes without invoking hostile getters', () => {
  const forgedElement = {
    nodeType: 1,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument: document,
  };
  const forgedDate = { getTime: () => 0, [Symbol.toStringTag]: 'Date' };
  const hostile = Object.defineProperty({}, 'nodeType', {
    get() {
      throw new Error('hostile nodeType');
    },
  });

  expect(isHtmlElement(forgedElement)).to.equal(false);
  expect(isSvgElement(forgedElement)).to.equal(false);
  expect(isDateObject(forgedDate)).to.equal(false);
  expect(isHtmlElement(hostile)).to.equal(false);
});

it('resolves an image-map association inside the map tree instead of the light document', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <img usemap="#shadow-map" alt="Mapped image" />
    <map name="shadow-map"><area href="#target" alt="Mapped action" /></map>
  `;
  const image = root.querySelector('img')!;
  const area = root.querySelector('area')!;

  expect(imageMapImageFor(area) === image).to.equal(true);
});
