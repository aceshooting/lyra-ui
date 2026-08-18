import { expect, fixture, html } from '@open-wc/testing';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedAutofocusElements,
  collectComposedFocusTargets,
  isActionableElement,
  isComposedFocusAvailable,
  isSemanticActionElement,
} from './focus-navigation.js';

it('repairs focus after an owned focused branch disappears without overriding newer focus', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div><section id="owner"><button id="inside">Inside</button></section><button id="candidate">Candidate</button><button id="newer">Newer</button></div>
  `);
  const owner = root.querySelector<HTMLElement>('#owner')!;
  const inside = root.querySelector<HTMLButtonElement>('#inside')!;
  const candidate = root.querySelector<HTMLButtonElement>('#candidate')!;
  const newer = root.querySelector<HTMLButtonElement>('#newer')!;

  inside.focus();
  const repair = captureComposedFocusRepair(owner, candidate);
  expect(repair === null).to.equal(false);
  owner.remove();
  expect(applyComposedFocusRepair(repair!)).to.equal(true);
  expect(root.ownerDocument.activeElement?.id).to.equal('candidate');

  root.prepend(owner);
  inside.focus();
  const guarded = captureComposedFocusRepair(owner, candidate)!;
  newer.focus();
  owner.remove();
  expect(applyComposedFocusRepair(guarded)).to.equal(false);
  expect(root.ownerDocument.activeElement?.id).to.equal('newer');
});

it('does not capture unrelated focus and revalidates a repair candidate', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div><section id="owner"><button id="inside">Inside</button></section><button id="candidate">Candidate</button></div>
  `);
  const owner = root.querySelector<HTMLElement>('#owner')!;
  const inside = root.querySelector<HTMLButtonElement>('#inside')!;
  const candidate = root.querySelector<HTMLButtonElement>('#candidate')!;

  candidate.focus();
  expect(captureComposedFocusRepair(owner, candidate)).to.equal(null);
  inside.focus();
  const repair = captureComposedFocusRepair(owner, candidate)!;
  candidate.inert = true;
  expect(applyComposedFocusRepair(repair)).to.equal(false);
  expect(root.ownerDocument.activeElement?.id).to.equal('inside');
});

it('accepts a replacement candidate that only exists when the repair is applied', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div><section id="owner"><button id="inside">Inside</button></section><button id="fallback">Fallback</button></div>
  `);
  const owner = root.querySelector<HTMLElement>('#owner')!;
  const inside = root.querySelector<HTMLButtonElement>('#inside')!;
  const fallback = root.querySelector<HTMLButtonElement>('#fallback')!;
  inside.focus();
  const repair = captureComposedFocusRepair(owner, fallback)!;
  owner.remove();
  const replacement = document.createElement('button');
  replacement.id = 'replacement';
  root.prepend(replacement);

  expect(applyComposedFocusRepair(repair, replacement)).to.equal(true);
  expect(root.ownerDocument.activeElement?.id).to.equal('replacement');
});

it('rediscovers every managed native stop after a roving owner assigns tabindex -1', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div>
      <button id="first-managed" tabindex="-1">First</button>
      <span id="decoration">Decoration</span>
      <button id="second-managed" tabindex="-1">Second</button>
    </div>
  `);

  const result = collectComposedFocusTargets(root, { mode: 'programmatic' });
  expect(result.elements.map((element) => element.id)).to.deep.equal([
    'first-managed',
    'second-managed',
  ]);
  expect(result.truncated).to.equal(false);
});

it('uses owner-realm brands for native and ARIA actionability', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignButton = frame.contentDocument!.createElement('button');
  frame.contentDocument!.body.append(foreignButton);
  const roleAction = frame.contentDocument!.createElement('div');
  roleAction.setAttribute('role', 'menuitemcheckbox');
  frame.contentDocument!.body.append(roleAction);
  const decoration = frame.contentDocument!.createElement('span');

  expect(foreignButton instanceof HTMLElement).to.equal(false);
  expect(isActionableElement(foreignButton)).to.equal(true);
  expect(isActionableElement(roleAction)).to.equal(true);
  expect(isActionableElement(decoration)).to.equal(false);
  expect(collectComposedFocusTargets(frame.contentDocument!.body, { mode: 'programmatic' }).elements.length)
    .to.equal(2);
});

