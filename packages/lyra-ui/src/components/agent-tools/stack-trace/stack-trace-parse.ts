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
export const DEFAULT_INTERNAL_PATTERNS: readonly (string | RegExp)[] = Object.freeze([
  'node_modules/',
  'node:internal',
  '(native)',
  'site-packages/',
  'dist-packages/',
  '/usr/lib/python',
]);

/** Hard ceilings applied before parsing or rendering untrusted trace text. */
export const STACK_TRACE_LIMITS = Object.freeze({
  bytes: 256 * 1024,
  lines: 4_000,
  groups: 64,
  frames: 2_000,
  lineCharacters: 8_192,
});

export interface StackTraceParseOptions {
  /** File-path substrings or patterns classified as framework/runtime frames. */
  internalPatterns?: readonly (string | RegExp)[];
}

export interface StackTraceParseResult {
  groups: StackGroup[];
  /** True when any byte, line, group, frame, or per-line ceiling omitted input. */
  truncated: boolean;
  /** The bounded source projection suitable for the raw-rendering fallback. */
  source: string;
}

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
const JS_CAUSE = /^\s*(?:Caused by:|\[cause\]:)(.*)$/;

const PYTHON_HEADER = /^Traceback \(most recent call last\):\s*$/;
// File-path capture excludes `"` (its own delimiter) so the boundary is unambiguous instead of
// backtracking across every `"` in the line; the trailing function-name is trimmed in code below
// rather than via a lazy `(.+?)\s*$`, which was the other polynomial-time spot CodeQL flagged.
const PYTHON_FRAME = /^\s*File '([^']+)', line ([^,]*), in (.+)$/;
// Keep language detection strict. PYTHON_FRAME intentionally recognizes malformed coordinate
// candidates after a traceback has already been identified, but prose resembling such a line must
// not make a JavaScript trace skip its valid V8/Firefox frames.
const PYTHON_CHAIN_SEPARATOR = /direct cause|During handling/;
// Equivalent to the original `\S+(\.\S+)*:\s` -- `\S` already matches `.`, so the `(\.\S+)*`
// group added no coverage, only exponential backtracking (CodeQL js/redos) on input like many
// repetitions of '!.'.
const PYTHON_EXC_TRAILER = /^\s*\S+:\s/;

interface V8FrameWithFn {
  fn: string;
  file: string;
  line: string;
  col: string;
}

interface V8BareFrame {
  file: string;
  line: string;
  col: string;
}

interface FirefoxFrame extends V8BareFrame {
  fn?: string;
}

interface StackLocation {
  line: number;
  column?: number;
}

/** Parses a trace coordinate without silently rounding, overflowing, or accepting a partial
 *  numeric token. Source locations are navigation targets, so an unsafe token becomes raw trace
 *  text rather than a fabricated location that an application could try to open. */
function parseSafeLocation(lineToken: string, columnToken?: string): StackLocation | null {
  const line = DIGITS_RE.test(lineToken) ? Number(lineToken) : Number.NaN;
  if (!Number.isSafeInteger(line)) return null;
  if (columnToken === undefined) return { line };
  const column = DIGITS_RE.test(columnToken) ? Number(columnToken) : Number.NaN;
  return Number.isSafeInteger(column) ? { line, column } : null;
}

/** Matches a V8 'at <fn> (<file>:<line>:<col>)" frame without regex backtracking: the location's
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
  if (!file) return null;
  return { fn, file, line: lineStr, col };
}

/** Parses `at /file:line:column` by splitting the final two colons, which keeps URLs and Windows
 *  paths intact while leaving coordinate validation to parseSafeLocation(). */
function matchV8BareFrame(line: string): V8BareFrame | null {
  const prefixMatch = V8_FRAME_PREFIX.exec(line);
  if (!prefixMatch) return null;
  const rest = line.slice(prefixMatch[0].length).trimEnd();
  const lastColon = rest.lastIndexOf(':');
  const secondLastColon = lastColon === -1 ? -1 : rest.lastIndexOf(':', lastColon - 1);
  if (secondLastColon === -1) return null;
  const file = rest.slice(0, secondLastColon);
  if (!file) return null;
  return {
    file,
    line: rest.slice(secondLastColon + 1, lastColon),
    col: rest.slice(lastColon + 1),
  };
}

/** Parses Firefox/Safari's `fn@file:line:column` layout without imposing a numeric conversion
 *  before the location helper has validated the exact tokens. */
function matchFirefoxFrame(line: string): FirefoxFrame | null {
  const at = line.indexOf('@');
  if (at === -1) return null;
  const fn = line.slice(0, at);
  if (/\s/.test(fn)) return null;
  const rest = line.slice(at + 1);
  const lastColon = rest.lastIndexOf(':');
  const secondLastColon = lastColon === -1 ? -1 : rest.lastIndexOf(':', lastColon - 1);
  if (secondLastColon === -1) return null;
  const file = rest.slice(0, secondLastColon);
  if (!file) return null;
  return {
    ...(fn ? { fn } : {}),
    file,
    line: rest.slice(secondLastColon + 1, lastColon),
    col: rest.slice(lastColon + 1),
  };
}

function isInternal(file: string | undefined, patterns: readonly (string | RegExp)[]): boolean {
  if (!file) return false;
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') return file.includes(pattern);
    // Test a clone without the stateful flags. Besides keeping classification deterministic, this
    // preserves the caller's lastIndex even when RegExp.prototype.test throws.
    return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')).test(file);
  });
}

/** Produces a selectable frame only when every supplied coordinate is a finite safe integer.
 *  Invalid and overflowing locations deliberately retain only their original raw text: showing a
 *  guessed file/function would invite a consumer to treat the row as a valid navigation target. */
