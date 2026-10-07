import { aTimeout, expect, fixture, html, nextFrame } from '@open-wc/testing';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import './chip/chip.js';
import './badge/tag.js';
import './progress/progress-bar.js';
import './progress/progress-ring.js';
import './spinner/spinner.js';
import '../layout/card/card.js';
import '../layout/widget/widget.js';

// [tag, markup, private method every relevant observer batch ends up calling]
const cases: Array<[string, string, string]> = [
  ['lr-chip', '<lr-chip removable>Filter</lr-chip>', 'recomputeLabelText'],
  ['lr-tag', '<lr-tag with-remove>Filter</lr-tag>', 'recomputeLabelText'],
  ['lr-progress-bar', '<lr-progress-bar>Upload</lr-progress-bar>', 'recomputeVisibleLabelText'],
  ['lr-progress-ring', '<lr-progress-ring>Upload</lr-progress-ring>', 'recomputeVisibleLabelText'],
  ['lr-spinner', '<lr-spinner label-placement="after">Loading</lr-spinner>', 'recomputeVisibleLabelText'],
  ['lr-card', '<lr-card actionable>Open</lr-card>', 'recomputeAccessibleContentText'],
  ['lr-widget', '<lr-widget label="Usage"><span slot="label">Title</span>Body</lr-widget>', 'readLabelSlotText'],
];

for (const [tag, markup, method] of cases) {
  it(`${tag}: an ancestor write that leaves visibility unchanged does not rebuild its label`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>${unsafeHTML(markup)}</div>`);
    const el = wrapper.querySelector(tag) as HTMLElement & { updateComplete: Promise<boolean> };
    await el.updateComplete;
    await nextFrame();
    const target = el as unknown as Record<string, (...args: unknown[]) => unknown>;
    const original = target[method]!;
    let calls = 0;
    target[method] = function (this: unknown, ...args: unknown[]) {
      calls += 1;
      return original.apply(this, args);
    };

    wrapper.style.opacity = '0.9';
    await aTimeout(0);
    // Drain any first-batch visibility refresh before checking subsequent no-op writes.
    await nextFrame();
    await aTimeout(0);

    calls = 0;
    wrapper.style.opacity = '0.8';
    await aTimeout(0);
    expect(calls, 'an unrelated ancestor style write').to.equal(0);

    wrapper.hidden = true;
    await aTimeout(0);
    expect(calls, 'a visibility change').to.be.greaterThan(0);
  });
}
