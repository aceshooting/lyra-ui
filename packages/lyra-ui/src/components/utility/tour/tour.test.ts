import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tour.js';
import type { LyraTour, TourStep } from './tour.js';
import { styles } from './tour.styles.js';
import { registerLyraLocale } from '../../../internal/localization.js';

function makeSteps(count: number, overridesFor?: (index: number) => Partial<TourStep>): TourStep[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `step-${index}`,
    target: `#tour-target-${index}`,
    heading: `Heading ${index}`,
    content: `Body ${index}`,
    ...(overridesFor ? overridesFor(index) : {}),
  }));
}

function targetButtons(count: number) {
  return html`${Array.from(
    { length: count },
    (_, index) => html`<button id="tour-target-${index}">target ${index}</button>`,
  )}`;
}

/** Deep-walks shadow roots to describe the truly focused element without ever comparing raw DOM
 *  nodes directly (a failed element-vs-element `expect().to.equal()` can hang the wtr/Playwright
 *  reporter -- compare a descriptive string instead). */
function focusedDescriptor(): string {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  if (!active) return '';
  return `${active.tagName}#${active.id}[part=${active.getAttribute('part') ?? ''}]`;
}

/** Describes an `elementFromPoint()` hit by tag name + id instead of returning the raw node --
 *  same reasoning as `focusedDescriptor()` above (a failed element-vs-element
 *  `expect().to.equal()` can hang the wtr/Playwright reporter via a structuredClone
 *  DataCloneError -- compare a descriptive string instead). */
function hitDescriptor(el: Element | null): string {
  if (!el) return '(none)';
  return `${el.tagName}#${el.id}`;
}

function press(target: EventTarget, key: string, extra: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...extra }));
}

async function waitFor<T>(read: () => T, until: (v: T) => boolean, timeoutMs = 2000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = read();
    if (until(value)) return value;
    if (performance.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }
}

