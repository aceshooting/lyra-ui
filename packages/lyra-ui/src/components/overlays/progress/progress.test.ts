import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './progress-bar.js';
import './progress-ring.js';
import type { LyraProgressBar } from './progress-bar.js';
import type { LyraProgressRing } from './progress-ring.js';

class ProgressBarLabelForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const progress = this.ownerDocument.createElement('lr-progress-bar');
    progress.append(this.ownerDocument.createElement('slot'));
    root.append(progress);
  }
}
customElements.define('progress-bar-label-forward-wrapper', ProgressBarLabelForwardWrapper);

class ProgressRingLabelForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const progress = this.ownerDocument.createElement('lr-progress-ring');
    progress.append(this.ownerDocument.createElement('slot'));
    root.append(progress);
  }
}
customElements.define('progress-ring-label-forward-wrapper', ProgressRingLabelForwardWrapper);

const SERVER_SHADOW = '<template shadowrootmode="open"></template>';

async function mountServerRenderedProgressRing(markup: string): Promise<LyraProgressRing> {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement & {
    setHTMLUnsafe(value: string): void;
  };
  container.setHTMLUnsafe(markup);
  return container.firstElementChild as LyraProgressRing;
}

it('reflects value on both progress components', async () => {
  const bar = (await fixture(html`<lr-progress-bar></lr-progress-bar>`)) as LyraProgressBar;
  const ring = (await fixture(html`<lr-progress-ring></lr-progress-ring>`)) as LyraProgressRing;
  bar.value = 25;
  ring.value = 30;
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(bar.getAttribute('value')).to.equal('25');
  expect(ring.getAttribute('value')).to.equal('30');
});

it('accepts both upstream progress custom-property vocabularies', async () => {
  const bar = await fixture(html`
    <lr-progress-bar
      value="50"
      style="--height: 12px; --track-color: rgb(1, 2, 3); --indicator-color: rgb(4, 5, 6); --label-color: rgb(7, 8, 9)"
    >Upload</lr-progress-bar>
  `);
  const track = bar.shadowRoot!.querySelector<HTMLElement>('[part="track"]')!;
  const indicator = bar.shadowRoot!.querySelector<HTMLElement>('[part="indicator"]')!;
  const label = bar.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
  expect(getComputedStyle(track).blockSize).to.equal('12px');
  expect(getComputedStyle(track).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(indicator).backgroundColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(label).color).to.equal('rgb(7, 8, 9)');

  const ring = await fixture(html`
    <lr-progress-ring
      value="50"
      style="--size: 64px; --track-width: 8px; --indicator-width: 6px; --track-color: rgb(10, 11, 12); --indicator-color: rgb(13, 14, 15); --indicator-transition-duration: 2s"
    ></lr-progress-ring>
  `);
  const ringBase = ring.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const ringTrack = ring.shadowRoot!.querySelector<SVGCircleElement>('[part="track"]')!;
  const ringIndicator = ring.shadowRoot!.querySelector<SVGCircleElement>('[part="indicator"]')!;
  expect(getComputedStyle(ringBase).inlineSize).to.equal('64px');
  expect(getComputedStyle(ringTrack).strokeWidth).to.equal('8px');
  expect(getComputedStyle(ringIndicator).strokeWidth).to.equal('6px');
  expect(getComputedStyle(ringTrack).stroke).to.equal('rgb(10, 11, 12)');
  expect(getComputedStyle(ringIndicator).stroke).to.equal('rgb(13, 14, 15)');
  expect(getComputedStyle(ringIndicator).transitionDuration).to.equal('2s');
});

