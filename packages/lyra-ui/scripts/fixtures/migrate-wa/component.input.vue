<template>
  <wa-widget :old-property="value" mode="compact" @wa-old-event="onChange">
    <template #old-slot>Content</template>
  </wa-widget>
</template>

<style>
wa-widget::part(old-part) { color: var(--wa-old-color); }
</style>
