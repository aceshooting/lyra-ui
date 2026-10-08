import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './prompt-studio.js';
import type {
  LyraPromptStudio,
  PromptStudioMessage,
  PromptStudioMessageReorderDetail,
  PromptStudioVersion,
} from './prompt-studio.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

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

it('treats not-yet-loaded null collections as empty', async () => {
  const el = document.createElement('lr-prompt-studio') as LyraPromptStudio;
  el.messages = null as unknown as PromptStudioMessage[];
  el.variables = null as never;
  el.versions = null as unknown as PromptStudioVersion[];
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="message"]')).to.have.lengthOf(0);
    expect(el.shadowRoot!.querySelectorAll('[part="variable"]')).to.have.lengthOf(0);
    expect(el.shadowRoot!.querySelectorAll('[part="version"]')).to.have.lengthOf(0);
    expect(el.shadowRoot!.querySelector('[part="add-message"]')).to.exist;
  } finally {
    el.remove();
  }
});

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

it('normalizes a large message collection once per render while retaining keyed row output', async () => {
  const largeMessages: PromptStudioMessage[] = Array.from({ length: 1_000 }, (_, index) => ({
    id: `message-${index}`,
    role: 'user',
    content: `Message ${index}`,
  }));
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio reorderable .messages=${largeMessages}></lr-prompt-studio>
  `);
  const firstBefore = el.shadowRoot!.querySelector<HTMLElement>('[data-message-id="message-0"]')!;
  const seam = el as unknown as { uniqueMessages: () => PromptStudioMessage[] };
  const inherited = seam.uniqueMessages;
  let normalizations = 0;
  seam.uniqueMessages = () => {
    normalizations += 1;
    return inherited.call(el);
  };
  try {
    el.heading = 'Updated heading';
    await el.updateComplete;

    expect(normalizations).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="message"]').length).to.equal(1_000);
    const firstAfter = el.shadowRoot!.querySelector<HTMLElement>('[data-message-id="message-0"]')!;
    expect((firstAfter) === (firstBefore)).to.equal(true);
    expect(firstAfter.querySelector<HTMLTextAreaElement>('[part="message-content"]')!.value).to.equal('Message 0');

    normalizations = 0;
    const reordered = oneEvent(el, 'lr-message-reorder-request');
    firstAfter.querySelector<HTMLButtonElement>('[part="move-message-down"]')!.click();
    await reordered;
    await el.updateComplete;

    // One normalization validates the accepted reorder and one supplies its following render;
    // neither the change proposal nor individual rows may rescan the full collection.
    expect(normalizations).to.equal(2);
    const moved = el.shadowRoot!.querySelector<HTMLElement>('[data-message-id="message-0"]')!;
    expect((moved) === (firstBefore)).to.equal(true);
    expect(moved.querySelector<HTMLTextAreaElement>('[part="message-content"]')!.value).to.equal('Message 0');
  } finally {
    Reflect.deleteProperty(seam, 'uniqueMessages');
  }
});

it('emits lr-save with the current public studio state', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio
      .messages=${messages}
      .variables=${[{ name: 'audience', value: 'developers' }]}
      .versions=${versions}
    ></lr-prompt-studio>
  `);
  const saved = oneEvent(el, 'lr-save');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="save"]')!.click();
  const event = await saved;

  expect(event.detail.messages).to.deep.equal(messages);
  expect(event.detail.variables).to.deep.equal([
    { name: 'audience', value: 'developers' },
  ]);
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

