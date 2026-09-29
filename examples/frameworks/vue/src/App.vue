<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import type { LyraInput } from '@aceshooting/lyra-ui/components/lr-input.js';
import type { TableColumn } from '@aceshooting/lyra-ui/components/lr-table.js';
import type {} from '@aceshooting/lyra-ui/vue';

interface Person {
  id: number;
  name: string;
  role: string;
}

const input = useTemplateRef<LyraInput>('input');
const query = ref('');
const people: Person[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Analyst' },
  { id: 2, name: 'Grace Hopper', role: 'Engineer' },
  { id: 3, name: 'Katherine Johnson', role: 'Mathematician' },
];
function personFrom(row: unknown): Person {
  return row as Person;
}
const columns: TableColumn<unknown>[] = [
  { key: 'name', label: 'Name', cell: (row) => personFrom(row).name, sortable: true },
  { key: 'role', label: 'Role', cell: (row) => personFrom(row).role },
];
const rowKey = (row: unknown) => personFrom(row).id;
const rows = computed(() =>
  people.filter((person) => person.name.toLowerCase().includes(query.value.toLowerCase())),
);

function onChange(event: CustomEvent<{ value: string }>): void {
  query.value = event.detail.value;
}
</script>

<template>
  <main class="lr-native lr-stack lr-gap-l">
    <header class="lr-stack lr-gap-xs">
      <h1>People</h1>
      <p>Vue's property modifier keeps array values out of string attributes.</p>
    </header>

    <div class="lr-cluster lr-gap-s">
      <lr-input
        ref="input"
        label="Filter by name"
        :value="query"
        with-clear
        @lr-change="onChange"
      />
      <button type="button" @click="input?.select()">Select filter text</button>
    </div>

    <lr-table
      accessible-label="People matching the filter"
      :row-key.prop="rowKey"
      :columns.prop="columns"
      :rows.prop="rows"
    />
  </main>
</template>
