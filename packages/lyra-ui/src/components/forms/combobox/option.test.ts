import { fixture, expect, html } from '@open-wc/testing';
import './option.js';
import './combobox.js';
import '../select/select.js';
import type { LyraOption } from './option.js';
import {
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from '../../../internal/option-selection.js';

const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();

const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(probe)');
    return true;
  } catch {
    return false;
  }
})();

function part(el: LyraOption, name: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
}

it('establishes the shared --lr-* design tokens on its own host', async () => {
  const el = (await fixture(html`<lr-option value="a">A</lr-option>`)) as LyraOption;
  const text = getComputedStyle(el).getPropertyValue('--lr-color-text').trim();
  expect(text).to.not.equal('');
});

it('reflects the pinned Web Awesome value property', async () => {
  const el = (await fixture(html`<lr-option>Alpha</lr-option>`)) as LyraOption;
  el.value = 'alpha';
  await el.updateComplete;
  expect(el.getAttribute('value')).to.equal('alpha');
});

it('reflects the pinned Web Awesome disabled property in both directions', async () => {
  const el = (await fixture(html`<lr-option>Alpha</lr-option>`)) as LyraOption;
  el.disabled = true;
  await el.updateComplete;
  expect(el.getAttribute('disabled')).to.equal('');

  el.removeAttribute('disabled');
  await el.updateComplete;
  expect(el.disabled).to.equal(false);
});

it('keeps owner synchronization pristine and clears consumer selectedness dirtyness on reset', async () => {
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;

  el[SET_OPTION_SELECTED_FROM_OWNER](false);
  el.defaultSelected = true;
  expect(el.selected, 'an owner sync does not block a later default from reaching live state').to.be.true;

  el.selected = false;
  el.defaultSelected = false;
  expect(el.selected, 'a consumer selected IDL write remains live when the default changes').to.be.false;

  el[RESET_OPTION_SELECTED_FROM_OWNER](false);
  el.defaultSelected = true;
  expect(el.selected, 'reset clears dirtyness so later defaults reach live state again').to.be.true;
});

it('resolves label from the label attribute when present', async () => {
  const el = (await fixture(html`<lr-option value="a" label="Alpha">A</lr-option>`)) as LyraOption;
  expect(el.label).to.equal('Alpha');
});

it('falls back to text content when the label attribute is absent', async () => {
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;
  expect(el.label).to.equal('Alpha');
});

it('falls back to text content when the label attribute is present but empty', async () => {
  const el = (await fixture(html`<lr-option value="a" label="">Alpha</lr-option>`)) as LyraOption;
  expect(el.label).to.equal('Alpha');
});

it('accepts label as a settable property and notifies an owning picker', async () => {
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;
  let changes = 0;
  el.addEventListener('lr-option-change', () => changes++);

  el.label = 'Manual label';
  await el.updateComplete;

  expect(el.label).to.equal('Manual label');
  expect(el.getAttribute('label'), 'property writes stay property-only').to.equal(null);
  expect(changes).to.equal(1);
});

it('derives defaultLabel and getTextLabel() from plain default-slot text only', async () => {
  const el = (await fixture(html`
    <lr-option value="a">
      <span slot="start">Start adornment</span>
      <span slot="prefix">Prefix adornment</span>
      Alpha <strong>Beta</strong>
      <span slot="end">End adornment</span>
      <span slot="suffix">Suffix adornment</span>
    </lr-option>
  `)) as LyraOption;

  expect(el.defaultLabel).to.equal('Alpha Beta');
  expect(el.getTextLabel()).to.equal('Alpha Beta');
});

it('notifies and updates defaultLabel when a direct slotted descendant mutates in place', async () => {
  const el = (await fixture(html`<lr-option><span data-label></span></lr-option>`)) as LyraOption;
  const assigned = el.querySelector('[data-label]') as HTMLElement;
  let changes = 0;
  el.addEventListener('lr-option-change', () => changes++);
  expect(el.defaultLabel).to.equal('');

  assigned.textContent = 'Direct option label';
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  expect(el.defaultLabel).to.equal('Direct option label');
  expect(changes).to.be.greaterThan(0);
});

