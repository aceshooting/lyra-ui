import { expect } from '@open-wc/testing';
import type { ReactiveControllerHost } from 'lit';
import {
  captureFormInternals,
  EXTERNAL_LABEL_HOST_SEMANTICS,
  ExternalLabelController,
  installFormControlLabelSupport,
  resolveExternalLabels,
  resolveExternalLabelText,
  type ExternalLabelHostSemanticOperation,
  type ExternalLabelHost,
} from './form-control-labels.js';
import { tag } from './prefix.js';

import '../components/agent-tools/tool-param-form/tool-param-form.js';
import '../components/conversation/chat-composer/chat-composer.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import '../components/data/graph-query-builder/graph-query-builder.js';
import '../components/forms/button/button.js';
import '../components/forms/checkbox-group/checkbox-group.js';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/code-editor/code-editor.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/emoji-picker/emoji-picker.js';
import '../components/forms/icon-button/icon-button.js';
import '../components/forms/input/input.js';
import '../components/forms/input/native-time-input.js';
import '../components/forms/input/number-input.js';
import '../components/forms/input/time-input.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/forms/otp-input/otp-input.js';
import '../components/forms/phone-input/phone-input.js';
import '../components/forms/radio/radio-button.js';
import '../components/forms/radio/radio-group.js';
import '../components/forms/radio/radio.js';
import '../components/forms/rubric-form/rubric-form.js';
import '../components/forms/select/select.js';
import '../components/forms/slider/slider.js';
import '../components/forms/switch/switch.js';
import '../components/forms/textarea/textarea.js';
import '../components/forms/time-range/time-range.js';
import '../components/forms/token-input/token-input.js';
import '../components/media/file-input/file-input.js';
import '../components/overlays/rating/rating.js';
import '../components/utility/known-date/known-date.js';

interface TestControl extends HTMLElement {
  disabled?: boolean;
  checked?: boolean;
  schema?: unknown;
  keys?: unknown[];
  type?: string;
  updateComplete?: Promise<unknown>;
}

interface FaceCase {
  name: string;
  setup?: (control: TestControl) => void;
}

const FACE_CASES: FaceCase[] = [
  {
    name: 'tool-param-form',
    setup: (control) => {
      control.schema = {
        type: 'object',
        properties: { title: { type: 'string', title: 'Title' } },
        required: ['title'],
      };
    },
  },
  { name: 'chat-composer' },
  { name: 'model-select' },
  { name: 'voice-picker' },
  { name: 'graph-query-builder' },
  { name: 'button', setup: (control) => { control.type = 'button'; control.textContent = 'Action'; } },
  {
    name: 'checkbox-group',
    setup: (control) => {
      const option = document.createElement(tag('checkbox'));
      option.textContent = 'Option';
      control.append(option);
    },
  },
  { name: 'checkbox', setup: (control) => { control.textContent = 'Option'; } },
  { name: 'code-editor' },
  { name: 'color-picker' },
  { name: 'combobox' },
  { name: 'date-input' },
  { name: 'emoji-picker' },
  // icon-button is deliberately excluded here: it is intentionally not form-associated (see its
  // class JSDoc -- "an action/link, not a form submitter") and LyraElement only installs an
  // ExternalLabelController for a `formAssociated` constructor, so the external-label-name/
  // activation contract this array feeds does not apply to it.
  { name: 'input' },
  { name: 'native-time-input' },
  { name: 'number-input' },
  { name: 'time-input' },
  { name: 'locale-picker' },
  { name: 'otp-input' },
  { name: 'phone-input' },
  { name: 'radio-button', setup: (control) => { control.textContent = 'Option'; } },
  {
    name: 'radio-group',
    setup: (control) => {
      const option = document.createElement(tag('radio'));
      option.textContent = 'Option';
      option.setAttribute('value', 'one');
      control.append(option);
    },
  },
  { name: 'radio', setup: (control) => { control.textContent = 'Option'; } },
  {
    name: 'rubric-form',
    setup: (control) => {
      control.keys = [{ key: 'accuracy', type: 'score', label: 'Accuracy', required: true }];
    },
  },
  { name: 'select' },
  { name: 'slider' },
  { name: 'switch', setup: (control) => { control.textContent = 'Option'; } },
  { name: 'textarea' },
  { name: 'time-range' },
  { name: 'token-input' },
  { name: 'file-input' },
  { name: 'rating' },
  { name: 'known-date' },
];

let nextFixtureId = 0;

function composedElements(root: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  const visited = new Set<Node>();
  const visit = (node: Node): void => {
    if (visited.has(node)) return;
    visited.add(node);
    if (node instanceof HTMLElement) {
      found.push(node);
      if (node instanceof HTMLSlotElement) {
        for (const assigned of node.assignedNodes({ flatten: true })) visit(assigned);
      }
      if (node.shadowRoot) visit(node.shadowRoot);
    }
    for (const child of node.childNodes) visit(child);
  };
  visit(root);
  return found;
}

