import '@awesome.me/webawesome/dist/components/widget/widget.js';

document.querySelector('wa-widget')?.oldMethod();
document.querySelector('wa-widget').oldProperty = 'value';
document.querySelector('wa-widget').addEventListener('wa-old-event', onChange);
