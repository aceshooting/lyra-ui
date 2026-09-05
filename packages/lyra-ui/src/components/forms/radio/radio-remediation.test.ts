import { aTimeout, expect, fixture, waitUntil } from '@open-wc/testing';
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