it('honors label="" instead of falling back to the heading', async () => {
  const el = (await fixture(html`<lr-prompt-studio heading="Studio" label=""></lr-prompt-studio>`)) as LyraPromptStudio;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
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

it('shows each message role in its selector from the first render and follows later role changes', async () => {
  const roleMessages: PromptStudioMessage[] = [
    { id: 'a', role: 'user', content: 'First' },
    { id: 'b', role: 'assistant', content: 'Second' },
  ];
  const el = (await fixture(html`<lr-prompt-studio .messages=${roleMessages}></lr-prompt-studio>`)) as LyraPromptStudio;
  const roles = () =>
    [...el.shadowRoot!.querySelectorAll<HTMLSelectElement>('[part="message-role"]')].map((select) => select.value);
  expect(roles()).to.deep.equal(['user', 'assistant']);
  el.messages = [{ id: 'a', role: 'tool', content: 'First' }, roleMessages[1]!];
  await el.updateComplete;
  expect(roles()).to.deep.equal(['tool', 'assistant']);
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
  expect(getComputedStyle(lightOption).color).to.equal('rgb(10, 10, 10)');
  expect(getComputedStyle(darkOption).backgroundColor).to.equal('rgb(10, 10, 10)');
  expect(getComputedStyle(darkOption).color).to.equal('rgb(250, 250, 250)');
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

  try {
    await hoverUntilMatched(input, 'variable input never received the pointer hover state');
    await waitUntil(
      () => getComputedStyle(input).borderTopColor === 'rgb(1, 2, 3)',
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
        style="inline-size: 24rem; --lr-transition-fast: 0s;"
        selected-version-id="v1"
        .versions=${versions}
      ></lr-prompt-studio>
      <lr-prompt-studio
        data-lr-theme="dark"
        style="inline-size: 24rem; --lr-transition-fast: 0s;"
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
      await hoverUntilMatched(version, 'selected version never received the pointer hover state');
      await waitUntil(
        () => getComputedStyle(version).backgroundColor !== rest,
        `${studio.dataset['lrTheme']} selected version hover never changed the resting fill`,
      );
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
      style="--lr-transition-fast: 0s; --lr-prompt-studio-version-selected-hover-bg: rgb(1, 2, 3)"
      selected-version-id="v1"
      .versions=${versions}
    ></lr-prompt-studio>
  `)) as LyraPromptStudio;
  const version = el.shadowRoot!.querySelector<HTMLElement>('[part="version"]')!;

  try {
    await hoverUntilMatched(version, 'selected version never received the pointer hover state');
    await waitUntil(
      () => getComputedStyle(version).backgroundColor === 'rgb(1, 2, 3)',
      'selected-version hover background override never rendered',
    );
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
  el.addEventListener('lr-message-reorder-request', () => emitted.push('lr-message-reorder-request'));
  el.addEventListener('lr-message-reorder', () => emitted.push('lr-message-reorder'));
  el.addEventListener('lr-change-request', () => emitted.push('lr-change-request'));
  el.addEventListener('lr-change', () => emitted.push('lr-change'));
  const reorderPending = oneEvent(el, 'lr-message-reorder-request');
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
  expect(emitted).to.deep.equal(['lr-message-reorder-request', 'lr-change-request', 'lr-change']);
});

it('honors a prevented message reorder without mutating state or emitting lr-change', async () => {
  const original = reorderMessages.map((message) => ({ ...message }));
  const el = (await fixture(html`<lr-prompt-studio reorderable .messages=${original}></lr-prompt-studio>`)) as LyraPromptStudio;
  let reorderCount = 0;
  let changeCount = 0;
  el.addEventListener('lr-message-reorder-request', (event) => {
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

it('emits a cancelable lr-change-request before mutating state, honoring a prevented edit', async () => {
  const original = messages.map((message) => ({ ...message }));
  const el = (await fixture(html`<lr-prompt-studio .messages=${original}></lr-prompt-studio>`)) as LyraPromptStudio;
  const accepted = el.messages;
  let changeCount = 0;
  el.addEventListener('lr-change-request', (event) => {
    changeCount++;
    expect(event.cancelable).to.be.true;
    expect(el.messages, 'messages must still be the accepted pre-edit snapshot while lr-change-request is pending').to.equal(accepted);
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
  const reorderPending = oneEvent(el, 'lr-message-reorder-request');
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
  const secondReorderPending = oneEvent(el, 'lr-message-reorder-request');
  const secondChangePending = oneEvent(el, 'lr-change');
  await sendKeys({ press: 'Enter' });
  await Promise.all([secondReorderPending, secondChangePending]);
  await el.updateComplete;

  const boundaryFocusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(boundaryFocusedAction?.closest<HTMLElement>('[data-message-id]')?.dataset['messageId']).to.equal('system');
  expect(boundaryFocusedAction?.getAttribute('part')).to.equal('move-message-up');
  expect(el.messages.map((message) => message.id)).to.deep.equal(['user', 'assistant', 'system']);
});

it('tolerates a message with missing `content` without blanking the rest of the panel', async () => {
  const el = (await fixture(html`<lr-prompt-studio></lr-prompt-studio>`)) as LyraPromptStudio;
  el.messages = [
    { id: 'bad', role: 'user' } as unknown as PromptStudioMessage,
    { id: 'good', role: 'user', content: 'hi' },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="message"]')).to.have.lengthOf(2);
});

it('tolerates a message with `content: null` without blanking the rest of the panel', async () => {
  const el = (await fixture(html`<lr-prompt-studio></lr-prompt-studio>`)) as LyraPromptStudio;
  el.messages = [
    { id: 'bad', role: 'user', content: null as unknown as string },
    { id: 'good', role: 'user', content: 'hi' },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="message"]')).to.have.lengthOf(2);
});

// The selected version's hover and press defaults used to mix from the literal brand-quiet, so a
// themed selected fill vanished under the pointer. Both now start from the selected fill.
it('mixes the selected version hover and press from --lr-prompt-studio-version-selected-bg', async () => {
  const el = (await fixture(html`
    <lr-prompt-studio
      style="--lr-transition-fast: 0s; --lr-prompt-studio-version-selected-bg: rgb(200, 0, 0)"
      selected-version-id="v1"
      .versions=${versions}
    ></lr-prompt-studio>
  `)) as LyraPromptStudio;
  await el.updateComplete;
  const version = el.shadowRoot!.querySelector<HTMLElement>('[part="version"]')!;
  const resolve = (color: string): string => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = color;
    el.shadowRoot!.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  };
  const hover =
    'color-mix(in oklab, rgb(200, 0, 0), var(--lr-color-mix-partner) var(--lr-color-mix-hover))';
  const expectedHover = resolve(hover);
  const expectedPress = resolve(
    `color-mix(in oklab, ${hover}, var(--lr-color-mix-partner) var(--lr-color-mix-active))`,
  );
  try {
    await hoverUntilMatched(version, 'selected version never received the pointer hover state');
    await waitUntil(
      () => getComputedStyle(version).backgroundColor === expectedHover,
      'selected version hover did not mix from the selected fill',
    );
    await sendMouse({ type: 'down' });
    await waitUntil(
      () => version.matches(':active') && getComputedStyle(version).backgroundColor === expectedPress,
      'selected version press did not mix from the selected fill',
    );
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

describe('lr-prompt-studio retired lr-message-reorder event', () => {
  const moveFirstDown = (el: LyraPromptStudio): void =>
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="move-message-down"]')[0]!.click();

  it('ignores the old event while the canonical request still commits the move', async () => {
    const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio reorderable .messages=${reorderMessages}></lr-prompt-studio>`);
    const canonical: CustomEvent<PromptStudioMessageReorderDetail>[] = [];
    let retiredCount = 0;
    let changes = 0;
    el.addEventListener('lr-message-reorder-request', (event) => canonical.push(event));
    el.addEventListener('lr-change', () => changes++);
    (el as HTMLElement).addEventListener('lr-message-reorder', () => retiredCount++);
    moveFirstDown(el);
    await el.updateComplete;
    expect(canonical).to.have.length(1);
    expect(canonical[0]!.cancelable).to.equal(true);
    expect(retiredCount).to.equal(0);
    expect(changes).to.equal(1);
    expect(el.messages.map((message) => message.id)).to.deep.equal(['user', 'system', 'assistant']);
  });

  it('keeps canonical veto effective and the old event cannot veto or emit', async () => {
    const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio reorderable .messages=${reorderMessages}></lr-prompt-studio>`);
    let retiredCount = 0;
    (el as HTMLElement).addEventListener('lr-message-reorder', (event) => {
      retiredCount++;
      event.preventDefault();
    });
    el.addEventListener('lr-message-reorder-request', (event) => event.preventDefault());
    moveFirstDown(el);
    await el.updateComplete;
    expect(retiredCount).to.equal(0);
    expect(el.messages.map((message) => message.id)).to.deep.equal(['system', 'user', 'assistant']);
  });
});

describe('lr-prompt-studio heading-level', () => {
  const heading = (el: LyraPromptStudio): Element => el.shadowRoot!.querySelector('[part="toolbar"]')!.firstElementChild!;

  it('renders the toolbar title without heading semantics by default', async () => {
    const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio heading="Studio"></lr-prompt-studio>`);
    expect(el.headingLevel).to.equal('none');
    expect(heading(el).localName).to.equal('span');
    expect(heading(el).textContent).to.equal('Studio');
  });

  it('renders the requested level and drops heading semantics for none, keeping the visual size and weight', async () => {
    const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio heading="Studio" heading-level="4"></lr-prompt-studio>`);
    const size = getComputedStyle(heading(el)).fontSize;
    const weight = getComputedStyle(heading(el)).fontWeight;
    expect(heading(el).localName).to.equal('h4');
    el.headingLevel = 'none';
    await el.updateComplete;
    expect(heading(el).localName).to.equal('span');
    expect(heading(el).textContent).to.equal('Studio');
    expect(getComputedStyle(heading(el)).fontSize).to.equal(size);
    expect(getComputedStyle(heading(el)).fontWeight).to.equal(weight);
    await expect(el).to.be.accessible();
  });

  it('returns to the non-heading default when the heading-level attribute is removed', async () => {
    const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio heading="Studio" heading-level="4"></lr-prompt-studio>`);
    expect(heading(el).localName).to.equal('h4');
    el.removeAttribute('heading-level');
    await el.updateComplete;
    expect(heading(el).localName).to.equal('span');
  });
});


