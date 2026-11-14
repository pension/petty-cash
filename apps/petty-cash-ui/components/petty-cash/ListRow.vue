<template>
  <li
    class="bg-white transition-colors xl:hover:bg-slate-50/60 max-xl:rounded-lg max-xl:border max-xl:border-slate-200 max-xl:shadow-xs"
  >
    <!-- Card layout: phones and tablets -->
    <div class="xl:hidden px-4 py-3">
      <div class="flex items-start justify-between gap-3 min-w-0">
        <component
          :is="to ? NuxtLink : 'div'"
          :to="to"
          class="min-w-0 flex-1"
          :class="to ? 'group focus-visible:outline-none' : ''"
        >
          <PoTypography
            size="sm"
            strong
            class="block text-slate-900 line-clamp-2"
            :class="
              to
                ? 'group-hover:text-sky-700 group-focus-visible:text-sky-700 transition-colors'
                : ''
            "
          >
            {{ title }}
          </PoTypography>
          <PoTypography v-if="meta" size="xs" variant="dimmed" class="block mt-0.5">
            {{ meta }}
          </PoTypography>
          <div v-if="status" class="mt-1.5">
            <PoStatusPill :label="status.label" :color="status.color" />
          </div>
        </component>

        <div v-if="amount" class="shrink-0 flex flex-col items-end text-right">
          <span
            class="text-sm font-semibold tabular-nums"
            :class="amountClass || 'text-slate-900'"
            >{{ amount }}</span
          >
          <span v-if="subAmount" class="text-xs text-slate-500 tabular-nums">{{ subAmount }}</span>
        </div>
      </div>

      <div
        v-if="$slots.actions"
        class="mt-3 flex items-center gap-2 *:flex-1 sm:justify-end sm:*:flex-none [&>button>span]:justify-center"
      >
        <slot name="actions" />
      </div>
    </div>

    <!-- Table-like layout: desktop. Cells line up with the ListTable header. -->
    <div class="hidden xl:grid xl:grid-cols-[var(--list-cols)] gap-4 items-center px-4 py-2.5">
      <div
        v-for="(cell, i) in cells"
        :key="i"
        class="min-w-0"
        :class="cell.align === 'right' && 'text-right'"
      >
        <PoStatusPill v-if="cell.status" :label="cell.status.label" :color="cell.status.color" />
        <NuxtLink
          v-else-if="cell.to"
          :to="cell.to"
          class="text-sm font-medium text-slate-900 hover:text-sky-700 focus-visible:text-sky-700 focus-visible:outline-none transition-colors"
          :class="[cell.wrap ? 'line-clamp-2' : 'block truncate', cell.class]"
          :title="cell.text"
        >
          {{ cell.text }}
        </NuxtLink>
        <span
          v-else-if="cell.text"
          class="text-sm text-slate-700"
          :class="[cell.wrap ? 'line-clamp-2' : 'block truncate', cell.class]"
          :title="cell.text"
        >
          {{ cell.text }}
        </span>
        <span v-if="cell.sub" class="block truncate text-xs text-slate-500">{{ cell.sub }}</span>
      </div>
      <div v-if="hasActions" class="flex items-center justify-end gap-2">
        <slot name="actions" />
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, inject, type ComputedRef } from 'vue';
import { PoStatusPill, PoTypography } from '@pension/ui-kit';
import { NuxtLink } from '#components';

export interface ListCell {
  text?: string;
  sub?: string;
  to?: string;
  status?: { label: string; color: string };
  align?: 'right';
  class?: string;
  // Allow up to two lines instead of truncating; use for the flexible text column.
  wrap?: boolean;
}

defineProps<{
  // Card layout (phones and tablets)
  title: string;
  meta?: string;
  to?: string;
  amount?: string;
  amountClass?: string;
  subAmount?: string;
  status?: { label: string; color: string };
  // Table-like layout (desktop): one entry per ListTable column, excluding the actions column.
  cells: ListCell[];
}>();

const hasActionsRef = inject<ComputedRef<boolean> | null>('listHasActions', null);
const hasActions = computed(() => hasActionsRef?.value ?? false);
</script>
