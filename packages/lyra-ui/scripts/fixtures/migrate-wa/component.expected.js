import '@aceshooting/lyra-ui/components/forms/widget/widget.js';

document.querySelector('lr-widget')?.newMethod();
document.querySelector('lr-widget').newProperty = 'value';
document.querySelector('lr-widget').addEventListener('lr-new-event', onChange);
