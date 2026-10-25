<template>
  <div
    class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white"
  >
    <div
      v-for="item in PETTY_CASH_DENOMINATIONS"
      :key="item.key"
      class="px-3 py-1.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
    >
      <div class="w-24 shrink-0">
        <PoTypography size="xs" strong>{{ item.label }}</PoTypography>
      </div>
      <div class="w-28 grow sm:grow-0">
        <PoInputField
          v-model="counts[item.key]"
          type="number"
          :min="0"
          placeholder="0"
          label-sr-only
          :label="`${item.label} count`"
        />
      </div>
      <div class="w-28 shrink-0 text-right">
        <PoTypography size="xs" class="tabular-nums">
          {{ formatMoney((Number(counts[item.key]) || 0) * item.value) }}
        </PoTypography>
      </div>
    </div>
    <dl class="px-3 py-2.5 space-y-1.5 bg-slate-50">
      <div class="flex items-center justify-between">
        <dt class="text-xs text-slate-600">Pieces counted</dt>
        <dd class="text-xs text-slate-900 tabular-nums">{{ pieces }}</dd>
      </div>
      <div class="flex items-center justify-between">
        <dt class="text-xs font-semibold text-slate-900">Total counted</dt>
        <dd class="text-sm font-semibold text-slate-900 tabular-nums">{{ formatMoney(total) }}</dd>
      </div>
      <template v-if="expected !== undefined">
        <div class="flex items-center justify-between">
          <dt class="text-xs text-slate-600">Expected</dt>
          <dd class="text-xs text-slate-900 tabular-nums">{{ formatMoney(expected) }}</dd>
        </div>
        <div class="flex items-center justify-between pt-1.5 border-t border-slate-200">
          <dt class="text-xs font-semibold text-slate-900">Difference</dt>
          <dd
            class="text-sm font-semibold tabular-nums"
            :class="difference === 0 ? 'text-green-700' : 'text-orange-700'"
          >
            {{
              difference === 0
                ? 'Balanced'
                : `${difference > 0 ? '+' : ''}${formatMoney(difference)}`
            }}
          </dd>
        </div>
      </template>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { formatMoney } from '~/utils/pettyCashFormat';

import { computed } from 'vue';
import { PoInputField, PoTypography } from '@pension/ui-kit';
import { PETTY_CASH_DENOMINATIONS, denominationTotal, cashDifference } from '~/utils/pettyCashStatus';

const props = defineProps<{ expected?: number }>();
const counts = defineModel<Record<string, number | ''>>({ required: true });

const total = computed(() => denominationTotal(counts.value));
const pieces = computed(() =>
  PETTY_CASH_DENOMINATIONS.reduce((sum, d) => sum + (Number(counts.value[d.key]) || 0), 0),
);
const difference = computed(() => cashDifference(total.value, props.expected ?? 0));
</script>
