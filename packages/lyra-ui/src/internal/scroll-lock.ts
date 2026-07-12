let lockCount = 0;
let previousOverflow = '';

/**
 * Ref-counted document scroll lock — safe when a lock is acquired and
 * released more than once concurrently (e.g. a fast open/close/open
 * sequence). The original `overflow` value is restored only once the last
 * outstanding lock releases.
 */
export function lockScroll(): () => void {
  if (lockCount === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }
  lockCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount--;
    if (lockCount === 0) {
      document.documentElement.style.overflow = previousOverflow;
    }
  };
}
