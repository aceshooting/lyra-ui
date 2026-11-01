type ReleaseCallback = (this: void) => void;
type ErrorReporter = (this: void, error: unknown) => void;
interface CallbackCell { callback: ReleaseCallback | undefined }

// This scope receives neither the original callback argument nor the release Promise.
function createObserver(cell: CallbackCell, reportError: ErrorReporter) {
  return {
    fulfilled(): void {
      const callback = cell.callback;
      cell.callback = undefined;
      try { callback?.(); }
      catch (error) { reportError(error); }
    },
    rejected(error: unknown): void {
      cell.callback = undefined;
      reportError(error);
    },
    remove(): void { cell.callback = undefined; },
  };
}

/**
 * Observe retirement without retaining a canceled recovery callback in a pending Promise.
 * The trusted reporter must not throw or capture an engine, component or application owner.
 * Removal prevents undelivered recovery; it does not cancel release or global error reporting.
 */
export function observeXrRelease(
  released: Promise<void>,
  onReleased: ReleaseCallback,
  reportError: ErrorReporter,
): () => void {
  const observer = createObserver({ callback: onReleased }, reportError);
  void released.then(observer.fulfilled, observer.rejected);
  return observer.remove;
}
