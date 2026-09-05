import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './chip-group.js';
import './chip.js';
import type { LyraChipGroup } from './chip-group.js';

describe('same-count chip assignments', () => {
  for (const operation of ['replace', 'reorder']) {
    it(`reconciles collapsed visibility after ${operation}`, async () => {
      const group = await fixture<LyraChipGroup>(html`<lr-chip-group max-visible="1">
        <lr-chip id="a">A</lr-chip><lr-chip id="b">B</lr-chip>
      </lr-chip-group>`);
      const first = group.querySelector<HTMLElement>('#a')!;
      const second = group.querySelector<HTMLElement>('#b')!;
      await waitUntil(() => second.hidden, 'the second chip starts collapsed');
      if (operation === 'replace') {
        const replacement = document.createElement('lr-chip');
        replacement.id = 'c';
        replacement.textContent = 'C';
        second.replaceWith(replacement);
        await waitUntil(() => replacement.hidden, 'the replacement obeys the collapsed limit');
        expect(second.hidden).to.be.false;
        expect(first.hidden).to.be.false;
      } else {
        group.insertBefore(second, first);
        await waitUntil(() => first.hidden && !second.hidden, 'the reordered assignment obeys the collapsed limit');
      }
      expect(group.querySelectorAll(':scope > :not([hidden])').length).to.equal(1);
    });
  }
});

it('preserves authored hidden and inert states while replacing a collapsed child', async () => {
  const group = await fixture<LyraChipGroup>(html`<lr-chip-group max-visible="1">
    <lr-chip id="hidden" hidden>Hidden</lr-chip><lr-chip id="inert" inert>Inert</lr-chip>
    <lr-chip id="visible">Visible</lr-chip><lr-chip id="collapsed">Collapsed</lr-chip>
  </lr-chip-group>`);
  const collapsed = group.querySelector<HTMLElement>('#collapsed')!;
  await waitUntil(() => collapsed.hidden, 'the managed chip starts collapsed');
  const replacement = document.createElement('lr-chip');
  replacement.textContent = 'Replacement';
  collapsed.replaceWith(replacement);
  await waitUntil(() => replacement.hidden, 'replacement visibility is reconciled');
  expect(collapsed.hidden).to.be.false;
  expect(group.querySelector<HTMLElement>('#hidden')!.hidden).to.be.true;
  expect(group.querySelector<HTMLElement>('#inert')!.inert).to.be.true;
  expect(group.querySelector<HTMLElement>('#inert')!.hidden).to.be.false;
  expect(group.querySelector<HTMLElement>('#visible')!.hidden).to.be.false;
});
