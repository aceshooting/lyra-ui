import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './code-editor.js';
import type { LyraCodeEditor } from './code-editor.js';

function descriptions(owner: HTMLElement): string[] {
  return Reflect.has(owner, 'ariaDescribedByElements')
    ? Array.from(owner.ariaDescribedByElements ?? []).map((element) => element.id)
    : owner.getAttribute('aria-describedby')?.match(/\S+/g) ?? [];
}

for (const [attribute, property, part] of [
  ['label', 'label', 'form-control-label'],
  ['hint', 'hint', 'hint'],
  ['error-text', 'errorText', 'error'],
] as const) {
  it(`renders safely after removing ${attribute}, preserving null readback and later values`, async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor></lr-code-editor>`);
    el.setAttribute(attribute, 'Supplied content');
    await el.updateComplete;
    el.removeAttribute(attribute);
    let failure: unknown;
    try { await el.updateComplete; } catch (error) { failure = error; }
    expect(failure instanceof Error ? failure.message : failure).to.equal(undefined);
    expect(el[property]).to.equal(null);
    const chrome = el.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
    expect(chrome.hidden).to.equal(true);
    el.setAttribute(attribute, '');
    await el.updateComplete;
    expect(el[property]).to.equal('');
    expect(chrome.hidden).to.equal(true);
    el.setAttribute(attribute, 'Recovered content');
    await el.updateComplete;
    expect(chrome.hidden).to.equal(false);
    expect(chrome.textContent).to.include('Recovered content');
  });
}

it('projects live external descriptions before textarea guidance without losing local updates', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <span id="editor-first">External guidance</span>
    <lr-code-editor aria-describedby="editor-first editor-late editor-first" hint="Local hint" error-text="Local error"></lr-code-editor>
  </div>`);
  const el = wrapper.querySelector('lr-code-editor')!;
  const owner = el.input!;
  const first = wrapper.querySelector('#editor-first')!;
  const baseline = ['textarea-error', 'textarea-hint'];
  if (!Reflect.has(owner, 'ariaDescribedByElements')) {
    expect(descriptions(owner)).to.deep.equal(baseline);
    return;
  }
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === first, 'external guidance did not reach the textarea');
  expect(descriptions(owner)).to.deep.equal([first.id, ...baseline]);
  const replacement = document.createElement('span');
  replacement.id = first.id;
  replacement.textContent = 'Replacement guidance';
  first.replaceWith(replacement);
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === replacement);
  replacement.remove();
  await waitUntil(() => descriptions(owner).join(' ') === baseline.join(' '));
  wrapper.prepend(replacement);
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === replacement);
  const late = document.createElement('span');
  late.id = 'editor-late';
  wrapper.prepend(late);
  await waitUntil(() => descriptions(owner).join(' ') === [replacement.id, late.id, ...baseline].join(' '));
  el.hint = '';
  await el.updateComplete;
  expect(descriptions(owner)).to.deep.equal([replacement.id, late.id, 'textarea-error']);
  el.removeAttribute('aria-describedby');
  await waitUntil(() => descriptions(owner).join(' ') === 'textarea-error');
});

