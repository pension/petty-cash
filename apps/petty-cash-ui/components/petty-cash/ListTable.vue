<template>
  <!--
    Reads like a table on desktop (header + aligned columns) but is a plain list,
    so each row can collapse into a card on smaller screens.
    Rows share the column template through the --list-cols CSS variable.
  -->
  <div :style="{ '--list-cols': template }">
    <div
      class="hidden xl:grid xl:grid-cols-[var(--list-cols)] gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200"
      role="presentation"
    >
      <div
        v-for="col in columns"
        :key="col.label"
        class="text-xs font-medium text-slate-500 truncate"
        :class="(col.align === 'right' || col.actions) && 'text-right'"
      >
        {{ col.label }}
      </div>
    </div>
    <!-- Phones/tablets: separate cards on a tinted background. Desktop: divided rows. -->
    <ul
      class="max-xl:space-y-2.5 max-xl:p-2.5 max-xl:bg-slate-100/70 xl:divide-y xl:divide-slate-100"
    >
      <slot />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue';

export interface ListColumn {
  label: string;
  // Any CSS grid track size; defaults to a flexible column.
  width?: string;
  align?: 'right';
  // Marks the trailing column that holds each row's action buttons.
  actions?: boolean;
}

const props = defineProps<{ columns: ListColumn[] }>();

const template = computed(() => props.columns.map((c) => c.width || 'minmax(8rem,1fr)').join(' '));

provide(
  'listHasActions',
  computed(() => props.columns.some((c) => c.actions)),
);
</script>