describe('lr-tour', () => {
  it('is closed by default and renders no backdrop/spotlight/popover until open', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)}></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    expect(tour.open).to.be.false;
    expect(tour.shadowRoot!.querySelector('[part="backdrop"]')).to.not.exist;
    expect(tour.shadowRoot!.querySelector('[part="spotlight"]')).to.not.exist;
    expect(tour.shadowRoot!.querySelector('[part="popover"]')).to.not.exist;
  });

  it('start() opens at the given index (default 0), sets open, and fires lr-tour-start', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)}></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    const listener = oneEvent(tour, 'lr-tour-start');
    tour.start();
    const event = await listener;
    expect(tour.open).to.be.true;
    expect(tour.activeIndex).to.equal(0);
    expect((event as CustomEvent).detail).to.deep.equal({ index: 0 });

    tour.end('api');
    await tour.updateComplete;
    const listener2 = oneEvent(tour, 'lr-tour-start');
    tour.start(2);
    const event2 = await listener2;
    expect(tour.activeIndex).to.equal(2);
    expect((event2 as CustomEvent).detail).to.deep.equal({ index: 2 });
  });

  it('never mutates the steps array across next()/back()/goToStep()', async () => {
    const original = makeSteps(3);
    const snapshot = JSON.parse(JSON.stringify(original));
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${original} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;

    tour.next();
    await tour.updateComplete;
    tour.back();
    await tour.updateComplete;
    tour.goToStep(2);
    await tour.updateComplete;

    expect(tour.steps).to.equal(original);
    expect(JSON.parse(JSON.stringify(tour.steps))).to.deep.equal(snapshot);
  });

  it('reflects activeIndex as an attribute and updates it via next()/back()/goToStep()', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    expect(tour.getAttribute('active-index')).to.equal('0');

    tour.next();
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(1);
    expect(tour.getAttribute('active-index')).to.equal('1');

    tour.back();
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(0);
    expect(tour.getAttribute('active-index')).to.equal('0');

    tour.goToStep(2);
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(2);
    expect(tour.getAttribute('active-index')).to.equal('2');
  });

  it('normalizes an out-of-range/NaN activeIndex set directly (bypassing goToStep) to [0, steps.length - 1]', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)}></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;

    tour.activeIndex = 99;
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(2);

    tour.activeIndex = -5;
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(0);

    tour.activeIndex = NaN;
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(0);
  });

  it('falls back to the default spotlight padding when spotlight-padding is invalid, instead of poisoning the cutout with NaN', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(1)} spotlight-padding="not-a-number"></lr-tour>
        <button id="tour-target-0" style="position:fixed; top:100px; left:100px; width:50px; height:30px;">
          target 0
        </button>
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    const targetButton = el.querySelector('#tour-target-0') as HTMLButtonElement;
    tour.start();
    await tour.updateComplete;
    const cutout = () => tour.shadowRoot!.querySelector('[part="backdrop"] .cutout') as SVGRectElement;
    await waitFor(() => cutout().getAttribute('width'), (v) => v !== null && v !== '0');

    const rect = targetButton.getBoundingClientRect();
    // Default spotlight padding is 4px -- an invalid `spotlight-padding` must fall back to it
    // rather than corrupting the cutout rect with NaN.
    expect(Number(cutout().getAttribute('x'))).to.be.closeTo(rect.left - 4, 0.5);
    expect(Number(cutout().getAttribute('y'))).to.be.closeTo(rect.top - 4, 0.5);
  });

  it('does not poison the step popover position with NaN when distance is invalid', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(1)} distance="not-a-number"></lr-tour>
        <button id="tour-target-0" style="position:fixed; top:100px; left:100px; width:50px; height:30px;">
          target 0
        </button>
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    tour.start();
    await tour.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const popover = tour.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(popover.style.left).to.not.include('NaN');
    expect(popover.style.top).to.not.include('NaN');
  });

  it('next() fires a cancelable lr-tour-step-change before activeIndex changes; preventDefault() keeps it unchanged', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;

    const listener = oneEvent(tour, 'lr-tour-step-change');
    tour.next();
    const event = await listener;
    expect((event as CustomEvent).cancelable).to.be.true;
    expect((event as CustomEvent).detail).to.deep.equal({
      index: 1,
      previousIndex: 0,
      step: tour.steps[1],
      via: 'next',
    });
    expect(tour.activeIndex).to.equal(1);

    tour.goToStep(0);
    await tour.updateComplete;
    tour.addEventListener('lr-tour-step-change', (e) => e.preventDefault());
    tour.next();
    await tour.updateComplete;
    expect(tour.activeIndex, 'preventDefault() must keep activeIndex unchanged').to.equal(0);
  });

  it('next() on the last step ends the tour with reason "completed" and does not fire lr-tour-step-change', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open active-index="1"></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    let stepChangeCount = 0;
    tour.addEventListener('lr-tour-step-change', () => stepChangeCount++);

    const listener = oneEvent(tour, 'lr-tour-end');
    tour.next();
    const event = await listener;
    expect((event as CustomEvent).detail).to.equal('completed');
    expect(tour.open).to.be.false;
    expect(stepChangeCount).to.equal(0);
  });

  it('back() decrements activeIndex and no-ops on the first step', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    let fired = false;
    tour.addEventListener('lr-tour-step-change', () => (fired = true));

    tour.back();
    await tour.updateComplete;
    expect(fired, 'back() on the first step must not fire anything').to.be.false;
    expect(tour.activeIndex).to.equal(0);
  });

  it('goToStep() clamps out-of-range indices into [0, steps.length - 1]', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;

    tour.goToStep(99);
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(2);

    tour.goToStep(-5);
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(0);
  });

  it('the built-in Skip button calls end("skip"), cancelable via preventDefault()', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const skipButton = tour.shadowRoot!.querySelector('[part="skip-button"]') as HTMLButtonElement;

    const listener = oneEvent(tour, 'lr-tour-end');
    skipButton.click();
    const event = await listener;
    expect((event as CustomEvent).detail).to.equal('skip');
    expect(tour.open).to.be.false;

    const el2 = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour2 = el2.querySelector('lr-tour') as LyraTour;
    await tour2.updateComplete;
    tour2.addEventListener('lr-tour-end', (e) => e.preventDefault());
    (tour2.shadowRoot!.querySelector('[part="skip-button"]') as HTMLButtonElement).click();
    await tour2.updateComplete;
    expect(tour2.open, 'preventDefault() must keep the tour open').to.be.true;
  });

  it('Escape fires lr-tour-end with reason "escape"', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;

    const listener = oneEvent(tour, 'lr-tour-end');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const event = await listener;
    expect((event as CustomEvent).detail).to.equal('escape');
    expect(tour.open).to.be.false;
  });

  describe('lightDismiss', () => {
    it('a backdrop click does nothing when unset (default)', async () => {
      const el = (await fixture(
        html`<div>
          <lr-tour .steps=${makeSteps(2)} open></lr-tour>
          ${targetButtons(2)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;
      await tour.updateComplete;
      (tour.shadowRoot!.querySelector('[part="backdrop"]') as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await tour.updateComplete;
      expect(tour.open).to.be.true;
    });

    it('a backdrop click fires lr-tour-end("skip") once lightDismiss is true', async () => {
      const el = (await fixture(
        html`<div>
          <lr-tour .steps=${makeSteps(2)} open .lightDismiss=${true}></lr-tour>
          ${targetButtons(2)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;
      await tour.updateComplete;
      const listener = oneEvent(tour, 'lr-tour-end');
      (tour.shadowRoot!.querySelector('[part="backdrop"]') as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      const event = await listener;
      expect((event as CustomEvent).detail).to.equal('skip');
      expect(tour.open).to.be.false;
    });
  });

  it('moves focus into [part="popover"] when opened, and again on every step change', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    expect((tour.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('popover');

    tour.next();
    await tour.updateComplete;
    expect((tour.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('popover');
  });

  it('traps Tab/Shift+Tab within the popover, never reaching a light-DOM target outside it', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(1)} open></lr-tour>
        ${targetButtons(1)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(focusedDescriptor()).to.not.include('tour-target-0');

    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(shiftTab);
    expect(focusedDescriptor()).to.not.include('tour-target-0');
  });

  it('the default non-interactive target absorbs pointer events at its own center via the backdrop', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(1)}></lr-tour>
        <button
          id="tour-target-0"
          style="position:fixed; top:200px; left:200px; width:100px; height:40px;"
        >
          target 0
        </button>
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    const targetButton = el.querySelector('#tour-target-0') as HTMLButtonElement;
    let clicked = false;
    targetButton.addEventListener('click', () => (clicked = true));

    tour.start();
    await tour.updateComplete;
    await waitFor(
      () => tour.shadowRoot!.querySelector('[part="backdrop"] .cutout')?.getAttribute('width'),
      (value) => value !== null && value !== '0',
    );

    const rect = targetButton.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    // document.elementFromPoint() retargets a hit inside an open shadow root to its host --
    // hitting the tour host itself (rather than the light-DOM target button) proves the
    // backdrop, not the button, is what's actually receiving the pointer event. Compared as
    // descriptor strings, not raw nodes, via hitDescriptor() -- see its own doc comment.
    expect(hitDescriptor(hit), 'the backdrop should absorb the hit, retargeted to the <lr-tour> host').to.equal(
      hitDescriptor(tour),
    );
    expect(hitDescriptor(hit)).to.not.equal(hitDescriptor(targetButton));

    targetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked, "a direct dispatch bypasses hit-testing, so this only proves the fixture button's own listener works").to.be.true;
  });

  it('step.interactiveTarget restores real pointer/click reachability to the live target', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(1, () => ({ interactiveTarget: true }))}></lr-tour>
        <button
          id="tour-target-0"
          style="position:fixed; top:200px; left:200px; width:100px; height:40px;"
        >
          target 0
        </button>
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    const targetButton = el.querySelector('#tour-target-0') as HTMLButtonElement;
    let clicked = false;
    targetButton.addEventListener('click', () => (clicked = true));

    tour.start();
    await tour.updateComplete;
    await waitFor(
      () => (tour.shadowRoot!.querySelector('[part="backdrop"]') as SVGElement | null)?.style.clipPath,
      (value) => !!value && value.length > 0,
    );

    const rect = targetButton.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    expect(hitDescriptor(hit)).to.equal(hitDescriptor(targetButton));

    targetButton.click();
    expect(clicked).to.be.true;
  });

  it('tracks the target rect after a resize, updating the mask cutout and spotlight ring geometry', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(1)}></lr-tour>
        <button
          id="tour-target-0"
          style="position:fixed; top:100px; left:100px; width:50px; height:30px;"
        >
          target 0
        </button>
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    const targetButton = el.querySelector('#tour-target-0') as HTMLButtonElement;

    tour.start();
    await tour.updateComplete;
    const cutout = () => tour.shadowRoot!.querySelector('[part="backdrop"] .cutout') as SVGRectElement;
    const spotlight = () => tour.shadowRoot!.querySelector('[part="spotlight"]') as HTMLElement;

    await waitFor(() => cutout().getAttribute('width'), (v) => v !== '0');
    const initialWidth = cutout().getAttribute('width');
    expect(spotlight().style.width).to.not.equal('');

    targetButton.style.width = '150px';
    await waitFor(() => cutout().getAttribute('width'), (v) => v !== initialWidth, 3000);
    expect(Number(cutout().getAttribute('width'))).to.be.greaterThan(Number(initialWidth));
    expect(parseFloat(spotlight().style.width)).to.be.greaterThan(0);
  });

  it('emits lr-tour-target-missing and renders an unanchored, centered popover for a step whose target does not resolve', async () => {
    const el = (await fixture(
      html`<lr-tour .steps=${makeSteps(1, () => ({ target: '#does-not-exist' }))}></lr-tour>`,
    )) as LyraTour;

    const listener = oneEvent(el, 'lr-tour-target-missing');
    el.start();
    const event = await listener;
    expect((event as CustomEvent).detail).to.deep.equal({ index: 0, step: el.steps[0] });

    await el.updateComplete;
    const popover = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(popover).to.exist;
    expect(popover.hasAttribute('data-unanchored')).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="backdrop"] .cutout')).to.not.exist;
  });

  it('showProgress=false hides the progress wrapper; the default renders "Step X of Y" text that tracks activeIndex', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    expect(tour.shadowRoot!.querySelector('[part="progress-text"]')!.textContent!.trim()).to.equal('Step 1 of 3');

    tour.next();
    await tour.updateComplete;
    expect(tour.shadowRoot!.querySelector('[part="progress-text"]')!.textContent!.trim()).to.equal('Step 2 of 3');

    tour.showProgress = false;
    await tour.updateComplete;
    expect(tour.shadowRoot!.querySelector('[part="progress"]')).to.not.exist;
  });

  it('accepts show-progress="false" as a plain-HTML attribute string, not just a JS property binding', async () => {
    // Regression test: show-progress's default Boolean converter can never distinguish a plain
    // show-progress="false" attribute from the attribute being absent altogether, so the built-in
    // "Step X of Y" progress indicator kept rendering for any consumer using markup instead of
    // `.showProgress = false`.
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open show-progress="false"></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    expect(tour.showProgress).to.be.false;
    await tour.updateComplete;
    expect(!!tour.shadowRoot!.querySelector('[part="progress"]')).to.be.false;
  });

  it('the Previous button is disabled (present) on the first step; hidePrevious removes it entirely', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour
          .steps=${makeSteps(3, (index) => (index === 1 ? { hidePrevious: true } : {}))}
          open
        ></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const firstPrevious = tour.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
    expect(firstPrevious).to.exist;
    expect(firstPrevious.disabled).to.be.true;

    tour.next();
    await tour.updateComplete;
    expect(tour.shadowRoot!.querySelector('[part="previous-button"]'), 'hidePrevious removes the control entirely').to.not.exist;

    tour.next();
    await tour.updateComplete;
    const thirdPrevious = tour.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
    expect(thirdPrevious).to.exist;
    expect(thirdPrevious.disabled).to.be.false;
  });

  it('the last step\'s Next button reads the localized "Done" text instead of "Next"', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open active-index="1"></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    expect(tour.shadowRoot!.querySelector('[part="next-button"]')!.textContent!.trim()).to.equal('Done');
  });

  it('RTL: ArrowLeft calls next(), ArrowRight calls back() (inverse of the LTR default)', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open active-index="1" dir="rtl"></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const popover = tour.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    press(popover, 'ArrowLeft');
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(2);

    press(tour.shadowRoot!.querySelector('[part="popover"]') as HTMLElement, 'ArrowRight');
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(1);
  });

  it('LTR: ArrowRight calls next(), ArrowLeft calls back()', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open active-index="1"></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const popover = tour.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;

    press(popover, 'ArrowRight');
    await tour.updateComplete;
    expect(tour.activeIndex).to.equal(2);
  });

  it('ArrowRight/ArrowLeft do nothing when the keydown target is a native text-editing control', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open><input slot="" id="rich-input" /></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const input = tour.querySelector('#rich-input') as HTMLInputElement;

    press(input, 'ArrowRight');
    await tour.updateComplete;
    expect(tour.activeIndex, 'ArrowRight inside a text-editing control must not advance the tour').to.equal(0);
  });

  describe('i18n', () => {
    it('renders the built-in English strings unchanged with no locale registered', async () => {
      const el = (await fixture(
        html`<div>
          <lr-tour .steps=${makeSteps(2)} open></lr-tour>
          ${targetButtons(2)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;
      await tour.updateComplete;
      expect(tour.shadowRoot!.querySelector('[part="previous-button"]')!.textContent!.trim()).to.equal('Previous');
      expect(tour.shadowRoot!.querySelector('[part="skip-button"]')!.textContent!.trim()).to.equal('Skip');
      expect(tour.shadowRoot!.querySelector('[part="next-button"]')!.textContent!.trim()).to.equal('Next');
      expect(tour.shadowRoot!.querySelector('[part="progress-text"]')!.textContent!.trim()).to.equal('Step 1 of 2');
    });

    it('a .strings override actually reaches the rendered Skip button', async () => {
      const el = (await fixture(
        html`<div>
          <lr-tour .steps=${makeSteps(2)} open .strings=${{ tourSkip: 'Passer' }}></lr-tour>
          ${targetButtons(2)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;
      await tour.updateComplete;
      expect(tour.shadowRoot!.querySelector('[part="skip-button"]')!.textContent!.trim()).to.equal('Passer');
    });

    it('a registered locale supplies tourStepOf without an explicit .strings override', async () => {
      registerLyraLocale('fr-test-tour', { tourStepOf: 'Étape {current} sur {total}' });
      const el = (await fixture(
        html`<div>
          <lr-tour .steps=${makeSteps(2)} open locale="fr-test-tour"></lr-tour>
          ${targetButtons(2)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;
      await tour.updateComplete;
      expect(tour.shadowRoot!.querySelector('[part="progress-text"]')!.textContent!.trim()).to.equal('Étape 1 sur 2');
    });
  });

  it('ending the tour returns focus to whatever had focus before start()/open was first set', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();

    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)}></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    tour.start();
    await tour.updateComplete;
    expect(document.activeElement).to.not.equal(trigger);

    tour.end('api');
    await tour.updateComplete;
    expect(document.activeElement).to.equal(trigger);

    trigger.remove();
  });

  describe('external removal while open', () => {
    it('fires lr-tour-end("unmount") exactly once when removed from the DOM without calling end()', async () => {
      const el = (await fixture(
        html`<div>
          <lr-tour .steps=${makeSteps(2)} open></lr-tour>
          ${targetButtons(2)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;
      await tour.updateComplete;
      let count = 0;
      let detail: unknown;
      tour.addEventListener('lr-tour-end', (e) => {
        count++;
        detail = (e as CustomEvent).detail;
      });

      tour.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(count).to.equal(1);
      expect(detail).to.equal('unmount');
      expect(tour.open).to.be.false;
    });

    it('a synchronous reparent restores the scroll lock and overlay registration without double-firing unmount', async () => {
      const el = (await fixture(
        html`<div>
          <lr-tour .steps=${makeSteps(2)} open></lr-tour>
          ${targetButtons(2)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;
      await tour.updateComplete;
      expect(document.documentElement.style.overflow).to.equal('hidden');
      let count = 0;
      tour.addEventListener('lr-tour-end', () => count++);

      const otherContainer = document.createElement('div');
      document.body.appendChild(otherContainer);
      otherContainer.appendChild(tour); // disconnect + reconnect synchronously, same instance

      await Promise.resolve();
      await Promise.resolve();

      expect(count, 'a reparent must not be mistaken for a real removal').to.equal(0);
      expect(tour.open).to.be.true;
      expect(document.documentElement.style.overflow).to.equal('hidden');

      tour.end('api');
      await tour.updateComplete;
      otherContainer.remove();
    });
  });

  it('a host aria-label overrides the per-step heading-derived aria-labelledby name', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open aria-label="Custom tour name"></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const popover = tour.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    expect(popover.getAttribute('aria-label')).to.equal('Custom tour name');
    expect(popover.hasAttribute('aria-labelledby')).to.be.false;
  });

  it('lifts the Next button on hover through the shared hover-brightness token', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const normalize = (text: string) => text.replace(/"/g, "'");
    let declared = '';
    for (const sheet of tour.shadowRoot!.adoptedStyleSheets) {
      for (const rule of sheet.cssRules) {
        if (
          rule instanceof CSSStyleRule &&
          normalize(rule.selectorText) === normalize("[part='next-button']:hover") &&
          rule.style.filter
        ) {
          declared = rule.style.filter;
        }
      }
    }
    const probe = document.createElement('span');
    probe.style.filter = declared;
    tour.shadowRoot!.appendChild(probe);
    const computed = getComputedStyle(probe).filter;
    probe.remove();
    expect(computed).to.equal('brightness(1.08)');
  });

  it('wraps the internal previous-button/skip-button hover rule in :where() so a consumer ::part(...):hover override wins without !important', async () => {
    // Regression test: an unwrapped [part='previous-button']:hover:not(:disabled) selector has
    // specificity (0,3,0), which beats a consumer's ::part(previous-button):hover at (0,1,1) --
    // matches the established remediation lr-pagination/lr-attachment-trigger already use.
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(2)} open></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const internalRule = (tour.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText.replace(/"/g, "'"))
      .find(
        (text) =>
          text.includes(':hover') &&
          (text.includes("[part='previous-button']") || text.includes("[part='skip-button']")),
      );
    expect(internalRule).to.contain(':where(');
  });

  it('recolors the current progress dot from an ancestor --lr-tour-progress-dot-current-bg, not the bare shared --lr-color-brand token', async () => {
    const el = (await fixture(
      html`<div style="--lr-tour-progress-dot-current-bg: rgb(0, 51, 102);">
        <lr-tour .steps=${makeSteps(3)} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const currentDot = tour.shadowRoot!.querySelector('[part="progress-dot"][data-current]') as HTMLElement;
    expect(getComputedStyle(currentDot).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('is accessible with an open, multi-step tour and a resolvable target', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour .steps=${makeSteps(3)} open></lr-tour>
        ${targetButtons(3)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    await expect(tour).to.be.accessible();
  });

  it('is accessible with showProgress disabled and a hidden Previous control', async () => {
    const el = (await fixture(
      html`<div>
        <lr-tour
          .steps=${makeSteps(2, () => ({ hidePrevious: true }))}
          open
          .showProgress=${false}
        ></lr-tour>
        ${targetButtons(2)}
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    await expect(tour).to.be.accessible();
  });

  it('the popover does not overflow a narrow 320px allocation', async () => {
    const el = (await fixture(
      html`<div style="width: 320px;">
        <lr-tour
          .steps=${makeSteps(1, () => ({
            heading: 'A heading long enough to wrap across several lines in a narrow panel',
            content:
              'Body copy that is also long enough to demonstrate wrapping instead of horizontal overflow in a 320px-wide allocation.',
          }))}
          open
        ></lr-tour>
        <button id="tour-target-0" style="position:fixed; top:10px; left:10px;">target 0</button>
      </div>`,
    )) as HTMLDivElement;
    const tour = el.querySelector('lr-tour') as LyraTour;
    await tour.updateComplete;
    const popover = tour.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
    const viewportWidth = document.documentElement.clientWidth;
    expect(popover.getBoundingClientRect().width).to.be.at.most(viewportWidth);
  });

  it('collapses the popover enter animation under prefers-reduced-motion', () => {
    expect(styles.cssText).to.match(/@media \(prefers-reduced-motion: reduce\)/);
    expect(styles.cssText).to.match(/@media \(prefers-reduced-motion: reduce\) \{[^]*\[part='popover'\][^{]*\{[^}]*animation:\s*none/);
    expect(styles.cssText).to.include('var(--lr-transition-base)');
  });

  it('does not trigger a Lit "scheduled an update after an update completed" dev warning across start/next/back/goToStep/a missing-target step/end', async () => {
    const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
    globalWarnings?.forEach((warning) => {
      if (warning.includes('scheduled an update')) globalWarnings.delete(warning);
    });
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const el = (await fixture(
        html`<div>
          <lr-tour
            .steps=${makeSteps(3, (index) => (index === 1 ? { target: '#does-not-exist' } : {}))}
          ></lr-tour>
          ${targetButtons(3)}
        </div>`,
      )) as HTMLDivElement;
      const tour = el.querySelector('lr-tour') as LyraTour;

      tour.start();
      await tour.updateComplete;
      tour.next(); // step 1: target does not resolve -- exercises the unanchored path
      await tour.updateComplete;
      tour.next(); // step 2: target resolves again
      await tour.updateComplete;
      tour.back();
      await tour.updateComplete;
      tour.goToStep(2);
      await tour.updateComplete;
      tour.end('api');
      await tour.updateComplete;
    } finally {
      console.warn = originalWarn;
    }
    expect(calls.flat().map(String).some((message) => message.includes('scheduled an update'))).to.be.false;
  });
});

it('clamps the tour popover width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-tour .steps=${makeSteps(2)}></lr-tour>`)) as LyraTour;
  await el.updateComplete;
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize("[part='popover']") &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const computed = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  expect(computed).to.equal('10px');
});