it('rebinds textarea descriptions after reconnect and adoption into a different root', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <span id="editor-realm-guidance">Original guidance</span>
    <lr-code-editor aria-describedby="editor-realm-guidance" hint="Local hint"></lr-code-editor>
  </div>`);
  const el = wrapper.querySelector('lr-code-editor')!;
  const owner = el.input!;
  const source = wrapper.querySelector('#editor-realm-guidance')!;
  if (!Reflect.has(owner, 'ariaDescribedByElements')) return;
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === source);
  el.remove();
  wrapper.append(el);
  await waitUntil(() => owner.ariaDescribedByElements?.[0] === source);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const foreignDocument = frame.contentDocument!;
  const foreignSource = foreignDocument.createElement('span');
  foreignSource.id = source.id;
  foreignSource.textContent = 'Adopted guidance';
  foreignDocument.body.append(foreignSource);
  try {
    foreignDocument.body.append(foreignDocument.adoptNode(el));
    await waitUntil(() => owner.ariaDescribedByElements?.[0] === foreignSource);
    foreignSource.remove();
    await waitUntil(() => descriptions(owner).join(' ') === 'textarea-hint');
    foreignDocument.body.append(foreignSource);
    await waitUntil(() => owner.ariaDescribedByElements?.[0] === foreignSource);
  } finally {
    wrapper.append(document.adoptNode(el));
    frame.remove();
  }
});

it('resets local touched feedback while retaining required/custom constraints and restoring defaults', async () => {
  const form = await fixture<HTMLFormElement>(html`<form>
    <lr-code-editor required></lr-code-editor><button type="button">Outside</button>
  </form>`);
  const el = form.querySelector('lr-code-editor')!;
  const outside = form.querySelector('button')!;
  el.focus();
  outside.focus();
  await el.updateComplete;
  expect(el.input!.getAttribute('aria-invalid')).to.equal('true');
  expect(el.matches(':state(user-invalid)')).to.equal(true);
  form.reset();
  await el.updateComplete;
  expect(el.input!.getAttribute('aria-invalid')).to.equal('false');
  expect(el.matches(':state(user-invalid)')).to.equal(false);
  expect(el.validity.valueMissing).to.equal(true);
  el.defaultValue = 'original';
  el.value = 'edited';
  el.setCustomValidity('Custom validation');
  el.focus();
  outside.focus();
  await el.updateComplete;
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('original');
  expect(el.input!.value).to.equal('original');
  expect(el.validity.customError).to.equal(true);
  expect(el.validationMessage).to.equal('Custom validation');
  expect(el.input!.getAttribute('aria-invalid')).to.equal('false');
});

for (const wrap of ['soft', 'hard'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    it(`wraps ${wrap} source within a ${direction} allocation with the frame owning the full scroll range`, async () => {
      const el = await fixture<LyraCodeEditor>(html`<lr-code-editor
        dir=${direction} wrap=${wrap} resize="none"
        style="inline-size: 250px; block-size: 160px"
        .value=${'lorem '.repeat(70)}></lr-code-editor>`);
      const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="editor"]')!;
      const native = el.input!;
      expect(frame.scrollWidth - frame.clientWidth, 'wrapped source must fit the allocated width').to.be.at.most(1);
      expect(frame.scrollHeight, 'wrapped lines must extend the frame vertically').to.be.greaterThan(frame.clientHeight);
      expect(native.scrollWidth - native.clientWidth, 'no competing native horizontal scroll').to.be.at.most(1);
      expect(native.scrollHeight - native.clientHeight, 'no competing native vertical scroll').to.be.at.most(1);
      el.scrollPosition({ top: frame.scrollHeight });
      expect(el.scrollPosition()?.top).to.equal(frame.scrollTop);
      expect(frame.scrollTop).to.be.greaterThan(0);
      native.scrollTop = native.scrollHeight;
      expect(native.scrollTop).to.equal(0);
      el.scrollPosition({ top: 0 });
      el.setSelectionRange(el.value.length, el.value.length);
      el.focus();
      await el.updateComplete;
      await waitUntil(() => frame.scrollTop > 0, 'the wrapped caret must scroll the outer frame');
    });
  }
}

for (const mode of ['default', 'token', 'property', 'attribute'] as const) {
  it(`measures literal tabs with ${mode} width and exposes all horizontal scrolling through the frame`, async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor resize="none"
      style="inline-size: 250px; block-size: 160px" .value=${'\t'.repeat(35) + 'end'}></lr-code-editor>`);
    if (mode === 'token') el.style.setProperty('--lr-code-editor-tab-size', '8');
    if (mode === 'property') el.tabSize = 8;
    if (mode === 'attribute') el.setAttribute('tab-size', '8');
    await el.updateComplete;
    const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="editor"]')!;
    const measure = el.shadowRoot!.querySelector<HTMLElement>('.editor-measure')!;
    const native = el.input!;
    expect(el.wrap).to.equal('off');
    expect(getComputedStyle(native).tabSize).to.equal(mode === 'default' ? '2' : '8');
    expect(getComputedStyle(measure).tabSize).to.equal(getComputedStyle(native).tabSize);
    expect(native.scrollWidth - native.clientWidth).to.be.at.most(1);
    el.scrollPosition({ left: frame.scrollWidth });
    expect(el.scrollPosition()?.left).to.equal(frame.scrollLeft);
    expect(frame.scrollLeft).to.be.greaterThan(0);
    native.scrollLeft = native.scrollWidth;
    expect(native.scrollLeft).to.equal(0);
  });
}

