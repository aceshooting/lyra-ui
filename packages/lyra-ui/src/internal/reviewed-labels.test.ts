import { fixture, expect, html } from '@open-wc/testing';
import { expectLabelInName } from '../../test/reviewed-labels.js';

it('reviews descriptive content without changing the concise visible label', async () => {
  const button = await fixture<HTMLButtonElement>(html`<button aria-label="Open report">
    <span>Report</span><span>Updated yesterday</span>
  </button>`);
  await expect(button).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  await expectLabelInName(button, [{
    target: button, label: [button.firstElementChild!], reason: 'The timestamp describes the report.',
  }]);
});

it('rejects a genuine name mismatch even on a reviewed control', async () => {
  const button = await fixture<HTMLButtonElement>(html`<button aria-label="Delete">
    <span>Save</span><span>Draft</span>
  </button>`);
  await expect(button).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  let message = '';
  try {
    await expectLabelInName(button, [{
      target: button, label: [button.firstElementChild!], reason: 'Draft is descriptive.',
    }]);
  } catch (error) { message = String(error); }
  expect(message).to.contain('visible label "save" in name "delete"');
});

it('rejects an unreviewed control alongside a reviewed control', async () => {
  const root = await fixture<HTMLDivElement>(html`<div>
    <button aria-label="Report"><span>Report</span><span>Yesterday</span></button>
    <button aria-label="Delete">Save</button>
  </div>`);
  await expect(root).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  const button = root.querySelector('button')!;
  let message = '';
  try {
    await expectLabelInName(root, [{
      target: button, label: [button.firstElementChild!], reason: 'Yesterday is descriptive.',
    }]);
  } catch (error) { message = String(error); }
  expect(message).to.contain('Unreviewed label-in-name violations');
});
