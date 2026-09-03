import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  findToolRenderer,
  getDefaultToolRendererRegistry,
  loadToolRenderer,
  type DirectToolRendererDefinition,
  type ToolRendererDefinition,
  type ToolRendererRegistry,
  type ToolRenderContext,
  type ToolResultStatus,
} from './registry.js';
import { styles } from './tool-result-view.styles.js';
import '../../overlays/skeleton/skeleton.class.js';
import '../../utility/json-viewer/json-viewer.class.js';
import '../../utility/copy-button/copy-button.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** What's currently in `[part="base"]` -- see `resolve()`. */
type RenderState =
  | { kind: 'loading' }
  | { kind: 'rendered'; template: unknown }
  | { kind: 'fallback' };

const FALLBACK_STATE: RenderState = { kind: 'fallback' };

/** The two supported built-in fallback presentations. Invalid runtime values normalize to `json`. */
export type ToolResultFallback = 'json' | 'text';

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
 * A matched renderer's `render()` is also handed a 3rd `context` argument
 * (`{ reportStatus }`) it can use to signal a non-throwing outcome (e.g. an application-level
 * failure it still drew a real UI for) — see `ToolRenderContext` in `registry.ts`. This is purely
 * additive: a pre-existing 2-arg `render(result, args)` function stays assignable unchanged, and a
 * renderer that never calls `reportStatus` leaves `status` at its default, `'success'`.
 *
 * Assigning `registry` synchronously copies at most 10,000 entries into a frozen readonly facade.
 * Later `set()`/`delete()` calls on the source map are not observed; create and assign a new map to
 * update dispatch. Definition records are cloned and frozen; their callback identities are retained.
 *
 * @customElement lr-tool-result-view
 * @event lr-render-error - `detail: { toolName, error }` — fired immediately
 * before falling back to `<lr-json-viewer>`, whether because no renderer
 * matched, a candidate renderer's `matches()` predicate threw during dispatch,
 * a renderer's `load()` rejected, or its `render()` threw.
 * @csspart base - The root wrapper around the resolved renderer's output (or the loading/fallback
 * view). Exposes `aria-busy="true"` while a lazy renderer loads and `"false"` otherwise.
 * @csspart fallback-text - The `<pre>` element for the `fallback="text"` kind's preformatted result text (only present in that mode).
 * @csspart fallback-copy - The `<lr-copy-button>` shown when `copyable` is set alongside the `fallback="text"` kind (only present when both are set).
 * @cssprop [--lr-tool-result-view-font=var(--lr-font-mono)] - Font family for the `fallback="text"` preformatted output.
 * @status stable
 * @since 4.0.0
 */
