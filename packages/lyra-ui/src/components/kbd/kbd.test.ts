import { fixture, expect, html } from '@open-wc/testing';
import './kbd.js';
import type { LyraKbd } from './kbd.js';
import { shortcutTokenLabel, parseShortcut } from './kbd.js';

describe('shortcutTokenLabel (pure, parameterized on isMac)', () => {
  it('resolves "mod" to the Mac glyph on macOS and to "Ctrl" elsewhere', () => {
    expect(shortcutTokenLabel('mod', true)).to.deep.equal({ visual: '⌘', word: 'Command' });
    expect(shortcutTokenLabel('mod', false)).to.deep.equal({ visual: 'Ctrl', word: 'Control' });
  });

  it('resolves "ctrl" to the literal Control key on every platform, distinct from "mod"', () => {
    expect(shortcutTokenLabel('ctrl', true)).to.deep.equal({ visual: 'Ctrl', word: 'Control' });
    expect(shortcutTokenLabel('ctrl', false)).to.deep.equal({ visual: 'Ctrl', word: 'Control' });
  });

  it('resolves "alt" to the Mac glyph on macOS and to "Alt" elsewhere', () => {
    expect(shortcutTokenLabel('alt', true)).to.deep.equal({ visual: '⌥', word: 'Option' });
    expect(shortcutTokenLabel('alt', false)).to.deep.equal({ visual: 'Alt', word: 'Alt' });
  });

  it('resolves "shift" to the same glyph regardless of platform', () => {
    expect(shortcutTokenLabel('shift', true)).to.deep.equal({ visual: '⇧', word: 'Shift' });
    expect(shortcutTokenLabel('shift', false)).to.deep.equal({ visual: '⇧', word: 'Shift' });
  });

  it('is case-insensitive for recognized modifier/named tokens', () => {
    expect(shortcutTokenLabel('MOD', false)).to.deep.equal({ visual: 'Ctrl', word: 'Control' });
    expect(shortcutTokenLabel('Esc', false)).to.deep.equal({ visual: 'Esc', word: 'Escape' });
  });

  it('maps the built-in named-key friendly labels', () => {
    expect(shortcutTokenLabel('enter', false)).to.deep.equal({ visual: '↵', word: 'Enter' });
    expect(shortcutTokenLabel('esc', false)).to.deep.equal({ visual: 'Esc', word: 'Escape' });
    expect(shortcutTokenLabel('arrowup', false)).to.deep.equal({ visual: '↑', word: 'Arrow Up' });
    expect(shortcutTokenLabel('arrowdown', false)).to.deep.equal({ visual: '↓', word: 'Arrow Down' });
    expect(shortcutTokenLabel('arrowleft', false)).to.deep.equal({ visual: '←', word: 'Arrow Left' });
    expect(shortcutTokenLabel('arrowright', false)).to.deep.equal({ visual: '→', word: 'Arrow Right' });
    expect(shortcutTokenLabel('tab', false)).to.deep.equal({ visual: 'Tab', word: 'Tab' });
    expect(shortcutTokenLabel('backspace', false)).to.deep.equal({ visual: '⌫', word: 'Backspace' });
  });

  it('upper-cases an unrecognized single letter/digit token', () => {
    expect(shortcutTokenLabel('k', false)).to.deep.equal({ visual: 'K', word: 'K' });
    expect(shortcutTokenLabel('K', false)).to.deep.equal({ visual: 'K', word: 'K' });
    expect(shortcutTokenLabel('1', false)).to.deep.equal({ visual: '1', word: '1' });
  });

  it('renders an unrecognized multi-char token as typed, preserving case', () => {
    expect(shortcutTokenLabel('F1', false)).to.deep.equal({ visual: 'F1', word: 'F1' });
    expect(shortcutTokenLabel('PageDown-ish', false)).to.deep.equal({ visual: 'PageDown-ish', word: 'PageDown-ish' });
  });

  it('resolves the built-in English text unchanged when no localize callback is passed (existing 2-arg calls)', () => {
    expect(shortcutTokenLabel('esc', false)).to.deep.equal({ visual: 'Esc', word: 'Escape' });
  });

  it('routes every localizable visual/word through the optional localize callback, by key', () => {
    const calls: Array<{ key: string; fallback: string }> = [];
    const localize = (key: string, fallback: string): string => {
      calls.push({ key, fallback });
      return `[${key}]`;
    };

    expect(shortcutTokenLabel('mod', false, localize)).to.deep.equal({
      visual: '[kbdControlVisual]',
      word: '[kbdControlWord]',
    });
    expect(shortcutTokenLabel('mod', true, localize)).to.deep.equal({ visual: '⌘', word: '[kbdCommandWord]' });
    expect(shortcutTokenLabel('ctrl', false, localize)).to.deep.equal({
      visual: '[kbdControlVisual]',
      word: '[kbdControlWord]',
    });
    expect(shortcutTokenLabel('alt', false, localize)).to.deep.equal({ visual: '[kbdAltWord]', word: '[kbdAltWord]' });
    expect(shortcutTokenLabel('alt', true, localize)).to.deep.equal({ visual: '⌥', word: '[kbdOptionWord]' });
    expect(shortcutTokenLabel('shift', false, localize)).to.deep.equal({ visual: '⇧', word: '[kbdShiftWord]' });
    expect(shortcutTokenLabel('esc', false, localize)).to.deep.equal({
      visual: '[kbdEscapeVisual]',
      word: '[kbdEscapeWord]',
    });
    expect(shortcutTokenLabel('escape', false, localize)).to.deep.equal({
      visual: '[kbdEscapeVisual]',
      word: '[kbdEscapeWord]',
    });
    expect(shortcutTokenLabel('tab', false, localize)).to.deep.equal({ visual: '[kbdTabWord]', word: '[kbdTabWord]' });
    expect(shortcutTokenLabel('space', false, localize)).to.deep.equal({
      visual: '[kbdSpaceWord]',
      word: '[kbdSpaceWord]',
    });
    expect(shortcutTokenLabel('backspace', false, localize)).to.deep.equal({ visual: '⌫', word: '[kbdBackspaceWord]' });
    expect(shortcutTokenLabel('delete', false, localize)).to.deep.equal({
      visual: '[kbdDeleteVisual]',
      word: '[kbdDeleteWord]',
    });
    expect(shortcutTokenLabel('home', false, localize)).to.deep.equal({
      visual: '[kbdHomeWord]',
      word: '[kbdHomeWord]',
    });
    expect(shortcutTokenLabel('end', false, localize)).to.deep.equal({ visual: '[kbdEndWord]', word: '[kbdEndWord]' });
    expect(shortcutTokenLabel('pageup', false, localize)).to.deep.equal({
      visual: '[kbdPageUpVisual]',
      word: '[kbdPageUpWord]',
    });
    expect(shortcutTokenLabel('pagedown', false, localize)).to.deep.equal({
      visual: '[kbdPageDownVisual]',
      word: '[kbdPageDownWord]',
    });
    expect(shortcutTokenLabel('enter', false, localize)).to.deep.equal({ visual: '↵', word: '[kbdEnterWord]' });
    expect(shortcutTokenLabel('arrowup', false, localize)).to.deep.equal({ visual: '↑', word: '[kbdArrowUpWord]' });
    expect(shortcutTokenLabel('arrowdown', false, localize)).to.deep.equal({
      visual: '↓',
      word: '[kbdArrowDownWord]',
    });
    expect(shortcutTokenLabel('arrowleft', false, localize)).to.deep.equal({
      visual: '←',
      word: '[kbdArrowLeftWord]',
    });
    expect(shortcutTokenLabel('arrowright', false, localize)).to.deep.equal({
      visual: '→',
      word: '[kbdArrowRightWord]',
    });
    expect(shortcutTokenLabel('plus', false, localize)).to.deep.equal({ visual: '+', word: '[kbdPlusWord]' });
    expect(shortcutTokenLabel('minus', false, localize)).to.deep.equal({ visual: '−', word: '[kbdMinusWord]' });

    // Fallback passed to every localize() call must be the exact built-in
    // English default (so a locale registry that only overrides *some* keys
    // still gets a correct fallback for the rest).
    expect(calls).to.deep.include({ key: 'kbdControlWord', fallback: 'Control' });
    expect(calls).to.deep.include({ key: 'kbdEscapeVisual', fallback: 'Esc' });
    expect(calls).to.deep.include({ key: 'kbdPageDownWord', fallback: 'Page Down' });
  });

  it('does not route an unrecognized token (bare letter/digit or as-typed) through localize -- these are not translatable words', () => {
    const localize = (): string => 'SHOULD NOT BE CALLED';
    expect(shortcutTokenLabel('k', false, localize)).to.deep.equal({ visual: 'K', word: 'K' });
    expect(shortcutTokenLabel('F1', false, localize)).to.deep.equal({ visual: 'F1', word: 'F1' });
  });
});

