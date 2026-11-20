import { readInlineStyleValue, sameInlineStyleValue, type InlineStyleValue } from '../../../internal/style-property-lease.js';

// `position`/`inset-block`/`inset-inline-start`/`inset-inline-end` used to be owned here too, but
// their floating-state value is always the same fixed literal ('absolute', '0') rather than
// per-render computed data -- see multi-split.styles.ts's `::slotted([data-collapse-state='floating'])`
// rule, which now owns them as ordinary (overridable) stylesheet rules instead. Only genuinely
// live, per-render-computed properties stay here: `inline-size` mirrors the panel's own live,
// draggable `sizes[i]` percent (by design, so there's no visual jump un-floating -- see updated()).
const OWNED_PANEL_STYLE_PROPERTIES = ['flex', 'order', 'inline-size', '--_lr-multi-split-panel-min'] as const;
/** Marker attributes projected onto panels: the responsive pane's state and the per-panel fold. */
export const OWNED_PANEL_ATTRIBUTES = ['data-collapse-state', 'data-panel-collapsed'] as const;

type OwnedPanelAttribute = (typeof OWNED_PANEL_ATTRIBUTES)[number];

type OwnedPanelStyleProperty = (typeof OWNED_PANEL_STYLE_PROPERTIES)[number];

export interface PanelOwnershipSnapshot {
  readonly styles: Map<OwnedPanelStyleProperty, InlineStyleValue>;
  readonly appliedStyles: Map<OwnedPanelStyleProperty, InlineStyleValue>;
  hidden: HTMLElement['hidden'];
  appliedHidden?: HTMLElement['hidden'];
  readonly attributes: Map<OwnedPanelAttribute, string | null>;
  readonly appliedAttributes: Map<OwnedPanelAttribute, string | null>;
}

export function snapshotPanelOwnership(panel: HTMLElement): PanelOwnershipSnapshot {
  const styles = new Map<OwnedPanelStyleProperty, InlineStyleValue>();
  for (const property of OWNED_PANEL_STYLE_PROPERTIES) {
    styles.set(property, readInlineStyleValue(panel, property));
  }
  const attributes = new Map<OwnedPanelAttribute, string | null>();
  for (const name of OWNED_PANEL_ATTRIBUTES) attributes.set(name, panel.getAttribute(name));
  return {
    styles,
    appliedStyles: new Map(),
    hidden: panel.hidden,
    attributes,
    appliedAttributes: new Map(),
  };
}

/** Detects external writes to the projected styles, visibility and marker attributes.
 * Before projection or release, adopt every change so the latest authored values survive. */
export function panelProjectionChanged(panel: HTMLElement, snapshot: PanelOwnershipSnapshot, adopt = false): boolean {
  let changed = false;
  for (const property of OWNED_PANEL_STYLE_PROPERTIES) {
    const current = readInlineStyleValue(panel, property);
    const expected = snapshot.appliedStyles.get(property) ?? snapshot.styles.get(property)!;
    if (!sameInlineStyleValue(current, expected)) {
      if (!adopt) return true;
      snapshot.styles.set(property, current);
      changed = true;
    }
  }
  const hidden = panel.hidden;
  if (hidden !== (snapshot.appliedHidden ?? snapshot.hidden)) {
    if (!adopt) return true;
    snapshot.hidden = hidden;
    changed = true;
  }
  for (const name of OWNED_PANEL_ATTRIBUTES) {
    const current = panel.getAttribute(name);
    const expected = snapshot.appliedAttributes.has(name) ? snapshot.appliedAttributes.get(name) : snapshot.attributes.get(name);
    if (current !== expected) {
      if (!adopt) return true;
      snapshot.attributes.set(name, current);
      changed = true;
    }
  }
  return changed;
}

export function applyOwnedPanelStyle(
  panel: HTMLElement,
  snapshot: PanelOwnershipSnapshot,
  property: OwnedPanelStyleProperty,
  value: InlineStyleValue
): void {
  if (value.value === '') panel.style.removeProperty(property);
  else panel.style.setProperty(property, value.value, value.priority);
  snapshot.appliedStyles.set(property, readInlineStyleValue(panel, property));
}

export function applyOwnedPanelStyleValue(
  panel: HTMLElement,
  snapshot: PanelOwnershipSnapshot,
  property: OwnedPanelStyleProperty,
  value: string
): void {
  applyOwnedPanelStyle(panel, snapshot, property, {
    value,
    priority: '',
  });
}

export function applyOwnedPanelHidden(
  panel: HTMLElement,
  snapshot: PanelOwnershipSnapshot,
  hidden: HTMLElement['hidden']
): void {
  panel.hidden = hidden;
  snapshot.appliedHidden = panel.hidden;
}

export function applyOwnedPanelAttribute(
  panel: HTMLElement,
  snapshot: PanelOwnershipSnapshot,
  name: OwnedPanelAttribute,
  value: string | null
): void {
  if (value === null) panel.removeAttribute(name);
  else panel.setAttribute(name, value);
  snapshot.appliedAttributes.set(name, panel.getAttribute(name));
}

export function restorePanelOwnership(
  panel: HTMLElement,
  snapshot: PanelOwnershipSnapshot
): void {
  panelProjectionChanged(panel, snapshot, true);
  for (const property of OWNED_PANEL_STYLE_PROPERTIES) {
    const value = snapshot.styles.get(property)!;
    if (value.value === '') panel.style.removeProperty(property);
    else panel.style.setProperty(property, value.value, value.priority);
  }
  panel.hidden = snapshot.hidden;
  for (const name of OWNED_PANEL_ATTRIBUTES) {
    const value = snapshot.attributes.get(name) ?? null;
    if (value === null) panel.removeAttribute(name);
    else panel.setAttribute(name, value);
  }
}