export class LyraToolResultView extends LyraElement<LyraToolResultViewEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    loading: LYRA_DEFAULT_loading,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  // `registry`'s values are renderer-definition records carrying `render`/`matches`/`load`
  // callbacks alongside plain data. The (default) recursive-clone snapshot path already keeps a
  // function's own identity intact -- it only ever clones+freezes the *containing* plain record --
  // so this deliberately stays out of `identityCollectionProperties`: that mode would instead keep
  // each definition object itself live (unfrozen, still the caller's own reference), which is
  // exactly what the class doc's "Definition records are cloned and frozen; their callback
  // identities are retained" contract rules out.
  protected static override readonly ownedCollectionProperties = Object.freeze([
    'registry',
  ]);

  static override styles = [LyraElement.styles, styles, srOnly];

  static override properties = {
    fallback: { reflect: true, noAccessor: true },
  };

  /** Custom registry to dispatch against instead of the module-level default one (see `registry.ts`). */
  @property({ attribute: false }) registry?: ToolRendererRegistry;

  /** The tool's name — the primary dispatch key (see `findToolRenderer()`). */
  @property({ attribute: 'tool-name' }) toolName = '';

  /** The tool call's result payload, handed to the matched renderer's `render()` (and to `matches()` for shape-based dispatch, and to the `<lr-json-viewer>` fallback). */
  @property({ attribute: false }) result: unknown;

  /** The tool call's original arguments, if available — handed to the matched renderer's `render()` alongside `result`. */
  @property({ attribute: false }) args: unknown;

  private _fallback: ToolResultFallback = 'json';

  /** Fallback-kind selector — see the class doc's `fallback` paragraph for the full "json" vs "text" behavior. */
  get fallback(): ToolResultFallback {
    return this._fallback;
  }
  set fallback(next: ToolResultFallback) {
    const old = this._fallback;
    this._fallback = next === 'text' ? 'text' : 'json';
    this.requestUpdate('fallback', old);
  }

  /** Shows a copy-to-clipboard affordance alongside the fallback view (both `"json"` and `"text"` kinds) — forwarded to `<lr-json-viewer>`'s own `copyable`, or renders a `<lr-copy-button>` next to the text fallback. */
  @property({ type: Boolean, reflect: true }) copyable = false;

  /**
   * The outcome of the currently-rendered result, as reported by the matched renderer's optional
   * `context.reportStatus()` third `render()` argument (see `ToolRenderContext` in `registry.ts`).
   * Reset to `'success'` immediately before every `render()` call, so a renderer that never calls
   * `reportStatus` — including every pre-existing 2-arg renderer — leaves it at that default, and a
   * later renderer that stays quiet doesn't inherit a stale outcome from a previous one. Reuses the
   * same vocabulary as `<lr-tool-result-dialog>`'s own `status` property.
   */
  @property({ reflect: true }) status: ToolResultStatus = 'success';

  @state() private renderState: RenderState = FALLBACK_STATE;

  // Bumped on every resolve() call so a stale in-flight load() (superseded by
  // a newer toolName/result/args/registry before it settles) can detect it's
  // no longer current and skip writing its result over a more recent one.
  private generation = 0;

  // A synchronous renderer may retain its context and report a status later.
  // This token keeps that callback scoped to the render invocation that
  // returned successfully, rather than a fallback or later render.
  private renderAttempt?: symbol;

  // The last `def` findToolRenderer() returned that went through a successful
  // load(), paired with its resolved (post-load) definition. Keyed by `def`
  // object identity so an unrelated property change (result/args/registry
  // mutating without dispatch actually landing on a different definition)
  // can reuse the already-loaded module instead of flashing the loading
  // skeleton again for a load() that's already resolved and cached.
  private resolvedLazy?: { def: ToolRendererDefinition; resolved: DirectToolRendererDefinition };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
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
    this.renderAttempt = undefined;
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
      let resolved: DirectToolRendererDefinition;
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

  private renderWith(def: DirectToolRendererDefinition): void {
    // Captured up front so a `reportStatus()` call arriving asynchronously (e.g. from a promise
    // the renderer's own render() kicked off) after a *newer* resolve() has already started can
    // detect it's stale and skip writing over a more recent status -- mirrors the same
    // generation-guard pattern resolve()/loadToolRenderer() already use for stale results.
    const generation = this.generation;
    const attempt = Symbol();
    this.renderAttempt = attempt;
    this.status = 'success';
    const context: ToolRenderContext = {
      reportStatus: (status) => {
        if (generation !== this.generation || this.renderAttempt !== attempt) return;
        this.status = status;
      },
    };
    try {
      const template = def.render(this.result, this.args, context);
      if (generation !== this.generation || this.renderAttempt !== attempt) return;
      this.renderState = { kind: 'rendered', template };
    } catch (error) {
      if (generation !== this.generation || this.renderAttempt !== attempt) return;
      this.renderAttempt = undefined;
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    this.emit('lr-render-error', { toolName: this.toolName, error });
    this.status = 'success';
    this.renderState = FALLBACK_STATE;
  }

  override render(): TemplateResult {
    const state = this.renderState;
    return html`
      <div part="base" aria-busy=${state.kind === 'loading' ? 'true' : 'false'}>
        ${state.kind === 'loading'
          ? html`
              <span class="sr-only">${this.localize('loading')}</span>
              <lr-skeleton shape="rect" height="4rem" .announce=${false}></lr-skeleton>
            `
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
