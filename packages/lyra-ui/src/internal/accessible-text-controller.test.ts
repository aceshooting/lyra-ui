import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { AccessibleTextController } from './accessible-text-controller.js';

function controllerHost(onAdd: (controller: ReactiveController) => void): HTMLElement & ReactiveControllerHost {
  return Object.assign(document.createElement('div'), {
    addController: onAdd,
    removeController: (_controller: ReactiveController) => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true),
  });
}

it('resumes label observation after disabling and reconnecting a preserved binding', async () => {
  const host = controllerHost(() => undefined);
  host.textContent = 'Initial';
  document.body.append(host);
  let changes = 0;
  const controller = new AccessibleTextController(host, [], () => { changes += 1; });
  const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  try {
    controller.hostConnected();
    controller.preserveBindingForNextUpdate();
    controller.hostUpdated();
    controller.setEnabled(false);
    host.textContent = 'Disabled';
    await turn();
    expect(changes).to.equal(0);
    controller.setEnabled(true);
    host.textContent = 'Enabled';
    await turn();
    expect(changes).to.be.greaterThan(0);
    expect(controller.text()).to.equal('Enabled');
    controller.preserveBindingForNextUpdate();
    controller.hostDisconnected();
    host.textContent = 'Disconnected';
    controller.hostConnected();
    controller.hostUpdated();
    const before = changes;
    host.textContent = 'Reconnected';
    await turn();
    expect(changes).to.be.greaterThan(before);
    expect(controller.text()).to.equal('Reconnected');
  } finally {
    controller.hostDisconnected();
    host.remove();
  }
});

for (const shadow of [false, true]) {
  it(`reads only selected light-DOM label content when ${shadow ? 'the shadow root has no matching slot' : 'no shadow root exists'}`, () => {
    const host = controllerHost(() => undefined);
    const defaultLabel = document.createElement('span');
    defaultLabel.textContent = 'Default label';
    host.append(defaultLabel);
    const label = document.createElement('span');
    label.slot = 'label';
    label.textContent = 'Named label';
    const hint = document.createElement('span');
    hint.slot = 'hint';
    hint.textContent = 'Unrelated hint';
    host.append(label, hint);
    if (shadow) host.attachShadow({ mode: 'open' }).innerHTML = '<slot name="hint"></slot>';
    const controller = new AccessibleTextController(host, ['label'], () => undefined);
    expect(controller.text()).to.equal('Named label');
    label.hidden = true;
    expect(controller.hasContent()).to.equal(false);
    expect(new AccessibleTextController(host, [''], () => undefined).text()).to.equal('Default label');
  });
}

it('tracks assigned label text and releases its observer across lifecycle changes', async () => {
  let lifecycle: ReactiveController | undefined;
  const host = controllerHost((controller) => { lifecycle = controller; });
  const root = host.attachShadow({ mode: 'open' });
  root.append(document.createElement('slot'));
  const label = document.createElement('span');
  label.textContent = 'First';
  host.append(label);
  document.body.append(host);
  let changes = 0;
  const controller = new AccessibleTextController(host, [''], () => { changes += 1; });
  try {
    lifecycle?.hostConnected?.();
    expect(controller.text()).to.equal('First');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    changes = 0;
    label.textContent = 'Second';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(controller.text()).to.equal('Second');
    expect(changes).to.be.greaterThan(0);
    const beforeUpdate = changes;
    label.textContent = 'Third';
    lifecycle?.hostUpdated?.();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.be.greaterThan(beforeUpdate);
    const beforeDisconnect = changes;
    lifecycle?.hostDisconnected?.();
    label.textContent = 'Fourth';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.equal(beforeDisconnect);
  } finally {
    lifecycle?.hostDisconnected?.();
    host.remove();
  }
});

it('ignores unrelated style writes on a forwarded label ancestor', async () => {
  const wrapper = document.createElement('div');
  const label = document.createElement('span');
  label.textContent = 'Forwarded';
  wrapper.append(label);
  let lifecycle: ReactiveController | undefined;
  const host = controllerHost((controller) => { lifecycle = controller; });
  host.append(document.createElement('slot'));
  wrapper.attachShadow({ mode: 'open' }).append(host);
  document.body.append(wrapper);
  let changes = 0;
  new AccessibleTextController(host, [], () => { changes += 1; });
  try {
    lifecycle?.hostConnected?.();
    label.textContent = 'Changed';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const baseline = changes;
    wrapper.style.color = 'red';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.equal(baseline);
  } finally {
    lifecycle?.hostDisconnected?.();
    wrapper.remove();
  }
});

