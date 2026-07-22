import { expect } from '@open-wc/testing';
import { render } from 'lit';
import { gemstoneGlyph } from './gemstones.js';

function renderGlyph(tpl: ReturnType<typeof gemstoneGlyph>): SVGElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(tpl, container);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('gemstoneGlyph did not render an <svg>');
  return svg;
}

it('gemstoneGlyph() with no argument defaults to a currentColor fill', () => {
  const svg = renderGlyph(gemstoneGlyph());
  const facetPath = svg.querySelector('path');
  expect(facetPath?.getAttribute('fill')).to.equal('currentColor');
});

it('gemstoneGlyph() with no argument carries a 1em x 1em intrinsic box', () => {
  const svg = renderGlyph(gemstoneGlyph());
  expect(svg.getAttribute('width')).to.equal('1em');
  expect(svg.getAttribute('height')).to.equal('1em');
});

it('gemstoneGlyph(color) still bakes in an explicit color (back-compat)', () => {
  const svg = renderGlyph(gemstoneGlyph('#34d399'));
  const facetPath = svg.querySelector('path');
  expect(facetPath?.getAttribute('fill')).to.equal('#34d399');
  expect(svg.getAttribute('width')).to.equal('1em');
  expect(svg.getAttribute('height')).to.equal('1em');
});
