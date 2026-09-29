import { expect, fixture, html } from '@open-wc/testing';
import { loadLyraLocale } from '../locale-loader.js';
import { localeLoaders } from '../internal/locale-loaders.generated.js';
import { getLyraLocale, getLyraLocaleDirection } from '../localization.js';
import type { LyraInput } from '../components/forms/input/input.class.js';
import type { LyraDateInput } from '../components/forms/date-picker/date-input.class.js';
import type { LyraFormatNumber } from '../components/utility/format/format-number.class.js';
import '../components/forms/input/input.js';
import '../components/forms/date-picker/date-input.js';
import '../components/utility/format/format-number.js';

function numberText(locale: string, value: number): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return new Intl.NumberFormat('en-US').format(value);
  }
}

it('qualifies representative accessible controls across every manifest-backed locale', async () => {
  const activeLocale = getLyraLocale();
  const activeDirection = getLyraLocaleDirection(activeLocale);
  const shell = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 320px" data-lr-density="compact">
      <lr-input type="password" password-toggle size="xs"></lr-input>
      <lr-format-number value="1234567.89"></lr-format-number>
      <lr-date-input value="2026-07-15"></lr-date-input>
    </div>
  `);
  const input = shell.querySelector<LyraInput>('lr-input')!;
  const formatNumber = shell.querySelector<LyraFormatNumber>('lr-format-number')!;
  const dateInput = shell.querySelector<LyraDateInput>('lr-date-input')!;

  // The generated loader table is the runtime inventory of canonical tags and their literal
  // aggregate imports. Load one at a time so browser memory stays bounded and each control sees
  // the same registered catalog the public lazy-loader API would use.
  const locales = Object.keys(localeLoaders).sort();
  expect(locales.length).to.be.greaterThan(0);
  for (const locale of locales) {
    await loadLyraLocale(locale);
    const direction = getLyraLocaleDirection(locale);
    expect(['ltr', 'rtl']).to.include(direction, `${locale} declares a usable direction`);

    shell.lang = locale;
    shell.dir = direction;
    input.locale = '';
    input.removeAttribute('dir');
    input.type = 'password';
    input.passwordToggle = true;
    input.passwordVisible = false;
    input.strings = {};
    input.label = `${locale}: ${'Credential and account access information '.repeat(5)}`;
    formatNumber.locale = '';
    dateInput.locale = '';
    dateInput.removeAttribute('dir');
    dateInput.value = '2026-07-15';
    input.requestUpdate();
    formatNumber.requestUpdate();
    dateInput.requestUpdate();
    await Promise.all([input.updateComplete, formatNumber.updateComplete, dateInput.updateComplete]);

    const nativeInput = input.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    const passwordToggle = input.shadowRoot!.querySelector<HTMLButtonElement>('[part="password-toggle"]')!;
    const formattedNumber = formatNumber.shadowRoot!.textContent?.trim() ?? '';
    expect(nativeInput.getAttribute('aria-label'), `${locale} uses its visible native label relationship`)
      .to.equal(null);
    expect(nativeInput.labels?.[0]?.textContent, `${locale} visible label names the native field`)
      .to.include(`${locale}: Credential`);
    expect(passwordToggle.getAttribute('aria-label'), locale).to.have.length.greaterThan(0);
    await expect(input, `${locale} input and its password action remain accessible`).to.be.accessible();
    expect(formattedNumber, `${locale} formats with its Intl number rules`)
      .to.equal(numberText(locale, 1234567.89));
    expect(input.getBoundingClientRect().width, `${locale} input fits its 320px allocation`)
      .to.be.at.most(shell.clientWidth + 1);
    expect(input.getBoundingClientRect().width, `${locale} input has a rendered width`)
      .to.be.greaterThan(0);
    const longLabel = input.shadowRoot!.querySelector<HTMLElement>('[part="form-control-label"]')!;
    expect(longLabel.scrollWidth, `${locale} long label does not overflow its control`)
      .to.be.at.most(longLabel.clientWidth + 1);
    expect(shell.scrollWidth, `${locale} composition does not overflow its narrow allocation`)
      .to.be.at.most(shell.clientWidth + 1);
    expect(input.shadowRoot!.querySelector('[part="label"]')!.textContent)
      .to.include(`${locale}: Credential`);

    input.label = '';
    await input.updateComplete;
    input.strings = {
      inputLabel: `Application field ${locale}`,
      showPassword: `Reveal secret ${locale}`,
      hidePassword: `Conceal secret ${locale}`,
    };
    await input.updateComplete;
    expect(nativeInput.getAttribute('aria-label')).to.equal(`Application field ${locale}`);
    expect(passwordToggle.getAttribute('aria-label')).to.equal(`Reveal secret ${locale}`);
    passwordToggle.click();
    await input.updateComplete;
    expect(passwordToggle.getAttribute('aria-label')).to.equal(`Conceal secret ${locale}`);
    passwordToggle.click();
    input.strings = {};
    await input.updateComplete;
    expect(nativeInput.getAttribute('aria-label'), `${locale} catalog/default fallback reaches the field`)
      .to.have.length.greaterThan(0);
    expect(passwordToggle.getAttribute('aria-label'), `${locale} catalog/default fallback reaches the action`)
      .to.have.length.greaterThan(0);

    if (direction === 'rtl') {
      const mixedScript = 'رقم المرجع ABC-123 ١٢٣';
      input.type = 'text';
      input.passwordToggle = false;
      input.value = mixedScript;
      await input.updateComplete;
      expect(getComputedStyle(input).direction, `${locale} uses its declared RTL direction`).to.equal('rtl');
      expect(input.shadowRoot!.querySelector<HTMLInputElement>('input')!.value).to.equal(mixedScript);
    }

    let localizedDigits: string[] = [];
    try {
      const formatter = new Intl.NumberFormat(locale, { useGrouping: false });
      localizedDigits = Array.from({ length: 10 }, (_, digit) => formatter.format(digit));
    } catch {
      // Some locales have no browser Intl data; Lyra's own safe fallback remains testable above.
    }
    if (localizedDigits.some((digit, index) => digit !== String(index))) {
      const dateNativeInput = dateInput.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
      const renderedDate = dateNativeInput.value;
      expect(localizedDigits.some((digit) => digit && renderedDate.includes(digit)),
        `${locale} date control renders its numbering system`).to.equal(true);
      dateInput.value = '';
      await dateInput.updateComplete;
      dateNativeInput.value = renderedDate;
      dateNativeInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(dateInput.value, `${locale} parses its own localized date digits`).to.equal('2026-07-15');
    }
  }

  input.locale = 'en';
  input.dir = 'ltr';
  input.type = 'password';
  input.passwordToggle = true;
  input.passwordVisible = false;
  input.label = '';
  input.strings = {};
  await input.updateComplete;
  const englishNativeInput = input.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const englishPasswordToggle = input.shadowRoot!.querySelector<HTMLButtonElement>('[part="password-toggle"]')!;
  expect(englishNativeInput.getAttribute('aria-label')).to.equal('Text');
  expect(englishPasswordToggle.getAttribute('aria-label')).to.equal('Show password');
  expect(getLyraLocale()).to.equal(activeLocale, 'loading catalogs does not select a new page locale');
  expect(getLyraLocaleDirection(getLyraLocale())).to.equal(activeDirection,
    'loading catalogs preserves the active page direction');
});
