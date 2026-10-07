/** Records clipboard writes and a delayed confirmation in the element's adopted document. */
export function adoptedClipboardProbe(confirmationDelay?: number) {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
  const nativeSetTimeout = frameWindow.setTimeout.bind(frameWindow);
  const nativeClearTimeout = frameWindow.clearTimeout.bind(frameWindow);
  let mainWrites = 0;
  const frameWrites: string[] = [];
  let frameTimers = 0;
  let confirmationHandle: number | undefined;
  let confirmationCallback: (() => void) | undefined;
  const cancelled: number[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => { mainWrites++; return Promise.resolve(); } },
  });
  Object.defineProperty(frameWindow.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (value: string) => { frameWrites.push(value); return Promise.resolve(); } },
  });
  frameWindow.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    frameTimers++;
    const handle = nativeSetTimeout(handler, timeout, ...args);
    if (confirmationDelay !== undefined && timeout === confirmationDelay) {
      confirmationHandle = handle;
      if (typeof handler === 'function') confirmationCallback = () => handler(...args);
    }
    return handle;
  }) as typeof frameWindow.setTimeout;
  frameWindow.clearTimeout = ((handle?: number) => {
    if (handle !== undefined) cancelled.push(handle);
    nativeClearTimeout(handle);
  }) as typeof frameWindow.clearTimeout;
  return {
    frameDocument, frameWindow, frameWrites, cancelled,
    get mainWrites() { return mainWrites; },
    get frameTimers() { return frameTimers; },
    get confirmationHandle() { return confirmationHandle; },
    get confirmationCallback() { return confirmationCallback; },
    close() {
      if (confirmationHandle !== undefined) nativeClearTimeout(confirmationHandle);
      frameWindow.setTimeout = nativeSetTimeout;
      frameWindow.clearTimeout = nativeClearTimeout;
      if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    },
  };
}
