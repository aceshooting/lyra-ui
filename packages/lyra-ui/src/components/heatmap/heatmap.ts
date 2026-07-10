import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { linearAlpha, sqrtStep } from './heatmap-scale.js';
import { styles } from './heatmap.styles.js';

const PAD_LEFT = 60;
const PAD_TOP = 20;
const NO_DATA_FILL = 'rgba(128,128,128,0.25)';
const RAMP_STEPS = 7;
const FALLBACK_SCALE_LO = '#cde2fb';
const FALLBACK_SCALE_HI = '#0969da';

/** Parses a `#rgb` or `#rrggbb` hex string into an `[r, g, b]` triple. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padStart(6, '0');
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Linearly interpolates between two hex colors at `t` in `[0, 1]`. */
function mixColor(fromHex: string, toHex: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [r1, g1, b1] = hexToRgb(fromHex);
  const [r2, g2, b2] = hexToRgb(toHex);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * `<lyra-heatmap>` — a Canvas matrix heatmap with a DPR-aware, resize-aware
 * redraw loop. `-1` cells are treated as "no data". The sequential color
 * ramp's endpoints are read from the `--lyra-heatmap-scale-lo`/`-hi` custom
 * properties (declared in `heatmap.styles.ts`) so hosts can retheme it —
 * canvas can't consume `var()` directly, so they're resolved once per draw
 * via `getComputedStyle`.
 *
 * @customElement lyra-heatmap
 * @csspart base, canvas, legend
 */
export class LyraHeatmap extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) rowLabels: string[] = [];
  @property({ attribute: false }) colLabels: string[] = [];
  @property({ attribute: false }) values: number[][] = [];
  @property({ type: Number, attribute: 'cell-size' }) cellSize = 22;
  @property({ attribute: 'value-label' }) valueLabel = 'value';
  @property() scale: 'linear' | 'sqrt' = 'linear';

  @query('canvas') private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private dprQuery?: MediaQueryList;

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this);
    this.watchDpr();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.dprQuery?.removeEventListener('change', this.onDprChange);
  }

  private watchDpr(): void {
    this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }

  private onDprChange = (): void => {
    this.watchDpr();
    this.draw();
  };

  protected willUpdate(): void {
    const rows = this.rowLabels.length;
    const cols = this.colLabels.length;
    const flat = this.values.flat().filter((v) => v >= 0);
    const range = flat.length ? `${Math.min(...flat)}–${Math.max(...flat)}` : 'no data';
    this.setAttribute('role', 'img');
    this.setAttribute(
      'aria-label',
      `Heatmap of ${rows} × ${cols} cells, ${this.valueLabel} range ${range}`,
    );
  }

  protected updated(): void {
    this.draw();
  }

  /** Reads the customizable ramp endpoints off the host's computed style. */
  private scaleEndpoints(): [string, string] {
    const cs = getComputedStyle(this);
    const lo = cs.getPropertyValue('--lyra-heatmap-scale-lo').trim() || FALLBACK_SCALE_LO;
    const hi = cs.getPropertyValue('--lyra-heatmap-scale-hi').trim() || FALLBACK_SCALE_HI;
    return [lo, hi];
  }

  /** Resolves the `--lyra-color-text-quiet` chrome token for axis labels. */
  private labelColor(): string {
    return getComputedStyle(this).getPropertyValue('--lyra-color-text-quiet').trim() || '#6b7280';
  }

  private draw(): void {
    if (!this.canvas) return;
    const rows = this.rowLabels.length;
    const cols = this.colLabels.length;
    const w = PAD_LEFT + cols * this.cellSize;
    const h = PAD_TOP + rows * this.cellSize;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const flat = this.values.flat().filter((v) => v >= 0);
    const lo = flat.length ? Math.min(...flat) : 0;
    const hi = flat.length ? Math.max(...flat) : 1;
    const [scaleLo, scaleHi] = this.scaleEndpoints();
    const ramp = Array.from({ length: RAMP_STEPS }, (_, i) =>
      mixColor(scaleLo, scaleHi, i / (RAMP_STEPS - 1)),
    );

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = this.values[r]?.[c] ?? -1;
        const x = PAD_LEFT + c * this.cellSize;
        const y = PAD_TOP + r * this.cellSize;
        if (v < 0) {
          ctx.fillStyle = NO_DATA_FILL;
        } else if (this.scale === 'sqrt') {
          const step = sqrtStep(v, hi, RAMP_STEPS);
          ctx.fillStyle = step < 0 ? NO_DATA_FILL : ramp[step]!;
        } else {
          const t = linearAlpha(v, lo, hi);
          ctx.fillStyle = mixColor(scaleLo, scaleHi, t);
        }
        ctx.fillRect(x, y, this.cellSize - 1, this.cellSize - 1);
      }
    }

    ctx.fillStyle = this.labelColor();
    ctx.font = '10px sans-serif';
    this.rowLabels.forEach((label, r) => {
      ctx.fillText(label, 4, PAD_TOP + r * this.cellSize + this.cellSize / 2 + 3);
    });
    this.colLabels.forEach((label, c) => {
      ctx.fillText(label, PAD_LEFT + c * this.cellSize + 2, PAD_TOP - 6);
    });
  }

  render(): TemplateResult {
    return html`
      <div part="base">
        <canvas part="canvas"></canvas>
        <div part="legend">
          <span class="bar"></span>
          <span>${this.valueLabel}</span>
        </div>
      </div>
    `;
  }
}

defineElement('heatmap', LyraHeatmap);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-heatmap': LyraHeatmap;
  }
}
