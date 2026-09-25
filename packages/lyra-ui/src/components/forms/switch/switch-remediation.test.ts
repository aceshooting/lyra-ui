import { expect, fixture, html } from '@open-wc/testing';
import type { LyraSwitch } from './switch.js';
import './switch.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';

for (const attribute of ['hint', 'help-text', 'error-text']) {
  it(`lr-switch safely removes ${attribute} with null readback and later recovery`, async () => {
    const el = await fixture<LyraSwitch>('<lr-switch></lr-switch>');
    const property = attribute === 'help-text' ? 'helpText' : attribute === 'error-text' ? 'errorText' : attribute;
    el.setAttribute(attribute, 'Guidance');
    await el.updateComplete;
    el.removeAttribute(attribute);
    await el.updateComplete;
    expect(Reflect.get(el, property)).to.equal(null);
    expect(el.shadowRoot!.textContent?.includes('Guidance')).to.equal(false);
    el.setAttribute(attribute, '');
    await el.updateComplete;
    expect(Reflect.get(el, property)).to.equal('');
    el.setAttribute(attribute, 'Recovered');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent?.includes('Recovered')).to.equal(true);
  });
}

it('uses the checked track fill independently of the unchecked token in resting, hover, and active states', async () => {
  const style = '--lr-switch-track-fill: rgb(10, 20, 30); --lr-switch-checked-track-fill: rgb(100, 110, 120); --lr-transition-fast: 0s;';
  const checked = await fixture<LyraSwitch>(html`<lr-switch checked style=${style}></lr-switch>`);
  const unchecked = await fixture<LyraSwitch>(html`<lr-switch style=${style}></lr-switch>`);
  const checkedTrack = checked.shadowRoot!.querySelector<HTMLElement>('[part~="track"]')!;
  const uncheckedTrack = unchecked.shadowRoot!.querySelector<HTMLElement>('[part~="track"]')!;

  expect(getComputedStyle(checkedTrack).backgroundColor).to.equal('rgb(100, 110, 120)');
  await resetMouse();
  try {
    await hoverUntilMatched(checkedTrack, 'checked switch track should receive hover');
    await settlePointer();
    const checkedHover = getComputedStyle(checkedTrack).backgroundColor;
    await hoverUntilMatched(uncheckedTrack, 'unchecked switch track should receive hover');
    await settlePointer();
    expect(checkedHover).not.to.equal(getComputedStyle(uncheckedTrack).backgroundColor);

    await hoverUntilMatched(checkedTrack, 'checked switch track should receive active press');
    await sendMouse({ type: 'down' });
    await settlePointer();
    const checkedActive = getComputedStyle(checkedTrack).backgroundColor;
    await resetMouse();
    await hoverUntilMatched(uncheckedTrack, 'unchecked switch track should receive active press');
    await sendMouse({ type: 'down' });
    await settlePointer();
    expect(checkedActive).not.to.equal(getComputedStyle(uncheckedTrack).backgroundColor);
  } finally {
    await resetMouse();
  }
});
