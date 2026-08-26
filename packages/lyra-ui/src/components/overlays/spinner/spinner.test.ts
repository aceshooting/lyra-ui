import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './spinner.js';
import type { LyraSpinner, LyraSpinnerLabelPlacement } from './spinner.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

class SpinnerLabelForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const spinner = this.ownerDocument.createElement('lr-spinner');
    spinner.setAttribute('label-placement', 'after');
    const labelSlot = this.ownerDocument.createElement('slot');
    spinner.append(labelSlot);
    root.append(spinner);
  }
}
customElements.define('spinner-label-forward-wrapper', SpinnerLabelForwardWrapper);

const SERVER_SHADOW = '<template shadowrootmode="open"></template>';

async function mountServerRenderedSpinner(markup: string): Promise<LyraSpinner> {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement & {
    setHTMLUnsafe(value: string): void;
  };
  container.setHTMLUnsafe(markup);
  return container.firstElementChild as LyraSpinner;
}

it('accepts the mapped spinner color, width, and speed hooks', async () => {
  const el = (await fixture(html`
    <lr-spinner
      style="--track-width: 7px; --track-color: rgb(1, 2, 3); --indicator-color: rgb(4, 5, 6); --speed: 3s"
    ></lr-spinner>
  `)) as LyraSpinner;
  const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part~="spinner-indicator"]')!;
  const computed = getComputedStyle(indicator);
  expect(computed.borderTopWidth).to.equal('7px');
  expect(computed.borderRightColor).to.equal('rgb(1, 2, 3)');
  expect(computed.borderTopColor).to.equal('rgb(4, 5, 6)');
  expect(computed.animationDuration).to.equal('3s');
});

it('renders a localized non-live indeterminate progressbar without mount noise', async () => {
  const el = (await fixture(html`<lr-spinner></lr-spinner>`)) as LyraSpinner;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('progressbar');
  expect(base.getAttribute('aria-label')).to.equal('Loading…');
  expect(base.hasAttribute('aria-live')).to.be.false;
  expect(base.hasAttribute('aria-valuenow')).to.be.false;
  expect(document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}]`) === null).to.be.true;
  await expect(el).to.be.accessible();
});

it('renders a per-instance localized loading-name override', async () => {
  const el = (await fixture(html`
    <lr-spinner .strings=${{ loading: 'Chargement…' }}></lr-spinner>
  `)) as LyraSpinner;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Chargement…');
});

it('lets a host aria-label override the localized default', async () => {
  const el = (await fixture(html`<lr-spinner aria-label="Loading users"></lr-spinner>`)) as LyraSpinner;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Loading users');
});

it('preserves an explicitly empty host aria-label instead of applying fallback text', async () => {
  const el = (await fixture(html`
    <lr-spinner aria-label="" label-placement="after">Loading users</lr-spinner>
  `)) as LyraSpinner;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('');
});

it('keeps the slotted label sr-only when label-placement is "none" (default)', async () => {
  const el = (await fixture(html`<lr-spinner>Loading data</lr-spinner>`)) as LyraSpinner;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it('shows the slotted label in flow when label-placement is "after"', async () => {
  const el = (await fixture(html`<lr-spinner label-placement="after">Loading data</lr-spinner>`)) as LyraSpinner;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  expect(base.getAttribute('aria-label')).to.equal('Loading data');
  const computed = getComputedStyle(label);
  expect(computed.position).to.not.equal('absolute');
  expect(computed.clipPath).to.not.equal('inset(50%)');
});

it('is accessible with a rich forwarded visible label and host naming override', async () => {
  const wrapper = await fixture(html`
    <spinner-label-forward-wrapper>
      Loading <strong>audited reports</strong>
    </spinner-label-forward-wrapper>
  `);
  const el = wrapper.shadowRoot!.querySelector('lr-spinner') as LyraSpinner;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  await waitUntil(() => base.getAttribute('aria-label') === 'Loading audited reports');
  el.setAttribute('aria-label', 'Loading the audited reports');
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;

  expect(label.hidden).to.equal(false);
  expect(base.getAttribute('aria-label')).to.equal('Loading the audited reports');
  await expect(el).to.be.accessible();
});

it('can render the visible-label branch before a browser render root exists', () => {
  const el = document.createElement('lr-spinner') as LyraSpinner;
  const placement: LyraSpinnerLabelPlacement = 'after';
  el.labelPlacement = placement;
  el.append('Loading files');
  expect(() => el.render()).not.to.throw();
});

it('keeps the server-first loading name during hydration, then adopts the declarative label', async () => {
  const el = await mountServerRenderedSpinner(
    `<lr-spinner label-placement="after">${SERVER_SHADOW}Loading files</lr-spinner>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
    'Loading…',
  );

  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
    'Loading files',
  );
});

