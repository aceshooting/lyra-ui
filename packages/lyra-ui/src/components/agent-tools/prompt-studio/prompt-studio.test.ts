import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './prompt-studio.js';
import type {
  LyraPromptStudio,
  PromptStudioMessage,
  PromptStudioMessageReorderDetail,
  PromptStudioVersion,
} from './prompt-studio.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const messages: PromptStudioMessage[] = [
  { id: 'system', role: 'system', content: 'Answer for {{audience}}.' },
  { id: 'user', role: 'user', content: 'Explain retrieval.' },
];
const versions: PromptStudioVersion[] = [{ id: 'v1', label: 'Production', messages }];
const reorderMessages: PromptStudioMessage[] = [
  { id: 'system', role: 'system', content: 'Define the answer.' },
  { id: 'user', role: 'user', content: 'Explain the tradeoff.' },
  { id: 'assistant', role: 'assistant', content: 'I will compare both options.' },
];

it('renders messages, resolves variables in preview, and exposes versions', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio
      .messages=${messages}
      .variables=${[{ name: 'audience', value: 'developers' }]}
      .versions=${versions}
    ></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  expect(el.shadowRoot!.querySelectorAll('[part="message"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelector('[part="preview"]')!.textContent).to.contain('Answer for developers.');
  expect(el.shadowRoot!.querySelector('[data-version-id="v1"]')).to.exist;
});

it('omits empty or blank message and version ids and uses the first duplicate', async () => {
  const duplicateMessages: PromptStudioMessage[] = [
    { id: '', role: 'user', content: 'Missing identity' },
    { id: '   ', role: 'user', content: 'Blank identity' },
    { id: 'same', role: 'user', content: 'First message' },
    { id: 'same', role: 'assistant', content: 'Second message' },
  ];
  const duplicateVersions: PromptStudioVersion[] = [
    { id: '', label: 'Missing identity', messages: [] },
    { id: '   ', label: 'Blank identity', messages: [] },
    { id: 'same-version', label: 'First version', messages: [] },
    { id: 'same-version', label: 'Second version', messages: [] },
  ];
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio .messages=${duplicateMessages} .versions=${duplicateVersions}></lr-prompt-studio>
  `);

  expect(el.shadowRoot!.querySelectorAll('[part="message"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!.value).to.equal('First message');
  expect(el.shadowRoot!.querySelectorAll('[part="version"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="version"]')!.textContent!.trim()).to.equal('First version');

  const pending = oneEvent(el, 'lr-change');
  const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!;
  textarea.value = 'Edited first';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  const detail = (await pending).detail;
  expect(detail.messages).to.deep.equal([{ id: 'same', role: 'user', content: 'Edited first' }]);
});

it('keeps duplicate variable names occurrence-addressable while resolving the first definition', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio
      .messages=${[{ id: 'one', role: 'user', content: '{{audience}}' }]}
      .variables=${[
        { name: 'audience', value: 'first' },
        { name: 'audience', value: 'second' },
      ]}
    ></lr-prompt-studio>
  `);
  expect(el.shadowRoot!.querySelector('[part="preview"]')!.textContent).to.contain('first');
  expect(el.shadowRoot!.querySelector('[part="preview"]')!.textContent).not.to.contain('second');

  const inputs = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="variable"] input')];
  const pending = oneEvent(el, 'lr-change');
  inputs[3]!.value = 'edited second';
  inputs[3]!.dispatchEvent(new Event('input', { bubbles: true }));
  const detail = (await pending).detail;
  expect(detail.variables).to.deep.equal([
    { name: 'audience', value: 'first' },
    { name: 'audience', value: 'edited second' },
  ]);
});

it('emits immutable edits, run requests, and complete version records', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio .messages=${messages} .versions=${versions}></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  const changePending = oneEvent(el, 'lr-change');
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.value = 'Changed';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  const changed = await changePending;
  expect(changed.detail.messages[0].content).to.equal('Changed');
  expect(messages[0]!.content).to.equal('Answer for {{audience}}.');

  const runPending = oneEvent(el, 'lr-run');
  (el.shadowRoot!.querySelector('[part="run"]') as HTMLButtonElement).click();
  expect((await runPending).detail.messages).to.have.length(2);

  const versionPending = oneEvent(el, 'lr-version-select');
  (el.shadowRoot!.querySelector('[data-version-id="v1"]') as HTMLButtonElement).click();
  expect((await versionPending).detail).to.deep.equal({ version: versions[0] });
});

