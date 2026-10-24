import { expect, fixture, html, aTimeout } from "@open-wc/testing";
import { resolveIsDarkTheme, watchDarkTheme } from "./shiki-dark-theme.js";

for (const { name, text, surface, inheritedColor, dark } of [
  { name: 'short hex dark', text: '#fff', surface: '#111', dark: true },
  { name: 'short hex light', text: '#111', surface: '#fff', dark: false },
  { name: 'long hex dark', text: '#ffffff', surface: '#101010', dark: true },
  { name: 'long hex light', text: '#101010', surface: '#ffffff', dark: false },
  { name: 'named dark', text: 'white', surface: 'black', dark: true },
  { name: 'named light', text: 'black', surface: 'white', dark: false },
  { name: 'transparent dark', text: 'white', surface: 'transparent', dark: true },
  { name: 'transparent light', text: 'transparent', surface: 'white', dark: false },
  { name: 'currentColor dark', text: 'currentColor', surface: 'black', inheritedColor: 'white', dark: true },
  { name: 'currentColor light', text: 'currentColor', surface: 'white', inheritedColor: 'black', dark: false },
  { name: 'modern dark', text: 'oklch(95% 0 0)', surface: 'oklch(10% 0 0)', dark: true },
  { name: 'modern light', text: 'oklch(10% 0 0)', surface: 'oklch(95% 0 0)', dark: false },
] as const) {
  it(`classifies rendered ${name} syntax colors`, async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    host.setAttribute('data-lr-theme-scope', '');
    host.style.setProperty('--lr-color-text', text);
    host.style.setProperty('--lr-color-surface', surface);
    if (inheritedColor) host.style.color = inheritedColor;
    expect(resolveIsDarkTheme(host)).to.equal(dark);
  });
}

for (const [attribute, value] of [
  ['data-lr-theme', 'dark'],
  ['data-lr-mode', 'dark'],
  ['data-lr-look', 'shadcn'],
  ['data-lr-surface', 'glass'],
  ['data-lr-density', 'compact'],
  ['data-lr-accent', 'ruby'],
  ['data-lr-theme-scope', ''],
] as const) {
  it(`refreshes syntax colors when ${attribute} changes across a shadow boundary`, async () => {
    const scope = await fixture<HTMLElement>(html`<div></div>`);
    const root = scope.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host { --lr-color-text: black; --lr-color-surface: white; }' +
      `:host([${attribute}]) { --lr-color-text: white; --lr-color-surface: black; }`;
    const host = document.createElement('div');
    root.append(style, host);
    let dark = resolveIsDarkTheme(host);
    let changes = 0;
    const cleanup = watchDarkTheme(host, () => {
      dark = resolveIsDarkTheme(host);
      changes++;
    });
    try {
      expect(dark).to.be.false;
      scope.setAttribute(attribute, value);
      await aTimeout(0);
      expect(dark).to.be.true;
      expect(changes).to.equal(1);
      scope.removeAttribute(attribute);
      await aTimeout(0);
      expect(dark).to.be.false;
      expect(changes).to.equal(2);
      cleanup();
      scope.setAttribute(attribute, value);
      await aTimeout(0);
      expect(changes).to.equal(2);
    } finally {
      cleanup();
    }
  });
}

it('observes a slotted host through the slot that supplies its inherited palette', async () => {
  const scope = await fixture<HTMLElement>(html`<div><span></span></div>`);
  const root = scope.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = 'slot { --lr-color-text: black; --lr-color-surface: white; }' +
    'slot[data-lr-theme="dark"] { --lr-color-text: white; --lr-color-surface: black; }';
  const slot = document.createElement('slot');
  root.append(style, slot);
  const host = scope.querySelector('span')!;
  let dark = resolveIsDarkTheme(host);
  const cleanup = watchDarkTheme(host, () => { dark = resolveIsDarkTheme(host); });
  try {
    expect(dark).to.be.false;
    slot.setAttribute('data-lr-theme', 'dark');
    await aTimeout(0);
    expect(dark).to.be.true;
  } finally {
    cleanup();
  }
});

it("returns an inert reusable cleanup for a disconnected host", () => {
  const host = document.createElement("div");
  let changes = 0;
  const cleanup = watchDarkTheme(host, () => changes++);
  cleanup();
  cleanup();
  expect(changes).to.equal(0);
});

