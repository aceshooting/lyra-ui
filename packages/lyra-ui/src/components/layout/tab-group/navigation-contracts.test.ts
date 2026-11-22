import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import '../../lr-tab-group.js';
import '../../lr-tab.js';
import '../../lr-tab-panel.js';
import '../../lr-segmented.js';
import '../../lr-stepper.js';
import '../../lr-widget.js';
import '../../lr-dashboard-grid.js';
import '../../lr-menubar.js';
import '../../lr-menu-label.js';
import '../../lr-control-group.js';
import '../../lr-button-group.js';
import '../../lr-app-rail.js';
import '../../lr-app-rail-item.js';
import '../../lr-app-rail-group.js';
import '../../lr-navigation-menu-item.js';
import '../../lr-navigation-menu.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-breadcrumb.js';
import '../../lr-breadcrumb-item.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];
const steps = options.map(option => ({ stepId: option.value, label: option.label, state: 'pending' as const }));

it('preserves the selected tab and segment outline under forced colors', async () => {
  try {
    await setForcedColors('active');
    const root = await fixture(html`<div><lr-tab-group><lr-tab panel="a">A</lr-tab><lr-tab panel="b">B</lr-tab></lr-tab-group>
      <lr-segmented value="a" .items=${options}></lr-segmented></div>`);
    for (const host of root.children) {
      const nodes = host.shadowRoot!.querySelectorAll('[role="tab"], [role="radio"]');
      expect(getComputedStyle(nodes[0]!).outlineStyle).to.equal('solid');
      expect(getComputedStyle(nodes[1]!).outlineStyle).to.equal('none');
    }
  } finally {
    await setForcedColors('none');
  }
});

it('honors a descriptor accessible name on the actual tab', async () => {
  const group = await fixture(html`<lr-tab-group><lr-tab panel="x" aria-label="Close account">X</lr-tab></lr-tab-group>`);
  const descriptor = group.querySelector('lr-tab')!;
  const button = group.shadowRoot!.querySelector('[role="tab"]')!;
  expect(button.getAttribute('aria-label')).to.equal('Close account');
  const label = document.createElement('span');
  label.id = 'difficult-action';
  label.textContent = 'Referenced name';
  group.before(label);
  try {
    descriptor.setAttribute('aria-labelledby', label.id);
    await waitUntil(() => button.getAttribute('aria-label') === 'Referenced name');
    label.firstChild!.textContent = 'Updated name';
    await waitUntil(() => button.getAttribute('aria-label') === 'Updated name');
    const replacement = label.cloneNode() as HTMLElement;
    replacement.textContent = 'Replacement name';
    label.replaceWith(replacement);
    try {
      await waitUntil(() => button.getAttribute('aria-label') === 'Replacement name');
      replacement.removeAttribute('id');
      await waitUntil(() => button.getAttribute('aria-label') === 'Close account');
      replacement.id = label.id;
      await waitUntil(() => button.getAttribute('aria-label') === 'Replacement name');
    } finally {
      replacement.replaceWith(label);
    }
    const parent = group.parentElement!;
    group.remove();
    label.textContent = 'Reconnected name';
    parent.append(group);
    await waitUntil(() => group.shadowRoot!.querySelector('[role="tab"]')?.getAttribute('aria-label') === 'Reconnected name');
    descriptor.removeAttribute('aria-labelledby');
  } finally {
    label.remove();
  }
  descriptor.removeAttribute('aria-label');
  await waitUntil(() => button.getAttribute('aria-label') === 'X');
});

it('reports positions beyond the step and segment collection limits and clears loss on replacement', async () => {
  const data = Array.from({ length: 259 }, (_, i) => ({ label: String(i), value: String(i), stepId: String(i), state: 'completed' as const }));
  const root = await fixture(html`<div><lr-stepper .steps=${data}></lr-stepper><lr-segmented .items=${data}></lr-segmented></div>`);
  const stepper = root.querySelector('lr-stepper')!;
  const seg = root.querySelector('lr-segmented')!;
  expect(stepper.omittedSteps).to.equal(3);
  expect(seg.omittedItems).to.equal(3);
  stepper.steps = steps;
  seg.items = options;
  expect(stepper.omittedSteps).to.equal(0);
  expect(seg.omittedItems).to.equal(0);
});

