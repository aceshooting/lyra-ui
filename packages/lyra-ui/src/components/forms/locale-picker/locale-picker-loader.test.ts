import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.class.js';
import type { LyraLocaleLoader } from '../../../internal/locale-loader.js';
import { getLyraLocale, setLyraLocale } from '../../../localization.js';

type Picker = LyraLocalePicker & { localeLoader?: LyraLocaleLoader };
const pending = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const pick = (el: Picker, tag: string) => el.shadowRoot!
  .querySelector<HTMLElement>(`[part="option"][data-value="${tag}"]`)!.click();
const trigger = (el: Picker) => el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
const create = () => fixture<Picker>(html`<lr-locale-picker locale="en" value="en" without-flags .locales=${['en', 'fr', 'de']} .strings=${{ loading: 'Please wait', statusError: 'Cannot load', retry: 'Try again' }}></lr-locale-picker>`);
let previousLocale: string;
beforeEach(() => { previousLocale = getLyraLocale(); setLyraLocale('en'); });
afterEach(() => { setLyraLocale(previousLocale); });

it('keeps unset loading synchronous and commits a notification after the value', async () => {
  const el = await create();
  expect(el.localeLoader).to.equal(undefined);
  let notified = '';
  el.addEventListener('lr-change', () => { notified = el.value; });
  pick(el, 'fr');
  expect(el.value).to.equal('fr');
  expect(notified).to.equal('fr');
});

it('waits for an optional loader before selecting and exposes localized busy status', async () => {
  const el = await fixture<Picker>(html`<lr-locale-picker locale="en" value="en" without-flags .locales=${['en', 'fr', 'de']}></lr-locale-picker>`);
  el.strings = { loading: 'Please wait' };
  const load = pending();
  el.localeLoader = () => load.promise;
  let notifications = 0;
  el.addEventListener('lr-change', () => { notifications++; });
  pick(el, 'fr');
  await el.updateComplete;
  expect(el.value).to.equal('en');
  expect(getLyraLocale()).to.equal('en');
  expect(trigger(el).getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('[part="load-status"]')?.textContent).to.contain('Please wait');
  expect(notifications).to.equal(0);
  load.resolve();
  await waitUntil(() => el.value === 'fr');
  expect(getLyraLocale()).to.equal('fr');
  expect(notifications).to.equal(1);
});

it('does not call a loader when the precommit request is vetoed', async () => {
  const el = await create();
  let loads = 0;
  el.localeLoader = async () => { loads++; };
  el.addEventListener('lr-change-request', (event) => event.preventDefault());
  pick(el, 'fr');
  await el.updateComplete;
  expect(loads).to.equal(0);
  expect(el.value).to.equal('en');
});

it('keeps the latest request when imports finish out of order', async () => {
  const el = await create();
  const french = pending();
  const german = pending();
  el.localeLoader = (tag) => tag === 'fr' ? french.promise : german.promise;
  pick(el, 'fr');
  await Promise.resolve();
  pick(el, 'de');
  german.resolve();
  await waitUntil(() => el.value === 'de');
  french.resolve();
  await el.updateComplete;
  await Promise.resolve();
  expect(el.value).to.equal('de');
});

for (const action of ['host-write', 'reset', 'disconnect', 'disabled', 'loader-replaced', 'catalog-replaced', 'reconnect', 'fieldset-disabled'] as const) {
  it(`does not commit a pending selection after ${action}`, async () => {
    const el = await create();
    const load = pending();
    let started = false;
    el.localeLoader = () => { started = true; return load.promise; };
    let notifications = 0;
    el.addEventListener('lr-change', () => { notifications++; });
    pick(el, 'fr');
    await waitUntil(() => started);
    if (action === 'host-write') el.value = 'de';
    if (action === 'reset') el.formResetCallback();
    if (action === 'disconnect') el.remove();
    if (action === 'reconnect') { const parent = el.parentNode!; el.remove(); parent.appendChild(el); }
    if (action === 'fieldset-disabled') { el.formDisabledCallback(true); el.formDisabledCallback(false); }
    if (action === 'disabled') { el.disabled = true; el.disabled = false; }
    if (action === 'loader-replaced') el.localeLoader = async () => undefined;
    if (action === 'catalog-replaced') { el.locales = ['en']; el.locales = ['en', 'fr']; }
    load.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await el.updateComplete;
    expect(el.value).to.equal(action === 'host-write' ? 'de' : 'en');
    expect(notifications).to.equal(0);
  });
}

