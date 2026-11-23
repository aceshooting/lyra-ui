# Changelog

## 33.1.0

### Minor Changes

- 328e3cd: `lr-map` gains `anchorAvoidSides`, a list of `{ element, side }` obstacles that keeps anchors on a
  named side of each: `'block-end'` (below it), `'block-start'`, `'inline-start'` or `'inline-end'`
  (logical, so they follow RTL), or `'auto'`, the cheapest edge that `anchorAvoid` uses. Use it for
  chrome whose cheapest edge changes with its size, such as a floating search bar whose results list
  opens and would otherwise squeeze the anchored panel into a narrow column beside it. An element in
  both `anchorAvoid` and `anchorAvoidSides` takes its side from the latter; `anchorAvoid` itself is
  unchanged. The new `LyraMapAnchorAvoidObstacle` and `LyraMapAnchorAvoidSide` types are exported.
  `anchorAvoid`, `anchorAvoidSides` and `controlsAvoid` also no longer reserve space for an obstacle
  hidden with `visibility: hidden` (including an inherited one), and re-measure when an obstacle's own
  `style`, `class` or `hidden` attribute changes.
- 03bca9a: `utilities.css` adds `lr-button` and `lr-card`, light-DOM classes that give a plain `<a href>` or
  `<button>` the look of `<lr-button>` and any element the surface of `<lr-card>`, with nothing to
  hydrate. They read the same `--lr-button-*` and `--lr-card-*` hooks and theme tokens as the
  components. Variant comes from `lr-neutral|brand|success|warning|danger` and size from
  `lr-size-2xs` … `lr-size-xl`, on the element or an ancestor. Appearance comes from `lr-accent`,
  `lr-filled`, `lr-outlined`, `lr-filled-outlined` or `lr-plain` on the element. Hover, press, keyboard
  focus, `:disabled` and `aria-disabled="true"` states, RTL, dark scopes and reduced motion are covered.
  The variant classes also publish `--lr-variant-on-loud`. `lyra-ui-migrate` now rewrites Web Awesome's
  `wa-button`, `wa-accent`, `wa-filled`, `wa-outlined`, `wa-plain` and `wa-pill` classes to these
  counterparts instead of only reporting them.

### Patch Changes

- 328e3cd: Server-rendered components no longer render a second copy of their template when Lit's hydration support was not installed in time. A code-splitting bundler can move Lit into a shared chunk that evaluates before `@aceshooting/lyra-ui/hydration.js`, which left the server's declarative shadow root in place with a duplicate tree rendered in front of it. A component now detects a server-rendered shadow root that Lit cannot hydrate, discards the server markup and renders into the same shadow root, and the development build warns once naming the cause. The SSR guide adds a bundler recipe (one shared chunk for Lit and `hydration.js`, or `hydration.js` as a separate first script) so such pages hydrate instead of re-rendering.
- 29841f7: `lyraSsrElementRenderers()` now returns a fresh mutable array type instead of a readonly tuple, so the documented `render(template, { elementRenderers: lyraSsrElementRenderers(LitElementRenderer) })` call compiles under strict TypeScript against `@lit-labs/ssr`'s `RenderInfo` (it previously failed with TS4104). Each call returns a new array, so a caller that mutates it affects nobody else.

## 33.0.0

### Major Changes

- 6dc25b2: `lr-lightbox`: `lr-after-show` and `lr-after-hide` now fire once the open or close animation has
  finished, as on the other overlays, instead of straight after the render. Under
  `prefers-reduced-motion` or a zero `--show-duration`/`--hide-duration` they still follow the render
  directly. `show()`, `hide()` and `close()` resolve with the after-events, and a transition
  interrupted by the opposite one emits no after-event of its own. Migration: code that relied on
  `lr-after-hide` arriving while the surface was still fading (`data-closing` set) should listen for
  `lr-close` instead; code that waited for the motion separately can rely on the after-events.
