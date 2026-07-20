import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './message-feedback.js';
import type { LyraMessageFeedback } from './message-feedback.js';
import { styles } from './message-feedback.styles.js';

const reasons = [
  { id: 'wrong', label: 'Factually wrong' },
  { id: 'unhelpful', label: 'Not helpful' },
];

it('defaults to value null, no reasons, not commentable, detailFor "down"', async () => {
  const el = (await fixture(html`<lr-message-feedback></lr-message-feedback>`)) as LyraMessageFeedback;
  expect(el.value).to.equal(null);
  expect(el.reasons).to.deep.equal([]);
  expect(el.commentable).to.be.false;
  expect(el.detailFor).to.equal('down');
});

it('localizes thumb accessible names with the built-in English fallback and via .strings override', async () => {
  const el = (await fixture(html`<lr-message-feedback></lr-message-feedback>`)) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLButtonElement;
  const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
  expect(up.getAttribute('aria-label')).to.equal('Good response');
  expect(down.getAttribute('aria-label')).to.equal('Bad response');

  el.strings = { feedbackPositive: 'Bonne réponse', feedbackNegative: 'Mauvaise réponse' };
  await el.updateComplete;
  expect(up.getAttribute('aria-label')).to.equal('Bonne réponse');
  expect(down.getAttribute('aria-label')).to.equal('Mauvaise réponse');
});

describe('thumbs-only (no reasons, not commentable)', () => {
  it('toggles value on click, with no panel ever rendered', async () => {
    const el = (await fixture(html`<lr-message-feedback></lr-message-feedback>`)) as LyraMessageFeedback;
    const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLButtonElement;

    const first = oneEvent(el, 'lr-change');
    up.click();
    expect((await first).detail).to.deep.equal({ value: 'up' });
    expect(el.value).to.equal('up');
    expect(el.shadowRoot!.querySelector('[part="panel"]')).to.not.exist;

    const second = oneEvent(el, 'lr-change');
    up.click(); // re-activating the pressed thumb clears it
    expect((await second).detail).to.deep.equal({ value: null });
    expect(el.value).to.equal(null);
  });

  it('reflects aria-pressed both true and false', async () => {
    const el = (await fixture(html`<lr-message-feedback></lr-message-feedback>`)) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    expect(down.getAttribute('aria-pressed')).to.equal('false');
    down.click();
    await el.updateComplete;
    expect(down.getAttribute('aria-pressed')).to.equal('true');
  });
});

