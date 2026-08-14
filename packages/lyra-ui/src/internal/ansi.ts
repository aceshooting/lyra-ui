/**
 * Dependency-free ANSI/SGR (`CSI … m`) parser for rendering streamed console/terminal output as
 * styled text segments — shared by any component that needs to turn raw ANSI-colored text into
 * styled segments, rather than re-implementing this per consumer. Handles only SGR color/style
 * codes; every other CSI final byte and every OSC sequence is stripped and never interpreted.
 * Cursor/line-buffer control characters (`\r`/`\b`/`\t`/`\n`) are deliberately out of scope here —
 * they are a terminal-emulation concern owned by the consuming component, not this parser.
 */

export interface AnsiStyles {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  /** A CSS color value: `var(--lr-terminal-color-*)` for the 16 named colors (including the
   *  16-named subset of 256-color mode), or a literal `rgb()` for 256-color indices 16-255 and
   *  truecolor. These colors are driven by arbitrary terminal output content, not the design-token
   *  palette, so a literal CSS color value here is intentional rather than a hardcoded default. */
  fg?: string;
  bg?: string;
}

export interface AnsiSegment {
  text: string;
  styles: AnsiStyles;
}

export interface AnsiParser {
  /** Feeds `chunk` through the parser, returning the styled text segments it produced. A partial
   *  escape sequence at the end of `chunk` is buffered internally and completed by a later `push()`
   *  call rather than emitted as literal text. An unterminated sequence longer than the bounded
   *  carry ceiling is dropped so later output resumes from a clean parser boundary. */
  push(chunk: string): AnsiSegment[];
  /** Clears style state and any buffered partial sequence — call alongside a full scrollback reset. */
  reset(): void;
}

const RESET_STYLES: AnsiStyles = {
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  inverse: false,
};

const ANSI_16_VAR_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'bright-black',
  'bright-red',
  'bright-green',
  'bright-yellow',
  'bright-blue',
  'bright-magenta',
  'bright-cyan',
  'bright-white',
] as const;

function ansiVar(index: number): string {
  return `var(--lr-terminal-color-${ANSI_16_VAR_NAMES[index]})`;
}

/** SGR 40-47/100-107 read a SEPARATE token set from SGR 30-37/90-97. The two roles are solved
 *  against opposite references — foregrounds against the terminal panel, backgrounds against the
 *  default text that lands on them — because one set cannot satisfy both: once the foregrounds were
 *  solved to be legible on a light panel they were all dark, and `ESC[41m` painted a near-black red
 *  behind near-black default text. See scripts/generate-terminal-palette.mjs. */
function ansiBgVar(index: number): string {
  return `var(--lr-terminal-bg-${ANSI_16_VAR_NAMES[index]})`;
}

const FG_VARS: Record<number, string> = {};
const BG_VARS: Record<number, string> = {};
for (let i = 0; i < 8; i++) {
  FG_VARS[30 + i] = ansiVar(i);
  FG_VARS[90 + i] = ansiVar(8 + i);
  BG_VARS[40 + i] = ansiBgVar(i);
  BG_VARS[100 + i] = ansiBgVar(8 + i);
}

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(255, Math.max(0, Math.round(n)));
}

/** xterm 256-color palette: 0-15 resolve to the same 16 named/retheme-able vars as the base SGR
 *  codes (so an extended-color sequence picking "red" still retheme with the palette) — through the
 *  ROLE-matching set, so `ESC[48;5;1m` gets the background red rather than the foreground one;
 *  16-231 are the 6x6x6 color cube; 232-255 are the grayscale ramp. */