it('classifies realm-neutral sequential tabindex stops while retaining managed actions at -1', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  frame.contentDocument!.body.innerHTML = `
    <span id="zero" tabindex="0">Zero</span>
    <span id="positive" tabindex="3">Positive</span>
    <span id="negative" tabindex="-1">Negative</span>
    <button id="managed-native" tabindex="-1">Native</button>
    <span id="managed-aria" role="button" tabindex="-1">ARIA</span>
  `;
  const element = (id: string): Element => frame.contentDocument!.getElementById(id)!;

  expect(isActionableElement(element('zero'))).to.equal(true);
  expect(isActionableElement(element('positive'))).to.equal(true);
  expect(isActionableElement(element('negative'))).to.equal(false);
  expect(isActionableElement(element('managed-native'))).to.equal(true);
  expect(isActionableElement(element('managed-aria'))).to.equal(true);
});

it('classifies the complete native trigger vocabulary without structural lookalikes', () => {
  const root = document.createElement('div');
  root.innerHTML = `
    <a id="native-anchor" href="#target"></a>
    <map><area id="native-area" href="#target"></map>
    <details><summary id="native-summary"></summary></details>
    <iframe id="native-frame"></iframe><embed id="native-embed">
    <object id="native-object" data="data:text/html,Loaded"></object>
    <audio id="native-audio" controls></audio><video id="native-video" controls></video>
    <input id="native-input"><select id="native-select"></select><textarea id="native-textarea"></textarea>
  `;
  for (const id of [
    'native-anchor',
    'native-area',
    'native-summary',
    'native-frame',
    'native-embed',
    'native-object',
    'native-audio',
    'native-video',
    'native-input',
    'native-select',
    'native-textarea',
  ]) {
    expect(isActionableElement(root.querySelector(`#${id}`)!), id).to.equal(true);
  }
  const orphanArea = document.createElement('area');
  orphanArea.href = '#target';
  const orphanSummary = document.createElement('summary');
  expect(isActionableElement(orphanArea)).to.equal(false);
  expect(isActionableElement(orphanSummary)).to.equal(false);
  expect(isActionableElement({ localName: 'button' } as unknown as Element)).to.equal(false);
});

it('uses resolved native semantics and the first recognized ARIA role', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <embed id="embed-action" src="about:blank" />
      <input id="resolved-text-input" type=" hidden " />
      <span id="invalid-editable" contenteditable=" true ">Invalid editable token</span>
      <span id="valid-editable" contenteditable>Editable</span>
      <span id="non-widget-first" role="note button">Note</span>
      <span id="newer-non-widget-first" role="mark button">Mark</span>
      <span id="widget-after-unknown" role="unknown button">Button</span>
      <span id="progress-widget" role="progressbar">Progress</span>
      <span id="tabpanel-widget" role="tabpanel">Panel</span>
    </div>
  `);
  const element = (id: string): Element => root.querySelector(`#${id}`)!;

  expect(isSemanticActionElement(element('embed-action'))).to.equal(true);
  expect(isSemanticActionElement(element('resolved-text-input'))).to.equal(true);
  expect(isSemanticActionElement(element('invalid-editable'))).to.equal(false);
  expect(isSemanticActionElement(element('valid-editable'))).to.equal(true);
  expect(isSemanticActionElement(element('non-widget-first'))).to.equal(false);
  expect(isSemanticActionElement(element('newer-non-widget-first'))).to.equal(false);
  expect(isSemanticActionElement(element('widget-after-unknown'))).to.equal(true);
  expect(isSemanticActionElement(element('progress-widget'))).to.equal(false);
  expect(isSemanticActionElement(element('tabpanel-widget'))).to.equal(false);
});

