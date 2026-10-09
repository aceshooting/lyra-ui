import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import '../components/overlays/overlay/popover.js';
import '../components/overlays/overlay/dropdown.js';
import '../components/overlays/overlay/tooltip.js';
import '../components/overlays/popup/popup.js';
import '../components/layout/menu/dropdown-item.js';
import '../components/forms/select/select.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/combobox/option.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/input/time-input.js';

/**
 * One adapter per anchored surface: the same contract -- promoted when trapped, hit-testable
 * outside the trap, UA [popover] rules neutralised, aligned under a right-to-left root, released
 * once it settles closed, never promoted outside a trap -- for every surface the anchored-overlay
 * runtime places.
 */
interface SurfaceAdapter {
  name: string;
  markup: () => TemplateResult;
  open(host: HTMLElement): Promise<void> | void;
  placed(host: HTMLElement): HTMLElement;
  close(host: HTMLElement): Promise<void> | void;
}

type Openable = HTMLElement & { show(): Promise<void> | void; hide(...args: unknown[]): Promise<void> | void; open: boolean };

const shadowPart = (host: HTMLElement, selector: string): HTMLElement =>
  host.shadowRoot!.querySelector<HTMLElement>(selector)!;

const showHost = (host: HTMLElement) => (host as Openable).show();
const hideHost = (host: HTMLElement) => (host as Openable).hide();

const adapters: SurfaceAdapter[] = [
  {
    name: 'lr-popover',
    markup: () => html`<lr-popover style="--lr-transition-fast:0ms"
      ><button slot="trigger">Open</button><p style="margin:0; block-size:120px">Details</p></lr-popover
    >`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part~="popup"]'),
    close: (host) => (host as Openable).hide({ focusTrigger: false }),
  },
  {
    name: 'lr-dropdown',
    markup: () => html`<lr-dropdown hoist style="--lr-transition-fast:0ms"
      ><button slot="trigger">Actions</button
      ><lr-dropdown-item value="a">Alpha</lr-dropdown-item
      ><lr-dropdown-item value="b">Beta</lr-dropdown-item
      ><lr-dropdown-item value="c">Gamma</lr-dropdown-item></lr-dropdown
    >`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part~="popup"]'),
    close: (host) => (host as Openable).hide({ focusTrigger: false }),
  },
  {
    name: 'lr-tooltip',
    markup: () => html`<lr-tooltip positioning-strategy="fixed" placement="bottom" style="--lr-transition-fast:0ms"
      ><button slot="trigger">Hint</button><span style="display:block; block-size:80px">Tip</span></lr-tooltip
    >`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part~="popup"]'),
    close: hideHost,
  },
  {
    name: 'lr-select',
    markup: () => html`<lr-select label="Pick" positioning-strategy="fixed"
      ><lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option
      ><lr-option value="c">Gamma</lr-option></lr-select
    >`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part="listbox"]'),
    close: hideHost,
  },
  {
    name: 'lr-combobox',
    markup: () => html`<lr-combobox label="Search"
      ><lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option
      ><lr-option value="c">Gamma</lr-option></lr-combobox
    >`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part~="listbox"]'),
    close: hideHost,
  },
  {
    name: 'lr-color-picker',
    markup: () => html`<lr-color-picker label="Accent" positioning-strategy="fixed"></lr-color-picker>`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part~="panel"]'),
    close: hideHost,
  },
  {
    name: 'lr-date-input',
    markup: () => html`<lr-date-input label="Date"></lr-date-input>`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part="popup"]'),
    close: (host) => (host as Openable).hide(false),
  },
  {
    name: 'lr-time-input',
    markup: () => html`<lr-time-input label="Time"></lr-time-input>`,
    open: showHost,
    placed: (host) => shadowPart(host, '[part="popup"]'),
    close: hideHost,
  },
];

const TRAP = 'transform: translateY(0); overflow: hidden; block-size: 60px; margin-block-start: 24px';

async function mount(adapter: SurfaceAdapter, trapped: boolean): Promise<{ wrapper: HTMLElement; host: HTMLElement }> {
  const wrapper = await fixture<HTMLElement>(html`<div style=${trapped ? TRAP : ''}>${adapter.markup()}</div>`);
  const host = wrapper.firstElementChild as HTMLElement;
  await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  return { wrapper, host };
}