it('preserves focus on the list when a short stepper becomes read-only', async () => {
  const el = await fixture(html`<lr-stepper .steps=${steps}></lr-stepper>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="step"]')!);
  el.setAttribute('readonly', '');
  await waitUntil(() => el.shadowRoot!.querySelector('[part="step"]')?.localName === 'div');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

for (const [name, selector] of [
  ['tab-group', '[role="tablist"]'], ['stepper', '[part="base"]'], ['menubar', '[role="menubar"]'],
  ['control-group', '[role="group"]'], ['button-group', '[role="group"]'], ['breadcrumb', 'nav'],
  ['app-rail', '[role="navigation"]'],
]) {
  it(`resolves label and accessibleLabel on the ${name} role owner`, async () => {
    const el = await fixture<HTMLElement & { label: string; accessibleLabel: string | null; updateComplete: Promise<boolean> }>(
      '<lr-' + name + (name === 'app-rail' ? ' force-mode="full"' : '') + '></lr-' + name + '>');
    el.label = 'Fallback';
    await el.updateComplete;
    const owner = el.shadowRoot!.querySelector(selector!)!;
    expect(owner.getAttribute('aria-label')).to.equal('Fallback');
    el.accessibleLabel = 'Explicit';
    await el.updateComplete;
    expect(owner.getAttribute('aria-label')).to.equal('Explicit');
    el.accessibleLabel = '';
    await el.updateComplete;
    expect(owner.getAttribute('aria-label')).to.equal('');
    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(owner.getAttribute('aria-label')).to.equal('');
  });
}

it('preserves author descriptions alongside changing segmented hints', async () => {
  const root = await fixture(html`<div><p id="segment-note">External</p>
    <lr-segmented aria-describedby="segment-note" hint="Guide"></lr-segmented></div>`);
  const group = root.querySelector('lr-segmented')!;
  const base = group.shadowRoot!.querySelector<HTMLElement>('[role="radiogroup"]')!;
  const ids = () => (base.ariaDescribedByElements ?? []).map(el => el.id);
  expect(ids()).to.have.members(['segment-note', 'segmented-hint']);
  group.hint = '';
  await group.updateComplete;
  expect(ids()).to.deep.equal(['segment-note']);
});

it('keeps menu metadata accessible as a description while retaining the action name', async () => {
  const item = await fixture(html`<lr-menu-item aria-describedby="original">Save
    <span id="shortcut" slot="details">Control S</span><span id="format" slot="suffix">PDF</span></lr-menu-item>`);
  const ids = () => (item.ariaDescribedByElements ?? []).map(el => el.id);
  await waitUntil(() => ids().includes('format') && ids().includes('shortcut'));
  expect(item.getAttribute('aria-label')).to.equal('Save');
  item.querySelector('#format')!.remove();
  await waitUntil(() => !ids().includes('format'));
  expect(ids()).to.include('shortcut');
  const parent = item.parentElement!;
  item.remove();
  parent.append(item);
  await waitUntil(() => ids().includes('shortcut'));
  item.querySelector('#shortcut')!.remove();
  await waitUntil(() => !ids().includes('shortcut'));
});

it('leaves a controlled checkbox at its listener-assigned value and still selects it', async () => {
  const menu = await fixture(html`<lr-menu><lr-menu-item type="checkbox">Flag</lr-menu-item></lr-menu>`);
  const item = menu.querySelector('lr-menu-item')!;
  item.addEventListener('lr-menu-item-change-request', () => { item.checked = false; });
  let selected = 0;
  menu.addEventListener('lr-select', () => { selected++; });
  item.select();
  expect(item.checked).to.equal(false);
  expect(selected).to.equal(1);
});

it('uses layout pixels to position the separator in a scaled rail', async () => {
  const el = await fixture(html`<lr-app-rail force-mode="full" resizable
    style="transform:scale(2);transform-origin:top left;--lr-app-rail-width:200px"></lr-app-rail>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const resizer = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
  await waitUntil(() => resizer.style.insetInlineStart !== '');
  // The hit target starts at the rail edge and extends outward, in unscaled layout pixels.
  expect(parseFloat(resizer.style.insetInlineStart)).to.be.closeTo(base.offsetWidth, 1);
  expect(resizer.getAttribute('aria-valuenow')).to.equal(String(base.offsetWidth));
});

it('preserves foldable words in panel content and limits emergency wrapping to labels', async () => {
  const root = await fixture(html`<div><lr-tab-group><lr-tab panel="a">A</lr-tab><lr-tab-panel name="a">Contents</lr-tab-panel></lr-tab-group>
    <lr-breadcrumb><lr-breadcrumb-item>First</lr-breadcrumb-item></lr-breadcrumb>
    <lr-navigation-menu-item href="/">Home</lr-navigation-menu-item></div>`);
  const targets = [root.querySelector('lr-tab-group')!.shadowRoot!.querySelector('[part="panel"]')!,
    root.querySelector('lr-breadcrumb')!, root.querySelector('lr-breadcrumb-item')!,
    root.querySelector('lr-navigation-menu-item')!.shadowRoot!.querySelector('[part~="base"]')!];
  for (const target of targets) expect(getComputedStyle(target).overflowWrap).to.equal('break-word');
});

it('keeps visible rail tooltip chrome in the floating surface theme', async () => {
  const el = await fixture(html`<lr-app-rail-item icon-only tooltip style="--lr-overlay-surface:rgb(12, 34, 56)">Home</lr-app-rail-item>`);
  el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.dispatchEvent(new MouseEvent('mouseenter'));
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="tooltip"]'));
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="tooltip"]')!).backgroundColor).to.equal('rgb(12, 34, 56)');
});

