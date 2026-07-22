import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './widget.js';
import type { LyraWidget } from './widget.js';
import { styles } from './widget.styles.js';

// A stand-in for a slotted component (e.g. lr-combobox) whose real
// focusable target lives inside its own shadow root rather than the host
// tag's light-DOM subtree.
class WidgetTestShadowInput extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    root.appendChild(input);
  }
}
customElements.define('widget-test-shadow-input', WidgetTestShadowInput);

it('renders label and sublabel in the header', async () => {
  const el = (await fixture(
    html`<lr-widget label="Load profile" sublabel="Last 7 days">content</lr-widget>`,
  )) as LyraWidget;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Load profile');
  expect(el.shadowRoot!.querySelector('[part="sublabel"]')!.textContent).to.equal('Last 7 days');
});

describe('icon slot', () => {
  it('renders a leading icon from the icon slot', async () => {
    const el = (await fixture(
      html`<lr-widget label="Load"><svg slot="icon" width="16" height="16"></svg>content</lr-widget>`,
    )) as LyraWidget;
    const iconSlot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
    expect(iconSlot.assignedElements().length).to.equal(1);
  });
});

describe('collapse-icon slot override', () => {
  it('renders the default chevron icon when nothing is slotted (unchanged)', async () => {
    const el = (await fixture(html`<lr-widget label="x" collapsible>content</lr-widget>`)) as LyraWidget;
    const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
    const slot = btn.querySelector('slot[name="collapse-icon"]') as HTMLSlotElement;
    expect(slot.assignedElements().length).to.equal(0);
    expect(slot.querySelector('svg')).to.exist;
  });

  it('renders a custom icon slotted into collapse-icon instead of the default chevron', async () => {
    const el = (await fixture(html`
      <lr-widget label="x" collapsible>
        <svg slot="collapse-icon" class="my-collapse-icon"></svg>
        content
      </lr-widget>
    `)) as LyraWidget;
    const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
    const slot = btn.querySelector('slot[name="collapse-icon"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned.length).to.equal(1);
    expect((assigned[0] as HTMLElement).classList.contains('my-collapse-icon')).to.be.true;
  });
});

describe('fullscreen-icon slot override', () => {
  it('renders the default expand/close icon when nothing is slotted (unchanged)', async () => {
    const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;
    const btn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
    const slot = btn.querySelector('slot[name="fullscreen-icon"]') as HTMLSlotElement;
    expect(slot.assignedElements().length).to.equal(0);
    expect(slot.querySelector('svg')).to.exist;
  });

  it('renders a custom icon slotted into fullscreen-icon instead of the default expand/close glyph', async () => {
    const el = (await fixture(html`
      <lr-widget label="x" expandable>
        <svg slot="fullscreen-icon" class="my-fullscreen-icon"></svg>
        content
      </lr-widget>
    `)) as LyraWidget;
    const btn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
    const slot = btn.querySelector('slot[name="fullscreen-icon"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned.length).to.equal(1);
    expect((assigned[0] as HTMLElement).classList.contains('my-fullscreen-icon')).to.be.true;

    btn.click();
    await el.updateComplete;
    // Still overridden after the fullscreen state flips (which changes which
    // default icon *would* have rendered between expand/close).
    const slotAfter = btn.querySelector('slot[name="fullscreen-icon"]') as HTMLSlotElement;
    expect(slotAfter.assignedElements({ flatten: true }).length).to.equal(1);
  });
});

describe('rich label/sublabel', () => {
  it('lets the label slot override the label attribute instead of concatenating both', async () => {
    const el = (await fixture(
      html`<lr-widget label="attr"><span slot="label">rich</span>content</lr-widget>`,
    )) as LyraWidget;
    const slot = el.shadowRoot!.querySelector('slot[name="label"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned.length).to.equal(1);
    expect(assigned[0].textContent).to.equal('rich');
  });

  it('renders label/sublabel as plain strings when no slot content is provided (unchanged default)', async () => {
    const el = (await fixture(html`<lr-widget label="Load" sublabel="Last 7 days">content</lr-widget>`)) as LyraWidget;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Load');
    expect(el.shadowRoot!.querySelector('[part="sublabel"]')!.textContent).to.equal('Last 7 days');
  });

  it('detects a slot="label" child appended after connect even when label/sublabel start empty', async () => {
    // Regression: [part="label"]/[part="sublabel"] must always render their
    // <slot> (hidden via CSS, like [part="actions"]) so a slotchange fired by
    // a later-appended slotted child can still be observed -- when the wrapper
    // itself was conditionally omitted from the template, no <slot> ever
    // existed in the shadow DOM for a runtime-added child to trigger.
    const el = (await fixture(html`<lr-widget>content</lr-widget>`)) as LyraWidget;
    const labelPart = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    const sublabelPart = el.shadowRoot!.querySelector('[part="sublabel"]') as HTMLElement;
    expect(labelPart.hasAttribute('hidden')).to.be.true;
    expect(sublabelPart.hasAttribute('hidden')).to.be.true;

    const labelSlot = el.shadowRoot!.querySelector('slot[name="label"]') as HTMLSlotElement;
    const span = document.createElement('span');
    span.slot = 'label';
    span.textContent = 'Runtime label';
    el.appendChild(span);
    labelSlot.dispatchEvent(new Event('slotchange'));
    await el.updateComplete;

    expect(labelPart.hasAttribute('hidden')).to.be.false;
    const assigned = labelSlot.assignedElements({ flatten: true });
    expect(assigned.length).to.equal(1);
    expect(assigned[0]!.textContent).to.equal('Runtime label');
  });
});

describe('views', () => {
  it('defaults to a single unnamed body slot when views is unset (unchanged today)', async () => {
    const el = (await fixture(html`<lr-widget label="x">content</lr-widget>`)) as LyraWidget;
    const bodySlot = el.shadowRoot!.querySelector('[part="body"] slot:not([name])') as HTMLSlotElement;
    expect(bodySlot).to.exist;
    expect(bodySlot.assignedNodes({ flatten: true }).map((n) => n.textContent).join('')).to.include('content');
  });

  it('renders a header toggle per view and a named slot per view when views is set', async () => {
    const el = (await fixture(html`
      <lr-widget label="Usage" .views=${[{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }]}>
        <div slot="view-chart">chart content</div>
        <div slot="view-table">table content</div>
      </lr-widget>
    `)) as LyraWidget;
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="view-toggle"]')];
    expect(toggles).to.have.length(2);
    expect(el.shadowRoot!.querySelector('slot[name="view-chart"]')).to.exist;
    expect(el.shadowRoot!.querySelector('slot[name="view-table"]')).to.exist;
  });

  it('switches the active view on click and emits lr-view-change', async () => {
    const el = (await fixture(html`
      <lr-widget label="Usage" .views=${[{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }]}>
        <div slot="view-chart">chart content</div>
        <div slot="view-table">table content</div>
      </lr-widget>
    `)) as LyraWidget;
    await el.updateComplete;
    expect(el.activeView).to.equal('chart');
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="view-toggle"]')] as HTMLButtonElement[];
    setTimeout(() => toggles[1]!.click());
    const ev = await oneEvent(el, 'lr-view-change');
    expect(ev.detail).to.deep.equal({ viewId: 'table' });
    expect(el.activeView).to.equal('table');
  });

  it('keeps rendering a label-only view toggle with no aria-label (unchanged today)', async () => {
    const el = (await fixture(html`
      <lr-widget label="Usage" .views=${[{ id: 'chart', label: 'Chart' }]}>
        <div slot="view-chart">chart content</div>
      </lr-widget>
    `)) as LyraWidget;
    const toggle = el.shadowRoot!.querySelector('[part="view-toggle"]') as HTMLButtonElement;
    expect(toggle.textContent?.trim()).to.equal('Chart');
    expect(toggle.hasAttribute('aria-label')).to.be.false;
  });

  it('renders an icon-only view toggle (no label) using ariaLabel as its accessible name', async () => {
    const chartIcon = html`<svg class="chart-icon"></svg>`;
    const el = (await fixture(html`
      <lr-widget
        label="Usage"
        .views=${[{ id: 'chart', icon: chartIcon, ariaLabel: 'Chart view' }]}
      >
        <div slot="view-chart">chart content</div>
      </lr-widget>
    `)) as LyraWidget;
    const toggle = el.shadowRoot!.querySelector('[part="view-toggle"]') as HTMLButtonElement;
    expect(toggle.textContent?.trim()).to.equal('');
    expect(toggle.querySelector('svg.chart-icon')).to.exist;
    expect(toggle.getAttribute('aria-label')).to.equal('Chart view');
  });

  it('is accessible with an icon-only view toggle (ariaLabel supplies the accessible name)', async () => {
    const chartIcon = html`<svg class="chart-icon"></svg>`;
    const el = (await fixture(html`
      <lr-widget
        label="Usage"
        .views=${[{ id: 'chart', icon: chartIcon, ariaLabel: 'Chart view' }]}
      >
        <div slot="view-chart">chart content</div>
      </lr-widget>
    `)) as LyraWidget;
    await expect(el).to.be.accessible();
  });

  it('falls back to the view id as a last-resort accessible name when both label and ariaLabel are omitted', async () => {
    const el = (await fixture(html`
      <lr-widget label="Usage" .views=${[{ id: 'chart' }]}>
        <div slot="view-chart">chart content</div>
      </lr-widget>
    `)) as LyraWidget;
    const toggle = el.shadowRoot!.querySelector('[part="view-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).to.equal('chart');
  });
});

it('truncates long label/sublabel text instead of wrapping and growing the header', async () => {
  const longText =
    'A very long widget title that is guaranteed to overflow a narrow fixed-width panel and get ellipsis-truncated';
  const el = (await fixture(
    html`<lr-widget label=${longText} sublabel=${longText} style="max-inline-size: 8rem;">content</lr-widget>`,
  )) as LyraWidget;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const sublabel = el.shadowRoot!.querySelector('[part="sublabel"]') as HTMLElement;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;

  expect(label.scrollWidth, 'sanity check: label text actually overflows its box').to.be.greaterThan(
    label.clientWidth,
  );
  expect(sublabel.scrollWidth, 'sanity check: sublabel text actually overflows its box').to.be.greaterThan(
    sublabel.clientWidth,
  );
  expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
  expect(getComputedStyle(sublabel).textOverflow).to.equal('ellipsis');
  expect(getComputedStyle(label).whiteSpace).to.equal('nowrap');
  expect(getComputedStyle(sublabel).whiteSpace).to.equal('nowrap');

  // A single line per part (label + sublabel stacked) instead of the header
  // growing to wrap the long text -- each part's rendered height stays
  // within one line-height of its own font-size.
  expect(label.getBoundingClientRect().height).to.be.lessThanOrEqual(
    parseFloat(getComputedStyle(label).fontSize) * 2,
  );
  expect(sublabel.getBoundingClientRect().height).to.be.lessThanOrEqual(
    parseFloat(getComputedStyle(sublabel).fontSize) * 2,
  );
  expect(header).to.exist;
});

it('hides the actions wrapper when no actions content is slotted, shows it once slotted', async () => {
  const el = (await fixture(html`<lr-widget label="x">content</lr-widget>`)) as LyraWidget;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(actions.hasAttribute('hidden')).to.be.true;
  expect(actionsSlot.assignedElements().length).to.equal(0);

  const button = document.createElement('button');
  button.slot = 'actions';
  el.appendChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(actions.hasAttribute('hidden')).to.be.false;
  expect(actionsSlot.assignedElements().length).to.equal(1);

  el.removeChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('renders the actions wrapper visible on first paint when actions content is present before upgrade', async () => {
  const el = (await fixture(
    html`<lr-widget label="x"><button slot="actions">Refresh</button>content</lr-widget>`,
  )) as LyraWidget;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.false;
});

it('does not render the collapse or fullscreen buttons unless opted in', async () => {
  const el = (await fixture(html`<lr-widget label="x">content</lr-widget>`)) as LyraWidget;
  expect(el.shadowRoot!.querySelector('[part="collapse-button"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="fullscreen-button"]')).to.not.exist;
});

it('toggles collapsed on collapse-button click and emits lr-collapse-change', async () => {
  const el = (await fixture(html`<lr-widget label="x" collapsible>content</lr-widget>`)) as LyraWidget;
  let detail: unknown;
  el.addEventListener('lr-collapse-change', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.collapsed).to.be.true;
  expect(detail).to.deep.equal({ collapsed: true });
  expect(el.shadowRoot!.querySelector('[part="body"]')!.hasAttribute('hidden')).to.be.true;
});

it('reflects the collapse-button aria-expanded and aria-label with the collapsed state', async () => {
  const el = (await fixture(html`<lr-widget label="x" collapsible>content</lr-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  expect(btn.getAttribute('aria-expanded')).to.equal('true');
  expect(btn.getAttribute('aria-label')).to.equal('Collapse panel');

  btn.click();
  await el.updateComplete;

  expect(btn.getAttribute('aria-expanded')).to.equal('false');
  expect(btn.getAttribute('aria-label')).to.equal('Expand panel');
});

it('rotates the wrapping [part="collapse-button"] itself, not the inner svg, per the icons.ts rotation contract', async () => {
  // internal/icons.ts documents: "callers needing 'up'/'left'/'open' etc.
  // rotate the wrapping part element via CSS transform: rotate(...), not the svg."
  const el = (await fixture(html`<lr-widget label="x" collapsible>content</lr-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLElement;
  const svgEl = btn.querySelector('svg') as unknown as HTMLElement;

  expect(getComputedStyle(btn).transform).to.not.equal('none');
  expect(getComputedStyle(svgEl).transform).to.equal('none');
});

it('animates the collapse-button rotation via the CSS transition, not an instant snap', async () => {
  const el = (await fixture(html`<lr-widget label="x" collapsible>content</lr-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLElement;

  expect(getComputedStyle(btn).transitionProperty).to.include('transform');
});

it('toggles fullscreen on fullscreen-button click, locking scroll and adding a backdrop', async () => {
  const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.true;
  expect(el.hasAttribute('fullscreen')).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.exist;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.not.exist;
});

it('reflects the fullscreen-button aria-pressed and aria-label with the fullscreen state', async () => {
  const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  expect(btn.getAttribute('aria-pressed')).to.equal('false');
  expect(btn.getAttribute('aria-label')).to.equal('Expand to fullscreen');

  btn.click();
  await el.updateComplete;

  expect(btn.getAttribute('aria-pressed')).to.equal('true');
  expect(btn.getAttribute('aria-label')).to.equal('Exit fullscreen');
});

it('localizes the collapse/fullscreen/view-group aria-labels and the fullscreen dialog fallback via .strings', async () => {
  const el = (await fixture(html`
    <lr-widget
      collapsible
      expandable
      .views=${[{ id: 'chart', ariaLabel: 'Chart view' }]}
      .strings=${{
        dockPanelCollapse: 'Réduire',
        dockPanelExpand: 'Développer',
        widgetExitFullscreen: 'Quitter le plein écran',
        widgetExpandToFullscreen: 'Passer en plein écran',
        widgetViewGroup: 'Vue du panneau',
        widgetFullscreenPanel: 'Panneau plein écran',
      }}
    >
      <div slot="view-chart">chart content</div>
    </lr-widget>
  `)) as LyraWidget;

  expect(el.shadowRoot!.querySelector('[part="view-toggles"]')!.getAttribute('aria-label')).to.equal('Vue du panneau');

  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  expect(collapseBtn.getAttribute('aria-label')).to.equal('Réduire');
  collapseBtn.click();
  await el.updateComplete;
  expect(collapseBtn.getAttribute('aria-label')).to.equal('Développer');

  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  expect(fullscreenBtn.getAttribute('aria-label')).to.equal('Passer en plein écran');
  fullscreenBtn.click();
  await el.updateComplete;
  expect(fullscreenBtn.getAttribute('aria-label')).to.equal('Quitter le plein écran');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Panneau plein écran');
});

it('exits fullscreen on Escape and returns focus to the trigger button', async () => {
  const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  btn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="fullscreen-button"]'));
});

it('exits fullscreen on Escape even when entered by setting the fullscreen property directly (not via the button click)', async () => {
  const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;
  el.fullscreen = true;
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
});

it('exits fullscreen on backdrop click', async () => {
  const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
});

it('releases the scroll lock on disconnect while fullscreen', async () => {
  const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while still fullscreen', async () => {
  const el = (await fixture(html`<lr-widget label="x" expandable>content</lr-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el); // reparenting an already-connected node fires disconnectedCallback then connectedCallback synchronously
  expect(el.fullscreen).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');

  otherContainer.remove();
});

it('is accessible in both default and fullscreen-expandable states', async () => {
  const el = (await fixture(
    html`<lr-widget label="Load profile" collapsible expandable>content</lr-widget>`,
  )) as LyraWidget;
  await expect(el).to.be.accessible();

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  await expect(el).to.be.accessible();
});

it('marks the fullscreen panel with dialog semantics and clears them on exit', async () => {
  const el = (await fixture(
    html`<lr-widget label="Load profile" expandable>content</lr-widget>`,
  )) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('role')).to.be.false;
  expect(base.hasAttribute('aria-modal')).to.be.false;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.getAttribute('role')).to.equal('dialog');
  expect(base.getAttribute('aria-modal')).to.equal('true');
  expect(base.getAttribute('aria-label')).to.equal('Load profile');

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.hasAttribute('role')).to.be.false;
  expect(base.hasAttribute('aria-modal')).to.be.false;
});

it('falls back to a generic aria-label for the fullscreen dialog when no label is set', async () => {
  const el = (await fixture(html`<lr-widget expandable>content</lr-widget>`)) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.getAttribute('aria-label')).to.equal('Fullscreen panel');
});

it('names the fullscreen dialog from a slotted label, not just the label attribute', async () => {
  const el = (await fixture(html`
    <lr-widget expandable><span slot="label">Energy production</span>content</lr-widget>
  `)) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.getAttribute('aria-label')).to.equal('Energy production');
});

it('lets a host aria-label override both label and a slotted label for the fullscreen dialog name', async () => {
  const el = (await fixture(html`
    <lr-widget expandable aria-label="Override" label="attr"><span slot="label">rich</span>content</lr-widget>
  `)) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.getAttribute('aria-label')).to.equal('Override');
});

it('mirrors the collapsed collapse-button chevron under RTL', async () => {
  const el = (await fixture(html`
    <lr-widget dir="rtl" collapsible collapsed>content</lr-widget>
  `)) as LyraWidget;
  const button = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLElement;
  expect(getComputedStyle(button).transform).to.contain('matrix(-1');
});

it('traps Tab focus inside the fullscreen panel, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lr-widget label="x" collapsible expandable>content</lr-widget>`,
  )) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;

  fullscreenBtn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  // fullscreen-button is the last focusable (no slotted actions/body content
  // here); Tab from it must wrap to the first, collapse-button.
  fullscreenBtn.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  await el.updateComplete;
  expect(tabForward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(collapseBtn);

  // Shift+Tab from the first focusable must wrap to the last.
  const tabBackward = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabBackward);
  await el.updateComplete;
  expect(tabBackward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(fullscreenBtn);
});

