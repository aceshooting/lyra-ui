---
'@aceshooting/lyra-ui': major
---

Rail toggles keep their accessible names as their state changes. Migrate state-specific string overrides to `navigation`, `appRailPin`, `appRailItemToggle`, and `appRailGroupToggle`.
Assigning `open`, `railWidth`, or a menu item's `checked` inside its request listener resolves the request, including a write of the held value.
Read-only steppers retain focus on the list when they replace a focused step.
Steppers expose progress and error states as localized text and restore orientation defaults when their attributes are removed.
Tabs, segments, steps, and rail items distinguish selected or current states in forced colors.
Navigation controls ignore composing and modified navigation keys. Holding an activation or close key triggers one action.
Navigation landmarks and groups forward host descriptions to their semantic owners and support consistent label properties.
Menu item details and shortcuts describe the item while its visible action text supplies the name.
Tab groups and segmented controls suppress stale selection notifications. Tab groups report a replacement selection after rendering it.
Tab buttons honor descriptor labels and live label references. Screen readers can close individual tabs using named actions.
Steppers and segmented controls expose the number of input positions beyond their collection limits.
Menu and menubar items emit show and hide notifications when their menus change state.
Rail resizing, navigation indicators, and segment scrolling use layout coordinates under scaling. Navigation menus respond to resizing when ResizeObserver is unavailable.
Navigation components expose additional chrome and interaction color tokens. Current rail rows show hover feedback and rail tooltips use the shared overlay surface.
Rail backdrops respect reduced motion and stop intercepting input when closed.
Breadcrumbs, navigation links, and tab panels keep emergency wrapping scoped to their labels.