- 6dc25b2: `--lr-overlay-radius` now defaults to `var(--lr-radius-container)` on every floating surface, as the
  shared overlay surface already resolved it. The fallbacks that still read `var(--lr-radius)` follow:
  the `lr-drawer` `floating` panel, the `lr-dialog` (and so `lr-drawer`) close button, the
  `lr-time-input` popup and `lr-toast-item` (whose `--lr-toast-item-radius` default is documented as
  `var(--lr-radius-container)` too). The documented default changes on every tag that listed
  `var(--lr-radius)`. Nothing changes unless a theme sets `--lr-theme-border-radius-container`, which
  these surfaces now follow. Migration: to keep the previous corners under such a theme, set
  `--lr-overlay-radius: var(--lr-radius)` (or the component's own radius hook) on the affected
  surfaces or an ancestor. `lr-tooltip` keeps `var(--lr-radius-xs)`; `lr-color-picker`,
  `lr-locale-picker`, `lr-model-select` and `lr-voice-picker` popups keep following their own
  component radius while `--lr-overlay-radius` is unset.
- 6dc25b2: `lr-table`: the `lr-page-change` detail type now declares `pageSize` and `offset` as required,
  `Readonly<{ page: number; pageSize: number; offset: number }>`, matching `lr-before-page-change` and
  `lr-pagination`. The runtime already sent both fields, so listeners are unaffected and can drop any
  fallback for the two fields. Migration: code that builds this detail itself (test mocks, `dispatchEvent`, typed
  event-map stubs) must now include `pageSize` and `offset` (`offset` is `(page - 1) * pageSize`);
  TypeScript reports every such site.
- 52a9ecf: `lr-copy-button`'s `feedback-duration` defaults to `1000` ms instead of `1500` ms, the default both
  Web Awesome's `wa-copy-button` and Shoelace's `sl-copy-button` use. A non-finite value now falls
  back to `1000`. The `wa-`/`sl-` migration no longer inserts `feedback-duration="1000"` on converted
  copy buttons, because the default already matches. Other built-in copy affordances keep their own
  feedback timing.

  ## Migration

  A copy button without `feedback-duration` now returns to its copy icon half a second sooner. To keep
  the previous timing, set `feedback-duration="1500"`. `npx lyra-ui-migrate --origin=lyra-v32 --check`
  reports each `.feedbackDuration` property read, write and binding on an `lr-copy-button`; search
  markup for `<lr-copy-button` elements without `feedback-duration` yourself.
- 6dc25b2: `--lr-form-control-label-gap` is now the one label-to-field gap in every placement. Besides the
  `label-placement="start"` column gap (default `var(--lr-space-m)`), it spaces a label above the
  field, in top placement and in a collapsed start row (default `var(--lr-space-xs)`; the control's
  own row gap in `lr-radio-group` and `lr-slider`, `0px` in `lr-checkbox-group`). It applies to every
  control that takes `label-placement`, plus `lr-segmented` and `lr-file-input`.
  `--lr-form-control-label-block-gap` is removed.

  ## Migration

  Run `npx lyra-ui-migrate --origin=lyra-v32` after upgrading: it rewrites every
  `--lr-form-control-label-block-gap` to `--lr-form-control-label-gap`. Then review where the
  start-column gap was set: a `--lr-form-control-label-gap` declared on a form or a shared ancestor
  now also spaces the top labels under it. Move that declaration onto the start-placed controls (for
  example `[label-placement='start'] { --lr-form-control-label-gap: … }`) when only the column should
  change, and drop a block-gap declaration that the rewrite now duplicates.
- 6dc25b2: `label-placement="start"` supports a content-sized label column:
  `--lr-form-control-label-inline-size: auto` makes the column as wide as the label text (never wider
  than the row), so the `::part(form-control-label)` flex override is no longer needed. The column
  token is now the label's flex basis, and the collapse below
  `--lr-form-control-label-collapse-inline-size` sets a full-row minimum instead of a full-row basis.
  The label is capped at the row's inline size, so a column token wider than the control no longer
  overflows it. This covers every control that takes `label-placement`.

  ## Migration

  Remove a `::part(form-control-label)` rule that only set `flex`, `flex-basis` or
  `min-inline-size` to size the start column, and set `--lr-form-control-label-inline-size: auto`
  instead. With a content-sized column the hint and error start at the row's inline-start edge rather
  than under the field. A label column wider than the control is now clamped to it.
- 6dc25b2: `lr-slider`'s label now uses the form-control label size: `--lr-form-control-label-font-size`
  defaults to `var(--lr-font-size-md-sm)` instead of `inherit`, so a slider label matches the
  `lr-input` and `lr-select` labels beside it.

  ## Migration

  A slider whose label should keep following the surrounding font size sets
  `--lr-form-control-label-font-size: 1em` on the slider (not `inherit`, which a custom property
  applies to itself). A slider that already set the token to `var(--lr-font-size-md-sm)` can drop it.
- 52a9ecf: `lr-timeline` accepts `orientation="auto"`, matching Web Awesome's `wa-timeline`. An auto timeline
  measures its own inline size and runs as a row while every item gets about 10em of it, and as a
  column otherwise, so the same markup stacks on a 320px phone or in a narrow pane with no breakpoint
  to author. It renders as a column until it has been measured, including server-rendered markup. The
  new read-only `effectiveOrientation` property reports the axis in effect, and while `auto` the host
  carries a matching `data-effective-orientation` attribute. A row mirrors under RTL like
  `horizontal`.

  ## Migration

  The `orientation` property's type is now `LyraTimelineOrientation`
  (`'vertical' | 'horizontal' | 'auto'`), so TypeScript code that switches over it exhaustively, or
  assigns it to a `LyraOrientation`, needs an `auto` branch or a read of `effectiveOrientation`
  instead. Markup that already set `orientation="auto"` used to fall back to a column and now adapts
  to its width; set `orientation="vertical"` to keep the column. `npx lyra-ui-migrate
  --origin=lyra-v32 --check` reports each `.orientation` property read, write and binding on an
  `lr-timeline`.
- 6dc25b2: `lr-token-input`'s `delimiter` is now a set of single-character delimiters, matching the upstream
  tag-input semantics: each character is a delimiter on its own, so `delimiter=";,"` splits a draft
  (and a string assigned to `value` or `defaultValue`) at every semicolon and every comma, and typing
  either one commits the draft. Characters are code points, so an emoji delimiter stays whole.
  `null`, `delimiter="none"` and `delimiter=""` still disable splitting.

  ## Migration

  A single-character delimiter behaves as before. A delimiter longer than one character used to
  match only as one whole string, and no keystroke committed it; it now splits at each of its
  characters. `npx lyra-ui-migrate --origin=lyra-v32 --check` reports each `.delimiter` property
  read, write and binding on an `lr-token-input`; search markup for `delimiter="` attributes longer
  than one character yourself. Where a token may contain one of those characters, use a single
  delimiter character that never appears in a token.

### Minor Changes

- d02b1b6: Add an opt-in Bootstrap Icons preset for `<lr-icon>` at
  `@aceshooting/lyra-ui/components/utility/icon/icon-library-bootstrap.js`.
  `registerBootstrapIconLibrary({ name?, basePath?, version? })` resolves `<name>.svg` from a pinned
  jsDelivr `bootstrap-icons` release, or from a self-hosted folder, and returns an unregister
  callback. Registering it as `'default'` keeps the icon names of migrated Shoelace markup rendering,
  since Bootstrap Icons is Shoelace's default vocabulary. The resolver validates names and fails
  closed with the localized icon alert before any request; downloads keep the existing byte cap,
  sanitizing and shared cache, and importing the module registers and fetches nothing.
  `createBootstrapIconResolver()`, `bootstrapIconMutator` and `BOOTSTRAP_ICONS_DEFAULT_VERSION` are
  exported for custom resolvers. The migration codemod's icon review now names the matching preset:
  Bootstrap Icons for `sl-icon`/`sl-icon-button`, Font Awesome for `wa-icon`.
- 22a4f2f: Add a library-level syntax grammar registry for `<lr-code-block>` and `<lr-code-block-core>`.
  `registerCodeGrammar(name, grammarOrLoader, { aliases? })` and `unregisterCodeGrammar(name)` are
  exported from the root barrel and from
  `@aceshooting/lyra-ui/components/conversation/code-block/code-grammar-registry.js`. A grammar object
  or lazy loader registered once serves every code block on the page; a per-element `languages` or
  `languageLoaders` entry still wins for the same language. Registering or removing a grammar
  re-highlights the connected blocks that show that language, a loader that fails leaves the localized
  plain-text fallback, and invalid names, aliases or sources throw a `TypeError` without registering
  anything.
- 6dc25b2: `lr-combobox`: an option returned by `dataSource` (or a `source` row) may carry `html`, rich markup
  rendered in place of the label text as the new `option-html` part. The markup always passes through
  the optional `dompurify` peer and a passive-content pass, and a superseded result is never applied.
  The text `label` stays the row's accessible name, filter text and committed text. When the peer is
  missing or fails, rows fail closed to their plain labels, the listbox shows the localized
  `comboboxRichContentUnavailable` note (`option-html-fallback` part) and the message is announced once.
- 53802fc: `lr-dialog` and `lr-drawer` open and close from markup alone. Activating any element with
  `data-dialog="open <id>"` opens the dialog with that `id`, and activating a descendant with
  `data-dialog="close"` closes the nearest owning dialog with the new `'close-action'` close reason;
  `lr-drawer` uses `data-drawer` the same way. Both run the ordinary cancelable lifecycle, ignore
  disabled, `aria-disabled` and inert actions, work across open shadow roots, and share one document
  listener that is removed when the last dialog or drawer disconnects. Markup migrated from Web
  Awesome that uses these attributes now works unchanged.
- 6dc25b2: `lr-lightbox` follow-ups:

  - Touch and pen swipes now follow the pointer: once a drag is clearly horizontal the slide moves with
    it, a release at least 50px toward an existing item moves there with the incoming slide continuing
    from the release point, and a shorter or mostly vertical drag, a drag past the first or last item
    without `loop` (followed with resistance) or a `pointercancel` settles the slide back. Directions
    reverse under RTL, and under reduced motion the slide does not follow the pointer. A swipe no longer
    starts on a form field or editable content, or when the `pointerdown` was already handled.
  - An `lr-lightbox-item` whose direct child is a `<template>` shows that template's content as a
    custom slide. The content is copied only while the slide is shown, into a light-DOM
    `<div slot="slide-content">` so page styles apply, and is removed on another slide or after the close
    motion; `width`/`height` keep its proportions and it cannot be zoomed. Slotted form fields and sliders
    in the lightbox keep their own arrow keys.
  - `with-thumbnails` now works with `imageSource`: the strip covers the 15 positions around the current
    image and reads only those descriptors. `LyraLightboxImage` gains an optional `thumbnail` used by the
    strip in `images` and `imageSource` modes.
  - Documented: `lr-item-change`, like `lr-index-change` and `lr-carousel`'s `lr-slide-change`, reports
    navigation (buttons, keys, swipes, thumbnails, `goTo()`/`next()`/`previous()`) and is not fired when
    `index` is written directly.
- e4f09a0: The `lyra-ui-migrate` codemod now rewrites more of a Web Awesome or Shoelace project:

  - Translation imports such as `@shoelace-style/shoelace/dist/translations/de-ch.js` become the matching `@aceshooting/lyra-translations/de-CH.js` catalog. The built-in `en` import is removed. A bare `pt` or `zh` loads `pt-BR` or `zh-CN` and is reported for review. A locale Lyra does not ship is reported and left unchanged.
  - Named imports of `serialize`, `registerIconLibrary`, `unregisterIconLibrary`, `setDefaultIconFamily`, `getDefaultIconFamily`, `getDefaultIconVariant`, `allDefined`, `setDefaultAnimation`, `setAnimation`, `getAnimation`, `getAnimationNames` and `getEasingNames` from the upstream `dist/utilities/*.js` modules are rewritten to their granular Lyra subpaths. A statement that also imports an unrecognized name stays in manual review, and the report names that symbol.
  - Mapped tags in `css` tagged templates, in `::slotted()`, and in selector strings passed to `querySelector()`, `querySelectorAll()`, `closest()` or `matches()` on an element are now renamed instead of only reported.
  - On a renamed Shoelace form control, `[data-user-invalid]`, `[data-invalid]`, `[data-user-valid]`, `[data-valid]`, `[data-required]` and `[data-optional]` selectors become the matching `:state()` selector when the Lyra control documents that state. Otherwise the codemod reports `VALIDATION_STATE_REVIEW`.
  - CSS rules keyed on an author's own `.wa-*` class or `#wa-*` id are no longer renamed as if they were tags.
  - `wa-rich-text-editor` (Web Awesome Pro) is now recognized and reported with its reason: Lyra UI has no rich-text editor counterpart.
- 7f10f6e: `lyra-ui-migrate` now rewrites upstream `--wa-*` and `--sl-*` design-token references to `--lr-*` tokens through a reviewed route table instead of only reporting them. Semantic colour roles, surface, text, border, overlay and focus colours, border widths, font families and weights, and spacing steps with the same resolved value (`--wa-space-m` becomes `--lr-space-l`) are rewritten silently. Type sizes, radii, line heights, shadows, durations, easing and Shoelace `-600` palette steps rewrite to the nearest role and report `UPSTREAM_TOKEN_APPROXIMATE_REVIEW`. Tokens with no equivalent, such as `--wa-space-2xl` (2.5rem), are left as-is and reported as `UPSTREAM_TOKEN_REVIEW` with the nearest alternatives. A token the file declares itself is never rewritten.
- 6dc25b2: `lr-number-ticker` settles early: on the first frame whose formatted text equals the formatted final
  value, it shows that value, leaves `:state(counting)` and emits `lr-finish`, instead of repainting the
  same text until `duration` ends. With the default ease-out curve, `lr-finish` now fires when the number
  visibly stops. A `value` change during a count still counts on from the number shown, and reduced
  motion turning on mid-count still settles at once.
- 6dc25b2: `@aceshooting/lyra-ui` now sets its `customElements` field to a slim Custom Elements Manifest, `custom-elements.slim.json` (also the `@aceshooting/lyra-ui/custom-elements.slim.json` export), so Storybook, wc-toolkit and analyzers discover every tag without installing `@aceshooting/lyra-ide`.

  - Per tag it lists attributes (name, `fieldName`, type, default), public fields and methods, events, slots, CSS parts, CSS properties and CSS states, flattened across superclasses, with module paths at the shipped `dist/` files and each tag's `components/lr-<tag>.js` definition.
  - Descriptions, status, `since`, deprecation records and the companion packages' tags stay in the full manifest, which `@aceshooting/lyra-ide` keeps publishing with `web-types.json` and the VS Code data; `@aceshooting/lyra-ui/custom-elements.json` still does not resolve.
  - The tarball grows by the one file (about 1.5 MB unpacked); the unpacked ceiling and the file-count derivation are raised by exactly that.
- 6dc25b2: `lr-step` adds `customStates` (attribute `custom-states`): a space-separated list of author-defined
  state names, each published as a CSS custom state, so `<lr-step custom-states="error">` can be styled
  with `lr-step:state(error)::part(marker)`. Names must be CSS identifiers; the step's own states
  (`active`, `completed`, `loading`, `disabled`, `locked`, `clickable`) cannot be overridden. The names
  are a styling hook only and change neither the status text nor the stepper's behavior.
- 599ae22: Components no longer bundle the document token layer's text. Load `theme.css`, or `tokens-root.css`
  (the layer alone) when a page does not use `theme.css`, with a `<link>` in `<head>` or a bundler CSS
  import: the layer then costs components no JavaScript, and its script is never requested. A
  code-splitting build of one standalone control is about 3.5 KB gzip smaller on its initial route;
  a bundle built without code splitting still inlines the layer module.

  Without either stylesheet, components still render correctly: the first registration imports the
  layer as a separate module and adopts it as before, and each component holds its first render until
  the layer has arrived, so nothing paints without its tokens. Later documents, iframes and
  application shadow roots are filled synchronously once it has loaded. The single-script CDN build
  emits the layer as its own chunk, fetched only when the page links no Lyra stylesheet.

  On such a page the first render therefore finishes one module request after connection rather than
  in the next microtask. Code that reads a component's shadow DOM, parts or rendered attributes must
  await the component's own `updateComplete` (a test fixture's wrapper element does not wait for its
  children); a page that loads the stylesheet first renders exactly as before.
