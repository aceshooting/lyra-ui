import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './chip-group.js';
import './chip.js';
import type { LyraChipGroup } from './chip-group.js';

describe('lr-chip-group focus repair edge cases', () => {
  it('falls back to the group base when the only chip is hidden by the consumer while focused', async () => {
    const el = (await fixture(html`
      <lr-chip-group>
        <lr-chip toggleable>only</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    const chip = el.querySelector<HTMLElement>('lr-chip')!;
    chip.focus();
    expect(chip.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle-button');

    chip.hidden = true;
    await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'base', 'focus moves to the group base');
    expect(el.shadowRoot!.querySelector('[part="overflow-indicator"]') === null).to.equal(true);
  });

  it('does not track focus inside a child that has no focus() method', async () => {
    const el = (await fixture(html`
      <lr-chip-group>
        <lr-chip toggleable>sibling</lr-chip>
      </lr-chip-group>
    `)) as LyraChipGroup;
    const foreign = document.createElementNS('urn:lyra-coverage-test', 'x-foreign');
    const inner = document.createElement('button');
    inner.textContent = 'inside';
    foreign.append(inner);
    el.append(foreign);
    await el.updateComplete;
    const sibling = el.querySelector<HTMLElement>('lr-chip')!;

    inner.focus();
    expect(document.activeElement === inner).to.equal(true);

    foreign.setAttribute('hidden', '');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await el.updateComplete;
    // Focus tracking never started for this child, so no repair moved focus onto the sibling.
    expect(sibling.shadowRoot!.activeElement === null).to.equal(true);
  });
});
