// <lr-toggle-group> renders no library-owned copy (its name comes from the host aria-label or
// `label`, and its one diagnostic is a developer console message), so there is no DEFAULT_STRINGS
// key and no `.strings` override to prove. The localization convention is not applicable here.
//
// Every fixture gives each toggle a distinct, non-empty value: wtr pages run Lit in dev mode, so
// an ambiguous value would print the group's development warning, which the strict-console lanes
// treat as a failure. The warning test below is the one deliberate exception, and it swaps the
// warning store first.
import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './toggle-group.js';
import '../toggle/toggle.js';
import '../../overlays/overlay/tooltip.js';
import type { LyraToggleGroup, LyraToggleGroupToggleRequestDetail } from './toggle-group.class.js';
import type { LyraToggle } from '../toggle/toggle.class.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { forceCoarsePointer } from '../../../../test/coarse-pointer-media.js';

const control = (toggle: LyraToggle): HTMLButtonElement =>
  toggle.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;

const owned = (root: ParentNode, selector = 'lr-toggle'): LyraToggle[] => [
  ...root.querySelectorAll<LyraToggle>(selector),
];

const stops = (toggles: readonly LyraToggle[]): (string | null)[] =>
  toggles.map((toggle) => control(toggle).getAttribute('tabindex'));

const pressed = (toggles: readonly LyraToggle[]): string[] =>
  toggles.filter((toggle) => toggle.pressed).map((toggle) => toggle.value);

