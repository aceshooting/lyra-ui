import { fixture, expect, html } from '@open-wc/testing';
import '../lr-tool-call-chip.js';
import '../lr-tool-call-block.js';
import '../lr-tool-result-dialog.js';
import '../lr-confirm-bar.js';
import '../lr-subagent-panel.js';
import '../lr-terminal.js';
import '../lr-permission-grant.js';
import '../lr-permission-rules.js';
import '../lr-connector-manager.js';
import '../lr-background-runs.js';
import '../lr-approval-queue.js';
import '../lr-test-results.js';
import '../lr-result-card.js';
import '../lr-result-field.js';

const BLANK = '   ';
const named = (el: Element | null | undefined): string => (el?.getAttribute('aria-label') ?? '').trim();

it('falls back to the localized tool name when a caller name is whitespace-only', async () => {
  const chip = await fixture(html`<lr-tool-call-chip name=${BLANK} display-name=${BLANK}></lr-tool-call-chip>`);
  expect(chip.shadowRoot!.querySelector('[part="name"]')!.textContent!.trim()).to.not.equal('');
  const block = await fixture(html`<lr-tool-call-block name=${BLANK}></lr-tool-call-block>`);
  expect(block.shadowRoot!.textContent!.trim()).to.not.equal('');
  const dialog = await fixture(html`<lr-tool-result-dialog tool-name=${BLANK} open></lr-tool-result-dialog>`);
  expect(dialog.shadowRoot!.querySelector('[part="tool-name"]')!.textContent!.trim()).to.not.equal('');
  const bar = await fixture(html`<lr-confirm-bar tool-name=${BLANK} heading=${BLANK}></lr-confirm-bar>`);
  expect(bar.shadowRoot!.querySelector('[part="heading"]')!.textContent!.trim()).to.not.equal('');
});

it('names a subagent progressbar and the terminal when the label is whitespace-only', async () => {
  const panel = await fixture(html`<lr-subagent-panel
    .runs=${[{ id: 'r1', label: BLANK, status: 'running', progressRatio: 0.5 }]}
  ></lr-subagent-panel>`);
  expect(named(panel.shadowRoot!.querySelector('[role="progressbar"]'))).to.not.equal('');
  const terminal = await fixture(html`<lr-terminal aria-label=${BLANK}  content="a"></lr-terminal>`);
  expect(named(terminal.shadowRoot!.querySelector('[aria-label]'))).to.not.equal('');
});

it('keeps a localized accessible group name when a group label is blank', async () => {
  const tags = ['lr-permission-grant', 'lr-permission-rules', 'lr-connector-manager', 'lr-background-runs'];
  for (const tag of tags) {
    const el = document.createElement(tag);
    el.setAttribute('label', BLANK);
    document.body.append(el);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(named(el.shadowRoot!.querySelector('fieldset')), tag).to.not.equal('');
    el.remove();
  }
  const queue = await fixture(html`<lr-approval-queue label=${BLANK}></lr-approval-queue>`);
  expect(named(queue.shadowRoot!.querySelector('[part="base"]'))).to.not.equal('');
});

it('omits blank suite names and dangling separators in test-results', async () => {
  const el = await fixture(html`<lr-test-results
    .suites=${[{ id: 's', name: BLANK, tests: [{ id: 't', name: 'boom', status: 'failed', message: 'x' }] }]}
  ></lr-test-results>`);
  expect(el.shadowRoot!.querySelector('[role="list"]')!.hasAttribute('aria-label')).to.be.false;
  const toggle = el.shadowRoot!.querySelector('[part="test"] button[aria-label]')!;
  expect(toggle.getAttribute('aria-label')!.includes(' — ')).to.be.false;
  expect(toggle.getAttribute('aria-label')).to.contain('boom');
});

it('renders no blank heading or bare colon in result-card and result-field', async () => {
  const card = await fixture(html`<lr-result-card heading=${BLANK} heading-level="2">body</lr-result-card>`);
  expect(card.shadowRoot!.querySelector('[part="heading"]') === null).to.equal(true);
  const field = await fixture(html`<lr-result-field label=${BLANK} value="v"></lr-result-field>`);
  expect(field.shadowRoot!.querySelector('[part="label"]') === null).to.equal(true);
});
