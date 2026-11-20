import { expect, fixture, html } from '@open-wc/testing';
import '../lr-app-rail.js';
import '../lr-breadcrumb.js';
import '../lr-button-group.js';
import '../lr-control-group.js';
import '../lr-menubar.js';
import '../lr-navigation-menu.js';
import '../lr-segmented.js';
import '../lr-tab-group.js';
import '../lr-app-rail-group.js';
import '../lr-carousel.js';
import '../lr-carousel-item.js';
import '../lr-dashboard-grid.js';
import '../lr-reorder-list.js';
import '../lr-scroller.js';
import '../lr-time-range.js';

const cases: ReadonlyArray<{ tag: string; owner: string; markup: (attrs: string) => string }> = [
  { tag: 'lr-tab-group', owner: '[role="tablist"]', markup: (a) => `<lr-tab-group ${a}><lr-tab panel="a">A</lr-tab><lr-tab-panel name="a">a</lr-tab-panel></lr-tab-group>` },
  { tag: 'lr-segmented', owner: '[role="radiogroup"]', markup: (a) => `<lr-segmented ${a}></lr-segmented>` },
  { tag: 'lr-menubar', owner: '[role="menubar"]', markup: (a) => `<lr-menubar ${a}></lr-menubar>` },
  { tag: 'lr-navigation-menu', owner: 'nav', markup: (a) => `<lr-navigation-menu ${a}></lr-navigation-menu>` },
  { tag: 'lr-breadcrumb', owner: 'nav', markup: (a) => `<lr-breadcrumb ${a}><lr-breadcrumb-item>Home</lr-breadcrumb-item></lr-breadcrumb>` },
  { tag: 'lr-app-rail', owner: '[role="navigation"]', markup: (a) => `<lr-app-rail ${a} force-mode="full"></lr-app-rail>` },
  { tag: 'lr-button-group', owner: '[role="group"]', markup: (a) => `<lr-button-group ${a}></lr-button-group>` },
  { tag: 'lr-control-group', owner: '[role="group"]', markup: (a) => `<lr-control-group ${a}></lr-control-group>` },
  { tag: 'lr-carousel', owner: '[role="region"]', markup: (a) => `<lr-carousel ${a}><lr-carousel-item>A</lr-carousel-item></lr-carousel>` },
  { tag: 'lr-scroller', owner: '[role="region"]', markup: (a) => `<lr-scroller ${a}><p>Wide</p></lr-scroller>` },
  { tag: 'lr-dashboard-grid', owner: '[role="region"]', markup: (a) => `<lr-dashboard-grid ${a}></lr-dashboard-grid>` },
  { tag: 'lr-reorder-list', owner: '[role="list"]', markup: (a) => `<lr-reorder-list ${a}></lr-reorder-list>` },
  { tag: 'lr-app-rail-group', owner: '[role="group"]', markup: (a) => `<lr-app-rail-group heading="Group" ${a}></lr-app-rail-group>` },
  { tag: 'lr-time-range', owner: '[part="handle-start"]', markup: (a) => `<lr-time-range ${a}></lr-time-range>` },
  { tag: 'lr-time-range', owner: '[part="handle-end"]', markup: (a) => `<lr-time-range ${a}></lr-time-range>` },
];

describe('navigation family host aria-describedby', () => {
  for (const { tag, owner, markup } of cases) {
    it(`${tag} ${owner} reflects a host-authored aria-describedby onto its role owner`, async () => {
      const root = await fixture<HTMLElement>(
        html`<div><p id="extra-context">Extra context.</p></div>`,
      );
      root.insertAdjacentHTML('beforeend', markup('aria-describedby="extra-context"'));
      const el = root.querySelector(tag) as HTMLElement & { updateComplete: Promise<boolean> };
      await el.updateComplete;
      const target = el.shadowRoot!.querySelector(owner) as HTMLElement & { ariaDescribedByElements?: Element[] | null };
      const extra = root.querySelector('#extra-context')!;
      if (Reflect.has(target, 'ariaDescribedByElements')) {
        expect(target.ariaDescribedByElements ?? [], tag).to.include(extra);
      } else {
        expect(target.getAttribute('aria-describedby') ?? '', tag).to.contain('extra-context');
      }
    });
  }
});

it('lr-time-range names its shadow group from a host-authored aria-labelledby', async () => {
  const root = await fixture<HTMLElement>(html`<div><span id="range-name">Opening hours</span></div>`);
  root.insertAdjacentHTML('beforeend', '<lr-time-range aria-labelledby="range-name"></lr-time-range>');
  const el = root.querySelector('lr-time-range') as HTMLElement & { updateComplete: Promise<boolean> };
  await el.updateComplete;
  const group = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement & { ariaLabelledByElements?: Element[] | null };
  const name = root.querySelector('#range-name')!;
  if (Reflect.has(group, 'ariaLabelledByElements')) {
    expect((group.ariaLabelledByElements ?? []).map((node) => node.id)).to.include(name.id);
  } else {
    expect(group.getAttribute('aria-labelledby') ?? '').to.contain('range-name');
  }
});
