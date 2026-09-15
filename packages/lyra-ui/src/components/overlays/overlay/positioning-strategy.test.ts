import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './popover.js';
import './dropdown.js';
import './tooltip.js';
import type { LyraPopover } from './popover.js';
import type { LyraDropdown } from './dropdown.js';
import type { LyraTooltip } from './tooltip.js';

/** Every surface below writes `position` on its own popup through the shared positioner, so the
 *  RENDERED value -- never the stylesheet text -- is what these assertions read. */
const popupPosition = (host: Element): string => {
  const popup = host.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  return getComputedStyle(popup).position;
};

describe('positioning-strategy on lr-popover', () => {
  it('defaults to the fixed strategy it has always hard-coded', async () => {
    const el = await fixture<LyraPopover>(html`<lr-popover>
      <button slot="trigger">Open</button>
      <span>Body</span>
    </lr-popover>`);
    expect(el.positioningStrategy).to.equal('fixed');
    await el.show();
    await waitUntil(() => popupPosition(el) === 'fixed', 'the default popover popup is fixed');
    await el.hide();
  });

  it('honours an authored absolute strategy', async () => {
    const el = await fixture<LyraPopover>(html`<lr-popover positioning-strategy="absolute">
      <button slot="trigger">Open</button>
      <span>Body</span>
    </lr-popover>`);
    expect(el.positioningStrategy).to.equal('absolute');
    await el.show();
    await waitUntil(() => popupPosition(el) === 'absolute', 'the popover popup follows the property');
    await el.hide();
  });

  it('normalizes an unsupported attribute value back to its own default', async () => {
    const el = await fixture<LyraPopover>(html`<lr-popover positioning-strategy="sticky">
      <button slot="trigger">Open</button>
      <span>Body</span>
    </lr-popover>`);
    expect(el.positioningStrategy).to.equal('fixed');
  });
});

for (const spec of [
  { tag: 'lr-dropdown', label: 'lr-dropdown' },
] as const) {
  describe(`positioning-strategy on ${spec.label}`, () => {
    const build = (attrs: string) =>
      fixture<LyraDropdown>(`<${spec.tag} ${attrs}>
        <button slot="trigger">Open</button>
        <lr-dropdown-item>One</lr-dropdown-item>
      </${spec.tag}>`);

    it('defaults to absolute, agreeing with an unset hoist', async () => {
      const el = await build('');
      expect(el.positioningStrategy).to.equal('absolute');
      expect(el.hoist).to.equal(false);
    });

    it('treats hoist as the boolean alias of the fixed strategy', async () => {
      const el = await build('hoist');
      expect(el.positioningStrategy).to.equal('fixed');
      await el.show();
      await waitUntil(() => popupPosition(el) === 'fixed', 'hoist still hoists');
      await el.hide();
    });

    it('reports hoist true after positioningStrategy is set to fixed', async () => {
      const el = await build('');
      el.positioningStrategy = 'fixed';
      await el.updateComplete;
      expect(el.hoist).to.equal(true);
      expect(el.hasAttribute('hoist')).to.equal(true);
    });

    it('lets the last write win in either direction', async () => {
      const el = await build('hoist');
      el.positioningStrategy = 'absolute';
      await el.updateComplete;
      expect(el.hoist).to.equal(false);
      el.hoist = true;
      await el.updateComplete;
      expect(el.positioningStrategy).to.equal('fixed');
    });

    it('agrees when both attributes are authored, last attribute winning', async () => {
      const el = await build('hoist positioning-strategy="absolute"');
      expect(el.positioningStrategy).to.equal('absolute');
      expect(el.hoist).to.equal(false);
    });

    it('repositions live when the strategy changes while open', async () => {
      const el = await build('');
      await el.show();
      await waitUntil(() => popupPosition(el) === 'absolute', 'opens absolute');
      el.positioningStrategy = 'fixed';
      await waitUntil(() => popupPosition(el) === 'fixed', 'switches live to fixed');
      expect(el.open).to.equal(true);
      await el.hide();
    });
  });
}

