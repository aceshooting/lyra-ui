import { mount } from 'svelte';

import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-ui/native.css';
import '@aceshooting/lyra-ui/utilities.css';
import '@aceshooting/lyra-ui/components/lr-input.js';
import '@aceshooting/lyra-ui/components/lr-table.js';

import App from './App.svelte';
import './styles.css';

const target = document.querySelector('#app');
if (!(target instanceof HTMLElement)) throw new Error('Missing #app mount point');
mount(App, { target });