describe('detail panel (reasons + commentable, detailFor "down")', () => {
  it('opens the panel only for the thumb detailFor applies to', async () => {
    const el = (await fixture(
      html`<lr-message-feedback .reasons=${reasons} commentable></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLButtonElement;
    up.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.be.false;

    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.be.true;
  });

  it('toggles reason chips and includes only selected ids in lr-submit', async () => {
    const el = (await fixture(
      html`<lr-message-feedback .reasons=${reasons}></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;

    const chips = el.shadowRoot!.querySelectorAll('[part="reasons"] lr-chip');
    expect(chips.length).to.equal(2);
    (chips[0] as HTMLElement).dispatchEvent(
      new CustomEvent('lr-chip-select', { detail: { selected: true }, bubbles: true, composed: true }),
    );
    await el.updateComplete;

    const submitPromise = oneEvent(el, 'lr-submit');
    (el.shadowRoot!.querySelector('[part="submit-button"]') as HTMLButtonElement).click();
    const ev = await submitPromise;
    expect(ev.detail).to.deep.equal({ value: 'down', reasonIds: ['wrong'], comment: '' });
  });

  it('includes the trimmed comment in lr-submit when commentable', async () => {
    const el = (await fixture(
      html`<lr-message-feedback commentable></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;

    const textarea = el.shadowRoot!.querySelector('[part="comment"]') as HTMLTextAreaElement;
    textarea.value = '  too slow  ';
    textarea.dispatchEvent(new Event('input'));
    await el.updateComplete;

    const submitPromise = oneEvent(el, 'lr-submit');
    (el.shadowRoot!.querySelector('[part="submit-button"]') as HTMLButtonElement).click();
    const ev = await submitPromise;
    expect(ev.detail).to.deep.equal({ value: 'down', reasonIds: [], comment: 'too slow' });
  });

  it('closes the panel and returns focus to the active thumb on submit', async () => {
    const el = (await fixture(
      html`<lr-message-feedback commentable></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="submit-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.be.false;
    expect(el.value).to.equal('down'); // submit does not clear the rating
    expect(el.shadowRoot!.activeElement).to.equal(down);
  });

  it('closes the panel on Escape, keeps value, and returns focus to the active thumb', async () => {
    const el = (await fixture(
      html`<lr-message-feedback commentable></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    el.shadowRoot!
      .querySelector('[part="panel"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.be.false;
    expect(el.value).to.equal('down');
    expect(el.shadowRoot!.activeElement).to.equal(down);
  });

  it('re-opens the panel with the prior draft intact when the pressed thumb is clicked again after Escape', async () => {
    const el = (await fixture(
      html`<lr-message-feedback .reasons=${reasons} commentable></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('[part="comment"]') as HTMLTextAreaElement;
    textarea.value = 'draft in progress';
    textarea.dispatchEvent(new Event('input'));
    await el.updateComplete;

    el.shadowRoot!
      .querySelector('[part="panel"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.be.false;

    let changeFired = false;
    el.addEventListener('lr-change', () => (changeFired = true));
    down.click(); // re-open, not toggle-off, since the panel was closed
    await el.updateComplete;
    expect(changeFired, 'value did not change, so lr-change must not re-fire').to.be.false;
    expect(el.value).to.equal('down');
    expect(el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="comment"]') as HTMLTextAreaElement).value).to.equal(
      'draft in progress',
    );
  });

  it('clears value when the pressed thumb (with its panel already open) is clicked again', async () => {
    const el = (await fixture(
      html`<lr-message-feedback commentable></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.be.true;

    const changePromise = oneEvent(el, 'lr-change');
    down.click(); // panel is open -- this click is the toggle-off gesture
    expect((await changePromise).detail).to.deep.equal({ value: null });
    expect(el.value).to.equal(null);
  });

  it('resets drafts when switching from one thumb to the other', async () => {
    const el = (await fixture(
      html`<lr-message-feedback .reasons=${reasons} commentable></lr-message-feedback>`,
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('[part="comment"]') as HTMLTextAreaElement;
    textarea.value = 'stale draft';
    textarea.dispatchEvent(new Event('input'));
    await el.updateComplete;

    const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLButtonElement;
    up.click(); // up has no detail panel (detailFor defaults to 'down'), but still switches value
    await el.updateComplete;
    down.click(); // back to down -- should show a fresh, empty draft, not the stale one
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="comment"]') as HTMLTextAreaElement).value).to.equal('');
  });
});

it('respects a host-set disabled value as a read-only display', async () => {
  const el = (await fixture(
    html`<lr-message-feedback value="up" disabled></lr-message-feedback>`,
  )) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLButtonElement;
  expect(up.disabled).to.be.true;
  let fired = false;
  el.addEventListener('lr-change', () => (fired = true));
  up.click();
  expect(fired).to.be.false;
});

it('never conveys value by color alone -- aria-pressed is present for both thumbs regardless of state', async () => {
  const el = (await fixture(html`<lr-message-feedback value="up"></lr-message-feedback>`)) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector('[part="up-button"]')!;
  const down = el.shadowRoot!.querySelector('[part="down-button"]')!;
  expect(up.getAttribute('aria-pressed')).to.equal('true');
  expect(down.getAttribute('aria-pressed')).to.equal('false');
});

it('focus() delegates to the thumb matching the current value', async () => {
  const el = (await fixture(html`<lr-message-feedback value="down"></lr-message-feedback>`)) as LyraMessageFeedback;
  el.focus();
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="down-button"]'));
});

it('gives the up/down thumb buttons the shared minimum hit area', async () => {
  const el = (await fixture(html`<lr-message-feedback></lr-message-feedback>`)) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLElement;
  const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLElement;

  expect(getComputedStyle(up).minInlineSize).to.equal('40px');
  expect(getComputedStyle(up).minBlockSize).to.equal('40px');
  expect(getComputedStyle(down).minInlineSize).to.equal('40px');
  expect(getComputedStyle(down).minBlockSize).to.equal('40px');
});

function renderedHoverFilter(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && normalize(rule.selectorText) === normalize(selector) && rule.style.filter) {
        declared = rule.style.filter;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.filter = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).filter;
  probe.remove();
  return value;
}

it('lifts the submit button on hover through the shared hover-brightness token', async () => {
  const el = (await fixture(
    html`<lr-message-feedback value="down" .reasons=${reasons} commentable></lr-message-feedback>`,
  )) as LyraMessageFeedback;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="submit-button"]').length).to.equal(1);
  expect(renderedHoverFilter(el, "[part='submit-button']:hover")).to.equal('brightness(1.08)');
});

it('is accessible in every configuration', async () => {
  const plain = (await fixture(html`<lr-message-feedback></lr-message-feedback>`)) as LyraMessageFeedback;
  await expect(plain).to.be.accessible();

  const withPanel = (await fixture(
    html`<lr-message-feedback value="down" .reasons=${reasons} commentable></lr-message-feedback>`,
  )) as LyraMessageFeedback;
  await expect(withPanel).to.be.accessible();
});

// `::part(up-button)[aria-pressed='true']` is invalid CSS -- Shadow Parts forbids an attribute
// selector after `::part()` -- so before these hatches the only way to retint a pressed thumb was
// to override the shared `--lr-color-success`/`--lr-color-danger`, which repainted every other
// surface reading them. The hatches are deliberately not declared on `:host`, so a value set on an
// ancestor reaches them; the override tests below set the property on a wrapper, not the element.
describe('pressed-state cssprops', () => {
  it('lets an ancestor retint the pressed thumbs-up without touching --lr-color-success', async () => {
    const host = (await fixture(html`
      <div
        style="--lr-message-feedback-up-active-color: rgb(1, 2, 3);
               --lr-message-feedback-up-active-bg: rgb(4, 5, 6);
               --lr-message-feedback-up-active-border: rgb(7, 8, 9);"
      >
        <lr-message-feedback value="up"></lr-message-feedback>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector('lr-message-feedback') as LyraMessageFeedback;
    await el.updateComplete;
    const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLElement;
    expect(up.getAttribute('aria-pressed')).to.equal('true');
    expect(getComputedStyle(up).color).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(up).backgroundColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(up).borderTopColor).to.equal('rgb(7, 8, 9)');
  });

  it('lets an ancestor retint the pressed thumbs-down independently', async () => {
    const host = (await fixture(html`
      <div style="--lr-message-feedback-down-active-bg: rgb(10, 11, 12);">
        <lr-message-feedback value="down"></lr-message-feedback>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector('lr-message-feedback') as LyraMessageFeedback;
    await el.updateComplete;
    const down = el.shadowRoot!.querySelector('[part="down-button"]') as HTMLElement;
    expect(getComputedStyle(down).backgroundColor).to.equal('rgb(10, 11, 12)');
  });

  it('renders byte-identically to the shared tokens when the hatches are unset', async () => {
    const el = (await fixture(html`<lr-message-feedback value="up"></lr-message-feedback>`)) as LyraMessageFeedback;
    await el.updateComplete;
    const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLElement;
    // Resolve the tokens inside the shadow root -- they are declared on :host, so a light-DOM
    // probe would see none of them.
    const probe = document.createElement('span');
    probe.style.cssText = 'color: var(--lr-color-success); background: var(--lr-color-success-quiet);';
    el.shadowRoot!.appendChild(probe);
    const expected = getComputedStyle(probe);
    expect(getComputedStyle(up).color).to.equal(expected.color);
    expect(getComputedStyle(up).backgroundColor).to.equal(expected.backgroundColor);
    probe.remove();
  });
});

it("colors the comment field's placeholder text instead of leaving the UA default", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='comment'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/);
});