it('tracks flattened accessible defaultLabel content through a forwarding slot', async () => {
  const details = (await fixture(html`
    <details open>
      <summary>Forwarded option fixture</summary>
      <div><span data-label></span></div>
    </details>
  `)) as HTMLDetailsElement;
  const wrapper = details.querySelector('div')!;
  const root = wrapper.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host(.hide-forwarded-label) slot::slotted([data-label]) { display: none; }
      slot::slotted([data-label]) {
        visibility: var(--forwarded-label-visibility, visible);
      }
    </style>
    <lr-option>
      <slot><span>Forwarding fallback</span></slot>
    </lr-option>
  `;
  const el = root.querySelector('lr-option') as LyraOption;
  const assigned = wrapper.querySelector('[data-label]') as HTMLElement;
  const forwardingSlot = el.querySelector('slot')!;
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  };

  el.label = 'Explicit picker label';
  await settle();
  expect(el.defaultLabel, 'an empty assignment suppresses slot fallback').to.equal('');
  expect(el.label).to.equal('Explicit picker label');

  assigned.textContent = 'Forwarded option label';
  await settle();
  expect(el.defaultLabel).to.equal('Forwarded option label');

  assigned.textContent = '';
  await settle();
  expect(el.defaultLabel).to.equal('');

  assigned.setAttribute('aria-label', 'Forwarded accessible name');
  await settle();
  expect(el.defaultLabel).to.equal('Forwarded accessible name');

  assigned.setAttribute('aria-hidden', ' TRUE ');
  await settle();
  expect(el.defaultLabel).to.equal('');

  assigned.removeAttribute('aria-hidden');
  assigned.style.display = 'none';
  await settle();
  expect(el.defaultLabel).to.equal('');

  assigned.style.removeProperty('display');
  assigned.hidden = true;
  await settle();
  expect(el.defaultLabel).to.equal('');

  assigned.hidden = false;
  await settle();
  expect(el.defaultLabel).to.equal('Forwarded accessible name');
  expect(el.label, 'the explicit public label remains authoritative').to.equal(
    'Explicit picker label',
  );

  let cachedLabel = el.defaultLabel;
  const cacheLabel = (): void => {
    cachedLabel = el.defaultLabel;
  };
  el.addEventListener('lr-option-change', cacheLabel);

  wrapper.setAttribute('aria-hidden', ' TRUE ');
  await settle();
  expect(cachedLabel, 'a hard-hidden forwarding host prunes its assigned label').to.equal('');

  wrapper.removeAttribute('aria-hidden');
  await settle();
  expect(cachedLabel).to.equal('Forwarded accessible name');

  details.open = false;
  await settle();
  expect(cachedLabel, 'a closed details ancestor prunes non-summary forwarded content').to.equal('');

  details.open = true;
  await settle();
  expect(cachedLabel).to.equal('Forwarded accessible name');

  wrapper.classList.add('hide-forwarded-label');
  await settle();
  expect(cachedLabel, 'a forwarding-host class mutation invalidates an owner cache').to.equal('');

  wrapper.classList.remove('hide-forwarded-label');
  await settle();
  expect(cachedLabel).to.equal('Forwarded accessible name');

  wrapper.style.setProperty('--forwarded-label-visibility', 'hidden');
  await settle();
  expect(cachedLabel, 'a forwarding-host style mutation invalidates an owner cache').to.equal('');

  wrapper.style.removeProperty('--forwarded-label-visibility');
  await settle();
  expect(cachedLabel).to.equal('Forwarded accessible name');
  el.removeEventListener('lr-option-change', cacheLabel);

  forwardingSlot.setAttribute('aria-hidden', 'true');
  await settle();
  expect(el.defaultLabel, 'a hidden forwarding slot prunes its flattened assignment').to.equal('');

  forwardingSlot.removeAttribute('aria-hidden');
  forwardingSlot.style.display = 'none';
  await settle();
  expect(el.defaultLabel).to.equal('');

  forwardingSlot.style.removeProperty('display');
  await settle();
  expect(el.defaultLabel).to.equal('Forwarded accessible name');

  const reassigned = new Promise<void>((resolve) =>
    forwardingSlot.addEventListener('slotchange', () => resolve(), { once: true }),
  );
  assigned.remove();
  await reassigned;
  await settle();
  expect(el.defaultLabel).to.equal('Forwarding fallback');
});

it('tracks composed exposure for a forwarded root Text node', async () => {
  const details = (await fixture(html`
    <details open>
      <summary>Forwarded text fixture</summary>
      <div>Forwarded option text</div>
    </details>
  `)) as HTMLDetailsElement;
  const wrapper = details.querySelector('div')!;
  const root = wrapper.attachShadow({ mode: 'open' });
  root.innerHTML = '<lr-option><slot></slot></lr-option>';
  const el = root.querySelector('lr-option') as LyraOption;
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  };
  let cachedLabel = el.defaultLabel;
  el.addEventListener('lr-option-change', () => {
    cachedLabel = el.defaultLabel;
  });

  await settle();
  expect(cachedLabel).to.equal('Forwarded option text');

  wrapper.hidden = true;
  await settle();
  expect(cachedLabel, 'a hard-hidden composed parent prunes a forwarded root Text node').to.equal(
    '',
  );

  wrapper.hidden = false;
  await settle();
  expect(cachedLabel).to.equal('Forwarded option text');

  details.open = false;
  await settle();
  expect(cachedLabel, 'a closed details ancestor prunes a forwarded root Text node').to.equal('');

  details.open = true;
  await settle();
  expect(cachedLabel).to.equal('Forwarded option text');
});

for (const pickerTag of ['lr-select', 'lr-combobox'] as const) {
  it(`keeps a forwarded label readable through ${pickerTag}'s hidden data-source slot`, async () => {
    const details = (await fixture(html`
      <details open>
        <summary>Forwarded picker fixture</summary>
        <div><span data-label>Forwarded picker label</span></div>
      </details>
    `)) as HTMLDetailsElement;
    const wrapper = details.querySelector('div')!;
    const root = wrapper.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <${pickerTag}>
        <lr-option value="forwarded"><slot></slot></lr-option>
      </${pickerTag}>
    `;
    const picker = root.querySelector(pickerTag) as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    const el = root.querySelector('lr-option') as LyraOption;
    const assigned = wrapper.querySelector('[data-label]')!;
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.all([picker.updateComplete, el.updateComplete]);
    };
    let cachedLabel = el.defaultLabel;
    el.addEventListener('lr-option-change', () => {
      cachedLabel = el.defaultLabel;
    });

    await settle();
    expect(el.assignedSlot?.hidden, 'the picker really owns an intentionally hidden source slot').to
      .be.true;
    expect(el.defaultLabel).to.equal('Forwarded picker label');
    expect(cachedLabel).to.equal('Forwarded picker label');

    assigned.textContent = 'Updated picker label';
    await settle();
    expect(cachedLabel).to.equal('Updated picker label');

    wrapper.setAttribute('aria-hidden', 'true');
    await settle();
    expect(cachedLabel, 'consumer-owned source ancestry still prunes the forwarded label').to.equal(
      '',
    );

    wrapper.removeAttribute('aria-hidden');
    await settle();
    expect(cachedLabel).to.equal('Updated picker label');

    details.open = false;
    await settle();
    expect(cachedLabel, 'closed source-side details content remains pruned').to.equal('');

    details.open = true;
    await settle();
    expect(cachedLabel).to.equal('Updated picker label');
  });
}

it('constructs its label observer in the adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const observerDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
  const NativeMutationObserver = frameWindow.MutationObserver;
  let constructions = 0;
  let adoptedTarget: LyraOption | undefined;
  let labelHostObservations = 0;
  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions += 1;
    }
    override observe(target: Node, options?: MutationObserverInit): void {
      if (
        target === adoptedTarget &&
        options?.childList &&
        options.characterData &&
        options.subtree
      ) labelHostObservations += 1;
      super.observe(target, options);
    }
  }
  Object.defineProperty(frameWindow, 'MutationObserver', {
    configurable: true,
    value: TrackingMutationObserver,
  });
  const el = (await fixture(html`<lr-option><span>Parent label</span></lr-option>`)) as LyraOption;
  adoptedTarget = el;
  el.remove();
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(constructions).to.be.greaterThan(1);
    expect(labelHostObservations).to.be.greaterThan(0);
    expect(el.defaultLabel).to.equal('Parent label');
  } finally {
    el.remove();
    if (observerDescriptor) {
      Object.defineProperty(frameWindow, 'MutationObserver', observerDescriptor);
    } else {
      delete (frameWindow as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
    }
    frame.remove();
  }
});

it('keeps the manual WA label distinct from the generated default label', async () => {
  const el = (await fixture(
    html`<lr-option value="a" label="Search label"><strong>Visible label</strong></lr-option>`,
  )) as LyraOption;

  expect(el.label).to.equal('Search label');
  expect(el.defaultLabel).to.equal('Visible label');
  expect(el.getTextLabel(), 'Shoelace method remains content-derived').to.equal('Visible label');
});

it('renders the complete WA and Shoelace slot and part anatomy', async () => {
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;

  expect(part(el, 'base')).to.exist;
  expect(part(el, 'checked-icon')).to.exist;
  expect(part(el, 'label').querySelector('slot:not([name])')).to.exist;
  expect(part(el, 'start')).to.equal(part(el, 'prefix'));
  expect(part(el, 'start').querySelector('slot[name="start"]')).to.exist;
  expect(part(el, 'start').querySelector('slot[name="prefix"]')).to.exist;
  expect(part(el, 'end')).to.equal(part(el, 'suffix'));
  expect(part(el, 'end').querySelector('slot[name="end"]')).to.exist;
  expect(part(el, 'end').querySelector('slot[name="suffix"]')).to.exist;
});

it('projects both adornment vocabularies without leaving empty wrapper gaps', async () => {
  const el = (await fixture(html`
    <lr-option value="a">
      <span slot="prefix" id="prefix">Prefix</span>
      Alpha
      <span slot="end" id="end">End</span>
    </lr-option>
  `)) as LyraOption;
  await el.updateComplete;

  const start = part(el, 'start');
  const end = part(el, 'end');
  expect(start.hidden).to.equal(false);
  expect(end.hidden).to.equal(false);
  expect(start.querySelector<HTMLSlotElement>('slot[name="prefix"]')!.assignedElements()[0]?.id).to.equal(
    'prefix',
  );
  expect(end.querySelector<HTMLSlotElement>('slot[name="end"]')!.assignedElements()[0]?.id).to.equal('end');

  el.querySelector('#prefix')!.remove();
  el.querySelector('#end')!.remove();
  await new Promise<void>((resolve) => setTimeout(resolve));
  await el.updateComplete;
  expect(start.hidden).to.equal(true);
  expect(end.hidden).to.equal(true);
});

it('shows the checked icon only for a selected option', async () => {
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;
  const checkedIcon = part(el, 'checked-icon');
  expect(checkedIcon.hidden).to.equal(true);

  el.selected = true;
  await el.updateComplete;
  expect(checkedIcon.hidden).to.equal(false);
  expect(checkedIcon.querySelector('svg')?.getAttribute('aria-hidden')).to.equal('true');
});

it('keeps defaultSelected attribute state separate from the live selected property', async () => {
  const el = (await fixture(html`<lr-option value="a" selected>Alpha</lr-option>`)) as LyraOption;

  expect(el.defaultSelected).to.equal(true);
  expect(el.selected).to.equal(true);
  expect(el.hasAttribute('selected')).to.equal(true);

  el.selected = false;
  await el.updateComplete;
  expect(el.defaultSelected, 'the reset default remains declared').to.equal(true);
  expect(el.selected, 'the live state can diverge').to.equal(false);
  expect(el.hasAttribute('selected'), 'live writes do not rewrite the default attribute').to.equal(true);

  el.defaultSelected = false;
  await el.updateComplete;
  expect(el.defaultSelected).to.equal(false);
  expect(el.selected, 'a dirty live state is not overwritten by a default write').to.equal(false);
  expect(el.hasAttribute('selected'), 'the pinned property is not reflected').to.equal(true);
});

it('publishes selected and disabled through states and ElementInternals ARIA', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;
  const internals = (el as unknown as { optionInternals: ElementInternals }).optionInternals;

  expect(internals.role).to.equal('option');
  expect(internals.ariaSelected).to.equal('false');
  expect(internals.ariaDisabled).to.equal('false');
  expect(el.matches(':state(selected)')).to.equal(false);
  expect(el.matches(':state(disabled)')).to.equal(false);

  el.selected = true;
  el.disabled = true;
  await el.updateComplete;
  expect(internals.ariaSelected).to.equal('true');
  expect(internals.ariaDisabled).to.equal('true');
  expect(el.matches(':state(selected)')).to.equal(true);
  expect(el.matches(':state(disabled)')).to.equal(true);
});

it('publishes hover while the pointer is over the option', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;

  el.dispatchEvent(new Event('pointerenter'));
  expect(el.matches(':state(hover)')).to.equal(true);
  el.dispatchEvent(new Event('pointerleave'));
  expect(el.matches(':state(hover)')).to.equal(false);
});

it('publishes current while the host is the roving-focus target', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-option value="a" tabindex="-1">Alpha</lr-option>`)) as LyraOption;

  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  expect(el.matches(':state(current)')).to.equal(true);
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  expect(el.matches(':state(current)')).to.equal(false);
});

