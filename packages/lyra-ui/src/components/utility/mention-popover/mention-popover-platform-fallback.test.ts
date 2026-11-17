import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './mention-popover.js';
import type { LyraMentionPopover, LyraMentionSelectDetail } from './mention-popover.class.js';

interface NativeFeature {
  readonly owner: object;
  readonly name: string;
  readonly descriptor: PropertyDescriptor;
}

function removeNativeFeature(control: HTMLElement, name: string, saved: NativeFeature[]): void {
  let owner: object | null = Object.getPrototypeOf(control) as object | null;
  while (owner) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, name);
    if (descriptor) {
      if (!descriptor.configurable) throw new Error(`Native ${name} cannot be removed for this scenario`);
      saved.push({ owner, name, descriptor });
      expect(Reflect.deleteProperty(owner, name)).to.equal(true);
      return;
    }
    owner = Object.getPrototypeOf(owner) as object | null;
  }
}

function restoreNativeFeatures(saved: NativeFeature[]): void {
  for (let feature = saved.pop(); feature; feature = saved.pop()) {
    Object.defineProperty(feature.owner, feature.name, feature.descriptor);
  }
}

it('keeps input suggestions keyboard usable and restores authored semantics without native AOM element references', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div>
      <span id="mention-native-fallback-controls">Author controls</span>
      <span id="mention-native-fallback-active">Author active option</span>
      <input aria-label="Message" role="textbox" aria-expanded="false" aria-haspopup="menu"
        aria-controls="mention-native-fallback-controls" aria-activedescendant="mention-native-fallback-active"
        aria-autocomplete="both" value="Draft">
      <lr-mention-popover data-lr-theme-scope style="--lr-transition-fast:0s"></lr-mention-popover>
    </div>
  `);
  const input = root.querySelector('input')!;
  const viewer = root.querySelector<LyraMentionPopover>('lr-mention-popover')!;
  const names = ['role', 'aria-expanded', 'aria-haspopup', 'aria-controls', 'aria-activedescendant', 'aria-autocomplete'];
  const authored = names.map(name => [name, input.getAttribute(name)] as const);
  const features = ['ariaActiveDescendantElement', 'ariaControlsElements'];
  const available = features.map(name => name in input);
  const saved: NativeFeature[] = [];
  const selections: LyraMentionSelectDetail[] = [];
  viewer.addEventListener('lr-mention-select', event => { selections.push({ ...event.detail }); });
  try {
    for (const name of features) removeNativeFeature(input, name, saved);
    for (const name of features) expect(name in input, name).to.equal(false);
    await focusByKeyboard(input);
    viewer.anchor = input;
    viewer.items = [{ suggestionId: 'ada', label: 'Ada' }, { suggestionId: 'grace', label: 'Grace' }];
    viewer.open = true;
    await viewer.updateComplete;
    await waitUntil(() => viewer.activeDescendantElement !== null &&
      getComputedStyle(viewer.activeDescendantElement!).visibility === 'visible');
    expect(viewer.syncActiveDescendant(input)).to.equal(false);
    expect(input.hasAttribute('aria-controls')).to.equal(false);
    expect(input.hasAttribute('aria-activedescendant')).to.equal(false);
    expect(document.activeElement === input).to.equal(true);

    expect(await viewer.focusActiveOption()).to.equal(true);
    expect(viewer.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('ada');
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => viewer.shadowRoot!.activeElement?.getAttribute('data-id') === 'grace',
      'native navigation focuses the next suggestion');
    expect(selections.length).to.equal(0);
    await sendKeys({ press: 'Enter' });
    await viewer.updateComplete;
    await waitUntil(() => !viewer.open && document.activeElement === input,
      'selection closes suggestions and restores editor focus');
    expect(selections).to.deep.equal([{ suggestionId: 'grace', index: 1, label: 'Grace' }]);
    expect(input.value).to.equal('Draft');
    for (const [name, value] of authored) expect(input.getAttribute(name), name).to.equal(value);

    restoreNativeFeatures(saved);
    for (const [index, name] of features.entries()) expect(name in input, name).to.equal(available[index]);
    viewer.open = true;
    await viewer.updateComplete;
    expect(await viewer.focusActiveOption()).to.equal(true);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !viewer.open && document.activeElement === input,
      'the restored platform still supports a fresh suggestion session');
    expect(selections.length).to.equal(1);
    expect(input.value).to.equal('Draft');
    for (const [name, value] of authored) expect(input.getAttribute(name), name).to.equal(value);
  } finally {
    viewer.remove();
    restoreNativeFeatures(saved);
  }
});
