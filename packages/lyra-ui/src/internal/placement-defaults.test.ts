import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../components/lr-popover.js';
import '../components/lr-dropdown.js';
import '../components/lr-tooltip.js';
import '../components/lr-popup.js';
import '../components/lr-color-picker.js';
import '../components/lr-select.js';
import '../components/lr-tour.js';
import '../components/lr-combobox.js';
import '../components/lr-drawer.js';
import '../components/lr-toast.js';
import '../components/lr-tab-group.js';
import '../components/lr-dock-panel.js';

const anchoredDefaults = {
  'lr-popover': ['top', 'popup'],
  'lr-dropdown': ['bottom-start', 'popup'],
  'lr-tooltip': ['top', 'popup'],
  'lr-popup': ['top', 'popup'],
  'lr-color-picker': ['bottom-start', 'panel'],
  'lr-select': ['bottom', 'listbox'],
  'lr-tour': ['bottom', 'popover'],
  'lr-combobox': ['bottom', 'listbox'],
} as const;

for (const direction of ['ltr', 'rtl']) {
  for (const name of Object.keys(anchoredDefaults) as (keyof typeof anchoredDefaults)[]) {
    it(`restores and positions ${name} at its default after placement removal in ${direction}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="margin:100px"><button id="anchor">Anchor</button></div>
      `);
      const anchor = wrapper.querySelector('button')!;
      const element = document.createElement(name);
      element.setAttribute('placement', anchoredDefaults[name][0] === 'top' ? 'bottom' : 'top');
      wrapper.append(element);
      await element.updateComplete;
      element.removeAttribute('placement');
      await element.updateComplete;
      const [placement, part] = anchoredDefaults[name];
      expect(element.placement).to.equal(placement);
      if ('steps' in element) {
        element.steps = [{ stepId: 'step', target: anchor, heading: 'Step' }];
        element.start();
      } else if (element.localName === 'lr-popup') {
        const popup = wrapper.querySelector('lr-popup')!;
        popup.anchor = anchor;
        popup.active = true;
      } else if ('show' in element) {
        if ('showAt' in element) element.anchor = anchor;
        await element.show();
      }
      await waitUntil(() => {
        const surface = element.shadowRoot?.querySelector<HTMLElement>(`[part~="${part}"]`);
        return Boolean(surface?.style.top && surface.style.left);
      }, 'surface received viewport coordinates');
    });
  }

  it(`restores the end drawer edge and completes both transitions in ${direction}`, async () => {
    const drawer = await fixture<HTMLElementTagNameMap['lr-drawer']>(html`
      <lr-drawer dir=${direction} placement="start" label="Preferences">Settings</lr-drawer>
    `);
    drawer.removeAttribute('placement');
    expect(drawer.placement).to.equal('end');
    const shown = oneEvent(drawer, 'lr-after-show');
    await drawer.show();
    await shown;
    const panel = drawer.shadowRoot!.querySelector('[part~="panel"]')!.getBoundingClientRect();
    const edge = direction === 'rtl' ? 'left' : 'right';
    expect(panel[edge]).to.be.closeTo(drawer.getBoundingClientRect()[edge], 1);
    drawer.placement = 'start';
    await drawer.updateComplete;
    drawer.removeAttribute('placement');
    const hidden = oneEvent(drawer, 'lr-after-hide');
    await drawer.hide();
    await hidden;
    expect(drawer.open).to.be.false;
  });
}

it('restores toast, tab group, and dock panel defaults after placement removal', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="width:600px;height:400px">
    <lr-toast placement="bottom-start"></lr-toast>
    <lr-tab-group placement="start"></lr-tab-group>
    <lr-dock-panel placement="top" extent="160px"></lr-dock-panel>
  </div>`);
  const toast = wrapper.querySelector('lr-toast')!;
  const tabs = wrapper.querySelector('lr-tab-group')!;
  const dock = wrapper.querySelector('lr-dock-panel')!;
  for (const element of [toast, tabs, dock]) {
    element.removeAttribute('placement');
    await element.updateComplete;
  }
  expect(toast.placement).to.equal('top-end');
  const stack = toast.shadowRoot!.querySelector('[part="stack"]')!;
  expect(getComputedStyle(stack).alignSelf).to.equal('start');
  expect(getComputedStyle(stack).justifySelf).to.equal('end');
  expect(tabs.placement).to.equal('top');
  expect(dock.placement).to.equal('end');
  expect(dock.shadowRoot!.querySelector('[part="handle"]')?.getAttribute('aria-orientation')).to.equal('vertical');
});

it('supports dropdown menu lookup, trigger focus and repositioning before its first render', () => {
  const dropdown = document.createElement('lr-dropdown');
  expect(dropdown.getMenu() === null).to.be.true;
  dropdown.focusOnTrigger();
  dropdown.reposition();
});