it('respects a controlled rail width even when the listener writes the held width', async () => {
  const root = await fixture(html`<div><lr-app-rail resizable rail-width="240" force-mode="full"></lr-app-rail></div>`);
  const rail = root.querySelector('lr-app-rail')!;
  const handle = rail.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
  rail.addEventListener('lr-rail-resize-request', () => { rail.railWidth = rail.railWidth; });
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(rail.railWidth).to.equal(240);
});

it('keeps a controlled mobile rail closed when a listener assigns its held state', async () => {
  const rail = await fixture<HTMLElementTagNameMap['lr-app-rail']>(html`<lr-app-rail mobile-breakpoint="99999px"></lr-app-rail>`);
  await waitUntil(() => rail.mode === 'mobile');
  const events: string[] = [];
  rail.addEventListener('lr-toggle', event => events.push(event.type));
  rail.addEventListener('lr-toggle-request', event => {
    events.push(event.type);
    rail.open = false;
  }, { once: true });
  rail.toggle();
  expect(rail.open).to.equal(false);
  expect(events).to.deep.equal(['lr-toggle-request']);
  rail.toggle();
  expect(rail.open).to.equal(true);
  expect(events).to.deep.equal(['lr-toggle-request', 'lr-toggle']);
});

it('honors navigation chrome tokens on each role owner', async () => {
  const root = await fixture(html`<div style="--lr-menubar-gap:19px; --lr-breadcrumb-gap:21px;
      --lr-breadcrumb-item-separator-color:rgb(1, 2, 3); --lr-menu-label-color:rgb(4, 5, 6);
      --lr-app-rail-pin-pressed-bg:rgb(7, 8, 9); --lr-app-rail-pin-pressed-color:rgb(10, 11, 12)">
    <lr-menubar><lr-menubar-item>Home</lr-menubar-item></lr-menubar>
    <lr-breadcrumb><lr-breadcrumb-item>Home</lr-breadcrumb-item><lr-breadcrumb-item>Settings</lr-breadcrumb-item></lr-breadcrumb>
    <lr-menu-label>Actions</lr-menu-label><lr-app-rail auto-hide force-mode="full"></lr-app-rail></div>`);
  for (const [host, part, property, value] of [
    ['lr-menubar', 'base', 'column-gap', '19px'], ['lr-breadcrumb', 'list', 'column-gap', '21px'],
    ['lr-breadcrumb-item', 'separator', 'color', 'rgb(1, 2, 3)'], ['lr-menu-label', 'base', 'color', 'rgb(4, 5, 6)'],
    ['lr-app-rail', 'pin-button', 'background-color', 'rgb(7, 8, 9)'], ['lr-app-rail', 'pin-button', 'color', 'rgb(10, 11, 12)'],
  ] as const) {
    const target = root.querySelector(host)!.shadowRoot!.querySelector(`[part~="${part}"]`)!;
    expect(getComputedStyle(target).getPropertyValue(property), host + '/' + part).to.equal(value);
  }
});

