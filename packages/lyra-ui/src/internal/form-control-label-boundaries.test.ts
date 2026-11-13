import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import {
  ExternalLabelController, isCurrentlyAssociatedLabel, observeExternalLabelAssociations,
  resolveExternalLabels, resolveExternalLabelText,
} from './form-control-labels.js';

describe('external label association boundaries', () => {
  it('resolves exact first-match IDs in a detached element tree without getElementById', () => {
    const fragment = document.createElement('div');
    const label = document.createElement('label');
    const host = document.createElement('div');
    host.id = 'fragment-control';
    label.htmlFor = host.id;
    fragment.append(label, host);
    expect(isCurrentlyAssociatedLabel(label, host)).to.equal(true);
    const duplicate = document.createElement('div');
    duplicate.id = host.id;
    fragment.insertBefore(duplicate, host);
    expect(isCurrentlyAssociatedLabel(label, host)).to.equal(false);
    duplicate.remove();
    expect(resolveExternalLabels(host).length).to.equal(1);
  });

  it('moves label activation to the semantic focus target when the host focus method does nothing', async () => {
    const container = await fixture<HTMLElement>(html`<div><label for="fallback-focus-host">External name</label><div id="fallback-focus-host"></div></div>`);
    const host = Object.assign(container.querySelector<HTMLElement>('#fallback-focus-host')!, {
      addController(): void {}, removeController(): void {}, requestUpdate(): void {},
      updateComplete: Promise.resolve(true), focus(): void {},
    });
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<input id="semantic-focus-target" aria-label="Original name">';
    const target = root.querySelector<HTMLInputElement>('input')!;
    const controller = new ExternalLabelController(host);
    try {
      controller.hostConnected();
      expect(target.getAttribute('aria-label')).to.equal('External name');
      container.querySelector('label')!.click();
      await aTimeout(0);
      expect(root.activeElement?.id).to.equal('semantic-focus-target');
      controller.hostDisconnected();
      expect(target.getAttribute('aria-label')).to.equal('Original name');
    } finally {
      controller.hostDisconnected();
    }
  });

  it('refreshes an implicit association when its deeply positioned control exceeds the traversal budget', async () => {
    const container = await fixture<HTMLElement>(html`<div></div>`);
    const label = document.createElement('label');
    const host = document.createElement('div');
    const spans = Array.from({ length: 2_050 }, () => document.createElement('span'));
    label.append(...spans, host);
    container.append(label);
    let refreshes = 0;
    const subscription = observeExternalLabelAssociations(host, () => { refreshes += 1; });
    subscription.update([label]);
    try {
      label.prepend(document.createTextNode('Updated deep label'));
      await aTimeout(0);
      expect(refreshes).to.equal(1);
      expect(resolveExternalLabelText(resolveExternalLabels(host), host)).to.equal('Updated deep label');
    } finally {
      subscription.disconnect();
    }
  });

  it('coalesces an oversized mutation batch while retaining the current implicit label text', async () => {
    const container = await fixture<HTMLElement>(html`<div></div>`);
    const label = document.createElement('label');
    const host = document.createElement('div');
    const text = document.createTextNode('Initial label');
    label.append(text, host);
    container.append(label);
    let refreshes = 0;
    const subscription = observeExternalLabelAssociations(host, () => { refreshes += 1; });
    subscription.update([label]);
    try {
      for (let index = 0; index < 2_050; index += 1) text.data = `Label update ${index}`;
      await aTimeout(0);
      expect(refreshes).to.equal(1);
      expect(resolveExternalLabelText(resolveExternalLabels(host), host)).to.equal('Label update 2049');
    } finally {
      subscription.disconnect();
    }
  });

  for (const originalName of [null, '', 'Initial control name']) {
    it(`moves an external name to a replacement control and restores ${JSON.stringify(originalName)}`, async () => {
      const container = await fixture<HTMLElement>(html`
        <div><label for="replacement-label-owner">External name</label><div id="replacement-label-owner"></div></div>
      `);
      const host = Object.assign(container.querySelector<HTMLElement>('#replacement-label-owner')!, {
        addController(): void {}, removeController(): void {}, requestUpdate(): void {},
        updateComplete: Promise.resolve(true), focus(): void {},
      });
      const root = host.attachShadow({ mode: 'open' });
      const original = document.createElement('input');
      original.id = 'original-label-target';
      if (originalName !== null) original.setAttribute('aria-label', originalName);
      root.append(original);
      const controller = new ExternalLabelController(host);
      try {
        controller.hostConnected();
        expect(original.getAttribute('aria-label')).to.equal('External name');
        const replacement = document.createElement('input');
        replacement.id = 'replacement-label-target';
        replacement.setAttribute('aria-label', 'Replacement default');
        root.replaceChildren(replacement);
        controller.hostUpdated();
        expect(original.getAttribute('aria-label')).to.equal(originalName);
        expect(original.hasAttribute('aria-label')).to.equal(originalName !== null);
        expect(replacement.getAttribute('aria-label')).to.equal('External name');
        const label = container.querySelector('label')!;
        label.click();
        await aTimeout(0);
        expect(root.activeElement?.id).to.equal('replacement-label-target');
        label.remove();
        await aTimeout(0);
        expect(replacement.getAttribute('aria-label')).to.equal('Replacement default');
        expect(root.activeElement?.id).to.equal('replacement-label-target');
      } finally {
        controller.hostDisconnected();
      }
    });
  }

  it('keeps the latest labels when a second bulk mutation arrives during bounded refresh', async () => {
    const container = await fixture<HTMLElement>(html`<div></div>`);
    const hosts = Array.from({ length: 300 }, (_, index) => {
      const host = document.createElement('div');
      host.id = `bulk-label-owner-${index}`;
      return host;
    });
    container.append(...hosts);
    const labels = hosts.map((host, index) => {
      const label = document.createElement('label');
      label.htmlFor = host.id;
      label.textContent = `Initial ${index}`;
      return label;
    });
    const names = hosts.map(() => '');
    const subscriptions = hosts.map((host, index) => observeExternalLabelAssociations(host, () => {
      names[index] = resolveExternalLabelText(resolveExternalLabels(host), host);
    }));
    let phase = 0;
    const checkpoint = new MutationObserver(() => {
      if (phase !== 0) return;
      phase = 1;
      labels.forEach((label, index) => { label.textContent = `Latest ${index}`; });
      container.append(...Array.from({ length: 2_050 }, () => document.createElement('span')));
    });
    checkpoint.observe(container, { childList: true });
    try {
      container.append(...labels, ...Array.from({ length: 2_050 }, () => document.createElement('span')));
      await waitUntil(() => names.every((name, index) => name === `Latest ${index}`), 'all current labels settle');
      expect(phase).to.equal(1);
      expect(names).to.deep.equal(hosts.map((_, index) => `Latest ${index}`));
      subscriptions.forEach(subscription => subscription.disconnect());
      labels.forEach(label => { label.textContent = 'After disposal'; });
      await aTimeout(20);
      expect(names).to.deep.equal(hosts.map((_, index) => `Latest ${index}`));
    } finally {
      checkpoint.disconnect();
      subscriptions.forEach(subscription => subscription.disconnect());
    }
  });
});
