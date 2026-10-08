import { expect, fixture, html } from '@open-wc/testing';
import { parseHotkey, hasNonShiftModifier, matchesHotkey, hotkeyAriaKeyShortcuts, isIgnorableKeyEvent, isEditableKeyEventTarget, registerHotkeyOwner, unregisterHotkeyOwner, resolveHotkeyOwner, keyEventOwnedByInnerControl } from './hotkey.js';
import type { InnerControlKeyOptions } from './hotkey.js';

describe('shared hotkeys', () => {
  it('parses valid chords and rejects ambiguous modifiers and invalid input', () => {
    for (const text of ['mod+k', 'ctrl+p', 'mod+shift+p', 'k']) expect(parseHotkey(text)?.key).to.equal(text.split('+').at(-1));
    for (const text of ['', 'ctrl+ctrl+k', 'hyper+k', 'mod+ctrl+k', 'mod+meta+k', null, 42]) expect(parseHotkey(text)).to.equal(null);
    expect(parseHotkey(' CTRL + B ')?.ctrl).to.equal(true);
    for (const text of ['b', 'shift+b']) expect(hasNonShiftModifier(parseHotkey(text)!)).to.equal(false);
    for (const text of ['ctrl+b', 'mod+b', 'alt+b', 'meta+b']) expect(hasNonShiftModifier(parseHotkey(text)!)).to.equal(true);
  });
  it('matches exact modifiers, with layout fallback only for non-ASCII keys', () => {
    const match = (chord: string, init: KeyboardEventInit, mac = false) => matchesHotkey(parseHotkey(chord), new KeyboardEvent('keydown', init), mac);
    expect(match('mod+b', { key: 'b', ctrlKey: true })).to.equal(true);
    expect(match('mod+b', { key: 'b', metaKey: true }, true)).to.equal(true);
    expect(match('mod+b', { key: 'b', ctrlKey: true, shiftKey: true })).to.equal(false);
    expect(match('ctrl+b', { key: 'и', code: 'KeyB', ctrlKey: true })).to.equal(true);
    expect(match('alt+b', { key: '∫', code: 'KeyB', altKey: true })).to.equal(true);
    expect(match('alt+e', { key: 'Dead', code: 'KeyE', altKey: true })).to.equal(true);
    expect(match('ctrl+b', { key: 'x', code: 'KeyB', ctrlKey: true })).to.equal(false);
    expect(match('ctrl+shift+1', { key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true })).to.equal(false);
    expect(matchesHotkey(null, new KeyboardEvent('keydown', { key: 'b' }), false)).to.equal(false);
  });
  it('serializes machine ARIA names and ignores unusable keyboard events', () => {
    expect(hotkeyAriaKeyShortcuts(parseHotkey('mod+b'), false)).to.equal('Control+B');
    expect(hotkeyAriaKeyShortcuts(parseHotkey('mod+b'), true)).to.equal('Meta+B');
    expect(hotkeyAriaKeyShortcuts(parseHotkey('mod+shift+k'), false)).to.equal('Control+Shift+K');
    expect(hotkeyAriaKeyShortcuts(parseHotkey('mod+shift+k'), true)).to.equal('Meta+Shift+K');
    expect(hotkeyAriaKeyShortcuts(parseHotkey('ctrl+escape'), false)).to.equal(null);
    expect(isIgnorableKeyEvent(new Event('keydown'))).to.equal(true);
    for (const init of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }]) expect(isIgnorableKeyEvent(new KeyboardEvent('keydown', { key: 'b', ...init }))).to.equal(true);
    expect(isIgnorableKeyEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))).to.equal(false);
  });
  it('recognizes editable targets across a shadow boundary but accepts checkboxes', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><input /><input type="checkbox" /><textarea></textarea><div contenteditable="true"></div><section></section></div>`);
    const host = wrapper.querySelector('section')!; host.attachShadow({ mode: 'open' }).innerHTML = '<input />';
    let editable = false; wrapper.addEventListener('keydown', event => { editable = isEditableKeyEventTarget(event); });
    for (const target of [wrapper.querySelector('input')!, wrapper.querySelector('textarea')!, wrapper.querySelector('[contenteditable]')!, host.shadowRoot!.querySelector('input')!]) {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', composed: true, bubbles: true })); expect(editable).to.equal(true);
    }
    wrapper.querySelector('[type="checkbox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true })); expect(editable).to.equal(false);
  });
  it('shares last-eligible ownership, reconnect ordering and per-window isolation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><div id="rail"></div><div id="palette"></div><iframe></iframe></div>`);
    const rail = wrapper.querySelector('#rail')!; const palette = wrapper.querySelector('#palette')!;
    const other = wrapper.querySelector('iframe')!.contentWindow!; const event = new KeyboardEvent('keydown', { key: 'b' });
    try {
      registerHotkeyOwner(window, rail, () => true); registerHotkeyOwner(window, palette, () => true);
      expect(resolveHotkeyOwner(window, event)?.id).to.equal('palette'); expect(resolveHotkeyOwner(other, event)).to.equal(undefined);
      registerHotkeyOwner(window, rail, () => true); expect(resolveHotkeyOwner(window, event)?.id).to.equal('rail');
      registerHotkeyOwner(window, rail, () => false); expect(resolveHotkeyOwner(window, event)?.id).to.equal('palette');
      unregisterHotkeyOwner(window, palette); expect(resolveHotkeyOwner(window, event)).to.equal(undefined);
      registerHotkeyOwner(other, rail, () => true); expect(resolveHotkeyOwner(other, event)?.id).to.equal('rail');
    } finally { unregisterHotkeyOwner(window, rail); unregisterHotkeyOwner(window, palette); unregisterHotkeyOwner(other, rail); }
  });
});

describe('keyEventOwnedByInnerControl', () => {
  /** Dispatches a key from `selector` and evaluates ownership while the event is still in flight. */
  async function probe(selector: string, markup: ReturnType<typeof html>) {
    const container = await fixture<HTMLElement>(markup);
    const target = selector === ':scope' ? container : container.querySelector<HTMLElement>(selector)!;
    return {
      container,
      owned(extra: Omit<InnerControlKeyOptions, 'container'> = {}): boolean {
        let result = false;
        const listen = (event: Event): void => {
          result = keyEventOwnedByInnerControl(event, { container, ...extra });
        };
        container.addEventListener('keydown', listen, { once: true });
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
        return result;
      },
    };
  }

  it('is owned by an inner editor or widget, and not by the container itself', async () => {
    expect((await probe('input', html`<div><input /></div>`)).owned()).to.equal(true);
    expect((await probe(':scope', html`<div></div>`)).owned()).to.equal(false);
  });

  it('treats buttons and links as owners only with ownsButtons', async () => {
    const { owned } = await probe('button', html`<div><button>Go</button></div>`);
    expect(owned()).to.equal(false);
    expect(owned({ ownsButtons: true })).to.equal(true);
  });

  it('treats a custom element as an owner only with ownsCustomElements, unless ignored', async () => {
    const { container, owned } = await probe('x-inner', html`<div><x-inner></x-inner></div>`);
    const inner = container.querySelector('x-inner')!;
    expect(owned()).to.equal(false);
    expect(owned({ ownsCustomElements: true })).to.equal(true);
    expect(owned({ ownsCustomElements: true, ignoreCustomElements: new Set([inner]) })).to.equal(false);
    expect(owned({ ownerTag: 'x-inner' })).to.equal(true);
  });
});