it('exposes a named close action for each closable tab without changing selection', async () => {
  const group = await fixture(html`<lr-tab-group><lr-tab panel="a">First</lr-tab>
    <lr-tab panel="b" closable>Second</lr-tab><lr-tab panel="c" disabled closable>Third</lr-tab></lr-tab-group>`);
  const actions = group.shadowRoot!.querySelectorAll<HTMLButtonElement>('button[data-close-tab]');
  expect(actions.length).to.equal(1);
  const action = actions[0]!;
  expect(action.closest('[role="tab"]') === null).to.equal(true);
  expect(action.getAttribute('aria-label')).to.equal('Close Second');
  const tabs = group as HTMLElementTagNameMap['lr-tab-group'];
  tabs.strings = { tabCloseAction: 'Dismiss {label}' };
  await tabs.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Dismiss Second');
  let closed = '';
  group.addEventListener('lr-close', event => { closed = (event.target as HTMLElement).getAttribute('panel')!; });
  action.click();
  expect(closed).to.equal('b');
  expect(group.getAttribute('active')).to.equal('a');
});

it('rebinds role descriptions to the destination document on adoption', async () => {
  const root = await fixture(html`<div><span id="shared-note">First</span><iframe title="Destination"></iframe>
    <lr-breadcrumb></lr-breadcrumb><lr-button-group></lr-button-group><lr-control-group></lr-control-group>
    <lr-menubar></lr-menubar><lr-segmented></lr-segmented></div>`);
  const destination = root.querySelector('iframe')!.contentDocument!;
  const note = destination.createElement('p');
  note.id = 'shared-note';
  note.textContent = 'Second';
  destination.body.append(note);
  for (const host of Array.from(root.children).slice(2)) {
    host.setAttribute('aria-describedby', note.id);
    destination.body.append(destination.adoptNode(host));
    const owner = host.shadowRoot!.querySelector<HTMLElement>('nav, [role]')!;
    await waitUntil(() => owner.ariaDescribedByElements?.[0] === note);
  }
});

it('keeps the mobile scrim out of hit testing after a close and honors motion preferences', async () => {
  try {
    for (const preference of ['no-preference', 'reduce'] as const) {
      await setReducedMotion(preference);
      const root = await fixture(html`<div><lr-app-rail mobile-breakpoint="99999px"></lr-app-rail></div>`);
      const rail = root.querySelector('lr-app-rail')!;
      const backdrop = rail.shadowRoot!.querySelector<HTMLElement>('[part="backdrop"]')!;
      expect(getComputedStyle(backdrop).pointerEvents).to.equal('none');
      expect(getComputedStyle(backdrop).transitionProperty.includes('opacity')).to.equal(preference === 'no-preference');
      rail.open = true;
      await rail.updateComplete;
      expect(getComputedStyle(backdrop).pointerEvents).to.equal('auto');
      rail.open = false;
      await rail.updateComplete;
      expect(getComputedStyle(backdrop).pointerEvents).to.equal('none');
    }
  } finally {
    await setReducedMotion('no-preference');
  }
});

it('exposes a nested rail disclosure with its original event target', async () => {
  const root = await fixture(html`<div><lr-app-rail force-mode="full">
    <lr-app-rail-group collapsible heading="Files"><lr-app-rail-item>Inbox</lr-app-rail-item></lr-app-rail-group>
    </lr-app-rail></div>`);
  const rail = root.querySelector('lr-app-rail')!;
  const group = root.querySelector('lr-app-rail-group')!;
  const origins: string[] = [];
  rail.addEventListener('lr-toggle', event => origins.push((event.target as Element).localName));
  group.shadowRoot!.querySelector<HTMLElement>('button')!.click();
  await group.updateComplete;
  expect(origins).to.deep.equal(['lr-app-rail-group']);
  expect(rail.open).to.equal(false);
});

