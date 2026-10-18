import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './chip.js';
import type { LyraChip } from './chip.class.js';
import type { PropertyValues } from 'lit';

interface LabelObservationSeam {
  labelTextObserver: { bind(): void; observer?: MutationObserver };
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


interface InitialLabelObservationSeam extends LabelObservationSeam {
  updated(changed: PropertyValues<LyraChip>): void;
}

function afterFirstPaint(chip: LyraChip, action: () => void): () => void {
  const seam = chip as unknown as InitialLabelObservationSeam;
  const original = seam.updated;
  let first = true;
  seam.updated = function (changed) {
    // Queue before the original callback, then run outside Lit's update lifecycle.
    // This reaches the interval before any post-paint observation activation.
    if (first) { first = false; queueMicrotask(action); }
    original.call(this, changed);
  };
  return () => { seam.updated = original; };
}

it('binds initial action labels after sibling first paints while preserving their first accessible names', async () => {
  const host = document.createElement('div');
  const chips = Array.from({ length: 3 }, (_, index) => {
    const chip = document.createElement('lr-chip');
    chip.toggleable = true;
    chip.textContent = `Label ${index}`;
    return chip;
  });
  const restores: Array<() => void> = [];
  const earlyBindings: number[] = [];
  const firstNames: Array<string | null> = [];
  let totalBindings = 0;
  for (const [index, chip] of chips.entries()) {
    const observer = (chip as unknown as LabelObservationSeam).labelTextObserver;
    const original = observer.bind;
    observer.bind = function () {
      totalBindings++;
      if (chips.some(sibling => !sibling.hasUpdated)) earlyBindings.push(index);
      original.call(this);
    };
    restores.push(() => { observer.bind = original; });
    restores.push(afterFirstPaint(chip, () => {
      firstNames.push(chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-label'));
    }));
  }
  try {
    host.append(...chips);
    document.body.append(host);
    await Promise.all(chips.map(chip => chip.updateComplete));
    expect(firstNames).to.deep.equal(['Label 0', 'Label 1', 'Label 2']);
    expect(totalBindings, 'observation is actually activated').to.be.greaterThan(0);
    expect(earlyBindings, 'visibility reads do not interleave with sibling first paints').to.deep.equal([]);
    chips[1]!.textContent = 'Live label';
    await waitUntil(() => chips[1]!.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-label') === 'Live label');
  } finally {
    host.remove();
    for (const restore of restores.reverse()) restore();
  }
});

it('samples a same-turn label edit between first paint and initial observation', async () => {
  const chip = document.createElement('lr-chip');
  chip.toggleable = true;
  chip.textContent = 'First name';
  let firstName: string | null = null;
  const restore = afterFirstPaint(chip, () => {
    firstName = chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-label');
    chip.textContent = 'Current name';
  });
  try {
    document.body.append(chip);
    await chip.updateComplete;
    expect(firstName).to.equal('First name');
    await waitUntil(() => chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-label') === 'Current name');
    chip.textContent = 'Later name';
    await waitUntil(() => chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-label') === 'Later name');
  } finally { chip.remove(); restore(); }
});

it('cancels initial observation on disconnection and resumes live labels on reconnect', async () => {
  const chip = document.createElement('lr-chip');
  chip.toggleable = true;
  chip.textContent = 'First name';
  const observer = (chip as unknown as LabelObservationSeam).labelTextObserver;
  const original = observer.bind;
  let detachedBindings = 0;
  observer.bind = function () {
    if (!chip.isConnected && observer.observer) detachedBindings++;
    original.call(this);
  };
  const restore = afterFirstPaint(chip, () => chip.remove());
  try {
    document.body.append(chip);
    await chip.updateComplete;
    await Promise.resolve();
    expect(chip.isConnected).to.equal(false);
    expect(detachedBindings).to.equal(0);
    chip.textContent = 'Reconnected name';
    document.body.append(chip);
    await chip.updateComplete;
    await waitUntil(() => chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-label') === 'Reconnected name');
    chip.textContent = 'Live after reconnect';
    await waitUntil(() => chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-label') === 'Live after reconnect');
    expect(detachedBindings).to.equal(0);
  } finally { chip.remove(); restore(); observer.bind = original; }
});

it('honors a passive-mode change before initial observation and later restores action labels', async () => {
  const chip = document.createElement('lr-chip');
  chip.toggleable = true;
  chip.textContent = 'First name';
  const observer = (chip as unknown as LabelObservationSeam).labelTextObserver;
  const original = observer.bind;
  let passiveBindings = 0;
  observer.bind = function () {
    if (!chip.toggleable && !chip.removable && observer.observer) passiveBindings++;
    original.call(this);
  };
  const restore = afterFirstPaint(chip, () => { chip.toggleable = false; });
  try {
    document.body.append(chip);
    await chip.updateComplete;
    await chip.updateComplete;
    expect(chip.shadowRoot!.querySelector('[part="toggle-button"]') === null).to.equal(true);
    expect(passiveBindings).to.equal(0);
    chip.textContent = 'Restored action';
    chip.toggleable = true;
    await chip.updateComplete;
    await waitUntil(() => chip.shadowRoot!.querySelector('[part="toggle-button"]')?.getAttribute('aria-label') === 'Restored action');
    chip.textContent = 'Live restored action';
    await waitUntil(() => chip.shadowRoot!.querySelector('[part="toggle-button"]')?.getAttribute('aria-label') === 'Live restored action');
  } finally { chip.remove(); restore(); observer.bind = original; }
});
