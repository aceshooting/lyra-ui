export interface StackFrame {
  functionName?: string;
  file?: string;
  line?: number;
  column?: number;
  internal: boolean;
  raw: string;
}

export interface StackGroup {
  message: string;
  frames: StackFrame[];
}

/** File-path substrings/patterns that mark a frame as framework/runtime noise by default --
 *  common Node/V8, browser, and Python standard-library/dependency locations. */
export const DEFAULT_INTERNAL_PATTERNS: (string | RegExp)[] = [
  'node_modules/',
  'node:internal',
  '(native)',
  'site-packages/',
  'dist-packages/',
  '/usr/lib/python',
];

// Only strips the leading "at [async] [new] " tokens -- deliberately has no way to fail once "at"
// is found (everything after is optional/zero-width), so `\s+` always commits to its greedy match
// with no backtracking possible. The former single-regex match of the whole frame let a lazy
// function-name group and the file/line/col group both range over many repeated "(" occurrences
// (e.g. "a (a (a (a..."), which is quadratic; see `matchV8FrameWithFn` below for the
// backtracking-free replacement.
const V8_FRAME_PREFIX = /^\s*at\s+(?:async\s+)?(?:new\s+)?/;
const DIGITS_RE = /^\d+$/;
// The function-name capture requires a non-whitespace first character (`\S.*`) so the preceding
// `\s+` and the capture can't both claim the same run of spaces -- that ambiguity is what made the
// original `(.+)` form polynomial-time on adversarial input (CodeQL js/polynomial-redos).
const V8_FRAME_BARE = /^\s*at\s+(?:async\s+)?(\S.*):(\d+):(\d+)\s*$/;
const FIREFOX_FRAME = /^([^\s@]*)@(.+):(\d+):(\d+)$/;
const JS_CAUSE = /^\s*(?:Caused by:|\[cause\]:)(.*)$/;

const PYTHON_HEADER = /^Traceback \(most recent call last\):\s*$/;
// File-path capture excludes `"` (its own delimiter) so the boundary is unambiguous instead of
// backtracking across every `"` in the line; the trailing function-name is trimmed in code below
// rather than via a lazy `(.+?)\s*$`, which was the other polynomial-time spot CodeQL flagged.
const PYTHON_FRAME = /^\s*File "([^"]+)", line (\d+), in (.+)$/;
const PYTHON_CHAIN_SEPARATOR = /direct cause|During handling/;
// Equivalent to the original `\S+(\.\S+)*:\s` -- `\S` already matches `.`, so the `(\.\S+)*`
// group added no coverage, only exponential backtracking (CodeQL js/redos) on input like many
// repetitions of "!.".
const PYTHON_EXC_TRAILER = /^\s*\S+:\s/;

interface V8FrameWithFn {
  fn: string;
  file: string;
  line: string;
  col: string;
}

/** Matches a V8 "at <fn> (<file>:<line>:<col>)" frame without regex backtracking: the location's
 *  opening paren is found via `lastIndexOf` (it's always the rightmost one on a well-formed line),
 *  and the trailing `:line:col` is split off the same way, so there is no ambiguous partition for
 *  a backtracking engine to search across. */
function matchV8FrameWithFn(line: string): V8FrameWithFn | null {
  const prefixMatch = V8_FRAME_PREFIX.exec(line);
  if (!prefixMatch) return null;
  const rest = line.slice(prefixMatch[0].length).trimEnd();
  const openParen = rest.length > 1 && rest.endsWith(')') ? rest.lastIndexOf('(') : -1;
  if (openParen <= 0 || rest[openParen - 1] !== ' ') return null;
  const fn = rest.slice(0, openParen - 1);
  const inner = rest.slice(openParen + 1, -1);
  const lastColon = inner.lastIndexOf(':');
  const secondLastColon = lastColon === -1 ? -1 : inner.lastIndexOf(':', lastColon - 1);
  if (fn.length === 0 || secondLastColon === -1) return null;
  const file = inner.slice(0, secondLastColon);
  const lineStr = inner.slice(secondLastColon + 1, lastColon);
  const col = inner.slice(lastColon + 1);
  if (!file || !DIGITS_RE.test(lineStr) || !DIGITS_RE.test(col)) return null;
  return { fn, file, line: lineStr, col };
}

function isInternal(file: string | undefined, patterns: (string | RegExp)[]): boolean {
  if (!file) return false;
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') return file.includes(pattern);
    // RegExp instances with `g`/`y` mutate lastIndex on test(). A caller-provided stateful pattern
    // must classify every frame independently rather than alternating based on prior frames.
    pattern.lastIndex = 0;
    const matches = pattern.test(file);
    pattern.lastIndex = 0;
    return matches;
  });
}