it('keeps logical gutter lines aligned after preceding source wraps and allocation changes', async () => {
  const el = await fixture<LyraCodeEditor>(html`<lr-code-editor wrap="soft" resize="none"
    style="inline-size: 250px; block-size: 160px"
    .value=${'lorem '.repeat(30) + '\nsecond line'}></lr-code-editor>`);
  const measure = el.shadowRoot!.querySelector<HTMLElement>('.editor-measure')!;
  const line = () => el.shadowRoot!.querySelectorAll<HTMLElement>('.gutter-line')[1]!;
  const secondTop = (): number => {
    const text = [...measure.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes('second line'))!;
    const range = document.createRange();
    range.setStart(text, text.textContent!.indexOf('second line'));
    range.setEnd(text, text.textContent!.indexOf('second line') + 1);
    return range.getBoundingClientRect().top;
  };
  const aligned = (): boolean => {
    const range = document.createRange();
    range.selectNodeContents(line());
    return Math.abs(range.getBoundingClientRect().top - secondTop()) <= 2;
  };
  await waitUntil(aligned, 'the second gutter line did not follow wrapped source');
  el.style.inlineSize = '320px';
  await waitUntil(aligned, 'the gutter did not follow a new wrapping allocation');
  el.wrap = 'off';
  await el.updateComplete;
  await waitUntil(aligned, 'the gutter did not restore unwrapped line positions');
});

it('keeps the final logical gutter line visible when scrolling a large wrapped source', async () => {
  const el = await fixture<LyraCodeEditor>(html`<lr-code-editor wrap="soft" resize="none"
    style="inline-size: 250px; block-size: 160px"
    .value=${Array.from({ length: 260 }, (_, index) => index === 259
      ? 'line 260'
      : `line ${index + 1} ${'word '.repeat(12)}`).join('\n')}></lr-code-editor>`);
  const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="editor"]')!;
  el.scrollPosition({ top: frame.scrollHeight });
  await waitUntil(() => [...el.shadowRoot!.querySelectorAll('.gutter-line')].some((line) => line.textContent?.trim() === '260'));
  expect(el.shadowRoot!.querySelectorAll('.gutter-line').length).to.be.at.most(200);
  const last = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.gutter-line')].find((line) => line.textContent?.trim() === '260')!;
  expect(last.getBoundingClientRect().top).to.be.at.least(frame.getBoundingClientRect().top);
  expect(last.getBoundingClientRect().bottom).to.be.at.most(frame.getBoundingClientRect().bottom);
});


