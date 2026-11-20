import '@aceshooting/lyra-ui/components/lr-widget.js';

document.querySelector('lr-widget')?.newMethod();
document.querySelector('lr-widget').newProperty = 'value';
document.querySelector('lr-widget').addEventListener('lr-new-event', onChange);