it('notifies accepted prompt state only after its cancelable request', async () => {
  const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio .messages=${messages}></lr-prompt-studio>`);
  const seen: string[] = [];
  el.addEventListener('lr-change-request', (event) => {
    seen.push('request');
    expect(event.cancelable).to.equal(true);
    expect(el.messages[0]!.content).to.equal(messages[0]!.content);
    expect(Object.isFrozen((event as CustomEvent).detail.messages)).to.equal(true);
  });
  el.addEventListener('lr-change', (event) => {
    seen.push('change');
    expect(event.cancelable).to.equal(false);
    expect(el.messages[0]!.content).to.equal('Accepted text');
    event.preventDefault();
    expect(event.defaultPrevented).to.equal(false);
  });
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.value = 'Accepted text';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  expect(seen).to.deep.equal(['request', 'change']);
});

it('does not overwrite host prompt state or recurse during a change request', async () => {
  const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio .messages=${messages}></lr-prompt-studio>`);
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  let requests = 0;
  let changes = 0;
  el.addEventListener('lr-change-request', () => {
    requests++;
    if (requests === 1) textarea.dispatchEvent(new Event('input', { bubbles: true }));
    el.messages = [{ id: 'host', role: 'user', content: 'Host replacement' }];
  });
  el.addEventListener('lr-change', () => changes++);
  textarea.value = 'Proposed text';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  expect(requests).to.equal(1);
  expect(changes).to.equal(0);
  expect(el.messages.map(message => message.content)).to.deep.equal(['Host replacement']);
});


