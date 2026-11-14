<template>
  <div role="status" aria-label="Loading page data" class="space-y-5 pb-8">
    <span class="sr-only">Loading page data…</span>
    <div
      v-if="stats"
      aria-hidden="true"
      class="hidden sm:grid gap-3"
      :class="stats === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'"
    >
      <PoCard v-for="n in stats" :key="n" class="p-4 space-y-3">
        <div class="h-3 w-28 max-w-full rounded bg-slate-200 motion-safe:animate-pulse" />
        <div class="h-7 w-16 rounded bg-slate-200 motion-safe:animate-pulse" />
      </PoCard>
    </div>
    <PoCard v-for="section in sections" :key="section">
      <div aria-hidden="true" class="divide-y divide-slate-100">
        <div class="px-4 py-4 bg-slate-50 border-b border-slate-200">
          <div class="h-3 w-32 rounded bg-slate-200 motion-safe:animate-pulse" />
        </div>
        <div v-for="row in rows" :key="row" class="flex items-center gap-6 px-4 py-5">
          <div class="min-w-0 flex-1 space-y-3">
            <div class="h-3 max-w-64 rounded bg-slate-200 motion-safe:animate-pulse" />
            <div class="h-2.5 w-36 max-w-full rounded bg-slate-100 motion-safe:animate-pulse" />
          </div>
          <div class="hidden sm:block h-3 w-24 rounded bg-slate-100 motion-safe:animate-pulse" />
          <div class="h-5 w-20 rounded bg-slate-200 motion-safe:animate-pulse" />
        </div>
      </div>
    </PoCard>
  </div>
</template>

<script setup lang="ts">
import { PoCard } from '@pension/ui-kit';

withDefaults(defineProps<{ stats?: number; sections?: number; rows?: number }>(), {
  stats: 0,
  sections: 1,
  rows: 4,
});
</script>