describe('positioning-strategy on lr-tooltip', () => {
  it('defaults to absolute and accepts the explicit property', async () => {
    const el = await fixture<LyraTooltip>(html`<lr-tooltip manual content="Hi">
      <button>Trigger</button>
    </lr-tooltip>`);
    expect(el.positioningStrategy).to.equal('absolute');
    expect(el.hoist).to.equal(false);
    el.positioningStrategy = 'fixed';
    await el.updateComplete;
    expect(el.hoist).to.equal(true);
    await el.show();
    await waitUntil(() => popupPosition(el) === 'fixed', 'the tooltip popup follows the property');
    await el.hide();
  });
});

describe('the cascading --lr-positioning-strategy custom property', () => {
  it('lr-popover: an ancestor override switches the popup off its own mirrored default', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: absolute">
      <lr-popover>
        <button slot="trigger">Open</button>
        <span>Body</span>
      </lr-popover>
    </div>`);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    // The property itself keeps reporting the component's own mirrored default -- only the
    // rendered placement follows the cascading override.
    expect(el.positioningStrategy).to.equal('fixed');
    await el.show();
    await waitUntil(
      () => popupPosition(el) === 'absolute',
      'the ancestor override switches the popup to absolute',
    );
    await el.hide();
  });

  it('lr-popover: an explicit instance value wins over the ancestor override', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: absolute">
      <lr-popover positioning-strategy="fixed">
        <button slot="trigger">Open</button>
        <span>Body</span>
      </lr-popover>
    </div>`);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    await el.show();
    await waitUntil(
      () => popupPosition(el) === 'fixed',
      'the explicit instance value still wins',
    );
    await el.hide();
  });

  it('lr-popover: an unset ancestor never changes the default rendered strategy', async () => {
    const wrapper = await fixture(html`<div>
      <lr-popover>
        <button slot="trigger">Open</button>
        <span>Body</span>
      </lr-popover>
    </div>`);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    await el.show();
    await waitUntil(() => popupPosition(el) === 'fixed', 'the unset default is unchanged');
    await el.hide();
  });

  it('lr-dropdown: clips absolutely by default inside a card, and escapes when the card opts in', async () => {
    const clipped = await fixture(html`<div style="overflow: hidden">
      <lr-dropdown>
        <button slot="trigger">Open</button>
        <lr-dropdown-item>One</lr-dropdown-item>
      </lr-dropdown>
    </div>`);
    const clippedEl = clipped.querySelector('lr-dropdown') as LyraDropdown;
    await clippedEl.show();
    await waitUntil(
      () => popupPosition(clippedEl) === 'absolute',
      'the dropdown stays absolute (and thus clippable) by default',
    );
    await clippedEl.hide();

    const escaping = await fixture(html`<div style="overflow: hidden; --lr-positioning-strategy: fixed">
      <lr-dropdown>
        <button slot="trigger">Open</button>
        <lr-dropdown-item>One</lr-dropdown-item>
      </lr-dropdown>
    </div>`);
    const escapingEl = escaping.querySelector('lr-dropdown') as LyraDropdown;
    await escapingEl.show();
    await waitUntil(
      () => popupPosition(escapingEl) === 'fixed',
      'the card-level override escapes the clipping ancestor',
    );
    await escapingEl.hide();
  });

  it('lr-dropdown: an explicit positioning-strategy on the instance still wins over the card', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: fixed">
      <lr-dropdown positioning-strategy="absolute">
        <button slot="trigger">Open</button>
        <lr-dropdown-item>One</lr-dropdown-item>
      </lr-dropdown>
    </div>`);
    const el = wrapper.querySelector('lr-dropdown') as LyraDropdown;
    await el.show();
    await waitUntil(
      () => popupPosition(el) === 'absolute',
      'the explicit instance value wins over the card override',
    );
    await el.hide();
  });

  it('lr-tooltip: honors the same cascading override as the anchored surfaces', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: fixed">
      <lr-tooltip manual content="Hi">
        <button>Trigger</button>
      </lr-tooltip>
    </div>`);
    const el = wrapper.querySelector('lr-tooltip') as LyraTooltip;
    await el.show();
    await waitUntil(
      () => popupPosition(el) === 'fixed',
      'the tooltip honors the cascading override too',
    );
    await el.hide();
  });
});