describe('parseShortcut', () => {
  it('splits on "+" and resolves each token', () => {
    expect(parseShortcut('mod+k', false)).to.deep.equal([
      { visual: 'Ctrl', word: 'Control' },
      { visual: 'K', word: 'K' },
    ]);
  });

  it('drops empty segments from stray/leading/trailing "+"s', () => {
    expect(parseShortcut('+mod++k+', false)).to.deep.equal([
      { visual: 'Ctrl', word: 'Control' },
      { visual: 'K', word: 'K' },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseShortcut('', false)).to.deep.equal([]);
  });

  it('threads an optional localize callback through to every resolved token', () => {
    const localize = (key: string): string => `[${key}]`;
    expect(parseShortcut('mod+k', false, localize)).to.deep.equal([
      { visual: '[kbdControlVisual]', word: '[kbdControlWord]' },
      { visual: 'K', word: 'K' },
    ]);
  });
});

describe('<lyra-kbd> rendering', () => {
  it('defaults keys to "" and renders nothing visible', async () => {
    const el = (await fixture(html`<lyra-kbd></lyra-kbd>`)) as LyraKbd;
    expect(el.keys).to.equal('');
    expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(0);
  });

  it('marks an empty (no keys, no slot) chip aria-hidden', async () => {
    const el = (await fixture(html`<lyra-kbd></lyra-kbd>`)) as LyraKbd;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-hidden')).to.equal('true');
    expect(base.hasAttribute('role')).to.be.false;
  });

  it('renders one [part="key"] per token, in order', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+shift+p"></lyra-kbd>`)) as LyraKbd;
    const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent?.trim());
    // This test environment (Playwright Chromium on Linux) is not macOS, so
    // "mod" resolves to "Ctrl" here — the mac-glyph branch is covered
    // directly (and platform-independently) by the shortcutTokenLabel unit
    // tests above.
    expect(keys).to.deep.equal(['Ctrl', '⇧', 'P']);
  });

  it('separates key caps with a "+" separator between them, none before the first', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k"></lyra-kbd>`)) as LyraKbd;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const seps = base.querySelectorAll('.sep');
    expect(seps.length).to.equal(1);
    expect(seps[0].textContent).to.equal('+');
  });

  it('sets role="img" and an aria-label spelling the shortcut out in words', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k"></lyra-kbd>`)) as LyraKbd;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('Control+K');
    expect(base.hasAttribute('aria-hidden')).to.be.false;
  });

  it('lets an explicit host aria-label override the computed word label', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k" aria-label="Open palette"></lyra-kbd>`)) as LyraKbd;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Open palette');
  });

  it('sets role="img" alongside an explicit aria-label even with empty keys and no slot content', async () => {
    // role and aria-hidden must both be derived from the same computed
    // ariaLabel value as aria-label itself -- an explicit label asserted on
    // a role-less element (role gated only on tokens.length) is an
    // aria-prohibited-attr violation.
    const el = (await fixture(html`<lyra-kbd aria-label="Something"></lyra-kbd>`)) as LyraKbd;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('Something');
    expect(base.hasAttribute('aria-hidden')).to.be.false;
    await expect(el).to.be.accessible();
  });

  it('reacts to the keys property changing after first render', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k"></lyra-kbd>`)) as LyraKbd;
    el.keys = 'esc';
    await el.updateComplete;
    const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent?.trim());
    expect(keys).to.deep.equal(['Esc']);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'Escape',
    );
  });
});