it('does not reacquire external-description observers from a queued update after disconnect', async () => {
  const Original = window.MutationObserver;
  const active = new Map<MutationObserver, Node>();
  window.MutationObserver = class extends Original {
    override observe(target: Node, options?: MutationObserverInit) {
      super.observe(target, options);
      if (options?.attributeFilter?.length === 1 && options.attributeFilter[0] === 'aria-describedby') active.set(this, target);
    }
    override disconnect() { super.disconnect(); active.delete(this); }
  };
  try {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor aria-describedby="outside-guidance"></lr-code-editor>`);
    const count = () => [...active.values()].filter((target) => target === el).length;
    expect(count()).to.equal(1);
    el.hint = 'Queued render';
    el.remove();
    expect(count()).to.equal(0);
    await el.updateComplete;
    expect(count()).to.equal(0);
    document.body.append(el);
    await el.updateComplete;
    expect(count()).to.equal(1);
    el.remove();
    expect(count()).to.equal(0);
  } finally { window.MutationObserver = Original; }
});


it('extends the wrapped gutter background and border through the final logical line', async () => {
  const el = await fixture<LyraCodeEditor>(html`<lr-code-editor wrap="soft" resize="none"
    style="inline-size:250px;block-size:160px" .value=${'lorem '.repeat(30) + '\nsecond line'}></lr-code-editor>`);
  const gutter = el.shadowRoot!.querySelector<HTMLElement>('[part="gutter"]')!;
  const lastLine = el.shadowRoot!.querySelectorAll<HTMLElement>('.gutter-line')[1]!;
  await waitUntil(() => parseFloat(lastLine.style.insetBlockStart) > 100);
  expect(gutter.getBoundingClientRect().bottom).to.be.at.least(lastLine.getBoundingClientRect().bottom);
  el.wrap = 'off';
  await el.updateComplete;
  expect(gutter.getBoundingClientRect().height).to.be.at.least(
    el.shadowRoot!.querySelector<HTMLElement>('.editor-measure')!.getBoundingClientRect().height,
  );
});


it('keeps native text, measurement and gutter on the live monospace family token', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="--lr-theme-font-family-mono: monospace; font-weight: 700; font-style: italic">
    <lr-code-editor wrap="soft" resize="none" style="inline-size: 250px; block-size: 160px"
      .value=${'wrapped source '.repeat(20) + '\nsecond line'}></lr-code-editor>
  </div>`);
  const el = wrapper.querySelector<LyraCodeEditor>('lr-code-editor')!;
  await el.updateComplete;
  const measure = el.shadowRoot!.querySelector<HTMLElement>('.editor-measure')!;
  const gutter = el.shadowRoot!.querySelector<HTMLElement>('[part="gutter"]')!;
  const owners = [el.input!, measure, gutter];
  const expectFamily = (family: string): void => {
    for (const owner of owners) {
      const computed = getComputedStyle(owner);
      expect(computed.fontFamily).to.equal(family);
      expect(computed.fontWeight).to.equal('700');
      expect(computed.fontStyle).to.equal('italic');
    }
    expect(getComputedStyle(measure).fontSize).to.equal(getComputedStyle(el.input!).fontSize);
    expect(getComputedStyle(gutter).lineHeight).to.equal(getComputedStyle(el.input!).lineHeight);
  };
  expectFamily('monospace');
  const computedGutter = getComputedStyle(gutter);
  const digitWidth = el.shadowRoot!.querySelector<HTMLElement>('.gutter-measure')!.getBoundingClientRect().width;
  const gutterChrome = [computedGutter.paddingInlineStart, computedGutter.paddingInlineEnd,
    computedGutter.borderInlineStartWidth, computedGutter.borderInlineEndWidth]
    .reduce((width, value) => width + Number.parseFloat(value), 0);
  expect(gutter.getBoundingClientRect().width).to.be.closeTo(digitWidth + gutterChrome, 1);
  wrapper.style.setProperty('--lr-theme-font-family-mono', 'serif');
  expectFamily('serif');
  el.style.setProperty('--lr-font-mono', 'monospace');
  expectFamily('monospace');
  el.style.removeProperty('--lr-font-mono');
  expectFamily('serif');
  wrapper.style.removeProperty('--lr-theme-font-family-mono');
  for (const owner of owners) expect(getComputedStyle(owner).fontFamily).to.include('monospace');
  expect(el.input!.scrollHeight - el.input!.clientHeight).to.be.at.most(1);
  expect(el.input!.scrollWidth - el.input!.clientWidth).to.be.at.most(1);
});


