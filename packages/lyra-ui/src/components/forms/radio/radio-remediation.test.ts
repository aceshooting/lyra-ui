import { aTimeout, expect, fixture, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraRadio } from './radio.js';
import type { LyraRadioGroup } from './radio-group.js';
import type { LyraSwitch } from '../switch/switch.js';
import './radio.js';
import './radio-button.js';
import './radio-group.js';
import '../switch/switch.js';

type Control = LyraRadio | LyraRadioGroup | LyraSwitch;
const settle = async (el: Control) => { await el.updateComplete; await aTimeout(0); await el.updateComplete; };
const descriptions = (target: Element): readonly Element[] =>
  (target as Element & { ariaDescribedByElements?: readonly Element[] }).ariaDescribedByElements ?? [];

for (const tag of ['lr-radio', 'lr-radio-button']) {
  for (const grouped of [false, true]) {
    it(`${tag} equal live checked=false remains dirty until ${grouped ? 'group' : 'standalone'} reset`, async () => {
      const form = await fixture<HTMLFormElement>(`<form>${grouped ? '<lr-radio-group name="choice">' : ''}<${tag} name="choice" value="a">Alpha</${tag}>${grouped ? '</lr-radio-group>' : ''}</form>`);
      const el = form.querySelector<LyraRadio>(tag)!;
      await settle(el);
      const changes: string[] = [];
      form.addEventListener('change', () => changes.push('change'));
      form.addEventListener('lr-change', () => changes.push('lr-change'));
      expect(el.checked).to.equal(false);
      el.checked = false;
      el.defaultChecked = true;
      expect(el.defaultChecked).to.equal(true);
      expect(el.checked).to.equal(false);
      expect(new FormData(form).getAll('choice')).to.deep.equal([]);
      await settle(el);
      expect(el.checked).to.equal(false);
      form.reset();
      expect(el.checked).to.equal(true);
      expect(new FormData(form).getAll('choice')).to.deep.equal(['a']);
      expect(changes).to.deep.equal([]);
    });
  }

  it(`${tag} retains pristine default propagation after an owning group synchronizes an unchanged peer`, async () => {
    const group = await fixture<LyraRadioGroup>(`<lr-radio-group name="choice"><${tag} value="a">Alpha</${tag}><${tag} value="b">Beta</${tag}></lr-radio-group>`);
    await settle(group);
    const [a, b] = Array.from(group.querySelectorAll<LyraRadio>(tag));
    if (!a || !b) throw new Error('Expected two radios');
    group.value = 'a';
    expect([a.checked, b.checked]).to.deep.equal([true, false]);
    b.defaultChecked = true;
    expect([a.checked, b.checked]).to.deep.equal([false, true]);
    expect(group.value).to.equal('b');
    const pristine = await fixture<LyraRadio>(`<${tag} checked>Default</${tag}>`);
    expect(pristine.checked).to.equal(true);
    pristine.defaultChecked = false;
    expect(pristine.checked).to.equal(false);
  });
}