it('derives the visible label before the first paint on a browser-only mount', async () => {
  const el = document.createElement('lr-spinner') as LyraSpinner;
  el.labelPlacement = 'after';
  el.append('Loading files');
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
      'Loading files',
    );
  } finally {
    el.remove();
  }
});

it('derives its visible label from accessible slotted text only', async () => {
  const el = (await fixture(html`
    <lr-spinner label-placement="after">
      <span aria-hidden="true">Decorative timer</span>
      <span data-label aria-label="">Loading files</span>
      <span hidden>Hidden detail</span>
      <span style="display: none">CSS-hidden detail</span>
    </lr-spinner>
  `)) as LyraSpinner;
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Loading files');

  const decoration = el.querySelector<HTMLElement>('[aria-hidden="true"]')!;
  decoration.setAttribute('aria-hidden', ' TRUE ');
  decoration.textContent = 'Changed decoration';
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading files');

  const label = el.querySelector<HTMLElement>('[data-label]')!;
  label.hidden = true;
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading…');

  label.hidden = false;
  label.textContent = 'Loading reports';
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading reports');
});

it('keeps visibility-overridden descendant text in the slotted accessible label', async () => {
  for (const visibility of ['hidden', 'collapse']) {
    const el = (await fixture(html`
      <lr-spinner label-placement="after">
        <span style=${`visibility: ${visibility}`}>
          Excluded parent text
          <span style="visibility: visible">Exposed ${visibility} label</span>
        </span>
      </lr-spinner>
    `)) as LyraSpinner;
    await el.updateComplete;

    const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal(`Exposed ${visibility} label`);
  }
});

it('tracks accessible label mutations and reassignment through a forwarding slot', async () => {
  const wrapper = (await fixture(html`
    <spinner-label-forward-wrapper>
      <span data-label>Loading files</span>
    </spinner-label-forward-wrapper>
  `)) as SpinnerLabelForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-spinner') as LyraSpinner;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const label = wrapper.querySelector<HTMLElement>('[data-label]')!;
  expect(base.getAttribute('aria-label')).to.equal('Loading files');

  label.textContent = 'Loading reports';
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading reports');

  label.setAttribute('aria-label', 'Loading exports');
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading exports');

  label.hidden = true;
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading…');

  label.hidden = false;
  label.style.display = 'none';
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading…');

  label.style.removeProperty('display');
  await Promise.resolve();
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading exports');

  label.removeAttribute('aria-label');
  label.textContent = 'Excluded parent text ';
  const visibleChild = wrapper.ownerDocument.createElement('span');
  visibleChild.style.visibility = 'visible';
  visibleChild.textContent = 'Loading visible child';
  label.append(visibleChild);
  label.style.visibility = 'hidden';
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading visible child');

  const replacement = wrapper.ownerDocument.createElement('span');
  replacement.textContent = 'Loading invoices';
  const forwardingSlot = el.querySelector('slot')!;
  const reassigned = oneEvent(forwardingSlot, 'slotchange');
  label.replaceWith(replacement);
  await reassigned;
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Loading invoices');
});

