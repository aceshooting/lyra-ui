import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { contrastRatio, effectiveBackground, toRgba } from '../../../../test/color-contrast.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './command-palette.js';
import type { LyraCommandPalette } from './command-palette.js';

for (const mode of ['light', 'dark']) {
  it(`keeps highlighted command descriptions and shortcuts readable in ${mode} mode`, async () => {
    const palette = await fixture<LyraCommandPalette>(html`<lr-command-palette data-lr-theme-scope
      style=${mode === 'dark'
        ? '--lr-transition-fast:0ms;--lr-color-brand-quiet:#204638;--lr-color-text:#fafafa;--lr-color-text-quiet:#a1a1a1;--lr-color-surface-container-highest:#171717'
        : '--lr-transition-fast:0ms;--lr-color-brand-quiet:#e3f9f1;--lr-color-text:#0a0a0a;--lr-color-text-quiet:#737373;--lr-color-surface-container-highest:#ffffff'}
      .commands=${[
        { commandId: 'new', label: 'New', description: 'Create a blank document', shortcut: 'Mod+N' },
        { commandId: 'bold', label: 'Bold', description: 'Toggle bold on the original selection', shortcut: 'Mod+B' },
      ]}></lr-command-palette>`);
    palette.openPalette();
    await palette.updateComplete;
    const input = palette.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
    await waitUntil(() => palette.shadowRoot!.activeElement === input);
    await sendKeys({ press: 'ArrowDown' });
    await palette.updateComplete;
    const selected = palette.shadowRoot!.querySelector<HTMLButtonElement>('[part="command"][aria-selected="true"]')!;
    expect(selected.textContent).to.include('Bold');
    for (const part of ['description', 'shortcut']) {
      const text = selected.querySelector<HTMLElement>(`[part="${part}"]`)!;
      expect(contrastRatio(getComputedStyle(text).color, getComputedStyle(selected).backgroundColor), `${mode}/${part}/keyboard`).to.be.at.least(4.5);
    }
    await expect(palette).to.be.accessible();
    const hovered = palette.shadowRoot!.querySelector<HTMLButtonElement>('[part="command"]')!;
    try {
      await hoverUntilMatched(hovered, 'pointer reached the populated command row');
      await palette.updateComplete;
      for (const part of ['description', 'shortcut']) {
        const text = hovered.querySelector<HTMLElement>(`[part="${part}"]`)!;
        expect(contrastRatio(getComputedStyle(text).color, getComputedStyle(hovered).backgroundColor), `${mode}/${part}/hover`).to.be.at.least(4.5);
      }
    } finally { await resetMouse(); palette.close(); }
  });
}

it('keeps secondary command text readable while the previous highlight fades out', async () => {
  await resetMouse();
  const palette = await fixture<LyraCommandPalette>(html`<lr-command-palette data-lr-theme-scope
    style="--lr-transition-fast:10s;--lr-color-brand-quiet:#e3f9f1;--lr-color-text:#0a0a0a;--lr-color-text-quiet:#737373;--lr-color-surface-container-highest:#ffffff"
    .commands=${[
      { commandId: 'new', label: 'New', description: 'Create a blank document', shortcut: 'Mod+N' },
      { commandId: 'bold', label: 'Bold', description: 'Toggle bold on the original selection', shortcut: 'Mod+B' },
    ]}></lr-command-palette>`);
  palette.openPalette();
  await palette.updateComplete;
  try {
    const input = palette.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
    const dialog = palette.shadowRoot!.querySelector<HTMLElement>('[part="dialog"]')!;
    await waitUntil(() => palette.shadowRoot!.activeElement === input);
    const rows = [...palette.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="command"]')];
    const previous = rows[0]!;
    const highlight = getComputedStyle(previous).backgroundColor;
    for (const row of rows) {
      for (const part of ['description', 'shortcut']) {
        const text = row.querySelector<HTMLElement>(`[part="${part}"]`)!;
        expect(contrastRatio(getComputedStyle(text).color, effectiveBackground(row, dialog)), `${part}/initial`).to.be.at.least(4.5);
      }
    }

    await sendKeys({ press: 'ArrowDown' });
    await palette.updateComplete;
    expect(previous.dataset['active']).to.equal('false');
    expect(previous.matches(':hover')).to.equal(false);
    const transition = previous.getAnimations().find((animation) =>
      animation instanceof CSSTransition && animation.transitionProperty === 'background-color',
    );
    expect(transition, 'the previous row has a real background fade-out').not.to.equal(undefined);
    transition!.pause();
    transition!.currentTime = 0;
    expect(toRgba(getComputedStyle(previous).backgroundColor)).to.deep.equal(toRgba(highlight));
    expect(toRgba(getComputedStyle(previous).backgroundColor)[3]).to.equal(255);
    for (const part of ['description', 'shortcut']) {
      const text = previous.querySelector<HTMLElement>(`[part="${part}"]`)!;
      expect(contrastRatio(getComputedStyle(text).color, getComputedStyle(previous).backgroundColor), `${part}/fade-out`).to.be.at.least(4.5);
    }

    transition!.finish();
    for (const part of ['description', 'shortcut']) {
      const text = previous.querySelector<HTMLElement>(`[part="${part}"]`)!;
      expect(contrastRatio(getComputedStyle(text).color, effectiveBackground(previous, dialog)), `${part}/resting`).to.be.at.least(4.5);
    }
  } finally { palette.close(); }
});