for (const [wrap, resize] of [
  ['off', 'none'], ['off', 'vertical'], ['off', 'horizontal'], ['off', 'both'],
  ['soft', 'none'], ['hard', 'none'],
] as const) {
  it(`keeps ${wrap}/${resize} gutter chrome as tall as the text and viewport through live geometry changes`, async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor .wrap=${wrap} .resize=${resize}
      style="inline-size: 250px; block-size: 160px"
      .value=${Array.from({ length: 40 }, () => 'long source '.repeat(6)).join('\n')}></lr-code-editor>`);
    const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="editor"]')!;
    const measure = el.shadowRoot!.querySelector<HTMLElement>('.editor-measure')!;
    const aligned = (): boolean => {
      const gutter = el.shadowRoot!.querySelector<HTMLElement>('[part="gutter"]')!;
      return Math.abs(gutter.getBoundingClientRect().height - Math.max(measure.getBoundingClientRect().height, frame.clientHeight)) <= 1;
    };
    await waitUntil(aligned, 'the gutter must cover the long rendered source');
    expect(frame.scrollHeight - frame.clientHeight).to.be.greaterThan(0);
    expect(el.input!.scrollHeight - el.input!.clientHeight).to.be.at.most(1);
    expect(el.input!.scrollWidth - el.input!.clientWidth).to.be.at.most(1);
    el.style.setProperty('--lr-code-editor-font-size', '20px');
    el.style.setProperty('--lr-code-editor-line-height', '2');
    await waitUntil(aligned, 'the gutter must follow live font and line-height tokens');
    expect(el.input!.scrollHeight - el.input!.clientHeight).to.be.at.most(1);
    expect(el.input!.scrollWidth - el.input!.clientWidth).to.be.at.most(1);
    el.value = 'short';
    await el.updateComplete;
    await waitUntil(aligned, 'short content must retain a gutter through the viewport');
    el.lineNumbers = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="gutter"]').length).to.equal(0);
    el.lineNumbers = true;
    await el.updateComplete;
    await waitUntil(aligned, 're-enabled line numbers must use current text geometry');
    expect(el.input!.scrollHeight - el.input!.clientHeight).to.be.at.most(1);
    expect(el.input!.scrollWidth - el.input!.clientWidth).to.be.at.most(1);
  });
}


for (const [wrap, direction] of [['off', 'ltr'], ['off', 'rtl'], ['soft', 'ltr'], ['soft', 'rtl']] as const) {
  it(`keeps ${wrap}/${direction} end and start carets outside native scrollbars and the pinned gutter`, async () => {
    const value = Array.from({ length: 40 }, (_, index) => index === 39 ? 'last line' : 'long source '.repeat(12)).join('\n');
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor .wrap=${wrap} dir=${direction} resize="none"
      style="inline-size: 250px; block-size: 160px" .value=${value}></lr-code-editor>`);
    const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="editor"]')!;
    const marker = el.shadowRoot!.querySelector<HTMLElement>('.editor-caret-measure')!;
    const visible = (): boolean => {
      const outer = frame.getBoundingClientRect();
      const range = document.createRange();
      let remaining = el.selectionStart ?? 0;
      const text = [...marker.parentElement!.childNodes].find((node) => {
        if (node.nodeType !== Node.TEXT_NODE) return false;
        const length = node.textContent?.length ?? 0;
        if (remaining < length) return true;
        remaining -= length;
        return false;
      })!;
      range.setStart(text, remaining);
      if (text.textContent?.[remaining] === '\n') range.setEnd(text, remaining + 1);
      else range.collapse(true);
      const caret = range.getBoundingClientRect();
      const gutter = el.shadowRoot!.querySelector<HTMLElement>('[part="gutter"]')?.getBoundingClientRect();
      const left = outer.left + frame.clientLeft;
      const top = outer.top + frame.clientTop;
      const textLeft = direction === 'ltr' && gutter ? gutter.right : left;
      const textRight = direction === 'rtl' && gutter ? gutter.left : left + frame.clientWidth;
      return caret.height > 0 && caret.left >= textLeft - 1 && caret.right <= textRight + 1
        && caret.top >= top - 1 && caret.bottom <= top + frame.clientHeight + 1;
    };
    for (const lineNumbers of [true, false]) {
      el.lineNumbers = lineNumbers;
      await el.updateComplete;
      for (const offset of [value.length, value.indexOf('\n'), 0]) {
        el.setSelectionRange(offset, offset);
        if (lineNumbers) el.focus();
        else el.input!.focus();
        await el.updateComplete;
        await waitUntil(visible, 'the caret must be inside the visible text viewport');
        expect(el.input!.scrollTop).to.equal(0);
        expect(el.input!.scrollLeft).to.equal(0);
      }
    }
    el.lineNumbers = true;
    el.value = '';
    await el.updateComplete;
    el.setSelectionRange(0, 0);
    el.focus();
    await el.updateComplete;
    await waitUntil(visible, 'the empty editor caret must use its visible text sentinel');
    expect(el.selectionStart).to.equal(0);
  });
}
