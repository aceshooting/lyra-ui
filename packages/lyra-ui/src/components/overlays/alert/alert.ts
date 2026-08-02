export * from './alert.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../toast/toast.js';
import { LyraAlert } from './alert.class.js';

defineElement('alert', LyraAlert);
