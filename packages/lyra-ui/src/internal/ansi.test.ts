import { expect } from '@open-wc/testing';
import { createAnsiParser, type AnsiSegment } from './ansi.js';

function flat(segments: AnsiSegment[]): { text: string; fg?: string; bg?: string; bold?: boolean }[] {
  return segments.map((s) => ({
    text: s.text,
    fg: s.styles.fg,
    bg: s.styles.bg,
    bold: s.styles.bold,
  }));
}

describe('createAnsiParser', () => {
  it('keeps supported erase-in-line controls ordered across split CSI chunks', () => {
    const parser = createAnsiParser();
    expect(parser.push('before\x1b[').map((segment) => segment.text)).to.deep.equal(['before']);
    const segments = parser.push('Kafter\x1b[1Kmiddle\x1b[2Kend\x1b[3Kkept');
    expect(segments.map(({ text, eraseLine }) => ({ text, eraseLine }))).to.deep.equal([
      { text: '', eraseLine: 0 },
      { text: 'after', eraseLine: undefined },
      { text: '', eraseLine: 1 },
      { text: 'middle', eraseLine: undefined },
      { text: '', eraseLine: 2 },
      { text: 'end', eraseLine: undefined },
      { text: 'kept', eraseLine: undefined },
    ]);
    expect(parser.push('\x1b[?2K\x1b[1;2K\x1b[999999999999999999999Ksafe')
      .map((segment) => segment.text).join('')).to.equal('safe');
  });

  it('passes plain text through unchanged with default (unstyled) styles', () => {
    const parser = createAnsiParser();
    const segments = parser.push('hello world');
    expect(segments).to.have.lengthOf(1);
    expect(segments[0]!.text).to.equal('hello world');
    expect(segments[0]!.styles).to.deep.equal({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
  });

  it('applies bold (SGR 1) to subsequent text and resets on SGR 0', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[1mBOLD\x1b[0mplain');
    expect(flat(segments)).to.deep.equal([
      { text: 'BOLD', fg: undefined, bg: undefined, bold: true },
      { text: 'plain', fg: undefined, bg: undefined, bold: false },
    ]);
  });

  it('maps a named foreground color (SGR 31 = red) to the red terminal color var', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[31mred text');
    expect(segments[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
  });

  it('maps a bright background color (SGR 104 = bright blue bg)', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[104mtext');
    // Background codes read the SEPARATE background set: it is solved against the panel's default
    // text rather than against the panel, because one set cannot be legible in both roles.
    expect(segments[0]!.styles.bg).to.equal('var(--lr-terminal-bg-bright-blue)');
  });

  it('resolves 256-color (38;5;n) to the named var for n < 16 and rgb() for n >= 16', () => {
    const parser = createAnsiParser();
    const low = parser.push('\x1b[38;5;1mlow');
    expect(low[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
    const cube = createAnsiParser().push('\x1b[38;5;196mcube');
    expect(cube[0]!.styles.fg).to.equal('rgb(255, 0, 0)');
    const gray = createAnsiParser().push('\x1b[38;5;244mgray');
    expect(gray[0]!.styles.fg).to.match(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it('resolves truecolor (38;2;r;g;b) to a literal rgb()', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[38;2;10;20;30mtruecolor');
    expect(segments[0]!.styles.fg).to.equal('rgb(10, 20, 30)');
  });

  it('applies multiple SGR params in one sequence (1;31)', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[1;31mboldred');
    expect(segments[0]!.styles.bold).to.be.true;
    expect(segments[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
  });

  it('ignores an unknown SGR param without throwing or altering other state', () => {
    const parser = createAnsiParser();
    expect(() => parser.push('\x1b[5mblink-not-supported')).to.not.throw();
    const segments = createAnsiParser().push('\x1b[5;31mtext');
    expect(segments[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
  });

  it('strips a non-SGR CSI sequence (cursor move) without emitting it as text', () => {
    const parser = createAnsiParser();
    const segments = parser.push('before\x1b[2Aafter');
    expect(segments.map((s) => s.text).join('')).to.equal('beforeafter');
  });

  it('strips an OSC sequence terminated by BEL', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b]0;window title\x07visible');
    expect(segments.map((s) => s.text).join('')).to.equal('visible');
  });

  it('strips an OSC sequence terminated by ST (ESC \\\\)', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b]0;title\x1b\\visible');
    expect(segments.map((s) => s.text).join('')).to.equal('visible');
  });

  it('buffers a CSI sequence split across two push() calls', () => {
    const parser = createAnsiParser();
    const first = parser.push('plain\x1b[3');
    expect(first.map((s) => s.text).join('')).to.equal('plain');
    const second = parser.push('1mred');
    expect(second[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
    expect(second[0]!.text).to.equal('red');
  });

  it('buffers a bare trailing ESC split from the rest of its sequence across two push() calls', () => {
    const parser = createAnsiParser();
    const first = parser.push('text\x1b');
    expect(first.map((s) => s.text).join('')).to.equal('text');
    const second = parser.push('[31mfoo');
    expect(second).to.have.length(1);
    expect(second[0]!.text).to.equal('foo');
    expect(second[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
  });

  it('buffers an OSC sequence split across two push() calls', () => {
    const parser = createAnsiParser();
    const first = parser.push('start\x1b]0;ti');
    expect(first.map((s) => s.text).join('')).to.equal('start');
    const second = parser.push('tle\x07end');
    expect(second.map((s) => s.text).join('')).to.equal('end');
  });

  it('drops an overlong unterminated OSC carry and parses the next chunk from a clean boundary', () => {
    const parser = createAnsiParser();
    expect(parser.push(`\x1b]0;${'x'.repeat(5_000)}`)).to.deep.equal([]);
    const recovered = parser.push('\x1b[31mvisible');
    expect(recovered.map((segment) => segment.text).join('')).to.equal('visible');
    expect(recovered[0]?.styles.fg).to.equal('var(--lr-terminal-color-red)');
  });

  it('drops an overlong unterminated CSI carry and parses the next chunk from a clean boundary', () => {
    const parser = createAnsiParser();
    expect(parser.push(`\x1b[${'1;'.repeat(2_500)}`)).to.deep.equal([]);
    const recovered = parser.push('\x1b[31mvisible');
    expect(recovered.map((segment) => segment.text).join('')).to.equal('visible');
    expect(recovered[0]?.styles.fg).to.equal('var(--lr-terminal-color-red)');
  });

  it('drops an overlong terminated SGR without materializing its parameter list', () => {
    const parser = createAnsiParser();
    const segments = parser.push(`\x1b[${'1;'.repeat(500_000)}31mvisible`);
    expect(segments.map((segment) => segment.text).join('')).to.equal('visible');
    expect(segments[0]?.styles).to.deep.equal({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
  });

  it('drops an overlong terminated OSC and resumes subsequent plain output', () => {
    const parser = createAnsiParser();
    const segments = parser.push(`\x1b]0;${'x'.repeat(500_000)}\x07visible`);
    expect(segments.map((segment) => segment.text).join('')).to.equal('visible');
  });

  it('discards an overlong CSI through a later-chunk terminator before resuming plain output', () => {
    const parser = createAnsiParser();
    expect(parser.push(`\x1b[${'1;'.repeat(2_500)}`)).to.deep.equal([]);
    const segments = parser.push('31mvisible');
    expect(segments.map((segment) => segment.text).join('')).to.equal('visible');
    expect(segments[0]?.styles.fg).to.equal(undefined);
  });

  it('discards an overlong OSC through a later-chunk terminator before resuming plain output', () => {
    const parser = createAnsiParser();
    expect(parser.push(`\x1b]0;${'x'.repeat(5_000)}`)).to.deep.equal([]);
    const segments = parser.push('tail\x07visible');
    expect(segments.map((segment) => segment.text).join('')).to.equal('visible');
  });

  it('ignores an excessive but length-bounded SGR parameter count atomically', () => {
    const parser = createAnsiParser();
    parser.push('\x1b[31m');
    const segments = parser.push(`\x1b[${'0;'.repeat(65)}1mstill red`);
    expect(segments[0]?.styles.fg).to.equal('var(--lr-terminal-color-red)');
    expect(segments[0]?.styles.bold).to.equal(false);
  });

  it('retains the complete supported SGR semantics at the bounded parameter ceiling', () => {
    const parser = createAnsiParser();
    const segments = parser.push(`\x1b[${'5;'.repeat(61)}1;4;31mstyled`);
    expect(segments[0]?.styles.bold).to.equal(true);
    expect(segments[0]?.styles.underline).to.equal(true);
    expect(segments[0]?.styles.fg).to.equal('var(--lr-terminal-color-red)');
  });

  it('reset() clears style state and any buffered partial sequence', () => {
    const parser = createAnsiParser();
    parser.push('\x1b[1;31mbold-red\x1b[3');
    parser.reset();
    const segments = parser.push('plain');
    expect(segments[0]!.styles).to.deep.equal({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
    expect(segments[0]!.text).to.equal('plain');
  });

  it('applies dim/italic/underline/inverse (SGR 2/3/4/7) and clears each with its own reset code', () => {
    const parser = createAnsiParser();
    const on = parser.push('\x1b[2;3;4;7mstyled');
    expect(on[0]!.styles).to.deep.include({
      dim: true,
      italic: true,
      underline: true,
      inverse: true,
    });
    const off = parser.push('\x1b[22;23;24;27mplain');
    expect(off[0]!.styles).to.deep.include({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
  });

  it('maps the full 30-37/40-47 and 90-97/100-107 named color ranges', () => {
    expect(createAnsiParser().push('\x1b[37mwhite')[0]!.styles.fg).to.equal(
      'var(--lr-terminal-color-white)',
    );
    expect(createAnsiParser().push('\x1b[47mwhite-bg')[0]!.styles.bg).to.equal(
      'var(--lr-terminal-bg-white)',
    );
    expect(createAnsiParser().push('\x1b[90mbright-black')[0]!.styles.fg).to.equal(
      'var(--lr-terminal-color-bright-black)',
    );
    expect(createAnsiParser().push('\x1b[107mbright-white-bg')[0]!.styles.bg).to.equal(
      'var(--lr-terminal-bg-bright-white)',
    );
  });

  it('clears fg/bg back to the default color on SGR 39/49', () => {
    const parser = createAnsiParser();
    const colored = parser.push('\x1b[31;41mtext');
    expect(colored[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
    // Same SGR name, different role, therefore a different token -- 31 and 41 no longer resolve to
    // one shared value, which is what made an explicit background unreadable.
    expect(colored[0]!.styles.bg).to.equal('var(--lr-terminal-bg-red)');
    const cleared = parser.push('\x1b[39;49mtext');
    expect(cleared[0]!.styles.fg).to.be.undefined;
    expect(cleared[0]!.styles.bg).to.be.undefined;
  });

  it('resolves 256-color background (48;5;n) the same way as foreground', () => {
    const segments = createAnsiParser().push('\x1b[48;5;196mbg');
    expect(segments[0]!.styles.bg).to.equal('rgb(255, 0, 0)');
  });

  it('resolves truecolor background (48;2;r;g;b) to a literal rgb()', () => {
    const segments = createAnsiParser().push('\x1b[48;2;1;2;3mbg');
    expect(segments[0]!.styles.bg).to.equal('rgb(1, 2, 3)');
  });

  it('treats an empty SGR parameter list as the standard reset', () => {
    const parser = createAnsiParser();
    parser.push('\x1b[1;31m');

    const segments = parser.push('\x1b[mplain');

    expect(segments[0]!.styles).to.deep.equal({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
  });

  it('contains malformed and overflowing SGR parameters without losing later valid styling', () => {
    const parser = createAnsiParser();
    const segments = parser.push(
      '\x1b[38:2;31mred\x1b[38;2;999999999999999999999999;300;20mclamped',
    );

    expect(segments[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
    expect(segments[1]!.styles.fg).to.equal('rgb(0, 255, 20)');
  });

  it('fails an out-of-range 256-color index closed to the role-matching default token', () => {
    const foreground = createAnsiParser().push('\x1b[38;5;256mtext');
    const background = createAnsiParser().push('\x1b[48;5;256mtext');

    expect(foreground[0]!.styles.fg).to.equal('var(--lr-terminal-color-black)');
    expect(background[0]!.styles.bg).to.equal('var(--lr-terminal-bg-black)');
  });

  it('fails a malformed 256-color index closed to the same role-matching default token', () => {
    const foreground = createAnsiParser().push('\x1b[38;5;1:2mtext');
    const background = createAnsiParser().push('\x1b[48;5;99999999999999999999mtext');

    expect(foreground[0]!.styles.fg).to.equal('var(--lr-terminal-color-black)');
    expect(background[0]!.styles.bg).to.equal('var(--lr-terminal-bg-black)');
    expect(createAnsiParser().push('\x1b[38;5;1mtext')[0]!.styles.fg, 'a valid index still resolves its own color').to.equal(
      'var(--lr-terminal-color-red)',
    );
  });

  it('resumes after an overlong OSC terminated by ST in a later chunk', () => {
    const parser = createAnsiParser();
    expect(parser.push(`\x1b]0;${'x'.repeat(5_000)}`)).to.deep.equal([]);

    const segments = parser.push('discarded\x1b\\visible');

    expect(segments.map((segment) => segment.text).join('')).to.equal('visible');
  });

  it('drops only an ESC that does not start a sequence and preserves the following text', () => {
    const text = (input: string) =>
      createAnsiParser().push(input).map((segment) => segment.text).join('');

    expect(text('before\x1b\u00e9after')).to.equal('before\u00e9after');
    expect(text('a\x1b\nb')).to.equal('a\nb');
    expect(text('a\x1b\x1b[31mb')).to.equal('ab');
  });

  it('strips the tput sgr0 charset reset (ESC ( B) and other three-byte nF escapes', () => {
    const segments = createAnsiParser().push('\x1b[31merror\x1b(B\x1b[m done\x1b)0\x1b%G!');

    expect(segments.map((segment) => segment.text).join('')).to.equal('error done!');
    expect(segments[0]!.styles.fg).to.equal('var(--lr-terminal-color-red)');
    expect(segments[1]!.styles.fg).to.equal(undefined);
  });

  it('strips two-byte Fp, Fe and Fs escapes such as save/restore cursor and keypad modes', () => {
    const segments = createAnsiParser().push('a\x1b7b\x1b8c\x1b=d\x1b>e\x1bcf\x1bMg\x1b\\h');

    expect(segments.map((segment) => segment.text).join('')).to.equal('abcdefgh');
  });

  it('strips DCS, SOS, PM and APC string payloads through ST or BEL', () => {
    const segments = createAnsiParser().push(
      'a\x1bPq#0;2;0;0;0#0~~\x1b\\b\x1bXsos text\x1b\\c\x1b^privacy\x07d\x1b_Ga=T,f=100;AAAA\x1b\\e',
    );

    expect(segments.map((segment) => segment.text).join('')).to.equal('abcde');
  });

  it('buffers a string payload split across push() calls and discards an overlong one', () => {
    const parser = createAnsiParser();
    expect(parser.push('a\x1b_Gpart').map((segment) => segment.text).join('')).to.equal('a');
    expect(parser.push('ial\x1b\\b').map((segment) => segment.text).join('')).to.equal('b');

    expect(parser.push(`\x1bP${'x'.repeat(5_000)}`)).to.deep.equal([]);
    expect(parser.push('still payload\x1b\\visible').map((segment) => segment.text).join('')).to.equal('visible');
  });

  it('buffers an nF escape whose final byte arrives in the next chunk', () => {
    const parser = createAnsiParser();
    expect(parser.push('x\x1b(').map((segment) => segment.text).join('')).to.equal('x');
    expect(parser.push('By').map((segment) => segment.text).join('')).to.equal('y');
  });

  it('abandons a CSI interrupted by a new escape instead of swallowing it', () => {
    const segments = createAnsiParser().push('\x1b[31\x1b[32mgreen');

    expect(segments.map((segment) => segment.text).join('')).to.equal('green');
    expect(segments[0]!.styles.fg).to.equal('var(--lr-terminal-color-green)');
  });

  it('abandons a malformed CSI at a control or non-ASCII byte without swallowing the following text', () => {
    const text = (input: string) =>
      createAnsiParser().push(input).map((segment) => segment.text).join('');

    expect(text('\x1b[31\nnext')).to.equal('\nnext');
    expect(text('\x1b[1\u00e9clair')).to.equal('\u00e9clair');
    expect(text('a\x1b[1\x18b')).to.equal('ab');
  });

  // A control string (OSC, DCS, SOS, PM, APC) is never interpreted, but it must not outlive its
  // grammar either: BEL or ST ends it, CAN or SUB aborts it, and any other ESC starts a NEW
  // escape sequence (the VT500 parser model) rather than disappearing into the payload.
  describe('control strings', () => {
    const RED = 'var(--lr-terminal-color-red)';
    const redText = [{ text: 'red', fg: RED, bg: undefined, bold: false }];
    const visibleText = (segments: AnsiSegment[]) => segments.map((segment) => segment.text).join('');
    const characters = (segments: AnsiSegment[]) =>
      segments.flatMap((segment) =>
        [...segment.text].map((character) => `${character}|${segment.styles.fg ?? ''}|${segment.styles.bold}`),
      );
    const openers = [
      { kind: 'OSC', opener: '\x1b]0;title' },
      { kind: 'DCS', opener: '\x1bPq#0;2;0;0;0' },
      { kind: 'SOS', opener: '\x1bXsos text' },
      { kind: 'PM', opener: '\x1b^privacy' },
      { kind: 'APC', opener: '\x1b_Ga=T,f=100;AAAA' },
    ];

    it('renders the output after an unterminated OSC that the next chunk interrupts', () => {
      const parser = createAnsiParser();
      expect(parser.push('\x1b]0;t')).to.deep.equal([]);
      expect(visibleText(parser.push('\x1b[0mafter'))).to.equal('after');
    });

    it('consumes ST (ESC \\) as the terminator and renders the text and styling after it', () => {
      const segments = createAnsiParser().push('before\x1b]0;t\x1b\\\x1b[31mred');

      expect(flat(segments)).to.deep.equal([
        { text: 'before', fg: undefined, bg: undefined, bold: false },
        ...redText,
      ]);
    });

    it('parses ESC [ after an unterminated OSC as a CSI instead of swallowing it', () => {
      expect(flat(createAnsiParser().push('\x1b]0;t\x1b[31mred'))).to.deep.equal(redText);

      const parser = createAnsiParser();
      parser.push('\x1b]0;t');
      expect(flat(parser.push('\x1b[31mred'))).to.deep.equal(redText);
    });

    it('ends an OSC at BEL, including a BEL that arrives in a later chunk', () => {
      expect(visibleText(createAnsiParser().push('\x1b]0;t\x07after'))).to.equal('after');

      const parser = createAnsiParser();
      expect(parser.push('\x1b]0;t')).to.deep.equal([]);
      expect(visibleText(parser.push('\x07after'))).to.equal('after');
    });

    it('aborts an unterminated OSC at CAN without rendering it', () => {
      expect(visibleText(createAnsiParser().push('\x1b]0;t\x18after'))).to.equal('after');

      const parser = createAnsiParser();
      parser.push('\x1b]0;t');
      expect(visibleText(parser.push('\x18after'))).to.equal('after');
    });

    it('aborts an unterminated OSC at SUB without rendering it', () => {
      expect(visibleText(createAnsiParser().push('\x1b]0;t\x1aafter'))).to.equal('after');

      const parser = createAnsiParser();
      parser.push('\x1b]0;t');
      expect(visibleText(parser.push('\x1aafter'))).to.equal('after');
    });

    it('treats an ESC ending one chunk and a backslash starting the next as ST', () => {
      const parser = createAnsiParser();
      expect(visibleText(parser.push('a\x1b]0;t\x1b'))).to.equal('a');
      expect(visibleText(parser.push('\\b'))).to.equal('b');
    });

    it('starts a CSI when the ESC ending one chunk is followed by [ in the next', () => {
      const parser = createAnsiParser();
      expect(parser.push('\x1b]0;t\x1b')).to.deep.equal([]);
      expect(flat(parser.push('[31mred'))).to.deep.equal(redText);
    });

    it('resolves an ESC that ends a chunk the same way once the string is past the carry ceiling', () => {
      const overlong = `\x1b]0;${'x'.repeat(5_000)}`;
      // The ESC ends either the chunk that crosses the ceiling or a later chunk of the discarded string.
      const ways: string[][] = [[`${overlong}\x1b`], [overlong, 'more payload\x1b']];

      for (const chunks of ways) {
        const st = createAnsiParser();
        for (const chunk of chunks) expect(st.push(chunk)).to.deep.equal([]);
        expect(visibleText(st.push('\\after'))).to.equal('after');

        const csi = createAnsiParser();
        for (const chunk of chunks) expect(csi.push(chunk)).to.deep.equal([]);
        expect(flat(csi.push('[31mred'))).to.deep.equal(redText);
      }
    });

    it('starts a new string when the ESC ending one chunk is followed by ] in the next', () => {
      const parser = createAnsiParser();
      expect(parser.push('\x1b]0;a\x1b')).to.deep.equal([]);
      expect(parser.push(']0;b')).to.deep.equal([]);
      expect(visibleText(parser.push('\x07after'))).to.equal('after');
    });

    for (const { kind, opener } of openers) {
      it(`does not let an unterminated ${kind} swallow a following escape sequence`, () => {
        expect(flat(createAnsiParser().push(`${opener}\x1b[31mred`))).to.deep.equal(redText);

        const parser = createAnsiParser();
        expect(parser.push(opener)).to.deep.equal([]);
        expect(flat(parser.push('\x1b[31mred'))).to.deep.equal(redText);
      });

      it(`aborts an unterminated ${kind} at CAN or SUB`, () => {
        expect(visibleText(createAnsiParser().push(`${opener}\x18after`))).to.equal('after');
        expect(visibleText(createAnsiParser().push(`${opener}\x1aafter`))).to.equal('after');

        const parser = createAnsiParser();
        parser.push(opener);
        expect(visibleText(parser.push('\x18after'))).to.equal('after');
      });
    }

    it('ends a discarded overlong string at CAN or SUB', () => {
      for (const cancel of ['\x18', '\x1a']) {
        const parser = createAnsiParser();
        expect(parser.push(`\x1b]0;${'x'.repeat(5_000)}`)).to.deep.equal([]);
        expect(visibleText(parser.push(`more payload${cancel}visible`))).to.equal('visible');
      }
    });

    it('never leaks the ESC that interrupts a string into the rendered text', () => {
      const text = (input: string) => visibleText(createAnsiParser().push(input));

      expect(text('\x1b]0;t\x1b\u00e9after')).to.equal('\u00e9after');
      expect(text('\x1b]0;t\x1b\nafter')).to.equal('\nafter');
      expect(text('\x1bPq\x1b\x1b[31mred')).to.equal('red');
      expect(text('\x1b]0;a\x1b]0;b\x07after')).to.equal('after');
    });

    it('streams a document of interrupted strings identically for every chunk split', () => {
      // OSC cancelled by a CSI, OSC + ST, DCS + CAN, APC + SUB, PM + BEL, SOS cancelled by a whole OSC.
      const input = 'a\x1b]0;t\x1b[31mb\x1b]0;u\x1b\\c\x1bPq\x18d\x1b_G\x1ae\x1b^p\x07f\x1bXs\x1b]0;v\x07g\x1b[1mh';
      const whole = characters(createAnsiParser().push(input));
      expect(whole.map((entry) => entry[0]).join('')).to.equal('abcdefgh');

      for (let split = 0; split <= input.length; split++) {
        const parser = createAnsiParser();
        const streamed = [...parser.push(input.slice(0, split)), ...parser.push(input.slice(split))];
        expect(characters(streamed), `split at ${split}`).to.deep.equal(whole);
      }

      const parser = createAnsiParser();
      const bytewise = [...input].flatMap((character) => characters(parser.push(character)));
      expect(bytewise).to.deep.equal(whole);
    });

    it('reset() clears a held ESC and a discarded string', () => {
      const parser = createAnsiParser();
      parser.push('\x1b]0;t\x1b');
      parser.reset();
      expect(visibleText(parser.push('[31mplain'))).to.equal('[31mplain');

      parser.push(`\x1b]0;${'x'.repeat(5_000)}`);
      parser.reset();
      expect(visibleText(parser.push('plain'))).to.equal('plain');
    });
  });
});
