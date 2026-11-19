import { expect, fixture, html } from '@open-wc/testing';
import './app-rail/app-rail.js';
import './breadcrumb/breadcrumb.js';
import './button-group/button-group.js';
import './control-group/control-group.js';
import './menubar/menubar.js';
import './navigation-menu/navigation-menu.js';
import './segmented/segmented.js';
import './tab-group/tab-group.js';

const cases: ReadonlyArray<{ tag: string; owner: string; markup: (attrs: string) => string }> = [
  { tag: 'lr-tab-group', owner: '[role="tablist"]', markup: (a) => `<lr-tab-group ${a}><lr-tab panel="a">A</lr-tab><lr-tab-panel name="a">a</lr-tab-panel></lr-tab-group>` },
  { tag: 'lr-segmented', owner: '[role="radiogroup"]', markup: (a) => `<lr-segmented ${a}></lr-segmented>` },
  { tag: 'lr-menubar', owner: '[role="menubar"]', markup: (a) => `<lr-menubar ${a}></lr-menubar>` },
  { tag: 'lr-navigation-menu', owner: 'nav', markup: (a) => `<lr-navigation-menu ${a}></lr-navigation-menu>` },
  { tag: 'lr-breadcrumb', owner: 'nav', markup: (a) => `<lr-breadcrumb ${a}><lr-breadcrumb-item>Home</lr-breadcrumb-item></lr-breadcrumb>` },
  { tag: 'lr-app-rail', owner: '[role="navigation"]', markup: (a) => `<lr-app-rail ${a} force-mode="full"></lr-app-rail>` },
  { tag: 'lr-button-group', owner: '[role="group"]', markup: (a) => `<lr-button-group ${a}></lr-button-group>` },
  { tag: 'lr-control-group', owner: '[role="group"]', markup: (a) => `<lr-control-group ${a}></lr-control-group>` },
];

describe('navigation family host aria-describedby', () => {
  for (const { tag, owner, markup } of cases) {
    it(`${tag} reflects a host-authored aria-describedby onto its role owner`, async () => {
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
