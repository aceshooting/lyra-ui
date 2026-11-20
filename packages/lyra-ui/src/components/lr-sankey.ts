export * from './data/sankey/sankey.class.js';
import { LyraSankey } from './data/sankey/sankey.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('sankey', LyraSankey);
