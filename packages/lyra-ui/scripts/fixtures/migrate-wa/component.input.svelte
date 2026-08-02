<wa-widget bind:old-property={value} mode="compact" on:wa-old-event={onChange}>
  <span slot="old-slot">Content</span>
</wa-widget>

<style>
  wa-widget::part(old-part) { --wa-old-color: red; }
</style>
