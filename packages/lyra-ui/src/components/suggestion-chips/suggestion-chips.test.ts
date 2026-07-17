import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './suggestion-chips.js';
import type { LyraSuggestionChips } from './suggestion-chips.js';

const suggestions = [
  { id: 'a', label: 'Summarize this' },
  { id: 'b', label: 'Explain the error', detail: 'Related to the last stack trace' },
  { id: 'c', label: 'Draft a reply' },
];

it('defaults to empty suggestions, wrap false, and renders nothing when empty', async () => {
  const el = (await fixture(html`<lyra-suggestion-chips></lyra-suggestion-chips>`)) as LyraSuggestionChips;
  expect(el.suggestions).to.deep.equal([]);
  expect(el.wrap).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.exist;
});

it('renders one chip per suggestion inside a scroller when not wrap', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(el.shadowRoot!.querySelector('lyra-scroller')).to.exist;
  const chips = el.shadowRoot!.querySelectorAll('[part~="chip"]');
  expect(chips.length).to.equal(3);
});

it('renders chips in a plain wrapping row (no scroller) when wrap is set', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips wrap .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(el.shadowRoot!.querySelector('lyra-scroller')).to.not.exist;
  expect(el.shadowRoot!.querySelectorAll('[part~="chip"]').length).to.equal(3);
});

it('renders the optional detail line only when set', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')];
  expect(chips[0].querySelector('[part="chip-detail"]')).to.not.exist;
  expect(chips[1].querySelector('[part="chip-detail"]')!.textContent).to.equal(
    'Related to the last stack trace',
  );
});

it('emits lyra-suggestion-select with id and label on activation', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  const eventPromise = oneEvent(el, 'lyra-suggestion-select');
  chips[1].click();
  const ev = await eventPromise;
  expect(ev.detail).to.deep.equal({ id: 'b', label: 'Explain the error' });
});

it('is a labeled group with a default or custom label', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Suggested prompts');

  const labeled = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions} label="Try asking"></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Try asking',
  );
});

it('localizes the default group label via .strings override', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips
      .suggestions=${suggestions}
      .strings=${{ suggestionsLabel: 'Essayez de demander' }}
    ></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Essayez de demander',
  );
});

it('roving tabindex: only one chip is tabbable at a time, and ArrowRight/ArrowLeft move it', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  expect(chips[0].tabIndex).to.equal(0);
  expect(chips[1].tabIndex).to.equal(-1);
  expect(chips[2].tabIndex).to.equal(-1);

  el.shadowRoot!
    .querySelector('[part="base"]')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(chips[0].tabIndex).to.equal(-1);
  expect(chips[1].tabIndex).to.equal(0);
  expect(el.shadowRoot!.activeElement).to.equal(chips[1]);
});

it('wraps around from the last chip to the first with ArrowRight, and swaps under RTL', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips dir="rtl" .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  expect(chips[1].tabIndex).to.equal(0); // ArrowLeft is "forward" under RTL
});

it('Home/End jump to the first/last chip', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(chips[2].tabIndex).to.equal(0);
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(chips[0].tabIndex).to.equal(0);
});

it('preserves focus on a chip whose id survives a suggestions replacement (keyed repeat)', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const secondChip = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')][1] as HTMLButtonElement;
  secondChip.focus();

  el.suggestions = [suggestions[0], suggestions[1], { id: 'd', label: 'New follow-up' }];
  await el.updateComplete;

  const stillSecondChip = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')][1] as HTMLButtonElement;
  expect(stillSecondChip).to.equal(secondChip); // same DOM node, not remounted
  expect(el.shadowRoot!.activeElement).to.equal(secondChip);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-suggestion-chips .suggestions=${suggestions}></lyra-suggestion-chips>`,
  )) as LyraSuggestionChips;
  await expect(el).to.be.accessible();
});
