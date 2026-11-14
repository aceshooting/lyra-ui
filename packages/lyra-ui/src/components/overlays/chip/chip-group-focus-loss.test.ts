import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chip-group.js';
import './chip.js';
import type { LyraChipGroup } from './chip-group.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

function focusedPart(chip: HTMLElement): string | null {
  return chip.shadowRoot?.activeElement?.getAttribute('part') ?? null;
}

async function group(): Promise<{ el: LyraChipGroup; chips: HTMLElement[] }> {
  const el = await fixture<LyraChipGroup>(html`
    <lr-chip-group>
      <lr-chip toggleable id="one">one</lr-chip>
      <lr-chip toggleable id="two">two</lr-chip>
      <lr-chip toggleable id="three">three</lr-chip>
    </lr-chip-group>
  `);
  await el.updateComplete;
  return { el, chips: Array.from(el.querySelectorAll<HTMLElement>('lr-chip')) };
}

describe('lr-chip-group focus repair after the focused chip leaves', () => {
  it('moves focus to the chip that takes the removed chip\'s place', async () => {
    const { chips } = await group();
    await focusByKeyboard(chips[1]!);
    expect(focusedPart(chips[1]!)).to.equal('toggle-button');

    chips[1]!.remove();

    await waitUntil(() => focusedPart(chips[2]!) === 'toggle-button', 'focus repaired onto the next chip');
    expect(focusedPart(chips[0]!)).to.equal(null);
  });

  it('breaks an equal-distance tie toward the earlier chip when the focused chip is hidden', async () => {
    const { chips } = await group();
    await focusByKeyboard(chips[1]!);

    chips[1]!.hidden = true;

    await waitUntil(() => focusedPart(chips[0]!) === 'toggle-button', 'focus repaired onto the earlier neighbour');
    expect(focusedPart(chips[2]!)).to.equal(null);
  });

  it('forgets a tracked chip once focus moves to a control outside the group', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-chip-group>
          <lr-chip toggleable>one</lr-chip>
          <lr-chip toggleable>two</lr-chip>
        </lr-chip-group>
        <button id="outside">Outside</button>
      </div>
    `);
    const el = wrapper.querySelector<LyraChipGroup>('lr-chip-group')!;
    await el.updateComplete;
    const chips = Array.from(el.querySelectorAll<HTMLElement>('lr-chip'));
    const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
    await focusByKeyboard(chips[1]!);
    await focusByKeyboard(outside);
    await Promise.resolve();

    chips[1]!.remove();
    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(document.activeElement === outside).to.equal(true);
    expect(focusedPart(chips[0]!)).to.equal(null);
  });
});
