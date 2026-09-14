import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import './menu-label.js';
import type { LyraMenuItem } from './menu-item.class.js';
import type { LyraMenu } from './menu.class.js';

for (const change of ['disable', 'remove'] as const) {
  for (const focus of ['outside', 'header', 'footer', 'item'] as const) {
    it(`repairs ${change} roving state while preserving ${focus} focus`, async () => {
      const root = await fixture<HTMLElement>(html`<div>
        <button id="outside">Outside</button>
        <lr-menu>
          <button id="header" slot="header">Header</button>
          <lr-menu-label>Caption</lr-menu-label>
          <lr-menu-item id="first">First</lr-menu-item>
          <lr-menu-item id="middle">Middle</lr-menu-item>
          <lr-menu-item id="last">Last</lr-menu-item>
          <button id="footer" slot="footer">Footer</button>
        </lr-menu>
      </div>`);
      const item = root.querySelector<LyraMenuItem>('#middle')!;
      item.focus();
      await waitUntil(() => item.tabIndex === 0);
      if (focus !== 'item') root.querySelector<HTMLElement>(`#${focus}`)!.focus();
      if (change === 'disable') item.disabled = true;
      else item.remove();
      await waitUntil(() => [...root.querySelectorAll<LyraMenuItem>('lr-menu-item')].some(candidate => candidate.id !== 'middle' && candidate.tabIndex === 0));
      const stop = root.querySelector<LyraMenuItem>('lr-menu-item[tabindex="0"]')!;
      expect(stop.interactionDisabled).to.equal(false);
      if (focus === 'item') expect(document.activeElement?.id).to.equal(stop.id);
      else expect(document.activeElement?.id).to.equal(focus);
      expect(root.querySelectorAll('lr-menu-item[tabindex="0"]').length).to.equal(1);
    });
  }
}

/**
 * Regression: ARIA idrefs do not cross a shadow boundary -- a host-authored `aria-describedby`
 * never reached `[part="list"]`'s own `role="menu"`, which is the element that actually owns the
 * accessible description.
 */
describe('lr-menu host aria-describedby reflection', () => {
  it('merges a host-authored aria-describedby onto the list description', async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <p id="extra-context">Extra context for the menu.</p>
      <lr-menu label="Actions" aria-describedby="extra-context">
        <lr-menu-item value="rename">Rename</lr-menu-item>
      </lr-menu>
    </div>`);
    const menu = root.querySelector('lr-menu') as LyraMenu;
    await menu.updateComplete;

    const list = menu.shadowRoot!.querySelector('[part="list"]') as HTMLElement & {
      ariaDescribedByElements?: Element[] | null;
    };
    const extra = root.querySelector('#extra-context') as HTMLElement;
    if (Reflect.has(list, 'ariaDescribedByElements')) {
      expect(list.ariaDescribedByElements ?? [], 'reflected description').to.include(extra);
    } else {
      expect(list.getAttribute('aria-describedby') ?? '', 'fallback description').to.contain(
        'extra-context'
      );
    }
  });
});

describe('menu type-ahead reset debounce', () => {
  const menuFixture = (): Promise<LyraMenu> =>
    fixture<LyraMenu>(html`<lr-menu>
      <lr-menu-item>Delete</lr-menu-item>
      <lr-menu-item>Details</lr-menu-item>
      <lr-menu-item>Export</lr-menu-item>
    </lr-menu>`);
  const bufferOf = (el: LyraMenu): string =>
    (el as unknown as { typeAheadBuffer: string }).typeAheadBuffer;
  const typeAhead = (el: LyraMenu, char: string): void => {
    (el as unknown as { typeAhead(char: string): void }).typeAhead(char);
  };

  it('restarts the reset on every keystroke instead of clearing a buffer a later one owns', async () => {
    const el = await menuFixture();
    typeAhead(el, 'd');
    expect(bufferOf(el)).to.equal('d');
    await aTimeout(300);
    typeAhead(el, 'e');
    expect(bufferOf(el), 'a second keystroke extends the buffer').to.equal('de');
    await aTimeout(350);
    expect(bufferOf(el), 'the superseded reset must not clear it').to.equal('de');
    await aTimeout(400);
    expect(bufferOf(el), 'the surviving reset still fires on its own schedule').to.equal('');
  });

  it('still resets its buffer after a disconnect and reconnect', async () => {
    // The reset runs on the shared DebounceController. Teardown must `cancel()` it, never
    // `dispose()` it: a disconnect here may be a re-parent, and a disposed controller silently
    // refuses every later push, leaving a reconnected menu with a buffer that never clears.
    const el = await menuFixture();
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    typeAhead(el, 'e');
    expect(bufferOf(el), 'a reconnected menu still accumulates').to.equal('e');
    await aTimeout(700);
    expect(bufferOf(el), 'and its reset still fires').to.equal('');
  });
});
