import '@awesome.me/webawesome/dist/components/widget/widget.js';

document.querySelector<HTMLElement>('wa-widget')!.oldProperty = 'value';
document.querySelector<HTMLElement>('wa-widget')?.oldMethod();