it('ignores forwarded hint mutations while observing the selected label slot', async () => {
  const wrapper = document.createElement('div');
  const forwardedHint = document.createTextNode('First hint');
  wrapper.append(forwardedHint);
  let lifecycle: ReactiveController | undefined;
  const host = controllerHost((controller) => { lifecycle = controller; });
  const label = document.createTextNode('Label');
  const hint = document.createElement('span');
  hint.slot = 'hint';
  hint.append(document.createElement('slot'));
  host.append(label, hint);
  wrapper.attachShadow({ mode: 'open' }).append(host);
  document.body.append(wrapper);
  let changes = 0;
  new AccessibleTextController(host, [''], () => { changes += 1; }, ['slot']);
  try {
    lifecycle?.hostConnected?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    changes = 0;
    forwardedHint.data = 'Updated hint';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.equal(0);
    label.data = 'Updated label';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.equal(1);
    hint.removeAttribute('slot');
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.equal(2);
  } finally {
    lifecycle?.hostDisconnected?.();
    wrapper.remove();
  }
});

it('routes native forwarding slot changes through the slot owned by the label host', async () => {
  const wrapper = document.createElement('div');
  const hintText = document.createTextNode('Hint');
  const labelText = document.createElement('span');
  labelText.slot = 'label-source';
  labelText.textContent = 'Label';
  wrapper.append(hintText, labelText);
  let lifecycle: ReactiveController | undefined;
  const host = controllerHost((controller) => { lifecycle = controller; });
  host.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot><slot name="hint"></slot>';
  host.innerHTML = '<slot name="label-source"></slot><span slot="hint"><slot></slot></span>';
  wrapper.attachShadow({ mode: 'open' }).append(host);
  document.body.append(wrapper);
  let changes = 0;
  new AccessibleTextController(host, [''], () => { changes += 1; });
  try {
    lifecycle?.hostConnected?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    changes = 0;
    hintText.data = 'Updated hint';
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(changes, 'an unnamed outer forwarding slot feeds only the named hint slot').to.equal(0);
    labelText.textContent = 'Updated label';
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(changes, 'a named outer forwarding slot still feeds the default label slot').to.be.greaterThan(0);
  } finally {
    lifecycle?.hostDisconnected?.();
    wrapper.remove();
  }
});

it('wakes on a referenced label target only when reference tracking is requested', async () => {
  const container = document.createElement('div');
  const target = document.createElement('span');
  target.id = 'tracked-reference-label';
  target.textContent = 'Initial';
  let lifecycle: ReactiveController | undefined;
  const host = controllerHost((controller) => { lifecycle = controller; });
  const candidate = document.createElement('span');
  candidate.setAttribute('aria-labelledby', target.id);
  host.append(candidate);
  container.append(target, host);
  document.body.append(container);
  let changes = 0;
  new AccessibleTextController(host, [''], () => { changes += 1; }, [], true, true);
  try {
    lifecycle?.hostConnected?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    changes = 0;
    target.textContent = 'Updated';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.be.greaterThan(0);
    lifecycle?.hostDisconnected?.();
    changes = 0;
    target.textContent = 'After disconnect';
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(changes).to.equal(0);
  } finally {
    container.remove();
  }
});

it('shares ancestor observation across controllers and releases disconnected subscribers', async () => {
  const wrapper = document.createElement('div'); document.body.append(wrapper);
  const observers = new Set<MutationObserver>();
  const observe = MutationObserver.prototype.observe;
  MutationObserver.prototype.observe = function(target, options) {
    if (target === document.documentElement || target === document.body || target === wrapper) observers.add(this);
    return observe.call(this, target, options);
  };
  let changes = 0;
  const controllers: AccessibleTextController[] = [];
  const turn = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  try {
    for (let index = 0; index < 100; index++) {
      const host = controllerHost(() => undefined); host.textContent = `Label ${index}`; wrapper.append(host);
      const controller = new AccessibleTextController(host, [], () => changes++);
      controllers.push(controller); controller.hostConnected();
    }
    await turn(); changes = 0;
    expect(observers.size).equal(1);
    wrapper.hidden = true; await turn(); expect(changes).equal(100);
    for (const controller of controllers) controller.hostDisconnected();
    const previous = changes; wrapper.hidden = false; await turn(); expect(changes).equal(previous);
  } finally {
    for (const controller of controllers) controller.hostDisconnected();
    MutationObserver.prototype.observe = observe; wrapper.remove();
  }
});
it('delivers queued ancestor visibility before a host rebind and synchronous reads', async () => {
  const wrapper = document.createElement('div');
  const label = document.createElement('span'); label.textContent = 'Forwarded'; wrapper.append(label);
  const host = controllerHost(() => undefined); host.append(document.createElement('slot'));
  wrapper.attachShadow({ mode: 'open' }).append(host); document.body.append(wrapper);
  let cached = ''; let changes = 0;
  const controller = new AccessibleTextController(host, [''], () => { changes++; cached = controller.text(); });
  try {
    controller.hostConnected(); cached = controller.text(); expect(cached).equal('Forwarded');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    changes = 0;
    const update = Promise.resolve().then(() => controller.hostUpdated());
    wrapper.hidden = true;
    await update; await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(cached).equal(''); expect(changes).greaterThan(0);
    wrapper.hidden = false;
    controller.takeRecords();
    expect(cached).equal('Forwarded');
    controller.hostDisconnected(); const before = changes;
    wrapper.hidden = true; await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(changes).equal(before);
  } finally { controller.hostDisconnected(); wrapper.remove(); }
});
