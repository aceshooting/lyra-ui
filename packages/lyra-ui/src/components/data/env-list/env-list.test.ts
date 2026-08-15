import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './env-list.js';
import type { LyraEnvList } from './env-list.js';
import { styles } from './env-list.styles.js';

describe('lr-env-list', () => {
  it('defaults to revealable=true and copyable=true', async () => {
    const el = (await fixture(html`<lr-env-list></lr-env-list>`)) as LyraEnvList;
    expect(el.revealable).to.be.true;
    expect(el.copyable).to.be.true;
  });

  it('clone-owns and freezes readonly entry snapshots while retaining valid partial input', async () => {
    const source = { name: 'A', value: 'one', secret: false };
    const entries = [source];
    const hostile = {} as { name?: string };
    Object.defineProperty(hostile, 'name', { get: () => { throw new Error('hostile name'); } });
    const el = await fixture<LyraEnvList>(html`<lr-env-list></lr-env-list>`);
    el.entries = [hostile, ...entries] as never;
    source.value = 'mutated';
    entries.push({ name: 'B', value: 'two', secret: false });
    await el.updateComplete;

    expect(el.entries).to.deep.equal([{ name: 'A', value: 'one', secret: false }]);
    expect(Object.isFrozen(el.entries)).to.be.true;
    expect(Object.isFrozen(el.entries[0]!)).to.be.true;
  });

  it('keeps the first unique nonempty name before rendering, reveal state, actions, and events', async () => {
    const el = await fixture<LyraEnvList>(html`<lr-env-list></lr-env-list>`);
    el.entries = [
      { name: '', value: 'blank' },
      { name: '   ', value: 'whitespace' },
      { name: 'TOKEN', value: 'first', secret: true },
      { name: 'TOKEN', value: 'later duplicate', secret: true },
      { name: 'MODE', value: 'production', secret: false },
    ];
    await el.updateComplete;

    expect(el.entries.map((entry) => [entry.name, entry.value])).to.deep.equal([
      ['TOKEN', 'first'],
      ['MODE', 'production'],
    ]);
    expect(el.shadowRoot!.querySelectorAll('[part="name"]').length).to.equal(2);
    expect(el.shadowRoot!.querySelectorAll('[part="value"]').length).to.equal(2);

    const revealEvent = oneEvent(el, 'lr-reveal-change');
    (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
    expect((await revealEvent as CustomEvent).detail).to.deep.equal({ envName: 'TOKEN', revealed: true });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent?.trim()).to.equal('first');
  });

  it('gives the reveal and copy buttons a :focus-visible outline (regression)', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret1', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const reveal = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLElement;
    reveal.focus();
    expect(getComputedStyle(reveal).outlineStyle).to.equal('solid');
    const copy = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLElement;
    copy.focus();
    expect(getComputedStyle(copy).outlineStyle).to.equal('solid');
  });

  it('masks a value with a fixed eight-bullet run regardless of value length', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'x', secret: true }, { name: 'TOKEN', value: 'a-much-longer-secret-value', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const values = [...el.shadowRoot!.querySelectorAll('[part="value"]')] as HTMLElement[];
    expect(values[0].querySelector('[aria-hidden="true"]')!.textContent).to.equal('•'.repeat(8));
    expect(values[1].querySelector('[aria-hidden="true"]')!.textContent).to.equal('•'.repeat(8));
    expect(values[0].dataset.masked).to.equal('true');
  });

  it('exposes the localized hidden-value meaning as text and hides decorative mask glyphs', async () => {
    const el = (await fixture(
      html`<lr-env-list
        .entries=${[{ name: 'API_KEY', value: 'secret', secret: true }]}
        .strings=${{ envListValueHidden: 'Confidential value' }}
      ></lr-env-list>`,
    )) as LyraEnvList;
    const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
    const hiddenText = value.querySelector('.sr-only') as HTMLElement | null;
    const mask = value.querySelector('[aria-hidden="true"]') as HTMLElement | null;

    expect(value.querySelectorAll('[aria-label]').length).to.equal(0);
    expect(hiddenText?.textContent).to.equal('Confidential value');
    expect(mask?.textContent).to.equal('•'.repeat(8));
  });

  it('defaults secret to true when omitted', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'X', value: 'plainish' }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).dataset.masked).to.equal('true');
  });

  it('renders a non-secret value in plain text', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'NODE_ENV', value: 'production', secret: false }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
    expect(value.textContent!.trim()).to.equal('production');
    expect(value.dataset.masked).to.equal('false');
  });

  it('reveal toggle flips masking and emits lr-reveal-change, keyed by name and surviving value-only updates', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret1', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const reveal = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-reveal-change');
    reveal.click();
    const event = (await listener) as CustomEvent<{ envName: string; revealed: boolean }>;
    expect(event.detail).to.deep.equal({ envName: 'API_KEY', revealed: true });
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).textContent!.trim()).to.equal('secret1');
    el.entries = [{ name: 'API_KEY', value: 'secret2', secret: true }];
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).textContent!.trim()).to.equal('secret2');
  });

  it('revealable=false renders no reveal button', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'X', value: 'y' }]} .revealable=${false}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="reveal-button"]').length).to.equal(0);
  });

  it('remasks revealed secrets when revealability is revoked', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).dataset.masked).to.equal('false');

    el.revealable = false;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).dataset.masked).to.equal('true');
    expect(el.shadowRoot!.querySelectorAll('[part="reveal-button"]').length).to.equal(0);
  });

  it('forwards a host aria-label to the populated list and reacts to late changes', async () => {
    const el = (await fixture(
      html`<lr-env-list
        label="Environment"
        aria-label="Deployment variables"
        .entries=${[{ name: 'NODE_ENV', value: 'production', secret: false }]}
      ></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const base = () => el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base().getAttribute('aria-label')).to.equal('Deployment variables');

    el.setAttribute('aria-label', 'Runtime variables');
    await el.updateComplete;
    expect(base().getAttribute('aria-label')).to.equal('Runtime variables');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(base().getAttribute('aria-label')).to.equal('Environment');
  });

  it('forwards a host aria-label to an empty-state semantic owner', async () => {
    const el = (await fixture(
      html`<lr-env-list aria-label="Deployment variables"></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Deployment variables');
  });

  it('accepts revealable="false" and copyable="false" as plain-HTML attribute strings, not just property bindings', async () => {
    const el = (await fixture(
      html`<lr-env-list revealable="false" copyable="false"></lr-env-list>`,
    )) as LyraEnvList;
    expect(el.revealable).to.be.false;
    expect(el.copyable).to.be.false;
    el.entries = [{ name: 'X', value: 'y', secret: true }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="reveal-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.equal(0);
  });

  it('waits for clipboard fulfillment before announcing or emitting a frozen success', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let resolveWrite!: () => void;
    const pending = new Promise<void>((resolve) => { resolveWrite = resolve; });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => pending },
    });
    try {
      const el = (await fixture(
        html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secretvalue', secret: true }]}></lr-env-list>`,
      )) as LyraEnvList;
      await el.updateComplete;
      let emitted = false;
      el.addEventListener('lr-copy', () => { emitted = true; });
      const listener = oneEvent(el, 'lr-copy');
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await Promise.resolve();
      expect(emitted, 'intent must not be reported as clipboard success').to.be.false;
      expect(document.querySelector('[data-lr-live-region="polite"]')?.textContent ?? '').not.to.contain('Copied!');

      resolveWrite();
      const event = (await listener) as CustomEvent<{ readonly ok: true; readonly text: string }>;
      expect(event.detail).to.deep.equal({ ok: true, text: 'secretvalue' });
      expect(Object.isFrozen(event.detail)).to.be.true;
      expect(document.querySelector('[data-lr-live-region="polite"]')?.textContent ?? '').to.contain('Copied!');
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('localizes clipboard rejection and emits only typed failure outcomes', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const error = new Error('platform secret must not be rendered');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw error; } },
    });
    try {
      const el = (await fixture(
        html`<lr-env-list
          .strings=${{ copyFailed: 'Unable to place value on clipboard' }}
          .entries=${[{ name: 'TOKEN', value: 'secretvalue', secret: true }]}
        ></lr-env-list>`,
      )) as LyraEnvList;
      await el.updateComplete;
      let succeeded = false;
      el.addEventListener('lr-copy', () => { succeeded = true; });
      const compatibility = oneEvent(el, 'lr-error');
      const failure = oneEvent(el, 'lr-copy-error');
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      const [, failureEvent] = await Promise.all([compatibility, failure]) as [Event, CustomEvent<{
        readonly ok: false;
        readonly text: string;
        readonly reason: string;
        readonly error: unknown;
      }>];

      expect(succeeded).to.be.false;
      expect(failureEvent.detail).to.deep.equal({
        ok: false,
        text: 'secretvalue',
        reason: 'failed',
        error,
      });
      expect(Object.isFrozen(failureEvent.detail)).to.be.true;
      const announcement = document.querySelector('[data-lr-live-region="polite"]')?.textContent ?? '';
      expect(announcement).to.contain('Unable to place value on clipboard');
      expect(announcement).not.to.contain(error.message);
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('uses the adopted owner clipboard and fails closed in an ownerless document', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const inertDocument = document.implementation.createHTMLDocument('ownerless');
    const ambientDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
    const destinationDescriptor = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    const ambientWrites: string[] = [];
    const destinationWrites: string[] = [];
    let el: LyraEnvList | undefined;

    try {
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => ambientWrites.push(text) },
      });
      Object.defineProperty(frameWindow.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => destinationWrites.push(text) },
      });
      el = (await fixture(
        html`<lr-env-list .entries=${[{ name: 'TOKEN', value: 'owner-secret', secret: true }]}></lr-env-list>`,
      )) as LyraEnvList;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      button.click();
      expect(destinationWrites).to.deep.equal(['owner-secret']);
      expect(ambientWrites).to.deep.equal([]);

      el.remove();
      inertDocument.body.append(inertDocument.adoptNode(el));
      button.click();
      expect(ambientWrites, 'an ownerless secret list must not fall back to the ambient clipboard').to.deep.equal([]);
    } finally {
      if (el && el.ownerDocument !== document) document.adoptNode(el);
      el?.remove();
      if (ambientDescriptor) Object.defineProperty(window.navigator, 'clipboard', ambientDescriptor);
      else Reflect.deleteProperty(window.navigator, 'clipboard');
      if (destinationDescriptor) Object.defineProperty(frameWindow.navigator, 'clipboard', destinationDescriptor);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });

  it('prunes reveal state for names no longer present', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'A', value: '1', secret: true }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
    el.entries = [{ name: 'B', value: '2', secret: true }, { name: 'A', value: '1', secret: true }];
    await el.updateComplete;
    // A new entry named "A" after "B" got re-added -- pruned reveal state means it's masked again.
    const values = [...el.shadowRoot!.querySelectorAll('[part="value"]')] as HTMLElement[];
    expect(values[1].dataset.masked).to.equal('true');
  });

  it('renders lr-empty when entries is empty', async () => {
    const el = (await fixture(html`<lr-env-list></lr-env-list>`)) as LyraEnvList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('is accessible with masked and revealed entries', async () => {
    const el = (await fixture(
      html`<lr-env-list .entries=${[{ name: 'A', value: '1', secret: true }, { name: 'B', value: '2', secret: false }]}></lr-env-list>`,
    )) as LyraEnvList;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  describe('--lr-env-list-reveal-active-bg / -border', () => {
    const pressedFixture = async (): Promise<LyraEnvList> => {
      const el = (await fixture(
        html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret', secret: true }]}></lr-env-list>`,
      )) as LyraEnvList;
      await el.updateComplete;
      (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
      await el.updateComplete;
      return el;
    };

    it('retints the pressed reveal button background and border via the cssprops', async () => {
      const el = await pressedFixture();
      el.style.setProperty('--lr-env-list-reveal-active-bg', 'rgb(10, 20, 30)');
      el.style.setProperty('--lr-env-list-reveal-active-border', 'rgb(40, 50, 60)');
      const btn = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLElement;
      expect(btn.getAttribute('aria-pressed')).to.equal('true');
      expect(getComputedStyle(btn).backgroundColor).to.equal('rgb(10, 20, 30)');
      expect(getComputedStyle(btn).borderTopColor).to.equal('rgb(40, 50, 60)');
    });

    it('renders byte-identically to the token defaults when unset', async () => {
      const el = await pressedFixture();
      const btn = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLElement;
      const bg = getComputedStyle(btn).backgroundColor;
      const border = getComputedStyle(btn).borderTopColor;
      el.style.setProperty('--lr-env-list-reveal-active-bg', 'var(--lr-color-brand-quiet)');
      el.style.setProperty('--lr-env-list-reveal-active-border', 'var(--lr-color-brand)');
      expect(getComputedStyle(btn).backgroundColor).to.equal(bg);
      expect(getComputedStyle(btn).borderTopColor).to.equal(border);
    });
  });

  it('gives reveal-button and copy-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='reveal-button'\]:hover/);
    expect(css).to.match(/\[part='copy-button'\]:hover/);
  });

  it('fully resets native button foreground and chrome for an explicit dark theme', async () => {
    const el = await fixture<LyraEnvList>(html`
      <lr-env-list
        style="color-scheme:dark; --lr-color-text:rgb(240, 241, 242); --lr-color-border:rgb(80, 81, 82)"
        .entries=${[{ name: 'A', value: 'one' }]}
      ></lr-env-list>
    `);
    const reveal = el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement;
    const copy = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    for (const button of [reveal, copy]) {
      const computed = getComputedStyle(button);
      expect(computed.color).to.equal('rgb(240, 241, 242)');
      expect(computed.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
      expect(computed.borderTopColor).to.equal('rgb(80, 81, 82)');
      expect(computed.fontFamily).to.equal(getComputedStyle(el).fontFamily);
    }
  });

  it('contains long unbroken names, revealed values, and action labels in a 320px allocation', async () => {
    const token = `ENV_${'IDENTIFIER'.repeat(40)}`;
    const wrapper = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 320px;">
        <lr-env-list .entries=${[{ name: token, value: token, secret: true }]}></lr-env-list>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-env-list') as LyraEnvList;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="reveal-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(Math.ceil(base.getBoundingClientRect().width) + 1);
    for (const part of ['name', 'value-cell', 'value', 'reveal-button', 'copy-button']) {
      const node = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(node.scrollWidth, part).to.be.at.most(Math.ceil(node.getBoundingClientRect().width) + 1);
    }
  });
});

it('renders the masked-value announcement visually hidden, not as visible text', async () => {
  // Without the shared `srOnly` sheet adopted into this shadow root, "Value hidden" painted as
  // ordinary text right beside the mask glyphs.
  const el = (await fixture(
    html`<lr-env-list .entries=${[{ name: 'API_KEY', value: 'secret1', secret: true }]}></lr-env-list>`,
  )) as LyraEnvList;
  await el.updateComplete;

  const marker = el.shadowRoot!.querySelector('.sr-only') as HTMLElement;
  const rect = marker.getBoundingClientRect();
  expect(rect.width, 'sr-only marker width').to.be.at.most(1);
  expect(rect.height, 'sr-only marker height').to.be.at.most(1);
});