it('matches native summary, editing-host, ARIA, SVG-link, and empty-object semantics', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <details open>
        <summary id="first-summary">First summary</summary>
        <summary id="second-summary">Second summary</summary>
      </details>
      <summary id="orphan-summary">Orphan summary</summary>
      <div id="outer-editable" contenteditable>
        <span id="nested-editable" contenteditable>Nested editable</span>
        <span id="invalid-inherited-editable" contenteditable=" true ">Invalid inherited editable</span>
        <span id="managed-nested-editable" contenteditable tabindex="0">Managed nested editable</span>
        <span contenteditable="false">
          <span id="reentered-editable" contenteditable>Re-entered editing host</span>
        </span>
      </div>
      <span id="progress-role" role="progressbar" aria-valuenow="50">Progress</span>
      <span id="tabpanel-role" role="tabpanel">Panel</span>
      <span id="switch-role" role="switch">Switch</span>
      <svg><a id="xlink-action" xlink:href="#target"><text>XLink action</text></a></svg>
      <object id="empty-object"></object>
      <object id="loaded-object" type="text/html" data="data:text/html,Loaded"></object>
      <object id="managed-object" tabindex="0"></object>
    </div>
  `);
  const element = (id: string): Element => root.querySelector(`#${id}`)!;

  expect(isSemanticActionElement(element('first-summary'))).to.equal(true);
  for (const id of [
    'second-summary',
    'orphan-summary',
    'nested-editable',
    'invalid-inherited-editable',
    'managed-nested-editable',
    'progress-role',
    'tabpanel-role',
    'empty-object',
  ]) {
    expect(isSemanticActionElement(element(id)), id).to.equal(false);
  }
  expect(isSemanticActionElement(element('outer-editable'))).to.equal(true);
  expect(isSemanticActionElement(element('reentered-editable'))).to.equal(true);
  expect(isSemanticActionElement(element('switch-role'))).to.equal(true);
  expect(isSemanticActionElement(element('xlink-action'))).to.equal(true);
  expect(isSemanticActionElement(element('loaded-object'))).to.equal(true);
  expect(isActionableElement(element('managed-nested-editable'))).to.equal(true);
  expect(isActionableElement(element('managed-object'))).to.equal(true);
});

it('treats editing hosts, but not nested editable descendants, as independent actions', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <div id="outer-editing-host" contenteditable>
        <span id="inherited-editable">Inherited editable descendant</span>
        <span id="nested-editing-host" contenteditable>Nested editing host</span>
        <span id="nested-tabbable-editing-host" contenteditable tabindex="0">
          Nested sequential editing host
        </span>
      </div>
    </div>
  `);
  const element = (id: string): HTMLElement => root.querySelector(`#${id}`)!;

  expect(isSemanticActionElement(element('outer-editing-host'))).to.equal(true);
  expect(isSemanticActionElement(element('inherited-editable'))).to.equal(false);
  expect(isSemanticActionElement(element('nested-editing-host'))).to.equal(false);
  expect(isSemanticActionElement(element('nested-tabbable-editing-host'))).to.equal(false);
  expect(isActionableElement(element('nested-tabbable-editing-host'))).to.equal(true);
  expect(collectComposedFocusTargets(root).elements.map((candidate) => candidate.id)).to.deep.equal([
    'outer-editing-host',
    'nested-tabbable-editing-host',
  ]);
  expect(
    collectComposedFocusTargets(root, { mode: 'programmatic' }).elements.map((candidate) => candidate.id),
  ).to.deep.equal([
    'outer-editing-host',
    'nested-tabbable-editing-host',
  ]);
});

it('uses native sequential defaults unless an authored negative tabindex opts out', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <embed id="default-embed" src="about:blank" />
      <audio id="default-audio" controls></audio>
      <video id="default-video" controls></video>
      <embed id="excluded-embed" src="about:blank" tabindex="-1" />
    </div>
  `);

  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.deep.equal([
    'default-embed',
    'default-audio',
    'default-video',
  ]);
  expect(collectComposedFocusTargets(root, { mode: 'programmatic' }).elements.map((element) => element.id))
    .to.include('excluded-embed');
});

it('includes SVG links and image-map areas as available composed focus targets', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <svg><a id="svg-link" href="#target"><text>SVG link</text></a></svg>
      <img alt="Map" usemap="#focus-map" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" />
      <map name="focus-map"><area id="map-area" href="#target" alt="Mapped action" /></map>
    </div>
  `);
  const svgLink = root.querySelector('#svg-link')!;
  const area = root.querySelector('#map-area')!;
  const orphanMap = document.createElement('map');
  orphanMap.name = 'orphan-map';
  const orphanArea = document.createElement('area');
  orphanArea.href = '#target';
  orphanMap.append(orphanArea);
  root.append(orphanMap);

  expect(isActionableElement(svgLink)).to.equal(true);
  expect(isComposedFocusAvailable(svgLink)).to.equal(true);
  expect(isComposedFocusAvailable(area)).to.equal(true);
  expect(isComposedFocusAvailable(orphanArea)).to.equal(false);
  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.include.members([
    'svg-link',
    'map-area',
  ]);
});