describe('default slot override', () => {
  it('bypasses keys-driven rendering when populated declaratively', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k">fn+F5</lyra-kbd>`)) as LyraKbd;
    expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(0);
    const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    const text = slot
      .assignedNodes({ flatten: true })
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    expect(text).to.equal('fn+F5');
  });

  it('does not assert a computed aria-label when using the slot override', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k">fn+F5</lyra-kbd>`)) as LyraKbd;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute('aria-label')).to.be.false;
    expect(base.hasAttribute('role')).to.be.false;
  });

  it('still honors an explicit host aria-label alongside the slot override', async () => {
    const el = (await fixture(html`<lyra-kbd aria-label="Custom shortcut">fn+F5</lyra-kbd>`)) as LyraKbd;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Custom shortcut');
  });

  it('reacts to the slot being populated after first render', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k"></lyra-kbd>`)) as LyraKbd;
    expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(2);

    el.textContent = 'fn+F5';
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(0);
  });

  it('does not permanently blank the chip for whitespace-only slotted text', async () => {
    // Whitespace-only text is not "real content": the keys-driven UI must
    // stay put both immediately (willUpdate's synchronous seed) and after
    // the initial <slot>'s slotchange fires (onSlotChange) -- before the
    // shared hasRealContent predicate, onSlotChange's own check counted any
    // assigned node, including a whitespace-only text node, as content and
    // permanently blanked the chip once that slotchange fired.
    const el = (await fixture(html`<lyra-kbd keys="mod+k">   </lyra-kbd>`)) as LyraKbd;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(2);
  });

  it('never flashes the keys-driven UI for icon-only slotted content', async () => {
    // An icon element carries no text of its own, so a purely text-based
    // "is there content" check would (wrongly) seed hasCustomContent false
    // on the very first render, flashing the keys-driven UI for a frame
    // before onSlotChange self-corrects. Inspecting the DOM after a couple
    // of microtask ticks -- deliberately before awaiting updateComplete --
    // catches that flash if it exists: with the shared hasRealContent
    // predicate, the element-node case is already handled on the very first
    // (synchronous) render, so [part="key"] must stay empty throughout.
    const el = document.createElement('lyra-kbd') as LyraKbd;
    el.setAttribute('keys', 'mod+k');
    el.appendChild(document.createElement('span'));
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();
    expect(el.shadowRoot?.querySelectorAll('[part="key"]').length ?? 0).to.equal(0);

    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(0);

    document.body.removeChild(el);
  });
});