it('uses --current-text-color for the keyboard-current state', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`
    <lr-option value="a" style="--current-text-color: rgb(1, 2, 3)">Alpha</lr-option>
  `)) as LyraOption;

  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  expect(getComputedStyle(part(el, 'base')).color).to.equal('rgb(1, 2, 3)');
});

it('resets transient current and hover states across disconnect/reconnect', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`<lr-option value="a">Alpha</lr-option>`)) as LyraOption;
  el.dispatchEvent(new Event('pointerenter'));
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  expect(el.matches(':state(hover)')).to.equal(true);
  expect(el.matches(':state(current)')).to.equal(true);

  el.remove();
  expect(el.matches(':state(hover)')).to.equal(false);
  expect(el.matches(':state(current)')).to.equal(false);
  document.body.append(el);
  await el.updateComplete;
  expect(el.matches(':state(hover)')).to.equal(false);
  expect(el.matches(':state(current)')).to.equal(false);
});

it('exposes sub and dotColor properties, empty by default', async () => {
  const el = (await fixture(html`<lr-option value="a">A</lr-option>`)) as LyraOption;
  expect(el.sub).to.equal('');
  expect(el.dotColor).to.equal('');
});

it('reflects sub and dot-color attributes onto their properties', async () => {
  const el = (await fixture(
    html`<lr-option value="a" sub="Running" dot-color="green">A</lr-option>`,
  )) as LyraOption;
  expect(el.sub).to.equal('Running');
  expect(el.dotColor).to.equal('green');
});

it('is accessible', async () => {
  const listbox = await fixture<HTMLElement>(html`
    <div role="listbox" aria-label="Letters">
      <!-- axe-core does not currently project ElementInternals.role into its DOM role walk, so
           repeat the same default role as a content attribute in this harness. -->
      <lr-option role="option" value="a">A</lr-option>
      <lr-option role="option" value="b" disabled>B</lr-option>
    </div>
  `);
  await expect(listbox).to.be.accessible();
});
