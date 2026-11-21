import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-suggestion-chips.js';
import type { LyraSuggestionChips } from '../../lr-suggestion-chips.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { alignmentKeyword } from '../../../../test/computed-alignment.js';

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

it('resets pending focus repair when the custom element is adopted', async () => {
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>
  `);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-suggestion-id="b"]')!.focus();
  el.suggestions = [suggestions[1]!, suggestions[0]!];
  el.adoptedCallback();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part~="chip"]')).to.have.length(2);
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
  expect((chips[0]!.querySelector('[part="chip-detail"]')) == null).to.be.true;
  expect(chips[1]!.querySelector('[part="chip-detail"]')!.textContent).to.equal(
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
  expect(el.shadowRoot!.activeElement?.getAttribute('data-suggestion-id')).to.equal('icon');
  await expect(el).to.be.accessible();
});

it('renders literal icon markup as text, never as parsed markup', async () => {
  const markup = '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>';
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips .suggestions=${[{ suggestionId: 'a', label: 'A', icon: markup }]}></lr-suggestion-chips>
  `);
  const icon = el.shadowRoot!.querySelector<HTMLElement>('[part="chip-icon"]')!;
  expect(icon.querySelectorAll('svg')).to.have.length(0);
  expect(icon.textContent).to.equal(markup);
});

