import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
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

/**
 * The reported layout: a `position: fixed` header at `z-index: 1000` -- no transform, filter or
 * `contain`, so no containing block traps the popover inside it -- beside a sibling fixed search
 * surface at `z-index: 1100` that covers the area the popover opens into. The header is a plain
 * stacking context, so without `top-layer` every overlay inside it paints beneath the sibling
 * whatever its own `z-index`.
 */
const HEADER_STYLE =
  'position: fixed; inset-block-start: 0; inset-inline: 0; z-index: 1000; block-size: 48px; ' +
  'display: flex; align-items: center; padding-inline: 24px; background: rgb(255, 255, 255)';
const SEARCH_STYLE =
  'position: fixed; inset-block-start: 48px; inset-inline: 0; z-index: 1100; block-size: 360px; ' +
  'background: rgb(235, 235, 235)';
const NO_MOTION = '--show-duration: 0ms; --hide-duration: 0ms; --lr-transition-fast: 0ms';

interface FixedHeaderLayout {
  el: LyraPopover;
  search: HTMLElement;
  popup: HTMLElement;
}

async function fixedHeaderLayout(
  topLayer: boolean,
  options: { trigger?: string; hoverBridge?: boolean; distance?: number; strategy?: string } = {},
): Promise<FixedHeaderLayout> {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <div style=${HEADER_STYLE}>
      <lr-popover
        placement="bottom-start"
        ?top-layer=${topLayer}
        ?hover-bridge=${options.hoverBridge === true}
        trigger=${options.trigger ?? 'click'}
        distance=${options.distance ?? 8}
        positioning-strategy=${options.strategy ?? 'fixed'}
        data-lr-theme-scope style=${NO_MOTION}
      >
        <button slot="trigger">Account</button>
        <div style="inline-size: 220px; block-size: 140px">
          <button id="inside">Profile</button>
        </div>
      </lr-popover>
    </div>
    <div id="search" style=${SEARCH_STYLE}></div>
  </div>`);
  const el = wrapper.querySelector('lr-popover') as LyraPopover;
  const search = wrapper.querySelector<HTMLElement>('#search')!;
  await el.updateComplete;
  return { el, search, popup: el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')! };
}

/** A point well inside the placed panel that also lies over the sibling search surface. */
function panelPoint(popup: HTMLElement, search: HTMLElement): [number, number] {
  const rect = popup.getBoundingClientRect();
  const searchRect = search.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  expect(y, 'the probe lies over the sibling search surface').to.be.greaterThan(searchRect.top + 4);
  expect(y).to.be.lessThan(searchRect.bottom);
  return [x, y];
}

/** Whether the topmost hit at (x, y) belongs to `host` -- its shadow popup, or slotted content,
 *  which hit-tests as its own light-DOM node. Compared as a boolean, never as a DOM node. */
function hitBelongsTo(host: HTMLElement, x: number, y: number): boolean {
  const hit = document.elementFromPoint(x, y);
  return hit !== null && (hit === host || host.contains(hit));
}

function hitId(x: number, y: number): string {
  return document.elementFromPoint(x, y)?.id ?? '';
}

async function openPlaced(el: LyraPopover, popup: HTMLElement): Promise<void> {
  await el.show();
  await waitUntil(
    () => popup.style.left !== '' && popup.getBoundingClientRect().height > 0,
    'the popup is placed',
  );
}

describe('top-layer on lr-popover', () => {
  afterEach(async () => {
    document.documentElement.removeAttribute('dir');
    await resetMouse();
  });

  it('defaults off: an unset popover in a fixed header still paints beneath a sibling surface', async () => {
    const { el, search, popup } = await fixedHeaderLayout(false);
    expect(el.topLayer).to.equal(false);
    expect(el.hasAttribute('top-layer')).to.equal(false);
    await openPlaced(el, popup);
    const [x, y] = panelPoint(popup, search);
    expect(popup.matches(':popover-open'), 'an untrapped popover is never promoted by default').to.equal(false);
    expect(popup.hasAttribute('data-lr-top-layer')).to.equal(false);
    expect(hitId(x, y), 'the reported stacking: the sibling surface wins the hit test').to.equal('search');
    await el.hide({ focusTrigger: false });
  });

  it('paints above the sibling surface when opted in, still anchored below its trigger', async () => {
    const { el, search, popup } = await fixedHeaderLayout(true);
    expect(el.topLayer).to.equal(true);
    await openPlaced(el, popup);
    expect(popup.matches(':popover-open'), 'the opted-in popup is in the browser top layer').to.equal(true);
    const [x, y] = panelPoint(popup, search);
    expect(hitBelongsTo(el, x, y), 'a panel point hits the popover, not the sibling').to.equal(true);
    const triggerRect = el.querySelector('button')!.getBoundingClientRect();
    const rect = popup.getBoundingClientRect();
    expect(rect.top - triggerRect.bottom, 'still offset by distance from its trigger').to.be.closeTo(8, 1);
    expect(rect.left, 'bottom-start aligns to the trigger start').to.be.closeTo(triggerRect.left, 1);
    const arrow = el.shadowRoot!.querySelector<HTMLElement>('[part~="arrow"]')!;
    const arrowRect = arrow.getBoundingClientRect();
    expect(arrowRect.left + arrowRect.width / 2, 'the arrow still tracks the trigger centre').to.be.closeTo(
      triggerRect.left + triggerRect.width / 2,
      1.5,
    );
    await el.hide({ focusTrigger: false });
  });

  it('keeps the exit transition in the top layer and releases it once settled closed', async () => {
    const { el, search, popup } = await fixedHeaderLayout(true);
    await openPlaced(el, popup);
    const [x, y] = panelPoint(popup, search);
    // A real exit transition, long enough to sample mid-way in every engine.
    el.style.setProperty('--hide-duration', '800ms');
    const hiding = el.hide({ focusTrigger: false });
    const exitAnimation = (): Animation | undefined =>
      popup.getAnimations().find((animation) => animation.id.endsWith('.hide'));
    await waitUntil(
      () => exitAnimation()?.playState === 'running' && Number(exitAnimation()!.currentTime) > 0,
      'the exit transition is playing',
    );
    expect(popup.matches(':popover-open'), 'mid-transition the popup is still in the top layer').to.equal(true);
    // A closing popup is pointer-transparent (`[data-hidden]`); lift that for this probe only, so
    // the hit test reads paint order: beneath the sibling it would hit `search`.
    popup.style.setProperty('pointer-events', 'auto');
    const paintsAbove = hitBelongsTo(el, x, y);
    popup.style.removeProperty('pointer-events');
    expect(paintsAbove, 'mid-transition the popup still paints above the sibling').to.equal(true);
    expect(exitAnimation()?.playState, 'both reads above were taken mid-transition').to.equal('running');
    await hiding;
    el.style.removeProperty('--hide-duration');
    await waitUntil(() => !popup.hasAttribute('popover'), 'the promotion is released');
    expect(popup.hasAttribute('data-lr-top-layer')).to.equal(false);
    await openPlaced(el, popup);
    expect(popup.matches(':popover-open'), 'reopening re-enters the top layer').to.equal(true);
    await el.hide({ focusTrigger: false });
  });

  it('keeps pointer interaction, light dismiss and Escape focus return working', async () => {
    const { el, search, popup } = await fixedHeaderLayout(true);
    const trigger = el.querySelector<HTMLButtonElement>('[slot="trigger"]')!;
    const inside = el.querySelector<HTMLButtonElement>('#inside')!;
    let insideClicks = 0;
    inside.addEventListener('click', () => {
      insideClicks += 1;
    });
    await openPlaced(el, popup);
    const insideRect = inside.getBoundingClientRect();
    expect(insideRect.top, 'the inner control lies over the sibling').to.be.greaterThan(search.getBoundingClientRect().top);
    await sendMouse({
      type: 'click',
      position: [Math.round(insideRect.left + insideRect.width / 2), Math.round(insideRect.top + insideRect.height / 2)],
    });
    await waitUntil(() => insideClicks === 1, 'a real click reaches the control above the sibling');
    expect(el.open, 'a click inside the promoted panel is not a light dismiss').to.equal(true);

    inside.focus();
    expect(document.activeElement === inside, 'focus can enter the promoted panel').to.equal(true);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !el.open, 'Escape closes the promoted popover');
    expect(document.activeElement === trigger, 'focus returns to the trigger').to.equal(true);

    await openPlaced(el, popup);
    const searchRect = search.getBoundingClientRect();
    await sendMouse({
      type: 'click',
      position: [Math.round(searchRect.right - 24), Math.round(searchRect.bottom - 24)],
    });
    await waitUntil(() => !el.open, 'a click on the sibling surface light-dismisses it');
  });

  it('places with the fixed strategy even when positioning-strategy is absolute', async () => {
    const { el, search, popup } = await fixedHeaderLayout(true, { strategy: 'absolute' });
    expect(el.positioningStrategy, 'the authored property value is still reported').to.equal('absolute');
    await openPlaced(el, popup);
    expect(popupPosition(el)).to.equal('fixed');
    expect(popup.matches(':popover-open')).to.equal(true);
    const [x, y] = panelPoint(popup, search);
    expect(hitBelongsTo(el, x, y)).to.equal(true);
    await el.hide({ focusTrigger: false });
  });

  it('applies live while open, in both directions', async () => {
    const { el, search, popup } = await fixedHeaderLayout(false);
    await openPlaced(el, popup);
    const [x, y] = panelPoint(popup, search);
    expect(hitId(x, y)).to.equal('search');

    el.topLayer = true;
    await el.updateComplete;
    expect(el.getAttribute('top-layer'), 'the property reflects').to.equal('');
    await waitUntil(() => popup.matches(':popover-open'), 'turning it on promotes the open popup');
    await waitUntil(() => hitBelongsTo(el, x, y), 'and it now paints above the sibling');
    expect(el.open).to.equal(true);

    el.topLayer = false;
    await el.updateComplete;
    expect(el.hasAttribute('top-layer')).to.equal(false);
    await waitUntil(() => !popup.matches(':popover-open'), 'turning it off demotes the open popup');
    expect(popup.hasAttribute('data-lr-top-layer')).to.equal(false);
    await waitUntil(() => hitId(x, y) === 'search', 'and the header stacking applies again');
    expect(el.open, 'the popover stays open throughout').to.equal(true);
    await el.hide({ focusTrigger: false });
  });

  it('keeps a trapped popup promoted when top-layer is turned off while open', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div style="transform: translateY(0); overflow: hidden; block-size: 40px">
      <lr-popover top-layer data-lr-theme-scope style=${NO_MOTION}>
        <button slot="trigger">Open</button>
        <div style="block-size: 120px">Details</div>
      </lr-popover>
    </div>`);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    await openPlaced(el, popup);
    expect(popup.matches(':popover-open')).to.equal(true);
    el.topLayer = false;
    await el.updateComplete;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    expect(popup.matches(':popover-open'), 'the ordinary trapped-surface escape still applies').to.equal(true);
    expect(el.open).to.equal(true);
    await el.hide({ focusTrigger: false });
  });

  it('promotes the hover bridge too, so the gap over the sibling stays hoverable', async () => {
    const { el, search, popup } = await fixedHeaderLayout(true, {
      trigger: 'hover',
      hoverBridge: true,
      distance: 28,
    });
    await openPlaced(el, popup);
    const bridge = el.shadowRoot!.querySelector<HTMLElement>('[part~="hover-bridge"]')!;
    await waitUntil(
      () => bridge.style.getPropertyValue('--lr-positioner-hover-bridge-top-left-x') !== '',
      'the bridge quad is written',
    );
    expect(bridge.matches(':popover-open'), 'the bridge is promoted with the popup').to.equal(true);
    const triggerRect = el.querySelector('button')!.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const searchTop = search.getBoundingClientRect().top;
    // Near the trigger's start edge, clear of the arrow that points at its centre.
    const x = triggerRect.left + 4;
    const y = (Math.max(triggerRect.bottom, searchTop) + popupRect.top) / 2;
    expect(y, 'the probe lies in the gap, over the sibling').to.be.greaterThan(searchTop);
    expect(y).to.be.lessThan(popupRect.top);
    expect(hitBelongsTo(el, x, y), 'the gap hits the bridge, not the sibling').to.equal(true);
    expect(el.shadowRoot!.elementFromPoint(x, y)?.getAttribute('part')).to.equal('hover-bridge');
    await el.hide({ focusTrigger: false });
  });

  it('aligns to the trigger under a right-to-left root', async () => {
    document.documentElement.dir = 'rtl';
    const { el, search, popup } = await fixedHeaderLayout(true);
    await openPlaced(el, popup);
    expect(popup.matches(':popover-open')).to.equal(true);
    const triggerRect = el.querySelector('button')!.getBoundingClientRect();
    await waitUntil(
      () => Math.abs(popup.getBoundingClientRect().right - triggerRect.right) < 1,
      'bottom-start aligns to the trigger inline start (its right edge) under RTL',
    );
    const [x, y] = panelPoint(popup, search);
    expect(hitBelongsTo(el, x, y)).to.equal(true);
    await el.hide({ focusTrigger: false });
  });
});

