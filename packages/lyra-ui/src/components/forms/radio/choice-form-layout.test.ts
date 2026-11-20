import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-radio.js';
import '../../lr-radio-button.js';
import '../../lr-radio-group.js';
import '../../lr-checkbox.js';
import '../../lr-checkbox-group.js';
import '../../lr-slider.js';
import '../../lr-toggle.js';
import '../../lr-toggle-group.js';

for (const name of ['radio', 'checkbox']) {
  it(`${name} group omits an individually disabled checked choice from submission`, async () => {
    const form = await fixture<HTMLFormElement>(`<form><lr-${name}-group required name="pick"><lr-${name} value="one" checked disabled>One</lr-${name}></lr-${name}-group></form>`);
    const choice = form.querySelector('lr-radio, lr-checkbox')!;
    expect(new FormData(form).getAll('pick')).to.deep.equal([]);
    choice.removeAttribute('disabled');
    await waitUntil(() => new FormData(form).get('pick') === 'one');
  });
}

for (const name of ['radio-button', 'radio appearance="button"']) {
  it(`${name} preserves the inline size of adornments beside a long label`, async () => {
    const radio = await fixture<HTMLElement>(`<lr-${name} style="width:120px"><span slot="start" style="display:inline-block;width:20px">A</span>Supercalifragilisticexpialidocious<span slot="end" style="display:inline-block;width:20px">B</span></lr-${name.split(' ')[0]}>`);
    for (const side of ['start', 'end']) {
      expect(radio.shadowRoot!.querySelector(`[part~="${side}"]`)!.getBoundingClientRect().width).to.be.at.least(20);
    }
  });
}

it('keeps a horizontal slider usable in a shrink-to-fit wrapper and a narrow allocation', async () => {
  const wrapper = await fixture<HTMLElement>(html`<span style="display:inline-block"><lr-slider></lr-slider></span>`);
  const track = wrapper.querySelector('lr-slider')!.shadowRoot!.querySelector('[part="track"]')!;
  expect(track.getBoundingClientRect().width).to.be.at.least(64);
  wrapper.style.width = '48px';
  expect(track.getBoundingClientRect().width).to.be.within(1, 48);
});

for (const name of ['checkbox', 'radio', 'toggle']) {
  it(`${name} group commits the previous value and the chosen option`, async () => {
    const group = await fixture<HTMLElement>(`<lr-${name}-group><lr-${name} value="a">A</lr-${name}></lr-${name}-group>`);
    const child = group.firstElementChild as HTMLElement;
    let detail: { previousValue: unknown; option: Element } | undefined;
    group.addEventListener('lr-change', event => { detail = (event as CustomEvent).detail; });
    child.click();
    expect(detail?.previousValue).to.deep.equal(name === 'radio' ? '' : []);
    expect(detail?.option === child).to.equal(true);
  });
}

for (const name of ['toggle', 'toggle-group']) {
  it(`${name} projects external label and description references to the role owner`, async () => {
    const wrapper = await fixture<HTMLElement>(`<div><span id="group-title">Title</span><span id="group-note">Note</span>
      <lr-${name} aria-labelledby="group-title" aria-describedby="group-note"></lr-${name}></div>`);
    const target = wrapper.lastElementChild!.shadowRoot!.querySelector<HTMLElement>('[role="group"], button')!;
    expect(target.ariaLabelledByElements?.map(el => el.id)).to.deep.equal(['group-title']);
    expect(target.ariaDescribedByElements?.map(el => el.id)).to.deep.equal(['group-note']);
  });
}

for (const name of ['radio', 'checkbox'] as const) {
  it(`${name} group keeps its choices in place when reporting a required error`, async () => {
    const group = await fixture<HTMLElementTagNameMap[`lr-${typeof name}-group`]>(`<lr-${name}-group required>
      <lr-${name} value="a">Alpha</lr-${name}></lr-${name}-group>`);
    const choice = group.firstElementChild!;
    const before = choice.getBoundingClientRect();
    expect(group.reportValidity()).to.equal(false);
    await group.updateComplete;
    const after = choice.getBoundingClientRect();
    expect([after.left, after.top, after.width, after.height]).to.deep.equal([before.left, before.top, before.width, before.height]);
  });
}

it('retains the author’s toolbar tabindex after an intervening write matches the leased value', async () => {
  const toggle = document.createElement('lr-toggle');
  const action = toggle.getToolbarActions()[0]!;
  action.setTabIndex(-1);
  const wrapper = await fixture<HTMLElement>(html`<div></div>`);
  wrapper.append(toggle);
  await toggle.updateComplete;
  const button = toggle.shadowRoot!.querySelector('button')!;
  expect(button.hasAttribute('tabindex')).to.equal(false);
  action.setTabIndex(-1);
  button.tabIndex = 2;
  action.setTabIndex(0);
  button.tabIndex = -1;
  action.releaseTabIndex!();
  expect(button.getAttribute('tabindex')).to.equal('-1');
});

it('rebinds toggle-group references in the destination document for both adoption paths', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><span id="group-name">Original</span>
    <lr-toggle-group aria-labelledby="group-name"></lr-toggle-group><iframe></iframe></div>`);
  const group = wrapper.querySelector('lr-toggle-group')!;
  const destination = wrapper.querySelector('iframe')!.contentDocument!;
  destination.body.innerHTML = '<span id="group-name">Destination</span>';
  const owner = group.shadowRoot!.querySelector<HTMLElement>('[role="group"]')!;
  for (const explicit of [true, false]) {
    if (explicit) destination.adoptNode(group);
    destination.body.append(group);
    await waitUntil(() => owner.ariaLabelledByElements?.[0]?.textContent === 'Destination');
    wrapper.append(group);
    await waitUntil(() => owner.ariaLabelledByElements?.[0]?.textContent === 'Original');
  }
});

it('updates radio-group submission synchronously when its checked radio is disabled or enabled', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-radio-group name="pick" required>
    <lr-radio checked value="one">One</lr-radio></lr-radio-group></form>`);
  const group = form.querySelector('lr-radio-group')!;
  const radio = form.querySelector('lr-radio')!;
  expect(new FormData(form).getAll('pick')).to.deep.equal(['one']);
  radio.disabled = true;
  expect(new FormData(form).getAll('pick')).to.deep.equal([]);
  expect(group.value).to.equal('one');
  expect(group.validity.valueMissing).to.equal(false);
  radio.disabled = false;
  expect(new FormData(form).getAll('pick')).to.deep.equal(['one']);
});

it('projects a child toggle change with no outstanding request using the current selection', async () => {
  const group = await fixture<HTMLElementTagNameMap['lr-toggle-group']>(html`<lr-toggle-group>
    <lr-toggle value="one" pressed>One</lr-toggle></lr-toggle-group>`);
  const toggle = group.querySelector('lr-toggle')!;
  const details: unknown[] = [];
  group.addEventListener('lr-change', event => {
    details.push(event.detail.value, event.detail.previousValue, event.detail.option === toggle);
  });
  toggle.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: { value: 'one', pressed: true } }));
  expect(details).to.deep.equal([['one'], ['one'], true]);
});
