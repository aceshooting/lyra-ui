import { defineElement, tag } from '../../../internal/prefix.js';
import { registerWidgetType } from './registry.js';
import { LyraCard } from '../../layout/card/card.class.js';
import { LyraBadge } from '../../overlays/badge/badge.class.js';
import { LyraButton } from '../../forms/button/button.class.js';
import { LyraStat } from '../../data/stat/stat.class.js';
import { LyraResultCard } from '../../agent-tools/result-card/result-card.class.js';
import { LyraResultField } from '../../agent-tools/result-card/result-field.class.js';
import { LyraMarkdown } from '../markdown/markdown.class.js';
import { LyraMediaCard } from '../../media/media-card/media-card.class.js';

/** Populates the default widget-type registry with the library's built-in mappings. Called once
 *  by the side-effect entry `widget-renderer.ts`; a host wanting a leaner dependency graph can
 *  register its own registry (via the `registry` property) and import only the components it
 *  maps, instead of this module. */
export function registerDefaultWidgetTypes(): void {
  // `src/lyra.ts` re-exports this function. Keep those root imports pure by loading class modules
  // above and installing the mapped elements only when the registry is explicitly populated.
  defineElement('card', LyraCard);
  defineElement('badge', LyraBadge);
  defineElement('button', LyraButton);
  defineElement('stat', LyraStat);
  defineElement('result-card', LyraResultCard);
  defineElement('result-field', LyraResultField);
  defineElement('markdown', LyraMarkdown);
  defineElement('media-card', LyraMediaCard);
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
