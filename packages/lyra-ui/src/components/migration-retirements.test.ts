import { expect, fixture, html } from '@open-wc/testing';
import './layout/details/accordion-item.js';
import './media/file-input/file-input.js';
import './media/qr-code/qr-code.js';
import './data/sparkline/sparkline.js';
import './media/video-playlist/video-playlist.js';
import './utility/known-date/known-date.js';
import './utility/icon/icon.js';
import './layout/app-rail/app-rail-item.js';
import './layout/widget/widget.js';
import './data/flow-node/flow-node.js';
import './agent-tools/tool-call-chip/tool-call-chip.js';
import type { LyraElement } from '../internal/lyra-element.js';

interface MigrationFixture {
  expected: string;
  resolved?: string;
  tag: string;
  part?: string;
}

it('renders the canonical surfaces produced by the v30 migration fixtures', async () => {
  const source = await import(new URL('../../scripts/fixtures/migrate-wa/v30-retirements.json', import.meta.url).href);
  const cases = source.default as MigrationFixture[];
  for (const item of cases) {
    const container = await fixture<HTMLElement>(html`<div></div>`);
    const element = document.createElement(item.tag) as LyraElement;
    if (item.tag === 'lr-file-input') element.setAttribute('label', 'Files');
    if (item.tag === 'lr-known-date') element.setAttribute('label', 'Date');
    if (item.tag === 'lr-icon') element.setAttribute('canvas', 'auto');
    container.append(element);
    await element.updateComplete;
    if (item.part) {
      const style = document.createElement('style');
      style.textContent = item.resolved ?? item.expected;
      container.append(style);
      const targets = element.shadowRoot!.querySelectorAll(`[part~="${item.part}"]`);
      expect(targets.length, item.expected).to.be.greaterThan(0);
      expect(getComputedStyle(targets[0]!).opacity, item.expected).to.equal('0.5');
    } else {
      expect(element.getAttribute('canvas')).to.equal('auto');
      expect('autoWidth' in element).to.equal(false);
    }
  }
});

it('renders reviewed slot replacements without merging suppressed fallback content', async () => {
  const source = await import(new URL('../../scripts/fixtures/lyra-renames/v30-reviewed-slots.json', import.meta.url).href);
  const cases = source.default as { tag: string; slot: string; resolved: string }[];
  expect(cases.length).to.equal(4);
  for (const item of cases) {
    const element = await fixture<LyraElement>(item.resolved);
    await element.updateComplete;
    const slot = element.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${item.slot}"]`)!;
    expect(slot.assignedElements().length, item.tag).to.equal(1);
    expect(slot.assignedElements()[0]!.textContent, item.tag).to.equal('Canonical');
    expect(element.shadowRoot!.querySelectorAll('slot[name="icon"]').length, item.tag).to.equal(0);
  }
});
