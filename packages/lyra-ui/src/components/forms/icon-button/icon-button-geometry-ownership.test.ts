import { defineCE, expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraIconButton } from './icon-button.js';
import './icon-button.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

it('paints nested text from bare geometry while preserving the owned custom descendant only in light DOM', async () => {
  let instances = 0;
  const customTag = defineCE(class extends HTMLElement {
    constructor() { super(); instances++; }
  });
  const child = document.createElement(customTag);
  child.textContent = 'Custom content';
  const group = document.createElement('g');
  group.setAttribute('fill', 'currentColor');
  group.innerHTML = '<text x="1" y="16">Go<tspan> now</tspan><!-- author note --></text>';
  group.append(child);
  const button = document.createElement('lr-icon-button') as LyraIconButton;
  button.label = 'Go now';
  button.append(group);
  await fixture(button);
  await waitUntil(() => button.shadowRoot!.querySelector('[part="fallback"] text') !== null);
  const fallback = button.shadowRoot!.querySelector<SVGSVGElement>('[part="fallback"]')!;
  const text = fallback.querySelector<SVGTextElement>('text')!;
  expect(text.namespaceURI).to.equal(svgNamespace);
  expect(text.querySelector('tspan')!.namespaceURI).to.equal(svgNamespace);
  expect(text.textContent).to.equal('Go now');
  expect([...text.childNodes].map(node => node.nodeType)).to.deep.equal([Node.TEXT_NODE, Node.ELEMENT_NODE]);
  expect(text.getBBox().width).to.be.greaterThan(0);
  expect(fallback.querySelector('g')!.getAttribute('fill')).to.equal('currentColor');
  expect(fallback.querySelectorAll(customTag).length).to.equal(0);
  expect(child.parentNode === group).to.equal(true);
  expect(group.parentNode === button).to.equal(true);
  expect(child.isConnected).to.equal(true);
  expect(instances).to.equal(1);
  expect(button.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Go now');
});

it('clones only bare geometry when a complete SVG shares the icon slot', async () => {
  const button = await fixture<LyraIconButton>(html`<lr-icon-button label="Combined icon">
    <path d="M2 2h8v8H2z"></path><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle></svg>
  </lr-icon-button>`);
  const original = button.querySelector('svg')!;
  const circle = original.querySelector('circle')!;
  await waitUntil(() => button.shadowRoot!.querySelector('[part="fallback"] path') !== null);
  const fallback = button.shadowRoot!.querySelector<SVGSVGElement>('[part="fallback"]')!;
  expect(fallback.querySelectorAll('path').length).to.equal(1);
  expect(fallback.querySelectorAll('svg,circle').length).to.equal(0);
  expect(fallback.querySelector('path')!.namespaceURI).to.equal(svgNamespace);
  expect(original.parentNode === button).to.equal(true);
  expect(original.querySelector('circle') === circle).to.equal(true);
  expect(original.namespaceURI).to.equal(svgNamespace);
  expect(circle.getBBox().width).to.be.greaterThan(0);
  expect(original.isConnected).to.equal(true);
});