async function openPlaced(adapter: SurfaceAdapter, host: HTMLElement): Promise<HTMLElement> {
  await adapter.open(host);
  let placed: HTMLElement | null = null;
  await waitUntil(() => {
    placed = adapter.placed(host);
    return placed !== null && placed.style.left !== '' && placed.getBoundingClientRect().height > 0;
  }, `${adapter.name} is placed`);
  return placed!;
}

async function settleClosed(adapter: SurfaceAdapter, host: HTMLElement, placed: HTMLElement): Promise<void> {
  await adapter.close(host);
  await waitUntil(() => !placed.isConnected || placed.hidden || getComputedStyle(placed).display === 'none', `${adapter.name} settles closed`);
}

const parityProperties = ['padding-top', 'border-top-width', 'color', 'background-color'] as const;

for (const adapter of adapters) {
  describe(`${adapter.name} top-layer escape`, () => {
    afterEach(() => document.documentElement.removeAttribute('dir'));

    it('is promoted when trapped, hit-testable outside the trap, styled as unpromoted, and released on close', async () => {
      const reference = await mount(adapter, false);
      const referencePlaced = await openPlaced(adapter, reference.host);
      expect(referencePlaced.matches(':popover-open'), 'outside any trap it is never promoted').to.equal(false);
      expect(referencePlaced.hasAttribute('data-lr-top-layer')).to.equal(false);
      const expected = Object.fromEntries(
        parityProperties.map((property) => [property, getComputedStyle(referencePlaced).getPropertyValue(property)]),
      );
      await settleClosed(adapter, reference.host, referencePlaced);
      reference.wrapper.remove();

      const { wrapper, host } = await mount(adapter, true);
      const placed = await openPlaced(adapter, host);
      await waitUntil(() => placed.matches(':popover-open'), `${adapter.name} is promoted`);
      const actual = Object.fromEntries(
        parityProperties.map((property) => [property, getComputedStyle(placed).getPropertyValue(property)]),
      );
      expect(actual, 'the UA [popover] rules do not leak').to.deep.equal(expected);
      const trapRect = wrapper.getBoundingClientRect();
      const rect = placed.getBoundingClientRect();
      const x = rect.left + Math.min(rect.width / 2, 20);
      const y = Math.max(rect.top, trapRect.bottom) + Math.min(8, Math.max(1, (rect.bottom - trapRect.bottom) / 2));
      expect(rect.bottom, 'the placed element extends past the trap').to.be.greaterThan(trapRect.bottom);
      const path: Element[] = [];
      let current = document.elementFromPoint(x, y);
      while (current && !path.includes(current)) {
        path.push(current);
        current = current.shadowRoot?.elementFromPoint(x, y) ?? null;
      }
      // Slotted content hit-tests as its light-DOM node, so the host's light tree counts too.
      const reached = path.some((node) => node === placed || placed.contains(node) || host.contains(node));
      expect(reached, 'a point outside the trap reaches the surface').to.equal(true);
      await settleClosed(adapter, host, placed);
      await waitUntil(() => !placed.hasAttribute('popover'), `${adapter.name} is released`);
      expect(placed.hasAttribute('data-lr-top-layer')).to.equal(false);
      expect(placed.style.getPropertyValue('zoom')).to.equal('');
    });

    it('keeps the written left and its width under a right-to-left root', async () => {
      const reference = await mount(adapter, false);
      const referencePlaced = await openPlaced(adapter, reference.host);
      const width = referencePlaced.getBoundingClientRect().width;
      await settleClosed(adapter, reference.host, referencePlaced);
      reference.wrapper.remove();

      document.documentElement.dir = 'rtl';
      try {
        const { host } = await mount(adapter, true);
        const placed = await openPlaced(adapter, host);
        await waitUntil(() => placed.matches(':popover-open'));
        await waitUntil(
          () => Math.abs(placed.getBoundingClientRect().left - parseFloat(placed.style.left)) < 0.5,
          'the UA inset does not discard the written left',
        );
        expect(placed.getBoundingClientRect().width).to.be.closeTo(width, 0.5);
        await settleClosed(adapter, host, placed);
      } finally {
        document.documentElement.removeAttribute('dir');
      }
    });
  });
}