function ansi256ToColor(n: number, role: 'fg' | 'bg' = 'fg'): string {
  const named = role === 'bg' ? ansiBgVar : ansiVar;
  if (!Number.isInteger(n) || n < 0) return named(0);
  if (n < 16) return named(n);
  if (n <= 231) {
    const i = n - 16;
    const r = CUBE_LEVELS[Math.floor(i / 36) % 6];
    const g = CUBE_LEVELS[Math.floor(i / 6) % 6];
    const b = CUBE_LEVELS[i % 6];
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (n <= 255) {
    const v = 8 + (n - 232) * 10;
    return `rgb(${v}, ${v}, ${v})`;
  }
  return named(0);
}

const CSI_FINAL_BYTE = /[\x40-\x7e]/;
/** ANSI control sequences are small; this generous ceiling prevents a truncated OSC/CSI from
 * retaining and repeatedly rescanning an unbounded streamed suffix, and prevents a terminated
 * sequence from allocating or interpreting an unbounded payload. */
export const MAX_ANSI_SEQUENCE_LENGTH = 4_096;
/** SGR needs at most five adjacent parameters for one supported extended-color operation. A
 * generous total ceiling keeps parsing work and retained arrays constant without narrowing real
 * terminal styling. Sequences above the ceiling are ignored atomically. */
const MAX_SGR_PARAMETERS = 64;

function parseSgrParameters(input: string, start: number, end: number): number[] | null {
  if (start === end) return [0];

  const params: number[] = [];
  let value = 0;
  let hasTokenContent = false;
  let valid = true;

  for (let index = start; index <= end; index++) {
    const code = index === end ? 0x3b : input.charCodeAt(index);
    if (code >= 0x30 && code <= 0x39) {
      hasTokenContent = true;
      const digit = code - 0x30;
      if (valid && value <= Math.floor((Number.MAX_SAFE_INTEGER - digit) / 10)) value = value * 10 + digit;
      else valid = false;
      continue;
    }

    if (code !== 0x3b) {
      hasTokenContent = true;
      valid = false;
      continue;
    }

    if (params.length >= MAX_SGR_PARAMETERS) return null;
    params.push(hasTokenContent ? (valid ? value : Number.NaN) : 0);
    value = 0;
    hasTokenContent = false;
    valid = true;
  }

  return params;
}

export function createAnsiParser(): AnsiParser {
  let styles: AnsiStyles = { ...RESET_STYLES };
  /** A partial escape sequence (starting at its ESC byte) left over from a previous `push()` whose
   *  terminator hadn't arrived yet. */
  let carry = '';
  /** Once an incomplete sequence crosses the carry ceiling, retain only its grammar state and
   *  discard through its terminator. A fresh ESC resynchronizes parsing so a later independent
   *  sequence is not swallowed when the hostile sequence never terminates. */
  let discarding: 'csi' | 'osc' | null = null;

  function applySgr(params: number[]): void {
    const list = params.length === 0 ? [0] : params;
    let i = 0;
    while (i < list.length) {
      const p = list[i]!; // safe: i < list.length (loop condition)
      if (p === 0) styles = { ...RESET_STYLES };
      else if (p === 1) styles = { ...styles, bold: true };
      else if (p === 2) styles = { ...styles, dim: true };
      else if (p === 3) styles = { ...styles, italic: true };
      else if (p === 4) styles = { ...styles, underline: true };
      else if (p === 7) styles = { ...styles, inverse: true };
      else if (p === 22) styles = { ...styles, bold: false, dim: false };
      else if (p === 23) styles = { ...styles, italic: false };
      else if (p === 24) styles = { ...styles, underline: false };
      else if (p === 27) styles = { ...styles, inverse: false };
      else if (p === 39) styles = { ...styles, fg: undefined };
      else if (p === 49) styles = { ...styles, bg: undefined };
      else if (FG_VARS[p] !== undefined) styles = { ...styles, fg: FG_VARS[p] };
      else if (BG_VARS[p] !== undefined) styles = { ...styles, bg: BG_VARS[p] };
      else if (p === 38 || p === 48) {
        const isFg = p === 38;
        const mode = list[i + 1];
        const idx = list[i + 2];
        if (mode === 5 && idx !== undefined) {
          const color = ansi256ToColor(idx, isFg ? 'fg' : 'bg');
          styles = isFg ? { ...styles, fg: color } : { ...styles, bg: color };
          i += 2;
        } else if (mode === 2) {
          const r = list[i + 2];
          const g = list[i + 3];
          const b = list[i + 4];
          if (r !== undefined && g !== undefined && b !== undefined) {
            const color = `rgb(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)})`;
            styles = isFg ? { ...styles, fg: color } : { ...styles, bg: color };
            i += 4;
          }
        }
        // An unrecognized extended-color mode (anything other than 5 or 2) is left unapplied and
        // simply falls through to the next param, same as any other unrecognized SGR code below.
      }
      // Any other numeric param (e.g. blink, unsupported codes) has no mapped style and is skipped.
      i++;
    }
  }

  function push(chunk: string): AnsiSegment[] {
    const input = carry + chunk;
    carry = '';
    const segments: AnsiSegment[] = [];
    let textStart = 0;
    let i = 0;

    if (discarding !== null) {
      while (i < input.length) {
        const code = input.charCodeAt(i);
        if (discarding === 'csi' && code >= 0x40 && code <= 0x7e) {
          discarding = null;
          i++;
          break;
        }
        if (discarding === 'osc' && code === 0x07) {
          discarding = null;
          i++;
          break;
        }
        if (code === 0x1b) {
          if (discarding === 'osc' && input[i + 1] === '\\') {
            discarding = null;
            i += 2;
            break;
          }
          // A fresh escape starts a new independently parseable boundary. This also lets a bare
          // trailing ESC become the normal one-byte carry rather than retaining hostile content.
          discarding = null;
          break;
        }
        i++;
      }
      if (discarding !== null) return segments;
      textStart = i;
    }

    while (i < input.length) {
      if (input.charCodeAt(i) !== 0x1b) {
        i++;
        continue;
      }
      if (i > textStart) segments.push({ text: input.slice(textStart, i), styles });

      const next = input[i + 1];
      if (next === undefined) {
        // ESC is the last byte of this chunk -- whether a '[' or ']' follows isn't knowable
        // until the next push(), so buffer it rather than dropping it as an unrecognized
        // sequence (matches the incomplete-CSI/OSC buffering below).
        carry = input.slice(i);
        return segments;
      }
      if (next === '[') {
        let j = i + 2;
        let overlong = false;
        // safe: input[j] is read only while j < input.length (same && condition)
        while (j < input.length && !CSI_FINAL_BYTE.test(input[j]!)) {
          j++;
          if (j - i + 1 > MAX_ANSI_SEQUENCE_LENGTH) overlong = true;
        }
        if (j >= input.length) {
          if (overlong || input.length - i > MAX_ANSI_SEQUENCE_LENGTH) discarding = 'csi';
          else carry = input.slice(i);
          return segments;
        }
        overlong ||= j - i + 1 > MAX_ANSI_SEQUENCE_LENGTH;
        if (!overlong && input[j] === 'm') {
          const params = parseSgrParameters(input, i + 2, j);
          if (params !== null) applySgr(params);
        }
        // Any other CSI final byte (cursor move, erase, scroll, ...) is stripped without being
        // interpreted -- the consuming component owns cursor/line-buffer control on its own.
        i = j + 1;
        textStart = i;
        continue;
      }

      if (next === ']') {
        let j = i + 2;
        let terminated = false;
        let overlong = false;
        while (j < input.length) {
          if (input.charCodeAt(j) === 0x07) {
            j++;
            terminated = true;
            break;
          }
          if (input.charCodeAt(j) === 0x1b && input[j + 1] === '\\') {
            j += 2;
            terminated = true;
            break;
          }
          j++;
          if (j - i > MAX_ANSI_SEQUENCE_LENGTH) overlong = true;
        }
        if (!terminated) {
          if (overlong || input.length - i > MAX_ANSI_SEQUENCE_LENGTH) discarding = 'osc';
          else carry = input.slice(i);
          return segments;
        }
        i = j;
        textStart = i;
        continue;
      }

      // An ESC not followed by '[' or ']' isn't a sequence this parser recognizes -- drop just the
      // ESC byte and resume scanning plain text right after it.
      i += 1;
      textStart = i;
    }

    if (textStart < input.length) segments.push({ text: input.slice(textStart), styles });
    return segments;
  }

  function reset(): void {
    styles = { ...RESET_STYLES };
    carry = '';
    discarding = null;
  }

  return { push, reset };
}
