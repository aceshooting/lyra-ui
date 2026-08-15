import { expect } from '@open-wc/testing';
import { composedContains, deepActiveElement } from './overlay-manager.js';
import '../components/overlays/dialog/dialog.js';
import '../components/overlays/drawer/drawer.js';
import '../components/layout/responsive-panel/responsive-panel.js';
import '../components/agent-tools/tool-select-dialog/tool-select-dialog.js';
import '../components/agent-tools/tool-approval-dialog/tool-approval-dialog.js';
import '../components/agent-tools/tool-result-dialog/tool-result-dialog.js';
import '../components/layout/app-rail/app-rail.js';
import '../components/layout/command-palette/command-palette.js';
import '../components/layout/multi-split/multi-split.js';
import '../components/layout/widget/widget.js';
import '../components/forms/date-picker/date-input.js';
import '../components/media/lightbox/lightbox.js';
import '../components/utility/tour/tour.js';
import type { LyraLightboxImage } from '../components/media/lightbox/lightbox.class.js';

interface ReactiveOverlay extends HTMLElement {
  updateComplete: Promise<unknown>;
  open?: boolean;
  fullscreen?: boolean;
  mode?: string;
  label?: string;
  toolName?: string;
  expandable?: boolean;
  images?: LyraLightboxImage[];
  commands?: Array<{ commandId: string; label: string }>;
  collapse?: string;
  collapseState?: string;
  steps?: Array<{ id: string; target: string; heading: string; content: string }>;
}

const lightboxImage: LyraLightboxImage = {
  src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="%230969da"/%3E%3C/svg%3E',
  alt: 'Blue square',
};

interface OverlayAdapter {
  tag: string;
  setup?(element: ReactiveOverlay): void;
  activate(element: ReactiveOverlay): void;
  deactivate(element: ReactiveOverlay): void;
}

