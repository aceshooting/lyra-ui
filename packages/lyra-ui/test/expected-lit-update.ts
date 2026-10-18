/** Captures only the exact Lit diagnostic caused by a deliberately reentrant fixture. */
export async function captureReentrantUpdateWarning(tagName: string, run: () => Promise<void>): Promise<number> {
  const message = `Element ${tagName} scheduled an update (generally because a property was set) after an update completed, causing a new update to be scheduled. This is inefficient and should be avoided unless the next update can only be scheduled as a side effect of the previous update. See https://lit.dev/msg/change-in-update for more information.`;
  const issued = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  const existed = issued?.has(message);
  issued?.delete(message);
  const warn = console.warn;
  let count = 0;
  console.warn = (...args: unknown[]) => {
    if (args.length === 1 && args[0] === message) count++;
    else warn(...args);
  };
  try { await run(); }
  finally {
    console.warn = warn;
    if (existed) issued?.add(message);
    else issued?.delete(message);
  }
  return count;
}
