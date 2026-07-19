import { tag } from '../../../internal/prefix.js';
import { registerWidgetType } from './registry.js';
// Import each mapped component's own *registering* side-effect entry (`<name>.js`, which calls
// `defineElement()`) -- not `<name>.class.js` (a side-effect-free class export that, on its own,
// never actually registers the custom element; see `<name>.ts` for the file that does).
import '../../layout/card/card.js';
import '../../overlays/badge/badge.js';
import '../../forms/button/button.js';
import '../../data/stat/stat.js';
import '../../agent-tools/result-card/result-card.js';
import '../../agent-tools/result-card/result-field.js';
import '../markdown/markdown.js';
import '../../media/media-card/media-card.js';

/** Populates the default widget-type registry with the library's built-in mappings. Called once
 *  by the side-effect entry `widget-renderer.ts`; a host wanting a leaner dependency graph can
 *  register its own registry (via the `registry` property) and import only the components it
 *  maps, instead of this module. */
export function registerDefaultWidgetTypes(): void {
  registerWidgetType('card', { tag: tag('card'), props: { appearance: 'string' } });
  registerWidgetType('badge', { tag: tag('badge'), props: { variant: 'string' } });
  registerWidgetType('button', {
    tag: tag('button'),
    props: { variant: 'string', appearance: 'string', size: 'string', disabled: 'boolean', loading: 'boolean' },
    action: { event: 'click' },
  });
  registerWidgetType('stat', {
    tag: tag('stat'),
    props: { label: 'string', value: 'string', unit: 'string', variant: 'string', caption: 'string', sub: 'string' },
  });
  registerWidgetType('result-card', { tag: tag('result-card'), props: { title: 'string' } });
  registerWidgetType('result-field', { tag: tag('result-field'), props: { label: 'string', value: 'string' } });
  registerWidgetType('markdown', {
    tag: tag('markdown'),
    props: { content: 'string' },
    forcedProps: { sanitize: true },
  });
  registerWidgetType('image', {
    tag: tag('media-card'),
    props: { src: 'string', alt: 'string', filename: 'string' },
    forcedProps: { kind: 'image' },
  });
}