describe('top-layer on lr-dropdown', () => {
  const build = async (topLayer: boolean) => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <div style=${HEADER_STYLE}>
        <lr-dropdown ?top-layer=${topLayer} data-lr-theme-scope style=${NO_MOTION}>
          <button slot="trigger">Actions</button>
          <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
          <lr-dropdown-item value="archive">Archive</lr-dropdown-item>
          <lr-dropdown-item value="delete">Delete</lr-dropdown-item>
        </lr-dropdown>
      </div>
      <div id="search" style=${SEARCH_STYLE}></div>
    </div>`);
    const el = wrapper.querySelector('lr-dropdown') as LyraDropdown;
    await el.updateComplete;
    return {
      el,
      search: wrapper.querySelector<HTMLElement>('#search')!,
      popup: el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!,
    };
  };

  it('inherits the opt-in: the menu paints above the sibling surface', async () => {
    const { el, search, popup } = await build(true);
    expect(el.topLayer).to.equal(true);
    await el.show();
    await waitUntil(() => popup.style.left !== '' && popup.getBoundingClientRect().height > 0);
    expect(popup.matches(':popover-open')).to.equal(true);
    const [x, y] = panelPoint(popup, search);
    expect(hitBelongsTo(el, x, y)).to.equal(true);
    await el.hide({ focusTrigger: false });
  });

  it('keeps a submenu of the promoted menu above the sibling surface', async () => {
    await import('../../layout/menu/menu-item.js');
    const wrapper = await fixture<HTMLElement>(html`<div>
      <div style=${HEADER_STYLE}>
        <lr-dropdown top-layer data-lr-theme-scope style=${NO_MOTION}>
          <button slot="trigger">Actions</button>
          <lr-menu-item value="share" id="share">
            Share
            <lr-menu slot="submenu"><lr-menu-item value="email" id="email">Email</lr-menu-item></lr-menu>
          </lr-menu-item>
        </lr-dropdown>
      </div>
      <div id="search" style=${SEARCH_STYLE}></div>
    </div>`);
    const el = wrapper.querySelector('lr-dropdown') as LyraDropdown;
    const search = wrapper.querySelector<HTMLElement>('#search')!;
    await el.show();
    const share = el.querySelector('#share') as HTMLElement & {
      openSubmenu(focus?: string): void;
      submenuOpen: boolean;
    };
    share.openSubmenu('first');
    await waitUntil(() => share.submenuOpen, 'the submenu opens');
    const email = el.querySelector<HTMLElement>('#email')!;
    const surface = share.querySelector('lr-menu')!.shadowRoot!.querySelector<HTMLElement>('.submenu-surface')!;
    await waitUntil(() => surface.style.left !== '', 'the submenu surface is placed');
    // Re-measured on every poll: the item only settles once the surface has been positioned.
    const center = (): [number, number] => {
      const rect = email.getBoundingClientRect();
      return [rect.left + rect.width / 2, rect.top + rect.height / 2];
    };
    await waitUntil(() => hitBelongsTo(email, ...center()), 'the submenu item wins the hit test');
    expect(center()[1], 'the submenu item lies over the sibling surface').to.be.greaterThan(
      search.getBoundingClientRect().top,
    );
    await el.hide({ focusTrigger: false });
  });

  it('leaves an unset dropdown beneath the sibling surface', async () => {
    const { el, search, popup } = await build(false);
    expect(el.topLayer).to.equal(false);
    await el.show();
    await waitUntil(() => popup.style.left !== '' && popup.getBoundingClientRect().height > 0);
    expect(popup.matches(':popover-open')).to.equal(false);
    const [x, y] = panelPoint(popup, search);
    expect(hitId(x, y)).to.equal('search');
    await el.hide({ focusTrigger: false });
  });
});