it('catches synchronous callback failures and retries through a fresh request without exposing raw errors', async () => {
  const el = await fixture<Picker>(html`<lr-locale-picker locale="en" value="en" without-flags .locales=${['en', 'fr', 'de']}></lr-locale-picker>`);
  el.strings = { statusError: 'Cannot load', retry: 'Try again' };
  let loads = 0;
  let requests = 0;
  el.localeLoader = () => {
    if (++loads === 1) throw new Error('private network details');
    return Promise.resolve();
  };
  el.addEventListener('lr-change-request', () => { requests++; });
  pick(el, 'fr');
  await waitUntil(() => el.shadowRoot!.querySelector('[part="load-retry"]') !== null);
  expect(el.value).to.equal('en');
  const status = el.shadowRoot!.querySelector('[part="load-status"]')!.textContent!;
  expect(el.shadowRoot!.querySelector('[part="load-status"]')?.textContent).to.contain('Cannot load');
  expect(status).not.to.contain('private network details');
  expect(el.shadowRoot!.querySelector('[part="load-retry"]')?.textContent).to.contain('Try again');
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-retry"]')!);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => el.value === 'fr');
  expect(loads).to.equal(2);
  expect(requests).to.equal(2);
  expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
});

it('prevents nested selection during the request callback from starting a second load', async () => {
  const el = await create();
  const tags: string[] = [];
  el.localeLoader = async (tag) => { tags.push(tag); };
  el.addEventListener('lr-change-request', () => pick(el, 'de'));
  pick(el, 'fr');
  await waitUntil(() => tags.length > 0);
  expect(tags).to.deep.equal(['fr']);
});


it('keeps keyboard selection pending and makes loading and failure states accessible', async () => {
  const el = await create();
  const load = pending();
  el.localeLoader = () => load.promise;
  await focusByKeyboard(trigger(el));
  await sendKeys({ type: 'f' });
  await waitUntil(() => trigger(el).getAttribute('aria-busy') === 'true');
  expect(el.value).to.equal('en');
  await expect(el).to.be.accessible();
  load.reject(new Error('not rendered'));
  await waitUntil(() => el.shadowRoot!.querySelector('[part="load-retry"]') !== null);
  await expect(el).to.be.accessible();
  const retry = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-retry"]')!;
  expect(retry.getBoundingClientRect().height).to.be.at.least(24);
  el.localeLoader = async () => undefined;
});

it('ignores a superseded load failure instead of replacing a newer successful selection', async () => {
  const el = await create();
  const first = pending();
  el.localeLoader = (tag) => tag === 'fr' ? first.promise : Promise.resolve();
  pick(el, 'fr');
  await Promise.resolve();
  pick(el, 'de');
  await waitUntil(() => el.value === 'de');
  first.reject(new Error('stale failure'));
  await Promise.resolve();
  await Promise.resolve();
  await el.updateComplete;
  expect(el.value).to.equal('de');
  expect(el.shadowRoot!.querySelector('[part="load-retry"]') === null).to.equal(true);
});


it('cancels before invoking the loader when the host writes in the same turn', async () => {
  const el = await create();
  let loads = 0;
  el.localeLoader = async () => { loads++; };
  pick(el, 'fr');
  el.value = 'de';
  await Promise.resolve();
  await el.updateComplete;
  expect(loads).to.equal(0);
  expect(el.value).to.equal('de');
});


it('preserves a request listener focus move while retrying a failed load', async () => {
  const el = await create();
  el.localeLoader = () => Promise.reject(new Error('not rendered'));
  pick(el, 'fr');
  await waitUntil(() => el.shadowRoot!.querySelector('[part="load-retry"]') !== null);
  const other = document.createElement('button');
  other.id = 'locale-retry-host-target';
  other.textContent = 'Host target';
  el.parentNode!.appendChild(other);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-retry"]')!);
  el.addEventListener('lr-change-request', () => {
    el.value = 'de';
    // The host deliberately transfers focus synchronously inside its request handler.
    other.focus();
  });
  await sendKeys({ press: 'Enter' });
  await el.updateComplete;
  expect(document.activeElement?.id).to.equal(other.id);
  expect(el.value).to.equal('de');
});
