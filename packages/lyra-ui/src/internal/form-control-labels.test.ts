import { expect } from '@open-wc/testing';
import type { ReactiveControllerHost } from 'lit';
import {
  ExternalLabelController,
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
  { name: 'icon-button', setup: (control) => { control.type = 'button'; } },
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
  for (const testCase of FACE_CASES) {
    it(`${testCase.name} forwards its external label name and activation to the semantic control`, async () => {
      const { container, control, label } = mountFace(testCase);
      try {
        await settle(control);
        const expectedName = label.textContent ?? '';
        const namedTargets = composedElements(control).filter(
          (element) => element !== control && element.getAttribute('aria-label') === expectedName,
        );
        expect(namedTargets.length, 'the role owner receives the external label name').to.be.greaterThan(0);

        const hostName = `Host ${testCase.name} label`;
        control.setAttribute('aria-label', hostName);
        await settle(control);
        const hostNamedTargets = composedElements(control).filter(
          (element) => element !== control && element.getAttribute('aria-label') === hostName,
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
        expect(
          isComposedDescendant(control, deepestActiveElement()),
          'label activation focuses a semantic descendant',
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

  for (const name of ['button', 'icon-button'] as const) {
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
});
