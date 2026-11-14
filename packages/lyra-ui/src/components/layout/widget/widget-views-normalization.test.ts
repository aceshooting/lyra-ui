import { expect, fixture, html } from '@open-wc/testing';
import './widget.js';
import type { LyraWidget } from './widget.class.js';

const toggles = (el: LyraWidget): string[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="view-toggle"]')].map((toggle) => toggle.textContent!.trim());

describe('lr-widget views normalization', () => {
  it('treats a non-array views value as no views', async () => {
    const el = await fixture<LyraWidget>(html`<lr-widget label="Usage" .views=${[{ viewId: 'chart', label: 'Chart' }]}></lr-widget>`);
    expect(toggles(el)).to.have.length(1);
    el.views = { 0: { viewId: 'chart', label: 'Chart' }, length: 1 } as unknown as LyraWidget['views'];
    await el.updateComplete;
    expect(el.views).to.have.length(0);
    expect(toggles(el)).to.have.length(0);
  });

  it('drops views whose label or ariaLabel is not a string', async () => {
    const el = await fixture<LyraWidget>(html`<lr-widget label="Usage"></lr-widget>`);
    el.views = [
      { viewId: 'bad-label', label: 7 },
      { viewId: 'bad-aria', label: 'Bad aria', ariaLabel: { text: 'x' } },
      { viewId: 'chart', label: 'Chart' },
      { viewId: 'table', label: 'Table', ariaLabel: 'Data table' },
    ] as unknown as LyraWidget['views'];
    await el.updateComplete;
    expect(el.views.map((view) => view.viewId)).to.deep.equal(['chart', 'table']);
    expect(toggles(el)).to.deep.equal(['Chart', 'Table']);
  });
});
