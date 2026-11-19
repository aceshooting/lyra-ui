import { expect, fixture, html } from '@open-wc/testing';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/checkbox-group/checkbox-group.js';
import '../components/forms/switch/switch.js';
import '../components/forms/toggle/toggle.js';
import '../components/forms/toggle-group/toggle-group.js';

const options = [
  ['checkbox', html`<lr-checkbox>Choice</lr-checkbox>`],
  ['switch', html`<lr-switch>Choice</lr-switch>`],
  ['toggle', html`<lr-toggle>Choice</lr-toggle>`],
] as const;

function observeCommits(host: HTMLElement): string[] {
  const events: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change']) {
    host.addEventListener(name, () => events.push(name));
  }
  return events;
}

for (const [name, template] of options) {
  it(`${name} retires its native activation when disabled during the request`, async () => {
    const host = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(template);
    const state = () => 'checked' in host ? host.checked : host.pressed;
    const aria = name === 'toggle' ? 'aria-pressed' : 'aria-checked';
    const control = host.shadowRoot!.querySelector<HTMLElement>(`[${aria}]`)!;
    const events = observeCommits(host);
    let requests = 0;
    host.addEventListener(`lr-${name}-toggle-request`, () => {
      requests++;
      host.disabled = true;
    }, { once: true });

    control.click();
    expect(requests).to.equal(1);
    expect(state()).to.equal(false);
    expect(events).to.deep.equal([]);
    await host.updateComplete;
    expect(control.getAttribute(aria)).to.equal('false');

    host.disabled = false;
    await host.updateComplete;
    control.click();
    expect(state()).to.equal(true);
    expect(events).to.include('lr-change');
  });
}

const groups = [
  ['checkbox-group', 'lr-checkbox', 'aria-checked', html`
    <lr-checkbox-group label="Choices">
      <lr-checkbox value="a" checked>A</lr-checkbox><lr-checkbox value="b">B</lr-checkbox>
    </lr-checkbox-group>
  `],
  ['toggle-group', 'lr-toggle', 'aria-pressed', html`
    <lr-toggle-group label="Choices">
      <lr-toggle value="a" pressed>A</lr-toggle><lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>
  `],
] as const;

for (const [name, option, aria, template] of groups) {
  it(`${name} keeps the child and aggregate unchanged when disabled during the request`, async () => {
    const host = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(template);
    const second = host.querySelectorAll(option)[1]!;
    await second.updateComplete;
    const control = second.shadowRoot!.querySelector<HTMLElement>(`[${aria}]`)!;
    const childState = () => 'checked' in second ? second.checked : second.pressed;
    const events = observeCommits(host);
    let requests = 0;
    host.addEventListener(`lr-${name}-toggle-request`, () => {
      requests++;
      host.disabled = true;
    }, { once: true });

    control.click();
    expect(requests).to.equal(1);
    expect(childState()).to.equal(false);
    expect(host.value).to.deep.equal(['a']);
    expect(events).to.deep.equal([]);
    await second.updateComplete;
    expect(control.getAttribute(aria)).to.equal('false');

    host.disabled = false;
    await host.updateComplete;
    await second.updateComplete;
    control.click();
    expect(childState()).to.equal(true);
    expect(host.value).to.deep.equal(['a', 'b']);
    expect(events).to.include('lr-change');
  });
}
