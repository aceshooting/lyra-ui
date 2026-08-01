import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './drawer.js';
import type { LyraDrawer } from './drawer.js';

it('renders an open drawer with the requested placement and accessible panel', async () => {
  const el = (await fixture(html`
    <lr-drawer open placement="end" heading="Filters">
      <p>Filter controls</p>
    </lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;
  expect(el.getAttribute('placement')).to.equal('end');
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.match(/^lr-dialog-heading-/);
});

it('closes through the inherited cancelable close contract', async () => {
  const el = (await fixture(html`
    <lr-drawer open heading="Details" closable></lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-dialog-close');
  button.click();
  const event = await eventPromise;

  expect(event.detail).to.equal('close-button');
  await el.updateComplete;
  expect(el.open).to.be.false;
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
  const startPanel = startDrawer.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  // A 'start' drawer rests at the physical right edge under RTL, so it must enter
  // from further right -- the same positive offset an LTR 'end' drawer uses.
  expect(getComputedStyle(startPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('1rem');

  const rtlEndWrapper = (await fixture(html`
    <div dir="rtl"><lr-drawer open placement="end" heading="Filters"><p>Filter controls</p></lr-drawer></div>
  `)) as HTMLElement;
  const endDrawer = rtlEndWrapper.querySelector('lr-drawer') as LyraDrawer;
  await endDrawer.updateComplete;
  const endPanel = endDrawer.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  // An 'end' drawer rests at the physical left edge under RTL -- the mirror image,
  // so it must enter from further left, same as an LTR 'start' (default) drawer.
  expect(getComputedStyle(endPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('calc(-1 * 1rem)');
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
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-in');

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await el.updateComplete;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-out');
    await afterHide;
  });

  it('slides out along the block axis for top/bottom placements', async () => {
    const el = (await fixture(
      html`<lr-drawer heading="Filters" placement="bottom" open><p>Body</p></lr-drawer>`,
    )) as LyraDrawer;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-in-block');

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await el.updateComplete;
    expect(getComputedStyle(panel).animationName).to.equal('lr-drawer-out-block');
    await afterHide;
  });

  it('reads its duration from the shared panel-duration knob, so reduced motion still settles', async () => {
    const el = (await fixture(html`<lr-drawer heading="Filters"><p>Body</p></lr-drawer>`)) as LyraDrawer;
    el.style.setProperty('--lr-duration-base', '0.001ms');
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await el.updateComplete;
    expect(getComputedStyle(panel).animationDuration).to.equal('1e-06s');
    await afterShow;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    await afterHide;
    expect(el.open).to.be.false;
  });
});

// --- dark-mode panel separation -----------------------------------------------------
//
// lr-drawer inherits lr-dialog's [part="panel"] rule, so the same dark-mode failure applies: a
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
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

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
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
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
