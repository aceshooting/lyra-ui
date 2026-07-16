import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './textarea.js';
import type { LyraTextarea } from './textarea.js';

it('defaults to rows=3, resize="vertical", empty value', async () => {
  const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
  expect(el.rows).to.equal(3);
  expect(el.resize).to.equal('vertical');
  expect(el.value).to.equal('');
});

it('reflects rows/placeholder onto the native textarea', async () => {
  const el = (await fixture(html`<lyra-textarea rows="6" placeholder="Notes"></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.rows).to.equal(6);
  expect(textarea.placeholder).to.equal('Notes');
});

it('applies resize onto the native textarea', async () => {
  const el = (await fixture(html`<lyra-textarea resize="none"></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(getComputedStyle(textarea).resize).to.equal('none');
});

it('updates value and fires lyra-input on user typing', async () => {
  const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.value = 'hello';
  setTimeout(() => textarea.dispatchEvent(new Event('input', { bubbles: true })));
  const ev = await oneEvent(el, 'lyra-input');
  expect(ev.detail).to.deep.equal({ value: 'hello' });
  expect(el.value).to.equal('hello');
});

it('also emits composed native-style input and change events', async () => {
  const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  const seen: string[] = [];
  el.addEventListener('input', (event) => { expect(event.composed).to.be.true; seen.push(event.type); });
  el.addEventListener('change', (event) => { expect(event.composed).to.be.true; seen.push(event.type); });
  textarea.value = 'hello';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  expect(seen).to.deep.equal(['input', 'change']);
});

it('fires lyra-change on native change (blur-after-edit timing)', async () => {
  const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.value = 'committed';
  setTimeout(() => textarea.dispatchEvent(new Event('change', { bubbles: true })));
  const ev = await oneEvent(el, 'lyra-change');
  expect(ev.detail).to.deep.equal({ value: 'committed' });
});

it('participates in native form validation via required', async () => {
  const el = (await fixture(html`<lyra-textarea required name="notes"></lyra-textarea>`)) as LyraTextarea;
  expect(el.checkValidity()).to.be.false;
  el.value = 'filled in';
  expect(el.checkValidity()).to.be.true;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-textarea placeholder="Notes"></lyra-textarea>`)) as LyraTextarea;
  await expect(el).to.be.accessible();
});

describe('label/hint/error chrome', () => {
  it('renders no chrome when label/hint/errorText are unset (today\'s exact bare output)', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(label.hidden).to.be.true;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
  });

  it('renders label/hint/errorText text and un-hides the matching parts', async () => {
    const el = (await fixture(
      html`<lyra-textarea label="Notes" hint="Keep it short" error-text="Required"></lyra-textarea>`,
    )) as LyraTextarea;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(label.hidden).to.be.false;
    expect(label.textContent).to.contain('Notes');
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain('Keep it short');
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain('Required');
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
    expect(textarea.getAttribute('aria-invalid')).to.equal('true');
  });

  it('supports label, hint, and error slots with same-shadow description ids', async () => {
    const el = (await fixture(html`
      <lyra-textarea>
        <span slot="label">Slotted notes</span>
        <span slot="hint">Slotted hint</span>
        <span slot="error">Slotted error</span>
      </lyra-textarea>
    `)) as LyraTextarea;
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect((el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement).hidden).to.be.false;
    expect(hint.hidden).to.be.false;
    expect(error.hidden).to.be.false;
    expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
  });

  it('shows a required asterisk on the label only when required', async () => {
    const el = (await fixture(html`<lyra-textarea label="Notes" required></lyra-textarea>`)) as LyraTextarea;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    expect(getComputedStyle(label, '::after').content).to.contain('*');
  });
});

describe('accessibleLabel', () => {
  it('falls back to placeholder, then the localized default, when unset', async () => {
    const noLabel = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    const withPlaceholder = (await fixture(html`<lyra-textarea placeholder="Code"></lyra-textarea>`)) as LyraTextarea;
    const ta1 = noLabel.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const ta2 = withPlaceholder.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta1.getAttribute('aria-label')).to.equal('Text');
    expect(ta2.getAttribute('aria-label')).to.equal('Code');
  });

  it('aria-label host attribute takes precedence over label and placeholder', async () => {
    const el = (await fixture(
      html`<lyra-textarea label="Notes" placeholder="ph" aria-label="Custom name"></lyra-textarea>`,
    )) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-label')).to.equal('Custom name');
  });

  it('routes the default textbox name through localization overrides', async () => {
    const el = (await fixture(html`
      <lyra-textarea .strings=${{ textareaLabel: 'Texte multiligne' }}></lyra-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-label')).to.equal('Texte multiligne');
  });
});

