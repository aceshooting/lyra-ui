import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './drawer.js';
import type { LyraDrawer } from './drawer.js';
import { setAnimation } from '../../../utilities/animation-registry.js';

it('renders an open drawer with the requested placement and accessible panel', async () => {
  const el = (await fixture(html`
    <lr-drawer open placement="end" heading="Filters">
      <p>Filter controls</p>
    </lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const panel = el.shadowRoot!.querySelector('[part~="panel"]')!;
  expect(el.getAttribute('placement')).to.equal('end');
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.match(/^lr-dialog-heading-/);
});

it('reflects the inherited pinned Web Awesome label property', async () => {
  const el = (await fixture(html`<lr-drawer></lr-drawer>`)) as LyraDrawer;
  el.label = 'Filters';
  await el.updateComplete;
  expect(el.getAttribute('label')).to.equal('Filters');
});

it('inherits guarded reentrant preflight so an opposite close supersedes show', async () => {
  const el = (await fixture(html`<lr-drawer label="Filters"></lr-drawer>`)) as LyraDrawer;
  let shows = 0;
  el.addEventListener('lr-show', () => {
    shows++;
    void el.hide();
  }, { once: true });
  await el.show();
  expect(shows).to.equal(1);
  expect(el.open).to.equal(false);
});

it('closes through the inherited cancelable close contract', async () => {
  const el = (await fixture(html`
    <lr-drawer open heading="Details" closable></lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-dialog-close');
  button.click();
  const event = await eventPromise;

  expect(event.detail).to.equal('close-button');
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('keeps lr-hide cancelable when an open drawer is externally removed', async () => {
  const el = (await fixture(html`<lr-drawer open heading="Details"></lr-drawer>`)) as LyraDrawer;
  let hideCancelable: boolean | undefined;
  let closeCount = 0;
  el.addEventListener('lr-hide', (event) => {
    hideCancelable = event.cancelable;
    event.preventDefault();
  });
  el.addEventListener('lr-dialog-close', () => closeCount++);

  el.remove();
  await Promise.resolve();
  await Promise.resolve();

  expect(hideCancelable).to.equal(true);
  expect(closeCount).to.equal(0);
  expect(el.open, 'a veto preserves state for a later reconnect').to.equal(true);
  expect(el.hasAttribute('open')).to.equal(true);
});

it('does not activate inherited modal infrastructure when opened while detached', async () => {
  const el = (await fixture(html`<lr-drawer heading="Details"></lr-drawer>`)) as LyraDrawer;
  const parent = el.parentElement!;
  el.remove();
  el.open = true;
  await el.updateComplete;

  expect(document.documentElement.style.overflow).to.equal('');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;

  parent.append(el);
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  el.close();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('is accessible while open', async () => {
  const el = (await fixture(html`
    <lr-drawer open aria-label="Navigation drawer"><p>Navigation</p></lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('defaults placement to end, matching wa-drawer', async () => {
  // It used to default to `start`, so a mechanical `wa-drawer` -> `lr-drawer` rename silently
  // moved every migrated drawer to the other edge.
  const el = (await fixture(html`<lr-drawer open heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
  await el.updateComplete;
  expect(el.placement).to.equal('end');
  expect(el.getAttribute('placement')).to.equal('end');
});

it('flips the enter-animation offset under RTL to match the mirrored resting edge', async () => {
  const rtlStartWrapper = (await fixture(html`
    <div dir="rtl"><lr-drawer open placement="start" heading="Filters"><p>Filter controls</p></lr-drawer></div>
  `)) as HTMLElement;
  const startDrawer = rtlStartWrapper.querySelector('lr-drawer') as LyraDrawer;
  await startDrawer.updateComplete;
  const startPanel = startDrawer.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  // A 'start' drawer rests at the physical right edge under RTL, so it must enter
  // from further right -- the same positive offset an LTR 'end' drawer uses.
  expect(getComputedStyle(startPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('1rem');

  const rtlEndWrapper = (await fixture(html`
    <div dir="rtl"><lr-drawer open placement="end" heading="Filters"><p>Filter controls</p></lr-drawer></div>
  `)) as HTMLElement;
  const endDrawer = rtlEndWrapper.querySelector('lr-drawer') as LyraDrawer;
  await endDrawer.updateComplete;
  const endPanel = endDrawer.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  // An 'end' drawer rests at the physical left edge under RTL -- the mirror image,
  // so it must enter from further left, same as an LTR 'start' (default) drawer.
  expect(getComputedStyle(endPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('calc(-1 * 1rem)');
});

it('contains RTL unbroken body and footer content in a 320px viewport-bound drawer allocation', async () => {
  const longContent = 'محتوىدرججانبيمحليطويلجداًبدونأيفرصةللفصلالتلقائي';
  const paragraphs = Array.from({ length: 20 }, () => html`<p>${longContent}</p>`);
  const el = (await fixture(html`
    <lr-drawer
      open
      dir="rtl"
      placement="end"
      heading="تصفيةالإعداداتالدوليةالطويلةجداً"
      style="inline-size: 320px; block-size: 20rem; inset-inline-end: auto; inset-block-end: auto;"
    >
      ${paragraphs}
      <div slot="footer">
        <button type="button">${longContent}</button>
        <button type="button">${longContent}</button>
      </div>
    </lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;

  expect(getComputedStyle(panel).direction).to.equal('rtl');
  expect(panel.clientWidth, 'the drawer panel must fit its 320px host allocation').to.be.at.most(320);
  expect(panel.scrollWidth, 'the drawer panel must not overflow its 320px allocation').to.be.at.most(panel.clientWidth);
  expect(body.scrollWidth, 'unbroken body text must wrap inside the drawer body').to.be.at.most(body.clientWidth);
  expect(footer.scrollWidth, 'long footer actions must remain inside the drawer footer').to.be.at.most(footer.clientWidth);
  expect(body.scrollHeight, 'long body content must remain independently scrollable').to.be.greaterThan(body.clientHeight);
  body.scrollTop = 1;
  expect(body.scrollTop, 'the body scrolling surface must accept a keyboard/mouse scroll position').to.be.greaterThan(0);
});

it('keeps a long header-actions projection and the close target inside a 319px drawer', async () => {
  const el = (await fixture(html`
    <lr-drawer open closable heading="Settings" style="inline-size:319px;block-size:16rem;inset-inline-end:auto;inset-block-end:auto">
      <button slot="header-actions">${'LocalizedAction'.repeat(120)}</button>
      Body
    </lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="header-actions"]') as HTMLElement;
  const close = el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLElement;
  const panelRect = panel.getBoundingClientRect();
  for (const target of [actions, close]) {
    const rect = target.getBoundingClientRect();
    expect(rect.left).to.be.at.least(panelRect.left - 1);
    expect(rect.right).to.be.at.most(panelRect.right + 1);
  }
});

describe('inherited show/hide lifecycle', () => {
  it('runs the same four-event lifecycle as lr-dialog', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    const order: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(name, () => order.push(name));
    }

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    expect(el.open).to.be.true;
    await afterShow;

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;

    expect(order).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
  });

  it('vetoing lr-show keeps the drawer closed', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    el.addEventListener('lr-show', (event) => (event as Event).preventDefault());
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('promotes an open drawer into the top layer', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await el.updateComplete;
    expect(el.matches(':popover-open')).to.be.true;
    await afterShow;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await afterHide;
    expect(el.matches(':popover-open')).to.be.false;
  });
});

describe('slide animation', () => {
  it('slides out with the drawer exit keyframes, not the dialog panel ones', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters" open><p>Body</p></lr-drawer>`)) as LyraDrawer;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await el.updateComplete;
    expect(panel.getAnimations().some((animation) => animation.id === 'drawer.hideEnd')).to.be.true;
    await afterHide;
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await el.updateComplete;
    expect(panel.getAnimations().some((animation) => animation.id === 'drawer.showEnd')).to.be.true;
    await afterShow;
  });

  it('slides out along the block axis for top/bottom placements', async () => {
    const el = (await fixture(
      html`<lr-drawer heading="Filters" placement="bottom" open><p>Body</p></lr-drawer>`,
    )) as LyraDrawer;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await el.updateComplete;
    expect(panel.getAnimations().some((animation) => animation.id === 'drawer.hideBottom')).to.be.true;
    await afterHide;
  });

  it('reads its duration from the shared panel-duration knob, so reduced motion still settles', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    el.style.setProperty('--lr-duration-base', '0.001ms');
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await afterShow;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await afterHide;
    expect(el.open).to.be.false;
  });

  it('selects an RTL keyframe override from the placement-specific drawer namespace', async () => {
    const el = (await fixture(
      html`<lr-drawer dir="rtl" placement="start" heading="Filters"><p>Body</p></lr-drawer>`,
    )) as LyraDrawer;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const releasePanel = setAnimation(el, 'drawer.showStart', {
      keyframes: [{ transform: 'translateX(-14px)' }, { transform: 'translateX(0)' }],
      rtlKeyframes: [{ transform: 'translateX(14px)' }, { transform: 'translateX(0)' }],
      options: { duration: 10_000 },
    });
    const releaseBackdrop = setAnimation(el, 'drawer.overlay.show', null);
    const releasePanelHide = setAnimation(el, 'drawer.hideStart', null);
    const releaseBackdropHide = setAnimation(el, 'drawer.overlay.hide', null);
    try {
      const shown = el.show();
      await el.updateComplete;
      const animation = panel.getAnimations().find((candidate) => candidate.id === 'drawer.showStart');
      expect(animation?.id).to.equal('drawer.showStart');
      expect(String(animation?.effect?.getKeyframes()[0]?.transform)).to.include('14px');
      expect(String(animation?.effect?.getKeyframes()[0]?.transform).includes('-14px')).to.equal(false);
      animation?.finish();
      await shown;
      await el.hide();
    } finally {
      releaseBackdropHide();
      releasePanelHide();
      releaseBackdrop();
      releasePanel();
    }
  });
});

// --- dark-mode panel separation -----------------------------------------------------
//
// lr-drawer inherits lr-dialog's [part~="panel"] rule, so the same dark-mode failure applies: a
// panel painted with the page surface token is the same near-black as the page behind it and the
// open drawer reads as a scrim with floating text. Both colours are read back at runtime from the
// component's own scope -- a hardcoded literal here would assert the generated palette instead of
// this component's token wiring.

let darkThemeSheetPromise: Promise<CSSStyleSheet> | undefined;

function loadThemeSheet(): Promise<CSSStyleSheet> {
  darkThemeSheetPromise ??= fetch(new URL('../../../theme.css', import.meta.url))
    .then((response) => response.text())
    .then((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      return sheet;
    });
  return darkThemeSheetPromise;
}

async function withThemeCss<T>(run: () => Promise<T>): Promise<T> {
  const sheet = await loadThemeSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  try {
    return await run();
  } finally {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
  }
}

// Custom properties resolve to their authored syntax (#1a1a1a), while backgroundColor resolves to
// rgb(). Round-tripping the token value through a real element normalizes both into the same space
// so the two colour STRINGS are actually comparable.
function toComputedColor(rawTokenValue: string): string {
  const probe = document.createElement('div');
  probe.style.backgroundColor = rawTokenValue;
  document.body.append(probe);
  try {
    return getComputedStyle(probe).backgroundColor;
  } finally {
    probe.remove();
  }
}

it('paints its panel a surface distinct from the page surface in dark mode', async () => {
  await withThemeCss(async () => {
    const wrapper = (await fixture(
      html`<div class="lr-dark"><lr-drawer heading="Filters" open><p>Body</p></lr-drawer></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-drawer') as LyraDrawer;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

    const pageSurface = toComputedColor(getComputedStyle(el).getPropertyValue('--lr-color-surface').trim());
    const overlaySurface = toComputedColor(
      getComputedStyle(el).getPropertyValue('--lr-color-surface-overlay').trim(),
    );
    const panelBackground = getComputedStyle(panel).backgroundColor;

    // Guards a mistyped token name resolving to the empty string, which would make every
    // comparison below vacuous.
    expect(pageSurface, 'page surface resolved').to.match(/^rgba?\(/);
    expect(overlaySurface, 'overlay surface resolved').to.match(/^rgba?\(/);
    expect(overlaySurface, 'dark mode moves the overlay surface off the page surface').to.not.equal(pageSurface);

    expect(panelBackground).to.equal(overlaySurface);
    expect(panelBackground).to.not.equal(pageSurface);
    el.close('api');
  });
});

// Same normalization trick as toComputedColor, for the elevation scale: a shadow token expands to
// a length triple plus an rgb(), while computed boxShadow reorders it and resolves the colour.
function toComputedShadow(rawTokenValue: string): string {
  const probe = document.createElement('div');
  probe.style.boxShadow = rawTokenValue;
  document.body.append(probe);
  try {
    return getComputedStyle(probe).boxShadow;
  } finally {
    probe.remove();
  }
}

it('steps its edge-anchored panel back to the lower modal tier, overriding the dialog rule', async () => {
  const el = (await fixture(html`<lr-drawer heading="Filters" open><p>Body</p></lr-drawer>`)) as LyraDrawer;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  const scope = getComputedStyle(el);

  const drawerTier = toComputedShadow(scope.getPropertyValue('--lr-shadow-l').trim());
  const dialogTier = toComputedShadow(scope.getPropertyValue('--lr-shadow-xl').trim());

  expect(drawerTier, 'the l step resolved').to.not.equal('none');
  // Proves the drawer sheet really lands after the inherited dialog panel rule -- if the override
  // silently lost the cascade, the panel would still carry lr-dialog's xl step.
  expect(drawerTier, 'l and xl are distinct steps').to.not.equal(dialogTier);
  expect(getComputedStyle(panel).boxShadow).to.equal(drawerTier);
  el.close('api');
});

describe('contained drawer compatibility', () => {
  it('renders in its containing block without modal ownership, overlay, or Escape dismissal', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="position: relative; inline-size: 500px; block-size: 300px;">
        <lr-drawer contained open label="Filters"><button>Inside</button></lr-drawer>
      </div>
    `);
    const el = wrapper.querySelector('lr-drawer') as LyraDrawer;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const backdrop = el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement;
    expect(getComputedStyle(el).position).to.equal('absolute');
    expect(panel.hasAttribute('aria-modal')).to.equal(false);
    expect(getComputedStyle(backdrop).display).to.equal('none');
    expect(document.documentElement.style.overflow).to.equal('');
    expect(el.matches(':popover-open')).to.equal(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open).to.equal(true);
  });

  it('restores modal behavior when contained is unset while open', async () => {
    const el = (await fixture(
      html`<lr-drawer contained open label="Filters"><button>Inside</button></lr-drawer>`,
    )) as LyraDrawer;
    el.contained = false;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement).getAttribute('aria-modal')).to.equal(
      'true',
    );
    expect(document.documentElement.style.overflow).to.equal('hidden');
    await el.hide();
  });

  it('maps --size to the active drawer axis', async () => {
    const el = (await fixture(
      html`<lr-drawer contained open label="Filters" style="--size: 320px"><p>Body</p></lr-drawer>`,
    )) as LyraDrawer;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).inlineSize).to.equal('320px');
  });

  it("keeps inherited dialog width hooks effective for side drawers", async () => {
    const el = (await fixture(html`
      <lr-drawer
        contained
        open
        label="Filters"
        style="--lr-dialog-width: 200px; --lr-dialog-max-width: 220px"
        ><p>Body</p></lr-drawer
      >
    `)) as LyraDrawer;
    const panel = el.shadowRoot!.querySelector(
      '[part~="panel"]'
    ) as HTMLElement;

    expect(getComputedStyle(panel).inlineSize).to.equal("200px");
    el.style.setProperty("--lr-dialog-width", "300px");
    expect(panel.getBoundingClientRect().width).to.equal(220);
  });

  it("preserves focused drawer content when an open modal becomes contained", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="opener">Open</button>
        <lr-drawer
          label="Filters"
          style="--show-duration: 0ms; --hide-duration: 0ms"
        >
          <button id="inside">Inside</button>
        </lr-drawer>
      </div>
    `);
    const opener = wrapper.querySelector<HTMLButtonElement>("#opener")!;
    const inside = wrapper.querySelector<HTMLButtonElement>("#inside")!;
    const el = wrapper.querySelector<LyraDrawer>("lr-drawer")!;
    opener.focus();
    await el.show();
    inside.focus();

    el.contained = true;
    await el.updateComplete;

    expect(document.activeElement?.id).to.equal("inside");
    await el.hide();
  });

  it("preserves focused drawer content when an open contained drawer becomes modal", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="opener">Open</button>
        <lr-drawer
          contained
          open
          label="Filters"
          style="--show-duration: 0ms; --hide-duration: 0ms"
        >
          <button id="inside">Inside</button>
        </lr-drawer>
      </div>
    `);
    const inside = wrapper.querySelector<HTMLButtonElement>("#inside")!;
    const el = wrapper.querySelector<LyraDrawer>("lr-drawer")!;
    inside.focus();

    el.contained = false;
    await el.updateComplete;

    expect(document.activeElement?.id).to.equal("inside");
    await el.hide();
  });

  it("does not restore the opener during a mode change when the focused target was removed", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="opener">Open</button>
        <lr-drawer
          label="Filters"
          style="--show-duration: 0ms; --hide-duration: 0ms"
        >
          <button id="inside">Inside</button>
        </lr-drawer>
      </div>
    `);
    const opener = wrapper.querySelector<HTMLButtonElement>("#opener")!;
    const inside = wrapper.querySelector<HTMLButtonElement>("#inside")!;
    const el = wrapper.querySelector<LyraDrawer>("lr-drawer")!;
    opener.focus();
    await el.show();
    inside.focus();
    inside.remove();

    el.contained = true;
    await el.updateComplete;

    expect(el.open).to.equal(true);
    expect(document.activeElement?.id).to.not.equal("opener");
    await el.hide();
  });
});
