import { aTimeout, expect, fixture, fixtureCleanup, waitUntil } from '@open-wc/testing';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import type { LyraLocalePicker } from './locale-picker.js';
import type { LyraOtpInput } from '../otp-input/otp-input.js';
import type { LyraPhoneInput } from '../phone-input/phone-input.js';
import './locale-picker.js';
import '../otp-input/otp-input.js';
import '../phone-input/phone-input.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
before(() => setFlagUrlResolver(async () => TEST_FLAG_SRC));
after(() => {
  fixtureCleanup();
  setFlagUrlResolver(null);
});

type Picker = LyraLocalePicker | LyraOtpInput | LyraPhoneInput;
const settle = async (el: Picker) => { await el.updateComplete; await aTimeout(0); await el.updateComplete; };
const descriptions = (target: Element): readonly Element[] =>
  (target as Element & { ariaDescribedByElements?: readonly Element[] }).ariaDescribedByElements ?? [];

for (const attribute of ['label', 'hint', 'error-text']) {
  it(`locale-picker renders safely after ${attribute} removal and recovers`, async () => {
    const el = await fixture<LyraLocalePicker>('<lr-locale-picker></lr-locale-picker>');
    const property = attribute === 'error-text' ? 'errorText' : attribute;
    el.setAttribute(attribute, 'Guidance');
    await settle(el);
    el.removeAttribute(attribute);
    await settle(el);
    expect(Reflect.get(el, property)).to.equal(null);
    expect(el.shadowRoot!.textContent?.includes('Guidance')).to.equal(false);
    el.setAttribute(attribute, '');
    await settle(el);
    expect(Reflect.get(el, property)).to.equal('');
    el.setAttribute(attribute, 'Recovered');
    await settle(el);
    expect(el.shadowRoot!.textContent?.includes('Recovered')).to.equal(true);
  });
}

for (const [tag, selector] of [
  ['lr-locale-picker', '[part="trigger"]'],
  ['lr-otp-input', '[part="control"]'],
  ['lr-phone-input', 'input[part="input"]'],
] as const) {
  it(`${tag} keeps external descriptions before local guidance across live target changes and reconnect`, async () => {
    const wrapper = await fixture<HTMLElement>(`<div><p id="${tag}-guidance">External guidance</p><${tag} label="Value" hint="Local hint" error-text="Local error" aria-describedby="${tag}-guidance missing ${tag}-guidance"></${tag}></div>`);
    const el = wrapper.querySelector<Picker>(tag)!;
    await settle(el);
    const target = el.shadowRoot!.querySelector(selector)!;
    const source = wrapper.querySelector('p')!;
    await waitUntil(() => descriptions(target)[0] === source);
    const expected = tag === 'lr-phone-input' ? ['External guidance', 'Local hint', 'Local error'] : ['External guidance', 'Local error', 'Local hint'];
    expect(descriptions(target).map((node) => node.textContent?.trim())).to.deep.equal(expected);
    const replacement = source.cloneNode(true) as HTMLElement;
    replacement.textContent = 'Replacement';
    source.replaceWith(replacement);
    await waitUntil(() => descriptions(target)[0] === replacement);
    replacement.remove();
    await waitUntil(() => descriptions(target).length === 2);
    wrapper.prepend(replacement);
    await waitUntil(() => descriptions(target)[0] === replacement);
    el.removeAttribute('aria-describedby');
    await waitUntil(() => descriptions(target).length === 2);
    el.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => descriptions(target)[0] === replacement);
    el.hint = '';
    await settle(el);
    expect(descriptions(target).map((node) => node.textContent?.trim())).to.deep.equal(['Replacement', 'Local error']);
    el.remove();
    wrapper.append(el);
    await settle(el);
    await waitUntil(() => descriptions(target)[0] === replacement);
    if (tag === 'lr-phone-input') {
      expect(descriptions(el.shadowRoot!.querySelector('select')!).length).to.equal(0);
    }
  });

  it(`${tag} resolves missing descriptions and changed IDs in an adopted document`, async () => {
    const el = await fixture<Picker>(`<${tag} label="Value" hint="Local hint" aria-describedby="adopted-guidance"></${tag}>`);
    await settle(el);
    const target = el.shadowRoot!.querySelector(selector)!;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error('Expected iframe document');
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      const source = frameDocument.createElement('p');
      source.id = 'adopted-guidance';
      source.textContent = 'Adopted guidance';
      frameDocument.body.append(source);
      await waitUntil(() => descriptions(target)[0] === source);
      expect(descriptions(target).map((node) => node.textContent?.trim())).to.deep.equal(['Adopted guidance', 'Local hint']);
      source.id = 'missing';
      await waitUntil(() => descriptions(target).length === 1);
      source.id = 'adopted-guidance';
      await waitUntil(() => descriptions(target)[0] === source);
    } finally {
      document.adoptNode(el);
      el.remove();
      frame.remove();
    }
  });
}
