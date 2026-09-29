import { LyraInput } from '../../forms/input/input.class.js';
import '../../forms/input/input.js';
import { expect, fixture, elementUpdated } from '@open-wc/testing';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';
import '../../forms/code-editor/code-editor.js';
import '../../forms/combobox/combobox.js';
import '../../forms/input/native-time-input.js';
import '../../forms/input/number-input.js';
import '../../forms/locale-picker/locale-picker.js';
import '../../forms/select/select.js';
import '../../forms/slider/slider.js';
import '../../layout/app-rail-group/app-rail-group.js';
import '../../layout/app-rail/app-rail.js';
import '../../layout/dashboard-grid/dashboard-grid.js';
import '../../layout/dock-panel/dock-panel.js';
import '../../layout/drilldown-panel/drilldown-panel.js';
import '../../layout/widget/widget.js';
import '../dialog/dialog.js';
import '../drawer/drawer.js';
import '../empty/empty.js';
import './popover.js';
import './tooltip.js';
import '../progress/progress-bar.js';
import '../progress/progress-ring.js';

const cases = [
  [
    'lr-app-rail-group',
    'open',
    'collapsed'
  ],
  [
    'lr-app-rail',
    'hideToggle',
    'withoutToggle'
  ],
  [
    'lr-app-rail',
    'maxRailWidthPx',
    'maxRailWidth'
  ],
  [
    'lr-app-rail',
    'minRailWidthPx',
    'minRailWidth'
  ],
  [
    'lr-app-rail',
    'railWidthPx',
    'railWidth'
  ],
  [
    'lr-code-editor',
    'lineNumbers',
    'withoutLineNumbers'
  ],
  [
    'lr-combobox',
    'showUnknownOption',
    'withUnknownOption'
  ],
  [
    'lr-dashboard-grid',
    'locked',
    'readonly'
  ],
  [
    'lr-dialog',
    'closable',
    'withoutCloseButton'
  ],
  [
    'lr-dock-panel',
    'edge',
    'placement'
  ],
  [
    'lr-dock-panel',
    'resizable',
    'withoutResize'
  ],
  [
    'lr-drawer',
    'closable',
    'withoutCloseButton'
  ],
  [
    'lr-drilldown-panel',
    'showFocusButton',
    'withoutFocusButton'
  ],
  [
    'lr-empty',
    'compact',
    'size'
  ],
  [
    'lr-locale-picker',
    'showFlags',
    'withoutFlags'
  ],
  [
    'lr-native-time-input',
    'noSpinButtons',
    'withoutSpinButtons'
  ],
  [
    'lr-number-input',
    'steppers',
    'withoutSteppers'
  ],
  [
    'lr-popover',
    'arrow',
    'withoutArrow'
  ],
  [
    'lr-progress-bar',
    'showValue',
    'withValue'
  ],
  [
    'lr-progress-ring',
    'showValue',
    'withValue'
  ],
  [
    'lr-select',
    'showUnknownOption',
    'withUnknownOption'
  ],
  [
    'lr-slider',
    'showValue',
    'withValue'
  ],
  [
    'lr-tooltip',
    'arrow',
    'withoutArrow'
  ],
  [
    'lr-widget',
    'compact',
    'size'
  ]
] as const;

for (const [tagName, retired, canonical] of cases) {
  it(`${tagName} exposes ${canonical} without the retired ${retired} property`, async () => {
    await captureDeprecationWarnings([], async () => {
      const el = await fixture(document.createElement(tagName));
      expect(canonical in el, 'canonical property').to.equal(true);
      expect(retired in el, 'retired property').to.equal(false);
      expect(el.shadowRoot !== null, 'renders its supported surface').to.equal(true);
      const state = el as unknown as Record<string, unknown>;
      const initial = state[canonical];
      const attribute = retired.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
      for (const value of ['', 'false', '999', 'end']) {
        el.setAttribute(attribute, value);
        await elementUpdated(el);
        expect(state[canonical], `removed ${attribute}=${value} does not change ${canonical}`).to.equal(initial);
      }
      el.removeAttribute(attribute);
      await elementUpdated(el);
      expect(state[canonical]).to.equal(initial);
    });
  });
}

for (const tagName of ['lr-input', 'lr-number-input']) {
  it(`${tagName} keeps the mirrored noSpinButtons behavior`, async () => {
    const el = await fixture(document.createElement(tagName)) as HTMLElement & {
      noSpinButtons: boolean; withoutSpinButtons: boolean; updateComplete: Promise<unknown>;
    };
    expect(el instanceof LyraInput).to.equal(true);
    expect(el.withoutSpinButtons).to.equal(tagName === 'lr-number-input');
    el.withoutSpinButtons = false;
    el.noSpinButtons = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('input')!.hasAttribute('data-without-spin-buttons')).to.equal(true);
    expect(el.withoutSpinButtons, 'the mirrored flag remains independent').to.equal(false);
    el.noSpinButtons = false;
    el.withoutSpinButtons = true;
    expect(el.noSpinButtons, 'canonical writes do not mutate the mirrored flag').to.equal(false);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('input')!.hasAttribute('data-without-spin-buttons')).to.equal(true);
  });
}

it('native-time shares the implementation without inheriting the public input mirror', async () => {
  const el = await fixture(document.createElement('lr-native-time-input'));
  expect(el instanceof LyraInput).to.equal(false);
  expect('noSpinButtons' in el).to.equal(false);
  expect(typeof (el as unknown as { checkValidity: unknown }).checkValidity).to.equal('function');
});
