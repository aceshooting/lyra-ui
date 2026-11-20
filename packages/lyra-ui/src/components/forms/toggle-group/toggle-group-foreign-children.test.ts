import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-toggle-group.js';
import '../../lr-toggle.js';
import type { LyraToggleGroup } from './toggle-group.class.js';
import type { LyraToggle } from '../toggle/toggle.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const control = (toggle: LyraToggle): HTMLButtonElement | null =>
  toggle.shadowRoot?.querySelector<HTMLButtonElement>('[part~="button"]') ?? null;

const zeroStops = (group: LyraToggleGroup): string[] =>
  [...group.querySelectorAll<LyraToggle>('lr-toggle')]
    .filter((toggle) => control(toggle)?.getAttribute('tabindex') === '0')
    .map((toggle) => toggle.value);

describe('lr-toggle-group non-toggle content', () => {
  it('ignores keyboard and pointer interaction on a non-toggle child', async () => {
    const group = await fixture<LyraToggleGroup>(html`<lr-toggle-group label="Format">
      <lr-toggle value="a">A</lr-toggle>
      <button id="extra" type="button">Extra</button>
      <lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>`);
    await group.updateComplete;
    expect(zeroStops(group)).to.deep.equal(['a']);
    const extra = group.querySelector<HTMLButtonElement>('#extra')!;

    await focusByKeyboard(extra, group.parentElement!);
    await sendKeys({ press: 'ArrowRight' });
    extra.click();
    await group.updateComplete;

    expect(group.ownerDocument.activeElement === extra, 'focus stays on the foreign child').to.equal(true);
    expect(zeroStops(group)).to.deep.equal(['a']);
    expect([...group.querySelectorAll<LyraToggle>('lr-toggle')].some((toggle) => toggle.pressed)).to.equal(false);
  });

  it('moves the roving tab stop to a newcomer when the focused toggle is replaced wholesale', async () => {
    const group = await fixture<LyraToggleGroup>(html`<lr-toggle-group label="Format">
      <lr-toggle value="a">A</lr-toggle>
    </lr-toggle-group>`);
    await group.updateComplete;
    const first = group.querySelector<LyraToggle>('lr-toggle')!;
    await focusByKeyboard(control(first)!, group.parentElement!);

    const replacement = document.createElement('lr-toggle') as LyraToggle;
    replacement.value = 'z';
    replacement.textContent = 'Z';
    first.replaceWith(replacement);

    await waitUntil(() => zeroStops(group).join() === 'z', 'the newcomer becomes the tab stop');
    expect(zeroStops(group)).to.deep.equal(['z']);
  });
});

describe('lr-toggle-group value writes', () => {
  it('releases every toggle when value is cleared with null', async () => {
    const group = await fixture<LyraToggleGroup>(html`<lr-toggle-group label="Format">
      <lr-toggle value="a" pressed>A</lr-toggle>
      <lr-toggle value="b" pressed>B</lr-toggle>
    </lr-toggle-group>`);
    await group.updateComplete;
    expect([...group.value]).to.deep.equal(['a', 'b']);
    group.value = null;
    await group.updateComplete;
    expect([...group.value]).to.deep.equal([]);
  });
});