it('is accessible when populated and gates all editing controls while disabled', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio disabled reorderable .messages=${messages} .versions=${versions}></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  expect(
    [...el.shadowRoot!.querySelectorAll('button, textarea, input, select')].every(
      (node) => (node as HTMLInputElement).disabled,
    ),
  ).to.be.true;
  await expect(el).shadowDom.to.be.accessible();
});

it('forwards native editing assistance to every prompt and variable editor', async () => {
  const el = (await fixture(html`
    <lr-prompt-studio
      .messages=${messages}
      .variables=${[
        { name: 'audience', value: 'developers' },
        { name: 'tone', value: 'direct' },
      ]}
      .spellcheck=${false}
      autocapitalize="sentences"
      autocorrect="on"
      wrap="hard"
    ></lr-prompt-studio>
  `)) as LyraPromptStudio;
  const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!;
  const inputs = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="variable"] input')];

  expect(textarea.spellcheck).to.be.false;
  expect(textarea.getAttribute('autocapitalize')).to.equal('sentences');
  expect(textarea.getAttribute('autocorrect')).to.equal('on');
  expect(textarea.getAttribute('wrap')).to.equal('hard');
  expect(inputs).to.have.length(4);
  for (const input of inputs) {
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute('autocapitalize')).to.equal('sentences');
    expect(input.getAttribute('autocorrect')).to.equal('on');
    expect(input.hasAttribute('wrap'), 'wrap belongs only to the native textarea').to.be.false;
  }

  el.autocapitalize = '';
  el.autoCorrect = '';
  await el.updateComplete;
  expect(textarea.hasAttribute('autocapitalize')).to.be.false;
  expect(textarea.hasAttribute('autocorrect')).to.be.false;
  expect(inputs.every((input) => !input.hasAttribute('autocapitalize') && !input.hasAttribute('autocorrect'))).to.be.true;
});

it('deliberately limits message editors to native vertical resize without a host resize or auto-grow API', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio .messages=${messages}></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!;

  expect(getComputedStyle(textarea).resize).to.equal('vertical');
  expect(Reflect.has(el, 'resize')).to.be.false;
  expect(el.hasAttribute('resize')).to.be.false;
});

