import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  findToolRenderer,
  getDefaultToolRendererRegistry,
  loadToolRenderer,
  type ToolRendererDefinition,
  type ToolRendererRegistry,
} from './registry.js';
import { styles } from './tool-result-view.styles.js';
import '../../overlays/skeleton/skeleton.class.js';
import '../../utility/json-viewer/json-viewer.class.js';
import '../../utility/copy-button/copy-button.class.js';

/** What's currently in `[part="base"]` -- see `resolve()`. */
type RenderState =
  | { kind: 'loading' }
  | { kind: 'rendered'; template: unknown }
  | { kind: 'fallback' };

const FALLBACK_STATE: RenderState = { kind: 'fallback' };

export interface LyraToolResultViewEventMap {
  'lr-render-error': CustomEvent<{ toolName: string; error: unknown }>;
}
/**
 * `<lr-tool-result-view>` — renders a tool call's result via whichever
 * custom renderer a host app has registered for it (see `registerToolRenderer()`
 * in `registry.ts`), falling back to `<lr-json-viewer>` whenever no
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
 * `fallback` implements two kinds: `"json"` (the default, an unconditional `<lr-json-viewer>`)
 * and `"text"`, which renders a *string* `result` as preformatted text instead — falling back to
 * the `"json"` behavior when `result` isn't a string, so setting `fallback="text"` defensively
 * against an unpredictable result shape never renders broken output. `copyable` adds a
 * copy-to-clipboard affordance to either fallback kind (forwarded to `<lr-json-viewer>`'s own
 * `copyable` for `"json"`; a `<lr-copy-button>` alongside the text for `"text"`).
 *
 * @customElement lr-tool-result-view
 * @event lr-render-error - `detail: { toolName, error }` — fired immediately
 * before falling back to `<lr-json-viewer>`, whether because no renderer
 * matched, a candidate renderer's `matches()` predicate threw during dispatch,
 * a renderer's `load()` rejected, or its `render()` threw.
 * @csspart base - The root wrapper around the resolved renderer's output (or the loading/fallback view).
 * @csspart fallback-text - The `<pre>` element for the `fallback="text"` kind's preformatted result text (only present in that mode).
 * @csspart fallback-copy - The `<lr-copy-button>` shown when `copyable` is set alongside the `fallback="text"` kind (only present when both are set).
 */
export class LyraToolResultView extends LyraElement<LyraToolResultViewEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Custom registry to dispatch against instead of the module-level default one (see `registry.ts`). */
  @property({ attribute: false }) registry?: ToolRendererRegistry;

  /** The tool's name — the primary dispatch key (see `findToolRenderer()`). */
  @property({ attribute: 'tool-name' }) toolName = '';

  /** The tool call's result payload, handed to the matched renderer's `render()` (and to `matches()` for shape-based dispatch, and to the `<lr-json-viewer>` fallback). */
  @property({ attribute: false }) result: unknown;

  /** The tool call's original arguments, if available — handed to the matched renderer's `render()` alongside `result`. */
  @property({ attribute: false }) args: unknown;

  /** Fallback-kind selector — see the class doc's `fallback` paragraph for the full "json" vs "text" behavior. */
  @property({ reflect: true }) fallback = 'json';

  /** Shows a copy-to-clipboard affordance alongside the fallback view (both `"json"` and `"text"` kinds) — forwarded to `<lr-json-viewer>`'s own `copyable`, or renders a `<lr-copy-button>` next to the text fallback. */
  @property({ type: Boolean, reflect: true }) copyable = false;

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
      this.fail(new Error(`<lr-tool-result-view>: no renderer registered for tool "${this.toolName}"`));
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
      this.fail(new Error(`<lr-tool-result-view>: renderer for tool "${this.toolName}" has no render()`));
      return;
    }
    try {
      this.renderState = { kind: 'rendered', template: def.render(this.result, this.args) };
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    this.emit('lr-render-error', { toolName: this.toolName, error });
    this.renderState = FALLBACK_STATE;
  }

  render(): TemplateResult {
    const state = this.renderState;
    return html`
      <div part="base">
        ${state.kind === 'loading'
          ? html`<lr-skeleton variant="rect" height="4rem"></lr-skeleton>`
          : state.kind === 'rendered'
            ? state.template
            : this.renderFallback()}
      </div>
    `;
  }

  private renderFallback(): unknown {
    if (this.fallback === 'text' && typeof this.result === 'string') {
      return html`
        <pre part="fallback-text">${this.result}</pre>
        ${this.copyable ? html`<lr-copy-button part="fallback-copy" .value=${this.result}></lr-copy-button>` : nothing}
      `;
    }
    return html`<lr-json-viewer .data=${this.result} ?copyable=${this.copyable}></lr-json-viewer>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tool-result-view': LyraToolResultView;
  }
}
