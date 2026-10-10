import { expect, fixture, html } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { LyraElement } from '../internal/lyra-element.js';
import { LyraChangeReview } from '../components/agent-tools/change-review/change-review.class.js';
import { LyraDiffView } from '../components/utility/diff-view/diff-view.class.js';
import { createScopedRegistry, supportsScopedRegistries } from './scoped-registry.js';
import { isRegisteredLyraElement } from '../internal/prefix.js';

class ScopedChild extends LyraElement { override render() { return litHtml`<span>Scoped child</span>`; } }
class ScopedParent extends LyraElement { override render() { return litHtml`<scope-child></scope-child>`; } }

describe('optional scoped registries', () => {
  it('reports unsupported native platforms and refuses implicit global fallback', () => {
    expect(typeof supportsScopedRegistries()).to.equal('boolean');
    if (!supportsScopedRegistries()) expect(() => createScopedRegistry({ 'scope-child': ScopedChild })).to.throw('Scoped custom element registries');
  });

  it('keeps nested template children in their own registry without global definitions', async function () {
    if (!supportsScopedRegistries()) this.skip();
    const scope = createScopedRegistry({ 'scope-parent': ScopedParent, 'scope-child': ScopedChild });
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const parent = scope.createElement('scope-parent');
    scope.attachShadow(host).append(parent);
    await parent.updateComplete;
    const child = parent.shadowRoot!.querySelector('scope-child')!;
    expect(child instanceof ScopedChild).to.equal(true);
    expect(customElements.get('scope-child') === undefined).to.equal(true);
    expect((child as ScopedChild).ownerDocument === document).to.equal(true);
  });

  it('counts scoped definitions as library components, so their roots never take the token layer on demand', async function () {
    if (!supportsScopedRegistries()) this.skip();
    const scope = createScopedRegistry({ 'scope-parent': ScopedParent, 'scope-child': ScopedChild });
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const parent = scope.createElement('scope-parent');
    scope.attachShadow(host).append(parent);
    await parent.updateComplete;
    const child = parent.shadowRoot!.querySelector('scope-child')!;
    expect(isRegisteredLyraElement(parent), 'created by the factory').to.equal(true);
    expect(isRegisteredLyraElement(child), 'cloned from a scoped template').to.equal(true);
    class UnlistedChild extends LyraElement {}
    customElements.define('scope-unlisted-global', UnlistedChild);
    expect(isRegisteredLyraElement(document.createElement('scope-unlisted-global')), 'an application definition stays foreign').to.equal(false);
  });

  it('supports independent versions of a tag and predictable late definitions', async function () {
    if (!supportsScopedRegistries()) this.skip();
    class OtherChild extends LyraElement { override render() { return litHtml`<span>Other child</span>`; } }
    const first = createScopedRegistry({ 'scope-child': ScopedChild });
    const second = createScopedRegistry({ 'scope-child': OtherChild });
    expect(first.createElement('scope-child') instanceof ScopedChild).to.equal(true);
    expect(second.createElement('scope-child') instanceof OtherChild).to.equal(true);
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const shadow = first.attachShadow(host);
    shadow.innerHTML = '<scope-late></scope-late>';
    first.define('scope-late', ScopedChild);
    first.define('scope-late', ScopedChild);
    const late = shadow.querySelector('scope-late')!;
    expect(late instanceof ScopedChild).to.equal(true);
    expect(() => first.define('scope-late', OtherChild)).to.throw();
  });

  it('composes a real Lyra review and diff from class-only definitions', async function () {
    if (!supportsScopedRegistries()) this.skip();
    const scope = createScopedRegistry({ 'lr-change-review': LyraChangeReview, 'lr-diff-view': LyraDiffView });
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const review = scope.createElement('lr-change-review');
    review.files = [{ id: 'file', path: 'file.txt', hunks: [{ id: 'hunk', before: 'before', after: 'after' }] }];
    scope.attachShadow(host).append(review);
    await review.updateComplete;
    expect(review.shadowRoot!.querySelector('lr-diff-view') instanceof LyraDiffView).to.equal(true);
  });

  it('isolates global conflicts and refuses attaching to a foreign document', function () {
    if (!supportsScopedRegistries()) this.skip();
    class GlobalConflict extends HTMLElement {}
    customElements.define('scope-conflict', GlobalConflict);
    const scope = createScopedRegistry({ 'scope-conflict': ScopedChild });
    expect(scope.createElement('scope-conflict') instanceof ScopedChild).to.equal(true);
    expect(customElements.get('scope-conflict') === GlobalConflict).to.equal(true);
    const foreign = document.implementation.createHTMLDocument('');
    expect(() => scope.attachShadow(foreign.createElement('div'))).to.throw('target document');
    const foreignScope = createScopedRegistry({ 'scope-child': ScopedChild }, { document: foreign });
    expect(foreignScope.createElement('scope-child').ownerDocument === foreign).to.equal(true);
  });

  it('rejects missing template dependencies instead of consulting global definitions', function () {
    if (!supportsScopedRegistries()) this.skip();
    const scope = createScopedRegistry({ 'scope-parent': ScopedParent });
    const template = document.createElement('template');
    template.innerHTML = '<scope-child></scope-child>';
    expect(() => scope.creationScope.importNode(template.content, true)).to.throw('scope-child');
    expect(() => scope.createElement('missing-tag')).to.throw('missing-tag');
  });
});