it('parses literal spellcheck="false" for every native editor while retaining prose-friendly defaults', async () => {
  const defaults = (await fixture(html`<lr-prompt-studio .messages=${messages} .variables=${[{ name: 'audience', value: 'developers' }]}></lr-prompt-studio>`)) as LyraPromptStudio;
  const defaultTextarea = defaults.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!;
  const defaultInputs = [...defaults.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="variable"] input')];
  expect(defaults.spellcheck).to.be.true;
  expect(defaultTextarea.spellcheck).to.be.true;
  expect(defaultTextarea.getAttribute('wrap')).to.equal('soft');
  expect(defaultInputs.every((input) => input.spellcheck)).to.be.true;

  const el = (await fixture(html`<lr-prompt-studio
    spellcheck="false"
    .messages=${messages}
    .variables=${[{ name: 'audience', value: 'developers' }]}
  ></lr-prompt-studio>`)) as LyraPromptStudio;
  expect(el.spellcheck).to.be.false;
  const controls = [
    el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!,
    ...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="variable"] input'),
  ];
  expect(controls.every((control) => !control.spellcheck)).to.be.true;
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-prompt-studio
    .strings=${{ promptStudioLabel: 'Localized prompt workshop' }}
  ></lr-prompt-studio>`)) as LyraPromptStudio;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized prompt workshop');
});

it('names duplicate-role message controls by purpose and display position', async () => {
  const duplicateRoles: PromptStudioMessage[] = [
    { id: 'first', role: 'user', content: 'First' },
    { id: 'second', role: 'user', content: 'Second' },
  ];
  const el = (await fixture(html`
    <lr-prompt-studio .messages=${duplicateRoles}></lr-prompt-studio>
  `)) as LyraPromptStudio;
  await el.updateComplete;
  const roles = [...el.shadowRoot!.querySelectorAll<HTMLSelectElement>('[part="message-role"]')];
  const contents = [...el.shadowRoot!.querySelectorAll<HTMLTextAreaElement>('[part="message-content"]')];
  expect(roles.map((control) => control.getAttribute('aria-label'))).to.deep.equal([
    'Message 1 role (User)',
    'Message 2 role (User)',
  ]);
  expect(contents.map((control) => control.getAttribute('aria-label'))).to.deep.equal([
    'Message 1 content (User)',
    'Message 2 content (User)',
  ]);
});

it('keeps both variable controls named when a caller supplies an empty variable name', async () => {
  const el = (await fixture(html`<lr-prompt-studio
    .variables=${[{ name: '', value: 'developers' }]}
  ></lr-prompt-studio>`)) as LyraPromptStudio;
  const inputs = [...el.shadowRoot!.querySelectorAll('[part="variable"] input')];
  expect(inputs.map((input) => input.getAttribute('aria-label'))).to.deep.equal([
    'Variable 1 name',
    'Variable 1 value',
  ]);
});

it('generates a unique message id even when the timestamp-based candidate already exists', async () => {
  const originalNow = Date.now;
  Date.now = () => 123;
  try {
    const existing: PromptStudioMessage[] = [
      { id: 'message-123-1', role: 'system', content: 'Keep me' },
    ];
    const el = (await fixture(html`<lr-prompt-studio .messages=${existing}></lr-prompt-studio>`)) as LyraPromptStudio;
    const pending = oneEvent(el, 'lr-change');
    (el.shadowRoot!.querySelector('[part="add-message"]') as HTMLButtonElement).click();
    const event = await pending;
    const ids = event.detail.messages.map((message: PromptStudioMessage) => message.id);
    expect(new Set(ids).size).to.equal(2);
    expect(ids[0]).to.equal('message-123-1');
  } finally {
    Date.now = originalNow;
  }
});

it('bridges focus/blur from the message textarea and variable inputs to the host', async () => {
  // Dispatch synthetic FocusEvents rather than calling .focus()/.blur(): a real focus change
  // fires the UA's own focus-chain events on every shadow-including ancestor host regardless of
  // this component's own wiring, which would mask a missing bridge. A manually dispatched
  // FocusEvent is not bubbling and only reaches the host if the component explicitly re-emits it
  // -- see file-input.test.ts's "bridges focus and blur from the dropzone" test for precedent.
  const el = (await fixture(html`<lr-prompt-studio
    .messages=${messages}
    .variables=${[{ name: 'audience', value: 'developers' }]}
  ></lr-prompt-studio>`)) as LyraPromptStudio;

  const textarea = el.shadowRoot!.querySelector('textarea')!;
  let focusPending = oneEvent(el, 'focus');
  textarea.dispatchEvent(new FocusEvent('focus'));
  await focusPending;
  let blurPending = oneEvent(el, 'blur');
  textarea.dispatchEvent(new FocusEvent('blur'));
  await blurPending;

  const [nameInput, valueInput] = [
    ...el.shadowRoot!.querySelectorAll('[part="variable"] input'),
  ] as HTMLInputElement[];

  focusPending = oneEvent(el, 'focus');
  nameInput!.dispatchEvent(new FocusEvent('focus'));
  await focusPending;
  blurPending = oneEvent(el, 'blur');
  nameInput!.dispatchEvent(new FocusEvent('blur'));
  await blurPending;

  focusPending = oneEvent(el, 'focus');
  valueInput!.dispatchEvent(new FocusEvent('focus'));
  await focusPending;
  blurPending = oneEvent(el, 'blur');
  valueInput!.dispatchEvent(new FocusEvent('blur'));
  await blurPending;
});

it('renders light and dark native option palettes, resets select appearance, and adds a chevron', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-prompt-studio data-lr-theme="light" .messages=${messages}></lr-prompt-studio>
      <lr-prompt-studio data-lr-theme="dark" .messages=${messages}></lr-prompt-studio>
    </div>
  `);
  const [light, dark] = [...wrapper.querySelectorAll<LyraPromptStudio>('lr-prompt-studio')];
  const select = light!.shadowRoot!.querySelector('[part="message-role"]') as HTMLSelectElement;
  expect(getComputedStyle(select).appearance).to.equal('none');
  expect(getComputedStyle(select).cursor).to.equal('pointer');
  const selectWrapper = select.closest('.message-role-wrapper');
  expect((selectWrapper) != null, 'the select must be wrapped so a decorative chevron can be positioned over it').to.equal(true);
  expect(
    selectWrapper!.querySelector('.message-role-chevron svg') != null,
    'a decorative chevron must render since appearance:none removes the native one',
  ).to.equal(true);

  const lightOption = select.querySelector('option')!;
  const darkOption = dark!.shadowRoot!.querySelector<HTMLSelectElement>('[part="message-role"]')!.querySelector('option')!;
  expect(getComputedStyle(lightOption).backgroundColor).to.equal('rgb(255, 255, 255)');
  expect(getComputedStyle(lightOption).color).to.equal('rgb(26, 26, 26)');
  expect(getComputedStyle(darkOption).backgroundColor).to.equal('rgb(26, 26, 26)');
  expect(getComputedStyle(darkOption).color).to.equal('rgb(242, 242, 242)');
});

