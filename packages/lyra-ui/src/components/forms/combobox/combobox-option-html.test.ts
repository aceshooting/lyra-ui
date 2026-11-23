import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-combobox.js';
import type { LyraCombobox, ComboboxDataSource } from '../../lr-combobox.js';
import { __setDompurifyImporterForTesting } from '../../../internal/dompurify-loader.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { accessibleName } from '../../../../test/accessible-name.js';

const XSS =
  '<b>Bold</b> <em>name</em>' +
  '<img src="https://example.test/pixel.png" onerror="window.__comboboxHtmlRan = true">' +
  '<script>window.__comboboxHtmlRan = true</script>' +
  '<a href="javascript:window.__comboboxHtmlRan = true">link text</a>' +
  '<button onclick="window.__comboboxHtmlRan = true">button text</button>' +
  '<span style="color: red" onmouseover="window.__comboboxHtmlRan = true">styled</span>' +
  '<lr-button>custom</lr-button>' +
  '<iframe src="https://example.test/"></iframe>';

const richRows: ComboboxDataSource = () => [
  { value: 'a', label: 'Alpha', html: '<b>Al</b>pha' },
  { value: 'b', label: 'Beta', html: '<b>Be</b>ta', sub: 'Second letter' },
  { value: 'c', label: 'Gamma' },
];

const options = (el: LyraCombobox): HTMLElement[] =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option"]'));
const richParts = (el: LyraCombobox): HTMLElement[] =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option-html"]'));
const fallbackNote = (el: LyraCombobox): HTMLElement | null =>
  el.shadowRoot!.querySelector<HTMLElement>('[part="option-html-fallback"]');
const inputOf = (el: LyraCombobox): HTMLInputElement =>
  el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
const finishListboxAnimation = (el: LyraCombobox): void => {
  el.shadowRoot!.querySelector('[part="listbox"]')?.getAnimations().forEach((animation) => animation.finish());
};

afterEach(() => __setDompurifyImporterForTesting(undefined));

