# Lyra UI roadmap

## Switchable styling after v21

Make choosing and switching an application's visual style straightforward while keeping the same
components, markup, events, keyboard behavior, and accessibility contracts. This is planned work,
not a claim that new presets or settings are already available. It does not block v21.

The current foundation already supports the original Lyra look, the opt-in shadcn look as CSS or a
runtime token preset, light/dark/system mode, custom accents and surfaces, persistence, and a
no-flash bootstrap. Extend that foundation rather than introducing another theme engine.

### Delivery order

1. **Unified style selection and a glass surface treatment.** Offer a previewable choice of looks,
   with an optional glass treatment for app rails, docks, floating toolbars, menus, popovers, and
   media controls. Preserve independent mode and accent choices when changing the look. Support
   returning to the original look and resetting individual choices without stale token overrides.
   Ship runtime and stylesheet forms from the same authored definitions, with a clear guide to
   whole-page switching and scoped styling.
2. **Density presets.** Add compact, comfortable, and touch-oriented spacing as an independent
   choice. Cover tables, forms, navigation, and toolbars together; preserve readable type, keyboard
   focus, and minimum interactive target sizes. Prove combinations with both existing looks and
   glass surfaces rather than maintaining a separate component implementation for each setting.
3. **Visual theme builder and preset gallery.** Preview real components while choosing look,
   surface treatment, mode, accent, density, radius, typography, and elevation. Export validated
   runtime presets and CSS, explain contrast corrections, and support importing and resetting a
   saved preset. Reuse the existing token validation and interchange formats.
4. **Additional visual families, guided by consumer demand.** Evaluate a restrained enterprise
   look informed by Fluent and a more rounded, expressive look informed by Material. Build
   original Lyra definitions from public design principles; document the supported visual scope
   rather than promising exact native-platform rendering or behavioral parity.

### Glass design scope

Use Liquid Glass as design inspiration: translucent fill, backdrop blur, restrained edge
highlights, and clear elevation. Keep content surfaces such as tables, editors, documents, and
long conversations readable and visually stable. Start with a regular, more opaque treatment;
consider a clearer media-overlay variant only when its background and contrast can be controlled.
Do not stack glass layers indiscriminately or make pointer-driven distortion a requirement.

Look, surface treatment, color mode, accent, and density should remain separate choices. A user
should be able to combine shadcn controls with a glass navigation surface and a compact data table.
Exact new API names and scoping rules belong in an RFC before implementation; the existing
`setLyraTheme()` and preset APIs remain the starting point.

### Completion evidence

- Switching and resetting presets removes obsolete overrides, preserves unrelated choices, and
  works with persistence, pre-paint restoration, SSR/hydration, and document adoption.
- Glass remains usable without backdrop filtering, has an explicit solid-surface override, and
  responds to reduced transparency where supported, forced colors, and reduced motion.
- Text, controls, focus rings, and selected states stay legible over varied live backgrounds in
  light and dark mode. Include RTL, narrow allocations, zoom, long labels, and nested surfaces.
- Chromium, Firefox, and WebKit exercise the actual combinations. Review visual captures and
  scrolling/animation performance on representative desktop and mobile hardware; record results
  before claiming cross-browser visual parity.
- Every delivered choice includes Storybook examples, consumer documentation, generated token/API
  artifacts where applicable, and measured loading/bundle costs. Optional looks and effects remain
  optional imports.

### Research informing these priorities

Reviewed on 2026-09-26. These sources demonstrate established design approaches; they are not a
survey or ranking of Lyra users' requests. The delivery order above is a product recommendation.

- [Apple: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
  places Liquid Glass on a navigation/control layer and distinguishes regular and clear treatments.
  This supports starting with selective glass surfaces instead of making every content panel glass.
- [Microsoft Fluent: Material](https://fluent2.microsoft.design/material) distinguishes opaque and
  translucent materials, including acrylic for transient surfaces. This supports a surface choice
  that can vary by role independently of the overall look.
- [Vaadin Aura: Density and sizing](https://vaadin.com/docs/latest/styling/themes/aura/other) exposes
  shared sizing and radius controls. This supports making density consistent across a whole UI.
- [Web Awesome: Customizing and theming](https://webawesome.com/docs/customizing) offers scoped
  themes and a visual builder. This supports an easy selection/export workflow for consumers.
- [shadcn/ui: Theming](https://ui.shadcn.com/docs/theming) uses semantic CSS variables and a visual
  preset workflow. This supports extending Lyra's existing validated token presets.