function deepestActiveElement(rootDocument: Document = document): Element | null {
  let active: Element | null = rootDocument.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

function isComposedDescendant(host: HTMLElement, candidate: Element | null): boolean {
  let current: Node | null = candidate;
  while (current) {
    if (current === host) return true;
    const root: Node = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : current.parentNode;
  }
  return false;
}

async function settle(control: TestControl): Promise<void> {
  await control.updateComplete;
  const nested = composedElements(control)
    .map((element) => (element as TestControl).updateComplete)
    .filter((update): update is Promise<unknown> => update instanceof Promise);
  await Promise.all(nested);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function nextTask(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function settleControls(controls: readonly TestControl[]): Promise<void> {
  await Promise.all(controls.map((control) => control.updateComplete));
  await nextTask();
}

interface LabelReadCounter {
  readonly count: number;
  reset(): void;
}

async function withLabelReadCounter(run: (counter: LabelReadCounter) => Promise<void>): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(ElementInternals.prototype, 'labels');
  const nativeGet = descriptor?.get;
  expect(typeof nativeGet).to.equal('function');
  let count = 0;
  Object.defineProperty(ElementInternals.prototype, 'labels', {
    ...descriptor,
    configurable: true,
    get(this: ElementInternals) {
      count++;
      return nativeGet!.call(this) as NodeList;
    },
  });
  try {
    await run({
      get count() {
        return count;
      },
      reset() {
        count = 0;
      },
    });
  } finally {
    if (descriptor) Object.defineProperty(ElementInternals.prototype, 'labels', descriptor);
  }
}

function mountFace(testCase: FaceCase, fieldsetDisabled = false): {
  container: HTMLDivElement;
  control: TestControl;
  label: HTMLLabelElement;
} {
  const container = document.createElement('div');
  const form = document.createElement('form');
  const fieldset = document.createElement('fieldset');
  fieldset.disabled = fieldsetDisabled;
  const label = document.createElement('label');
  const control = document.createElement(tag(testCase.name)) as TestControl;
  const id = `external-label-control-${++nextFixtureId}`;
  control.id = id;
  label.htmlFor = id;
  label.textContent = `External ${testCase.name} label`;
  testCase.setup?.(control);
  fieldset.append(label, control);
  form.append(fieldset);
  container.append(form);
  document.body.append(container);
  return { container, control, label };
}

describe('external FACE label contract', () => {
  it('keeps repeated support installation idempotent', async () => {
    installFormControlLabelSupport();
    installFormControlLabelSupport();

    const testCase = FACE_CASES.find(({ name }) => name === 'checkbox');
    expect(testCase?.name).to.equal('checkbox');
    const { container, control, label } = mountFace(testCase!);
    try {
      await settle(control);
      expect(control.checked).to.be.false;
      label.click();
      await nextTask();
      expect(control.checked).to.be.true;
    } finally {
      container.remove();
    }
  });

  for (const testCase of FACE_CASES) {
    it(`${testCase.name} forwards its external label name and activation to the semantic control`, async () => {
      const { container, control, label } = mountFace(testCase);
      try {
        await settle(control);
        const hostOwnsSemantics = EXTERNAL_LABEL_HOST_SEMANTICS in control;
        const expectedName = label.textContent ?? '';
        const namedTargets = composedElements(control).filter(
          (element) => (hostOwnsSemantics ? element === control : element !== control)
            && element.getAttribute('aria-label') === expectedName,
        );
        expect(namedTargets.length, 'the role owner receives the external label name').to.be.greaterThan(0);

        const hostName = `Host ${testCase.name} label`;
        control.setAttribute('aria-label', hostName);
        await settle(control);
        const hostNamedTargets = composedElements(control).filter(
          (element) => (hostOwnsSemantics ? element === control : element !== control)
            && element.getAttribute('aria-label') === hostName,
        );
        expect(hostNamedTargets.length, 'host aria-label takes precedence on the role owner').to.be.greaterThan(0);

        // An untrusted click must not open a browser-owned file chooser during the contract run.
        for (const element of composedElements(control)) {
          if (element instanceof HTMLInputElement && element.type === 'file') {
            element.addEventListener('click', (event) => event.preventDefault(), { once: true });
          }
        }
        label.click();
        await settle(control);
        const active = deepestActiveElement();
        expect(
          hostOwnsSemantics
            ? active === control
            : active !== control && isComposedDescendant(control, active),
          hostOwnsSemantics
            ? 'label activation focuses the opted-in semantic host'
            : 'label activation focuses a semantic descendant',
        ).to.be.true;
      } finally {
        container.remove();
      }
    });
  }

  it('keeps host aria-label precedence while labels change and reassociate', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'input')!;
    const { container, control, label } = mountFace(testCase);
    const replacement = document.createElement('label');
    replacement.textContent = 'Replacement label';
    try {
      await settle(control);
      const semantic = composedElements(control).find(
        (element) => element !== control && element.getAttribute('aria-label') === label.textContent,
      );
      expect(semantic?.tagName ?? '').to.equal('INPUT');

      control.setAttribute('aria-label', 'Host override');
      label.textContent = 'Changed external label';
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Host override');

      control.removeAttribute('aria-label');
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Changed external label');

      label.htmlFor = 'another-control';
      replacement.htmlFor = control.id;
      container.prepend(replacement);
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Replacement label');

      control.remove();
      await Promise.resolve();
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Text');
    } finally {
      container.remove();
    }
  });

  it('discovers the first external label inserted after the control has settled', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'input')!;
    const container = document.createElement('div');
    const control = document.createElement(tag(testCase.name)) as TestControl;
    control.id = `external-label-control-${++nextFixtureId}`;
    container.append(control);
    document.body.append(container);
    try {
      await settle(control);
      const semantic = composedElements(control).find(
        (element) => element !== control && element.tagName === 'INPUT',
      );
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Text');

      const label = document.createElement('label');
      label.htmlFor = control.id;
      label.textContent = 'Inserted label';
      container.prepend(label);
      await Promise.resolve();
      await settle(control);

      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Inserted label');
    } finally {
      container.remove();
    }
  });

  it('targets explicit association changes among 500 controls', async () => {
    const container = document.createElement('div');
    const controls: TestControl[] = [];
    for (let index = 0; index < 500; index++) {
      const control = document.createElement(tag('input')) as TestControl;
      control.id = `indexed-label-control-${index}`;
      controls.push(control);
      container.append(control);
    }
    document.body.append(container);
    try {
      await settleControls(controls);
      await withLabelReadCounter(async (reads) => {
        const counts = {
          unrelatedId: 0,
          explicitInsertion: 0,
          forReassociation: 0,
          duplicateInsertion: 0,
          duplicateRemoval: 0,
          hostIdMutation: 0,
          subtreeInsertion: 0,
          subtreeRemoval: 0,
        };
        const unrelated = document.createElement('div');
        unrelated.id = 'unrelated-association-id';
        container.prepend(unrelated);
        await nextTask();
        counts.unrelatedId = reads.count;

        const label = document.createElement('label');
        label.htmlFor = controls[37]!.id;
        label.textContent = 'Indexed target label';
        reads.reset();
        container.prepend(label);
        await nextTask();
        counts.explicitInsertion = reads.count;

        reads.reset();
        label.htmlFor = controls[81]!.id;
        await nextTask();
        counts.forReassociation = reads.count;

        const blocker = document.createElement('input');
        blocker.id = controls[81]!.id;
        reads.reset();
        container.prepend(blocker);
        await nextTask();
        counts.duplicateInsertion = reads.count;

        reads.reset();
        blocker.remove();
        await nextTask();
        counts.duplicateRemoval = reads.count;

        reads.reset();
        controls[120]!.id = 'indexed-label-control-renamed';
        await nextTask();
        counts.hostIdMutation = reads.count;

        const wrapper = document.createElement('div');
        const nestedLabel = document.createElement('label');
        nestedLabel.htmlFor = controls[203]!.id;
        nestedLabel.textContent = 'Nested explicit label';
        wrapper.append(nestedLabel);
        reads.reset();
        container.append(wrapper);
        await nextTask();
        counts.subtreeInsertion = reads.count;

        reads.reset();
        wrapper.remove();
        await nextTask();
        counts.subtreeRemoval = reads.count;

        expect(counts).to.deep.equal({
          unrelatedId: 0,
          explicitInsertion: 1,
          forReassociation: 2,
          duplicateInsertion: 1,
          duplicateRemoval: 1,
          hostIdMutation: 1,
          subtreeInsertion: 1,
          subtreeRemoval: 1,
        });
        const semantic = composedElements(controls[81]!).find(
          (element) => element !== controls[81] && element.tagName === 'INPUT',
        );
        expect(semantic?.getAttribute('aria-label') ?? null).to.equal(label.textContent);
      });
    } finally {
      container.remove();
    }
  });

  it('targets implicit association shape changes among 500 controls', async function () {
    // 500 real DOM controls plus their MutationObserver-driven label-read bookkeeping comfortably
    // clears mocha's 6000ms default alone, but has been observed to exceed it when running deep
    // inside a full multi-hundred-file engine suite under load. Widen with headroom rather than
    // fight the shared session's timing.
    this.timeout(20000);
    const container = document.createElement('div');
    const labels: HTMLLabelElement[] = [];
    const controls: TestControl[] = [];
    for (let index = 0; index < 500; index++) {
      const label = document.createElement('label');
      const control = document.createElement(tag('input')) as TestControl;
      control.id = `implicit-label-control-${index}`;
      label.append(`Implicit ${index}`, control);
      labels.push(label);
      controls.push(control);
      container.append(label);
    }
    const unrelated = document.createElement('label');
    unrelated.setAttribute('for', '');
    unrelated.textContent = 'Unrelated empty for';
    container.append(unrelated);
    document.body.append(container);
    try {
      await settleControls(controls);
      await withLabelReadCounter(async (reads) => {
        const counts = {
          unrelatedEmptyFor: 0,
          implicitToExplicit: 0,
          explicitRetarget: 0,
          removedFor: 0,
          precedingLabelableInsertion: 0,
          precedingLabelableRemoval: 0,
        };

        unrelated.htmlFor = 'not-a-control';
        await nextTask();
        counts.unrelatedEmptyFor = reads.count;

        reads.reset();
        labels[123]!.htmlFor = controls[123]!.id;
        await nextTask();
        counts.implicitToExplicit = reads.count;

        reads.reset();
        labels[123]!.htmlFor = controls[124]!.id;
        await nextTask();
        counts.explicitRetarget = reads.count;

        reads.reset();
        labels[123]!.removeAttribute('for');
        await nextTask();
        counts.removedFor = reads.count;

        const predecessor = document.createElement('input');
        reads.reset();
        labels[300]!.insertBefore(predecessor, controls[300]!);
        await nextTask();
        counts.precedingLabelableInsertion = reads.count;

        reads.reset();
        predecessor.remove();
        await nextTask();
        counts.precedingLabelableRemoval = reads.count;

        expect(counts).to.deep.equal({
          unrelatedEmptyFor: 0,
          implicitToExplicit: 1,
          explicitRetarget: 2,
          removedFor: 2,
          precedingLabelableInsertion: 1,
          precedingLabelableRemoval: 1,
        });
        const restored = composedElements(controls[123]!).find(
          (element) => element !== controls[123] && element.tagName === 'INPUT',
        );
        const reacquired = composedElements(controls[300]!).find(
          (element) => element !== controls[300] && element.tagName === 'INPUT',
        );
        expect(restored?.getAttribute('aria-label') ?? null).to.equal('Implicit 123');
        expect(reacquired?.getAttribute('aria-label') ?? null).to.equal('Implicit 300');
      });
    } finally {
      container.remove();
    }
  });

  it('bounds association-candidate traversal across wide text-only mutations', async () => {
    const container = document.createElement('div');
    const control = document.createElement(tag('input')) as TestControl;
    control.id = 'bounded-association-traversal';
    container.append(control);
    document.body.append(container);
    await settle(control);

    const descriptor = Object.getOwnPropertyDescriptor(NodeList.prototype, Symbol.iterator);
    const nativeIterator = descriptor?.value as (() => IterableIterator<Node>) | undefined;
    expect(typeof nativeIterator).to.equal('function');
    let visitedTextNodes = 0;
    Object.defineProperty(NodeList.prototype, Symbol.iterator, {
      ...descriptor,
      configurable: true,
      *value(this: NodeList) {
        for (const node of nativeIterator!.call(this)) {
          if (node.nodeType === Node.TEXT_NODE && node.parentNode === container) visitedTextNodes++;
          yield node;
        }
      },
    });
    try {
      const textNodes = Array.from({ length: 10_000 }, (_, index) => document.createTextNode(String(index)));
      container.append(...textNodes);
      await nextTask();
      expect(visitedTextNodes, 'all node types share the mutation traversal ceiling').to.be.at.most(2_048);
    } finally {
      Object.defineProperty(NodeList.prototype, Symbol.iterator, descriptor!);
      container.remove();
    }
  });

  it('reacquires an implicit label through the partial-DOM fallback', async () => {
    const label = document.createElement('label');
    const host = document.createElement('div') as unknown as ExternalLabelHost & ReactiveControllerHost;
    const shadow = host.attachShadow({ mode: 'open' });
    const target = document.createElement('input');
    shadow.append(target);
    Object.defineProperty(host, 'renderRoot', { configurable: true, value: shadow });
    label.append('Fallback label', host);
    document.body.append(label);
    const controller = new ExternalLabelController(host);
    try {
      controller.hostConnected();
      expect(target.getAttribute('aria-label')).to.equal('Fallback label');

      const predecessor = document.createElement('input');
      label.insertBefore(predecessor, host);
      await nextTask();
      expect(target.getAttribute('aria-label')).to.equal(null);

      predecessor.remove();
      await nextTask();
      expect(target.getAttribute('aria-label')).to.equal('Fallback label');
    } finally {
      controller.hostDisconnected();
      label.remove();
    }
  });

  it('yields a 500-control fallback after 256 refreshes without delaying exact targets', async () => {
    const container = document.createElement('div');
    const controls = Array.from({ length: 500 }, (_, index) => {
      const control = document.createElement(tag('input')) as TestControl;
      control.id = `fallback-label-control-${index}`;
      return control;
    });
    container.append(...controls);
    document.body.append(container);
    let laterObserver: MutationObserver | undefined;
    try {
      await settleControls(controls);
      await withLabelReadCounter(async (reads) => {
        const semantic = composedElements(controls[499]!).find(
          (element) => element !== controls[499] && element.tagName === 'INPUT',
        );
        let nameSeenByLaterObserver: string | null | undefined;
        laterObserver = new MutationObserver(() => {
          nameSeenByLaterObserver = semantic?.getAttribute('aria-label');
        });
        laterObserver.observe(container, { childList: true });

        const large = document.createElement('div');
        const exactLabel = document.createElement('label');
        exactLabel.htmlFor = controls[499]!.id;
        exactLabel.textContent = 'Exact target before truncation';
        large.append(exactLabel, ...Array.from({ length: 2_049 }, () => document.createElement('span')));
        container.append(large);
        const firstTaskReads = await new Promise<number>((resolve) => {
          setTimeout(() => resolve(reads.count), 0);
        });
        await nextTask();
        expect(nameSeenByLaterObserver ?? null).to.equal(exactLabel.textContent);
        expect({ firstTaskReads, finalReads: reads.count }).to.deep.equal({
          firstTaskReads: 256,
          finalReads: 500,
        });
      });
    } finally {
      laterObserver?.disconnect();
      container.remove();
    }
  });

  it('refreshes a targeted label before later mutation observers run', async () => {
    const container = document.createElement('div');
    const control = document.createElement(tag('input')) as TestControl;
    control.id = 'association-observer-order';
    container.append(control);
    document.body.append(container);
    try {
      await settle(control);
      const semantic = composedElements(control).find(
        (element) => element !== control && element.tagName === 'INPUT',
      );
      let nameSeenByLaterObserver: string | null | undefined;
      const laterObserver = new MutationObserver(() => {
        nameSeenByLaterObserver = semantic?.getAttribute('aria-label');
      });
      laterObserver.observe(container, { childList: true });

      const label = document.createElement('label');
      label.htmlFor = control.id;
      label.textContent = 'Synchronous observer label';
      container.prepend(label);
      await nextTask();
      laterObserver.disconnect();

      expect(nameSeenByLaterObserver ?? null).to.equal(label.textContent);
    } finally {
      container.remove();
    }
  });

  it('keeps 500-control shadow, adoption, and disconnect indexes exact', async () => {
    const owner = document.createElement('div');
    const shadow = owner.attachShadow({ mode: 'open' });
    const controls = Array.from({ length: 500 }, (_, index) => {
      const control = document.createElement(tag('input')) as TestControl;
      control.id = `shadow-label-control-${index}`;
      return control;
    });
    shadow.append(...controls);
    const frame = document.createElement('iframe');
    document.body.append(owner, frame);
    try {
      await settleControls(controls);
      await withLabelReadCounter(async (reads) => {
        const counts = {
          shadowUnrelated: 0,
          shadowExplicit: 0,
          disconnected: 0,
          adoptedExplicit: 0,
        };
        const unrelated = document.createElement('div');
        unrelated.id = 'unrelated-shadow-id';
        shadow.prepend(unrelated);
        await nextTask();
        counts.shadowUnrelated = reads.count;

        const label = document.createElement('label');
        label.htmlFor = controls[200]!.id;
        label.textContent = 'Shadow label';
        reads.reset();
        shadow.prepend(label);
        await nextTask();
        counts.shadowExplicit = reads.count;

        controls[200]!.remove();
        await nextTask();
        reads.reset();
        label.setAttribute('for', controls[200]!.id);
        await nextTask();
        counts.disconnected = reads.count;

        const foreignDocument = frame.contentDocument!;
        foreignDocument.body.append(controls[201]!);
        await nextTask();
        reads.reset();
        const foreignLabel = foreignDocument.createElement('label');
        foreignLabel.htmlFor = controls[201]!.id;
        foreignLabel.textContent = 'Adopted label';
        foreignDocument.body.prepend(foreignLabel);
        await nextTask();
        counts.adoptedExplicit = reads.count;

        expect(counts).to.deep.equal({
          shadowUnrelated: 0,
          shadowExplicit: 1,
          disconnected: 0,
          adoptedExplicit: 1,
        });
        const adoptedSemantic = composedElements(controls[201]!).find(
          (element) => element !== controls[201] && element.tagName === 'INPUT',
        );
        expect(adoptedSemantic?.getAttribute('aria-label') ?? null).to.equal(foreignLabel.textContent);
      });
    } finally {
      frame.remove();
      owner.remove();
    }
  });

  it('restores the ElementInternals labels getter when instrumentation throws', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(ElementInternals.prototype, 'labels');
    const marker = new Error('expected instrumentation failure');
    let caught: unknown;
    try {
      await withLabelReadCounter(async () => {
        throw marker;
      });
    } catch (error) {
      caught = error;
    }
    const restored = Object.getOwnPropertyDescriptor(ElementInternals.prototype, 'labels');
    expect(caught === marker).to.be.true;
    expect(restored?.get === descriptor?.get).to.be.true;
  });

  it('withdraws a removed label and discovers its replacement without a control render', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'input')!;
    const { container, control, label } = mountFace(testCase);
    try {
      await settle(control);
      const semantic = composedElements(control).find(
        (element) => element !== control && element.tagName === 'INPUT',
      );
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal(label.textContent);

      label.remove();
      await Promise.resolve();
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Text');

      const replacement = document.createElement('label');
      replacement.htmlFor = control.id;
      replacement.textContent = 'Replacement without reassignment';
      container.prepend(replacement);
      await Promise.resolve();
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal(replacement.textContent);
    } finally {
      container.remove();
    }
  });

  it('tracks native reassociation when a duplicate id enters and leaves the document', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'input')!;
    const { container, control, label } = mountFace(testCase);
    const fieldset = control.closest('fieldset')!;
    const blocker = document.createElement('input');
    blocker.id = control.id;
    try {
      await settle(control);
      const semantic = composedElements(control).find(
        (element) => element !== control && element.tagName === 'INPUT',
      );
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal(label.textContent);

      fieldset.prepend(blocker);
      await Promise.resolve();
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Text');

      blocker.remove();
      await Promise.resolve();
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal(label.textContent);
    } finally {
      container.remove();
    }
  });

  for (const name of ['tool-param-form', 'rubric-form', 'time-range'] as const) {
    it(`${name} names its aggregate role and gives host aria-label precedence`, async () => {
      const testCase = FACE_CASES.find((entry) => entry.name === name)!;
      const { container, control, label } = mountFace(testCase);
      try {
        await settle(control);
        const aggregate = control.shadowRoot?.querySelector('[part~="base"][role="group"]');
        expect(aggregate?.getAttribute('aria-label') ?? null).to.equal(label.textContent);

        control.setAttribute('aria-label', 'Host aggregate name');
        await settle(control);
        expect(aggregate?.getAttribute('aria-label') ?? null).to.equal('Host aggregate name');
      } finally {
        container.remove();
      }
    });
  }

  for (const name of ['checkbox', 'switch', 'radio', 'radio-button'] as const) {
    it(`${name} activates exactly once`, async () => {
      const testCase = FACE_CASES.find((entry) => entry.name === name)!;
      const { container, control, label } = mountFace(testCase);
      try {
        await settle(control);
        expect(Boolean(control.checked)).to.be.false;
        label.click();
        await settle(control);
        expect(Boolean(control.checked), 'one label click must not double-toggle').to.be.true;
      } finally {
        container.remove();
      }
    });
  }

  it('honors cancellation of the label click before focus or toggle activation', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'checkbox')!;
    const { container, control, label } = mountFace(testCase);
    try {
      await settle(control);
      label.addEventListener('click', (event) => event.preventDefault());
      label.click();
      await settle(control);

      expect(Boolean(control.checked)).to.be.false;
      expect(isComposedDescendant(control, deepestActiveElement())).to.be.false;
    } finally {
      container.remove();
    }
  });

  it('does not activate a label retargeted before its mutation observer delivers', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'checkbox')!;
    const { container, control, label } = mountFace(testCase);
    try {
      await settle(control);
      label.htmlFor = 'another-control';
      label.click();
      await settle(control);

      expect(Boolean(control.checked)).to.be.false;
      expect(isComposedDescendant(control, deepestActiveElement())).to.be.false;
    } finally {
      container.remove();
    }
  });

  it('does not activate when a later label listener retargets it during propagation', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'checkbox')!;
    const { container, control, label } = mountFace(testCase);
    try {
      await settle(control);
      label.addEventListener('click', () => {
        label.htmlFor = 'another-control';
      });
      label.click();
      await settle(control);

      expect(Boolean(control.checked)).to.be.false;
      expect(isComposedDescendant(control, deepestActiveElement())).to.be.false;
    } finally {
      container.remove();
    }
  });

  it('does not activate after a later label listener disconnects the control', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'checkbox')!;
    const { container, control, label } = mountFace(testCase);
    try {
      await settle(control);
      label.addEventListener('click', () => control.remove());
      label.click();
      await Promise.resolve();

      expect(Boolean(control.checked)).to.be.false;
      expect(isComposedDescendant(control, deepestActiveElement())).to.be.false;
    } finally {
      container.remove();
    }
  });

  for (const name of ['input', 'checkbox', 'button'] as const) {
    it(`${name} stays inert when disabled by an ancestor fieldset`, async () => {
      const testCase = FACE_CASES.find((entry) => entry.name === name)!;
      const { container, control, label } = mountFace(testCase, true);
      try {
        await settle(control);
        const before = Boolean(control.checked);
        label.click();
        await settle(control);
        expect(isComposedDescendant(control, deepestActiveElement())).to.be.false;
        expect(Boolean(control.checked)).to.equal(before);
      } finally {
        container.remove();
      }
    });
  }

  // icon-button dropped `type`/submit-reset handling in 9.0 (cd4f2d22) along with form
  // association -- its class JSDoc points submit/reset use cases at
  // `<lr-button circle type="submit|reset">` instead, so it no longer belongs in this loop.
  for (const name of ['button'] as const) {
    it(`${name} preserves one submit and one reset activation`, async () => {
      const testCase = FACE_CASES.find((entry) => entry.name === name)!;
      const { container, control, label } = mountFace(testCase);
      const form = control.closest('form')!;
      let submits = 0;
      let resets = 0;
      form.addEventListener('submit', (event) => { event.preventDefault(); submits += 1; });
      form.addEventListener('reset', () => { resets += 1; });
      try {
        await settle(control);
        control.type = 'submit';
        await settle(control);
        label.click();
        await settle(control);
        expect(submits).to.equal(1);

        control.type = 'reset';
        await settle(control);
        label.click();
        await settle(control);
        expect(resets).to.equal(1);
      } finally {
        container.remove();
      }
    });
  }

  it('an implicit ancestor label names and toggles the control exactly once', async () => {
    const container = document.createElement('div');
    const label = document.createElement('label');
    const control = document.createElement(tag('checkbox')) as TestControl;
    control.textContent = 'Option';
    label.append('Wrapping label ', control);
    container.append(label);
    document.body.append(container);
    try {
      await settle(control);
      const named = composedElements(control).filter(
        (element) => element !== control && element.getAttribute('aria-label') === 'Wrapping label',
      );
      expect(named.length, 'an implicit label names the role owner too').to.be.greaterThan(0);

      // Clicking the control itself must run only the control's own activation: the label's
      // activation behaviour is defined not to re-fire for a click that started inside it.
      control.click();
      await settle(control);
      expect(Boolean(control.checked), 'a click on the control toggles once').to.be.true;

      // Clicking the label's own text is the one case that forwards.
      label.click();
      await settle(control);
      expect(Boolean(control.checked), 'a label click toggles once more').to.be.false;
    } finally {
      container.remove();
    }
  });

  it('drops its label listeners when the control disconnects', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'checkbox')!;
    const { container, control, label } = mountFace(testCase);
    try {
      await settle(control);
      control.remove();
      await settle(control);
      label.click();
      await settle(control);
      expect(Boolean(control.checked), 'a disconnected control ignores its former label').to.be.false;
      expect(isComposedDescendant(control, deepestActiveElement())).to.be.false;
    } finally {
      container.remove();
    }
  });

  it('reapplies the external name after the control reconnects', async () => {
    const testCase = FACE_CASES.find(({ name }) => name === 'input')!;
    const { container, control, label } = mountFace(testCase);
    const host = label.parentElement!;
    try {
      await settle(control);
      const semantic = composedElements(control).find(
        (element) => element !== control && element.getAttribute('aria-label') === label.textContent,
      );
      expect(semantic?.tagName ?? '').to.equal('INPUT');

      control.remove();
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Text');

      host.append(control);
      await settle(control);
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal(label.textContent);
    } finally {
      container.remove();
    }
  });

  it('resolves labels and focused descendants against the host owner document', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const foreignDocument = frame.contentDocument!;
    const host = foreignDocument.createElement('div');
    host.id = `external-label-control-${++nextFixtureId}`;
    const shadow = host.attachShadow({ mode: 'open' });
    const first = foreignDocument.createElement('button');
    const preferred = foreignDocument.createElement('button');
    first.textContent = 'First';
    preferred.textContent = 'Preferred';
    shadow.append(first, preferred);
    Object.defineProperty(host, 'renderRoot', { configurable: true, value: shadow });
    host.focus = () => preferred.focus();
    const label = foreignDocument.createElement('label');
    label.htmlFor = host.id;
    label.textContent = 'Foreign document label';
    const controller = new ExternalLabelController(
      host as ExternalLabelHost & ReactiveControllerHost,
    );
    try {
      foreignDocument.body.append(label, host);
      controller.hostConnected();

      expect(first.getAttribute('aria-label')).to.equal(label.textContent);

      label.textContent = 'Updated foreign label';
      await Promise.resolve();
      await Promise.resolve();
      expect(first.getAttribute('aria-label')).to.equal(label.textContent);

      label.click();
      await Promise.resolve();
      expect(deepestActiveElement(foreignDocument) === preferred).to.be.true;
    } finally {
      controller.hostDisconnected();
      frame.remove();
    }
  });

  it('names and activates a form control whose host owns its role and focus', async () => {
    const host = document.createElement('div') as ExternalLabelHost & ReactiveControllerHost & {
      authoredName: string | null;
      externalName: string | null;
      [EXTERNAL_LABEL_HOST_SEMANTICS](operation: ExternalLabelHostSemanticOperation): boolean | void;
    };
    host.authoredName = null;
    host.externalName = null;
    host[EXTERNAL_LABEL_HOST_SEMANTICS] = (operation) => {
      if (operation.type === 'has-authored-name') return host.authoredName !== null;
      if (operation.type === 'apply') {
        host.externalName = operation.name;
        host.setAttribute('aria-label', operation.name);
        return;
      }
      host.externalName = null;
      if (host.getAttribute('aria-label') !== operation.appliedName) return;
      if (operation.hadPrevious) host.setAttribute('aria-label', operation.previous ?? '');
      else host.removeAttribute('aria-label');
    };
    host.tabIndex = 0;
    host.id = `external-label-control-${++nextFixtureId}`;
    host.setAttribute('aria-label', 'Generated fallback');
    const label = document.createElement('label');
    label.htmlFor = host.id;
    label.textContent = 'External host label';
    const controller = new ExternalLabelController(host);
    document.body.append(label, host);
    try {
      controller.hostConnected();
      expect(host.getAttribute('aria-label')).to.equal('External host label');
      label.click();
      await Promise.resolve();
      expect(document.activeElement === host).to.be.true;

      label.remove();
      await Promise.resolve();
      await Promise.resolve();
      expect(host.getAttribute('aria-label')).to.equal('Generated fallback');

      document.body.append(label);
      controller.hostUpdated();
      expect(host.getAttribute('aria-label')).to.equal('External host label');
      host.authoredName = 'Authored override';
      host.setAttribute('aria-label', host.authoredName);
      controller.hostUpdated();
      expect(host.getAttribute('aria-label')).to.equal('Authored override');
      expect(host.externalName).to.equal(null);
    } finally {
      controller.hostDisconnected();
      label.remove();
      host.remove();
    }
  });

  it('does not treat a control as implicitly associated when an earlier labelable sibling shares the same wrapping label', async () => {
    const container = document.createElement('div');
    const label = document.createElement('label');
    const earlier = document.createElement('input');
    const control = document.createElement(tag('input')) as TestControl;
    control.id = `external-label-control-${++nextFixtureId}`;
    label.append('Shared wrapper label ', earlier, control);
    container.append(label);
    document.body.append(container);
    try {
      await settle(control);
      const semantic = composedElements(control).find(
        (element) => element !== control && element.tagName === 'INPUT',
      );
      // The label's native `.control` resolves to `earlier`, the first labelable descendant, so
      // the wrapped `lr-input` is not the implicitly associated control and keeps its own
      // generated fallback name instead of inheriting the wrapper's text.
      expect(semantic?.getAttribute('aria-label') ?? null).to.equal('Text');
    } finally {
      container.remove();
    }
  });

  it('drops whitespace-only labels from the joined external name', () => {
    const blank = document.createElement('label');
    blank.textContent = '   ';
    const real = document.createElement('label');
    real.textContent = '  Real label  ';
    const another = document.createElement('label');
    another.textContent = 'Second';
    expect(resolveExternalLabelText([blank, real, another])).to.equal('Real label Second');
    expect(resolveExternalLabelText([blank])).to.equal('');
  });

  it('excludes the host subtree from an implicit label text while keeping surrounding text', () => {
    const label = document.createElement('label');
    const host = document.createElement('div');
    host.textContent = 'Yes';
    label.append('Remember me ', host, ' please');
    expect(resolveExternalLabelText([label], host)).to.equal('Remember me  please');
    expect(resolveExternalLabelText([label])).to.equal('Remember me Yes please');
  });

  it('trusts a captured native internals labels list exclusively, even when it is empty', () => {
    // resolveExternalLabels() only falls back to closest('label')/querySelectorAll('label[for]')
    // when no internals were ever captured for the host. Once ANY internals record exists, its
    // (possibly stale/empty) `.labels` list is authoritative -- a real `<label for>` in the DOM is
    // never independently rediscovered.
    const label = document.createElement('label');
    const host = document.createElement('div');
    host.id = 'empty-native-labels-host';
    label.htmlFor = host.id;
    label.textContent = 'Real DOM label';
    document.body.append(label, host);

    try {
      captureFormInternals(host, {
        labels: document.querySelectorAll('.nonexistent-empty-set'),
      } as ElementInternals);

      expect(resolveExternalLabels(host as ExternalLabelHost)).to.deep.equal([]);
    } finally {
      label.remove();
      host.remove();
    }
  });
});