- e2ef760: `lr-tooltip` accepts `fullWidthTrigger` (`full-width-trigger`), as `lr-popover` and `lr-dropdown` do, so a block trigger such as an actionable card in a grid cell fills its column and a truncated title inside it can ellipsize.
- 91a6b10: Add opt-in utility classes `lr-wrap-reverse`, `lr-justify-evenly`, `lr-self-baseline`, `lr-text-justify`, `lr-font-light`, `lr-tabular-nums`, `lr-zebra-rows` and `lr-hover-rows`, and teach `migrate-wa` to rewrite the matching Web Awesome classes instead of only reporting them.
- f920ad2: Remap any semantic colour role declaratively. Import the new opt-in `accent-roles.css` and set `data-lr-accent-neutral`, `data-lr-accent-success`, `data-lr-accent-warning` or `data-lr-accent-danger` to a gemstone (`emerald`, `peridot`, `topaz`, `ruby`, `tourmaline`, `amethyst`, `aquamarine`, `sapphire`, `hematite`), or to `none` to restore the look's own colours. The role then gets the same contrast-qualified light and dark ramp that `data-lr-accent` gives brand. The attributes work on any element and nest. They are theme scopes, they follow the nearest mode and they give way to system colours under forced colours. Brand and focus stay with `data-lr-accent`, and nothing changes without the attributes. `theme.css` and `theme-core.css` gain only the four scope selectors.
- 72f11d6: Add an opt-in Font Awesome preset for `<lr-icon>` at
  `@aceshooting/lyra-ui/components/utility/icon/icon-library-font-awesome.js`.
  `registerFontAwesomeIconLibrary({ name?, kitCode?, basePath?, version?, defaultFamily?, defaultVariant? })`
  resolves the free tier (`classic` solid/regular and `brands`) from a pinned release, and every Pro and
  Pro+ family (`duotone`, `sharp`, `sharp-duotone`, `jelly`, `utility`, …) through a kit code or a
  self-hosted copy. It honours `setDefaultIconFamily()` and the per-icon `family`/`variant`, and
  returns an unregister callback. The resolver validates names, families and variants and fails closed
  with the localized icon alert before any request is made; downloads keep the existing byte cap,
  sanitizing and shared cache. Importing the module registers and fetches nothing, so icons stay
  offline-first until the preset is registered. `createFontAwesomeIconResolver()`,
  `fontAwesomeIconFolder()`, `fontAwesomeIconMutator` and `FONT_AWESOME_DEFAULT_VERSION` are exported
  for custom resolvers.

