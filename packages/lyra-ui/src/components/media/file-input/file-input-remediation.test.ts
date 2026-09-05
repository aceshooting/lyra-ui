import { expect, fixture, html } from '@open-wc/testing';
import './file-input.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

for (const property of ['label', 'hint'] as const) {
  it(`consumes removed ${property} without changing null readback and recovers text and association`, async () => {
    const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input></lr-file-input>`);
    const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="file-input"]')!;
    const association = property === 'label' ? 'aria-labelledby' : 'aria-describedby';
    const associatedId = property === 'label' ? 'file-input-label' : 'file-input-hint';
    const owner = (): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>(property === 'label' ? '[part~="form-control-label"]' : '[part="hint"]')!;
    el.setAttribute(property, 'Visible copy');
    await el.updateComplete;
    expect(owner().hidden).to.equal(false);
    expect(owner().textContent).to.include('Visible copy');
    expect(trigger.getAttribute(association)).to.equal(associatedId);
    el.removeAttribute(property);
    await el.updateComplete;
    expect(el[property]).to.equal(null);
    expect(owner().hidden).to.equal(true);
    expect(trigger.getAttribute(association)).to.equal(null);
    el.setAttribute(property, '');
    await el.updateComplete;
    expect(el[property]).to.equal('');
    expect(owner().hidden).to.equal(true);
    expect(trigger.getAttribute(association)).to.equal(null);
    el.setAttribute(property, 'Recovered copy');
    await el.updateComplete;
    expect(owner().hidden).to.equal(false);
    expect(owner().textContent).to.include('Recovered copy');
    expect(trigger.getAttribute(association)).to.equal(associatedId);
  });
}

it('retains native fieldset-disabled remove paint while preserving enabled pointer feedback', async () => {
  const host = await fixture<HTMLFieldSetElement>(html`<fieldset disabled><lr-file-input .files=${[new File(['a'], 'report.txt')]} style="--lr-transition-fast: 0s;"></lr-file-input></fieldset>`);
  const el = host.querySelector('lr-file-input')!;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
  const read = (): string[] => { const style = getComputedStyle(button); return [style.backgroundColor, style.color]; };
  const settle = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await resetMouse();
  const resting = read();
  expect(button.disabled).to.equal(true);
  try {
    await hoverUntilMatched(button, 'disabled remove should receive hover');
    await settle();
    expect(read()).to.deep.equal(resting);
    await sendMouse({ type: 'down' });
    await settle();
    expect(read()).to.deep.equal(resting);
    await resetMouse();
    host.disabled = false;
    await el.updateComplete;
    expect(button.disabled).to.equal(false);
    const enabledRest = read();
    await hoverUntilMatched(button, 'enabled remove should receive hover');
    await settle();
    expect(read()).to.not.deep.equal(enabledRest);
  } finally { await resetMouse(); }
});