describe('localization', () => {
  it('renders the built-in English key-cap text and aria-label with no override', async () => {
    const el = (await fixture(html`<lyra-kbd keys="mod+k"></lyra-kbd>`)) as LyraKbd;
    const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent?.trim());
    expect(keys).to.deep.equal(['Ctrl', 'K']);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'Control+K',
    );
  });

  it('localizes both the key-cap visual text and the aria-label word via .strings', async () => {
    const el = (await fixture(html`
      <lyra-kbd
        keys="mod+esc"
        .strings=${{
          kbdControlVisual: 'Strg',
          kbdControlWord: 'Steuerung',
          kbdEscapeVisual: 'Esc',
          kbdEscapeWord: 'Escape-Taste',
        }}
      ></lyra-kbd>
    `)) as LyraKbd;
    const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent?.trim());
    expect(keys).to.deep.equal(['Strg', 'Esc']);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'Steuerung+Escape-Taste',
    );
  });

  it('localizes a glyph-only modifier\'s word (used only in the aria-label, not the key cap) via .strings', async () => {
    const el = (await fixture(html`
      <lyra-kbd keys="shift" .strings=${{ kbdShiftWord: 'Majuscule' }}></lyra-kbd>
    `)) as LyraKbd;
    const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent?.trim());
    expect(keys).to.deep.equal(['⇧']);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'Majuscule',
    );
  });
});

it('is accessible in the default (empty) state', async () => {
  const el = (await fixture(html`<lyra-kbd></lyra-kbd>`)) as LyraKbd;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated multi-modifier state', async () => {
  const el = (await fixture(html`<lyra-kbd keys="mod+shift+p"></lyra-kbd>`)) as LyraKbd;
  await expect(el).to.be.accessible();
});