for (const [tag, role, local] of [
  ['lr-radio', 'radio', false],
  ['lr-radio-button', 'radio', false],
  ['lr-radio-group', 'radiogroup', true],
  ['lr-switch', 'switch', true],
] as const) {
  it(`${tag} resolves live external descriptions on its semantic owner and keeps local guidance`, async () => {
    const wrapper = await fixture<HTMLElement>(`<div><p id="${tag}-guidance">External</p><${tag} ${local ? 'hint="Hint" error-text="Error"' : ''} aria-describedby="${tag}-guidance missing ${tag}-guidance">Value</${tag}></div>`);
    const el = wrapper.querySelector<Control>(tag)!;
    await settle(el);
    const owner = el.shadowRoot!.querySelector(`[role="${role}"]`)!;
    const source = wrapper.querySelector('p')!;
    await waitUntil(() => descriptions(owner)[0] === source);
    const expected = !local ? ['External'] : tag === 'lr-switch' ? ['External', 'Error', 'Hint'] : ['External', 'Hint', 'Error'];
    expect(descriptions(owner).map((node) => node.textContent?.trim())).to.deep.equal(expected);
    const replacement = source.cloneNode(true) as HTMLElement;
    replacement.textContent = 'Replacement';
    source.replaceWith(replacement);
    await waitUntil(() => descriptions(owner)[0] === replacement);
    replacement.remove();
    await waitUntil(() => descriptions(owner).length === (local ? 2 : 0));
    wrapper.prepend(replacement);
    await waitUntil(() => descriptions(owner)[0] === replacement);
    el.removeAttribute('aria-describedby');
    await waitUntil(() => descriptions(owner).length === (local ? 2 : 0));
    el.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => descriptions(owner)[0] === replacement);
    if (local) {
      (el as LyraRadioGroup | LyraSwitch).hint = '';
      await settle(el);
      expect(descriptions(owner).map((node) => node.textContent?.trim())).to.deep.equal(['Replacement', 'Error']);
    }
    el.remove();
    wrapper.append(el);
    await settle(el);
    await waitUntil(() => descriptions(owner)[0] === replacement);
  });

  it(`${tag} follows unresolved descriptions and ID changes after document adoption`, async () => {
    const el = await fixture<Control>(`<${tag} aria-describedby="adopted-guidance">Value</${tag}>`);
    await settle(el);
    const owner = el.shadowRoot!.querySelector(`[role="${role}"]`)!;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error('Expected iframe document');
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      const source = frameDocument.createElement('p');
      source.id = 'adopted-guidance';
      source.textContent = 'Adopted';
      frameDocument.body.append(source);
      await waitUntil(() => descriptions(owner)[0] === source);
      expect(descriptions(owner).map((node) => node.textContent)).to.deep.equal(['Adopted']);
      source.id = 'missing';
      await waitUntil(() => descriptions(owner).length === 0);
      source.id = 'adopted-guidance';
      await waitUntil(() => descriptions(owner)[0] === source);
    } finally {
      document.adoptNode(el);
      el.remove();
      frame.remove();
    }
  });
}

it('marks a required radio group user-invalid once focus leaves it without a choice', async () => {
  const wrapper = await fixture<HTMLElement>('<div><lr-radio-group required label="Plan"><lr-radio value="a">A</lr-radio><lr-radio value="b">B</lr-radio></lr-radio-group><button type="button">after</button></div>');
  const group = wrapper.querySelector<LyraRadioGroup>('lr-radio-group')!;
  await settle(group);
  await focusByKeyboard(group.querySelector<LyraRadio>('lr-radio')!);
  expect(group.matches(':state(user-invalid)')).to.equal(false);
  await sendKeys({ press: 'Tab' });
  await group.updateComplete;
  expect(group.matches(':state(user-invalid)')).to.equal(true);
  expect(group.shadowRoot!.querySelector('[role="radiogroup"]')!.getAttribute('aria-invalid')).to.equal('true');
});

it('exposes a standalone required radio as aria-invalid only after interaction', async () => {
  const el = await fixture<LyraRadio>('<lr-radio required name="x" value="a">A</lr-radio>');
  const base = el.shadowRoot!.querySelector('[part~="base"]')!;
  expect(base.getAttribute('aria-invalid')).to.equal('false');
  el.reportValidity();
  await el.updateComplete;
  expect(base.getAttribute('aria-invalid')).to.equal('true');
});

for (const [tag, part] of [['lr-radio', 'circle'], ['lr-radio-button', 'button']] as const) {
  it(`${tag} paints its invalid state through --lr-radio-invalid-border-color`, async () => {
    const el = await fixture<LyraRadio>(`<${tag} required style="--lr-radio-invalid-border-color: rgb(1, 2, 3)">A</${tag}>`);
    el.reportValidity();
    await el.updateComplete;
    expect(getComputedStyle(el.shadowRoot!.querySelector(`[part~="${part}"]`)!).borderTopColor).to.equal('rgb(1, 2, 3)');
  });
}

