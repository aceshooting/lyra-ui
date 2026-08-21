import { expect, fixture, html } from '@open-wc/testing';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/forms/select/select.js';

interface PointerListenerTracker {
  added: Array<(event: PointerEvent) => void>;
  active: Set<(event: PointerEvent) => void>;
  restore(): void;
}

function trackPointerListeners(owner: Document): PointerListenerTracker {
  const originalAdd = owner.addEventListener;
  const originalRemove = owner.removeEventListener;
  const added: Array<(event: PointerEvent) => void> = [];
  const active = new Set<(event: PointerEvent) => void>();
  owner.addEventListener = (function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (type === 'pointerdown' && typeof listener === 'function') {
      const pointerListener = listener as (event: PointerEvent) => void;
      added.push(pointerListener);
      active.add(pointerListener);
    }
    originalAdd.call(owner, type, listener, options);
  }) as typeof owner.addEventListener;
  owner.removeEventListener = (function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (type === 'pointerdown' && typeof listener === 'function') {
      active.delete(listener as (event: PointerEvent) => void);
    }
    originalRemove.call(owner, type, listener, options);
  }) as typeof owner.removeEventListener;
  return {
    added,
    active,
    restore(): void {
      owner.addEventListener = originalAdd;
      owner.removeEventListener = originalRemove;
    },
  };
}

it('rebinds popup dismissal to the current document without detached or stale listeners', async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error('The iframe document was unavailable.');
  const ambient = trackPointerListeners(document);
  const destination = trackPointerListeners(frameDocument);
  const tags = [
    'lr-model-select',
    'lr-voice-picker',
    'lr-combobox',
    'lr-date-input',
    'lr-locale-picker',
    'lr-select',
  ] as const;
  const outsidePointer = { composedPath: () => [] } as unknown as PointerEvent;
  const elements: Array<HTMLElement & { open: boolean; updateComplete: Promise<unknown> }> = [];

  try {
    for (const tagName of tags) {
      const element = document.createElement(tagName) as HTMLElement & {
        open: boolean;
        updateComplete: Promise<unknown>;
      };
      if (tagName === 'lr-locale-picker') {
        (element as unknown as { showFlags: boolean }).showFlags = false;
      }
      elements.push(element);
      element.open = true;
      document.body.append(element);
      await element.updateComplete;
      const stale = ambient.added.at(-1);
      expect(stale, `${tagName} must bind its initial dismissal listener`).to.exist;
      expect(ambient.active.has(stale!), `${tagName} initial listener is active`).to.be.true;

      element.remove();
      expect(ambient.active.has(stale!), `${tagName} removes from the exact old document`).to.be.false;
      frameDocument.adoptNode(element);
      element.open = true;
      await element.updateComplete;
      expect(
        destination.active.size,
        `${tagName} must not arm a destination listener while detached`,
      ).to.equal(0);

      frameDocument.body.append(element);
      await element.updateComplete;
      const current = destination.added.at(-1);
      expect(current, `${tagName} rebinds on reconnect`).to.exist;
      expect(destination.active.has(current!)).to.be.true;

      stale!(outsidePointer);
      await element.updateComplete;
      expect(element.open, `${tagName} ignores a queued old-document callback`).to.be.true;

      current!(outsidePointer);
      await element.updateComplete;
      expect(element.open, `${tagName} current-document callback still dismisses`).to.be.false;
      element.remove();
      expect(destination.active.size, `${tagName} cleans up its current listener`).to.equal(0);
    }
  } finally {
    for (const element of elements) element.remove();
    destination.restore();
    ambient.restore();
    frame.remove();
  }
});

