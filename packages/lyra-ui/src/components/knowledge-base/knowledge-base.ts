export * from './knowledge-base.class.js';
import { LyraKnowledgeBase } from './knowledge-base.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../table/table.js';
import '../badge/badge.js';
import '../stat/stat.js';
import '../menu/menu.js';
import '../button/button.js';
defineElement('knowledge-base', LyraKnowledgeBase);
