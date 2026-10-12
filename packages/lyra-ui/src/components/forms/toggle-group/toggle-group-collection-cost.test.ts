import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './toggle-group.js';
import '../toggle/toggle.js';
import type { LyraToggleGroup } from './toggle-group.class.js';
import type { LyraToggle } from '../toggle/toggle.class.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { twoFrames } from '../../../../test/frames.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { measureArrayProbeReads } from '../../../../test/array-probe-reads.js';

const button = (toggle: LyraToggle): HTMLButtonElement =>
  toggle.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;

async function ready(group: LyraToggleGroup): Promise<LyraToggle[]> {
  const toggles = [...group.querySelectorAll<LyraToggle>('lr-toggle')];
  await group.updateComplete;
  await Promise.all(toggles.map((toggle) => toggle.updateComplete));
  await twoFrames();
  return toggles;
}

/** Counts value reads during the real public setter; every temporary getter delegates its source. */
function countValueReads(toggles: readonly LyraToggle[], operation: () => void): number {
  const originals = toggles.map((toggle) => Object.getOwnPropertyDescriptor(toggle, 'value'));
  const inherited = toggles.map((toggle) => {
    let prototype = Object.getPrototypeOf(toggle) as object | null;
    while (prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor) return descriptor;
      prototype = Object.getPrototypeOf(prototype) as object | null;
    }
    throw new Error('Toggle value accessor missing');
  });
  let reads = 0;
  try {
    toggles.forEach((toggle, index) => {
      const descriptor = originals[index] ?? inherited[index]!;
      Object.defineProperty(toggle, 'value', {
        configurable: true,
        get: () => {
          reads += 1;
          return descriptor.get ? descriptor.get.call(toggle) : descriptor.value;
        },
        set: descriptor.set ? (value: string) => descriptor.set!.call(toggle, value) : undefined,
      });
    });
    operation();
    return reads;
  } finally {
    toggles.forEach((toggle, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(toggle, 'value', descriptor);
      else Reflect.deleteProperty(toggle, 'value');
    });
  }
}

function assignWithMatchingReads(group: LyraToggleGroup, requested: readonly string[]): number {
  const seam = group as unknown as {
    applyValue(current: readonly LyraToggle[], wanted: readonly string[]): void;
  };
  const original = seam.applyValue;
  const descriptor = Object.getOwnPropertyDescriptor(group, 'applyValue');
  let reads = 0;
  let calls = 0;
  Object.defineProperty(group, 'applyValue', {
    configurable: true,
    value: (current: readonly LyraToggle[], wanted: readonly string[]): void => {
      calls += 1;
      reads += countValueReads(current, () => original.call(group, current, wanted));
    },
  });
  try {
    group.value = requested;
  } finally {
    if (descriptor) Object.defineProperty(group, 'applyValue', descriptor);
    else Reflect.deleteProperty(group, 'applyValue');
  }
  expect(calls).to.equal(1);
  return reads;
}

it('matches long requested values linearly without adding scans to empty or one-value writes', async () => {
  const count = 128;
  const group = await fixture<LyraToggleGroup>(html`<lr-toggle-group selection-mode="single" label="Choose an item">
    ${Array.from({ length: count }, (_, index) => html`<lr-toggle value=${`choice-${index}`}>Choice ${index}</lr-toggle>`)}
  </lr-toggle-group>`);
  const toggles = await ready(group);
  let changes = 0;
  group.addEventListener('lr-change', () => { changes += 1; });
  const requested = [...Array.from({ length: count - 1 }, (_, index) => `missing-${index}`), `choice-${count - 1}`];
  const longReads = assignWithMatchingReads(group, requested);
  expect([...group.value]).to.deep.equal([`choice-${count - 1}`]);
  expect(toggles.filter((toggle) => toggle.pressed).map((toggle) => toggle.value)).to.deep.equal([`choice-${count - 1}`]);
  const emptyReads = assignWithMatchingReads(group, []);
  expect([...group.value]).to.deep.equal([]);
  const singleReads = assignWithMatchingReads(group, ['choice-0']);
  expect([...group.value]).to.deep.equal(['choice-0']);
  expect(changes).to.equal(0);
  // Scope excludes the separate sync diagnostic: these are matching reads from the actual setter.
  expect(emptyReads).to.equal(0);
  expect(singleReads).to.be.at.most(2);
  expect(longReads).to.be.at.most(count * 4);
});