it('constructs its label observer in the adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow as Window & typeof globalThis;
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
  // Render once in the defining realm so Lit's constructed stylesheet belongs to the shadow
  // root before the normal custom-element adoption lifecycle moves that root to another document.
  const el = (await fixture(html`<lr-spinner></lr-spinner>`)) as LyraSpinner;
  el.remove();
  el.labelPlacement = 'after';
  el.textContent = 'Loading adopted content';
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(
      constructions,
      'the base observer and the spinner label observer both use the adopted realm',
    ).to.be.greaterThan(1);
    expect(
      el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-label'),
    ).to.equal('Loading adopted content');
  } finally {
    el.remove();
    if (observerDescriptor) {
      Object.defineProperty(frameWindow, 'MutationObserver', observerDescriptor);
    } else {
      Reflect.deleteProperty(frameWindow, 'MutationObserver');
    }
    frame.remove();
  }
});

it('arms accessible-text observation only while a visible label can name the spinner', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const NativeMutationObserver = window.MutationObserver;
  let labelObservations = 0;
  class TrackingMutationObserver extends NativeMutationObserver {
    override observe(target: Node, options?: MutationObserverInit): void {
      if ((target as Element).localName === 'lr-spinner' && options?.characterData) labelObservations += 1;
      super.observe(target, options);
    }
  }
  Object.defineProperty(window, 'MutationObserver', { configurable: true, value: TrackingMutationObserver });
  try {
    const el = (await fixture(html`<lr-spinner>Passive label</lr-spinner>`)) as LyraSpinner;
    expect(labelObservations).to.equal(0);
    el.labelPlacement = 'after';
    await el.updateComplete;
    expect(labelObservations).to.be.greaterThan(0);
  } finally {
    if (descriptor) Object.defineProperty(window, 'MutationObserver', descriptor);
  }
});

it('refreshes the cached visible label after it changes while disconnected', async () => {
  const el = (await fixture(html`
    <lr-spinner label-placement="after">Loading files</lr-spinner>
  `)) as LyraSpinner;
  el.remove();
  el.textContent = 'Loading reports';
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).to.equal(
      'Loading reports',
    );
  } finally {
    el.remove();
  }
});

it('stops the rendered indicator animation under prefers-reduced-motion', async () => {
  const el = (await fixture(html`<lr-spinner></lr-spinner>`)) as LyraSpinner;
  const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part~="spinner-indicator"]')!;
  expect(getComputedStyle(indicator).animationName).to.equal('lr-spin');
  const reducedRule = el.shadowRoot!.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === '(prefers-reduced-motion: reduce)' &&
        [...rule.cssRules].some(
          (nested) =>
            nested instanceof CSSStyleRule && nested.selectorText.includes('spinner-indicator'),
        ),
    );
  expect(reducedRule?.conditionText).to.equal('(prefers-reduced-motion: reduce)');
  const originalCondition = reducedRule!.media.mediaText;
  try {
    reducedRule!.media.mediaText = 'all';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(indicator).animationName).to.equal('none');
  } finally {
    reducedRule!.media.mediaText = originalCondition;
  }
});

it('inherits the shared ambient timing token unless its component duration is overridden', async () => {
  const el = (await fixture(
    html`<lr-spinner style="--lr-transition-ambient: 3s linear"></lr-spinner>`,
  )) as LyraSpinner;
  const spinner = el.shadowRoot!.querySelector('[part~="spinner-indicator"]') as HTMLElement;
  expect(getComputedStyle(spinner).animationDuration).to.equal('3s');
  expect(getComputedStyle(spinner).animationTimingFunction).to.equal('linear');
});

it('uses break-word, not anywhere, on an after-placement label', async () => {
  const el = (await fixture(
    html`<lr-spinner label-placement="after">Loading data</lr-spinner>`,
  )) as LyraSpinner;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(getComputedStyle(label).overflowWrap).to.equal('break-word');
});
