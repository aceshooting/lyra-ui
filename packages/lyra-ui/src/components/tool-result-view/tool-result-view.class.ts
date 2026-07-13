import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import {
  findToolRenderer,
  getDefaultToolRendererRegistry,
  loadToolRenderer,
  type ToolRendererDefinition,
  type ToolRendererRegistry,
} from './registry.js';
import { styles } from './tool-result-view.styles.js';
import '../skeleton/skeleton.class.js';
import '../json-viewer/json-viewer.class.js';

/** What's currently in `[part="base"]` -- see `resolve()`. */
type RenderState =
  | { kind: 'loading' }
  | { kind: 'rendered'; template: unknown }
  | { kind: 'fallback' };

const FALLBACK_STATE: RenderState = { kind: 'fallback' };

export interface LyraToolResultViewEventMap {
  'lyra-render-error': CustomEvent<{ toolName: string; error: unknown }>;
}
/**
 * `<lyra-tool-result-view>` — renders a tool call's result via whichever
 * custom renderer a host app has registered for it (see `registerToolRenderer()`
 * in `registry.ts`), falling back to `<lyra-json-viewer>` whenever no
 * renderer matches, a candidate renderer's `matches()` predicate throws during
 * dispatch, a renderer's optional `load()` rejects, or its `render()` throws.
 * This component owns none of the actual visual weight of a
 * populated tool result — that's entirely whatever the registered renderer
 * returns; this is just the dispatch + fallback + loading-state shell.
 *
 * Dispatch runs against `registry` when set, otherwise against the
 * module-level default registry `registerToolRenderer()` writes to — see
 * `findToolRenderer()`'s two-step (exact name, then shape-based `matches()`)
 * lookup order for the full rule.
 *
 * `fallback` only implements `"json"` today (an unconditional
 * `<lyra-json-viewer>`) but is still accepted/reflected as an attribute so a
 * consumer's markup that already sets `fallback="…"` for some future value
 * doesn't need to change again once more fallback kinds land.
 *
 * @customElement lyra-tool-result-view
 * @event lyra-render-error - `detail: { toolName, error }` — fired immediately
 * before falling back to `<lyra-json-viewer>`, whether because no renderer
 * matched, a candidate renderer's `matches()` predicate threw during dispatch,
 * a renderer's `load()` rejected, or its `render()` threw.
 * @csspart base - The root wrapper around the resolved renderer's output (or the loading/fallback view).
 */
export class LyraToolResultView extends LyraElement<LyraToolResultViewEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Custom registry to dispatch against instead of the module-level default one (see `registry.ts`). */
  @property({ attribute: false }) registry?: ToolRendererRegistry;

  /** The tool's name — the primary dispatch key (see `findToolRenderer()`). */
  @property({ attribute: 'tool-name' }) toolName = '';

  /** The tool call's result payload, handed to the matched renderer's `render()` (and to `matches()` for shape-based dispatch, and to the `<lyra-json-viewer>` fallback). */
  @property({ attribute: false }) result: unknown;

  /** The tool call's original arguments, if available — handed to the matched renderer's `render()` alongside `result`. */
  @property({ attribute: false }) args: unknown;

  /** Forward-compatible fallback-kind selector — see the class doc; only `"json"` is implemented today. */
  @property({ reflect: true }) fallback = 'json';

  @state() private renderState: RenderState = FALLBACK_STATE;

  // Bumped on every resolve() call so a stale in-flight load() (superseded by
  // a newer toolName/result/args/registry before it settles) can detect it's
  // no longer current and skip writing its result over a more recent one.
  private generation = 0;

  // The last `def` findToolRenderer() returned that went through a successful
  // load(), paired with its resolved (post-load) definition. Keyed by `def`
  // object identity so an unrelated property change (result/args/registry
  // mutating without dispatch actually landing on a different definition)
  // can reuse the already-loaded module instead of flashing the loading
  // skeleton again for a load() that's already resolved and cached.
  private resolvedLazy?: { def: ToolRendererDefinition; resolved: ToolRendererDefinition };

  protected willUpdate(changed: PropertyValues): void {
    if (
      !this.hasUpdated ||
      changed.has('toolName') ||
      changed.has('result') ||
      changed.has('args') ||
      changed.has('registry')
    ) {
      void this.resolve();
    }
  }

  private async resolve(): Promise<void> {
    const generation = ++this.generation;
    const registry = this.registry ?? getDefaultToolRendererRegistry();

    let def: ToolRendererDefinition | undefined;
    try {
      def = findToolRenderer(this.toolName, this.result, registry);
    } catch (error) {
      this.fail(error);
      return;
    }

    if (!def) {
      this.fail(new Error(`<lyra-tool-result-view>: no renderer registered for tool "${this.toolName}"`));
      return;
    }

    if (def.load) {
      if (this.resolvedLazy?.def === def) {
        this.renderWith(this.resolvedLazy.resolved);
        return;
      }

      this.renderState = { kind: 'loading' };
      let resolved: ToolRendererDefinition;
      try {
        resolved = await loadToolRenderer(def);
      } catch (error) {
        if (generation !== this.generation) return;
        this.fail(error);
        return;
      }
      if (generation !== this.generation) return;
      this.resolvedLazy = { def, resolved };
      this.renderWith(resolved);
      return;
    }

    this.renderWith(def);
  }

  private renderWith(def: ToolRendererDefinition): void {
    if (!def.render) {
      this.fail(new Error(`<lyra-tool-result-view>: renderer for tool "${this.toolName}" has no render()`));
      return;
    }
    try {
      this.renderState = { kind: 'rendered', template: def.render(this.result, this.args) };
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    this.emit('lyra-render-error', { toolName: this.toolName, error });
    this.renderState = FALLBACK_STATE;
  }

  render(): TemplateResult {
    const state = this.renderState;
    return html`
      <div part="base">
        ${state.kind === 'loading'
          ? html`<lyra-skeleton variant="rect" height="4rem"></lyra-skeleton>`
          : state.kind === 'rendered'
            ? state.template
            : html`<lyra-json-viewer .data=${this.result}></lyra-json-viewer>`}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-tool-result-view': LyraToolResultView;
  }
}