it('restores every native prompt field after a veto without an accepted notification', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio .messages=${messages} .variables=${[{ name: 'audience', value: 'developers' }]}></lr-prompt-studio>
  `);
  let changes = 0;
  let requests = 0;
  el.addEventListener('lr-change-request', event => { requests++; event.preventDefault(); });
  el.addEventListener('lr-change', () => changes++);
  const fields = [...el.shadowRoot!.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    '[part="message-role"], [part="message-content"], [part="variable"] input',
  )];
  for (const field of fields) {
    const accepted = field.value;
    field.value = field.localName === 'select' ? 'tool' : 'Rejected';
    field.dispatchEvent(new Event(field.localName === 'select' ? 'change' : 'input', { bubbles: true }));
    await el.updateComplete;
    expect(field.value).to.equal(accepted);
  }
  expect(requests).to.equal(fields.length);
  expect(changes).to.equal(0);
});

it('preserves host replacement during a reorder request and prevents recursive moves', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio reorderable .messages=${reorderMessages}></lr-prompt-studio>
  `);
  const move = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="move-message-down"]')!;
  let requests = 0;
  let changes = 0;
  el.addEventListener('lr-message-reorder-request', () => {
    requests++;
    if (requests === 1) move.click();
    el.messages = [{ id: 'host', role: 'system', content: 'Replacement' }];
  });
  el.addEventListener('lr-change', () => changes++);
  move.click();
  expect(requests).to.equal(1);
  expect(changes).to.equal(0);
  expect(el.messages.map(message => message.id)).to.deep.equal(['host']);
});