it('paints hover and active feedback on toolbar and direct action buttons', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio
      style="--lr-color-surface: rgb(10, 20, 30); --lr-color-surface-raised: rgb(40, 50, 60); --lr-color-mix-partner: rgb(100, 110, 120); --lr-color-mix-active: 50%;"
      .messages=${messages}
    ></lr-prompt-studio>
  `);
  const actions = [
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="save"]')!,
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="add-message"]')!,
  ];

  await resetMouse();
  try {
    for (const action of actions) {
      const rest = getComputedStyle(action).backgroundColor;
      const rect = action.getBoundingClientRect();
      const position: [number, number] = [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ];

      await sendMouse({ type: 'move', position });
      await waitUntil(
        () => getComputedStyle(action).backgroundColor !== rest,
        `${action.getAttribute('part')} hover paint did not settle`,
      );
      const hover = getComputedStyle(action).backgroundColor;

      await sendMouse({ type: 'down' });
      await waitUntil(
        () => {
          const active = getComputedStyle(action).backgroundColor;
          return active !== rest && active !== hover;
        },
        `${action.getAttribute('part')} active paint did not settle`,
      );
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('paints the variable field hover hook over its resting border', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio
      style="--lr-prompt-studio-field-hover-border: rgb(1, 2, 3);"
      .messages=${messages}
      .variables=${[{ name: 'audience', value: 'developers' }]}
    ></lr-prompt-studio>
  `);
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="variable"] input')!;
  const rest = getComputedStyle(input).borderTopColor;
  const rect = input.getBoundingClientRect();

  await resetMouse();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(
      () => getComputedStyle(input).borderTopColor !== rest,
      'variable input hover paint did not settle',
    );
    expect(getComputedStyle(input).borderTopColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});

it('renders and exposes a component-scoped theme hook for the selected version', async () => {
  const el = (await fixture(html`
    <lr-prompt-studio
      style="--lr-prompt-studio-version-selected-border: rgb(1, 2, 3)"
      selected-version-id="v1"
      .versions=${versions}
    ></lr-prompt-studio>
  `)) as LyraPromptStudio;
  const version = el.shadowRoot!.querySelector('[part="version"]') as HTMLElement;
  expect(version.getAttribute('aria-pressed')).to.equal('true');
  expect(getComputedStyle(version).borderTopColor).to.equal('rgb(1, 2, 3)');
});

it('uses a visibly distinct selected-version hover fallback in light and dark themes', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-prompt-studio
        data-lr-theme="light"
        style="inline-size: 24rem;"
        selected-version-id="v1"
        .versions=${versions}
      ></lr-prompt-studio>
      <lr-prompt-studio
        data-lr-theme="dark"
        style="inline-size: 24rem;"
        selected-version-id="v1"
        .versions=${versions}
      ></lr-prompt-studio>
    </div>
  `);
  const studios = [...wrapper.querySelectorAll<LyraPromptStudio>('lr-prompt-studio')];

  await resetMouse();
  try {
    for (const studio of studios) {
      const version = studio.shadowRoot!.querySelector<HTMLElement>('[part="version"]')!;
      const rest = getComputedStyle(version).backgroundColor;
      const rect = version.getBoundingClientRect();
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      expect(getComputedStyle(version).backgroundColor, `${studio.dataset['lrTheme']} selected version hover`).not.to.equal(rest);
      await resetMouse();
    }
  } finally {
    await resetMouse();
  }
});

it('retains the explicit selected-version hover background override', async () => {
  const el = (await fixture(html`
    <lr-prompt-studio
      style="--lr-prompt-studio-version-selected-hover-bg: rgb(1, 2, 3)"
      selected-version-id="v1"
      .versions=${versions}
    ></lr-prompt-studio>
  `)) as LyraPromptStudio;
  const version = el.shadowRoot!.querySelector<HTMLElement>('[part="version"]')!;
  const rect = version.getBoundingClientRect();

  await resetMouse();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(version).backgroundColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});

// -- Message removal and variable editing -----------------------------------

it('removes a message immutably, leaving the original array untouched', async () => {
  const original = messages.map((message) => ({ ...message }));
  const el = (await fixture(
    html`<lr-prompt-studio .messages=${original} .versions=${versions}></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  await el.updateComplete;
  const changePending = oneEvent(el, 'lr-change');
  const remove = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="remove-message"]');
  expect(remove.length).to.equal(2);
  remove[0]!.click();

  const detail = (await changePending).detail as { messages: PromptStudioMessage[] };
  expect(detail.messages.map((m) => m.id)).to.deep.equal(['user']);
  expect(original.map((m) => m.id), 'the caller-supplied array is not mutated').to.deep.equal([
    'system',
    'user',
  ]);
});