it('traps Tab/Shift+Tab at a slotted element whose focusable target lives in its own shadow root', async () => {
  const el = (await fixture(
    html`<lr-widget label="x" expandable>
      <widget-test-shadow-input slot="actions"></widget-test-shadow-input>
      content
    </lr-widget>`,
  )) as LyraWidget;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  fullscreenBtn.click();
  await el.updateComplete;

  const shadowHost = el.querySelector('widget-test-shadow-input') as WidgetTestShadowInput;
  const input = shadowHost.shadowRoot!.querySelector('input') as HTMLInputElement;

  // The shadow input is the first focusable element; Shift+Tab from it must
  // wrap to the last (the fullscreen button), not leak past the widget.
  input.focus();
  const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(shiftTab);
  await el.updateComplete;
  expect(shiftTab.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(fullscreenBtn);

  // Tab from the last focusable (fullscreen button) must wrap back to the
  // shadow input.
  fullscreenBtn.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  await el.updateComplete;
  expect(tabForward.defaultPrevented).to.be.true;
  expect(shadowHost.shadowRoot!.activeElement).to.equal(input);
});

it('prevents Tab from doing anything when fullscreen has no focusable elements at all', async () => {
  const el = (await fixture(html`<lr-widget label="x">content</lr-widget>`)) as LyraWidget;
  el.fullscreen = true;
  await el.updateComplete;

  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.true;
});

it('does not intercept a forward Tab press that is not leaving the last focusable element', async () => {
  const el = (await fixture(
    html`<lr-widget label="x" collapsible expandable>content</lr-widget>`,
  )) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  collapseBtn.focus();
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.false;
});

it("excludes a collapsed body's slotted focusable content from the fullscreen tab trap", async () => {
  const el = (await fixture(
    html`<lr-widget label="x" collapsible collapsed expandable><button>inner</button></lr-widget>`,
  )) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;

  fullscreenBtn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  // The slotted button lives in the collapsed (display:none) body, so
  // fullscreen-button must be the last focusable element -- Tab from it
  // wraps to collapse-button, not to the hidden slotted button.
  fullscreenBtn.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  await el.updateComplete;
  expect(tabForward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(collapseBtn);
});

it('reclaims focus inside the fullscreen panel when collapsing hides the currently focused body content', async () => {
  const el = (await fixture(
    html`<lr-widget label="x" collapsible expandable><button id="inner">inner</button></lr-widget>`,
  )) as LyraWidget;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;

  fullscreenBtn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  const inner = el.querySelector('#inner') as HTMLButtonElement;
  inner.focus();
  expect((el.shadowRoot!.activeElement ?? document.activeElement) === inner).to.be.true;

  el.collapsed = true;
  await el.updateComplete;

  // Focus must land on a still-connected focusable element inside the
  // shadow root (the collapse-button, the first focusable in this case)
  // rather than escaping the modal focus trap out to document.body. (Boolean
  // comparisons rather than direct chai `.to.equal(domNode)` here -- this
  // test environment can hang trying to build a failure diff for two DOM
  // element references, so failures must resolve through a plain boolean.)
  expect(document.activeElement !== document.body).to.be.true;
  expect(el.shadowRoot!.activeElement === collapseBtn).to.be.true;
});

it('moves focus into the panel when fullscreen is entered', async () => {
  const el = (await fixture(
    html`<lr-widget label="x" collapsible expandable>content</lr-widget>`,
  )) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;

  el.fullscreen = true;
  await el.updateComplete;

  // collapse-button is the first focusable element (no actions slotted);
  // entering fullscreen must move focus there even though nothing was
  // clicked to trigger it.
  expect(el.shadowRoot!.activeElement).to.equal(collapseBtn);
});

it('focuses the panel base as a fallback when fullscreen has no focusable elements', async () => {
  const el = (await fixture(html`<lr-widget label="x">content</lr-widget>`)) as LyraWidget;

  el.fullscreen = true;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="base"]'));
});

it('links the collapse-button to the body region it controls via aria-controls', async () => {
  const el = (await fixture(html`<lr-widget label="x" collapsible>content</lr-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

  expect(btn.getAttribute('aria-controls')).to.equal(body.id);
  expect(body.id).to.not.equal('');
});

it('does not intercept Tab when not fullscreen', async () => {
  const el = (await fixture(html`<lr-widget label="x" collapsible>content</lr-widget>`)) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  collapseBtn.focus();

  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.false;
});

it('exposes the fullscreen scrim color as a retheme-able custom property', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('--lr-widget-overlay-color: var(--lr-color-overlay)');
  expect(css).to.include('background: var(--lr-widget-overlay-color)');
});

it('actually paints the rendered fullscreen backdrop with the resolved --lr-widget-overlay-color', async () => {
  const el = (await fixture(
    html`<lr-widget expandable fullscreen label="x"><p>Body</p></lr-widget>`,
  )) as LyraWidget;
  const backdrop = el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement;

  // Resolve --lr-color-overlay the same way the browser would, inside the
  // same shadow root the token cascades through -- avoids hardcoding a
  // specific color so this stays valid across themes.
  const probe = document.createElement('span');
  probe.style.color = 'var(--lr-color-overlay)';
  el.shadowRoot!.appendChild(probe);
  const expected = getComputedStyle(probe).color;
  probe.remove();

  const actual = getComputedStyle(backdrop).backgroundColor;
  expect(actual).to.not.equal('rgba(0, 0, 0, 0)');
  expect(actual).to.equal(expected);
});

it('disables the collapse/fullscreen icon rotate transition under reduced motion', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('transition: transform var(--lr-transition-fast);');
  expect(css).to.include(
    "@media (prefers-reduced-motion: reduce) { [part='collapse-button'], [part='fullscreen-button'] { transition: none !important; } }",
  );
});

it("gives view-toggle's resting state a hover, without changing the pressed state's own styling", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='view-toggle'\]:hover(?!\[)/);
});

it('applies a custom fullscreen-inset while fullscreen', async () => {
  const el = (await fixture(
    html`<lr-widget expandable fullscreen fullscreen-inset="0 0 0 240px"><p>Body</p></lr-widget>`,
  )) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.getPropertyValue('--lr-widget-fullscreen-inset')).to.equal('0 0 0 240px');
});

it('falls back to the default inset when fullscreen-inset is unset', async () => {
  const el = (await fixture(
    html`<lr-widget expandable fullscreen><p>Body</p></lr-widget>`,
  )) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.getPropertyValue('--lr-widget-fullscreen-inset')).to.equal('');
});

it('reflects the compact attribute', async () => {
  const el = (await fixture(html`<lr-widget compact><p>Body</p></lr-widget>`)) as LyraWidget;
  expect(el.hasAttribute('compact')).to.be.true;
});

it('applies tighter header/body padding when compact', async () => {
  const normal = (await fixture(
    html`<lr-widget label="x"><p>Body</p></lr-widget>`,
  )) as LyraWidget;
  const compact = (await fixture(
    html`<lr-widget label="x" compact><p>Body</p></lr-widget>`,
  )) as LyraWidget;

  expect(compact.hasAttribute('compact')).to.be.true;

  const normalHeader = normal.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const compactHeader = compact.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const normalBody = normal.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  const compactBody = compact.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

  const normalHeaderStyle = getComputedStyle(normalHeader);
  const compactHeaderStyle = getComputedStyle(compactHeader);
  const normalBodyStyle = getComputedStyle(normalBody);
  const compactBodyStyle = getComputedStyle(compactBody);

  // The compact `--lr-space-xs`/`--lr-space-s` padding renders strictly
  // smaller than the default `--lr-space-s`/`--lr-space-m` padding.
  expect(
    parseFloat(compactHeaderStyle.paddingBlockStart),
    'compact header padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalHeaderStyle.paddingBlockStart));
  expect(
    parseFloat(compactHeaderStyle.paddingInlineStart),
    'compact header padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalHeaderStyle.paddingInlineStart));
  expect(
    parseFloat(compactBodyStyle.paddingBlockStart),
    'compact body padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalBodyStyle.paddingBlockStart));
  expect(
    parseFloat(compactBodyStyle.paddingInlineStart),
    'compact body padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalBodyStyle.paddingInlineStart));
  // The header's icon-to-title gap must shrink alongside its padding -- a
  // compact header that keeps the non-compact gap looks disproportionately
  // loose despite its tighter outer padding.
  expect(
    parseFloat(compactHeaderStyle.columnGap),
    'compact header gap should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalHeaderStyle.columnGap));
});

describe('backdrop-inset', () => {
  it('backdrop inset falls back to fullscreen-inset when unset', async () => {
    const el = (await fixture(
      html`<lr-widget expandable fullscreen-inset="0px 0px 0px 240px" fullscreen></lr-widget>`,
    )) as LyraWidget;
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(backdrop).inset).to.equal(getComputedStyle(base).inset);
  });

  it('decouples backdrop inset from fullscreen-inset when backdrop-inset is set', async () => {
    const el = (await fixture(
      html`<lr-widget
        expandable
        fullscreen-inset="0px 0px 0px 240px"
        backdrop-inset="0px"
        fullscreen
      ></lr-widget>`,
    )) as LyraWidget;
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(backdrop).inset).to.not.equal(getComputedStyle(base).inset);
  });
});

describe('storage-key persistence', () => {
  it('persists and restores collapsed via storage-key', async () => {
    const key = `lr-test-widget-${Math.random()}`;
    const el = await fixture<LyraWidget>(html`<lr-widget storage-key=${key} collapsible></lr-widget>`);
    el.collapsed = true;
    await el.updateComplete;
    el.remove();

    const restored = await fixture<LyraWidget>(html`<lr-widget storage-key=${key} collapsible></lr-widget>`);
    expect(restored.collapsed).to.be.true;
    localStorage.removeItem(`lr-widget:${key}`);
  });

  it('writes nothing to storage when storage-key is unset (unset-regression)', async () => {
    const before = localStorage.length;
    const el = await fixture<LyraWidget>(html`<lr-widget collapsible></lr-widget>`);
    el.collapsed = true;
    await el.updateComplete;
    expect(localStorage.length).to.equal(before);
  });
});

describe('view-toggle active-state cssprops', () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset defaults byte-for-byte against
   *  the tokens they fall back to. */
  function resolvedInShadow(el: LyraWidget, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  const overrides =
    '--lr-widget-view-toggle-active-bg: rgb(0, 51, 102); --lr-widget-view-toggle-active-color: rgb(255, 255, 255);';

  async function themed(style: string): Promise<LyraWidget> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-widget label="Usage" .views=${[{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }]}>
          <div slot="view-chart">chart</div>
          <div slot="view-table">table</div>
        </lr-widget>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-widget') as LyraWidget;
    await el.updateComplete;
    return el;
  }

  it('recolors the pressed view toggle from an ancestor, not a :host-declared prop', async () => {
    const el = await themed(overrides);
    const pressed = el.shadowRoot!.querySelector('[part="view-toggle"][aria-pressed="true"]') as HTMLElement;
    expect(pressed).to.exist;
    expect(getComputedStyle(pressed).backgroundColor).to.equal('rgb(0, 51, 102)');
    expect(getComputedStyle(pressed).color).to.equal('rgb(255, 255, 255)');
    // The unpressed toggle keeps its transparent resting treatment -- the props are scoped to
    // [aria-pressed='true'] only.
    const unpressed = el.shadowRoot!.querySelector('[part="view-toggle"][aria-pressed="false"]') as HTMLElement;
    expect(getComputedStyle(unpressed).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('renders byte-identically to the pre-cssprop output when the props are unset', async () => {
    const el = await themed('');
    const pressed = el.shadowRoot!.querySelector('[part="view-toggle"][aria-pressed="true"]') as HTMLElement;
    expect(getComputedStyle(pressed).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
    expect(getComputedStyle(pressed).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-brand)', 'color'));
  });

  it('is accessible with the active-state props themed', async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});