it('performs no rendered or consumer work with a zero traversal budget', async () => {
  const root = await fixture<HTMLElement>(html`<div><button>Action</button></div>`);
  const view = root.ownerDocument.defaultView!;
  const original = view.getComputedStyle;
  let styleReads = 0;
  view.getComputedStyle = function (...args: Parameters<typeof getComputedStyle>) {
    styleReads += 1;
    return original.apply(this, args);
  };
  try {
    const result = collectComposedFocusTargets(root, { maxNodes: 0 });
    expect(result.elements).to.deep.equal([]);
    expect(result.visitedElements).to.equal(0);
    expect(result.truncationReasons).to.include('nodes');
    expect(styleReads).to.equal(0);
  } finally {
    view.getComputedStyle = original;
  }
});

it('classifies authored sequential focus stops without treating plain tabindex -1 as an action', () => {
  const sequential = document.createElement('span');
  sequential.tabIndex = 0;
  const prioritized = document.createElement('div');
  prioritized.tabIndex = 2;
  const programmaticOnly = document.createElement('span');
  programmaticOnly.tabIndex = -1;
  const managedAction = document.createElement('button');
  managedAction.tabIndex = -1;

  expect(isActionableElement(sequential)).to.equal(true);
  expect(isActionableElement(prioritized)).to.equal(true);
  expect(isActionableElement(programmaticOnly)).to.equal(false);
  expect(isActionableElement(managedAction)).to.equal(true);
});

it('separates semantic actions from manager-authored tabindex across realms', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  frame.contentDocument!.body.innerHTML = `
    <span id="role" role="button" tabindex="0">Role</span>
    <a id="link" href="#target" tabindex="0">Link</a>
    <span id="editable" contenteditable tabindex="-1">Editable</span>
    <button id="native" tabindex="-1">Native</button>
  `;
  const element = (id: string): HTMLElement => frame.contentDocument!.getElementById(id)!;
  const role = element('role');
  const link = element('link');

  expect(isSemanticActionElement(role)).to.equal(true);
  expect(isSemanticActionElement(link)).to.equal(true);
  expect(isSemanticActionElement(element('editable'))).to.equal(true);
  expect(isSemanticActionElement(element('native'))).to.equal(true);
  role.removeAttribute('role');
  link.removeAttribute('href');
  expect(role.tabIndex).to.equal(0);
  expect(link.tabIndex).to.equal(0);
  expect(isSemanticActionElement(role)).to.equal(false);
  expect(isSemanticActionElement(link)).to.equal(false);
  expect(isActionableElement(role)).to.equal(true);
  expect(isActionableElement(link)).to.equal(true);
});

it('normalizes aria-hidden through composed ancestors and rejects inert branches', async () => {
  const tagName = 'test-focus-navigation-hidden-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(
    `<div aria-hidden=" TRUE "><${tagName}><button>Hidden</button></${tagName}></div>`,
  );
  const button = root.querySelector('button')!;

  expect(isComposedFocusAvailable(button)).to.equal(false);
  expect(collectComposedFocusTargets(root).elements.length).to.equal(0);

  root.removeAttribute('aria-hidden');
  root.setAttribute('inert', '');
  expect(isComposedFocusAvailable(button)).to.equal(false);
});

it('bounds deep composed traversal without recursive stack growth', () => {
  const root = document.createElement('div');
  let parent: Element = root;
  for (let index = 0; index < 5_000; index += 1) {
    const child = document.createElement('span');
    parent.append(child);
    parent = child;
  }
  const button = document.createElement('button');
  parent.append(button);
  document.body.append(root);
  try {
    const result = collectComposedFocusTargets(root, { maxDepth: 128, maxNodes: 512 });
    expect(result.truncated).to.equal(true);
    expect(result.visitedElements).to.be.at.most(512);
  } finally {
    root.remove();
  }
});

