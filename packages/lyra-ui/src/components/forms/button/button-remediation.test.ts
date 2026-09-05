import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './button.js';
import '../icon-button/icon-button.js';
import type { LyraButton } from './button.js';
import type { LyraIconButton } from '../icon-button/icon-button.js';

for (const tag of ['lr-button', 'lr-icon-button'] as const) {
  describe(`${tag} external description identity`, () => {
    it('follows same-ID replacement and live source mutations while preserving other ARIA', async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div>
        <span id="action-description">External</span><span id="action-controls">Controlled</span>
        ${tag === 'lr-button'
          ? html`<lr-button aria-describedby="action-description missing action-description" aria-controls="action-controls" aria-label="Action">Action</lr-button>`
          : html`<lr-icon-button aria-describedby="action-description missing action-description" aria-controls="action-controls" aria-label="Action"></lr-icon-button>`}
      </div>`);
      const action = wrapper.querySelector<LyraButton | LyraIconButton>(tag)!;
      const source = wrapper.querySelector('span')!;
      const owner = (): HTMLElement => action.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
      const refs = (): readonly Element[] => owner().ariaDescribedByElements ?? [];
      await waitUntil(() => refs()[0] === source);
      expect(refs().length).to.equal(1);
      const replacement = document.createElement('span');
      replacement.id = source.id;
      replacement.textContent = 'Replacement';
      source.replaceWith(replacement);
      await waitUntil(() => refs()[0] === replacement);
      expect(refs()[0]?.textContent).to.equal('Replacement');
      expect(owner().getAttribute('aria-label')).to.equal('Action');
      expect(owner().ariaControlsElements?.[0] === wrapper.querySelector('#action-controls')).to.equal(true);
      replacement.remove();
      await waitUntil(() => refs().length === 0);
      wrapper.prepend(replacement);
      await waitUntil(() => refs()[0] === replacement);
      replacement.id = 'renamed-action-description';
      await waitUntil(() => refs().length === 0);
      action.setAttribute('aria-describedby', replacement.id);
      await waitUntil(() => refs()[0] === replacement);
      action.removeAttribute('aria-describedby');
      await waitUntil(() => refs().length === 0);
      action.remove();
      action.setAttribute('aria-describedby', replacement.id);
      wrapper.append(action);
      await waitUntil(() => refs()[0] === replacement);
      action.href = '#local-action';
      await action.updateComplete;
      expect(owner().localName).to.equal('a');
      await waitUntil(() => refs()[0] === replacement);
      action.href = undefined;
      await action.updateComplete;
      expect(owner().localName).to.equal('button');
      await waitUntil(() => refs()[0] === replacement);
    });

    it('resolves descriptions from its current host shadow root and adopted document', async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div><iframe></iframe></div>`);
      const scope = document.createElement('div');
      wrapper.append(scope);
      const root = scope.attachShadow({ mode: 'open' });
      root.innerHTML = `<span id="scoped-action-description">Scoped</span><${tag} aria-label="Action" aria-describedby="scoped-action-description"></${tag}>`;
      const action = root.querySelector<LyraButton | LyraIconButton>(tag)!;
      await action.updateComplete;
      const refs = (): readonly Element[] => action.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!.ariaDescribedByElements ?? [];
      await waitUntil(() => refs()[0] === root.querySelector('span'));
      const targetDocument = wrapper.querySelector('iframe')!.contentDocument!;
      const target = targetDocument.createElement('span');
      target.id = 'scoped-action-description';
      target.textContent = 'Adopted';
      targetDocument.body.append(target, action);
      await waitUntil(() => refs()[0] === target);
      expect(refs().length).to.equal(1);
    });
  });
}
