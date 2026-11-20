import { expect, fixture } from '@open-wc/testing';
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-switch.js';
import '../../lr-radio.js';
import '../../lr-checkbox.js';

type Updating = HTMLElement & { updateComplete: Promise<unknown> };

/** The focusable owner and the visible indicator its keyboard ring must hug. */
const CONTROLS = [
  { tag: 'lr-checkbox', owner: '.checkbox-owner', indicator: '[part~="box"]' },
  { tag: 'lr-switch', owner: '[part~="base"]', indicator: '[part~="track"]' },
  { tag: 'lr-radio', owner: '[part~="base"]', indicator: '[part~="circle"]' },
] as const;

describe('choice controls ring the visible indicator, not the enlarged hit target', () => {
  it('paints the keyboard ring on the indicator of every choice control', async () => {
    const rings: string[] = [];
    for (const control of CONTROLS) {
      const el = await fixture<Updating>(
        staticHtml`<${unsafeStatic(control.tag)} value="a" required>Option</${unsafeStatic(control.tag)}>`
      );
      await el.updateComplete;
      await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>(control.owner)!);
      await el.updateComplete;
      const owner = getComputedStyle(el.shadowRoot!.querySelector(control.owner)!);
      const indicator = getComputedStyle(el.shadowRoot!.querySelector(control.indicator)!);
      rings.push(`${control.tag}: owner ${owner.outlineStyle}, indicator ${indicator.outlineStyle}`);
    }
    expect(rings).to.deep.equal(CONTROLS.map((control) => `${control.tag}: owner none, indicator solid`));
  });

  it('keeps the switch focus ring over its invalid outline', async () => {
    const root = await fixture<HTMLElement>(staticHtml`
      <div>
        <lr-switch required>Enable</lr-switch>
        <span style="color: var(--lr-focus-ring-color)">probe</span>
      </div>
    `);
    const el = root.querySelector<Updating & { reportValidity(): boolean }>('lr-switch')!;
    el.reportValidity();
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!);
    await el.updateComplete;
    const track = getComputedStyle(el.shadowRoot!.querySelector('[part~="track"]')!);
    expect(track.outlineColor).to.equal(getComputedStyle(root.querySelector('span')!).color);
  });
});
