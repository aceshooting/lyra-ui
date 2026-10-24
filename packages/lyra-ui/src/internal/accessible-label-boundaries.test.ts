import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import {
  composedAccessibilityText,
  composedAccessibilityTextResult,
  labelReferenceRecordsMatter,
} from './accessibility-visibility.js';
import { acquireAriaControls } from './aria-controls.js';
import { resolveIdReferencesIn } from './aria-reflection.js';
import {
  isCurrentlyAssociatedLabel,
  observeExternalLabelAssociations,
  resolveExternalLabels,
  resolveExternalLabelText,
} from './form-control-labels.js';

describe('accessible label reference boundaries', () => {
  it('refreshes a dangling label when its ID arrives inside an inserted subtree', async () => {
    const root = await fixture<HTMLElement>(html`<div><button aria-labelledby="late-label">Fallback</button></div>`);
    const button = root.querySelector('button')!;
    const baseline = composedAccessibilityTextResult(button);
    expect(baseline.text).to.equal('Fallback');
    expect([...baseline.labelReferenceIds]).to.deep.equal(['late-label']);
    const observer = new MutationObserver(() => {});
    observer.observe(root, { childList: true });
    try {
      const branch = document.createElement('section');
      branch.innerHTML = '<div><span id="late-label">Arrived label</span></div>';
      root.append(branch);
      expect(labelReferenceRecordsMatter(observer.takeRecords(), baseline.labelReferenceIds, baseline.referencedElements))
        .to.equal(true);
      const resolved = composedAccessibilityTextResult(button);
      expect(resolved.text).to.equal('Arrived label');
      expect([...resolved.referencedElements].map((element) => element.id)).to.deep.equal(['late-label']);
      branch.remove();
      expect(labelReferenceRecordsMatter(observer.takeRecords(), resolved.labelReferenceIds, resolved.referencedElements))
        .to.equal(true);
      expect(composedAccessibilityText(button)).to.equal('Fallback');
    } finally {
      observer.disconnect();
    }
  });

  it('ignores unrelated insertions and text nodes while retaining ID-based invalidation', () => {
    const root = document.createElement('div');
    const observer = new MutationObserver(() => {});
    observer.observe(root, { childList: true });
    const ids = new Set(['tracked-label']);
    try {
      root.append('unrelated text', document.createComment('boundary'));
      const branch = document.createElement('section');
      branch.innerHTML = '<div><span id="other-label">Other</span></div>';
      root.append(branch);
      expect(labelReferenceRecordsMatter(observer.takeRecords(), ids, new Set())).to.equal(false);
      branch.querySelector('span')!.id = 'tracked-label';
      branch.remove();
      expect(labelReferenceRecordsMatter(observer.takeRecords(), ids, new Set())).to.equal(true);
    } finally {
      observer.disconnect();
    }
  });

  for (const shape of ['wide', 'nested'] as const) {
    it(`invalidates conservatively when a ${shape} inserted subtree exceeds the reference scan budget`, () => {
      const root = document.createElement('div');
      const branch = document.createElement('section');
      if (shape === 'wide') {
        branch.append(...Array.from({ length: 4_098 }, () => document.createElement('span')));
      } else {
        for (let index = 0; index < 2_049; index += 1) {
          const child = document.createElement('div');
          child.append(document.createElement('span'), document.createElement('span'));
          branch.append(child);
        }
      }
      const observer = new MutationObserver(() => {});
      observer.observe(root, { childList: true });
      try {
        root.append(branch);
        expect(labelReferenceRecordsMatter(observer.takeRecords(), new Set(['not-yet-present']), new Set()))
          .to.equal(true);
      } finally {
        observer.disconnect();
      }
    });
  }

  it('uses the first duplicate ID, then resolves its replacement without retaining the removed label', async () => {
    const root = await fixture<HTMLElement>(html`
      <div><span id="duplicate-label">First</span><span id="duplicate-label">Second</span><button aria-labelledby="duplicate-label duplicate-label missing-label">Fallback</button></div>
    `);
    const button = root.querySelector('button')!;
    const first = root.querySelector('span')!;
    const before = composedAccessibilityTextResult(button);
    expect(before.text.trim()).to.equal('First');
    expect(before.referencedElements.size).to.equal(1);
    expect(resolveIdReferencesIn(document, button.getAttribute('aria-labelledby')).length).to.equal(1);
    first.remove();
    const after = composedAccessibilityTextResult(button);
    expect(after.text.trim()).to.equal('Second');
    expect(after.referencedElements.has(first)).to.equal(false);
    expect(after.referencedElements.size).to.equal(1);
  });

  it('keeps serialized label IDs inside their shadow root instead of resolving document lookalikes', async () => {
    const outer = await fixture<HTMLElement>(html`<div><span id="shadow-label">Document label</span><div></div></div>`);
    const host = outer.querySelector('div')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span id="shadow-label">Shadow label</span><button aria-labelledby="shadow-label">Fallback</button>';
    const button = shadow.querySelector('button')!;
    const result = composedAccessibilityTextResult(button);
    expect(result.text).to.equal('Shadow label');
    expect(result.labelReferenceRoots.has(shadow)).to.equal(true);
    expect(result.labelReferenceRoots.has(document)).to.equal(false);
    shadow.querySelector('span')!.remove();
    expect(composedAccessibilityText(button)).to.equal('Fallback');
  });

  it('keeps a detached element-root label unresolved until it enters an ID-resolving document', async () => {
    const container = await fixture<HTMLElement>(html`<div></div>`);
    const detached = document.createElement('div');
    detached.innerHTML = '<span id="detached-label">Resolved label</span><button aria-labelledby="detached-label">Fallback</button>';
    const button = detached.querySelector('button')!;
    const before = composedAccessibilityTextResult(button, { requireRendered: false });
    expect(before.text).to.equal('Fallback');
    expect(before.labelReferenceRoots.size).to.equal(0);
    expect([...before.labelReferenceIds]).to.deep.equal(['detached-label']);
    container.append(detached);
    const after = composedAccessibilityTextResult(button);
    expect(after.text).to.equal('Resolved label');
    expect(after.labelReferenceRoots.has(document)).to.equal(true);
  });

  it('does not expose fallback text when the label ID resolves after exhausting the shared work ceiling', async () => {
    const root = await fixture<HTMLElement>(html`<div><span id="x">Real label</span><button aria-labelledby="x">Fallback</button></div>`);
    const button = root.querySelector('button')!;
    const result = composedAccessibilityTextResult(button, {
      maxNodes: 2,
      requireRendered: false,
      skipRootAncestorValidation: true,
    });
    expect(result.text).to.equal('');
    expect(result.truncationReasons).to.include('nodes');
    expect([...result.labelReferenceIds]).to.deep.equal(['x']);
    expect(result.referencedElements.size).to.equal(0);
    expect(composedAccessibilityText(button)).to.equal('Real label');
  });

  it('reports a fallback slot cut off at the depth ceiling even without assigned candidates', () => {
    const slot = document.createElement('slot');
    slot.textContent = 'Fallback label';
    const result = composedAccessibilityTextResult(slot, {
      maxDepth: 0,
      requireRendered: false,
      skipRootAncestorValidation: true,
    });
    expect(result.text).to.equal('');
    expect(result.truncationReasons).to.deep.equal(['depth']);
  });
});

