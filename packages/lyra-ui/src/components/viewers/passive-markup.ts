import type { HtmlSanitizer } from '../../internal/optional-peer-capabilities.js';

/** Embedded-markup contexts with different namespace and transclusion constraints. */
export type PassiveMarkupProfile = 'passive-document' | 'transclusion' | 'passive-svg';

const REMOVED_WITH_CONTENT = new Set([
  'a',
  'button',
  'details',
  'dialog',
  'fieldset',
  'form',
  'label',
  'select',
  'summary',
  'textarea',
]);

const REMOVED_ENTIRELY = new Set([
  'animate',
  'animatemotion',
  'animatetransform',
  'applet',
  'audio',
  'base',
  'canvas',
  'embed',
  'fencedframe',
  'frame',
  'iframe',
  'input',
  'link',
  'meta',
  'noscript',
  'object',
  'option',
  'optgroup',
  'picture',
  'portal',
  'script',
  'set',
  'discard',
  'source',
  'style',
  'track',
  'video',
]);

const NETWORK_ATTRIBUTES = new Set([
  'action',
  'background',
  'cite',
  'data',
  'formaction',
  'href',
  'manifest',
  'ping',
  'poster',
  'profile',
  'src',
  'srcdoc',
  'srcset',
  'usemap',
  'xlink:href',
]);

const INTERACTION_ATTRIBUTES = new Set([
  'autofocus',
  'contenteditable',
  'download',
  'draggable',
  'form',
  'formaction',
  'popover',
  'tabindex',
  'target',
]);

const SVG_FRAGMENT_ATTRIBUTES = new Set([
  'clip-path',
  'color-profile',
  'cursor',
  'fill',
  'filter',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);

const LOCAL_FRAGMENT = /^#[A-Za-z_][\w:.-]*$/;
const LOCAL_FRAGMENT_URL = /^\s*url\(\s*(['"]?)#([A-Za-z_][\w:.-]*)\1\s*\)\s*$/i;
const INLINE_RASTER_DATA = /^data:image\/(?:gif|jpeg|png|webp);base64,[a-z\d+/=\s]+$/i;

function replaceWithContents(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
}

function isSvgElement(element: Element): boolean {
  return element.namespaceURI === 'http://www.w3.org/2000/svg';
}

function elementsIncludingTemplateContents(root: ParentNode): Element[] {
  const elements = [...root.querySelectorAll('*')];
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index]!;
    if (element.localName === 'template' && 'content' in element) {
      for (const child of (element as HTMLTemplateElement).content.querySelectorAll('*')) elements.push(child);
    }
  }
  return elements;
}

/**
 * Applies the network-silent, non-interactive half of embedded-markup sanitization after the
 * required DOMPurify pass. DOMPurify remains the parser/XSS boundary; this second pass narrows
 * resource, navigation, form, CSS, shadow-part styling and custom-element sinks according to the
 * viewer context.
 */
export function sanitizePassiveMarkup(
  sanitizer: HtmlSanitizer,
  raw: string,
  ownerDocument: Document,
  profile: PassiveMarkupProfile = 'passive-document',
): string {
  const purified = String(sanitizer.sanitize(
    raw,
    profile === 'passive-svg'
      ? {
          USE_PROFILES: { svg: true, svgFilters: true },
          // DOMPurify excludes SVG <use> defensively. The post-pass below narrows both href forms
          // to an unescaped same-document fragment, which is the one passive form we can retain.
          ADD_TAGS: ['use'],
          ADD_ATTR: ['href', 'xlink:href'],
        }
      : undefined,
  ));
  const template = ownerDocument.createElement('template');
  template.innerHTML = purified;

  for (const element of elementsIncludingTemplateContents(template.content)) {
    const localName = element.localName.toLowerCase();
    if (REMOVED_ENTIRELY.has(localName)) {
      element.remove();
      continue;
    }
    // Transclusion may keep a same-fragment HTML anchor because it cannot leave the current
    // document or initiate a request; lr-include rebases and rejects unresolved targets before
    // insertion. Document previews and image-like SVG remain entirely non-interactive.
    const retainedTransclusionAnchor = profile === 'transclusion' && localName === 'a';
    if (REMOVED_WITH_CONTENT.has(localName) && !retainedTransclusionAnchor) {
      replaceWithContents(element);
      continue;
    }
    // An upgrading custom element can run arbitrary connectedCallback work even when DOMPurify
    // removed event handlers. Embedded documents therefore keep its text/children but never the
    // upgradeable host itself.
    if (localName.includes('-')) {
      replaceWithContents(element);
      continue;
    }

    for (const attributeName of element.getAttributeNames()) {
      const name = attributeName.toLowerCase();
      const value = element.getAttribute(attributeName) ?? '';
      if (
        name === 'style'
        || name === 'part'
        || name === 'exportparts'
        || name.startsWith('on')
        || INTERACTION_ATTRIBUTES.has(name)
      ) {
        element.removeAttribute(attributeName);
        continue;
      }

      if (NETWORK_ATTRIBUTES.has(name)) {
        const keepSvgFragment = isSvgElement(element)
          && (name === 'href' || name === 'xlink:href')
          && LOCAL_FRAGMENT.test(value.trim());
        const keepInlineSvgRaster = profile === 'passive-svg'
          && isSvgElement(element)
          && element.localName.toLowerCase() === 'image'
          && (name === 'href' || name === 'xlink:href' || name === 'src')
          && INLINE_RASTER_DATA.test(value.trim());
        const keepInlineDocumentRaster = profile === 'passive-document'
          && element.localName.toLowerCase() === 'img'
          && name === 'src'
          && INLINE_RASTER_DATA.test(value.trim());
        const keepTransclusionFragment = profile === 'transclusion'
          && name === 'href'
          && LOCAL_FRAGMENT.test(value.trim());
        if (
          !keepSvgFragment &&
          !keepInlineSvgRaster &&
          !keepInlineDocumentRaster &&
          !keepTransclusionFragment
        ) {
          element.removeAttribute(attributeName);
        }
        continue;
      }

      if (SVG_FRAGMENT_ATTRIBUTES.has(name) && /url\s*\(|\\/i.test(value)) {
        // Escaped/multiple/external CSS URL grammars are deliberately outside the passive SVG
        // profile. A single unescaped local-fragment URL is the only retained form and can later
        // be deterministically rebased by lr-include.
        if (!isSvgElement(element) || !LOCAL_FRAGMENT_URL.test(value)) {
          element.removeAttribute(attributeName);
        }
      }
    }

    if (profile === 'passive-svg' && !isSvgElement(element)) {
      replaceWithContents(element);
    }
  }

  return template.innerHTML;
}