it('repairs a publicly removed anchor with linear old-order membership and real successor focus', async () => {
  const count = 128;
  const group = await fixture<LyraToggleGroup>(html`<lr-toggle-group label="Actions">
    ${Array.from({ length: count * 2 }, (_, index) => html`<lr-toggle value=${`action-${index}`}>Action ${index}</lr-toggle>`)}
  </lr-toggle-group>`);
  const toggles = await ready(group);
  const first = toggles[0]!;
  await focusByKeyboard(first);
  expect(deepActiveElementIn(document) === button(first)).to.equal(true);
  const identities = new Set(toggles);
  const seam = group as unknown as {
    readonly lastFocused: LyraToggle | undefined;
    computeTabStop(current: readonly LyraToggle[]): LyraToggle | undefined;
  };
  const original = seam.computeTabStop;
  const descriptor = Object.getOwnPropertyDescriptor(group, 'computeTabStop');
  let eligible = 0;
  let reads = 0;
  Object.defineProperty(group, 'computeTabStop', {
    configurable: true,
    value: (current: readonly LyraToggle[]): LyraToggle | undefined => {
      if (seam.lastFocused !== first || current.length !== count) return original.call(group, current);
      eligible += 1;
      const measured = measureArrayProbeReads(
        (_array, value) => identities.has(value as LyraToggle),
        () => original.call(group, current),
      );
      reads += measured.reads;
      return measured.value;
    },
  });
  try {
    // No private order, anchor or availability state is written: the membership observer repairs
    // this synchronous public DOM batch from the previously focused first toggle.
    toggles.slice(0, count).forEach((toggle) => toggle.remove());
    await waitUntil(() => eligible > 0, 'Removed-anchor reconciliation was not observed', { timeout: 3000 });
  } finally {
    if (descriptor) Object.defineProperty(group, 'computeTabStop', descriptor);
    else Reflect.deleteProperty(group, 'computeTabStop');
  }
  await ready(group);
  expect(eligible).to.equal(1);
  expect(group.querySelectorAll('lr-toggle').length).to.equal(count);
  const survivors = toggles.slice(count);
  expect(survivors.filter((toggle) => button(toggle).tabIndex === 0).map((toggle) => toggle.value)).to.deep.equal([`action-${count}`]);
  await waitUntil(() => deepActiveElementIn(document) === button(survivors[0]!), 'Successor did not receive repaired focus', { timeout: 3000 });
  expect(reads).to.be.at.most(toggles.length * 4);
});

it('keeps first matching disabled or empty values and preserves an anchor through total disablement', async () => {
  expectDevWarning('lyra-toggle-group-ambiguous-values');
  const group = await fixture<LyraToggleGroup>(html`<lr-toggle-group selection-mode="single" label="Optional choice">
    <lr-toggle value="" disabled>Empty first</lr-toggle>
    <lr-toggle value="duplicate">First duplicate</lr-toggle>
    <lr-toggle value="duplicate">Second duplicate</lr-toggle>
    <lr-toggle value="last">Last</lr-toggle>
  </lr-toggle-group>`);
  const toggles = await ready(group);
  group.value = ['missing', '', 'duplicate'];
  expect(toggles.map((toggle) => toggle.pressed)).to.deep.equal([true, false, false, false]);
  group.value = ['missing', 'duplicate', 'last'];
  expect(toggles.map((toggle) => toggle.pressed)).to.deep.equal([false, true, false, false]);
  group.value = [];
  expect(toggles.every((toggle) => !toggle.pressed)).to.equal(true);
  await focusByKeyboard(toggles[2]!);
  group.disabled = true;
  await ready(group);
  expect(toggles.every((toggle) => button(toggle).tabIndex === -1)).to.equal(true);
  group.disabled = false;
  await ready(group);
  expect(toggles.filter((toggle) => button(toggle).tabIndex === 0).length).to.equal(1);
  expect(button(toggles[2]!).tabIndex).to.equal(0);
  toggles[2]!.remove();
  await ready(group);
  expect(button(toggles[3]!).tabIndex).to.equal(0);
  await focusByKeyboard(toggles[3]!);
  toggles[3]!.remove();
  await ready(group);
  expect(button(toggles[1]!).tabIndex).to.equal(0);
  expect(deepActiveElementIn(document) === button(toggles[1]!)).to.equal(true);
});