it('renders iconName as a decorative lr-icon that wins over the literal icon', async () => {
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips
      .suggestions=${[
        { suggestionId: 'a', label: 'Search', iconName: 'search', icon: '🔎' },
        { suggestionId: 'b', label: 'Library', iconName: 'star', iconLibrary: 'custom' },
        { suggestionId: 'c', label: 'Blank', iconName: '  ' },
      ]}
    ></lr-suggestion-chips>
  `);
  const chips = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
  const first = chips[0]!.querySelector('[part="chip-icon"]')!;
  expect(first.getAttribute('aria-hidden')).to.equal('true');
  const icon = first.querySelector('lr-icon')!;
  expect(icon.getAttribute('name')).to.equal('search');
  expect(icon.getAttribute('library')).to.equal('default');
  expect(first.textContent).to.not.include('🔎');
  expect(chips[1]!.querySelector('lr-icon')!.getAttribute('library')).to.equal('custom');
  expect(chips[2]!.querySelectorAll('[part="chip-icon"]')).to.have.length(0);
  expect(chips[0]!.textContent!.trim()).to.equal('Search');
  await expect(el).to.be.accessible();
});

it('projects a per-suggestion icon-<suggestionId> slot that wins over iconName and icon', async () => {
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips
      .suggestions=${[
        { suggestionId: 'a', label: 'Alpha', iconName: 'search' },
        { suggestionId: 'b', label: 'Beta' },
        { suggestionId: 'c', label: 'Gamma' },
      ]}
    >
      <svg slot="icon-a" id="svg-a" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"></circle></svg>
      <svg slot="icon-b" id="svg-b" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"></circle></svg>
    </lr-suggestion-chips>
  `);
  await el.updateComplete;
  const chipFor = (id: string): HTMLButtonElement =>
    el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-suggestion-id="${id}"]`)!;
  const assigned = (id: string): string[] => {
    const slot = chipFor(id).querySelector<HTMLSlotElement>(`slot[name="icon-${id}"]`);
    return slot ? slot.assignedElements().map((node) => node.id) : [];
  };
  expect(assigned('a')).to.deep.equal(['svg-a']);
  expect(assigned('b')).to.deep.equal(['svg-b']);
  expect(chipFor('a').querySelector('[part="chip-icon"]')!.getAttribute('aria-hidden')).to.equal('true');
  expect(chipFor('c').querySelectorAll('[part="chip-icon"]')).to.have.length(0);
  const box = el.querySelector('#svg-a')!.getBoundingClientRect();
  const fontSize = parseFloat(getComputedStyle(chipFor('a')).fontSize);
  expect(Math.round(box.width)).to.equal(Math.round(fontSize));

  // A slotted icon added later appears; removing one drops the wrapper when nothing else applies.
  const late = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  late.setAttribute('slot', 'icon-c');
  late.id = 'svg-c';
  el.append(late);
  await waitUntil(() => assigned('c').length === 1, 'late slotted icon was not projected');
  el.querySelector('#svg-b')!.remove();
  await waitUntil(() => chipFor('b').querySelectorAll('[part="chip-icon"]').length === 0, 'empty icon wrapper remained');
  // The fallback iconName returns when the slotted icon is removed.
  el.querySelector('#svg-a')!.remove();
  await waitUntil(() => chipFor('a').querySelector('lr-icon') !== null, 'iconName fallback did not return');
  await expect(el).to.be.accessible();
});

it('emits lr-suggestion-select with suggestionId and label on activation', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  const eventPromise = oneEvent(el, 'lr-suggestion-select');
  chips[1]!.click();
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

it('drops suggestions with empty or whitespace-only labels while retaining an accessible valid chip', async () => {
  const el = (await fixture(html`
    <lr-suggestion-chips
      .suggestions=${[
        { suggestionId: 'empty', label: '' },
        { suggestionId: 'blank', label: '   ' },
        { suggestionId: 'valid', label: 'Real suggestion' },
      ]}
    ></lr-suggestion-chips>
  `)) as LyraSuggestionChips;

  const chips = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="chip"]')];
  expect(chips.length).to.equal(1);
  expect(chips[0]!.textContent?.trim()).to.equal('Real suggestion');
  await expect(el).to.be.accessible();
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

it('distinguishes an omitted label property from an explicit empty override', async () => {
  const omitted = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(omitted.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Suggested prompts',
  );

  const explicitEmpty = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions} label=""></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  expect(explicitEmpty.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    '',
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
  expect(chips[0]!.tabIndex).to.equal(0);
  expect(chips[1]!.tabIndex).to.equal(-1);
  expect(chips[2]!.tabIndex).to.equal(-1);

  el.shadowRoot!
    .querySelector('[part="base"]')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(chips[0]!.tabIndex).to.equal(-1);
  expect(chips[1]!.tabIndex).to.equal(0);
  expect((el.shadowRoot!.activeElement) === (chips[1])).to.equal(true);
});

it('keeps exactly one tab stop when the roving index is not a finite number', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const roving = el as unknown as { activeIndex: number };
  const stops = () => [...el.shadowRoot!.querySelectorAll('[part~="chip"]')]
    .map((chip) => (chip as HTMLButtonElement).tabIndex);
  for (const [index, expected] of [[NaN, 0], [Infinity, 2], [-Infinity, 0]] as const) {
    roving.activeIndex = index;
    await el.updateComplete;
    expect(stops().join(','), `activeIndex ${index}`).to.equal(stops().map((_, at) => (at === expected ? 0 : -1)).join(','));
  }
});

it('wraps around from the last chip to the first with ArrowRight, and swaps under RTL', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips dir="rtl" .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  expect(chips[1]!.tabIndex).to.equal(0); // ArrowLeft is "forward" under RTL
});

it('Home/End jump to the first/last chip', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(chips[2]!.tabIndex).to.equal(0);
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(chips[0]!.tabIndex).to.equal(0);
});

it('preserves focus on a chip whose id survives a suggestions replacement (keyed repeat)', async () => {
  const el = (await fixture(
    html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`,
  )) as LyraSuggestionChips;
  const secondChip = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')][1] as HTMLButtonElement;
  secondChip.focus();

  el.suggestions = [suggestions[0]!, suggestions[1]!, { suggestionId: 'd', label: 'New follow-up' }];
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
  expect(el.shadowRoot!.activeElement?.getAttribute('data-suggestion-id')).to.equal('b');
  expect(chips().find((chip) => chip.dataset['suggestionId'] === 'b')?.tabIndex).to.equal(0);

  el.suggestions = [suggestions[2]!, suggestions[0]!];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-suggestion-id') === 'a');
  expect(el.shadowRoot!.activeElement?.getAttribute('data-suggestion-id')).to.equal('a');
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