it('repairs mobile navigation when its external trigger id does not resolve to an HTML element', async () => {
  const root = await fixture(html`<div><svg id="rail-drawing"></svg>
    <lr-app-rail for="rail-drawing" mobile-breakpoint="99999px"></lr-app-rail></div>`);
  const rail = root.querySelector('lr-app-rail')!;
  rail.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!.click();
  await rail.updateComplete;
  expect(rail.open).to.equal(true);
  expect(root.querySelector('svg')!.hasAttribute('aria-expanded')).to.equal(false);
});

it('keeps collection readbacks valid when a source reports an invalid length', async () => {
  const root = await fixture(html`<div><lr-stepper></lr-stepper><lr-segmented></lr-segmented></div>`);
  const stepper = root.querySelector('lr-stepper')!;
  const seg = root.querySelector('lr-segmented')!;
  const source = new Proxy([...steps.map((step, index) => ({ ...step, value: String(index) }))], {
    get(target, key, receiver) {
      return key === 'length' ? NaN : Reflect.get(target, key, receiver);
    },
  });
  stepper.steps = source;
  seg.items = source;
  expect([stepper.omittedSteps, seg.omittedItems]).to.deep.equal([0, 0]);
  expect([stepper.steps.length, seg.items.length]).to.deep.equal([0, 0]);
});


for (const [name, markup, owner, selector, property] of [
  ['menubar item', '<lr-menubar><lr-menubar-item>Home</lr-menubar-item></lr-menubar>', 'lr-menubar-item', '[part="base"]', 'color'],
  ['navigation toggle', '<lr-navigation-menu mobile-breakpoint="99999px"></lr-navigation-menu>', 'lr-navigation-menu', '[part="toggle"]', 'background-color'],
  ['tab close', '<lr-tab closable>Files</lr-tab>', 'lr-tab', '[part~="close-button"]', 'background-color'],
] as const) {
  it(`paints the ${name} with its hover and press tokens`, async () => {
    const root = await fixture<HTMLElement>(`<div data-lr-theme-scope style="--lr-transition-interactive:none; --lr-transition-fast:0ms;
      --lr-menubar-item-hover-color:rgb(1, 2, 3); --lr-menubar-item-active-color:rgb(4, 5, 6);
      --lr-navigation-menu-toggle-hover-bg:rgb(1, 2, 3); --lr-navigation-menu-toggle-active-bg:rgb(4, 5, 6);
      --lr-tab-close-hover-bg:rgb(1, 2, 3); --lr-tab-close-active-bg:rgb(4, 5, 6)">${markup}</div>`);
    const host = root.querySelector(owner)!;
    await waitUntil(() => host.shadowRoot?.querySelector(selector) != null);
    const target = host.shadowRoot!.querySelector(selector)!;
    try {
      await hoverUntilMatched(target, 'pointer reaches ' + name);
      await waitUntil(() => getComputedStyle(target).getPropertyValue(property) === 'rgb(1, 2, 3)', 'hover token paints ' + name);
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(target).getPropertyValue(property) === 'rgb(4, 5, 6)', 'pressed token paints ' + name);
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });
}

it('reports positions beyond the widget view and dashboard cell limits and clears loss on replacement', async () => {
  const views = Array.from({ length: 258 }, (_, i) => ({ viewId: `v${i}`, label: String(i) }));
  const cells = Array.from({ length: 1_002 }, (_, i) => ({ cellId: `c${i}`, x: 0, y: i, w: 1, h: 1 }));
  // The caps apply synchronously in the setters, so detached hosts keep the test from rendering
  // 1,000 cells and 256 views (slow enough under WebKit on CI to exceed the test timeout).
  const widget = document.createElement('lr-widget');
  const grid = document.createElement('lr-dashboard-grid');
  widget.views = views;
  grid.layout = cells;
  expect([widget.omittedViews, grid.omittedCells]).to.deep.equal([2, 2]);
  expect([widget.views.length, grid.layout.length]).to.deep.equal([256, 1_000]);
  widget.views = views.slice(0, 2);
  grid.layout = cells.slice(0, 2);
  expect([widget.omittedViews, grid.omittedCells]).to.deep.equal([0, 0]);
});