it('spends a tight node budget in composed pre-order instead of reserving it for later siblings', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div><span><button id="first-deep-stop">First</button></span><button id="later-stop">Later</button></div>
  `);
  const result = collectComposedFocusTargets(root, {
    maxNodes: 3,
    skipRootAncestorValidation: true,
  });

  expect(result.elements.map((element) => element.id)).to.deep.equal(['first-deep-stop']);
  expect(result.visitedElements).to.equal(3);
  expect(result.truncationReasons).to.include('nodes');
});

it('orders positive tabindex within each nested shadow navigation scope', async () => {
  const tagName = 'test-focus-navigation-scope-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML =
            '<button id="shadow-positive" tabindex="1">Shadow</button>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(`
    <div>
      <button id="outer-positive" tabindex="2">Outer positive</button>
      <${tagName}></${tagName}>
      <button id="outer-zero">Outer zero</button>
    </div>
  `);

  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.deep.equal([
    'outer-positive',
    'shadow-positive',
    'outer-zero',
  ]);
});

it('returns the delegated inner stop without duplicating its shadow host', async () => {
  const tagName = 'test-focus-navigation-delegates-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.tabIndex = 0;
          this.attachShadow({ mode: 'open', delegatesFocus: true }).innerHTML =
            '<button id="delegated-inner">Inner</button>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(`<div><${tagName} id="delegating-host"></${tagName}></div>`);

  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.deep.equal([
    'delegated-inner',
  ]);
});

it('does not invent a sequential stop for a delegatesFocus host with no inner target', async () => {
  const tagName = 'test-focus-navigation-empty-delegates-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.tabIndex = 0;
          this.attachShadow({ mode: 'open', delegatesFocus: true }).innerHTML = '<span>No action</span>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(
    `<div><${tagName} id="empty-delegating-host"></${tagName}><button id="after-empty-delegate">After</button></div>`,
  );

  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.deep.equal([
    'after-empty-delegate',
  ]);
});

it('removes a shadow navigation scope only for an authored negative host tabindex', async () => {
  const tagName = 'test-focus-navigation-negative-scope-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<button class="inner">Inner</button>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(`
    <div>
      <${tagName} id="default-scope"></${tagName}>
      <${tagName} id="negative-scope" tabindex="-1"></${tagName}>
      <button id="after-negative-scope">After</button>
    </div>
  `);
  const defaultInner = root.querySelector<HTMLElement>('#default-scope')!.shadowRoot!.querySelector('button')!;
  const negativeHost = root.querySelector<HTMLElement>('#negative-scope')!;
  const negativeInner = negativeHost.shadowRoot!.querySelector('button')!;
  const label = (element: HTMLElement): string => {
    if (element === defaultInner) return 'default-inner';
    if (element === negativeInner) return 'negative-inner';
    return element.id;
  };

  expect(collectComposedFocusTargets(root).elements.map(label)).to.deep.equal([
    'default-inner',
    'after-negative-scope',
  ]);
  expect(collectComposedFocusTargets(root, { mode: 'programmatic' }).elements.map(label)).to.deep.equal([
    'default-inner',
    'negative-scope',
    'negative-inner',
    'after-negative-scope',
  ]);
});

it('does not materialize flattened slot assignment arrays after exhausting its node budget', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<slot></slot>';
  for (let index = 0; index < 1_000; index += 1) {
    const button = document.createElement('button');
    button.textContent = `Action ${index}`;
    host.append(button);
  }
  const slot = shadow.querySelector('slot')!;
  let assignmentCalls = 0;
  const assignedNodes = slot.assignedNodes.bind(slot);
  const assignedElements = slot.assignedElements.bind(slot);
  Object.defineProperties(slot, {
    assignedNodes: {
      configurable: true,
      value: (...args: Parameters<HTMLSlotElement['assignedNodes']>) => {
        assignmentCalls += 1;
        return assignedNodes(...args);
      },
    },
    assignedElements: {
      configurable: true,
      value: (...args: Parameters<HTMLSlotElement['assignedElements']>) => {
        assignmentCalls += 1;
        return assignedElements(...args);
      },
    },
  });

  const result = collectComposedFocusTargets(slot, { maxNodes: 2 });

  expect(result.truncationReasons).to.include('nodes');
  expect(assignmentCalls).to.equal(0);
});

it('does not expose slot fallback actions when assigned text suppresses fallback content', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<slot><button id="suppressed-fallback">Fallback</button></slot>';
  host.append(document.createTextNode('Assigned text'));
  document.body.append(host);
  try {
    expect(collectComposedFocusTargets(host).elements.map((element) => element.id)).to.deep.equal([]);
  } finally {
    host.remove();
  }
});

it('charges composed-ancestor availability reads to the shared traversal budget', async () => {
  const outer = await fixture<HTMLElement>(html`<div></div>`);
  let parent = outer;
  for (let depth = 0; depth < 100; depth += 1) {
    const child = document.createElement('div');
    parent.append(child);
    parent = child;
  }
  const button = document.createElement('button');
  parent.append(button);
  const view = outer.ownerDocument.defaultView!;
  const original = view.getComputedStyle;
  let styleReads = 0;
  view.getComputedStyle = function (...args: Parameters<typeof getComputedStyle>) {
    styleReads += 1;
    return original.apply(this, args);
  };
  try {
    const result = collectComposedFocusTargets(button, { maxDepth: 256, maxNodes: 10 });
    expect(result.truncationReasons).to.include('nodes');
    expect(styleReads).to.be.at.most(10);
  } finally {
    view.getComputedStyle = original;
  }
});

it('bounds direct availability and focus-repair containment walks on deep branches', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><section id="owner"></section><button id="candidate">Candidate</button></div>
  `);
  const owner = root.querySelector<HTMLElement>('#owner')!;
  const candidate = root.querySelector<HTMLButtonElement>('#candidate')!;
  let parent = owner;
  for (let depth = 0; depth < 300; depth += 1) {
    const child = document.createElement('div');
    parent.append(child);
    parent = child;
  }
  const active = document.createElement('button');
  parent.append(active);
  active.focus();
  const view = root.ownerDocument.defaultView!;
  const original = view.getComputedStyle;
  let styleReads = 0;
  view.getComputedStyle = function (...args: Parameters<typeof getComputedStyle>) {
    styleReads += 1;
    return original.apply(this, args);
  };
  try {
    expect(isComposedFocusAvailable(active, { maxDepth: 32, maxNodes: 32 })).to.equal(false);
    expect(styleReads).to.be.at.most(32);
    expect(captureComposedFocusRepair(owner, candidate)).to.equal(null);
  } finally {
    view.getComputedStyle = original;
  }
});

