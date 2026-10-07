interface LitWarningGlobal {
  litIssuedWarnings?: Set<string>;
}

/**
 * Seeds one exact page-wide `devWarnOnce()` key for a fixture that deliberately exercises the
 * corresponding fallback. This narrows only that warning; every other strict-console diagnostic
 * remains active. Tests whose subject is the warning itself should capture and assert it instead.
 */
export function expectDevWarning(key: string): void {
  (globalThis as LitWarningGlobal).litIssuedWarnings?.add(key);
}

/** Runs `run` against a fresh page-wide dedupe set with `console.warn` captured, and returns the
 *  messages it logged. For tests whose subject is the warning itself. */
export async function captureDevWarnings(run: () => unknown): Promise<string[]> {
  const runtime = globalThis as LitWarningGlobal;
  const issued = runtime.litIssuedWarnings;
  const warn = console.warn;
  const messages: string[] = [];
  runtime.litIssuedWarnings = new Set();
  console.warn = (...args: unknown[]) => void messages.push(String(args[0]));
  try {
    await run();
  } finally {
    console.warn = warn;
    if (issued) runtime.litIssuedWarnings = issued;
    else delete runtime.litIssuedWarnings;
  }
  return messages;
}