describe('resize="auto"', () => {
  it('accepts "auto" as a resize value and sets native CSS resize to none (no manual handle)', async () => {
    const el = (await fixture(html`<lyra-textarea resize="auto"></lyra-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(getComputedStyle(ta).resize).to.equal('none');
  });

  it('grows the textarea block-size to fit typed content that exceeds the initial rows', async () => {
    const el = (await fixture(html`<lyra-textarea resize="auto" rows="1"></lyra-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const initialHeight = ta.getBoundingClientRect().height;
    ta.value = 'line one\nline two\nline three\nline four\nline five';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(initialHeight);
  });

  it('grows after a programmatic value assignment', async () => {
    const el = (await fixture(html`<lyra-textarea resize="auto" rows="1"></lyra-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const initialHeight = ta.getBoundingClientRect().height;
    el.value = 'line one\nline two\nline three\nline four';
    await el.updateComplete;
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(initialHeight);
  });

  it('respects --lyra-textarea-max-block-size and scrolls overflow', async () => {
    const el = (await fixture(html`
      <lyra-textarea resize="auto" rows="1" style="--lyra-textarea-max-block-size: 3rem"></lyra-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const max = parseFloat(getComputedStyle(ta).maxBlockSize);
    expect(ta.getBoundingClientRect().height).to.be.at.most(max + 0.5);
    expect(getComputedStyle(ta).overflowY).to.equal('auto');
  });

  it('re-fits wrapped content when the component allocation narrows', async () => {
    const el = (await fixture(html`
      <lyra-textarea
        resize="auto"
        rows="1"
        style="inline-size: 24rem"
        .value=${'wrapped content '.repeat(30)}
      ></lyra-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const wideHeight = ta.getBoundingClientRect().height;
    el.style.inlineSize = '8rem';
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(wideHeight);
  });

  it('keeps auto-grow working after a reparent (disconnect + reconnect) with no property change in between', async () => {
    const el = (await fixture(html`
      <lyra-textarea
        resize="auto"
        rows="1"
        style="inline-size: 24rem"
        .value=${'wrapped content '.repeat(30)}
      ></lyra-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const wideHeight = ta.getBoundingClientRect().height;

    // A drag-drop reparent (or a repeat() re-key, or a tab panel detach/reattach) fires
    // disconnectedCallback then connectedCallback on this same element instance, with no Lit
    // update in between -- exactly the sequence that used to leave the ResizeObserver disarmed.
    const parent = el.parentElement!;
    parent.removeChild(el);
    parent.appendChild(el);

    el.style.inlineSize = '8rem';
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(wideHeight);
  });
});

describe('native editing-attribute passthrough', () => {
  it('spellcheck defaults to true (matching the native element default)', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.spellcheck).to.be.true;
  });

  it('forwards spellcheck=false, autocapitalize, autocorrect, wrap, autocomplete, inputmode, and enterkeyhint', async () => {
    const el = (await fixture(html`
      <lyra-textarea
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        wrap="hard"
        autocomplete="one-time-code"
        inputmode="numeric"
        enterkeyhint="done"
      ></lyra-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.spellcheck).to.be.false;
    expect(ta.getAttribute('autocapitalize')).to.equal('off');
    expect(ta.getAttribute('autocorrect')).to.equal('off');
    expect(ta.getAttribute('wrap')).to.equal('hard');
    expect(ta.getAttribute('autocomplete')).to.equal('one-time-code');
    expect(ta.getAttribute('inputmode')).to.equal('numeric');
    expect(ta.getAttribute('enterkeyhint')).to.equal('done');
  });
});

describe('input / setRangeText()', () => {
  it('exposes the native textarea via the public input getter', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    expect(el.input).to.equal(el.shadowRoot!.querySelector('textarea'));
  });

  it('setRangeText splices text at the given range and updates value', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    el.value = 'hello world';
    await el.updateComplete;
    el.setRangeText('there', 6, 11);
    expect(el.value).to.equal('hello there');
  });

  it('forwards selection getters, setters, select(), and setSelectionRange()', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    el.value = 'alpha beta';
    await el.updateComplete;
    el.setSelectionRange(1, 5, 'forward');
    expect(el.selectionStart).to.equal(1);
    expect(el.selectionEnd).to.equal(5);
    expect(el.selectionDirection).to.equal('forward');
    el.selectionStart = 2;
    el.selectionEnd = 4;
    expect(el.input!.selectionStart).to.equal(2);
    expect(el.input!.selectionEnd).to.equal(4);
    el.select();
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal(el.value.length);
  });

  it('forwards focus() and blur() to the native textarea', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    el.focus();
    expect(el.shadowRoot!.activeElement === el.input).to.be.true;
    el.blur();
    expect(el.shadowRoot!.activeElement).to.equal(null);
  });

  it('keeps the form value synchronized after setRangeText()', async () => {
    const form = (await fixture(html`
      <form><lyra-textarea name="notes" value="hello world"></lyra-textarea></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lyra-textarea') as LyraTextarea;
    el.setRangeText('there', 6, 11);
    expect(new FormData(form).get('notes')).to.equal('hello there');
  });
});

describe('blur/focus bubbling', () => {
  it('re-dispatches a bubbling, composed blur event when the native textarea blurs', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    ta.focus();
    const eventPromise = oneEvent(el, 'blur');
    ta.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('re-dispatches a bubbling, composed focus event when the native textarea focuses', async () => {
    const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const eventPromise = oneEvent(el, 'focus');
    ta.focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});
