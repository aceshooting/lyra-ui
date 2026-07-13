import { expect } from '@open-wc/testing';
import { deepActiveElement } from './overlay-manager.js';
import '../components/dialog/dialog.js';
import '../components/responsive-panel/responsive-panel.js';
import '../components/tool-select-dialog/tool-select-dialog.js';
import '../components/tool-approval-dialog/tool-approval-dialog.js';
import '../components/tool-result-dialog/tool-result-dialog.js';
import '../components/app-rail/app-rail.js';
import '../components/widget/widget.js';
import '../components/date-picker/date-input.js';

interface ReactiveOverlay extends HTMLElement {
  updateComplete: Promise<unknown>;
  open?: boolean;
  fullscreen?: boolean;
  mode?: string;
  label?: string;
  toolName?: string;
  expandable?: boolean;
}

interface OverlayAdapter {
  tag: string;
  setup?(element: ReactiveOverlay): void;
  activate(element: ReactiveOverlay): void;
  deactivate(element: ReactiveOverlay): void;
}

const adapters: OverlayAdapter[] = [
  {
    tag: 'lyra-dialog',
    setup: (element) => (element.label = 'Dialog'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lyra-responsive-panel',
    setup: (element) => {
      element.mode = 'overlay';
      element.label = 'Panel';
    },
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lyra-tool-select-dialog',
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lyra-tool-approval-dialog',
    setup: (element) => (element.toolName = 'run'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lyra-tool-result-dialog',
    setup: (element) => (element.toolName = 'run'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lyra-app-rail',
    setup: (element) => (element.mode = 'mobile'),
    activate: (element) => (element.open = true),
    deactivate: (element) => (element.open = false),
  },
  {
    tag: 'lyra-widget',
    setup: (element) => {
      element.label = 'Widget';
      element.expandable = true;
    },
    activate: (element) => (element.fullscreen = true),
    deactivate: (element) => (element.fullscreen = false),
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

  (bottom.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
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
  const element = document.createElement('lyra-date-input') as ReactiveOverlay;
  element.dataset.overlayTest = 'lyra-date-input';
  document.body.append(element);
  await element.updateComplete;
  const expand = element.shadowRoot!.querySelector('[part="expand-button"]') as HTMLButtonElement;
  expand.focus();
  expand.click();
  await element.updateComplete;
  const picker = element.shadowRoot!.querySelector('lyra-date-picker') as ReactiveOverlay;
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
  const element = document.createElement('lyra-date-input') as ReactiveOverlay;
  element.dataset.overlayTest = 'lyra-date-input';
  document.body.append(element);
  await element.updateComplete;
  const input = element.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.focus();
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, composed: true, cancelable: true }),
  );
  await element.updateComplete;
  const picker = element.shadowRoot!.querySelector('lyra-date-picker') as ReactiveOverlay;
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