it('rebinds date-input visibility work and ignores a queued old-document callback', async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error('The iframe document was unavailable.');
  const install = (owner: Document): {
    added: Array<() => void>;
    active: Set<() => void>;
    restore(): void;
  } => {
    const originalAdd = owner.addEventListener;
    const originalRemove = owner.removeEventListener;
    const added: Array<() => void> = [];
    const active = new Set<() => void>();
    owner.addEventListener = (function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === 'visibilitychange' && typeof listener === 'function') {
        const callback = listener as () => void;
        added.push(callback);
        active.add(callback);
      }
      originalAdd.call(owner, type, listener, options);
    }) as typeof owner.addEventListener;
    owner.removeEventListener = (function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      if (type === 'visibilitychange' && typeof listener === 'function') {
        active.delete(listener as () => void);
      }
      originalRemove.call(owner, type, listener, options);
    }) as typeof owner.removeEventListener;
    return {
      added,
      active,
      restore(): void {
        owner.addEventListener = originalAdd;
        owner.removeEventListener = originalRemove;
      },
    };
  };
  const ambient = install(document);
  const destination = install(frameDocument);
  const element = document.createElement('lr-date-input') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };

  try {
    document.body.append(element);
    await element.updateComplete;
    const stale = ambient.added.at(-1)!;
    element.remove();
    expect(ambient.active.has(stale)).to.be.false;
    frameDocument.adoptNode(element);
    frameDocument.body.append(element);
    await element.updateComplete;
    const current = destination.added.at(-1)!;
    const state = element as unknown as { validityRevision: number };
    const before = state.validityRevision;
    stale();
    await element.updateComplete;
    expect(state.validityRevision).to.equal(before);
    current();
    await element.updateComplete;
    expect(state.validityRevision).to.equal(before + 1);
  } finally {
    element.remove();
    destination.restore();
    ambient.restore();
    frame.remove();
  }
});

interface MutationObserverRecord {
  callback: MutationCallback;
  observer: MutationObserver;
  observed: Node[];
  options: MutationObserverInit[];
  disconnects: number;
}

function trackedMutationObserver(records: MutationObserverRecord[]): typeof MutationObserver {
  return class implements MutationObserver {
    private readonly record: MutationObserverRecord;

    constructor(callback: MutationCallback) {
      this.record = { callback, observer: this, observed: [], options: [], disconnects: 0 };
      records.push(this.record);
    }

    observe(target: Node, options?: MutationObserverInit): void {
      this.record.observed.push(target);
      this.record.options.push(options ?? {});
    }

    disconnect(): void {
      this.record.disconnects += 1;
    }

    takeRecords(): MutationRecord[] {
      return [];
    }
  };
}

it('uses the current owner MutationObserver for date validators and rejects an adopted stale callback', async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
  const mainDescriptor = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const frameDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
  const mainRecords: MutationObserverRecord[] = [];
  const frameRecords: MutationObserverRecord[] = [];
  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    value: trackedMutationObserver(mainRecords),
  });
  Object.defineProperty(frameWindow, 'MutationObserver', {
    configurable: true,
    value: trackedMutationObserver(frameRecords),
  });
  let validations = 0;
  const element = document.createElement('lr-date-input') as HTMLElement & {
    validators: Array<{
      observedAttributes: string[];
      checkValidity(input: never): { isValid: boolean; message: string; invalidKeys: never[] };
    }>;
    updateComplete: Promise<unknown>;
  };
  element.validators = [{
    observedAttributes: ['data-rule'],
    checkValidity: () => {
      validations += 1;
      return { isValid: true, message: '', invalidKeys: [] };
    },
  }];

  try {
    document.body.append(element);
    await element.updateComplete;
    const isValidatorObserver = (record: MutationObserverRecord): boolean =>
      record.observed.includes(element)
      && record.options.some((options) => options.attributeFilter?.includes('data-rule'));
    const initialValidatorRecords = mainRecords.filter(isValidatorObserver);
    const initialActive = initialValidatorRecords.filter((record) => record.disconnects === 0);
    expect(initialActive).to.have.lengthOf(1);
    expect(
      initialValidatorRecords.filter((record) => record !== initialActive[0]).every((record) => record.disconnects > 0),
    ).to.be.true;
    const stale = initialActive[0]!;
    expect(stale.observed).to.deep.equal([element]);

    frameDocument.body.append(frameDocument.adoptNode(element));
    await element.updateComplete;
    expect(stale.disconnects).to.be.greaterThan(0);
    expect(mainRecords.filter(isValidatorObserver).filter((record) => record.disconnects === 0)).to.have.lengthOf(0);
    const currentValidatorRecords = frameRecords
      .filter(isValidatorObserver)
      .filter((record) => record.disconnects === 0);
    expect(currentValidatorRecords).to.have.lengthOf(1);
    const current = currentValidatorRecords[0]!;

    const before = validations;
    stale.callback([], stale.observer);
    expect(validations).to.equal(before);
    current.callback([], current.observer);
    expect(validations).to.equal(before + 1);

    element.remove();
    expect(current.disconnects).to.be.greaterThan(0);
  } finally {
    element.remove();
    if (mainDescriptor) Object.defineProperty(window, 'MutationObserver', mainDescriptor);
    else Reflect.deleteProperty(window, 'MutationObserver');
    if (frameDescriptor) Object.defineProperty(frameWindow, 'MutationObserver', frameDescriptor);
    else Reflect.deleteProperty(frameWindow, 'MutationObserver');
    frame.remove();
  }
});

