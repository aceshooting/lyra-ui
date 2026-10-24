import { expect, fixture, html } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { acquireAriaDescription, HostDescriptionController } from './aria-controls.js';

function descriptions(target: HTMLElement): Element[] {
  const reflected = Reflect.get(target, 'ariaDescribedByElements') as readonly Element[] | null | undefined;
  if (reflected) return [...reflected];
  return (target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    .map(id => target.ownerDocument.getElementById(id)).filter((element): element is HTMLElement => element !== null);
}

class ReentrantDescriptionTarget extends HTMLElement {
  static observedAttributes = ['aria-describedby'];
  onDescriptionChange?: () => void;
  attributeChangedCallback(): void { this.onDescriptionChange?.(); }
}
customElements.define('test-aria-description-reentry', ReentrantDescriptionTarget);

describe('description lease lifecycle boundaries', () => {
  it('releases required descriptions when the semantic target disappears or changes without losing authored baselines', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <span id="description-external">External</span><span id="description-required">Required</span>
      <span id="description-baseline">Baseline</span>
      <div data-host aria-describedby="description-external">
        <button id="first" aria-describedby="description-baseline">First</button>
        <button id="second" aria-describedby="description-baseline">Second</button>
        <button id="third" aria-describedby="description-baseline">Third</button>
      </div>
    </div>`);
    const controllers = new Set<ReactiveController>();
    const host = Object.assign(wrapper.querySelector<HTMLElement>('[data-host]')!, {
      addController: (controller: ReactiveController) => controllers.add(controller),
      removeController: (controller: ReactiveController) => controllers.delete(controller),
      requestUpdate() {}, updateComplete: Promise.resolve(true),
    }) satisfies HTMLElement & ReactiveControllerHost;
    const first = wrapper.querySelector<HTMLElement>('#first')!;
    const second = wrapper.querySelector<HTMLElement>('#second')!;
    const third = wrapper.querySelector<HTMLElement>('#third')!;
    let target: HTMLElement | null = first;
    let required: readonly Element[] = [wrapper.querySelector('#description-required')!];
    const controller = new HostDescriptionController(host, () => target, () => required);
    const ids = (element: HTMLElement) => descriptions(element).map(description => description.id);
    try {
      controller.refresh();
      expect(ids(first)).to.deep.equal(['description-external', 'description-baseline', 'description-required']);
      target = null;
      controller.refresh();
      expect(ids(first)).to.deep.equal(['description-baseline']);
      target = second;
      controller.refresh();
      expect(ids(second)).to.deep.equal(['description-external', 'description-baseline', 'description-required']);
      target = third;
      controller.refresh();
      expect(ids(second)).to.deep.equal(['description-baseline']);
      expect(ids(third)).to.deep.equal(['description-external', 'description-baseline', 'description-required']);
      required = [];
      controller.refresh();
      expect(ids(third)).to.deep.equal(['description-external', 'description-baseline']);
      host.remove();
      for (const item of controllers) item.hostDisconnected?.();
      expect(third.getAttribute('aria-describedby')).to.equal('description-baseline');
    } finally { controller.hostDisconnected(); }
  });

  it('owns a self-referencing description once and restores the absent baseline after release', async () => {
    const target = await fixture<HTMLElement>(html`<button id="description-self">Own description</button>`);
    const lease = acquireAriaDescription(target, [target, target]);
    try {
      expect(descriptions(target).map(element => element.id)).to.deep.equal(['description-self']);
      lease.update([target]);
      expect(descriptions(target).map(element => element.id)).to.deep.equal(['description-self']);
    } finally { lease.release(); }
    expect(target.hasAttribute('aria-describedby')).to.equal(false);
    expect(descriptions(target)).to.have.length(0);
  });

  it('retains the owned endpoint rather than a newly inserted duplicate ID and restores serialization after removal', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><button>Action</button>
      <span id="description-owned">Owned help</span><span data-idless>Additional help</span></div>`);
    const target = wrapper.querySelector('button')!;
    const endpoint = wrapper.querySelector('#description-owned')!;
    const idless = wrapper.querySelector('[data-idless]')!;
    const reflected = 'ariaDescribedByElements' in target;
    const lease = acquireAriaDescription(target, [endpoint, idless]);
    const duplicate = document.createElement('span');
    duplicate.id = endpoint.id;
    duplicate.textContent = 'Unrelated help';
    try {
      expect(descriptions(target).map(element => element.textContent)).to.deep.equal(reflected ? ['Owned help', 'Additional help'] : ['Owned help']);
      wrapper.insertBefore(duplicate, endpoint);
      lease.update([endpoint, idless]);
      expect(descriptions(target).map(element => element.textContent)).to.deep.equal(reflected ? ['Owned help', 'Additional help'] : []);
      duplicate.remove();
      lease.update([endpoint]);
      expect(target.getAttribute('aria-describedby')).to.equal('description-owned');
      expect(descriptions(target).map(element => element.textContent)).to.deep.equal(['Owned help']);
    } finally { duplicate.remove(); lease.release(); }
    expect(target.hasAttribute('aria-describedby')).to.equal(false);
  });

  it('honors release from a custom element attribute callback during a relationship update', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><span id="reentry-baseline">Baseline</span>
      <span id="reentry-first">First</span><span id="reentry-next">Next</span></div>`);
    const target = document.createElement('test-aria-description-reentry') as ReentrantDescriptionTarget;
    target.setAttribute('aria-describedby', 'reentry-baseline');
    wrapper.append(target);
    const lease = acquireAriaDescription(target, [wrapper.querySelector('#reentry-first')!]);
    let releases = 0;
    target.onDescriptionChange = () => {
      if (!target.getAttribute('aria-describedby')?.includes('reentry-next')) return;
      target.onDescriptionChange = undefined;
      releases++;
      lease.release();
    };
    try {
      lease.update([wrapper.querySelector('#reentry-next')!]);
      expect(releases).to.equal(1);
      expect(target.getAttribute('aria-describedby')).to.equal('reentry-baseline');
      lease.update([wrapper.querySelector('#reentry-first')!]);
      expect(target.getAttribute('aria-describedby')).to.equal('reentry-baseline');
    } finally { target.onDescriptionChange = undefined; lease.release(); }
  });
});