it("resolves computed colors and color grammar through the adopted owner realm", async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const host = frameDocument.createElement("div");
  host.setAttribute(
    "style",
    "color:white; --lr-color-text:currentColor; --lr-color-surface:oklch(12% 0 0)"
  );
  frameDocument.body.append(host);
  const ambientGetComputedStyle = window.getComputedStyle;
  const ownerGetComputedStyle = frameWindow.getComputedStyle;
  const ownerCreateElement = frameDocument.createElement;
  let ownerStyleReads = 0;
  let ownerCanvasCreations = 0;

  try {
    window.getComputedStyle = () => {
      throw new Error("ambient getComputedStyle must not be used");
    };
    frameWindow.getComputedStyle = (
      element: Element,
      pseudoElement?: string | null
    ) => {
      ownerStyleReads += 1;
      return ownerGetComputedStyle.call(frameWindow, element, pseudoElement);
    };
    frameDocument.createElement = function (
      localName: string,
      options?: ElementCreationOptions
    ): HTMLElement {
      if (localName.toLowerCase() === "canvas") ownerCanvasCreations += 1;
      return ownerCreateElement.call(frameDocument, localName, options);
    } as typeof frameDocument.createElement;

    expect(resolveIsDarkTheme(host)).to.be.true;
    expect(ownerStyleReads).to.equal(1);
    expect(ownerCanvasCreations).to.equal(1);
  } finally {
    frameDocument.createElement = ownerCreateElement;
    frameWindow.getComputedStyle = ownerGetComputedStyle;
    window.getComputedStyle = ambientGetComputedStyle;
    host.remove();
    frame.remove();
  }
});

it("watches and cleans the exact owner theme resources while rejecting stale callbacks", async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const host = frameDocument.createElement("div");
  frameDocument.body.append(host);
  const ambientObserverDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "MutationObserver"
  );
  const ownerObserverDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow,
    "MutationObserver"
  );
  const matchMediaDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow,
    "matchMedia"
  );
  let ambientObserverConstructions = 0;
  let mediaAdded: EventListener | undefined;
  let mediaRemoved: EventListener | undefined;
  const observers: Array<{
    callback: MutationCallback;
    observer: MutationObserver;
    targets: Node[];
    disconnects: number;
  }> = [];
  let cleanup: (() => void) | undefined;

  class AmbientMutationObserverTrap implements MutationObserver {
    constructor(_callback: MutationCallback) {
      ambientObserverConstructions += 1;
      throw new Error("ambient MutationObserver must not be used");
    }
    disconnect(): void {}
    observe(): void {}
    takeRecords(): MutationRecord[] {
      return [];
    }
  }

  class OwnerMutationObserver implements MutationObserver {
    private readonly record: (typeof observers)[number];
    constructor(callback: MutationCallback) {
      this.record = { callback, observer: this, targets: [], disconnects: 0 };
      observers.push(this.record);
    }
    disconnect(): void {
      this.record.disconnects += 1;
    }
    observe(target: Node): void {
      this.record.targets.push(target);
    }
    takeRecords(): MutationRecord[] {
      return [];
    }
  }

  try {
    Object.defineProperty(window, "MutationObserver", {
      configurable: true,
      value: AmbientMutationObserverTrap,
    });
    Object.defineProperty(frameWindow, "MutationObserver", {
      configurable: true,
      value: OwnerMutationObserver,
    });
    Object.defineProperty(frameWindow, "matchMedia", {
      configurable: true,
      value: () =>
        ({
          addEventListener(type: string, listener: EventListener): void {
            if (type === "change") mediaAdded = listener;
          },
          removeEventListener(type: string, listener: EventListener): void {
            if (type === "change" && listener === mediaAdded)
              mediaRemoved = listener;
          },
        } as unknown as MediaQueryList),
    });

    let changes = 0;
    cleanup = watchDarkTheme(host, () => {
      changes += 1;
    });
    expect(ambientObserverConstructions).to.equal(0);
    expect(observers).to.have.lengthOf(1);
    expect(observers[0]!.targets).to.include(host);
    expect(mediaAdded).to.exist;

    observers[0]!.callback([], observers[0]!.observer);
    mediaAdded!(new Event("change"));
    expect(changes).to.equal(2);

    document.body.append(document.adoptNode(host));
    observers[0]!.callback([], observers[0]!.observer);
    mediaAdded!(new Event("change"));
    expect(changes).to.equal(2);

    cleanup();
    cleanup = undefined;
    expect(observers[0]!.disconnects).to.equal(1);
    expect(mediaRemoved).to.equal(mediaAdded);
    observers[0]!.callback([], observers[0]!.observer);
    expect(changes).to.equal(2);
  } finally {
    cleanup?.();
    host.remove();
    if (ambientObserverDescriptor) {
      Object.defineProperty(
        window,
        "MutationObserver",
        ambientObserverDescriptor
      );
    } else {
      Reflect.deleteProperty(window, "MutationObserver");
    }
    if (ownerObserverDescriptor) {
      Object.defineProperty(
        frameWindow,
        "MutationObserver",
        ownerObserverDescriptor
      );
    } else {
      Reflect.deleteProperty(frameWindow, "MutationObserver");
    }
    if (matchMediaDescriptor)
      Object.defineProperty(frameWindow, "matchMedia", matchMediaDescriptor);
    else Reflect.deleteProperty(frameWindow, "matchMedia");
    frame.remove();
  }
});