it('charges image-map lookup and associated-image ancestry to the focus budget', async () => {
  const root = await fixture<HTMLElement>(html`<div></div>`);
  let imageParent = root;
  for (let depth = 0; depth < 600; depth += 1) {
    const child = document.createElement('div');
    imageParent.append(child);
    imageParent = child;
  }
  const image = document.createElement('img');
  image.useMap = '#bounded-map';
  image.alt = 'Mapped image';
  imageParent.append(image);
  const map = document.createElement('map');
  map.name = 'bounded-map';
  const area = document.createElement('area');
  area.href = '#target';
  area.alt = 'Mapped action';
  map.append(area);
  root.append(map);
  const view = root.ownerDocument.defaultView!;
  const original = view.getComputedStyle;
  let styleReads = 0;
  view.getComputedStyle = function (...args: Parameters<typeof getComputedStyle>) {
    styleReads += 1;
    return original.apply(this, args);
  };
  try {
    const result = collectComposedFocusTargets(area, {
      maxDepth: 1,
      maxNodes: 1,
      skipRootAncestorValidation: true,
    });
    expect(result.elements.map((element) => element.id)).to.deep.equal([]);
    expect(result.truncationReasons).to.include('nodes');
    expect(styleReads).to.be.at.most(1);
  } finally {
    view.getComputedStyle = original;
  }
});

