/** @deprecated Import @aceshooting/lyra-ui/components/lr-toast.js to register this component. */
export * from './toast.class.js';
import { LyraToast } from './toast.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './toast-item.js';
defineElement('toast', LyraToast);
