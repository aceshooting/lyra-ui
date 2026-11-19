import { expect, fixture, html } from '@open-wc/testing';
import './eval-result.js';
import type { LyraEvalResult } from './eval-result.class.js';

describe('lr-eval-result child event containment', () => {
  it('participates in intrinsic width sizing', async () => {
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result .runs=${[
      { id: 'run', label: 'Evaluation', output: 'Example output' },
    ]}></lr-eval-result>`);
    expect(getComputedStyle(el).containerType).to.equal('normal');
  });

  it('keeps nested diff, review and grid events inside its shadow root', async () => {
    const el = await fixture<LyraEvalResult>(html`<lr-eval-result .rubricKeys=${[{ key: 'note', type: 'comment' }]}
      .runs=${[{ id: 'a', label: 'A', output: 'one' }, { id: 'b', label: 'B', output: 'two' }]}></lr-eval-result>`);
    const types = ['lr-search-change', 'lr-highlight-activate', 'lr-anchor-result', 'lr-change', 'lr-row-expand-request', 'lr-page-request', 'lr-column-resize-request'];
    const leaked: string[] = [];
    for (const type of types) el.addEventListener(type, () => leaked.push(type));
    const fire = (selector: string, type: string) => el.shadowRoot!.querySelector(selector)!
      .dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail: {} }));
    for (const type of types.slice(0, 3)) fire('lr-diff-view', type);
    fire('lr-rubric-form', 'lr-change');
    for (const type of types.slice(4)) fire('lr-table', type);
    expect(leaked).to.deep.equal([]);
  });
});
