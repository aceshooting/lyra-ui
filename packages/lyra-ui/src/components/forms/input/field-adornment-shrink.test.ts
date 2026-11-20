import { expect, fixture } from '@open-wc/testing';
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js';
import '../../lr-input.js';
import '../../lr-time-input.js';
import '../../lr-date-input.js';

type Updating = HTMLElement & { updateComplete: Promise<unknown> };

const part = (host: Element, name: string): HTMLElement =>
  host.shadowRoot!.querySelector(`[part~="${name}"]`) as HTMLElement;

// A narrow row with an icon at the start and a long text unit at the end: only the text may give
// way. Flex shrink is weighted by base size, so before the icon wrapper opted out it gave up a
// share of the deficit and its own overflow clipped the icon.
describe('field start/end adornments in a narrow row', () => {
  for (const name of ['lr-input', 'lr-time-input', 'lr-date-input']) {
    it(`${name} keeps an icon adornment whole while a text adornment ellipsizes`, async () => {
      const tag = unsafeStatic(name);
      const el = await fixture<Updating>(staticHtml`
        <${tag} style="inline-size: 120px" aria-label="Reading">
          <svg slot="start" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8"></circle></svg>
          <span slot="end">kilowatt-hours per billing period</span>
        </${tag}>
      `);
      await el.updateComplete;
      const icon = el.querySelector('svg')!;
      const unit = el.querySelector('span')!;
      const start = part(el, 'start');
      expect(start.hasAttribute('data-textless'), 'the icon wrapper is marked textless').to.equal(true);
      expect(part(el, 'end').hasAttribute('data-textless'), 'the text wrapper is not').to.equal(false);
      expect(start.getBoundingClientRect().width, 'the icon wrapper shrank').to.be.at.least(15.5);
      expect(icon.getBoundingClientRect().width, 'the icon itself shrank').to.be.at.least(15.5);
      expect(unit.scrollWidth, 'the long text adornment no longer truncates').to.be.greaterThan(unit.clientWidth);
    });
  }
});
