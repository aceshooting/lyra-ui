import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './chip.js';
import type { LyraChip } from './chip.class.js';

interface LabelObservationSeam {
  labelTextObserver: { bind(): void };
}

it('keeps label observation bound across selected and disabled paints', async () => {
  const chip = await fixture<LyraChip>(html`<lr-chip toggleable>Stable name</lr-chip>`);
  await nextFrame();
  const observer = (chip as unknown as LabelObservationSeam).labelTextObserver;
  const original = observer.bind;
  let binds = 0;
  observer.bind = function () { binds++; original.call(this); };
  try {
    chip.selected = true;
    await chip.updateComplete;
    chip.disabled = true;
    await chip.updateComplete;
    chip.disabled = false;
    await chip.updateComplete;
    chip.selected = false;
    await chip.updateComplete;
    const button = chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!;
    expect(button.getAttribute('aria-label')).to.equal('Stable name');
    expect(button.getAttribute('aria-pressed')).to.equal('false');
    expect(button.disabled).to.equal(false);
    expect(binds, 'state-only paints retain the existing label observation').to.equal(0);
  } finally { observer.bind = original; }
});

it('refreshes a pending label edit during a disabled paint and keeps subsequent edits live', async () => {
  const chip = await fixture<LyraChip>(html`<lr-chip toggleable><span>Before</span></lr-chip>`);
  await nextFrame();
  const label = chip.querySelector('span')!;
  const button = chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!;
  const observer = (chip as unknown as LabelObservationSeam).labelTextObserver;
  const original = observer.bind;
  let binds = 0;
  observer.bind = function () { binds++; original.call(this); };
  try {
    // Queue the host paint first so hostUpdated must preserve the already-pending text edit.
    chip.disabled = true;
    label.textContent = 'Updated';
    await chip.updateComplete;
    await waitUntil(() => button.getAttribute('aria-label') === 'Updated');
    expect(button.disabled).to.equal(true);
    expect(binds, 'pending content still refreshes the observation').to.be.greaterThan(0);
    label.textContent = 'Still live';
    await waitUntil(() => button.getAttribute('aria-label') === 'Still live');
    expect(button.disabled).to.equal(true);
  } finally { observer.bind = original; }
});