/** The element that really holds focus, walking every open shadow root. */
function deepActive(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Id-like label of whichever toggle owns the deep active element, or the active tag name. */
function focusedValue(toggles: readonly LyraToggle[]): string {
  const active = deepActive();
  const toggle = toggles.find((candidate) => control(candidate) === active);
  return toggle ? toggle.value : active?.localName ?? 'none';
}

/** Two frames: long enough for observer-driven syncs, Lit updates and the run projection. */
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function mount(template: ReturnType<typeof html>): Promise<LyraToggleGroup> {
  const group = await fixture<LyraToggleGroup>(template);
  await settle();
  return group;
}

describe('<lr-toggle-group>', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('renders a named role=group base, by host aria-label presence and then by label', async () => {
    const group = await mount(html`<lr-toggle-group aria-label="Formatting" label="Fallback">
      <lr-toggle value="bold">Bold</lr-toggle>
    </lr-toggle-group>`);
    const base = group.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    // The runtime side of the manifest's projected accessor defaults; the opt-ins stay unset.
    expect([group.selectionMode, group.orientation, group.disabled, group.size, group.appearance]).to.deep.equal([
      'multiple',
      'horizontal',
      false,
      undefined,
      undefined,
    ]);
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Formatting');
    group.setAttribute('aria-label', '');
    await group.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('');
    group.removeAttribute('aria-label');
    await group.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('Fallback');
    group.label = '';
    await group.updateComplete;
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(base.hasAttribute('aria-orientation')).to.equal(false);
  });

  it('owns direct, wrapped and tooltip-wrapped toggles, but not nested, foreign-shadow or named-slot ones', async () => {
    const group = await mount(html`<lr-toggle-group label="Outer">
      <lr-toggle value="direct">Direct</lr-toggle>
      <span><lr-toggle value="wrapped">Wrapped</lr-toggle></span>
      <lr-tooltip><lr-toggle slot="trigger" value="tooltip">Tooltip</lr-toggle>Explains the toggle</lr-tooltip>
      <lr-toggle-group label="Inner"><lr-toggle value="nested">Nested</lr-toggle></lr-toggle-group>
      <div id="foreign"></div>
      <div slot="x"><lr-toggle value="slotted">Slotted</lr-toggle></div>
    </lr-toggle-group>`);
    const root = group.querySelector('#foreign')!.attachShadow({ mode: 'open' });
    root.innerHTML = '<lr-toggle value="shadowed">Shadowed</lr-toggle>';
    const shadowed = root.querySelector<LyraToggle>('lr-toggle')!;
    await shadowed.updateComplete;
    await settle();

    for (const toggle of [...owned(group), shadowed]) toggle.pressed = true;
    expect([...group.value]).to.deep.equal(['direct', 'wrapped', 'tooltip']);
    const inner = group.querySelector<LyraToggleGroup>('lr-toggle-group')!;
    expect([...inner.value]).to.deep.equal(['nested']);

    const outerOwned = owned(group).filter((toggle) => ['direct', 'wrapped', 'tooltip'].includes(toggle.value));
    expect(stops(outerOwned).filter((value) => value === '0').length).to.equal(1);
    expect(stops(outerOwned).every((value) => value === '0' || value === '-1')).to.equal(true);
    const slotted = group.querySelector<LyraToggle>('[value="slotted"]')!;
    expect(control(slotted).hasAttribute('tabindex'), 'a named-slot toggle stays standalone').to.equal(false);
    expect(control(shadowed).hasAttribute('tabindex'), 'a foreign-shadow toggle stays standalone').to.equal(false);
    expect(slotted.getToolbarActions().length).to.equal(1);
    expect(shadowed.getToolbarActions().length).to.equal(1);
  });

  it('keeps exactly one tab stop on an internal button and lets Tab enter and leave the group', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <button id="before">Before</button>
      <lr-toggle-group label="Formatting">
        <lr-toggle value="a">A</lr-toggle>
        <lr-toggle value="b" pressed>B</lr-toggle>
        <lr-toggle value="c">C</lr-toggle>
      </lr-toggle-group>
      <button id="after">After</button>
    </div>`);
    await settle();
    const toggles = owned(wrapper);
    expect(stops(toggles)).to.deep.equal(['-1', '0', '-1']);
    expect(toggles.some((toggle) => toggle.hasAttribute('tabindex'))).to.equal(false);
    wrapper.querySelector<HTMLButtonElement>('#before')!.focus();
    await sendKeys({ press: 'Tab' });
    expect(focusedValue(toggles)).to.equal('b');
    await sendKeys({ press: 'Tab' });
    expect(deepActive()?.id).to.equal('after');

    const plain = await mount(html`<lr-toggle-group label="Plain">
      <lr-toggle value="x" disabled>X</lr-toggle>
      <lr-toggle value="y">Y</lr-toggle>
    </lr-toggle-group>`);
    expect(stops(owned(plain))).to.deep.equal(['-1', '0']);
  });

  it('roves with arrows (wrapping), Home and End, without changing pressed state', async () => {
    const group = await mount(html`<lr-toggle-group label="Formatting">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
      <lr-toggle value="c">C</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    toggles[0]!.focus();
    await sendKeys({ press: 'ArrowRight' });
    expect(focusedValue(toggles)).to.equal('b');
    await sendKeys({ press: 'ArrowRight' });
    await sendKeys({ press: 'ArrowRight' });
    expect(focusedValue(toggles), 'ArrowRight wraps').to.equal('a');
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusedValue(toggles), 'ArrowLeft wraps').to.equal('c');
    await sendKeys({ press: 'Home' });
    expect(focusedValue(toggles)).to.equal('a');
    await sendKeys({ press: 'End' });
    expect(focusedValue(toggles)).to.equal('c');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'ArrowUp' });
    expect(focusedValue(toggles), 'cross-axis arrows are ignored').to.equal('c');
    await settle();
    expect(stops(toggles)).to.deep.equal(['-1', '-1', '0']);
    expect(pressed(toggles)).to.deep.equal([]);

    group.orientation = 'vertical';
    await group.updateComplete;
    await sendKeys({ press: 'ArrowDown' });
    expect(focusedValue(toggles)).to.equal('a');
    await sendKeys({ press: 'ArrowUp' });
    expect(focusedValue(toggles)).to.equal('c');
    await sendKeys({ press: 'ArrowLeft' });
    await sendKeys({ press: 'ArrowRight' });
    expect(focusedValue(toggles)).to.equal('c');
    expect(pressed(toggles)).to.deep.equal([]);
  });

  it('mirrors horizontal arrows under RTL', async () => {
    // Three toggles, not two: with two, "next" and "previous" land on the same toggle through
    // wrap-around, so an unmirrored handler would pass unnoticed.
    const group = await mount(html`<lr-toggle-group dir="rtl" label="Formatting">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
      <lr-toggle value="c">C</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    toggles[0]!.focus();
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusedValue(toggles), 'ArrowLeft moves to the next toggle in RTL').to.equal('b');
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusedValue(toggles)).to.equal('c');
    await sendKeys({ press: 'ArrowRight' });
    expect(focusedValue(toggles), 'ArrowRight moves to the previous toggle in RTL').to.equal('b');
  });

  it('skips unavailable toggles and repairs the tab stop when a style or class hides it', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <style>.gone { display: none; }</style>
      <button id="before">Before</button>
      <lr-toggle-group label="Formatting">
        <lr-toggle value="a">A</lr-toggle>
        <lr-toggle value="disabled" disabled>Disabled</lr-toggle>
        <lr-toggle value="hidden" hidden>Hidden</lr-toggle>
        <lr-toggle value="inert" inert>Inert</lr-toggle>
        <span inert><lr-toggle value="inert-wrapper">Inert wrapper</lr-toggle></span>
        <span aria-disabled="true"><lr-toggle value="aria-disabled">Aria disabled</lr-toggle></span>
        <span id="wrap"><lr-toggle value="b">B</lr-toggle></span>
        <lr-toggle value="c">C</lr-toggle>
      </lr-toggle-group>
    </div>`);
    await settle();
    const toggles = owned(wrapper);
    const byValue = (value: string): LyraToggle => toggles.find((toggle) => toggle.value === value)!;
    byValue('a').focus();
    await sendKeys({ press: 'ArrowRight' });
    expect(focusedValue(toggles)).to.equal('b');
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusedValue(toggles)).to.equal('a');
    (deepActive() as HTMLElement | null)?.blur();

    const zeroStops = (): string[] =>
      toggles.filter((toggle) => control(toggle).getAttribute('tabindex') === '0').map((toggle) => toggle.value);
    expect(zeroStops()).to.deep.equal(['a']);
    byValue('a').style.display = 'none';
    await waitUntil(() => zeroStops().length === 1 && zeroStops()[0] === 'b', 'a style-hidden stop was not repaired');
    wrapper.querySelector('#wrap')!.classList.add('gone');
    await waitUntil(() => zeroStops().length === 1 && zeroStops()[0] === 'c', 'a class-hidden stop was not repaired');
    wrapper.querySelector<HTMLButtonElement>('#before')!.focus();
    await sendKeys({ press: 'Tab' });
    expect(focusedValue(toggles)).to.equal('c');
  });

  it('activates the focused toggle with Space even after the pointer hovered another', async () => {
    const group = await mount(html`<lr-toggle-group label="Formatting">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    toggles[0]!.focus();
    await hoverUntilMatched(control(toggles[1]!), 'the pointer never hovered the second toggle');
    await sendKeys({ press: 'Space' });
    await settle();
    expect(pressed(toggles)).to.deep.equal(['a']);
  });

  it('reports a multiple-mode value in DOM order and consumes each child event', async () => {
    const group = await mount(html`<lr-toggle-group label="Filters">
      <lr-toggle value="c">C</lr-toggle>
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    const changes: string[][] = [];
    let childEvents = 0;
    group.addEventListener('lr-change', (event) => changes.push([...event.detail.value]));
    for (const toggle of toggles) {
      toggle.addEventListener('lr-change', () => {
        childEvents += 1;
      });
      toggle.addEventListener('lr-toggle-toggle-request', () => {
        childEvents += 1;
      });
    }
    for (const toggle of [...toggles].reverse()) {
      control(toggle).click();
      await settle();
    }
    expect([...group.value]).to.deep.equal(['c', 'a', 'b']);
    expect(changes).to.deep.equal([['b'], ['a', 'b'], ['c', 'a', 'b']]);
    expect(childEvents).to.equal(0);
  });

  it('keeps zero or one pressed in single mode and lets the pressed toggle clear the choice', async () => {
    const group = await mount(html`<lr-toggle-group selection-mode="single" label="Highlight (optional, pick one)">
      <lr-toggle value="a" pressed>A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    const changes: string[][] = [];
    group.addEventListener('lr-change', (event) => changes.push([...event.detail.value]));
    control(toggles[1]!).click();
    await settle();
    expect(pressed(toggles)).to.deep.equal(['b']);
    expect([...group.value]).to.deep.equal(['b']);
    control(toggles[1]!).click();
    await settle();
    expect(pressed(toggles)).to.deep.equal([]);
    expect(changes).to.deep.equal([['b'], []]);
  });

  it('republishes the request with an identity-preserving option and honours a veto', async () => {
    const group = await mount(html`<lr-toggle-group label="Filters">
      <lr-toggle value="a" pressed>A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>`);
    const [a, b] = owned(group);
    let detail: LyraToggleGroupToggleRequestDetail | undefined;
    let cancelable = false;
    let changes = 0;
    group.addEventListener('lr-change', () => {
      changes += 1;
    });
    const veto = (event: CustomEvent<LyraToggleGroupToggleRequestDetail>): void => {
      detail = event.detail;
      cancelable = event.cancelable;
      event.preventDefault();
    };
    group.addEventListener('lr-toggle-group-toggle-request', veto);
    control(b!).click();
    await settle();
    expect(cancelable).to.equal(true);
    expect(detail!.option === b).to.equal(true);
    expect([...detail!.value]).to.deep.equal(['a', 'b']);
    expect([...detail!.previousValue]).to.deep.equal(['a']);
    expect(Object.isFrozen(detail!.value)).to.equal(true);
    expect(pressed([a!, b!])).to.deep.equal(['a']);
    expect(changes).to.equal(0);
    group.removeEventListener('lr-toggle-group-toggle-request', veto);

    group.selectionMode = 'single';
    const refuseClearing = (event: CustomEvent<LyraToggleGroupToggleRequestDetail>): void => {
      if (event.detail.value.length === 0) event.preventDefault();
    };
    group.addEventListener('lr-toggle-group-toggle-request', refuseClearing);
    control(a!).click();
    await settle();
    expect(pressed([a!, b!]), 'the transient recipe kept the choice').to.deep.equal(['a']);
    expect(changes).to.equal(0);
  });

  it('lets a request listener resolve the change by assigning value, suppressing the commit', async () => {
    const group = await mount(html`<lr-toggle-group label="Filters">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    let changes = 0;
    group.addEventListener('lr-change', () => {
      changes += 1;
    });
    group.addEventListener('lr-toggle-group-toggle-request', () => {
      group.value = ['a'];
    });
    control(toggles[1]!).click();
    await settle();
    expect(pressed(toggles)).to.deep.equal(['a']);
    expect(changes).to.equal(0);
  });

  it('applies a programmatic value silently in both modes, including before children exist', async () => {
    const group = await mount(html`<lr-toggle-group label="Filters">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
      <lr-toggle value="c">C</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    let events = 0;
    for (const name of ['lr-change', 'lr-toggle-group-toggle-request'] as const) {
      group.addEventListener(name, () => {
        events += 1;
      });
    }
    group.value = ['c', 'b'];
    expect(pressed(toggles)).to.deep.equal(['b', 'c']);
    expect([...group.value]).to.deep.equal(['b', 'c']);
    group.selectionMode = 'single';
    await group.updateComplete;
    group.value = ['missing', 'c', 'b'];
    expect(pressed(toggles)).to.deep.equal(['c']);
    await settle();
    expect(events).to.equal(0);

    const empty = await mount(html`<lr-toggle-group label="Late"></lr-toggle-group>`);
    empty.value = ['y'];
    const x = document.createElement('lr-toggle');
    x.value = 'x';
    x.textContent = 'X';
    const y = document.createElement('lr-toggle');
    y.value = 'y';
    y.textContent = 'Y';
    empty.append(x, y);
    await waitUntil(() => y.pressed, 'the pending value was never applied');
    expect(x.pressed).to.equal(false);
    expect([...empty.value]).to.deep.equal(['y']);
  });

  it('applies single-mode exclusivity to programmatic presses synchronously', async () => {
    const group = await mount(html`<lr-toggle-group selection-mode="single" label="Highlight">
      <lr-toggle value="a" pressed>A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
    </lr-toggle-group>`);
    const [a, b] = owned(group);
    b!.pressed = true;
    expect(a!.pressed).to.equal(false);
    expect([...group.value]).to.deep.equal(['b']);
  });

  it('keeps the first pressed toggle when single mode starts with, or switches to, several pressed', async () => {
    const single = await mount(html`<lr-toggle-group selection-mode="single" label="Highlight">
      <lr-toggle value="a" pressed>A</lr-toggle>
      <lr-toggle value="b" pressed>B</lr-toggle>
    </lr-toggle-group>`);
    expect(pressed(owned(single))).to.deep.equal(['a']);

    const multiple = await mount(html`<lr-toggle-group label="Filters">
      <lr-toggle value="a" pressed>A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
      <lr-toggle value="c" pressed>C</lr-toggle>
    </lr-toggle-group>`);
    let events = 0;
    multiple.addEventListener('lr-change', () => {
      events += 1;
    });
    multiple.selectionMode = 'single';
    await multiple.updateComplete;
    expect(pressed(owned(multiple))).to.deep.equal(['a']);
    multiple.selectionMode = 'multiple';
    await multiple.updateComplete;
    expect(pressed(owned(multiple))).to.deep.equal(['a']);
    expect(events).to.equal(0);
    multiple.setAttribute('selection-mode', 'bogus');
    await multiple.updateComplete;
    expect(multiple.selectionMode).to.equal('multiple');
    expect(multiple.getAttribute('selection-mode')).to.equal('multiple');

    // A pick remembered from an earlier single-mode spell must not outrank the documented "first
    // pressed" rule once presses made in multiple mode intervene.
    const [a, , c] = owned(multiple);
    multiple.selectionMode = 'single';
    control(c!).click();
    await settle();
    expect(pressed(owned(multiple))).to.deep.equal(['c']);
    multiple.selectionMode = 'multiple';
    control(a!).click();
    await settle();
    expect(pressed(owned(multiple))).to.deep.equal(['a', 'c']);
    multiple.selectionMode = 'single';
    await multiple.updateComplete;
    expect(pressed(owned(multiple))).to.deep.equal(['a']);
  });

  it('projects group disabled onto every internal button and restores each toggle on re-enable', async () => {
    const group = await mount(html`<lr-toggle-group label="Filters">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b" disabled>B</lr-toggle>
      <lr-toggle value="c">C</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    group.disabled = true;
    await settle();
    expect(toggles.every((toggle) => control(toggle).disabled)).to.equal(true);
    expect(stops(toggles).includes('0')).to.equal(false);
    expect(toggles.map((toggle) => toggle.disabled)).to.deep.equal([false, true, false]);
    group.disabled = false;
    await settle();
    expect(toggles.map((toggle) => control(toggle).disabled)).to.deep.equal([false, true, false]);
    expect(stops(toggles).filter((value) => value === '0').length).to.equal(1);
  });

  it('clamps the stop when data shrinks and repairs focus that was lost with a removed or hidden toggle', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <button id="outside">Outside</button>
      <lr-toggle-group label="Filters" size="s">
        <lr-toggle value="a">A</lr-toggle>
        <lr-toggle value="b">B</lr-toggle>
        <lr-toggle value="c">C</lr-toggle>
        <lr-toggle value="d">D</lr-toggle>
      </lr-toggle-group>
    </div>`);
    await settle();
    const group = wrapper.querySelector<LyraToggleGroup>('lr-toggle-group')!;
    const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
    const current = (): LyraToggle[] => owned(group);
    const zeroStop = (): string =>
      current().filter((toggle) => control(toggle).getAttribute('tabindex') === '0').map((toggle) => toggle.value).join(',');
    const byValue = (value: string): LyraToggle => current().find((toggle) => toggle.value === value)!;

    // (a) the unfocused roving stop disappears: clamp to the next, else the previous toggle.
    byValue('c').focus();
    outside.focus();
    byValue('c').remove();
    await waitUntil(() => zeroStop() === 'd', 'the stop did not clamp to the next toggle');
    byValue('d').focus();
    outside.focus();
    byValue('d').remove();
    await waitUntil(() => zeroStop() === 'b', 'the stop did not clamp to the previous toggle');

    // (b) an added toggle joins as a -1 stop with the group projection.
    const added = document.createElement('lr-toggle');
    added.value = 'e';
    added.textContent = 'E';
    group.append(added);
    await waitUntil(() => control(added)?.getAttribute('tabindex') === '-1', 'the added toggle was not projected');
    expect(added.hasAttribute('data-lr-group-size')).to.equal(true);

    // (c) the focused stop is removed: focus moves to the new stop, not <body>.
    byValue('b').focus();
    byValue('b').remove();
    await waitUntil(() => focusedValue(current()) === 'e', 'focus was not repaired after removal');

    // (d) the focused toggle is hidden: same repair.
    byValue('a').focus();
    byValue('a').hidden = true;
    await waitUntil(() => focusedValue(current()) === 'e', 'focus was not repaired after hiding');

    // (e) focus already moved outside before the removal: never stolen back.
    byValue('e').focus();
    outside.focus();
    byValue('e').remove();
    await settle();
    await aTimeout(20);
    expect(deepActive()?.id).to.equal('outside');
  });

  it('hands a moved toggle to its new group and fully releases one moved out to the page', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-toggle-group id="first" label="First" size="s" disabled>
        <lr-toggle value="a">A</lr-toggle>
        <lr-toggle value="b">B</lr-toggle>
      </lr-toggle-group>
      <lr-toggle-group id="second" label="Second">
        <lr-toggle value="c">C</lr-toggle>
      </lr-toggle-group>
    </div>`);
    await settle();
    const first = wrapper.querySelector<LyraToggleGroup>('#first')!;
    const second = wrapper.querySelector<LyraToggleGroup>('#second')!;
    const [a, b] = owned(first);

    // (f) A -> B: the new owner wins and the old owner's later release is a no-op.
    second.append(a!);
    await settle();
    expect(control(a!).disabled, 'the new owner is not disabled').to.equal(false);
    expect(a!.hasAttribute('data-lr-group-size')).to.equal(false);
    expect(stops(owned(second)).filter((value) => value === '0').length).to.equal(1);
    expect(stops(owned(second)).every((value) => value === '0' || value === '-1')).to.equal(true);
    expect(a!.getToolbarActions().length).to.equal(0);

    // (g) out to the page: standalone again.
    wrapper.append(b!);
    await settle();
    expect(control(b!).hasAttribute('tabindex')).to.equal(false);
    expect(b!.hasAttribute('tabindex')).to.equal(false);
    expect(b!.hasAttribute('data-lr-group-size')).to.equal(false);
    expect(control(b!).getAttribute('data-run')).to.equal('standalone');
    expect(control(b!).disabled).to.equal(false);
  });

  it('joins adjacent horizontal toggles into measured runs with real corner radii', async () => {
    const group = await mount(html`<lr-toggle-group label="Formatting" appearance="outlined">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
      <lr-toggle value="c">C</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    const radii = (toggle: LyraToggle): [boolean, boolean] => {
      const style = getComputedStyle(control(toggle));
      return [parseFloat(style.borderTopLeftRadius) > 0, parseFloat(style.borderTopRightRadius) > 0];
    };
    await waitUntil(() => control(toggles[1]!).getAttribute('data-run') === 'middle', 'no run was projected');
    expect(toggles.map((toggle) => control(toggle).getAttribute('data-run'))).to.deep.equal(['start', 'middle', 'end']);
    expect(toggles.map(radii)).to.deep.equal([[true, false], [false, false], [false, true]]);

    group.setAttribute('dir', 'rtl');
    await settle();
    await settle();
    expect(toggles.map(radii), 'the run starts at the right edge in RTL').to.deep.equal([
      [false, true],
      [false, false],
      [true, false],
    ]);
    group.removeAttribute('dir');

    group.style.setProperty('--lr-toggle-group-gap', '0.5rem');
    await waitUntil(
      () => toggles.every((toggle) => control(toggle).getAttribute('data-run') === 'standalone'),
      'a real gap did not break the run',
    );
    group.style.removeProperty('--lr-toggle-group-gap');
    await waitUntil(() => control(toggles[1]!).getAttribute('data-run') === 'middle');
    group.orientation = 'vertical';
    await waitUntil(
      () => toggles.every((toggle) => control(toggle).getAttribute('data-run') === 'standalone'),
      'a vertical group still joined',
    );
  });

  it('starts a new run on every wrapped line at 320px', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size: 320px">
      <lr-toggle-group label="Tags" appearance="outlined">
        ${['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'].map(
          (value) => html`<lr-toggle value=${value}>${value} label</lr-toggle>`,
        )}
      </lr-toggle-group>
    </div>`);
    await settle();
    await settle();
    const toggles = owned(wrapper);
    const tops = toggles.map((toggle) => Math.round(toggle.getBoundingClientRect().top));
    expect(new Set(tops).size, 'the fixture must wrap').to.be.greaterThan(1);
    toggles.forEach((toggle, index) => {
      if (index > 0 && tops[index] !== tops[index - 1]) {
        expect(['start', 'standalone']).to.include(control(toggle).getAttribute('data-run'));
        expect(parseFloat(getComputedStyle(control(toggle)).borderTopLeftRadius)).to.be.greaterThan(0);
      }
    });
    const bounds = wrapper.getBoundingClientRect();
    for (const toggle of toggles) {
      const box = control(toggle).getBoundingClientRect();
      expect(box.right).to.be.at.most(bounds.right + 0.5);
      expect(box.width).to.be.at.least(24);
      expect(box.height).to.be.at.least(24);
    }
  });

  it('leaves each toggle size alone until the opt-in group size is set, and restores it after', async () => {
    const group = await mount(html`<lr-toggle-group label="Sizes">
      <lr-toggle value="a" size="l">A</lr-toggle>
      <lr-toggle value="b" size="l">B</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    const height = (): number => control(toggles[0]!).getBoundingClientRect().height;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const tier = (name: string): number =>
      parseFloat(getComputedStyle(group).getPropertyValue(`--lr-form-control-height-${name}`)) * rem;
    expect(height()).to.be.closeTo(tier('l'), 0.5);
    expect(toggles[0]!.hasAttribute('data-lr-group-size')).to.equal(false);
    group.size = 's';
    await settle();
    expect(height()).to.be.closeTo(tier('s'), 0.5);
    expect(toggles[0]!.getAttribute('size')).to.equal('l');
    group.removeAttribute('size');
    await settle();
    expect(height()).to.be.closeTo(tier('l'), 0.5);

    group.size = '2xs';
    await settle();
    const restore = forceCoarsePointer(group);
    try {
      for (const toggle of toggles) {
        const box = control(toggle).getBoundingClientRect();
        expect(box.height).to.be.at.least(44);
        expect(box.width).to.be.at.least(44);
      }
    } finally {
      restore();
    }
  });

  it('leaves each toggle appearance alone until the opt-in group appearance is set', async () => {
    const group = await mount(html`<lr-toggle-group label="Appearance">
      <lr-toggle value="a">A</lr-toggle>
    </lr-toggle-group>`);
    const [toggle] = owned(group);
    const alpha = (): number => {
      const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      canvas.fillStyle = getComputedStyle(control(toggle!)).borderTopColor;
      canvas.fillRect(0, 0, 1, 1);
      return canvas.getImageData(0, 0, 1, 1).data[3]!;
    };
    expect(alpha(), 'unset group appearance keeps the plain transparent border').to.equal(0);
    group.appearance = 'outlined';
    // The border colour transitions, so poll for the settled paint rather than a mid-transition one.
    await waitUntil(() => alpha() === 255, 'the projected outline never became opaque');
    expect(toggle!.appearance).to.equal('plain');
    expect(toggle!.getAttribute('appearance'), 'the toggle keeps its own attribute').to.equal('plain');
    group.appearance = undefined;
    await waitUntil(() => alpha() === 0, 'removing the group appearance did not restore the plain border');
  });

  it('warns once, without caller data, about empty or duplicate values', async () => {
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalWarn = console.warn;
    const messages: string[] = [];
    runtime.litIssuedWarnings = new Set();
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    try {
      const empty = await mount(html`<lr-toggle-group label="Empty">
        <lr-toggle value="">None</lr-toggle>
        <lr-toggle value="private-alpha-18">A</lr-toggle>
      </lr-toggle-group>`);
      const duplicate = await mount(html`<lr-toggle-group label="Duplicate">
        <lr-toggle value="private-beta-99">B</lr-toggle>
        <lr-toggle value="private-beta-99">B again</lr-toggle>
      </lr-toggle-group>`);
      for (const toggle of owned(duplicate)) control(toggle).click();
      await settle();
      const diagnostics = messages.filter((message) => message.includes('lr-toggle-group'));
      expect(diagnostics.length).to.equal(1);
      expect(diagnostics[0]).to.not.contain('private-alpha-18');
      expect(diagnostics[0]).to.not.contain('private-beta-99');
      expect([...duplicate.value]).to.deep.equal(['private-beta-99']);
      expect(owned(empty).length).to.equal(2);
    } finally {
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
    }
  });

  it('stays silent about ambiguous values when Lit development diagnostics are off', async () => {
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalWarn = console.warn;
    const messages: string[] = [];
    delete runtime.litIssuedWarnings;
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    try {
      await mount(html`<lr-toggle-group label="Duplicate">
        <lr-toggle value="same">A</lr-toggle>
        <lr-toggle value="same">B</lr-toggle>
      </lr-toggle-group>`);
      expect(messages.filter((message) => message.includes('lr-toggle-group')).length).to.equal(0);
    } finally {
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
    }
  });

  it('restores stop, projections and runs after a reconnect, and observes nothing while detached', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-toggle-group label="Filters" size="s" appearance="outlined">
        <lr-toggle value="a">A</lr-toggle>
        <lr-toggle value="b">B</lr-toggle>
      </lr-toggle-group>
    </div>`);
    await settle();
    const group = wrapper.querySelector<LyraToggleGroup>('lr-toggle-group')!;
    group.remove();
    const late = document.createElement('lr-toggle');
    late.value = 'c';
    late.textContent = 'C';
    group.append(late);
    await settle();
    expect(late.getToolbarActions().length, 'a detached group links nothing').to.equal(1);
    wrapper.append(group);
    await settle();
    const toggles = owned(group);
    expect(stops(toggles)).to.deep.equal(['0', '-1', '-1']);
    expect(toggles.every((toggle) => toggle.hasAttribute('data-lr-group-size'))).to.equal(true);
    await waitUntil(() => control(toggles[1]!).getAttribute('data-run') === 'middle', 'runs were not restored');
    let childChanges = 0;
    toggles[0]!.addEventListener('lr-change', () => {
      childChanges += 1;
    });
    const changes: string[][] = [];
    group.addEventListener('lr-change', (event) => changes.push([...event.detail.value]));
    control(toggles[0]!).click();
    await settle();
    expect(childChanges).to.equal(0);
    expect(changes).to.deep.equal([['a']]);
  });

  it('is accessible in populated multiple, single and RTL states', async () => {
    const multiple = await mount(html`<lr-toggle-group label="Formatting" appearance="outlined">
      <lr-toggle value="bold" pressed>Bold</lr-toggle>
      <lr-toggle value="italic" pressed>Italic</lr-toggle>
      <lr-toggle value="underline">Underline</lr-toggle>
    </lr-toggle-group>`);
    expect(pressed(owned(multiple))).to.deep.equal(['bold', 'italic']);
    await expect(multiple).to.be.accessible();
    const single = await mount(html`<lr-toggle-group selection-mode="single" label="Highlight colour (optional, pick one)">
      <lr-toggle value="yellow" pressed>Yellow</lr-toggle>
      <lr-toggle value="green">Green</lr-toggle>
    </lr-toggle-group>`);
    await expect(single).to.be.accessible();
    const rtl = await mount(html`<lr-toggle-group dir="rtl" label="تنسيق">
      <lr-toggle value="bold" pressed>غامق</lr-toggle>
      <lr-toggle value="italic">مائل</lr-toggle>
    </lr-toggle-group>`);
    await expect(rtl).to.be.accessible();
  });

  it('isolates a nested group from its outer group', async () => {
    const outer = await mount(html`<lr-toggle-group id="outer" label="Outer">
      <lr-toggle value="o1">O1</lr-toggle>
      <lr-toggle-group id="inner" label="Inner">
        <lr-toggle value="i1">I1</lr-toggle>
        <lr-toggle value="i2">I2</lr-toggle>
      </lr-toggle-group>
    </lr-toggle-group>`);
    const inner = outer.querySelector<LyraToggleGroup>('#inner')!;
    const [o1] = owned(outer, ':scope > lr-toggle');
    const [i1, i2] = owned(inner);
    const requestTargets: string[] = [];
    const changeTargets: string[] = [];
    outer.addEventListener('lr-toggle-group-toggle-request', (event) => {
      requestTargets.push((event.target as Element).id);
      if (event.detail.option === o1) requestTargets.push('outer-owned');
    });
    outer.addEventListener('lr-change', (event) => changeTargets.push((event.target as Element).id));
    control(i1!).click();
    await settle();
    expect([...outer.value]).to.deep.equal([]);
    expect([...inner.value]).to.deep.equal(['i1']);
    expect(requestTargets).to.deep.equal(['inner']);
    expect(changeTargets).to.deep.equal(['inner']);

    const outerStop = control(o1!).getAttribute('tabindex');
    i1!.focus();
    await sendKeys({ press: 'ArrowRight' });
    expect(focusedValue([o1!, i1!, i2!])).to.equal('i2');
    await settle();
    expect(control(o1!).getAttribute('tabindex')).to.equal(outerStop);
  });

  it('forwards group focus(), blur() and click() to the current stop', async () => {
    const group = await mount(html`<lr-toggle-group label="Filters">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b" pressed>B</lr-toggle>
    </lr-toggle-group>`);
    const toggles = owned(group);
    group.focus();
    expect(focusedValue(toggles)).to.equal('b');
    group.blur();
    expect(focusedValue(toggles)).to.not.equal('b');
    const requests: string[][] = [];
    const changes: string[][] = [];
    group.addEventListener('lr-toggle-group-toggle-request', (event) => requests.push([...event.detail.value]));
    group.addEventListener('lr-change', (event) => changes.push([...event.detail.value]));
    group.click();
    await settle();
    expect(requests).to.deep.equal([[]]);
    expect(changes).to.deep.equal([[]]);
    expect(pressed(toggles)).to.deep.equal([]);

    group.disabled = true;
    await settle();
    group.focus();
    expect(focusedValue(toggles)).to.not.equal('b');
    group.click();
    await settle();
    expect(changes.length).to.equal(1);
  });

  it('renders every toggle and toggle-group story with distinct values and no console noise', async () => {
    const modules = [
      await import('../toggle/toggle.stories.js'),
      await import('./toggle-group.stories.js'),
    ];
    for (const module of modules) {
      for (const [name, story] of Object.entries(module)) {
        if (name === 'default' || typeof story !== 'object' || story === null || !('render' in story)) continue;
        const render = (story as { render: (args: object, context: never) => unknown }).render;
        const root = await fixture<HTMLElement>(html`<div>${render({}, null as never)}</div>`);
        await settle();
        const toggles = owned(root);
        expect(toggles.length, `${name} renders toggles`).to.be.greaterThan(0);
        expect(toggles.every((toggle) => control(toggle) !== null), `${name} upgraded every toggle`).to.equal(true);
        for (const group of root.querySelectorAll<LyraToggleGroup>('lr-toggle-group')) {
          const groupValues = owned(group).map((toggle) => toggle.value);
          expect(new Set(groupValues).size, `${name} gives each grouped toggle a distinct value`).to.equal(
            groupValues.length,
          );
          expect(groupValues.includes(''), `${name} leaves no grouped toggle without a value`).to.equal(false);
        }
      }
    }
  });

  it('releases stale links when the group is unwrapped or detached', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <button id="before">Before</button>
      <lr-toggle-group label="Filters" size="s" disabled>
        <lr-toggle value="a">A</lr-toggle>
        <lr-toggle value="b">B</lr-toggle>
      </lr-toggle-group>
    </div>`);
    await settle();
    const group = wrapper.querySelector<LyraToggleGroup>('lr-toggle-group')!;
    const toggles = owned(group);
    // (a) unwrap: the group disconnects while its removal records are still queued.
    group.replaceWith(...group.childNodes);
    await settle();
    for (const toggle of toggles) {
      expect(control(toggle).hasAttribute('tabindex')).to.equal(false);
      expect(control(toggle).disabled).to.equal(false);
      expect(toggle.hasAttribute('data-lr-group-size')).to.equal(false);
    }
    wrapper.querySelector<HTMLButtonElement>('#before')!.focus();
    await sendKeys({ press: 'Tab' });
    expect(focusedValue(toggles)).to.equal('a');
    await sendKeys({ press: 'Tab' });
    expect(focusedValue(toggles)).to.equal('b');

    // (b) detach a single-mode group, then move one of its toggles to the page.
    const single = await mount(html`<lr-toggle-group selection-mode="single" label="Highlight">
      <lr-toggle value="x">X</lr-toggle>
      <lr-toggle value="y">Y</lr-toggle>
      <lr-toggle value="z">Z</lr-toggle>
    </lr-toggle-group>`);
    const host = single.parentElement!;
    const [x, y, z] = owned(single);
    single.remove();
    expect(
      [x!, y!].every((toggle) => toggle.getToolbarActions().length === 1),
      'toggles left inside a detached group are released to standalone',
    ).to.equal(true);
    host.append(z!);
    await settle();
    expect(control(z!).hasAttribute('tabindex')).to.equal(false);
    expect(control(z!).getAttribute('data-run')).to.equal('standalone');

    // (c) no stale exclusivity while detached; reconnecting keeps the first pressed.
    x!.pressed = true;
    y!.pressed = true;
    expect(pressed([x!, y!])).to.deep.equal(['x', 'y']);
    host.append(single);
    await settle();
    expect(pressed([x!, y!])).to.deep.equal(['x']);
  });
});