it('edits a variable name and value by index without disturbing its siblings', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio
      .messages=${messages}
      .variables=${[
        { name: 'audience', value: 'developers' },
        { name: 'tone', value: 'formal' },
      ]}
    ></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  await el.updateComplete;
  const inputs = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="variable"] input')];
  expect(inputs.length, 'two variables render a name/value pair each').to.equal(4);

  const namePending = oneEvent(el, 'lr-change');
  inputs[2]!.value = 'register';
  inputs[2]!.dispatchEvent(new Event('input', { bubbles: true }));
  const afterName = (await namePending).detail as { variables: { name: string; value: string }[] };
  expect(afterName.variables).to.deep.equal([
    { name: 'audience', value: 'developers' },
    { name: 'register', value: 'formal' },
  ]);

  const valuePending = oneEvent(el, 'lr-change');
  inputs[1]!.value = 'operators';
  inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }));
  const afterValue = (await valuePending).detail as { variables: { name: string; value: string }[] };
  expect(afterValue.variables[0]).to.deep.equal({ name: 'audience', value: 'operators' });
});

// -- Opt-in controlled message reordering -----------------------------------

it('keeps message reordering opt-in and disables boundary actions', async () => {
  const el = (await fixture(html`<lr-prompt-studio .messages=${reorderMessages}></lr-prompt-studio>`)) as LyraPromptStudio;
  expect(el.hasAttribute('reorderable')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="message-actions"]')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="move-message-up"]')) == null).to.be.true;

  el.reorderable = true;
  await el.updateComplete;
  expect(el.hasAttribute('reorderable')).to.be.true;
  const up = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="move-message-up"]')];
  const down = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="move-message-down"]')];
  expect(up).to.have.length(3);
  expect(down).to.have.length(3);
  expect(up[0]!.disabled).to.be.true;
  expect(down[2]!.disabled).to.be.true;
  expect(up[1]!.disabled).to.be.false;
  expect(down[1]!.disabled).to.be.false;
  el.strings = { moveUp: 'Déplacer vers le haut', moveDown: 'Déplacer vers le bas' };
  await el.updateComplete;
  expect(up[1]!.getAttribute('aria-label')).to.equal('Déplacer vers le haut');
  expect(down[1]!.getAttribute('aria-label')).to.equal('Déplacer vers le bas');
  await expect(el).shadowDom.to.be.accessible();

  el.reorderable = false;
  await el.updateComplete;
  expect(el.hasAttribute('reorderable')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="message-actions"]')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="move-message-up"]')) == null).to.be.true;
});