function parseJs(lines: string[], internalPatterns: (string | RegExp)[]): StackGroup[] {
  const groups: StackGroup[] = [];
  let current: StackGroup = { message: '', frames: [] };
  let messageLines: string[] = [];
  let sawFrame = false;
  const flush = (): void => {
    current.message = messageLines.join('\n').trim();
    groups.push(current);
  };
  for (const line of lines) {
    const causeMatch = JS_CAUSE.exec(line);
    if (causeMatch) {
      flush();
      current = { message: '', frames: [] };
      messageLines = [causeMatch[1]!];
      sawFrame = false;
      continue;
    }
    const withFn = matchV8FrameWithFn(line);
    const bare = !withFn ? V8_FRAME_BARE.exec(line) : null;
    const firefox = !withFn && !bare ? FIREFOX_FRAME.exec(line) : null;
    if (withFn) {
      const { fn, file, line: ln, col } = withFn;
      current.frames.push({
        functionName: fn,
        file,
        line: Number(ln),
        column: Number(col),
        internal: isInternal(file, internalPatterns),
        raw: line,
      });
      sawFrame = true;
    } else if (bare) {
      const [, file, ln, col] = bare;
      current.frames.push({
        file,
        line: Number(ln),
        column: Number(col),
        internal: isInternal(file, internalPatterns),
        raw: line,
      });
      sawFrame = true;
    } else if (firefox && /:\d+:\d+$/.test(line)) {
      const [, fn, file, ln, col] = firefox;
      current.frames.push({
        functionName: fn || undefined,
        file,
        line: Number(ln),
        column: Number(col),
        internal: isInternal(file, internalPatterns),
        raw: line,
      });
      sawFrame = true;
    } else if (sawFrame && line.trim() !== '') {
      current.frames.push({ internal: false, raw: line });
    } else if (!sawFrame) {
      messageLines.push(line);
    }
  }
  flush();
  const structuredCount = groups.reduce((n, g) => n + g.frames.filter((f) => f.file !== undefined).length, 0);
  return structuredCount > 0 ? groups : [];
}

function parsePython(lines: string[], internalPatterns: (string | RegExp)[]): StackGroup[] {
  const groups: { frames: StackFrame[]; trailerLines: string[] }[] = [];
  let current: { frames: StackFrame[]; trailerLines: string[] } | null = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (PYTHON_HEADER.test(line)) {
      current = { frames: [], trailerLines: [] };
      groups.push(current);
      i++;
      continue;
    }
    if (PYTHON_CHAIN_SEPARATOR.test(line)) {
      i++;
      continue;
    }
    const frameMatch = PYTHON_FRAME.exec(line);
    if (frameMatch && current) {
      const [, file, ln, fn] = frameMatch;
      const frame: StackFrame = {
        file,
        line: Number(ln),
        // safe: PYTHON_FRAME group 3 `(.+)` is required, always present on exec success
        functionName: fn!.trimEnd(),
        internal: isInternal(file, internalPatterns),
        raw: line,
      };
      current.frames.push(frame);
      i++;
      const maybeSource = lines[i];
      const isContinuation =
        maybeSource !== undefined &&
        maybeSource.trim() !== '' &&
        !PYTHON_FRAME.test(maybeSource) &&
        !PYTHON_HEADER.test(maybeSource) &&
        !PYTHON_CHAIN_SEPARATOR.test(maybeSource) &&
        !PYTHON_EXC_TRAILER.test(maybeSource);
      if (isContinuation) {
        frame.raw += `\n${maybeSource}`;
        i++;
      }
      continue;
    }
    if (current) current.trailerLines.push(line);
    i++;
  }
  return groups
    .filter((g) => g.frames.length > 0 || g.trailerLines.some((l) => l.trim() !== ''))
    .map((g) => ({
      message: g.trailerLines.join('\n').trim(),
      frames: [...g.frames].reverse(),
    }));
}

/**
 * Parses a JS/TS (V8, Firefox/Safari) or Python stack trace into message+frame groups,
 * innermost-frame-first, splitting chained/caused-by errors into separate groups. Returns `[]`
 * when nothing parseable is found so the caller can fall back to verbatim raw rendering.
 */
export function parseStackTrace(trace: string, internalPatterns: (string | RegExp)[]): StackGroup[] {
  const lines = trace.split(/\r\n|\r|\n/);
  const isPython = lines.some((line) => PYTHON_HEADER.test(line) || PYTHON_FRAME.test(line));
  return isPython ? parsePython(lines, internalPatterns) : parseJs(lines, internalPatterns);
}
