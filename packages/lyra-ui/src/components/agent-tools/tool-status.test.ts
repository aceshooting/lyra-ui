import { expect } from '@open-wc/testing';
import { render } from 'lit';
import {
  TOOL_CALL_STATUSES,
  TOOL_STATUS_LABEL_KEY,
  isToolCallStatus,
  toolStatusIcon,
} from './tool-status.js';

function glyphMarkup(status: unknown): string {
  const host = document.createElement('div');
  render(toolStatusIcon(status), host);
  const svgElement = host.querySelector('svg');
  return svgElement ? svgElement.innerHTML.replace(/<!--[^]*?-->/g, '').replace(/\s+/g, ' ').trim() : '';
}

it('exposes the frozen five-member tool status vocabulary', () => {
  expect([...TOOL_CALL_STATUSES]).to.deep.equal(['pending', 'running', 'success', 'error', 'denied']);
  expect(Object.isFrozen(TOOL_CALL_STATUSES)).to.equal(true);
});

it('checks status membership without accepting prototype keys or non-strings', () => {
  for (const status of TOOL_CALL_STATUSES) expect(isToolCallStatus(status)).to.equal(true);
  for (const value of ['bogus', 'toString', '__proto__', '', 'Pending', 1, null, undefined, {}]) {
    expect(isToolCallStatus(value), String(value)).to.equal(false);
  }
});

it('renders a distinct decorative glyph for every status and the pending glyph for foreign values', () => {
  const glyphs = TOOL_CALL_STATUSES.map((status) => glyphMarkup(status));
  expect(new Set(glyphs).size).to.equal(TOOL_CALL_STATUSES.length);
  expect(glyphs.every((markup) => markup.length > 0)).to.equal(true);
  expect(glyphMarkup('bogus')).to.equal(glyphs[0]);
  expect(glyphMarkup('toString')).to.equal(glyphs[0]);

  const host = document.createElement('div');
  render(toolStatusIcon('running'), host);
  const svgElement = host.querySelector('svg');
  expect(svgElement?.getAttribute('aria-hidden')).to.equal('true');
  expect(svgElement?.getAttribute('viewBox')).to.equal('0 0 24 24');
  expect(svgElement?.getAttribute('stroke-width')).to.equal('1.75');
});

it('maps every status to its visible text-twin key', () => {
  expect({ ...TOOL_STATUS_LABEL_KEY }).to.deep.equal({
    pending: 'statusPending',
    running: 'statusRunning',
    success: 'statusSuccess',
    error: 'statusError',
    denied: 'statusDenied',
  });
});
