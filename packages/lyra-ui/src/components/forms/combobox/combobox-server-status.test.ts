import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-combobox.js';
import type { LyraCombobox, ComboboxSource } from '../../lr-combobox.js';
import { LYRA_DEFAULT_noMatches } from '../../../internal/default-strings/shared.generated.js';

type OptionsRequest = { query: string; signal: AbortSignal };

const rowTexts = (el: LyraCombobox): string[] =>
  Array.from(el.shadowRoot!.querySelectorAll('[part~="option"]'), node => (node.textContent ?? '').trim());

const statusPart = (el: LyraCombobox): string | null =>
  el.shadowRoot!.querySelector('[part~="status"]')?.getAttribute('part') ?? null;

const arrowDown = (el: LyraCombobox): void => {
  el.shadowRoot!.querySelector('[part="combobox-input"]')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
  );
};

const replaceOptions = (el: LyraCombobox, labels: readonly string[]): void => {
  el.replaceChildren(
    ...labels.map(label => {
      const option = document.createElement('lr-option');
      option.setAttribute('value', label.toLowerCase());
      option.textContent = label;
      return option;
    })
  );
};

describe('lr-combobox server mode', () => {
  it('announces requests, sets loading, and skips client-side filtering', async () => {
    const requests: OptionsRequest[] = [];
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox server filter-debounce="0">
        <lr-option value="apple">Apple</lr-option>
        <lr-option value="banana">Banana</lr-option>
      </lr-combobox>
    `);
    expect(el.server).to.equal(true);
    expect(el.hasAttribute('server')).to.equal(true);
    el.addEventListener('lr-options-request', event => requests.push(event.detail));
    el.filter = () => false;
    el.open = true;
    await waitUntil(() => requests.length === 1, 'opening requests at once');
    expect(requests[0]!.query).to.equal('');
    expect(el.loading, 'a scheduled request sets loading').to.equal(true);
    el.loading = false;
    await el.updateComplete;
    expect(rowTexts(el), 'the filter is ignored').to.deep.equal(['Apple', 'Banana']);

    el.inputValue = 'zz';
    await waitUntil(() => requests.length === 2, 'typing requests after the debounce');
    expect(requests[1]!.query).to.equal('zz');
    expect(requests[0]!.signal.aborted, 'the newer request supersedes the first').to.equal(true);
    expect(rowTexts(el), 'no client-side match is applied').to.deep.equal(['Apple', 'Banana']);
    replaceOptions(el, ['Zucchini']);
    el.loading = false;
    await waitUntil(() => rowTexts(el).join() === 'Zucchini', 'the host answer renders');
  });

  it('keeps shown options and the in-field spinner while a request is pending', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox server filter-debounce="0">
        <lr-option value="apple">Apple</lr-option>
      </lr-combobox>
    `);
    el.open = true;
    await waitUntil(() => el.loading, 'the open request is pending');
    await el.updateComplete;
    expect(rowTexts(el)).to.deep.equal(['Apple']);
    expect(el.shadowRoot!.querySelector('[part~="loading"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="spinner"]') !== null).to.equal(true);
    expect(el.matches(':state(loading)')).to.equal(true);
    expect(el.matches(':state(showing-loading-row)')).to.equal(false);

    el.replaceChildren();
    await waitUntil(() => statusPart(el) === 'status loading', 'with no options the loading row shows');
    expect(el.shadowRoot!.querySelector('[part="spinner"]') === null).to.equal(true);
    expect(el.matches(':state(showing-loading-row)')).to.equal(true);
    el.loading = false;
    await el.updateComplete;
    expect(el.matches(':state(loading)')).to.equal(false);
    expect(el.matches(':state(showing-loading-row)')).to.equal(false);
  });

  it('keeps a rendered option keyboard-selectable while the server request is pending', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox server filter-debounce="0" open commit="text">
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>`);
    await waitUntil(() => el.loading && rowTexts(el).join() === 'Alpha', 'server mode retains a rendered option');
    arrowDown(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
    const active = el.shadowRoot!.getElementById(input.getAttribute('aria-activedescendant') ?? '');
    expect(active?.textContent?.trim()).to.equal('Alpha');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('Alpha');
  });

  it('re-requests on reload() and does nothing when server is unset', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox filter-debounce="0" open></lr-combobox>`);
    let count = 0;
    el.addEventListener('lr-options-request', () => count++);
    el.reload();
    el.inputValue = 'x';
    // wait-reason: asserting a plain combobox never announces requests (negative assertion)
    await aTimeout(30);
    expect(count).to.equal(0);
    expect(el.loading).to.equal(false);
    el.server = true;
    await el.updateComplete;
    el.reload();
    await waitUntil(() => count === 1, 'reload announces a request');
  });

  it('lets a source provider take precedence over the flag', async () => {
    const queries: string[] = [];
    const source: ComboboxSource = async query => {
      queries.push(query);
      return [{ value: 'r', label: 'Remote' }];
    };
    const el = await fixture<LyraCombobox>(html`<lr-combobox server source-delay="0" open .source=${source}></lr-combobox>`);
    await waitUntil(() => rowTexts(el).join() === 'Remote', 'the source answers');
    expect(queries.length).to.equal(1);
    expect(el.loading).to.equal(false);
  });
});