const adapters: OverlayAdapter[] = [
  {
    tag: 'lr-dialog',
    setup: (element) => (element.label = 'Dialog'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-drawer',
    setup: (element) => (element.label = 'Drawer'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-responsive-panel',
    setup: (element) => {
      element.mode = 'overlay';
      element.label = 'Panel';
    },
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-tool-select-dialog',
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-tool-approval-dialog',
    setup: (element) => (element.toolName = 'run'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-tool-result-dialog',
    setup: (element) => (element.toolName = 'run'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-app-rail',
    // `mode` is read-only since 9.0 (see `forceMode`, which has no equivalent for `'mobile'` --
    // the mobile breakpoint is always tracked automatically). Force the real matchMedia() query
    // to resolve mobile deterministically instead, via the already-public `mobileBreakpoint`.
    setup: (element) => (element.mobileBreakpoint = '99999px'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-command-palette',
    setup: (element) => (element.commands = [{ commandId: 'command', label: 'Command' }]),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-multi-split',
    setup: (element) => {
      element.collapse = 'start';
      element.collapseState = 'floating';
      element.style.inlineSize = '20rem';
      element.style.blockSize = '12rem';
      element.append(document.createElement('div'), document.createElement('div'));
    },
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-widget',
    setup: (element) => {
      element.label = 'Widget';
      element.expandable = true;
    },
    activate: (element) => (element.fullscreen = true),
    deactivate: (element) => (element.fullscreen = false),
  },
  {
    tag: 'lr-lightbox',
    setup: (element) => (element.images = [lightboxImage]),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lr-tour',
    setup: (element) =>
      (element.steps = [{ id: 'step', target: '#missing-tour-target', heading: 'Tour', content: 'Step' }]),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
];

function create(adapter: OverlayAdapter): ReactiveOverlay {
  const element = document.createElement(adapter.tag) as ReactiveOverlay;
  element.dataset.overlayTest = adapter.tag;
  adapter.setup?.(element);
  document.body.append(element);
  return element;
}

afterEach(async () => {
  document.querySelectorAll('[data-overlay-test], [data-overlay-trigger]').forEach((element) => element.remove());
  await Promise.resolve();
  await Promise.resolve();
});

async function waitForCondition(read: () => boolean, message: string): Promise<void> {
  const started = performance.now();
  while (!read()) {
    if (performance.now() - started > 2000) throw new Error(`Timed out waiting for ${message}`);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

for (const adapter of adapters) {
  it(`${adapter.tag} releases and restores modal resources when CSS removes and restores its layout box`, async () => {
    const element = create(adapter);
    adapter.activate(element);
    await element.updateComplete;
    await waitForCondition(
      () => document.documentElement.style.overflow === 'hidden',
      `${adapter.tag} to acquire its scroll lock`,
    );
    expect(element.open ?? element.fullscreen).to.be.true;

    element.style.display = 'none';
    await waitForCondition(
      () => document.documentElement.style.overflow !== 'hidden',
      `${adapter.tag} to release its scroll lock while hidden`,
    );
    expect(element.open ?? element.fullscreen).to.be.true;

    element.style.display = '';
    await waitForCondition(
      () => document.documentElement.style.overflow === 'hidden',
      `${adapter.tag} to restore its scroll lock when rendered`,
    );
    expect(element.open ?? element.fullscreen).to.be.true;

    adapter.deactivate(element);
    await element.updateComplete;
    await waitForCondition(
      () => document.documentElement.style.overflow !== 'hidden',
      `${adapter.tag} to release its final scroll lock`,
    );
  });
}

for (let index = 0; index < adapters.length; index++) {
  const bottomAdapter = adapters[index];
  const topAdapter = adapters[(index + 1) % adapters.length];
  it(`routes one Escape only to topmost ${topAdapter.tag} above ${bottomAdapter.tag}`, async () => {
    const bottom = create(bottomAdapter);
    bottomAdapter.activate(bottom);
    await bottom.updateComplete;
    const top = create(topAdapter);
    topAdapter.activate(top);
    await top.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await bottom.updateComplete;
    await top.updateComplete;

    expect(top.open ?? top.fullscreen).to.be.false;
    expect(bottom.open ?? bottom.fullscreen).to.be.true;
    bottomAdapter.deactivate(bottom);
    await bottom.updateComplete;
  });
}

it('ignores a backdrop belonging to an overlay underneath the topmost overlay', async () => {
  const bottomAdapter = adapters[0];
  const topAdapter = adapters[1];
  const bottom = create(bottomAdapter);
  bottomAdapter.activate(bottom);
  await bottom.updateComplete;
  const top = create(topAdapter);
  topAdapter.activate(top);
  await top.updateComplete;

  (bottom.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement).click();
  await bottom.updateComplete;
  await top.updateComplete;

  expect(bottom.open).to.be.true;
  expect(top.open).to.be.true;
  topAdapter.deactivate(top);
  bottomAdapter.deactivate(bottom);
  await top.updateComplete;
  await bottom.updateComplete;
});

for (const adapter of adapters) {
  it(`${adapter.tag} restores its opener after direct state closure`, async () => {
    const trigger = document.createElement('button');
    trigger.dataset.overlayTrigger = adapter.tag;
    document.body.append(trigger);
    trigger.focus();
    const element = create(adapter);
    adapter.activate(element);
    await element.updateComplete;

    adapter.deactivate(element);
    await element.updateComplete;

    expect(document.activeElement?.getAttribute('data-overlay-trigger')).to.equal(adapter.tag);
  });
}

const reconnectAdapters = adapters.filter(({ tag }) =>
  [
    'lr-dialog',
    'lr-tool-select-dialog',
    'lr-tool-approval-dialog',
    'lr-tool-result-dialog',
    'lr-lightbox',
  ].includes(tag),
);

for (const adapter of reconnectAdapters) {
  it(`${adapter.tag} restores focus inside after synchronous reparenting`, async () => {
    const element = create(adapter);
    adapter.activate(element);
    await element.updateComplete;
    expect(composedContains(element, deepActiveElement(document))).to.be.true;

    const destination = document.createElement('div');
    destination.dataset.overlayTest = 'reparent-target';
    document.body.append(destination);
    destination.append(element);
    await Promise.resolve();

    expect(composedContains(element, deepActiveElement(document))).to.be.true;
  });
}

it('moves outside focus into a responsive panel when an open inline panel becomes modal', async () => {
  const trigger = document.createElement('button');
  trigger.dataset.overlayTrigger = 'responsive-transition';
  document.body.append(trigger);
  trigger.focus();
  const adapter = adapters[1];
  const panel = document.createElement(adapter.tag) as ReactiveOverlay;
  panel.dataset.overlayTest = adapter.tag;
  panel.mode = 'inline';
  panel.label = 'Panel';
  panel.open = true;
  panel.innerHTML = '<button data-inside>Inside</button>';
  document.body.append(panel);
  await panel.updateComplete;

  panel.mode = 'overlay';
  await panel.updateComplete;

  expect(document.activeElement?.getAttribute('data-overlay-trigger')).to.not.equal('responsive-transition');
  expect(document.activeElement?.getAttribute('data-inside')).to.equal('');
  panel.open = false;
  await panel.updateComplete;
  expect(document.activeElement?.getAttribute('data-overlay-trigger')).to.equal('responsive-transition');
});

it('returns focus to the date popup opener after a calendar selection hides the focused day', async () => {
  const element = document.createElement('lr-date-input') as ReactiveOverlay;
  element.dataset.overlayTest = 'lr-date-input';
  document.body.append(element);
  await element.updateComplete;
  const expand = element.shadowRoot!.querySelector('[part="expand-button"]') as HTMLButtonElement;
  expand.focus();
  expand.click();
  await element.updateComplete;
  const picker = element.shadowRoot!.querySelector('lr-date-picker') as ReactiveOverlay;
  await picker.updateComplete;
  const day = picker.shadowRoot!.querySelector('[part~="day"][tabindex="0"]') as HTMLButtonElement;
  day.focus();
  (picker as ReactiveOverlay & { value: string }).value = '2026-07-15';
  picker.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  await element.updateComplete;

  expect(element.open).to.be.false;
  expect(deepActiveElement(document)?.getAttribute('part')).to.equal('expand-button');
});

it('returns Escape focus to the text input that opened the date popup with Alt+ArrowDown', async () => {
  const element = document.createElement('lr-date-input') as ReactiveOverlay;
  element.dataset.overlayTest = 'lr-date-input';
  document.body.append(element);
  await element.updateComplete;
  const input = element.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.focus();
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, composed: true, cancelable: true }),
  );
  await element.updateComplete;
  const picker = element.shadowRoot!.querySelector('lr-date-picker') as ReactiveOverlay;
  await picker.updateComplete;
  const day = picker.shadowRoot!.querySelector('[part~="day"][tabindex="0"]') as HTMLButtonElement;
  day.focus();
  day.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
  );
  await element.updateComplete;

  expect(element.open).to.be.false;
  expect(deepActiveElement(document)?.getAttribute('part')).to.equal('input');
});
