import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { measureElementArrayLookups } from '../../../../test/element-array-lookup-cost.js';
import './page.js';
import type { LyraPage } from './page.class.js';

interface Reconciliation { syncCustomToggle(): void; customToggle: HTMLElement | undefined }

it('reconciles custom navigation-toggle ownership with linear matching and restores removed ARIA', async () => {
  const page = await fixture<LyraPage>(html`<lr-page disable-navigation-toggle>
    ${Array.from({ length: 64 }, (_, index) => html`<button slot="navigation-toggle"
      aria-label=${`Author ${index}`} aria-controls=${`section-${index}`} aria-expanded="mixed">Sections ${index}</button>`)}
  </lr-page>`);
  const buttons = [...page.querySelectorAll('button')];
  await waitUntil(() => buttons.every(button => button.getAttribute('aria-controls')?.split(/\s+/).includes(page.id)));
  const model = page as unknown as Reconciliation;
  const removed = buttons.at(-1)!;
  removed.remove();
  const retained = buttons.slice(0, -1).reverse();
  page.append(...retained);
  const comparisons = measureElementArrayLookups(buttons, () => model.syncCustomToggle());
  expect(model.customToggle === retained[0]).to.equal(true);
  expect(removed.getAttribute('aria-label')).to.equal('Author 63');
  expect(removed.getAttribute('aria-controls')).to.equal('section-63');
  expect(removed.getAttribute('aria-expanded')).to.equal('mixed');
  expect(retained.every(button => button.getAttribute('aria-controls')?.split(/\s+/).includes(page.id))).to.equal(true);
  expect(comparisons).to.be.at.most(buttons.length * 4);
});
