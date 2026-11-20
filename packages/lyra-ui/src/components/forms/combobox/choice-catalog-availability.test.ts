import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraCombobox } from '../../lr-combobox.js';
import '../../lr-combobox.js';
import '../../lr-option.js';
import '../../lr-select.js';

for (const name of ['select', 'combobox'] as const) {
  it(`${name} updates projected rows when authored options become unavailable`, async () => {
    const picker = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(
      `<lr-${name}><lr-option value="a">Alpha</lr-option><lr-option value="b">Bravo</lr-option>
        <lr-option value="c">Charlie</lr-option></lr-${name}>`,
    );
    await picker.show();
    const option = picker.querySelector('lr-option')!;
    const row = () => picker.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
    expect(row().getAttribute('aria-disabled')).to.equal('false');
    for (const attribute of ['aria-disabled', 'hidden']) {
      option.setAttribute(attribute, 'true');
      await waitUntil(() => row().getAttribute('aria-disabled') === 'true', attribute);
      row().click();
      expect(picker.value).to.equal('');
      option.removeAttribute(attribute);
      await waitUntil(() => row().getAttribute('aria-disabled') === 'false', attribute);
    }
    row().click();
    expect(picker.value).to.equal('a');
  });

  it(`${name} abandons the pick if its request listener hides the option`, async () => {
    const picker = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(
      `<lr-${name}><lr-option value="a">Alpha</lr-option><lr-option value="b">Bravo</lr-option></lr-${name}>`,
    );
    await picker.show();
    picker.addEventListener('lr-change-request', () => { picker.querySelector('lr-option')!.hidden = true; });
    picker.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!.click();
    expect(picker.value).to.equal('');
  });
}

it('keeps the written value of a reselected combobox occurrence in its original position', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox multiple>
    <lr-option value="same" selected>First</lr-option><lr-option value="same" selected>Second</lr-option>
  </lr-combobox>`);
  expect(combo.selectedRows.map(row => row.label)).to.deep.equal(['First', 'Second']);
  const second = combo.querySelectorAll('lr-option')[1]!;
  second.value = 'new';
  second.selected = true;
  await combo.updateComplete;
  await Promise.resolve();
  expect(combo.value).to.deep.equal(['same', 'new']);
  expect(combo.selectedRows.map(row => row.label)).to.deep.equal(['First', 'Second']);
});

for (const name of ['select', 'combobox'] as const) {
  it(`${name} refreshes a fallback option when its forwarding slot is hidden`, async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const root = host.attachShadow({ mode: 'open' });
    const picker = document.createElement(`lr-${name}`);
    const forwarding = document.createElement('slot');
    const fallback = document.createElement('lr-option');
    fallback.value = 'first';
    fallback.label = 'First';
    forwarding.append(fallback);
    picker.append(forwarding);
    root.append(picker);
    await picker.updateComplete;
    await picker.show();
    const row = () => picker.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
    expect(row().getAttribute('aria-disabled')).to.equal('false');
    forwarding.hidden = true;
    await waitUntil(() => row().getAttribute('aria-disabled') === 'true', 'hidden forwarding slot disables its fallback row');
    forwarding.hidden = false;
    await waitUntil(() => row().getAttribute('aria-disabled') === 'false');
    row().click();
    expect(picker.value).to.equal('first');
  });

  it(`${name} ignores live option writes received while detached`, async () => {
    const picker = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(
      `<lr-${name} value="a"><lr-option value="a">Alpha</lr-option><lr-option value="b">Bravo</lr-option></lr-${name}>`,
    );
    const [first, second] = Array.from(picker.querySelectorAll('lr-option'));
    second!.selected = true;
    await Promise.resolve();
    expect(picker.value).to.equal('b');
    picker.remove();
    first!.selected = true;
    await Promise.resolve();
    expect(picker.value).to.equal('b');
  });
}

it('observes inherited option availability in the destination document after moving an open picker', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Destination"></iframe>`);
  const combo = await fixture<LyraCombobox>(html`<lr-combobox open>
    <lr-option value="a">Alpha</lr-option><lr-option value="b">Bravo</lr-option>
  </lr-combobox>`);
  const destination = frame.contentDocument!.body;
  destination.append(combo);
  try {
    await combo.updateComplete;
    await combo.show();
    const row = () => combo.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
    destination.inert = true;
    await waitUntil(() => row().getAttribute('aria-disabled') === 'true');
    destination.inert = false;
    await waitUntil(() => row().getAttribute('aria-disabled') === 'false');
    row().click();
    expect(combo.value).to.equal('a');
  } finally {
    combo.remove();
  }
});