describe('lr-combobox option html', () => {
  it('renders sanitized markup and strips script, handlers, links, styles, network and custom elements', async () => {
    const win = window as unknown as { __comboboxHtmlRan?: boolean };
    delete win.__comboboxHtmlRan;
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" source-delay="0" open></lr-combobox>`);
    el.dataSource = () => [{ value: 'x', label: 'Plain label', html: XSS }];
    await waitUntil(() => richParts(el).length === 1, 'the sanitized markup renders');
    const rich = richParts(el)[0]!;
    expect(rich.querySelector('b')?.textContent).to.equal('Bold');
    expect(rich.querySelector('em')?.textContent).to.equal('name');
    expect(rich.querySelectorAll('script, a, button, iframe, lr-button').length).to.equal(0);
    expect(rich.querySelectorAll('[onerror], [onclick], [onmouseover], [style], [src], [href]').length).to.equal(0);
    // Unwrapped interactive and custom elements keep their text only.
    expect(rich.textContent).to.include('link text');
    expect(rich.textContent).to.include('custom');
    expect(rich.getAttribute('aria-hidden')).to.equal('true');
    // wait-reason: asserting a would-be handler never fires (negative assertion)
    await aTimeout(40);
    expect(win.__comboboxHtmlRan).to.equal(undefined);
    const option = options(el)[0]!;
    expect(option.hasAttribute('aria-label')).to.equal(false);
    expect(option.querySelector('.sr-only')?.textContent).to.equal('Plain label');
    expect(fallbackNote(el) === null).to.equal(true);
  });

  it('keeps the label as the name, filter text and committed text', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" source-delay="0" open></lr-combobox>`);
    el.dataSource = richRows;
    await waitUntil(() => richParts(el).length === 2, 'both rich rows render');
    const [, beta] = options(el);
    expect(beta!.querySelector('.sr-only')?.textContent).to.equal('Beta');
    expect(beta!.querySelector('[part="option-sub"]')?.textContent).to.equal('Second letter');
    beta!.click();
    await el.updateComplete;
    expect(el.value).to.equal('b');
    expect(inputOf(el).value).to.equal('Beta');
  });

  it('leaves keyboard navigation and selection unaffected', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" source-delay="0"></lr-combobox>`);
    el.dataSource = richRows;
    await focusByKeyboard(inputOf(el));
    await waitUntil(() => el.open && richParts(el).length === 2, 'the rich rows render on keyboard focus');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'ArrowDown' });
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector<HTMLElement>('[part~="option"][data-active]');
    expect(active?.dataset['value']).to.equal('b');
    expect(inputOf(el).getAttribute('aria-activedescendant')).to.equal(active!.id);
    const change = oneEvent(el, 'change');
    await sendKeys({ press: 'Enter' });
    await change;
    expect(el.value).to.equal('b');
    expect(inputOf(el).value).to.equal('Beta');
  });

  for (const failure of ['rejection', 'unusable module'] as const) {
    it(`fails closed to plain labels on a sanitizer ${failure}, with a visible note and one announcement`, async () => {
      expectDevWarning('lyra-dompurify-unavailable');
      __setDompurifyImporterForTesting(() =>
        failure === 'rejection' ? Promise.reject(new Error('private import detail')) : Promise.resolve({})
      );
      const message = 'Rich content is off.';
      const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" source-delay="0" open></lr-combobox>`);
      el.strings = { comboboxRichContentUnavailable: message };
      el.dataSource = () => [{ value: 'x', label: 'Plain label', html: '<b onclick="alert(1)">Raw markup</b>' }];
      await waitUntil(() => fallbackNote(el) !== null, 'the fallback note renders');
      expect(fallbackNote(el)!.textContent).to.equal(message);
      expect(fallbackNote(el)!.hasAttribute('role')).to.equal(false);
      expect(fallbackNote(el)!.hasAttribute('aria-live')).to.equal(false);
      expect(richParts(el).length).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part~="option"] b').length).to.equal(0);
      expect(options(el)[0]!.textContent!.trim()).to.equal('Plain label');
      expect(el.shadowRoot!.textContent).not.to.include('Raw markup');
      expect(el.shadowRoot!.textContent).not.to.include('private import detail');
      await waitUntil(() => sinkTexts('polite').includes(message), 'the fallback is announced');

      // A recovered peer renders the next result's markup and retires the note.
      __setDompurifyImporterForTesting(undefined);
      el.dataSource = () => [{ value: 'y', label: 'Next', html: '<i>Recovered</i>' }];
      await waitUntil(() => richParts(el)[0]?.querySelector('i')?.textContent === 'Recovered', 'recovery renders markup');
      expect(fallbackNote(el) === null).to.equal(true);
    });
  }

  it('shows the unregistered English fallback note', async () => {
    expectDevWarning('lyra-dompurify-unavailable');
    __setDompurifyImporterForTesting(() => Promise.resolve({}));
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" source-delay="0" open></lr-combobox>`);
    el.dataSource = () => [{ value: 'x', label: 'Plain', html: '<b>x</b>' }];
    await waitUntil(() => fallbackNote(el) !== null, 'the fallback note renders');
    expect(fallbackNote(el)!.textContent).to.equal('Formatted option content is unavailable. Showing plain labels.');
  });

  it('never applies a superseded result sanitized after a newer one', async () => {
    let release: ((module: unknown) => void) | undefined;
    __setDompurifyImporterForTesting(() => new Promise((resolve) => { release = resolve; }));
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" source-delay="0" open></lr-combobox>`);
    el.dataSource = ({ query }) =>
      query === 'old'
        ? [{ value: 'a', label: 'Old', html: '<i>old</i>' }]
        : [{ value: 'a', label: 'New', html: '<i>new</i>' }];
    el.inputValue = 'old';
    await waitUntil(() => release !== undefined && options(el)[0]?.textContent?.trim() === 'Old', 'the old request is waiting');
    expect(richParts(el).length, 'pending sanitization shows the plain label').to.equal(0);

    __setDompurifyImporterForTesting(undefined);
    el.inputValue = 'new';
    await waitUntil(() => richParts(el)[0]?.textContent === 'new', 'the newer result renders');

    release!(await import('dompurify'));
    await twoFrames();
    await el.updateComplete;
    expect(richParts(el).map((part) => part.textContent)).to.deep.equal(['new']);
    expect(el.shadowRoot!.textContent).not.to.include('old');
  });

  it('is accessible with rich rows, a keyboard-active row, and the fallback note', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" source-delay="0"></lr-combobox>`);
    el.dataSource = richRows;
    await focusByKeyboard(inputOf(el));
    await waitUntil(() => el.open && richParts(el).length === 2, 'rich rows render');
    await sendKeys({ press: 'ArrowDown' });
    await el.updateComplete;
    finishListboxAnimation(el);
    await expect(el).to.be.accessible();
    expect(accessibleName(options(el)[0]!)).to.equal('Alpha');

    expectDevWarning('lyra-dompurify-unavailable');
    __setDompurifyImporterForTesting(() => Promise.resolve({}));
    el.dataSource = () => [{ value: 'x', label: 'Plain', html: '<b>x</b>' }];
    await waitUntil(() => fallbackNote(el) !== null, 'the fallback note renders');
    finishListboxAnimation(el);
    await expect(el).to.be.accessible();
  });
});
