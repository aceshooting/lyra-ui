export * from './data/funnel/funnel.class.js';
import { LyraFunnel } from './data/funnel/funnel.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('funnel', LyraFunnel);
