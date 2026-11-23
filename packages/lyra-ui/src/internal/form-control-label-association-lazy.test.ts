import { expect, waitUntil } from '@open-wc/testing';
import { isExternalLabelAssociationIndexed } from './form-control-labels.js';
import { tag } from './prefix.js';
import '../components/lr-input.js';

// Module state is per page: these cases run in order, before anything loads the indexed observer.

interface InputControl extends HTMLElement {
  readonly updateComplete: Promise<boolean>;
}

const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function semanticInput(control: InputControl): HTMLInputElement {
  return control.shadowRoot!.querySelector('input')!;
}

/** The control's own name when no external label names it. */
const OWN_NAME = 'Text';

async function withLabelReadCounter(run: (reads: { readonly count: number }) => Promise<void>): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(ElementInternals.prototype, 'labels')!;
  const nativeGet = descriptor.get!;
  let count = 0;
  Object.defineProperty(ElementInternals.prototype, 'labels', {
    ...descriptor,
    get(this: ElementInternals) {
      count++;
      return nativeGet.call(this) as NodeList;
    },
  });
  try {
    await run({ get count() { return count; } });
  } finally {
    Object.defineProperty(ElementInternals.prototype, 'labels', descriptor);
  }
}

describe('lean external-label association before the indexed observer loads', () => {
  const container = document.createElement('div');
  const controls: InputControl[] = [];

  const blocker = document.createElement('input');
  const label = document.createElement('label');

  before(async () => {
    for (let index = 0; index < 40; index++) {
      const control = document.createElement(tag('input')) as InputControl;
      control.id = `lean-label-control-${index}`;
      controls.push(control);
    }
    // A duplicate id precedes control 17, so this label names the blocker and every control
    // connects without a label: no subscription has a reason to load the indexed observer.
    blocker.id = controls[17]!.id;
    label.htmlFor = controls[17]!.id;
    label.textContent = 'Revealed label';
    container.append(blocker, label, ...controls);
    document.body.append(container);
    await Promise.all(controls.map((control) => control.updateComplete));
    await nextTask();
  });

  after(() => container.remove());

  it('stays lean and reads no labels for mutations that cannot create an association', async () => {
    expect(isExternalLabelAssociationIndexed()).to.equal(false);
    await withLabelReadCounter(async (reads) => {
      const unrelated = document.createElement('div');
      unrelated.id = 'lean-unrelated-id';
      unrelated.innerHTML = '<span id="lean-nested-unrelated">text</span><input type="text">';
      container.prepend(unrelated);
      unrelated.querySelector('input')!.type = 'number';
      unrelated.id = 'lean-unrelated-renamed';
      unrelated.firstElementChild!.textContent = 'changed';
      unrelated.remove();
      await nextTask();
      expect(reads.count).to.equal(0);
    });
    expect(isExternalLabelAssociationIndexed()).to.equal(false);
    for (const control of controls) expect(semanticInput(control).getAttribute('aria-label')).to.equal(OWN_NAME);
  });

  it('loads the indexed observer when a duplicate id stops shadowing a control, refreshing only that control', async () => {
    const target = controls[17]!;
    expect(isExternalLabelAssociationIndexed()).to.equal(false);
    expect(semanticInput(target).getAttribute('aria-label')).to.equal(OWN_NAME);

    await withLabelReadCounter(async (reads) => {
      blocker.remove();
      await waitUntil(() => semanticInput(target).getAttribute('aria-label') === 'Revealed label',
        'the replayed removal names the revealed control');
      expect(isExternalLabelAssociationIndexed()).to.equal(true);
      // The replay goes through the indexed observer's targeting: one control, not all forty.
      expect(reads.count).to.equal(1);
    });
    for (const control of controls) {
      if (control !== target) expect(semanticInput(control).getAttribute('aria-label')).to.equal(OWN_NAME);
    }
    label.remove();
    await waitUntil(() => semanticInput(target).getAttribute('aria-label') === OWN_NAME,
      'removing the label withdraws the name');
  });

  it('serves later controls and mutations synchronously from the indexed observer', async () => {
    const labelled = document.createElement('div');
    const control = document.createElement(tag('input')) as InputControl;
    control.id = 'lean-late-control';
    labelled.append(control);
    document.body.append(labelled);
    try {
      await control.updateComplete;
      const late = document.createElement('label');
      late.htmlFor = control.id;
      late.textContent = 'Late label';
      labelled.prepend(late);
      // Delivered by the root observer itself, before a later-registered observer runs.
      let seen: string | null = null;
      const later = new MutationObserver(() => {
        seen = semanticInput(control).getAttribute('aria-label');
      });
      later.observe(labelled, { childList: true, subtree: true, characterData: true });
      late.textContent = 'Late label, retitled';
      await nextTask();
      later.disconnect();
      expect(seen).to.equal('Late label, retitled');
      await expect(labelled).to.be.accessible();
    } finally {
      labelled.remove();
    }
  });
});