describe('disabled suggestions', () => {
  const withDisabled = [
    { suggestionId: 'a', label: 'Summarize this' },
    { suggestionId: 'b', label: 'Explain the error', disabled: true },
    { suggestionId: 'c', label: 'Draft a reply' },
  ];

  it('renders a genuinely disabled chip and leaves an ordinary one unset (unset-regression)', async () => {
    const el = (await fixture(
      html`<lr-suggestion-chips .suggestions=${withDisabled}></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
    expect(chips[0]!.disabled, 'an ordinary chip is not disabled').to.equal(false);
    expect(chips[1]!.disabled).to.equal(true);
    expect(chips[2]!.disabled).to.equal(false);
  });

  it('a click on a disabled chip emits no lr-suggestion-select', async () => {
    const el = (await fixture(
      html`<lr-suggestion-chips .suggestions=${withDisabled}></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    let fired = false;
    el.addEventListener('lr-suggestion-select', () => (fired = true));
    const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
    chips[1]!.click();
    expect(fired).to.equal(false);
  });

  it('starts the roving tab stop on the first enabled chip when the first chip is disabled', async () => {
    const leadingDisabled = [
      { suggestionId: 'a', label: 'Summarize this', disabled: true },
      { suggestionId: 'b', label: 'Explain the error' },
      { suggestionId: 'c', label: 'Draft a reply' },
    ];
    const el = (await fixture(
      html`<lr-suggestion-chips .suggestions=${leadingDisabled}></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
    expect(chips[0]!.tabIndex, 'a disabled chip is never the resting tab stop').to.equal(-1);
    expect(chips[1]!.tabIndex).to.equal(0);
  });

  it('ArrowRight steps over a disabled chip instead of landing on it, and Home/End skip it too', async () => {
    const el = (await fixture(
      html`<lr-suggestion-chips .suggestions=${withDisabled}></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(chips[2]!.tabIndex, 'skips disabled b straight to c').to.equal(0);

    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(chips[0]!.tabIndex, 'wraps back to a, skipping disabled b').to.equal(0);

    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(chips[2]!.tabIndex, 'End lands on the last enabled chip').to.equal(0);
  });

  it('never invokes an accessor-backed suggestion disabled, and never treats it as disabled', async () => {
    const el = (await fixture(html`<lr-suggestion-chips></lr-suggestion-chips>`)) as LyraSuggestionChips;
    let reads = 0;
    const hostile: Record<string, unknown> = { suggestionId: 'b', label: 'Beta' };
    Object.defineProperty(hostile, 'disabled', {
      get() {
        reads += 1;
        return true;
      },
      enumerable: true,
      configurable: true,
    });
    el.suggestions = [{ suggestionId: 'a', label: 'Alpha' }, hostile] as unknown as LyraSuggestionChips['suggestions'];
    await el.updateComplete;

    expect(reads, 'the getter is never invoked').to.equal(0);
    const chips = [...el.shadowRoot!.querySelectorAll('[part~="chip"]')] as HTMLButtonElement[];
    expect(
      chips.map((chip) => chip.disabled),
      'the entry survives as an ordinary, non-disabled chip',
    ).to.deep.equal([false, false]);
  });

  it('is accessible with a mix of enabled and disabled chips', async () => {
    const el = (await fixture(
      html`<lr-suggestion-chips .suggestions=${withDisabled}></lr-suggestion-chips>`,
    )) as LyraSuggestionChips;
    await expect(el).to.be.accessible();
  });
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
      expect(alignmentKeyword(getComputedStyle(row(el)!).justifyContent), `wrap=${wrap}`).to.equal('flex-start');
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
  it('renders the hover background/border through the per-component cssprops', async () => {
    const el = await fixture<LyraSuggestionChips>(html`
      <lr-suggestion-chips
        style="--lr-suggestion-chips-hover-bg: rgb(1, 2, 3); --lr-suggestion-chips-hover-border-color: rgb(4, 5, 6)"
        .suggestions=${suggestions}
      ></lr-suggestion-chips>
    `);
    const chip = el.shadowRoot!.querySelector<HTMLElement>('[part~="chip"]')!;
    chip.scrollIntoView({ block: 'center' });
    const rect = chip.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => {
        const computed = getComputedStyle(chip);
        return computed.backgroundColor === 'rgb(1, 2, 3)' && computed.borderTopColor === 'rgb(4, 5, 6)';
      }, 'the suggestion chip hover cssprops never reached the rendered chip');
    } finally {
      await resetMouse();
    }
  });
});

it('keeps its internal scroller events inside the component', async () => {
  const wrapper = await fixture(html`<div><lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips></div>`);
  const el = wrapper.querySelector('lr-suggestion-chips') as LyraSuggestionChips;
  let leaked = 0;
  wrapper.addEventListener('lr-scroll', () => leaked++);
  el.shadowRoot!.querySelector('lr-scroller')!.dispatchEvent(
    new CustomEvent('lr-scroll', { bubbles: true, composed: true, detail: {} }),
  );
  expect(leaked).to.equal(0);
});

it('dims a disabled chip with the theme disabled opacity', async () => {
  const el = await fixture<LyraSuggestionChips>(html`<lr-suggestion-chips data-lr-theme-scope
    style="--lr-theme-opacity-disabled: 0.38"
    .suggestions=${[{ suggestionId: 'a', label: 'A', disabled: true }]}
  ></lr-suggestion-chips>`);
  const chip = el.shadowRoot!.querySelector<HTMLElement>('[part~="chip"]')!;
  expect(getComputedStyle(chip).opacity).to.equal('0.38');
  expect(getComputedStyle(chip).cursor).to.equal('not-allowed');
});


it('retains later valid suggestions when an immutable platform row has a throwing identity getter', async () => {
  let reads = 0;
  const malformed = Object.defineProperty(new Blob(['opaque suggestion']), 'suggestionId', {
    get() { reads += 1; throw new Error('identity is unavailable'); },
  });
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips .suggestions=${[malformed, { suggestionId: 'safe', label: 'Safe suggestion' }]}></lr-suggestion-chips>
  `);
  expect(reads).to.be.greaterThan(0);
  expect([...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="chip"]')].map((chip) => chip.dataset['suggestionId'])).to.deep.equal(['safe']);
  const pending = oneEvent(el, 'lr-suggestion-select');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="chip"]')!.click();
  expect((await pending).detail).to.deep.equal({ suggestionId: 'safe', label: 'Safe suggestion' });
});

it('moves the resting tab stop backward when the active suggestion and its successors become disabled', async () => {
  const el = await fixture<LyraSuggestionChips>(html`<lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>`);
  const last = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-suggestion-id="c"]')!;
  await focusByKeyboard(last);
  await el.updateComplete;
  expect(last.tabIndex).to.equal(0);
  el.suggestions = [suggestions[0]!, { ...suggestions[1]!, disabled: true }, { ...suggestions[2]!, disabled: true }];
  await el.updateComplete;
  const chips = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
  expect(chips.map((chip) => chip.tabIndex)).to.deep.equal([0, -1, -1]);
  expect(chips.map((chip) => chip.disabled)).to.deep.equal([false, true, true]);
});

it('consumes navigation keys when every suggestion is disabled without claiming ordinary keys or selecting a row', async () => {
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips .suggestions=${suggestions.map((suggestion) => ({ ...suggestion, disabled: true }))}></lr-suggestion-chips>
  `);
  let selections = 0;
  el.addEventListener('lr-suggestion-select', () => { selections += 1; });
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const chips = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab', 'Enter']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
    base.dispatchEvent(event);
    expect(event.defaultPrevented, key).to.equal(['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key));
  }
  expect(chips.map((chip) => chip.tabIndex)).to.deep.equal([-1, -1, -1]);
  expect(chips.every((chip) => chip.disabled)).to.equal(true);
  expect(selections).to.equal(0);
});

it("resolves a host aria-describedby onto its group owner", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <p id="host-hint">Help text</p>
    <lr-suggestion-chips aria-describedby="host-hint" .suggestions=${[{ suggestionId: "a", label: "A" }]}></lr-suggestion-chips>
  </div>`);
  const host = wrapper.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>("lr-suggestion-chips")!;
  await host.updateComplete;
  const owner = () => host.shadowRoot!.querySelector<HTMLElement & { ariaDescribedByElements?: readonly Element[] | null }>('[part="base"][role="group"]')!;
  const ids = (): string[] =>
    Reflect.has(owner(), "ariaDescribedByElements")
      ? Array.from(owner().ariaDescribedByElements ?? []).map((node) => node.id)
      : owner().getAttribute("aria-describedby")?.match(/\S+/g) ?? [];
  await waitUntil(() => ids().includes("host-hint"), "the host description reaches the role owner");
  host.removeAttribute("aria-describedby");
  await waitUntil(() => !ids().includes("host-hint"), "removing it clears the owner");
});

describe('multi-line labels / --lr-suggestion-chips-label-lines / -chip-max-inline-size', () => {
  const question =
    'How do I migrate the billing service to the new event bus without losing in-flight invoices?';
  const longSuggestions = [{ suggestionId: 'q', label: question }];
  const labelOf = (el: LyraSuggestionChips) =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="chip-label"]')!;
  const chipOf = (el: LyraSuggestionChips) =>
    el.shadowRoot!.querySelector<HTMLElement>('[part~="chip"]')!;
  const renderedLines = (label: HTMLElement) => {
    const style = getComputedStyle(label);
    return Math.round(label.getBoundingClientRect().height / Number.parseFloat(style.lineHeight));
  };
  const mount = async (wrap: boolean, style = '') => {
    const host = await fixture<HTMLDivElement>(html`
      <div style="inline-size: 24rem; line-height: 1.5;">
        <lr-suggestion-chips ?wrap=${wrap} style=${style} .suggestions=${longSuggestions}></lr-suggestion-chips>
      </div>
    `);
    const el = host.querySelector<LyraSuggestionChips>('lr-suggestion-chips')!;
    await el.updateComplete;
    return { host, el };
  };

  it('wraps a long label onto several lines inside a 24rem column when wrap is set', async () => {
    const { host, el } = await mount(true);
    const label = labelOf(el);
    expect(getComputedStyle(label).webkitLineClamp).to.equal('3');
    expect(renderedLines(label)).to.be.greaterThan(1);
    expect(renderedLines(label)).to.be.at.most(3);
    const chipBox = chipOf(el).getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    expect(chipBox.right).to.be.at.most(hostBox.right + 0.5);
    expect(chipBox.left).to.be.at.least(hostBox.left - 0.5);
  });

  it('keeps the scrolling row one line and capped at 16rem when wrap is unset (unset regression)', async () => {
    const { el } = await mount(false);
    const label = labelOf(el);
    expect(getComputedStyle(label).webkitLineClamp).to.equal('1');
    expect(renderedLines(label)).to.equal(1);
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(chipOf(el).getBoundingClientRect().width).to.be.closeTo(16 * rootFontSize, 1);
  });

  it('honors --lr-suggestion-chips-label-lines in both layouts', async () => {
    for (const wrap of [false, true]) {
      const { el } = await mount(wrap, '--lr-suggestion-chips-label-lines: 2;');
      const label = labelOf(el);
      expect(getComputedStyle(label).webkitLineClamp, `wrap=${wrap}`).to.equal('2');
      expect(renderedLines(label), `wrap=${wrap}`).to.equal(2);
    }
  });

  it('honors --lr-suggestion-chips-chip-max-inline-size and still never overflows a wrapping container', async () => {
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const narrow = await mount(true, '--lr-suggestion-chips-chip-max-inline-size: 10rem;');
    expect(chipOf(narrow.el).getBoundingClientRect().width).to.be.closeTo(10 * rootFontSize, 1);

    const wide = await mount(true, '--lr-suggestion-chips-chip-max-inline-size: 40rem;');
    const chipBox = chipOf(wide.el).getBoundingClientRect();
    expect(chipBox.width).to.be.closeTo(wide.host.getBoundingClientRect().width, 1);
    expect(renderedLines(labelOf(wide.el))).to.be.greaterThan(1);
  });
});

it('moves real focus to the roving stop when a surviving suggestion becomes disabled', async () => {
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips .suggestions=${suggestions}></lr-suggestion-chips>
  `);
  const before = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-suggestion-id="a"]')!;
  await focusByKeyboard(before);
  el.suggestions = [{ ...suggestions[0]!, disabled: true }, ...suggestions.slice(1)];
  await el.updateComplete;
  const after = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-suggestion-id="b"]')!;
  expect(before.disabled).to.equal(true);
  expect(after.tabIndex).to.equal(0);
  await waitUntil(() => el.shadowRoot!.activeElement === after, 'focus moved to the enabled chip');
});

