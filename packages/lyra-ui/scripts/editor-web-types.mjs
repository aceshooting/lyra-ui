// Projects one `custom-elements.json` class declaration into the JetBrains web-types contributions
// that are NOT attributes: `js/properties`, `js/events` and `slots`.
//
// Why this file exists: these are Lit components, so the idiomatic binding is `.prop=${…}` and
// `@lr-event=${…}` in a template, not an attribute. An attributes-only `web-types.json` therefore
// described the minority spelling and dropped the majority -- including the roughly 860 public
// fields declared `attribute: false`, which are frequently a component's PRIMARY API
// (`lr-chart.datasets`, `lr-heatmap.legendStops`, `lr-lite-chart.formatter`, …) and so reachable
// through no contribution at all. The schema this file's output declares
// (https://json.schemastore.org/web-types) models all three directly: an `html-element` is a
// `base-contribution` (which carries the `js` namespace, whose two IDE-integrated kinds are
// `properties` and `events`) merged with an
// `html-contributions-host` (whose `patternProperties` accept further HTML kinds such as `slots`).
//
// The VS Code sibling `vscode-html-data.json` stays attributes-only on purpose: custom-data v1.1
// has no properties/events/slots concept, so its slot table remains prose inside the tag
// description. Do not "fix" that file to match this one.
//
// Everything here is a pure function of the manifest declaration so `editor-web-types.test.mjs` can
// assert the projection is complete relative to `custom-elements.json` -- a new element, or a new
// member on an existing element, cannot ship without reaching an editor.

/**
 * Prose for a structured `deprecation` record (component metadata's shape, also attached to
 * deprecated attributes and members). Shared with the `vscode-html-data.json` emitter, which shows
 * the same sentence in attribute documentation.
 */
export function deprecationDescription(deprecation) {
  if (!deprecation) return undefined;
  const replacement = deprecation.replacement?.usage ?? deprecation.replacement?.name;
  return `Deprecated since \`${deprecation.since}\`. Use ${deprecation.replacement?.kind ?? 'API'} ` +
    `\`${replacement}\`. Removal is not permitted before \`${deprecation.removalNotBefore}\`. ` +
    deprecation.rationale;
}

/**
 * A manifest member reaches `js/properties` when it is a public instance field. `static` members
 * (`formAssociated`, `validators`) live on the constructor, never on an element instance, so
 * offering them as a property binding would be wrong rather than merely noisy; methods have no
 * IDE-integrated web-types kind (`js/symbols` is a JS-resolve-only vocabulary) and stay documented
 * in the manifest and the family reference.
 */
export function isEditorProperty(member) {
  return member?.kind === 'field' &&
    member.static !== true &&
    (member.privacy === undefined || member.privacy === 'public');
}

function propertyDescription(member) {
  const sections = [];
  if (member.description) sections.push(member.description);
  const deprecation = deprecationDescription(member.deprecation);
  if (deprecation) sections.push(deprecation);
  const meta = [];
  if (member.attribute) meta.push(`Attribute: \`${member.attribute}\``);
  if (member.reflects) meta.push('Reflected to its attribute.');
  if (meta.length) sections.push(meta.join('  \n'));
  return sections.length ? sections.join('\n\n') : undefined;
}

/** web-types `js/properties` entries for one element, in manifest order. */
export function elementProperties(declaration) {
  return (declaration.members ?? []).filter(isEditorProperty).map((member) => {
    const description = propertyDescription(member);
    const deprecated = typeof member.deprecated === 'string'
      ? member.deprecated
      : member.deprecated === true || member.deprecation
        ? true
        : undefined;
    return {
      name: member.name,
      ...(description ? { description } : {}),
      ...(member.type?.text ? { type: member.type.text } : {}),
      ...(member.default !== undefined ? { default: String(member.default) } : {}),
      ...(member.readonly ? { 'read-only': true } : {}),
      ...(deprecated ? { deprecated } : {}),
    };
  });
}

/**
 * web-types `js/events` entries for one element. The manifest's event type text is the dispatched
 * `CustomEvent<…Detail>` specialization, which is exactly what an `@lr-event=${…}` binding's
 * handler parameter should be typed as.
 */
export function elementEvents(declaration) {
  return (declaration.events ?? []).map((event) => ({
    name: event.name,
    ...(event.description ? { description: event.description } : {}),
    ...(event.type?.text ? { type: event.type.text } : {}),
  }));
}

/**
 * web-types `slots` entries for one element. The default slot keeps the manifest's empty name --
 * that is literally the value a `slot=""` attribute takes, so it stays a usable completion rather
 * than an invented `default` alias no shadow root would match.
 */
export function elementSlots(declaration) {
  return (declaration.slots ?? []).map((slot) => ({
    name: slot.name ?? '',
    ...(slot.description ? { description: slot.description } : {}),
  }));
}

/**
 * The non-attribute half of one `html-element` contribution, ready to spread beside `name`,
 * `description` and `attributes`. Empty containers are omitted so an element that genuinely has no
 * slots or events does not ship an empty array.
 */
export function webTypesElementContributions(declaration) {
  const slots = elementSlots(declaration);
  const properties = elementProperties(declaration);
  const events = elementEvents(declaration);
  const js = {
    ...(properties.length ? { properties } : {}),
    ...(events.length ? { events } : {}),
  };
  return {
    ...(slots.length ? { slots } : {}),
    ...(Object.keys(js).length ? { js } : {}),
  };
}
