import { expect, fixture, html } from '@open-wc/testing';
import type { LyraInput } from '../components/forms/input/input.class.js';
import { loadLyraLocale } from '../locale-loader.js';
import { resolveLyraLocale } from '../localization.js';
import '../components/forms/input/input.js';

it('uses a property locale override immediately and returns to inherited locale when cleared', async () => {
  await loadLyraLocale('zu');
  const shell = await fixture<HTMLDivElement>(html`
    <div lang="zu">
      <lr-input type="password" password-toggle></lr-input>
    </div>
  `);
  const input = shell.querySelector<LyraInput>('lr-input')!;
  const nativeInput = () => input.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const passwordToggle = () =>
    input.shadowRoot!.querySelector<HTMLButtonElement>('[part="password-toggle"]')!;

  await input.updateComplete;
  expect(nativeInput().getAttribute('aria-label')).to.equal('Umbhalo');
  expect(passwordToggle().getAttribute('aria-label')).to.equal('Bonisa iphasiwedi');

  input.locale = 'en';
  await input.updateComplete;
  expect(nativeInput().getAttribute('aria-label')).to.equal('Text');
  expect(passwordToggle().getAttribute('aria-label')).to.equal('Show password');

  input.locale = '';
  await input.updateComplete;
  expect(nativeInput().getAttribute('aria-label')).to.equal('Umbhalo');
  expect(passwordToggle().getAttribute('aria-label')).to.equal('Bonisa iphasiwedi');
});

it('keeps a reflected-attribute read from caching a cleared property override', async () => {
  await loadLyraLocale('zu');
  const shell = await fixture<HTMLDivElement>(html`
    <div lang="zu">
      <lr-input locale="en" type="password" password-toggle></lr-input>
    </div>
  `);
  const input = shell.querySelector<LyraInput>('lr-input')!;
  await input.updateComplete;

  input.locale = '';
  // The public DOM resolver still sees the old attribute until Lit reflects the property.
  expect(resolveLyraLocale(input)).to.equal('en');
  await input.updateComplete;

  expect(input.shadowRoot!.querySelector('input')!.getAttribute('aria-label')).to.equal('Umbhalo');
  expect(input.shadowRoot!.querySelector('[part="password-toggle"]')!.getAttribute('aria-label'))
    .to.equal('Bonisa iphasiwedi');
  expect(resolveLyraLocale(input)).to.equal('zu');
});