function makeFrame(
  raw: string,
  file: string,
  lineToken: string,
  columnToken: string | undefined,
  functionName: string | undefined,
  internalPatterns: readonly (string | RegExp)[],
): StackFrame {
  const location = parseSafeLocation(lineToken, columnToken);
  if (!location) return { internal: false, raw };
  return {
    ...(functionName ? { functionName } : {}),
    file,
    ...location,
    internal: isInternal(file, internalPatterns),
    raw,
  };
}

function parseJs(lines: string[], internalPatterns: readonly (string | RegExp)[]): StackGroup[] {
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
    const bare = !withFn ? matchV8BareFrame(line) : null;
    const firefox = !withFn && !bare ? matchFirefoxFrame(line) : null;
    if (withFn) {
      const { fn, file, line: ln, col } = withFn;
      const frame = makeFrame(line, file, ln, col, fn, internalPatterns);
      current.frames.push(frame);
      sawFrame ||= frame.file !== undefined;
    } else if (bare) {
      const frame = makeFrame(line, bare.file, bare.line, bare.col, undefined, internalPatterns);
      current.frames.push(frame);
      sawFrame ||= frame.file !== undefined;
    } else if (firefox) {
      const frame = makeFrame(line, firefox.file, firefox.line, firefox.col, firefox.fn, internalPatterns);
      current.frames.push(frame);
      sawFrame ||= frame.file !== undefined;
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

function parsePython(lines: string[], internalPatterns: readonly (string | RegExp)[]): StackGroup[] {
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
      // PYTHON_FRAME's function group is required on a structural match. Coordinate safety stays
      // centralized in makeFrame(), which returns a raw frame when the line token is malformed.
      const frame = makeFrame(line, file!, ln!, undefined, fn!.trimEnd(), internalPatterns);
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
  const parsedGroups = groups
    .filter((g) => g.frames.length > 0 || g.trailerLines.some((l) => l.trim() !== ''))
    .map((g) => ({
      message: g.trailerLines.join('\n').trim(),
      frames: [...g.frames].reverse(),
    }));
  const structuredCount = parsedGroups.reduce((n, group) => n + group.frames.filter((frame) => frame.file !== undefined).length, 0);
  return structuredCount > 0 ? parsedGroups : [];
}

function utf8Prefix(value: string, byteLimit: number): { source: string; truncated: boolean } {
  let bytes = 0;
  let index = 0;
  while (index < value.length) {
    const first = value.charCodeAt(index);
    let width = first < 0x80 ? 1 : first < 0x800 ? 2 : 3;
    let units = 1;
    if (first >= 0xd800 && first <= 0xdbff && index + 1 < value.length) {
      const second = value.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        width = 4;
        units = 2;
      }
    }
    if (bytes + width > byteLimit) break;
    bytes += width;
    index += units;
  }
  return { source: value.slice(0, index), truncated: index < value.length };
}

function boundedLines(trace: string): { source: string; lines: string[]; truncated: boolean } {
  const byteBound = utf8Prefix(trace, STACK_TRACE_LIMITS.bytes);
  const split = byteBound.source.split(/\r\n|\r|\n/, STACK_TRACE_LIMITS.lines + 1);
  let truncated = byteBound.truncated || split.length > STACK_TRACE_LIMITS.lines;
  const lines = split.slice(0, STACK_TRACE_LIMITS.lines).map((line) => {
    if (line.length <= STACK_TRACE_LIMITS.lineCharacters) return line;
    truncated = true;
    return line.slice(0, STACK_TRACE_LIMITS.lineCharacters);
  });
  return { source: lines.join('\n'), lines, truncated };
}

function boundedGroups(groups: StackGroup[]): { groups: StackGroup[]; truncated: boolean } {
  let remainingFrames = STACK_TRACE_LIMITS.frames;
  let truncated = groups.length > STACK_TRACE_LIMITS.groups;
  const bounded: StackGroup[] = [];
  for (const group of groups.slice(0, STACK_TRACE_LIMITS.groups)) {
    const frames = group.frames.slice(0, remainingFrames);
    if (frames.length < group.frames.length) truncated = true;
    bounded.push({ message: group.message, frames });
    remainingFrames -= frames.length;
    if (remainingFrames === 0) {
      if (bounded.length < groups.length) truncated = true;
      break;
    }
  }
  return { groups: bounded, truncated };
}

/**
 * Purely parses a bounded JS/TS (V8, Firefox/Safari) or Python stack trace into
 * innermost-frame-first groups. Python mode requires an actual traceback header; a Python-looking
 * prose line inside a JavaScript trace cannot discard valid JS frames. The returned `source` is
 * the bounded text projection to use when `groups` is empty.
 */
export function parseStackTrace(trace: string, options: StackTraceParseOptions = {}): StackTraceParseResult {
  const bounded = boundedLines(trace);
  // A standalone Python-looking frame is not a traceback. Requiring the header also makes mixed
  // provider logs deterministic instead of choosing Python based on one incidental line.
  const isPython = bounded.lines.some((line) => PYTHON_HEADER.test(line));
  const parsed = isPython
    ? parsePython(bounded.lines, options.internalPatterns ?? DEFAULT_INTERNAL_PATTERNS)
    : parseJs(bounded.lines, options.internalPatterns ?? DEFAULT_INTERNAL_PATTERNS);
  const limited = boundedGroups(parsed);
  return {
    groups: limited.groups,
    truncated: bounded.truncated || limited.truncated,
    source: bounded.source,
  };
}
