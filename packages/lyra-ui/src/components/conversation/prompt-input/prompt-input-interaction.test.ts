import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-prompt-input.js';
import type { LyraPromptInput } from './prompt-input.class.js';

async function openSuggestions() {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-input']>(html`<lr-prompt-input
    .mentionItems=${[{ suggestionId: 'ada', label: 'Ada' }]}></lr-prompt-input>`);
  const input = el.input!;
  input.value = 'hello @a';
  input.setSelectionRange(8, 8);
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover')!;
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  return { el, input, popover };
}

it('keeps browser shortcuts available with suggestions open', async () => {
  const { input, el, popover } = await openSuggestions();
  const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, composed: true, cancelable: true });
  input.dispatchEvent(event);
  expect(event.defaultPrevented).to.equal(false);
  expect(el.value).to.equal('hello @a');
  expect(popover.open).to.equal(true);
});

it('dismisses a stale suggestion when the textarea selection moves', async () => {
  const { input, el, popover } = await openSuggestions();
  input.setSelectionRange(1, 4);
  popover.dispatchEvent(new CustomEvent('lr-mention-select', {
    detail: { suggestionId: 'ada', index: 0, label: 'Ada' }, bubbles: true, composed: true,
  }));
  await el.updateComplete;
  expect(el.value).to.equal('hello @a');
  expect(popover.open).to.equal(false);
});

it('closes suggestions when the live caret leaves the query without editing', async () => {
  const { input, el, popover } = await openSuggestions();
  let inputEvents = 0;
  el.addEventListener('lr-input', () => { inputEvents += 1; });

  await focusByKeyboard(input);
  expect(popover.open).to.equal(true);
  await sendKeys({ press: 'ArrowLeft' });
  expect(input.selectionStart).to.equal(7);
  await waitUntil(() => !popover.open, 'the stale suggestion popup closes after selection changes');

  expect(el.value).to.equal('hello @a');
  expect(inputEvents).to.equal(0);
});

it('leaves a native textarea selection set by a suggestion listener in place', async () => {
  const { input, el, popover } = await openSuggestions();
  const typed: string[] = [];
  el.addEventListener('lr-input', event => {
    typed.push(event.detail.value);
    input.setSelectionRange(1, 3, 'backward');
  }, { once: true });
  el.addEventListener('lr-mention-select', event => typed.push(event.detail.suggestionId));

  popover.dispatchEvent(new CustomEvent('lr-mention-select', {
    detail: { suggestionId: 'ada', index: 0, label: 'Ada' }, bubbles: true, composed: true,
  }));
  await el.updateComplete;
  await Promise.resolve();

  expect(typed).to.deep.equal(['hello @Ada ', 'ada']);
  expect(input.selectionStart).to.equal(1);
  expect(input.selectionEnd).to.equal(3);
  expect(input.selectionDirection).to.equal('backward');
});

it('dismisses a suggestion when the textarea text changes at the same caret', async () => {
  const { input, el, popover } = await openSuggestions();
  input.setRangeText('b', 7, 8, 'end');
  expect(input.selectionStart).to.equal(8);
  popover.dispatchEvent(new CustomEvent('lr-mention-select', {
    detail: { suggestionId: 'ada', index: 0, label: 'Ada' }, bubbles: true, composed: true,
  }));
  await el.updateComplete;

  expect(el.value).to.equal('hello @a');
  expect(input.value).to.equal('hello @b');
  expect(popover.open).to.equal(false);
});

it('shows a disclosure marker for the source picker', async () => {
  const el = await fixture(html`<lr-prompt-input .sources=${[{ id: 'notes', label: 'Notes' }]}></lr-prompt-input>`);
  const summary = el.shadowRoot!.querySelector('summary')!;
  const marker = summary.querySelector('svg')!;
  expect(marker?.getBoundingClientRect().width ?? 0).to.be.greaterThan(0);
  expect(marker.getAttribute('aria-hidden')).to.equal('true');
  const wrapper = marker.parentElement!;
  const closed = getComputedStyle(wrapper).transform;
  const details = summary.parentElement as HTMLDetailsElement;
  summary.click();
  expect(details.open).to.equal(true);
  expect(getComputedStyle(wrapper).transform).to.not.equal(closed);
});

it('falls back to a localized name for whitespace-only overrides', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-input']>(html`<lr-prompt-input
    aria-label="  " label="   " .strings=${{ promptInputLabel: 'Localized name' }}></lr-prompt-input>`);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized name');
  el.setAttribute('aria-label', '  Named control  ');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')?.trim()).to.equal('Named control');
});

it('ignores suggestion navigation that another handler canceled', async () => {
  const { el, input, popover } = await openSuggestions();
  const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true });
  key.preventDefault();
  input.dispatchEvent(key);
  await el.updateComplete;
  expect(el.value).to.equal('hello @a');
  expect(popover.open).to.equal(true);
});

it('visually disables the inert sources disclosure', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-input']>(html`<lr-prompt-input .sources=${[{ id: 's', label: 'Source' }]}
    style="--lr-opacity-disabled:0.4"></lr-prompt-input>`);
  const details = el.shadowRoot!.querySelector('details')!;
  const summary = details.querySelector('summary')!;
  expect(getComputedStyle(details).opacity).to.equal('1');
  expect(getComputedStyle(summary).cursor).to.equal('pointer');
  el.disabled = true;
  await el.updateComplete;
  expect(details.inert).to.equal(true);
  expect(getComputedStyle(details).opacity).to.equal('0.4');
  expect(getComputedStyle(summary).cursor).to.equal('not-allowed');
});

it('restores its default for blank max-rows and honors explicit numbers', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-input']>(html`<lr-prompt-input max-rows=" "></lr-prompt-input>`);
  expect(el.maxRows).to.equal(8);
  el.setAttribute('max-rows', '3');
  await el.updateComplete;
  expect(el.maxRows).to.equal(3);
  el.removeAttribute('max-rows');
  await el.updateComplete;
  expect(el.maxRows).to.equal(8);
});

it('locks the built-in prompt controls while preserving attachment previews in readonly mode', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-input']>(html`<lr-prompt-input
    .modelCatalog=${['m']} .voiceCatalog=${['v']} .queue=${[{ id: 'q', value: 'Question' }]}
    .sources=${[{id:'s', label:'Source'}]} .attachments=${[{attachmentId:'a', name:'Note'}]}></lr-prompt-input>`);
  const root = el.shadowRoot!;
  const model = root.querySelector('lr-model-select')!;
  const voice = root.querySelector('lr-voice-picker')!;
  const queue = root.querySelector('lr-prompt-queue')!;
  const source = root.querySelector('lr-source-picker')!;
  const trigger = root.querySelector('lr-attachment-trigger')!;
  const chip = root.querySelector('lr-attachment-chip')!;
  const events: string[] = [];
  for (const name of ['lr-model-change', 'lr-voice-change', 'lr-sources-change', 'lr-attachments-add', 'lr-attachment-remove', 'lr-queue-change']) {
    el.addEventListener(name, () => events.push(name));
  }
  for (const locked of [false, true]) {
    el.readOnly = locked;
    await el.updateComplete;
    expect([model.readonly, voice.readonly, queue.readonly, source.inert, trigger.disabled, chip.withoutRemoveButton])
      .to.deep.equal(Array(6).fill(locked));
  }
  for (const [child, name] of [[model, 'lr-change'], [voice, 'lr-change'], [queue, 'lr-queue-change'],
    [source, 'lr-selection-change'], [chip, 'lr-remove'], [trigger, 'lr-files']] as const) {
    child.dispatchEvent(new CustomEvent(name, { detail: {}, bubbles: true, composed: true }));
  }
  expect(chip.inert).to.equal(false);
  expect(events).to.deep.equal([]);
});

it('keeps readonly queue pagination available and hides unavailable row and retry actions', async () => {
  const queue = Array.from({ length: 21 }, (_, index) => ({ id: String(index), value: String(index) }));
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-input']>(html`<lr-prompt-input
    .queue=${queue} .attachments=${[{ attachmentId: 'a', name: 'Note', status: 'error' }]}></lr-prompt-input>`);
  const inner = el.shadowRoot!.querySelector('lr-prompt-queue')!;
  const chip = el.shadowRoot!.querySelector('lr-attachment-chip')!;
  const actions = () => inner.shadowRoot!.querySelector('[part="actions"]')!;
  const retry = chip.shadowRoot!.querySelector('[part="retry-button"]')!;
  expect(getComputedStyle(actions()).display).not.to.equal('none');
  expect(getComputedStyle(retry).display).not.to.equal('none');
  el.readOnly = true;
  await el.updateComplete;
  expect(getComputedStyle(actions()).display).to.equal('none');
  expect(getComputedStyle(retry).display).to.equal('none');
  inner.shadowRoot!.querySelector<HTMLElement>('[data-page-action="next"]')!.click();
  await inner.updateComplete;
  expect(inner.shadowRoot!.querySelector('[part="value"]')!.textContent).to.equal('20');
});

it('keeps the embedded pickers\' value, request and popup events from posing as its own', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-input']>(html`<lr-prompt-input
    .modelCatalog=${['m']} .voiceCatalog=${['v']}></lr-prompt-input>`);
  const root = el.shadowRoot!;
  const names = ['lr-input', 'lr-change-request', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'];
  const leaked: string[] = [];
  for (const name of names) el.addEventListener(name, () => leaked.push(name));
  for (const picker of [root.querySelector('lr-model-select')!, root.querySelector('lr-voice-picker')!]) {
    for (const name of names) {
      picker.dispatchEvent(new CustomEvent(name, { detail: { value: 'm', inCatalog: true }, bubbles: true, composed: true }));
    }
  }
  expect(leaked).to.deep.equal([]);
});

it('tracks a composed picker commit so reassigning the held value rolls the picker back', async () => {
  const el = await fixture<LyraPromptInput>(html`<lr-prompt-input model="a" voice="v1"
    .modelCatalog=${['a', 'b']} .voiceCatalog=${['v1', 'v2']}
    .sources=${[{ id: 's1', label: 'One' }, { id: 's2', label: 'Two' }]} .selectedSourceIds=${['s1']}></lr-prompt-input>`);
  const root = el.shadowRoot!;
  const commit = (picker: Element & { value?: string; selectedSourceIds?: readonly string[] }, type: string, detail: object): void => {
    Object.assign(picker, 'selectedSourceIds' in detail ? detail : { value: (detail as { value: string }).value });
    picker.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  };
  const model = root.querySelector('lr-model-select')!;
  const voice = root.querySelector('lr-voice-picker')!;
  const sources = root.querySelector('lr-source-picker')!;
  commit(model, 'lr-change', { value: 'b', inCatalog: true });
  commit(voice, 'lr-change', { value: 'v2', inCatalog: true });
  commit(sources, 'lr-selection-change', { selectedSourceIds: ['s2'] });
  expect([el.model, el.voice, [...el.selectedSourceIds]]).to.deep.equal(['b', 'v2', ['s2']]);
  el.model = 'a'; el.voice = 'v1'; el.selectedSourceIds = ['s1'];
  await el.updateComplete;
  expect([model.value, voice.value, [...sources.selectedSourceIds]]).to.deep.equal(['a', 'v1', ['s1']]);
});
