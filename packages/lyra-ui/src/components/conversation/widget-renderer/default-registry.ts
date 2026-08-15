import { tag } from '../../../internal/prefix.js';
import { createWidgetTypeRegistry } from './registry.js';

/** Immutable registry used by a renderer unless its instance receives an explicit override. */
export const DEFAULT_WIDGET_TYPE_REGISTRY = createWidgetTypeRegistry([
  [
    'card',
    { tag: tag('card'), interaction: 'none', props: { appearance: 'string' } },
  ],
  [
    'badge',
    { tag: tag('badge'), interaction: 'none', props: { variant: 'string' } },
  ],
  [
    'button',
    {
      tag: tag('button'),
      props: {
        variant: 'string',
        appearance: 'string',
        size: 'string',
        disabled: 'boolean',
        loading: 'boolean',
      },
      interaction: 'control',
      action: { event: 'click' },
    },
  ],
  [
    'stat',
    {
      tag: tag('stat'),
      interaction: 'none',
      props: {
        label: 'string',
        value: 'string',
        unit: 'string',
        variant: 'string',
        caption: 'string',
        sub: 'string',
      },
    },
  ],
  [
    'result-card',
    {
      tag: tag('result-card'),
      interaction: 'none',
      props: { title: 'string' },
    },
  ],
  [
    'result-field',
    {
      tag: tag('result-field'),
      interaction: 'none',
      props: { label: 'string', value: 'string' },
    },
  ],
  [
    'markdown',
    {
      tag: tag('markdown'),
      interaction: 'none',
      props: { content: 'string' },
    },
  ],
  [
    'image',
    {
      tag: tag('media-card'),
      interaction: 'none',
      props: { src: 'string', alt: 'string', filename: 'string' },
      forcedProps: { kind: 'image' },
    },
  ],
]);
