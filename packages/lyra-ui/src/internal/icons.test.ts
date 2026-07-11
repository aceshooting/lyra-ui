import { expect } from '@open-wc/testing';
import { render } from 'lit';
import { chevronIcon, closeIcon, playIcon, pauseIcon, calendarIcon } from './icons.js';

function renderIcon(tpl: ReturnType<typeof chevronIcon>): SVGElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(tpl, container);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('icon did not render an <svg>');
  return svg;
}

const icons = {
  chevronIcon,
  closeIcon,
  playIcon,
  pauseIcon,
  calendarIcon,
};

for (const [name, fn] of Object.entries(icons)) {
  it(`${name}() renders a single 1em x 1em currentColor svg with no fixed pixel size or fill`, () => {
    const svg = renderIcon(fn());
    expect(svg.getAttribute('width')).to.equal('1em');
    expect(svg.getAttribute('height')).to.equal('1em');
    expect(svg.getAttribute('fill')).to.equal('none');
    expect(svg.getAttribute('stroke')).to.equal('currentColor');
    expect(svg.getAttribute('aria-hidden')).to.equal('true');
    expect(svg.querySelectorAll('path, line, polyline, polygon, rect').length).to.be.greaterThan(0);
  });
}

it('chevronIcon points right by default (no baked-in rotation)', () => {
  const svg = renderIcon(chevronIcon());
  expect(svg.getAttribute('style') ?? '').to.not.include('rotate');
  expect(svg.getAttribute('transform')).to.be.null;
});

it('every icon shares the same viewBox and stroke-width for visual consistency', () => {
  const svgs = Object.values(icons).map((fn) => renderIcon(fn()));
  const viewBoxes = new Set(svgs.map((s) => s.getAttribute('viewBox')));
  const strokeWidths = new Set(svgs.map((s) => s.getAttribute('stroke-width')));
  expect(viewBoxes.size, 'all icons should share one viewBox').to.equal(1);
  expect(strokeWidths.size, 'all icons should share one stroke-width').to.equal(1);
});
