export * from './knowledge-base.class.js';
import { LyraKnowledgeBase } from './knowledge-base.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../data/table/table.js';
import '../../overlays/badge/badge.js';
import '../../data/stat/stat.js';
import '../../layout/menu/menu.js';
import '../../forms/button/button.js';
defineElement('knowledge-base', LyraKnowledgeBase);