### Patch Changes

- 5b4d9ac: The text fields and other controls built on the shared form-associated base now document the six validity custom states they already publish (`required`, `optional`, `valid`, `invalid`, `user-valid`, `user-invalid`) in the component manifest. This covers `lr-input`, `lr-number-input`, `lr-native-time-input`, `lr-textarea`, `lr-date-input`, `lr-time-input`, `lr-phone-input`, `lr-chat-composer`, `lr-known-date`, `lr-code-editor`, `lr-color-picker`, `lr-emoji-picker` and the country, currency, unit and time-zone pickers. With the states in the manifest, `lyra-ui-migrate` rewrites Shoelace selectors such as `sl-input[data-user-invalid]` to `lr-input:state(user-invalid)` instead of reporting them for review.
- 6dc25b2: Server-rendered pages keep their localized text through hydration. A component under an ancestor
  `lang` the server could not see (the server renderer gives a component no ancestors) now
  reproduces the server's text on its hydrating render and commits the inherited locale on the next
  update, instead of leaving the server's text in place while reporting the translated value. A
  server that renders with `setLyraLocale(requestLocale)` matching the page's `lang` serves
  translated text that hydration keeps with no flash.

  `lr-checkbox` now shows its slotted label in server-rendered markup, so a page whose JavaScript
  never runs still displays it; an empty label collapses after hydration as before. `lr-radio`
  renders its label the same way where its shadow root is rendered. Parts and slots are unchanged.
- 3cbc444: Lighter first paint for every component, and for form controls in particular. The full locale
  fallback chain (regional fallbacks, likely-subtags ranking, parent catalogs) is now installed by the
  first `registerLyraLocale()`/`registerLyraLocaleDelta()` call, so an application that renders only
  the built-in English messages no longer ships it; plural selection and number formatting still use
  the inherited locale, and an app that registers its catalogs before first render resolves exactly
  as before. Form controls watch for external `<label>` association with a small lean observer and
  load the indexed association observer only once a control has an associated label or a mutation
  could give it one. A label present when a control connects is applied in that control's first
  update, as before; label changes made before the observer chunk first loads are replayed with the
  same targeting when it arrives.
- 6756f15: Focus navigation and accessibility visibility now share one closed-details traversal helper, which trims a little shared code from every overlay and form-control bundle.
- 1fa99d5: `lr-tooltip` opened before its first render (an `open` attribute, or `open` set while that render is pending) classifies its content after the first update settles, so actionable content still renders the popup as a dialog without triggering Lit's change-in-update warning.
- @aceshooting/lyra-translations@33.0.0

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
