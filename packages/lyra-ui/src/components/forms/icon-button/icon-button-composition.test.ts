import { expect, fixture, html } from '@open-wc/testing';
import './icon-button.js';
import type { LyraIconButton } from './icon-button.class.js';

function nativeControl(el: LyraIconButton): HTMLButtonElement {
  return el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

describe('lr-icon-button: composition contract', () => {
  it('sizes slotted em-based glyphs from the surrounding font, not the UA button font', async () => {
    const el = (await fixture(html`
      <lr-icon-button aria-label="Close" style="font-size: 20px;">
        <svg width="1em" height="1em" viewBox="0 0 24 24"><circle r="8" cx="12" cy="12"></circle></svg>
      </lr-icon-button>
    `)) as LyraIconButton;
    await el.updateComplete;
    // Slotted content inherits through the FLATTENED tree, so without `font: inherit` on the
    // native control this glyph would take the UA button font-size (13.33px at a 16px root).
    const glyph = el.querySelector('svg')!;
    expect(getComputedStyle(glyph).width).to.equal('20px');
    expect(getComputedStyle(glyph).height).to.equal('20px');
    expect(getComputedStyle(nativeControl(el)).fontSize).to.equal('20px');
  });

  it('names itself from host aria-labelledby IDREFs across the shadow boundary', async () => {
    const host = await fixture(html`
      <div>
        <span id="verb">Move up</span><span id="item">Second row</span>
        <lr-icon-button aria-labelledby="verb item">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        </lr-icon-button>
      </div>
    `);
    const el = host.querySelector<LyraIconButton>('lr-icon-button')!;
    await el.updateComplete;
    const control = nativeControl(el) as HTMLButtonElement & {
      ariaLabelledByElements?: readonly Element[] | null;
    };
    // No engine fallback branch. The forwarded `aria-labelledby` STRING on the host cannot name
    // this control at all -- an idref does not cross a shadow boundary -- so a branch that
    // asserted the host attribute would be asserting what the fixture itself wrote, and could
    // never fail, while the projection this test exists to cover went unverified.
    expect(
      'ariaLabelledByElements' in control,
      'the engine reflects element references; without it the composed control has no name at all'
    ).to.equal(true);
    const resolved = control.ariaLabelledByElements ?? [];
    expect(resolved.map((node) => node.id)).to.deep.equal(['verb', 'item']);
  });

  it('contributes one logical toolbar action that leases the internal tab stop', async () => {
    const el = (await fixture(html`
      <lr-icon-button aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
      </lr-icon-button>
    `)) as LyraIconButton;
    await el.updateComplete;
    const [action] = el.getToolbarActions();
    expect(action?.id).to.equal('icon-button');
    expect(action?.disabled).to.equal(false);

    action!.setTabIndex(-1);
    expect(
      nativeControl(el).getAttribute('tabindex'),
      'the lease reaches the native control, not the host'
    ).to.equal('-1');
    expect(el.hasAttribute('tabindex'), 'the host itself is never given a tab stop').to.equal(false);

    action!.setTabIndex(0);
    expect(nativeControl(el).getAttribute('tabindex')).to.equal('0');

    action!.releaseTabIndex?.();
    expect(
      nativeControl(el).hasAttribute('tabindex'),
      'releasing restores the untouched authored value'
    ).to.equal(false);
  });

  it('reports the action as disabled while the host is disabled', async () => {
    const el = (await fixture(html`
      <lr-icon-button aria-label="Close" disabled>
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
      </lr-icon-button>
    `)) as LyraIconButton;
    await el.updateComplete;
    expect(el.getToolbarActions()[0]?.disabled).to.equal(true);
  });

  it('matches its own composed event path', async () => {
    const el = (await fixture(html`
      <lr-icon-button aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
      </lr-icon-button>
    `)) as LyraIconButton;
    await el.updateComplete;
    let path: readonly EventTarget[] = [];
    el.addEventListener('click', (event) => {
      path = event.composedPath();
    });
    el.click();
    expect(el.getToolbarActions()[0]?.matchesEventPath(path)).to.equal(true);
  });
});
