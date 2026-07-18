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
   *  call rather than emitted as literal text. */
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

const FG_VARS: Record<number, string> = {};
const BG_VARS: Record<number, string> = {};
for (let i = 0; i < 8; i++) {
  FG_VARS[30 + i] = ansiVar(i);
  FG_VARS[90 + i] = ansiVar(8 + i);
  BG_VARS[40 + i] = ansiVar(i);
  BG_VARS[100 + i] = ansiVar(8 + i);
}

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(255, Math.max(0, Math.round(n)));
}

/** xterm 256-color palette: 0-15 resolve to the same 16 named/retheme-able vars as the base SGR
 *  codes (so an extended-color sequence picking "red" still retheme with the palette); 16-231 are
 *  the 6x6x6 color cube; 232-255 are the grayscale ramp. */
function ansi256ToColor(n: number): string {
  if (!Number.isInteger(n) || n < 0) return ansiVar(0);
  if (n < 16) return ansiVar(n);
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
  return ansiVar(0);
}

const CSI_FINAL_BYTE = /[\x40-\x7e]/;

export function createAnsiParser(): AnsiParser {
  let styles: AnsiStyles = { ...RESET_STYLES };
  /** A partial escape sequence (starting at its ESC byte) left over from a previous `push()` whose
   *  terminator hadn't arrived yet. */
  let carry = '';

  function applySgr(params: number[]): void {
    const list = params.length === 0 ? [0] : params;
    let i = 0;
    while (i < list.length) {
      const p = list[i];
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
        if (mode === 5 && list[i + 2] !== undefined) {
          const color = ansi256ToColor(list[i + 2]);
          styles = isFg ? { ...styles, fg: color } : { ...styles, bg: color };
          i += 2;
        } else if (mode === 2 && list[i + 4] !== undefined) {
          const color = `rgb(${clampByte(list[i + 2])}, ${clampByte(list[i + 3])}, ${clampByte(list[i + 4])})`;
          styles = isFg ? { ...styles, fg: color } : { ...styles, bg: color };
          i += 4;
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
        while (j < input.length && !CSI_FINAL_BYTE.test(input[j])) j++;
        if (j >= input.length) {
          carry = input.slice(i);
          return segments;
        }
        if (input[j] === 'm') {
          const paramText = input.slice(i + 2, j);
          const params = paramText === '' ? [0] : paramText.split(';').map((s) => (s === '' ? 0 : Number(s)));
          applySgr(params);
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
        }
        if (!terminated) {
          carry = input.slice(i);
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
  }

  return { push, reset };
}