it('classifies a fully transparent modern surface as unresolvable rather than light or dark', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  host.setAttribute('data-lr-theme-scope', '');
  host.style.setProperty('--lr-color-text', 'oklch(95% 0 0)');
  host.style.setProperty('--lr-color-surface', 'oklch(10% 0 0)');
  expect(resolveIsDarkTheme(host), 'an opaque dark surface').to.equal(true);

  host.style.setProperty('--lr-color-surface', 'oklch(10% 0 0 / 0)');
  expect(resolveIsDarkTheme(host), 'the same surface with zero alpha').to.equal(false);
});

describe('platform failures around the resolved theme', () => {
  async function ownerFrame(): Promise<{ frame: HTMLIFrameElement; view: Window; host: HTMLElement }> {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const view = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    if (!view || !frameDocument) throw new Error('The iframe realm was unavailable.');
    const host = frameDocument.createElement('div');
    frameDocument.body.append(host);
    return { frame, view, host };
  }

  function override(target: object, key: string, value: unknown): () => void {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
    return () => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    };
  }

  it('reports a light theme for a host whose document has no window or no style resolver', async () => {
    const detached = document.implementation.createHTMLDocument('');
    expect(resolveIsDarkTheme(detached.createElement('div'))).to.equal(false);

    const { frame, view, host } = await ownerFrame();
    const restore = override(view, 'getComputedStyle', undefined);
    try {
      expect(resolveIsDarkTheme(host)).to.equal(false);
    } finally {
      restore();
      frame.remove();
    }
  });

  it('reports a light theme and removes its probe when computed style throws', async () => {
    const { frame, view, host } = await ownerFrame();
    const restore = override(view, 'getComputedStyle', () => {
      throw new Error('style unavailable');
    });
    try {
      expect(resolveIsDarkTheme(host)).to.equal(false);
      expect(host.childElementCount).to.equal(0);
    } finally {
      restore();
      frame.remove();
    }
  });

  it('reports a light theme for modern colors when the owner document has no canvas context to resolve them', async () => {
    const { frame, view, host } = await ownerFrame();
    const proto = (view as Window & typeof globalThis).HTMLCanvasElement.prototype;
    const restore = override(proto, 'getContext', () => null);
    try {
      host.setAttribute('style', '--lr-color-text: oklch(95% 0 0); --lr-color-surface: oklch(10% 0 0)');

      expect(resolveIsDarkTheme(host), 'the same palette resolves dark where a canvas exists').to.equal(false);
    } finally {
      restore();
    }
    // A fresh owner document resolves the identical palette through its own canvas.
    const second = await ownerFrame();
    second.host.setAttribute('style', '--lr-color-text: oklch(95% 0 0); --lr-color-surface: oklch(10% 0 0)');
    expect(resolveIsDarkTheme(second.host)).to.equal(true);
    frame.remove();
    second.frame.remove();
  });

  it('keeps watching theme attributes when the color-scheme query is unavailable', async () => {
    const { frame, view, host } = await ownerFrame();
    const restore = override(view, 'matchMedia', () => {
      throw new Error('media queries unavailable');
    });
    let changes = 0;
    const cleanup = watchDarkTheme(host, () => changes++);
    try {
      host.setAttribute('data-lr-theme', 'dark');
      await aTimeout(0);
      expect(changes).to.equal(1);
    } finally {
      cleanup();
      restore();
      frame.remove();
    }
  });

  it('returns a safe cleanup when the owner observer cannot be created or cannot observe', async () => {
    for (const mode of ['construct', 'observe'] as const) {
      const { frame, view, host } = await ownerFrame();
      const NativeObserver = (view as Window & typeof globalThis).MutationObserver;
      const Hostile = mode === 'construct'
        ? class {
            constructor() {
              throw new Error('observer unavailable');
            }
          }
        : class extends NativeObserver {
            override observe(): void {
              throw new Error('observation unavailable');
            }
          };
      const restore = override(view, 'MutationObserver', Hostile);
      let changes = 0;
      try {
        const cleanup = watchDarkTheme(host, () => changes++);
        host.setAttribute('data-lr-theme', 'dark');
        await aTimeout(0);
        expect(changes, mode).to.equal(0);
        expect(() => cleanup(), mode).not.to.throw();
        expect(() => cleanup(), mode).not.to.throw();
      } finally {
        restore();
        frame.remove();
      }
    }
  });
});