it('renders a studio whose variables carry null rows or a null value used by a message', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio
      .messages=${[{ id: 'm', role: 'system', content: 'Hello {{x}}' }]}
      .variables=${[null, { name: 'x', value: null }, { name: 'y', value: 'ok' }]}
    ></lr-prompt-studio>
  `);
  expect(el.shadowRoot!.querySelectorAll('[data-message-id]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('input[type="text"], input:not([type])').length).to.be.greaterThan(0);
});

it('does not re-snapshot the unchanged variables when a message is edited', async () => {
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio .messages=${messages} .variables=${[{ name: 'audience', value: 'learners' }]}></lr-prompt-studio>
  `);
  const before = el.variables;
  const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!;
  textarea.value = 'Edited';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  expect(el.messages[0]!.content).to.equal('Edited');
  expect(el.variables === before).to.equal(true);
});

it('reuses unchanged message previews while editing a different message', async () => {
  const longContent = 'Hello {{audience}}. '.repeat(40);
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio
      .messages=${[
        { id: 'long', role: 'system', content: longContent },
        { id: 'short', role: 'user', content: 'Hi {{audience}}' },
      ]}
      .variables=${[{ name: 'audience', value: 'team' }]}
    ></lr-prompt-studio>
  `);
  const original = RegExp.prototype.exec;
  let placeholderScans = 0;
  RegExp.prototype.exec = function (text: string): RegExpExecArray | null {
    if (this.source.includes('([^{}]+)')) placeholderScans++;
    return original.call(this, text);
  };
  try {
    el.heading = 'Updated heading';
    await el.updateComplete;
    expect(placeholderScans).to.equal(0);

    const short = el.shadowRoot!.querySelectorAll<HTMLTextAreaElement>('[part="message-content"]')[1]!;
    short.value = 'Updated {{audience}}';
    short.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(placeholderScans).to.be.lessThan(10);
    expect(el.shadowRoot!.querySelectorAll('[part="preview"] pre')[0]!.textContent).to.include('Hello team.');
    expect(el.shadowRoot!.querySelectorAll('[part="preview"] pre')[1]!.textContent).to.equal('Updated team');
  } finally {
    RegExp.prototype.exec = original;
  }
});

it('retires previews from older accepted edits instead of retaining the editing history', async () => {
  const content = 'Hello {{audience}}. '.repeat(40);
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio .messages=${[{ id: 'one', role: 'user', content }]}
      .variables=${[{ name: 'audience', value: 'team' }]}></lr-prompt-studio>
  `);
  const original = RegExp.prototype.exec;
  let scans = 0;
  RegExp.prototype.exec = function (text: string): RegExpExecArray | null {
    if (this.source.includes('([^{}]+)')) scans++;
    return original.call(this, text);
  };
  try {
    for (const next of ['Changed once', 'Changed twice', content]) {
      el.messages = [{ id: 'one', role: 'user', content: next }];
      await el.updateComplete;
    }
    expect(scans).to.be.greaterThan(40);
    expect(el.shadowRoot!.querySelector('[part="preview"] pre')!.textContent).to.include('Hello team.');
  } finally {
    RegExp.prototype.exec = original;
  }
});

it('keeps the shared substitution ceiling when identical message previews are reused', async () => {
  const content = '{{x}}'.repeat(6_000);
  const el = await fixture<LyraPromptStudio>(html`
    <lr-prompt-studio
      .messages=${[
        { id: 'first', role: 'system', content },
        { id: 'second', role: 'user', content },
      ]}
      .variables=${[{ name: 'x', value: 'a' }]}
    ></lr-prompt-studio>
  `);
  expect(el.shadowRoot!.querySelector('[part="preview"]')?.textContent).to.include('Preview unavailable');
});

it('keeps an explicitly empty heading verbatim instead of the localized default', async () => {
  const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio heading=""></lr-prompt-studio>`);
  expect(el.shadowRoot!.querySelector('[part="toolbar"]')!.firstElementChild!.textContent!.trim()).to.equal('');
});
