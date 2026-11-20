import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-tool-result-dialog.js';
import type { LyraToolResultDialog } from '../../lr-tool-result-dialog.js';

it('updates the inner dialog name from a direct accessibleLabel and prioritizes an authored host label', async () => {
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
  expect(panel.getAttribute('aria-label')).to.equal('Host purpose');
  expect(panel.hasAttribute('aria-labelledby')).to.equal(false);
  expect(el.getAttribute('aria-label')).to.equal('Host purpose');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.hasAttribute('aria-labelledby')).to.equal(true);
});

it('keeps the header actions named native buttons that follow the shared icon-button tokens', async () => {
  const el = await fixture<LyraToolResultDialog>(html`<lr-tool-result-dialog open tool-name="Task" style="--lr-icon-button-bg: rgb(10, 20, 30); --lr-icon-button-border: 2px solid rgb(1, 2, 3)"></lr-tool-result-dialog>`);
  for (const part of ['maximize-button', 'close-button']) {
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${part}"]`)!;
    expect(button.localName).to.equal('button');
    expect(button.type).to.equal('button');
    expect(button.getAttribute('aria-label')!.length).to.be.greaterThan(0);
    const style = getComputedStyle(button);
    expect(style.backgroundColor).to.equal('rgb(10, 20, 30)');
    expect(style.borderTopWidth).to.equal('2px');
  }
});