it('renders determinate progress with a bounded value', async () => {
  const el = (await fixture(html`<lr-progress-bar value="25" max="50"></lr-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-valuenow')).to.equal('25');
  expect(base.querySelector('[part="indicator"]')?.getAttribute('style')).to.contain('50%');
  await expect(el).to.be.accessible();
});

it('shows the computed percent, not the raw value, in the show-value label when max is not 100', async () => {
  const el = (await fixture(
    html`<lr-progress-bar value="25" max="50" show-value></lr-progress-bar>`,
  )) as LyraProgressBar;
  const label = el.shadowRoot!.querySelector('[part="label"] span');
  expect(label?.textContent).to.equal('50%');
});

it('keeps a default-slot label visible and accessible independently of show-value', async () => {
  const el = (await fixture(html`
    <lr-progress-bar value="25">Uploading files</lr-progress-bar>
  `)) as LyraProgressBar;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[role="progressbar"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  const slot = label.querySelector('slot:not([name])') as HTMLSlotElement;
  expect(slot.assignedNodes().map((node) => node.textContent).join('').trim()).to.equal('Uploading files');
  expect(getComputedStyle(label).display).to.equal('flex');
  expect(base.getAttribute('aria-label')).to.equal('Uploading files');
});

it('supports label plus accessible-label as equivalent progress naming surfaces', async () => {
  const bar = (await fixture(html`
    <lr-progress-bar value="25" label="Upload progress"></lr-progress-bar>
  `)) as LyraProgressBar;
  expect(bar.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).to.equal(
    'Upload progress',
  );

  const ring = await fixture(html`
    <lr-progress-ring value="25" accessible-label="Sync progress"></lr-progress-ring>
  `);
  expect(ring.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).to.equal(
    'Sync progress',
  );
});

it('applies mapped progress color, size, and transition aliases to rendered parts', async () => {
  const bar = await fixture(html`
    <lr-progress-bar
      value="50"
      style="
        --lr-progress-track-height: 12px;
        --lr-progress-track-color: rgb(1, 2, 3);
        --lr-progress-indicator-color: rgb(4, 5, 6);
        --lr-progress-label-color: rgb(7, 8, 9);
      "
    >Upload</lr-progress-bar>
  `);
  const track = bar.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  const indicator = bar.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  const label = bar.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(getComputedStyle(track).blockSize).to.equal('12px');
  expect(getComputedStyle(track).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(indicator).backgroundColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(label).color).to.equal('rgb(7, 8, 9)');

  const ring = await fixture(html`
    <lr-progress-ring
      value="50"
      style="
        --lr-progress-ring-size: 64px;
        --lr-progress-ring-track-width: 8px;
        --lr-progress-ring-indicator-width: 6px;
        --lr-progress-ring-track-color: rgb(10, 11, 12);
        --lr-progress-ring-indicator-color: rgb(13, 14, 15);
        --lr-progress-ring-indicator-transition-duration: 2s;
      "
    ></lr-progress-ring>
  `);
  const ringBase = ring.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const ringTrack = ring.shadowRoot!.querySelector('[part="track"]') as SVGCircleElement;
  const ringIndicator = ring.shadowRoot!.querySelector('[part="indicator"]') as SVGCircleElement;
  expect(getComputedStyle(ringBase).inlineSize).to.equal('64px');
  expect(getComputedStyle(ringTrack).strokeWidth).to.equal('8px');
  expect(getComputedStyle(ringIndicator).strokeWidth).to.equal('6px');
  expect(getComputedStyle(ringTrack).stroke).to.equal('rgb(10, 11, 12)');
  expect(getComputedStyle(ringIndicator).stroke).to.equal('rgb(13, 14, 15)');
  expect(getComputedStyle(ringIndicator).transitionDuration).to.equal('2s');
});

it('recolors the bar indicator per variant instead of always rendering brand regardless of the attribute', async () => {
  const brand = (await fixture(html`<lr-progress-bar value="50"></lr-progress-bar>`)) as LyraProgressBar;
  const neutral = (await fixture(
    html`<lr-progress-bar variant="neutral" value="50"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const success = (await fixture(
    html`<lr-progress-bar variant="success" value="50"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const danger = (await fixture(
    html`<lr-progress-bar variant="danger" value="50"></lr-progress-bar>`,
  )) as LyraProgressBar;

  // 'brand' is the property default and must reflect even though no attribute was authored.
  expect(brand.getAttribute('variant')).to.equal('brand');

  const indicatorColor = (el: LyraProgressBar): string =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="indicator"]')!).backgroundColor;

  expect(indicatorColor(danger)).to.not.equal(indicatorColor(success));
  expect(indicatorColor(neutral)).to.not.equal(indicatorColor(brand));
  expect(indicatorColor(brand)).to.not.equal(indicatorColor(success));
});

it('locale-formats visible percentage output and forwards live host naming to both progress roles', async () => {
  const bar = (await fixture(
    html`<lr-progress-bar lang="ar" value="25" max="50" show-value aria-label="Upload"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const barBase = bar.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(bar.shadowRoot!.querySelector('[part="label"] span')?.textContent).to.equal(
    new Intl.NumberFormat('ar', { style: 'percent', maximumFractionDigits: 0 }).format(0.5),
  );
  expect(barBase.getAttribute('aria-label')).to.equal('Upload');
  bar.setAttribute('aria-label', 'Download');
  await bar.updateComplete;
  expect(barBase.getAttribute('aria-label')).to.equal('Download');

  const ring = await fixture(html`<lr-progress-ring lang="de" value="25" max="50" aria-label="Sync"></lr-progress-ring>`);
  const ringBase = ring.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(ring.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal(
    new Intl.NumberFormat('de', { style: 'percent', maximumFractionDigits: 0 }).format(0.5),
  );
  expect(ringBase.getAttribute('aria-label')).to.equal('Sync');
});

it('uses visible consumer labels in the accessible names of both progress roles', async () => {
  const bar = (await fixture(html`
    <lr-progress-bar value="25" show-value><span slot="label">Upload files</span></lr-progress-bar>
  `)) as LyraProgressBar;
  const barBase = bar.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(barBase.getAttribute('aria-label')).to.equal('Upload files');

  const ring = await fixture(html`
    <lr-progress-ring value="25"><strong>Sync files</strong></lr-progress-ring>
  `);
  const ringBase = ring.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(ringBase.getAttribute('aria-label')).to.equal('Sync files');

  const label = bar.querySelector('[slot="label"]')!;
  label.textContent = 'Upload documents';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await bar.updateComplete;
  expect(barBase.getAttribute('aria-label')).to.equal('Upload documents');
});

it('can render the indeterminate ring before a browser render root exists', () => {
  const el = document.createElement('lr-progress-ring') as LyraProgressRing;
  el.indeterminate = true;
  el.append('Syncing files');
  expect(() => el.render()).not.to.throw();
});

it('keeps the server-first progress name during hydration, then adopts the declarative ring label', async () => {
  const el = await mountServerRenderedProgressRing(
    `<lr-progress-ring indeterminate>${SERVER_SHADOW}Syncing files</lr-progress-ring>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
    'Progress',
  );

  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
    'Syncing files',
  );
});

it('derives the ring label before the first paint on a browser-only mount', async () => {
  const el = document.createElement('lr-progress-ring') as LyraProgressRing;
  el.indeterminate = true;
  el.append('Syncing files');
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
      'Syncing files',
    );
  } finally {
    el.remove();
  }
});

it('tracks accessible label mutations and reassignment through forwarding slots', async () => {
  const barWrapper = (await fixture(html`
    <progress-bar-label-forward-wrapper>
      <span data-label>Uploading files</span>
    </progress-bar-label-forward-wrapper>
  `)) as ProgressBarLabelForwardWrapper;
  const ringWrapper = (await fixture(html`
    <progress-ring-label-forward-wrapper>
      <span data-label>Syncing files</span>
    </progress-ring-label-forward-wrapper>
  `)) as ProgressRingLabelForwardWrapper;
  const bar = barWrapper.shadowRoot!.querySelector('lr-progress-bar') as LyraProgressBar;
  const ring = ringWrapper.shadowRoot!.querySelector('lr-progress-ring') as LyraProgressRing;
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  const barRole = bar.shadowRoot!.querySelector<HTMLElement>('[role="progressbar"]')!;
  const ringRole = ring.shadowRoot!.querySelector<HTMLElement>('[role="progressbar"]')!;
  const barLabel = barWrapper.querySelector<HTMLElement>('[data-label]')!;
  const ringLabel = ringWrapper.querySelector<HTMLElement>('[data-label]')!;
  expect(barRole.getAttribute('aria-label')).to.equal('Uploading files');
  expect(ringRole.getAttribute('aria-label')).to.equal('Syncing files');

  barLabel.textContent = 'Uploading reports';
  ringLabel.textContent = 'Syncing reports';
  await Promise.resolve();
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(barRole.getAttribute('aria-label')).to.equal('Uploading reports');
  expect(ringRole.getAttribute('aria-label')).to.equal('Syncing reports');

  barLabel.setAttribute('aria-label', 'Uploading exports');
  ringLabel.setAttribute('aria-label', 'Syncing exports');
  await Promise.resolve();
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(barRole.getAttribute('aria-label')).to.equal('Uploading exports');
  expect(ringRole.getAttribute('aria-label')).to.equal('Syncing exports');

  barLabel.hidden = true;
  ringLabel.style.display = 'none';
  await Promise.resolve();
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(barRole.getAttribute('aria-label')).to.equal('Progress');
  expect(ringRole.getAttribute('aria-label')).to.equal('Progress');

  barLabel.hidden = false;
  ringLabel.style.removeProperty('display');
  barLabel.removeAttribute('aria-label');
  ringLabel.removeAttribute('aria-label');
  barLabel.textContent = 'Excluded bar text ';
  ringLabel.textContent = 'Excluded ring text ';
  const visibleBarChild = barWrapper.ownerDocument.createElement('span');
  visibleBarChild.style.visibility = 'visible';
  visibleBarChild.textContent = 'Exposed upload label';
  const visibleRingChild = ringWrapper.ownerDocument.createElement('span');
  visibleRingChild.style.visibility = 'visible';
  visibleRingChild.textContent = 'Exposed sync label';
  barLabel.append(visibleBarChild);
  ringLabel.append(visibleRingChild);
  barLabel.style.visibility = 'hidden';
  ringLabel.style.visibility = 'hidden';
  // Let the observer enqueue its owner-realm post-cascade refresh, then drain that frame and timer.
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(barRole.getAttribute('aria-label')).to.equal('Exposed upload label');
  expect(ringRole.getAttribute('aria-label')).to.equal('Exposed sync label');

  barLabel.setAttribute('aria-hidden', 'true');
  ringLabel.setAttribute('aria-hidden', ' TRUE ');
  await Promise.resolve();
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(barRole.getAttribute('aria-label')).to.equal('Progress');
  expect(ringRole.getAttribute('aria-label')).to.equal('Progress');

  const barReplacement = barWrapper.ownerDocument.createElement('span');
  barReplacement.textContent = 'Uploading invoices';
  const ringReplacement = ringWrapper.ownerDocument.createElement('span');
  ringReplacement.textContent = 'Syncing invoices';
  const barReassigned = oneEvent(bar.querySelector('slot')!, 'slotchange');
  const ringReassigned = oneEvent(ring.querySelector('slot')!, 'slotchange');
  barLabel.replaceWith(barReplacement);
  ringLabel.replaceWith(ringReplacement);
  await Promise.all([barReassigned, ringReassigned]);
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(barRole.getAttribute('aria-label')).to.equal('Uploading invoices');
  expect(ringRole.getAttribute('aria-label')).to.equal('Syncing invoices');
});

it('preserves an explicitly empty host aria-label on both progress roles', async () => {
  const bar = (await fixture(html`
    <lr-progress-bar aria-label="">Upload files</lr-progress-bar>
  `)) as LyraProgressBar;
  const ring = (await fixture(html`
    <lr-progress-ring aria-label="">Sync files</lr-progress-ring>
  `)) as LyraProgressRing;
  await Promise.all([bar.updateComplete, ring.updateComplete]);
  expect(bar.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).to.equal('');
  expect(ring.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).to.equal('');
});

it('constructs progress label observers in the adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const observerDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
  const NativeMutationObserver = frameWindow.MutationObserver;
  let constructions = 0;
  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions += 1;
    }
  }
  Object.defineProperty(frameWindow, 'MutationObserver', {
    configurable: true,
    value: TrackingMutationObserver,
  });

  const bar = (await fixture(html`<lr-progress-bar>Upload</lr-progress-bar>`)) as LyraProgressBar;
  const ring = (await fixture(html`<lr-progress-ring>Sync</lr-progress-ring>`)) as LyraProgressRing;
  bar.remove();
  ring.remove();
  try {
    frameDocument.body.append(frameDocument.adoptNode(bar), frameDocument.adoptNode(ring));
    await Promise.all([bar.updateComplete, ring.updateComplete]);
    expect(
      constructions,
      'each component constructs its base and label observers in the adopted realm',
    ).to.be.greaterThan(3);
  } finally {
    bar.remove();
    ring.remove();
    if (observerDescriptor) {
      Object.defineProperty(frameWindow, 'MutationObserver', observerDescriptor);
    } else {
      delete (frameWindow as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
    }
    frame.remove();
  }
});

it('refreshes the cached ring label after it changes while disconnected', async () => {
  const el = (await fixture(html`<lr-progress-ring>Syncing files</lr-progress-ring>`)) as LyraProgressRing;
  el.remove();
  el.textContent = 'Syncing reports';
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
      'Syncing reports',
    );
  } finally {
    el.remove();
  }
});

it('applies --lr-progress-height to the track', async () => {
  const el = (await fixture(
    html`<lr-progress-bar style="--lr-progress-height: 10px"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  expect(getComputedStyle(track).blockSize).to.equal('10px');
});

it('omits aria-valuenow for indeterminate progress', async () => {
  const el = (await fixture(html`<lr-progress-bar indeterminate></lr-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-valuenow')).to.be.false;
});

it('mirrors the indeterminate bar sweep under dir="rtl" with reversed keyframes', async () => {
  const ltr = (await fixture(html`<lr-progress-bar indeterminate></lr-progress-bar>`)) as LyraProgressBar;
  const ltrIndicator = ltr.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(ltrIndicator).animationName).to.equal('lr-progress-slide');

  // translateX keyframes are physical, so the RTL sweep needs its own mirrored keyframes to
  // travel end-to-start (the indicator's static position is right-anchored under RTL).
  const rtl = (await fixture(
    html`<lr-progress-bar indeterminate dir="rtl"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const rtlIndicator = rtl.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(rtlIndicator).animationName).to.equal('lr-progress-slide-rtl');
});

it('anchors the determinate fill to the inline-start edge, mirroring under dir="rtl"', async () => {
  const wrapper = (await fixture(
    html`<div dir="rtl" style="inline-size:200px"><lr-progress-bar value="25"></lr-progress-bar></div>`,
  )) as HTMLDivElement;
  const bar = wrapper.querySelector('lr-progress-bar') as LyraProgressBar;
  await bar.updateComplete;
  const track = bar.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  const indicator = bar.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  // The determinate indicator is a plain block box sized by inline-size, so it lines up with
  // the track's physical right edge under RTL with no extra CSS.
  expect(
    Math.abs(indicator.getBoundingClientRect().right - track.getBoundingClientRect().right),
  ).to.be.lessThan(1);
  expect(indicator.getBoundingClientRect().width).to.be.closeTo(track.getBoundingClientRect().width * 0.25, 1);
});

it('renders an accessible progress ring', async () => {
  const el = await fixture(html`<lr-progress-ring value="40"></lr-progress-ring>`);
  await expect(el).to.be.accessible();
});

it('guards against a non-finite or non-positive max (would otherwise divide by zero / render aria-valuemax="NaN")', async () => {
  const nanMax = (await fixture(html`<lr-progress-bar max="abc" value="25"></lr-progress-bar>`)) as LyraProgressBar;
  const nanBase = nanMax.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(nanBase.getAttribute('aria-valuemax')).to.equal('100');
  expect(nanBase.querySelector('[part="indicator"]')?.getAttribute('style')).to.not.contain('NaN');

  const zeroMax = (await fixture(html`<lr-progress-bar max="0" value="25"></lr-progress-bar>`)) as LyraProgressBar;
  const zeroBase = zeroMax.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(zeroBase.getAttribute('aria-valuemax')).to.equal('100');

  const ring = await fixture(html`<lr-progress-ring max="-10" value="25"></lr-progress-ring>`);
  expect(ring.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuemax')).to.equal('100');
});

it('clamps an out-of-range or non-finite value to [0, max] for progress-bar and progress-ring', async () => {
  const negative = (await fixture(html`<lr-progress-bar value="-10" max="50"></lr-progress-bar>`)) as LyraProgressBar;
  expect(negative.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuenow')).to.equal('0');

  const over = (await fixture(html`<lr-progress-bar value="9999" max="50"></lr-progress-bar>`)) as LyraProgressBar;
  expect(over.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuenow')).to.equal('50');

  const nan = (await fixture(html`<lr-progress-bar max="50"></lr-progress-bar>`)) as LyraProgressBar;
  nan.value = NaN;
  await nan.updateComplete;
  expect(nan.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuenow')).to.equal('0');
  expect(nan.shadowRoot!.querySelector('[part="indicator"]')?.getAttribute('style')).to.not.contain('NaN');

  const ring = await fixture(html`<lr-progress-ring value="9999" max="50"></lr-progress-ring>`);
  expect(ring.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-valuenow')).to.equal('50');
});

it('spins the indeterminate ring indicator and disables the animation under prefers-reduced-motion', async () => {
  const el = await fixture(html`<lr-progress-ring indeterminate></lr-progress-ring>`);
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    expect(getComputedStyle(indicator).animationName).to.equal('none');
    return;
  }
  expect(getComputedStyle(indicator).animationName).to.equal('lr-progress-ring-spin');
  const reducedRule = el.shadowRoot!.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === '(prefers-reduced-motion: reduce)' &&
        [...rule.cssRules].some(
          (nested) =>
            nested instanceof CSSStyleRule &&
            nested.selectorText.includes('indicator') &&
            nested.style.getPropertyPriority('animation') === 'important',
        ),
    );
  expect(reducedRule).to.exist;
  const originalCondition = reducedRule!.media.mediaText;
  try {
    reducedRule!.media.mediaText = 'all';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(indicator).animationName).to.equal('none');
  } finally {
    reducedRule!.media.mediaText = originalCondition;
  }
});

it('inherits the shared ambient timing token for indeterminate bar and ring motion', async () => {
  const bar = await fixture(
    html`<lr-progress-bar indeterminate style="--lr-transition-ambient: 3s linear"></lr-progress-bar>`,
  );
  const barIndicator = bar.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(barIndicator).animationDuration).to.equal('3s');
  expect(getComputedStyle(barIndicator).animationTimingFunction).to.equal('linear');

  const ring = await fixture(
    html`<lr-progress-ring indeterminate style="--lr-transition-ambient: 2.5s linear"></lr-progress-ring>`,
  );
  const ringIndicator = ring.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(ringIndicator).animationDuration).to.equal('2.5s');
  expect(getComputedStyle(ringIndicator).animationTimingFunction).to.equal('linear');
});

it('names an unslotted ring from the localized fallback, not from its own percent text', async () => {
  const el = (await fixture(html`<lr-progress-ring value="40"></lr-progress-ring>`)) as LyraProgressRing;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[role="progressbar"]') as HTMLElement;
  // The slot's fallback content is the formatted percent. assignedNodes({flatten:true}) returns
  // fallback children when nothing is assigned, so an unguarded read would name the control "40%"
  // and make the localized name (and any registerLyraLocale override) unreachable.
  expect(bar.getAttribute('aria-label')).to.equal('Progress');

  const overridden = (await fixture(html`
    <lr-progress-ring value="40" .strings=${{ progress: 'Chargement' }}></lr-progress-ring>
  `)) as LyraProgressRing;
  await overridden.updateComplete;
  expect(
    overridden.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label'),
    'a locale override must still reach the name',
  ).to.equal('Chargement');
});

it('still lets genuinely slotted content name the ring', async () => {
  const el = (await fixture(html`<lr-progress-ring value="40">Uploading</lr-progress-ring>`)) as LyraProgressRing;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).to.contain('Uploading');
});