it('emits a cancelable reorder request before applying an immutable next message order', async () => {
  const original = reorderMessages.map((message) => ({ ...message }));
  const el = (await fixture(html`<lr-prompt-studio reorderable .messages=${original}></lr-prompt-studio>`)) as LyraPromptStudio;
  const emitted: string[] = [];
  el.addEventListener('lr-message-reorder', () => emitted.push('lr-message-reorder'));
  el.addEventListener('lr-change', () => emitted.push('lr-change'));
  const reorderPending = oneEvent(el, 'lr-message-reorder');
  const changePending = oneEvent(el, 'lr-change');
  (el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="move-message-down"]')[0]!).click();

  const reorder = (await reorderPending) as CustomEvent<PromptStudioMessageReorderDetail>;
  const changed = await changePending;
  expect(reorder.cancelable).to.be.true;
  expect(reorder.detail).to.deep.equal({
    messages: [original[1], original[0], original[2]],
    messageId: 'system',
    fromIndex: 0,
    toIndex: 1,
  });
  expect(reorder.detail.messages === original, 'reorder detail must not expose the caller array').to.be.false;
  expect(changed.detail.messages.map((message: PromptStudioMessage) => message.id)).to.deep.equal(['user', 'system', 'assistant']);
  expect(el.messages.map((message) => message.id)).to.deep.equal(['user', 'system', 'assistant']);
  expect(original.map((message) => message.id), 'the caller array remains untouched').to.deep.equal([
    'system',
    'user',
    'assistant',
  ]);
  expect(emitted).to.deep.equal(['lr-message-reorder', 'lr-change']);
});

it('honors a prevented message reorder without mutating state or emitting lr-change', async () => {
  const original = reorderMessages.map((message) => ({ ...message }));
  const el = (await fixture(html`<lr-prompt-studio reorderable .messages=${original}></lr-prompt-studio>`)) as LyraPromptStudio;
  let reorderCount = 0;
  let changeCount = 0;
  el.addEventListener('lr-message-reorder', (event) => {
    reorderCount++;
    event.preventDefault();
  });
  el.addEventListener('lr-change', () => changeCount++);

  (el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="move-message-down"]')[0]!).click();
  await el.updateComplete;
  expect(reorderCount).to.equal(1);
  expect(changeCount).to.equal(0);
  expect(el.messages.map((message) => message.id)).to.deep.equal(['system', 'user', 'assistant']);
  expect(original.map((message) => message.id)).to.deep.equal(['system', 'user', 'assistant']);
});

it('emits a cancelable lr-change before mutating state, honoring a prevented edit', async () => {
  const original = messages.map((message) => ({ ...message }));
  const el = (await fixture(html`<lr-prompt-studio .messages=${original}></lr-prompt-studio>`)) as LyraPromptStudio;
  const accepted = el.messages;
  let changeCount = 0;
  el.addEventListener('lr-change', (event) => {
    changeCount++;
    expect(event.cancelable).to.be.true;
    expect(el.messages, 'messages must still be the accepted pre-edit snapshot while lr-change is pending').to.equal(accepted);
    event.preventDefault();
  });

  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.value = 'Changed';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  expect(changeCount).to.equal(1);
  expect(el.messages).to.equal(accepted);
  expect(el.messages[0]!.content).to.equal(original[0]!.content);
});

it('supports native keyboard activation and keeps focus with the moved message action', async () => {
  const el = (await fixture(html`<lr-prompt-studio reorderable .messages=${reorderMessages}></lr-prompt-studio>`)) as LyraPromptStudio;
  const moveDown = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="move-message-down"]')[0]!;
  moveDown.focus();
  const reorderPending = oneEvent(el, 'lr-message-reorder');
  const changePending = oneEvent(el, 'lr-change');
  await sendKeys({ press: 'Enter' });
  await Promise.all([reorderPending, changePending]);
  await el.updateComplete;

  const focusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focusedAction?.closest<HTMLElement>('[data-message-id]')?.dataset['messageId']).to.equal('system');
  expect(focusedAction?.getAttribute('part')).to.equal('move-message-down');
  expect(el.messages.map((message) => message.id)).to.deep.equal(['user', 'system', 'assistant']);

  const secondMoveDown = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[data-message-id="system"] [part="move-message-down"]',
  )!;
  secondMoveDown.focus();
  const secondReorderPending = oneEvent(el, 'lr-message-reorder');
  const secondChangePending = oneEvent(el, 'lr-change');
  await sendKeys({ press: 'Enter' });
  await Promise.all([secondReorderPending, secondChangePending]);
  await el.updateComplete;

  const boundaryFocusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(boundaryFocusedAction?.closest<HTMLElement>('[data-message-id]')?.dataset['messageId']).to.equal('system');
  expect(boundaryFocusedAction?.getAttribute('part')).to.equal('move-message-up');
  expect(el.messages.map((message) => message.id)).to.deep.equal(['user', 'assistant', 'system']);
});
