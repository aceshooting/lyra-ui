import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-tour.js';
import type { LyraTour, LyraTourStep } from '../../lr-tour.js';

function makeSteps(count: number, overrides: Partial<LyraTourStep> = {}): LyraTourStep[] {
  return Array.from({ length: count }, (_, index) => ({
    stepId: `step-${index}`,
    target: `#tour-target-${index}`,
    heading: `Heading ${index}`,
    content: `Body ${index}`,
    ...overrides,
  }));
}

function press(target: EventTarget, key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...extra });
  target.dispatchEvent(event);
  return event;
}

function focusedPart(tour: LyraTour): string | null {
  return (tour.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part') ?? null;
}

function panelButtons(tour: LyraTour): HTMLButtonElement[] {
  return [...tour.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="popover"] button')].filter(
    (button) => !button.disabled,
  );
}

async function interactiveTourWithInertTarget(): Promise<{ root: HTMLDivElement; tour: LyraTour }> {
  const root = await fixture<HTMLDivElement>(html`<div>
    <button id="outside">Outside</button>
    <lr-tour .steps=${makeSteps(1, { interactiveTarget: true })} open></lr-tour>
    <div id="tour-target-0">Plain text target</div>
  </div>`);
  const tour = root.querySelector<LyraTour>('lr-tour')!;
  await tour.updateComplete;
  await waitUntil(() => focusedPart(tour) !== null, 'the placed step panel takes focus');
  return { root, tour };
}

describe('lr-tour interactive-target Tab routing edges', () => {
  it('wraps Tab within the panel when the interactive target has nothing focusable', async () => {
    const { tour } = await interactiveTourWithInertTarget();
    const buttons = panelButtons(tour);
    const first = buttons[0]!;
    const last = buttons.at(-1)!;

    last.focus();
    const forward = press(last, 'Tab');
    expect(forward.defaultPrevented).to.equal(true);
    expect(focusedPart(tour)).to.equal(first.getAttribute('part'));

    const backward = press(first, 'Tab', { shiftKey: true });
    expect(backward.defaultPrevented).to.equal(true);
    expect(focusedPart(tour)).to.equal(last.getAttribute('part'));
  });

  it('routes Shift+Tab from outside the tour to the panel when the target has no focusables', async () => {
    const { root, tour } = await interactiveTourWithInertTarget();
    const outside = root.querySelector<HTMLButtonElement>('#outside')!;
    outside.focus();
    const event = press(outside, 'Tab', { shiftKey: true });
    expect(event.defaultPrevented).to.equal(true);
    expect(focusedPart(tour)).to.equal(panelButtons(tour).at(-1)!.getAttribute('part'));
  });

  it('routes Tab from outside the tour to the first panel control', async () => {
    const root = await fixture<HTMLDivElement>(html`<div>
      <button id="outside">Outside</button>
      <lr-tour .steps=${makeSteps(1, { interactiveTarget: true })} open></lr-tour>
      <button id="tour-target-0">Target</button>
    </div>`);
    const tour = root.querySelector<LyraTour>('lr-tour')!;
    await tour.updateComplete;
    await waitUntil(() => focusedPart(tour) !== null, 'the placed step panel takes focus');
    const outside = root.querySelector<HTMLButtonElement>('#outside')!;
    outside.focus();
    const event = press(outside, 'Tab');
    expect(event.defaultPrevented).to.equal(true);
    expect(focusedPart(tour)).to.equal(panelButtons(tour)[0]!.getAttribute('part'));
  });

  it('leaves an already-handled Tab alone', async () => {
    const { tour } = await interactiveTourWithInertTarget();
    const last = panelButtons(tour).at(-1)!;
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true });
    event.preventDefault();
    last.dispatchEvent(event);
    expect(focusedPart(tour), 'focus does not wrap for a cancelled Tab').to.equal(last.getAttribute('part'));
  });
});

describe('lr-tour lifecycle edges', () => {
  it('treats a redundant open write as a no-op', async () => {
    const tour = await fixture<LyraTour>(html`<lr-tour .steps=${makeSteps(1)}></lr-tour>`);
    let ends = 0;
    tour.addEventListener('lr-tour-end', () => (ends += 1));
    tour.open = false;
    await tour.updateComplete;
    expect(ends).to.equal(0);
    expect(tour.hasAttribute('open')).to.equal(false);
  });

  it('ends once with unmount when a reconnect is undone before its deferred restore runs', async () => {
    const root = await fixture<HTMLDivElement>(html`<div>
      <lr-tour .steps=${makeSteps(1)} open></lr-tour>
      <button id="tour-target-0">Target</button>
    </div>`);
    const tour = root.querySelector<LyraTour>('lr-tour')!;
    await tour.updateComplete;
    const reasons: string[] = [];
    tour.addEventListener('lr-tour-end', (event) => reasons.push((event as CustomEvent<{ reason: string }>).detail.reason));
    tour.remove();
    root.append(tour);
    tour.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(tour.isConnected).to.equal(false);
    expect(tour.open).to.equal(false);
    expect(reasons).to.deep.equal(['unmount']);
    root.append(tour);
    await tour.updateComplete;
    expect(tour.open, 'the cancelled restore does not reopen the ended tour').to.equal(false);
    expect(reasons).to.deep.equal(['unmount']);
  });

  it('does not record a non-HTML active element as the focus return target', async () => {
    const root = await fixture<HTMLDivElement>(html`<div>
      <svg width="20" height="20"><a id="svg-link" href="#"><rect width="20" height="20"></rect></a></svg>
      <lr-tour .steps=${makeSteps(1)}></lr-tour>
      <button id="tour-target-0">Target</button>
    </div>`);
    const tour = root.querySelector<LyraTour>('lr-tour')!;
    const svgLink = root.querySelector<SVGAElement>('#svg-link')!;
    svgLink.focus();
    const focusedSvg = document.activeElement === svgLink;
    tour.start();
    await tour.updateComplete;
    await waitUntil(() => focusedPart(tour) !== null, 'the tour moves focus into its panel');
    tour.end();
    await tour.updateComplete;
    expect(tour.open).to.equal(false);
    if (focusedSvg) expect(document.activeElement === svgLink).to.equal(false);
  });

  it('falls back to the default spotlight padding for an unresolvable string padding', async () => {
    const root = await fixture<HTMLDivElement>(html`<div>
      <lr-tour .steps=${makeSteps(1)}></lr-tour>
      <button id="tour-target-0" style="position:fixed; top:100px; left:100px; width:50px; height:30px;">Target</button>
    </div>`);
    const tour = root.querySelector<LyraTour>('lr-tour')!;
    tour.spotlightPadding = 'roomy';
    tour.start();
    await tour.updateComplete;
    const cutout = () => tour.shadowRoot!.querySelector<SVGRectElement>('[part="backdrop"] .cutout')!;
    await waitUntil(() => {
      const width = cutout().getAttribute('width');
      return width !== null && width !== '0';
    }, 'the spotlight cutout is painted');
    const rect = root.querySelector('#tour-target-0')!.getBoundingClientRect();
    expect(Number(cutout().getAttribute('x'))).to.be.closeTo(rect.left - 4, 0.5);
    expect(Number(cutout().getAttribute('width'))).to.be.closeTo(rect.width + 8, 0.5);
  });
});