interface TimerTracker {
  scheduled: Array<{ id: number; handler: TimerHandler; timeout: number | undefined }>;
  cleared: number[];
  restore(): void;
}

function trackTimers(owner: Window): TimerTracker {
  const originalSetTimeout = owner.setTimeout;
  const originalClearTimeout = owner.clearTimeout;
  const scheduled: Array<{ id: number; handler: TimerHandler; timeout: number | undefined }> = [];
  const cleared: number[] = [];
  owner.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = originalSetTimeout.call(owner, handler, timeout, ...args);
    scheduled.push({ id, handler, timeout });
    return id;
  }) as typeof owner.setTimeout;
  owner.clearTimeout = ((id: number | undefined) => {
    if (id !== undefined) cleared.push(id);
    originalClearTimeout.call(owner, id);
  }) as typeof owner.clearTimeout;
  return {
    scheduled,
    cleared,
    restore(): void {
      owner.setTimeout = originalSetTimeout;
      owner.clearTimeout = originalClearTimeout;
    },
  };
}

it('uses destination-realm timers and AbortController for adopted async/type-ahead work', async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
  const elements: Array<HTMLElement & { updateComplete: Promise<unknown> }> = [];

  const adopt = async (tagName: string): Promise<HTMLElement & { updateComplete: Promise<unknown> }> => {
    const element = document.createElement(tagName) as HTMLElement & { updateComplete: Promise<unknown> };
    if (tagName === 'lr-locale-picker') {
      (element as unknown as { showFlags: boolean }).showFlags = false;
    }
    elements.push(element);
    document.body.append(element);
    await element.updateComplete;
    frameDocument.adoptNode(element);
    frameDocument.body.append(element);
    await element.updateComplete;
    return element;
  };

  const localePicker = await adopt('lr-locale-picker');
  const select = await adopt('lr-select');
  const combobox = await adopt('lr-combobox');
  const ambientTimers = trackTimers(window);
  const destinationTimers = trackTimers(frameWindow);
  const AmbientAbortController = window.AbortController;
  const DestinationAbortController = frameWindow.AbortController;
  let ambientAbortControllers = 0;
  let destinationAbortControllers = 0;
  class AmbientTrackedAbortController extends AmbientAbortController {
    constructor() {
      super();
      ambientAbortControllers += 1;
    }
  }
  class DestinationTrackedAbortController extends DestinationAbortController {
    constructor() {
      super();
      destinationAbortControllers += 1;
    }
  }
  window.AbortController = AmbientTrackedAbortController;
  frameWindow.AbortController = DestinationTrackedAbortController;

  try {
    const ambientBeforeLocale = ambientTimers.scheduled.length;
    const destinationBeforeLocale = destinationTimers.scheduled.length;
    (localePicker as unknown as { typeAhead(char: string): void }).typeAhead('x');
    expect(ambientTimers.scheduled.length).to.equal(ambientBeforeLocale);
    expect(destinationTimers.scheduled.length).to.equal(destinationBeforeLocale + 1);
    const localeTimer = destinationTimers.scheduled.at(-1)!.id;
    localePicker.remove();
    expect(destinationTimers.cleared).to.include(localeTimer);
    const ambientBeforeSelect = ambientTimers.scheduled.length;
    const destinationBeforeSelect = destinationTimers.scheduled.length;
    (select as unknown as { typeAhead(char: string): void }).typeAhead('x');
    expect(ambientTimers.scheduled.length).to.equal(ambientBeforeSelect);
    expect(destinationTimers.scheduled.length).to.equal(destinationBeforeSelect + 1);
    const selectTimer = destinationTimers.scheduled.at(-1)!.id;
    select.remove();
    expect(destinationTimers.cleared).to.include(selectTimer);
    Object.assign(combobox, {
      sourceDelay: 0,
      source: () => Promise.resolve([]),
    });
    await combobox.updateComplete;
    const ambientBeforeSource = ambientTimers.scheduled.length;
    const destinationBeforeSource = destinationTimers.scheduled.length;
    (combobox as unknown as { runSource(query: string): void }).runSource('owner');
    expect(ambientTimers.scheduled.length).to.equal(ambientBeforeSource);
    expect(destinationTimers.scheduled.length).to.equal(destinationBeforeSource + 1);
    const sourceTimer = destinationTimers.scheduled.at(-1)!;
    expect(typeof sourceTimer.handler).to.equal('function');
    frameWindow.clearTimeout(sourceTimer.id);
    (sourceTimer.handler as () => void)();
    expect(ambientAbortControllers).to.equal(0);
    expect(destinationAbortControllers).to.equal(1);

    // A callback whose timeout was already queued can still arrive after a newer debounce was
    // armed. It must not erase the newer timer's retained identity, or disconnect would no longer
    // be able to cancel that current destination-realm task.
    (combobox as unknown as { runSource(query: string): void }).runSource('stale');
    const staleSourceTimer = destinationTimers.scheduled.at(-1)!;
    (combobox as unknown as { runSource(query: string): void }).runSource('current');
    const currentSourceTimer = destinationTimers.scheduled.at(-1)!;
    expect(destinationTimers.cleared).to.include(staleSourceTimer.id);
    (staleSourceTimer.handler as () => void)();
    expect(destinationAbortControllers).to.equal(1);
    combobox.remove();
    expect(destinationTimers.cleared).to.include(currentSourceTimer.id);
  } finally {
    for (const element of elements) element.remove();
    frameWindow.AbortController = DestinationAbortController;
    window.AbortController = AmbientAbortController;
    destinationTimers.restore();
    ambientTimers.restore();
    frame.remove();
  }
});