describe('lr-combobox currentOption', () => {
  it('tracks the keyboard-active option and clears when it goes away', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox>
        <lr-option value="a">Alpha</lr-option>
        <lr-option value="b">Beta</lr-option>
      </lr-combobox>
    `);
    expect(el.currentOption === undefined).to.equal(true);
    el.open = true;
    await el.updateComplete;
    arrowDown(el);
    await el.updateComplete;
    arrowDown(el);
    await el.updateComplete;
    const [alpha, beta] = Array.from(el.querySelectorAll('lr-option'));
    expect(el.currentOption === beta).to.equal(true);
    beta!.remove();
    await waitUntil(() => el.currentOption !== beta, 'a removed option is no longer current');
    expect(el.currentOption === undefined || el.currentOption === alpha).to.equal(true);
    el.open = false;
    await el.updateComplete;
    expect(el.currentOption === undefined).to.equal(true);
  });

  it('moves the highlight when assigned, without selecting', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox open>
        <lr-option value="a">Alpha</lr-option>
        <lr-option value="b">Beta</lr-option>
      </lr-combobox>
    `);
    await el.updateComplete;
    const beta = el.querySelectorAll('lr-option')[1]!;
    let changes = 0;
    el.addEventListener('change', () => changes++);
    el.currentOption = beta;
    await el.updateComplete;
    expect(el.currentOption === beta).to.equal(true);
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]')!;
    const active = el.shadowRoot!.getElementById(input.getAttribute('aria-activedescendant')!);
    expect(active?.textContent?.trim()).to.equal('Beta');
    expect(el.value).to.equal('');
    el.currentOption = undefined;
    await el.updateComplete;
    expect(el.currentOption === undefined).to.equal(true);
    expect(input.hasAttribute('aria-activedescendant')).to.equal(false);
    expect(changes).to.equal(0);
  });

  it('is undefined for async rows with no option element behind them', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    el.source = async () => [{ value: 'r', label: 'Remote' }];
    await waitUntil(() => rowTexts(el).length === 1, 'the row renders');
    arrowDown(el);
    await el.updateComplete;
    expect(el.currentOption === undefined).to.equal(true);
  });
});

describe('lr-combobox status slots and parts', () => {
  it('names the empty, no-results and loading rows and renders their slots', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox open>
        <span slot="empty">Nothing yet</span>
        <span slot="no-results">No fruit like that</span>
        <span slot="loading">Fetching fruit</span>
      </lr-combobox>
    `);
    await el.updateComplete;
    expect(statusPart(el)).to.equal('status empty');
    const assigned = (name: string) =>
      el.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${name}"]`)?.assignedNodes().length ?? 0;
    expect(assigned('empty')).to.equal(1);
    el.inputValue = 'kiwi';
    await el.updateComplete;
    expect(statusPart(el)).to.equal('status no-results');
    expect(assigned('no-results')).to.equal(1);
    el.loading = true;
    await el.updateComplete;
    expect(statusPart(el)).to.equal('status loading');
    expect(assigned('loading')).to.equal(1);
    await expect(el).to.be.accessible();
  });

  it('falls back to the localized copy and the text overrides without slotted content', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox open></lr-combobox>`);
    await el.updateComplete;
    const fallback = el.shadowRoot!.querySelector('[part~="empty"]')!.textContent!.trim();
    expect(fallback).to.equal(LYRA_DEFAULT_noMatches);
    el.emptyText = 'Custom';
    el.inputValue = 'x';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="no-results"]')!.textContent!.trim()).to.equal('Custom');
  });

  it('shows the source loading row as the loading part and state', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    el.source = () => new Promise(() => {});
    await waitUntil(() => statusPart(el) === 'status loading', 'the loading row renders');
    expect(el.matches(':state(loading)')).to.equal(true);
    expect(el.matches(':state(showing-loading-row)')).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="spinner"]') === null).to.equal(true);
  });

  it('carries the tag__remove-button__button alias on the remove button', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox multiple>
        <lr-option value="a" selected>Alpha</lr-option>
      </lr-combobox>
    `);
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part~="tag__remove-button__button"]');
    expect(button?.localName).to.equal('button');
    expect(button!.getAttribute('part')!.split(' ')).to.include('tag__remove-button');
  });
});
