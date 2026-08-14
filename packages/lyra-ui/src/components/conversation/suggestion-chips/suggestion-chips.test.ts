import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './suggestion-chips.js';
import type { LyraSuggestionChips } from './suggestion-chips.js';
import { styles } from './suggestion-chips.styles.js';

const suggestions = [
  { suggestionId: 'a', label: 'Summarize this' },
  { suggestionId: 'b', label: 'Explain the error', detail: 'Related to the last stack trace' },
  { suggestionId: 'c', label: 'Draft a reply' },
];

it('defaults to empty suggestions, wrap false, and renders nothing when empty', async () => {
  const el = (await fixture(html`<lr-suggestion-chips></lr-suggestion-chips>`)) as LyraSuggestionChips;
  expect(el.suggestions).to.deep.equal([]);
  expect(el.wrap).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="base"]')) == null).to.be.true;
});

it('renders one chip per suggestion inside a scroller when not wrap', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(el.shadowRoot!.querySelector('lr-scroller')).to.exist;
  const chips = el.shadowRoot!.querySelectorAll('[part~="chip"]');
  expect(chips.length).to.equal(3);
});

it('renders chips in a plain wrapping row (no scroller) when wrap is set', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips wrap .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect((el.shadowRoot!.querySelector('lr-scroller')) == null).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part~="chip"]').length).to.equal(3);
});

it('renders the optional detail line only when set', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')];
  expect((chips[0].querySelector('[part="chip-detail"]')) == null).to.be.true;
  expect(chips[1].querySelector('[part="chip-detail"]')!.textContent).to.equal(
    'Related to the last stack trace',
  );
});

it('renders an optional literal icon as decorative content without changing chip focus ownership', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips
      .suggestions=${[
        { suggestionId: 'icon', label: 'Investigate', icon: '🔎' },
        { suggestionId: 'plain', label: 'Summarize' },
      ]}
    ></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
  const icons = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="chip-icon"]');

  expect(icons.length).to.equal(1);
  expect(icons[0]!.textContent).to.equal('🔎');
  expect(icons[0]!.getAttribute('aria-hidden')).to.equal('true');
  chips[0]!.focus();
  expect(el.shadowRoot!.activeElement?.dataset['suggestionId']).to.equal('icon');
  await expect(el).to.be.accessible();
});

it('emits lr-suggestion-select with suggestionId and label on activation', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  const eventPromise = oneEvent(el, 'lr-suggestion-select');
  chips[1].click();
  const ev = await eventPromise;
  expect(ev.detail).to.deep.equal({ suggestionId: 'b', label: 'Explain the error' });
});

it('requires unique nonempty suggestionId values with deterministic first-wins rendering', async () => {
  const el = (await fixture(html`
    <lr-suggestion-chips
      .suggestions=${[
        { suggestionId: '', label: 'Invalid empty' },
        { suggestionId: 'same', label: 'First occurrence' },
        { suggestionId: 'same', label: 'Later duplicate' },
        { suggestionId: 'other', label: 'Other' },
      ]}
    ></lr-suggestion-chips>
  `)) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
  expect(chips.map((chip) => chip.dataset['suggestionId'])).to.deep.equal(['same', 'other']);
  expect(chips.map((chip) => chip.textContent?.trim())).to.deep.equal(['First occurrence', 'Other']);

  const selected = oneEvent(el, 'lr-suggestion-select');
  chips[0]!.click();
  expect((await selected).detail).to.deep.equal({ suggestionId: 'same', label: 'First occurrence' });
});

it('is a labeled group with a default or custom label', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Suggested prompts');

  const labeled = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions} label="Try asking"></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Try asking',
  );
});

it('preserves an explicitly empty host aria-label', async () => {
  const el = (await fixture(html`
    <lr-suggestion-chips aria-label="" .suggestions=${suggestions}></lr-suggestion-chips>
  `)) as LyraSuggestionChips;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});

it('localizes the default group label via .strings override', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips
      .suggestions=${suggestions}
      .strings=${{ suggestionsLabel: 'Essayez de demander' }}
    ></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Essayez de demander',
  );
});

it('roving tabindex: only one chip is tabbable at a time, and ArrowRight/ArrowLeft move it', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
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
  expect((el.shadowRoot!.activeElement) === (chips[1])).to.equal(true);
});

it('wraps around from the last chip to the first with ArrowRight, and swaps under RTL', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips dir="rtl" .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  expect(chips[1].tabIndex).to.equal(0); // ArrowLeft is "forward" under RTL
});

it('Home/End jump to the first/last chip', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
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
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const secondChip = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')][1] as HTMLButtonElement;
  secondChip.focus();

  el.suggestions = [suggestions[0], suggestions[1], { suggestionId: 'd', label: 'New follow-up' }];
  await el.updateComplete;

  const stillSecondChip = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')][1] as HTMLButtonElement;
  expect((stillSecondChip) === (secondChip)).to.equal(true); // same DOM node, not remounted
  expect((el.shadowRoot!.activeElement) === (secondChip)).to.equal(true);
});

