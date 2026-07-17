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

const V8_FRAME_WITH_FN = /^\s*at\s+(?:async\s+)?(?:new\s+)?(.+?)\s+\((.+):(\d+):(\d+)\)\s*$/;
const V8_FRAME_BARE = /^\s*at\s+(?:async\s+)?(.+):(\d+):(\d+)\s*$/;
const FIREFOX_FRAME = /^([^\s@]*)@(.+):(\d+):(\d+)$/;
const JS_CAUSE = /^\s*(?:Caused by:|\[cause\]:)\s*(.*)$/;

const PYTHON_HEADER = /^Traceback \(most recent call last\):\s*$/;
const PYTHON_FRAME = /^\s*File "(.+)", line (\d+), in (.+?)\s*$/;
const PYTHON_CHAIN_SEPARATOR = /direct cause|During handling/;
const PYTHON_EXC_TRAILER = /^\s*\S+(\.\S+)*:\s/;

function isInternal(file: string | undefined, patterns: (string | RegExp)[]): boolean {
  if (!file) return false;
  return patterns.some((pattern) => (typeof pattern === 'string' ? file.includes(pattern) : pattern.test(file)));
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
    const withFn = V8_FRAME_WITH_FN.exec(line);
    const bare = !withFn ? V8_FRAME_BARE.exec(line) : null;
    const firefox = !withFn && !bare ? FIREFOX_FRAME.exec(line) : null;
    if (withFn) {
      const [, fn, file, ln, col] = withFn;
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
        functionName: fn,
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