describe('external label and relationship lifecycle boundaries', () => {
  it('rejects labels from another document or shadow root and an explicitly empty for attribute', () => {
    const owner = document.implementation.createHTMLDocument('label owner');
    const host = owner.createElement('div');
    host.id = 'scoped-control';
    owner.body.append(host);
    const foreign = document.createElement('label');
    foreign.htmlFor = host.id;
    expect(isCurrentlyAssociatedLabel(foreign, host)).to.equal(false);
    const shell = owner.createElement('div');
    owner.body.append(shell);
    const shadow = shell.attachShadow({ mode: 'open' });
    const shadowLabel = owner.createElement('label');
    shadowLabel.htmlFor = host.id;
    shadow.append(shadowLabel);
    expect(isCurrentlyAssociatedLabel(shadowLabel, host)).to.equal(false);
    const empty = owner.createElement('label');
    empty.htmlFor = '';
    empty.append(host);
    owner.body.append(empty);
    expect(isCurrentlyAssociatedLabel(empty, host)).to.equal(false);
    expect(resolveExternalLabels(host).length).to.equal(0);
    empty.removeAttribute('for');
    expect(isCurrentlyAssociatedLabel(empty, host)).to.equal(true);
  });

  it('reads an external label through assigned slots, excludes the control, and restores fallback text', async () => {
    const label = await fixture<HTMLLabelElement>(html`<label>Before <div></div> after</label>`);
    const shell = label.querySelector('div')!;
    const shadow = shell.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot name="label">Fallback</slot>';
    expect(resolveExternalLabelText([label])).to.equal('Before Fallback after');
    const assigned = document.createElement('span');
    assigned.slot = 'label';
    assigned.textContent = 'Assigned';
    const control = document.createElement('span');
    control.slot = 'label';
    control.textContent = 'Control content';
    const unassigned = document.createElement('span');
    unassigned.slot = 'other';
    unassigned.textContent = 'Unrendered';
    shell.append(assigned, control, unassigned);
    expect(resolveExternalLabelText([label], control)).to.equal('Before Assigned after');
    assigned.remove();
    control.remove();
    expect(resolveExternalLabelText([label])).to.equal('Before Fallback after');
  });

  it('does not revive an external-label subscription after repeated disconnect and update calls', async () => {
    const root = await fixture<HTMLElement>(html`<div><label for="released-control">Label</label><div id="released-control"></div></div>`);
    const host = root.querySelector<HTMLElement>('#released-control')!;
    let refreshes = 0;
    const subscription = observeExternalLabelAssociations(host, () => { refreshes += 1; });
    subscription.update(resolveExternalLabels(host));
    subscription.disconnect();
    subscription.disconnect();
    subscription.update(resolveExternalLabels(host));
    root.querySelector('label')!.textContent = 'Changed';
    host.id = 'changed-control';
    await aTimeout(0);
    expect(refreshes).to.equal(0);
  });

  it('restores the exact whitespace controls baseline when the owned endpoint is the target itself', async () => {
    const target = await fixture<HTMLElement>(html`<button id="self-controlled">Toggle</button>`);
    target.setAttribute('aria-controls', ' \t ');
    const lease = acquireAriaControls(target, [target]);
    try {
      expect(target.getAttribute('aria-controls')).to.equal('self-controlled');
      lease.update([target]);
      expect(target.getAttribute('aria-controls')).to.equal('self-controlled');
      lease.release();
      expect(target.getAttribute('aria-controls')).to.equal(' \t ');
      lease.release();
      lease.update([target]);
      expect(target.getAttribute('aria-controls')).to.equal(' \t ');
    } finally {
      lease.release();
    }
  });
});