it('wraps a single unbreakable label token instead of clipping it', async () => {
  const el = (await fixture(html`<lr-suggestion-chips style="inline-size:140px" .suggestions=${[{ suggestionId: 'a', label: 'ThisUnbrokenSuggestionLabelCannotWrapAtWordBoundaries' }]}></lr-suggestion-chips>`)) as HTMLElement;
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  const label = el.shadowRoot!.querySelector<HTMLElement>('[part="chip-label"]')!;
  expect(getComputedStyle(label).overflowWrap).to.equal('anywhere');
  expect(label.scrollWidth).to.be.at.most(label.clientWidth + 1);
});

it('keeps the keyboard focus ring inside the chip in its scrolling row', async () => {
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips style="--lr-focus-ring-offset: 6px" .suggestions=${suggestions}></lr-suggestion-chips>
  `);
  const chip = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="chip"]')!;
  await focusByKeyboard(chip);
  const style = getComputedStyle(chip);
  expect(style.outlineStyle).to.equal('solid');
  expect(parseFloat(style.outlineOffset)).to.be.at.most(-parseFloat(style.outlineWidth));
});

it('uses the localized group name for a whitespace-only label or host name', async () => {
  const el = await fixture<LyraSuggestionChips>(html`
    <lr-suggestion-chips label="  " .suggestions=${suggestions}></lr-suggestion-chips>
  `);
  const group = el.shadowRoot!.querySelector('[role="group"]')!;
  const name = group.getAttribute('aria-label');
  expect(name).to.equal('Suggested prompts');
  el.label = 'Starter prompts';
  el.setAttribute('aria-label', '   ');
  await el.updateComplete;
  expect(group.getAttribute('aria-label')).to.equal(name);
});

it('disables the entire row without losing individual suggestion availability', async () => {
  const el = await fixture<LyraSuggestionChips>(html`<lr-suggestion-chips .suggestions=${[
    { suggestionId: 'first', label: 'First' }, { suggestionId: 'second', label: 'Second', disabled: true },
  ]}></lr-suggestion-chips>`);
  const buttons = [...el.shadowRoot!.querySelectorAll('button')];
  let selections = 0;
  el.addEventListener('lr-suggestion-select', () => { selections++; });
  el.disabled = true;
  buttons[0]!.click();
  await el.updateComplete;
  expect(buttons.map(button => [button.disabled, button.tabIndex])).to.deep.equal([[true, -1], [true, -1]]);
  el.disabled = false;
  await el.updateComplete;
  expect(buttons.map(button => [button.disabled, button.tabIndex])).to.deep.equal([[false, 0], [true, -1]]);
  buttons[0]!.click();
  expect(selections).to.equal(1);
});

it('honors component paint and spacing tokens', async () => {
  const el = await fixture(html`<lr-suggestion-chips .suggestions=${[{ suggestionId: 'a', label: 'One' }]} style="
    --lr-suggestion-chips-chip-bg: rgb(1, 2, 3); --lr-suggestion-chips-chip-color: rgb(4, 5, 6);
    --lr-suggestion-chips-chip-border-color: rgb(7, 8, 9); --lr-suggestion-chips-chip-radius: 11px;
    --lr-suggestion-chips-chip-padding-inline: 13px; --lr-suggestion-chips-gap: 17px"></lr-suggestion-chips>`);
  const style = getComputedStyle(el.shadowRoot!.querySelector('[part="chip"]')!);
  expect([style.backgroundColor, style.color, style.borderTopColor]).to.deep.equal(['rgb(1, 2, 3)', 'rgb(4, 5, 6)', 'rgb(7, 8, 9)']);
  expect([style.borderTopLeftRadius, style.paddingInlineStart, getComputedStyle(el.shadowRoot!.querySelector('.row')!).columnGap]).to.deep.equal(['11px', '13px', '17px']);
});
