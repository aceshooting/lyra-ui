import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './widget.js';
import type { LyraWidget } from './widget.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';

describe('lr-widget interactions', () => {
  it('names an icon-only view toggle from its fallback when the label is whitespace', async () => {
    const el = await fixture<LyraWidget>(html`<lr-widget></lr-widget>`);
    el.views = [
      { viewId: 'chart', label: '   ', ariaLabel: '  ' },
      { viewId: 'table', label: 'Table' },
    ];
    await el.updateComplete;
    const [chart, table] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="view-toggle"]')];
    expect(chart!.getAttribute('aria-label')).to.equal('chart');
    expect(chart!.querySelector('[part="view-label"]') === null).to.equal(true);
    expect(table!.getAttribute('aria-label') === null).to.equal(true);
  });

  it('keeps focus in the widget when the body that held it collapses', async () => {
    const el = await fixture<LyraWidget>(html`<lr-widget collapsible label="Panel"
      ><button id="inner">Inner</button></lr-widget
    >`);
    const inner = el.querySelector<HTMLElement>('#inner')!;
    await focusByKeyboard(inner);
    expect(deepActiveElementIn(document) === inner).to.equal(true);
    el.collapsed = true;
    await el.updateComplete;
    await waitUntil(
      () => deepActiveElementIn(document) === el.shadowRoot!.querySelector('[part="collapse-button"]'),
      'focus moves to the collapse button',
    );
  });

  it('draws the view toggle focus ring inside its clipping row', async () => {
    const el = await fixture<LyraWidget>(html`<lr-widget></lr-widget>`);
    el.views = [{ viewId: 'a', label: 'A' }, { viewId: 'b', label: 'B' }];
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector<HTMLElement>('[part="view-toggle"]')!;
    await focusByKeyboard(toggle);
    expect(parseFloat(getComputedStyle(toggle).outlineOffset) < 0).to.equal(true);
  });

  it('leaves room around slotted header actions for their focus ring', async () => {
    const el = await fixture<LyraWidget>(html`<lr-widget label="W"><button slot="actions">Act</button></lr-widget>`);
    const actions = el.shadowRoot!.querySelector<HTMLElement>('[part="actions"]')!;
    const button = el.querySelector<HTMLElement>('button')!;
    const ring = parseFloat(getComputedStyle(el).getPropertyValue('--lr-focus-ring-width')) || 3;
    const room = button.getBoundingClientRect().top - actions.getBoundingClientRect().top;
    expect(room >= ring, 'actions row extends past the button by the ring width').to.equal(true);
  });

  it('marks the pressed view toggle with a system outline under forced colors', async () => {
    const el = await fixture<LyraWidget>(html`<lr-widget></lr-widget>`);
    el.views = [{ viewId: 'a', label: 'A' }, { viewId: 'b', label: 'B' }];
    el.activeViewId = 'a';
    await el.updateComplete;
    await setForcedColors('active');
    try {
      expect(matchMedia('(forced-colors: active)').matches).to.equal(true);
      const [pressed, resting] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="view-toggle"]')];
      expect(getComputedStyle(pressed!).outlineStyle).to.equal('solid');
      expect(getComputedStyle(resting!).outlineStyle).to.equal('none');
    } finally {
      await setForcedColors('none');
    }
  });

  it('reflects the host aria-describedby onto the fullscreen dialog', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div
      ><p id="note">Explains the panel</p
      ><lr-widget expandable label="W" aria-describedby="note" fullscreen>Body</lr-widget></div
    >`);
    const el = wrapper.querySelector<LyraWidget>('lr-widget')!;
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector<HTMLElement>('[part="base"][role="dialog"], [data-native-modal-carrier]')!;
    const described = dialog.ariaDescribedByElements ?? [];
    expect(described.length === 1 && described[0] === wrapper.querySelector('#note')).to.equal(true);
  });
});

it('preserves an explicit fullscreen write by a request listener', async () => {
  const el = await fixture<LyraWidget>(html`<lr-widget expandable label="Panel">Body</lr-widget>`);
  let commits = 0;
  el.addEventListener('lr-fullscreen-request', () => { el.fullscreen = false; });
  el.addEventListener('lr-fullscreen-change', () => commits++);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="fullscreen-button"]')!.click();
  await el.updateComplete;
  expect(el.fullscreen).to.equal(false);
  expect(commits).to.equal(0);
});

it('inherits widget surface and spacing overrides', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="--lr-widget-bg: rgb(1, 2, 3); --lr-widget-border-color: rgb(4, 5, 6); --lr-widget-radius: 13px; --lr-widget-header-padding: 19px; --lr-widget-body-padding: 21px; --lr-widget-gap: 15px">
    <lr-widget label="Sales"></lr-widget>
  </div>`);
  const el = wrapper.querySelector('lr-widget')!;
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).borderTopColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).borderTopLeftRadius).to.equal('13px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="header"]')!).paddingTop).to.equal('19px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="body"]')!).paddingTop).to.equal('21px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="header"]')!).columnGap).to.equal('15px');
});

it('accepts a programmatic accessibleLabel on the base', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-widget']>(html`<lr-widget expandable fullscreen>Body</lr-widget>`);
  el.accessibleLabel = 'Quarterly results';
  await el.updateComplete;
  const owner = el.shadowRoot!.querySelector('[part~="base"]')!;
  expect(owner.getAttribute('aria-label')).to.equal('Quarterly results');
});

it('distinguishes a descendant view change from the widget view change by event target', async () => {
  const el = await fixture<LyraWidget>(html`<lr-widget><span>Content</span></lr-widget>`);
  el.views = [{ viewId: 'chart', label: 'Chart' }, { viewId: 'table', label: 'Table' }];
  await el.updateComplete;
  const views: string[] = [];
  el.addEventListener('lr-view-change', (event) => {
    if (event.target === el) views.push(event.detail.viewId);
  });
  el.querySelector('span')!.dispatchEvent(new CustomEvent('lr-view-change', { bubbles: true, detail: { month: 1 } }));
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-view-id="table"]')!.click();
  expect(views).to.deep.equal(['table']);
});
