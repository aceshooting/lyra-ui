import { expect } from '@open-wc/testing';
import { svg, render } from 'lit';
import { nativeSvgTitle } from './svg-title.js';

it('renders markup-like and carriage-return text as literal title text', () => {
  const host = document.createElement('div');
  render(svg`<svg>${nativeSvgTitle('a<b>&"c"\r${x}')}</svg>`, host);
  const title = host.querySelector('title')!;
  expect(title.children.length).to.equal(0);
  expect(title.textContent).to.equal('a<b>&"c"\r${x}');
});
