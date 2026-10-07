import { expect } from '@open-wc/testing';
import { render } from 'lit';
import {
  archiveIcon,
  chevronIcon,
  closeIcon,
  playIcon,
  pauseIcon,
  calendarIcon,
  expandIcon,
  menuIcon,
  pencilIcon,
  pinIcon,
  regenerateIcon,
  retryIcon,
  sendIcon,
  stopIcon,
  thumbIcon,
  trashIcon,
} from './icons.js';

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
  expandIcon,
  menuIcon,
  archiveIcon,
  pencilIcon,
  pinIcon,
  regenerateIcon,
  retryIcon,
  sendIcon,
  trashIcon,
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

it('menuIcon draws the hamburger as three full-width horizontal lines', () => {
  const svg = renderIcon(menuIcon());
  const lines = [...svg.querySelectorAll('line')].map((line) =>
    ['x1', 'y1', 'x2', 'y2'].map((name) => line.getAttribute(name)).join(' '),
  );
  expect(lines).to.deep.equal(['4 7 20 7', '4 12 20 12', '4 17 20 17']);
  expect(svg.getAttribute('stroke-linecap')).to.equal('round');
  expect(svg.getAttribute('focusable')).to.equal('false');
});

it('stopIcon renders the filled square with a non-stroked current-color fill', () => {
  const svg = renderIcon(stopIcon());
  expect(svg.getAttribute('fill')).to.equal('currentColor');
  expect(svg.getAttribute('stroke')).to.equal('none');
  expect(svg.querySelector('rect')?.getAttribute('rx')).to.equal('1.5');
});

it('thumbIcon uses fill only for the selected rating state', () => {
  const unselected = renderIcon(thumbIcon('up', false));
  const selected = renderIcon(thumbIcon('down', true));
  expect(unselected.getAttribute('fill')).to.equal('none');
  expect(selected.getAttribute('fill')).to.equal('currentColor');
  expect(unselected.querySelectorAll('path')).to.have.length(2);
  expect(selected.querySelectorAll('path')).to.have.length(2);
});

it('every icon shares the same viewBox and stroke-width for visual consistency', () => {
  const svgs = Object.values(icons).map((fn) => renderIcon(fn()));
  const viewBoxes = new Set(svgs.map((s) => s.getAttribute('viewBox')));
  const strokeWidths = new Set(svgs.map((s) => s.getAttribute('stroke-width')));
  expect(viewBoxes.size, 'all icons should share one viewBox').to.equal(1);
  expect(strokeWidths.size, 'all icons should share one stroke-width').to.equal(1);
});