it('keeps active identity through reorder and transfers focus when that chip is removed', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = () =>
    [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
  chips()[1]!.focus();

  el.suggestions = [suggestions[2]!, suggestions[1]!, suggestions[0]!];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-suggestion-id') === 'b');
  expect(el.shadowRoot!.activeElement?.dataset['suggestionId']).to.equal('b');
  expect(chips().find((chip) => chip.dataset['suggestionId'] === 'b')?.tabIndex).to.equal(0);

  el.suggestions = [suggestions[2]!, suggestions[0]!];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-suggestion-id') === 'a');
  expect(el.shadowRoot!.activeElement?.dataset['suggestionId']).to.equal('a');
  expect(chips().filter((chip) => chip.tabIndex === 0)).to.have.length(1);
});

it('preserves focused suggestion identity when wrap swaps the layout branch in either direction', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const focusedId = (): string | undefined =>
    (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['suggestionId'];
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-suggestion-id="b"]')!.focus();

  el.wrap = true;
  await el.updateComplete;
  await waitUntil(() => focusedId() === 'b');
  expect(focusedId()).to.equal('b');

  el.wrap = false;
  await el.updateComplete;
  await waitUntil(() => focusedId() === 'b');
  expect(focusedId()).to.equal('b');
});

it('does not steal a newer external focus destination while the layout branch changes', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside-suggestions">Outside</button>
      <lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>
    </div>
  `);
  const el = wrapper.querySelector('lr-suggestion-chips') as LyraSuggestionChips;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-suggestion-id="b"]')!.focus();

  el.wrap = true;
  wrapper.querySelector<HTMLButtonElement>('#outside-suggestions')!.focus();
  await el.updateComplete;

  expect(el.ownerDocument.activeElement?.id).to.equal('outside-suggestions');
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  await expect(el).to.be.accessible();
});

describe('part="row" / --lr-suggestion-chips-justify', () => {
  const row = (el: LyraSuggestionChips) => el.shadowRoot!.querySelector<HTMLElement>('[part~="row"]');

  it('exposes the chip row as a part in the wrapping branch', async () => {
    const el = (await fixture(
      html`<lr-suggestion-chips wrap .suggestions=${suggestions}></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    expect(el.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(1);
  });

  it('exposes the chip row as a part in the scroller branch too', async () => {
    const el = (await fixture(
      html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    // The row lives inside <lr-scroller> here, but still in this component's own shadow root.
    expect(el.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(1);
  });

  it('packs chips to the start when the property is unset (unset regression, both branches)', async () => {
    for (const wrap of [false, true]) {
      const el = (await fixture(
        html`<lr-suggestion-chips ?wrap=${wrap} .suggestions=${suggestions}></lr-suggestion-chips>`,
      )) as LyraSuggestionChips;
      expect(getComputedStyle(row(el)!).justifyContent, `wrap=${wrap}`).to.equal('flex-start');
    }
  });

  it('centers the chip lines when --lr-suggestion-chips-justify is set', async () => {
    const el = (await fixture(
      html`<lr-suggestion-chips
        wrap
        style="--lr-suggestion-chips-justify: center;"
        .suggestions=${suggestions}
      ></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    expect(getComputedStyle(row(el)!).justifyContent).to.equal('center');
  });

  it('centers the wrapped final line, not just a single unwrapped line', async () => {
    // The reported defect: ::part(base) centering only worked while the chips fit one line. Force a
    // wrap with a narrow host and assert the LAST line's chip is inset from the row's start edge.
    const many = Array.from({ length: 6 }, (_, i) => ({ suggestionId: `s${i}`, label: `Suggestion ${i}` }));
    const el = (await fixture(
      html`<lr-suggestion-chips
        wrap
        style="inline-size: 22rem; --lr-suggestion-chips-justify: center;"
        .suggestions=${many}
      ></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    const chips = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="chip"]')];
    const rowBox = row(el)!.getBoundingClientRect();
    const lastTop = chips.at(-1)!.getBoundingClientRect().top;
    const lastLine = chips.filter((chip) => chip.getBoundingClientRect().top === lastTop);
    expect(lastLine.length, 'fixture must actually wrap').to.be.lessThan(chips.length);
    const lastLineStart = Math.min(...lastLine.map((chip) => chip.getBoundingClientRect().left));
    expect(lastLineStart).to.be.greaterThan(rowBox.left + 1);
  });
});

describe('--lr-suggestion-chips-hover-bg / -hover-border', () => {
  it('reads the hover background/border through per-component cssprops, not just the bare shared brand tokens (regression)', () => {
    // Real :hover can't be forced from test JS without an actual pointer move, so this asserts
    // the declaration's indirection layer directly -- same convention as the sibling
    // --lr-env-list-reveal-active-bg/-border fix's own stylesheet-source check.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /\[part~='chip'\]:hover\s*\{[^}]*background:\s*var\(--lr-suggestion-chips-hover-bg,\s*var\(--lr-color-brand-quiet\)\)/,
    );
    expect(css).to.match(
      /\[part~='chip'\]:hover\s*\{[^}]*border-color:\s*var\(--lr-suggestion-chips-hover-border,\s*var\(--lr-color-brand\)\)/,
    );
  });
});
