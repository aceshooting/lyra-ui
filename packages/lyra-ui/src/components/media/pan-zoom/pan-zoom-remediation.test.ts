import { expect, fixture, html } from '@open-wc/testing';
import './pan-zoom.js';
import type { LyraPanZoom } from './pan-zoom.js';

it('names the viewport from a direct property while preserving host naming ownership', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom .strings=${{ zoomableFrameLabel: 'Viewport' }}></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
  el.accessibleLabel = 'Inspection';
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(viewport.getAttribute('aria-label')).to.equal('Inspection');
  el.accessibleLabel = 'Updated inspection';
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Updated inspection');
  el.accessibleLabel = '';
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('');
  el.setAttribute('aria-label', 'Host purpose');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
});