it('creates adopted voice previews in the owner document and resolves relative media URLs there', async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
  const base = frameDocument.createElement('base');
  base.href = 'https://frame.example/voice/';
  frameDocument.head.append(base);
  const element = document.createElement('lr-voice-picker') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  document.body.append(element);
  await element.updateComplete;
  frameDocument.adoptNode(element);
  frameDocument.body.append(element);
  await element.updateComplete;

  const AmbientAudio = window.Audio;
  const originalCreateElement = frameDocument.createElement;
  const originalPlay = frameWindow.HTMLMediaElement.prototype.play;
  const originalPause = frameWindow.HTMLMediaElement.prototype.pause;
  let ambientAudioConstructions = 0;
  let destinationAudioCreations = 0;
  let destinationPauseCalls = 0;
  const previewChanges: Array<string | null> = [];
  element.addEventListener('lr-preview-change', (event) => {
    previewChanges.push((event as CustomEvent<{ voiceId: string | null }>).detail.voiceId);
  });
  window.Audio = function (src?: string): HTMLAudioElement {
    ambientAudioConstructions += 1;
    return new AmbientAudio(src);
  } as typeof window.Audio;
  frameDocument.createElement = (function (
    localName: string,
    options?: ElementCreationOptions,
  ): HTMLElement {
    const created = originalCreateElement.call(frameDocument, localName, options);
    if (localName.toLowerCase() === 'audio') destinationAudioCreations += 1;
    return created;
  }) as typeof frameDocument.createElement;
  frameWindow.HTMLMediaElement.prototype.play = () => Promise.resolve();
  frameWindow.HTMLMediaElement.prototype.pause = () => {
    destinationPauseCalls += 1;
  };

  try {
    (element as unknown as { playInternal(voiceId: string, url: string): void }).playInternal(
      'owner-voice',
      'sample.mp3',
    );
    const audio = (element as unknown as { audioEl?: HTMLAudioElement }).audioEl;
    expect(ambientAudioConstructions).to.equal(0);
    expect(destinationAudioCreations).to.equal(1);
    expect(audio?.ownerDocument).to.equal(frameDocument);
    expect(audio?.src).to.equal('https://frame.example/voice/sample.mp3');
    audio?.dispatchEvent(new frameWindow.Event('error'));
    await element.updateComplete;
    expect(destinationPauseCalls).to.equal(1);
    expect((element as unknown as { audioEl?: HTMLAudioElement }).audioEl).to.equal(undefined);
    expect(previewChanges).to.deep.equal(['owner-voice', null]);
  } finally {
    (element as unknown as { stopInternalPreview(): void }).stopInternalPreview();
    frameWindow.HTMLMediaElement.prototype.play = originalPlay;
    frameWindow.HTMLMediaElement.prototype.pause = originalPause;
    frameDocument.createElement = originalCreateElement;
    window.Audio = AmbientAudio;
    element.remove();
    frame.remove();
  }
});
