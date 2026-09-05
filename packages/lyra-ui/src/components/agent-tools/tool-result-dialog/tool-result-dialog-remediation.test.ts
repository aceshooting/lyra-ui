import { expect, fixture, html } from '@open-wc/testing';
import './tool-result-dialog.js';
import type { LyraToolResultDialog } from './tool-result-dialog.js';

it('updates the inner dialog name from a direct accessibleLabel without changing host ownership', async () => {
  const el = await fixture<LyraToolResultDialog>(html`<lr-tool-result-dialog open tool-name="Task"></lr-tool-result-dialog>`);
  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;
  el.accessibleLabel = 'Run details';
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-label')).to.equal('Run details');
  expect(panel.hasAttribute('aria-labelledby')).to.equal(false);
  el.accessibleLabel = 'Updated details';
  await el.updateComplete;
  expect(panel.getAttribute('aria-label')).to.equal('Updated details');
  el.accessibleLabel = '';
  await el.updateComplete;
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.hasAttribute('aria-labelledby')).to.equal(true);
  el.setAttribute('aria-label', 'Host purpose');
  await el.updateComplete;
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.hasAttribute('aria-labelledby')).to.equal(true);
  expect(el.getAttribute('aria-label')).to.equal('Host purpose');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.hasAttribute('aria-labelledby')).to.equal(true);
});