it('chooses an unchecked radio group stop after positive-tabindex ordering', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <input id="radio-two" type="radio" name="ordered-radio" tabindex="2" />
      <input id="radio-one" type="radio" name="ordered-radio" tabindex="1" />
    </div>
  `);

  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.deep.equal([
    'radio-one',
  ]);
});

it('charges a closed-details summary search to the total focus budget', () => {
  const details = document.createElement('details');
  for (let index = 0; index < 1_000; index += 1) details.append(document.createElement('span'));
  const summary = document.createElement('summary');
  const button = document.createElement('button');
  button.textContent = 'Late action';
  summary.append(button);
  details.append(summary);

  const result = collectComposedFocusTargets(details, {
    maxNodes: 10,
    skipRootAncestorValidation: true,
  });

  expect(result.elements).to.deep.equal([]);
  expect(result.truncationReasons).to.include('nodes');
  expect(result.visitedElements).to.be.at.most(10);
});

it('excludes disabled native controls from availability and collected focus targets', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <button id="enabled-button">Enabled</button>
      <button id="disabled-button" disabled>Disabled</button>
      <input id="disabled-input" disabled />
    </div>
  `);
  const disabledButton = root.querySelector<HTMLButtonElement>('#disabled-button')!;
  const disabledInput = root.querySelector<HTMLInputElement>('#disabled-input')!;

  expect(isComposedFocusAvailable(disabledButton)).to.equal(false);
  expect(isComposedFocusAvailable(disabledInput)).to.equal(false);
  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.deep.equal([
    'enabled-button',
  ]);
});

it('treats a throwing checkVisibility implementation as unavailable rather than propagating', async () => {
  const root = await fixture<HTMLElement>(html`<div><button id="flaky">Flaky</button></div>`);
  const button = root.querySelector<HTMLButtonElement>('#flaky')!;
  const original = button.checkVisibility;
  button.checkVisibility = () => {
    throw new Error('boom');
  };
  try {
    expect(isComposedFocusAvailable(button)).to.equal(false);
  } finally {
    button.checkVisibility = original;
  }
});

it('prefers a checked radio over an earlier unchecked sibling in the same group', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <input id="radio-first" type="radio" name="preferred-radio" />
      <input id="radio-checked" type="radio" name="preferred-radio" checked />
    </div>
  `);

  expect(collectComposedFocusTargets(root).elements.map((element) => element.id)).to.deep.equal([
    'radio-checked',
  ]);
});

it('collects autofocus targets through nested shadow roots while honoring composed availability', async () => {
  const tagName = 'test-focus-navigation-autofocus-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML =
            '<button id="shadow-autofocus" autofocus>Shadow autofocus</button>';
        }
      },
    );
  }
  const root = await fixture<HTMLElement>(`
    <div>
      <button id="outer-autofocus" autofocus>Outer</button>
      <button id="hidden-autofocus" autofocus hidden>Hidden</button>
      <${tagName}></${tagName}>
    </div>
  `);

  expect(collectComposedAutofocusElements(root).elements.map((element) => element.id)).to.deep.equal([
    'outer-autofocus',
    'shadow-autofocus',
  ]);
});

it('gates a directly-passed shadow root by its own host availability', async () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<button id="shadow-button">Shadow</button>';
  document.body.append(host);
  try {
    expect(collectComposedFocusTargets(shadow).elements.map((element) => element.id)).to.deep.equal([
      'shadow-button',
    ]);
    host.inert = true;
    expect(collectComposedFocusTargets(shadow).elements).to.deep.equal([]);
  } finally {
    host.remove();
  }
});

it('treats a whitespace-only object data attribute as having no loaded content', () => {
  const root = document.createElement('div');
  root.innerHTML = '<object id="blank-data-object" data="   "></object>';
  expect(isSemanticActionElement(root.querySelector('#blank-data-object')!)).to.equal(false);
});

it('clamps a negative maxDepth to zero rather than accepting an unbounded value', async () => {
  const root = await fixture<HTMLElement>(html`<div><button id="child">Child</button></div>`);
  const result = collectComposedFocusTargets(root, { maxDepth: -10, includeRoot: false });
  expect(result.elements).to.deep.equal([]);
  expect(result.truncationReasons).to.include('depth');
});

it('groups many independent radios without repeated linear Array.find scans', () => {
  const root = document.createElement('div');
  for (let index = 0; index < 250; index += 1) {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `choice-${index}`;
    root.append(radio);
  }
  document.body.append(root);
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'find')!;
  let findCalls = 0;
  Object.defineProperty(Array.prototype, 'find', {
    ...descriptor,
    value(this: unknown[], ...args: Parameters<typeof Array.prototype.find>) {
      findCalls += 1;
      return Reflect.apply(descriptor.value as (...parameters: unknown[]) => unknown, this, args);
    },
  });
  try {
    expect(collectComposedFocusTargets(root).elements.length).to.equal(250);
  } finally {
    Object.defineProperty(Array.prototype, 'find', descriptor);
    root.remove();
  }
  expect(findCalls).to.equal(0);
});