it('does not count the blur a fieldset disable forces as interaction', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>('<fieldset><lr-radio required name="x" value="a">A</lr-radio></fieldset>');
  const el = fieldset.querySelector<LyraRadio>('lr-radio')!;
  await settle(el);
  await focusByKeyboard(el);
  fieldset.disabled = true;
  fieldset.disabled = false;
  await settle(el);
  expect(el.matches(':state(user-invalid)')).to.equal(false);
});

it('does not count the control swap of an appearance change as interaction', async () => {
  const el = await fixture<LyraRadio>('<lr-radio required name="x" value="a">A</lr-radio>');
  await settle(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[role="radio"]')!);
  el.appearance = 'button';
  await settle(el);
  expect(el.matches(':state(user-invalid)')).to.equal(false);
});

it('keeps one run observer until the option set changes', async () => {
  const Original = window.ResizeObserver;
  let created = 0;
  window.ResizeObserver = class extends Original {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      created += 1;
    }
  };
  try {
    const group = await fixture<LyraRadioGroup>('<lr-radio-group orientation="horizontal"><lr-radio-button value="a">A</lr-radio-button><lr-radio-button value="b">B</lr-radio-button></lr-radio-group>');
    await settle(group);
    const before = created;
    const [a, b] = group.querySelectorAll<LyraRadio>('lr-radio-button');
    b!.click();
    await settle(group);
    a!.click();
    await settle(group);
    group.size = 'l';
    await settle(group);
    expect(created).to.equal(before);
  } finally {
    window.ResizeObserver = Original;
  }
});

it('emits lr-activate for every activation, after lr-change when the selection moves', async () => {
  const group = await fixture<LyraRadioGroup>('<lr-radio-group value="a"><lr-radio value="a">A</lr-radio><lr-radio value="b">B</lr-radio></lr-radio-group>');
  await settle(group);
  const seen: string[] = [];
  for (const type of ['lr-change', 'lr-activate'] as const) {
    group.addEventListener(type, (event) => seen.push(`${type}:${(event as CustomEvent<{ value: string }>).detail.value}`));
  }
  const [a, b] = group.querySelectorAll<LyraRadio>('lr-radio');
  a!.click();
  b!.click();
  expect(seen).to.deep.equal(['lr-activate:a', 'lr-change:b', 'lr-activate:b']);
  const standalone = await fixture<LyraRadio>('<lr-radio checked value="s">S</lr-radio>');
  let activated = '';
  standalone.addEventListener('lr-activate', (event) => { activated = (event as CustomEvent<{ value: string }>).detail.value; });
  standalone.click();
  expect(activated).to.equal('s');
});

it('dims the group chrome while disabled and outlines the options while invalid', async () => {
  const disabled = await fixture<LyraRadioGroup>('<lr-radio-group disabled label="Plan" hint="Hint" error-text="Error"><lr-radio value="a">A</lr-radio></lr-radio-group>');
  for (const part of ['label', 'hint', 'error']) {
    expect(Number(getComputedStyle(disabled.shadowRoot!.querySelector(`[part~="${part}"]`)!).opacity), part).to.be.below(1);
  }
  const group = await fixture<LyraRadioGroup>('<lr-radio-group required label="Plan"><lr-radio value="a">A</lr-radio></lr-radio-group>');
  const options = group.shadowRoot!.querySelector('[part~="radios"]')!;
  expect(getComputedStyle(options).borderTopStyle).to.equal('none');
  group.reportValidity();
  await group.updateComplete;
  expect(getComputedStyle(options).borderTopStyle).to.equal('solid');
});

it('makes standalone radios that share a name and form owner mutually exclusive', async () => {
  const form = await fixture<HTMLFormElement>('<form><lr-radio name="plan" value="a">A</lr-radio><lr-radio name="plan" value="b">B</lr-radio><lr-radio value="c">C</lr-radio></form>');
  const [a, b, c] = form.querySelectorAll<LyraRadio>('lr-radio');
  a!.click();
  b!.click();
  c!.click();
  expect([a!.checked, b!.checked, c!.checked]).to.deep.equal([false, true, true]);
  expect(new FormData(form).getAll('plan')).to.deep.equal(['b']);
});
